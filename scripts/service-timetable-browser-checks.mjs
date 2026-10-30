import assert from 'node:assert/strict';
import { watchSyncStatus, waitForSync } from './sync-browser-utils.mjs';

export async function checkServiceTimetable(browser, { origin, settings, sampleMember }) {
  const clock = new Date('2026-10-30T18:20:00Z'); // Friday in Ghana, Saturday in Auckland.
  const service = (id, name, day, start, end) => ({ id, name, day_of_week: day, start_time: start, end_time: end, type: 'prayer', is_active: true, venue: 'Synthetic church hall' });
  const tables = { services: [
    service('sunday', 'Sunday Celebration', 'Sunday', '08:00', '10:30'),
    service('wednesday', 'Wednesday Solution Hour', 'Wednesday', '09:00', '13:00'),
    service('friday', 'Friday Prophetic Encounter', 'Friday', '18:30', '20:00'),
    { ...service('inactive', 'Inactive gathering', 'Friday', '18:21', '19:00'), is_active: false },
    { ...service('archive', 'Archived gathering', '', '', ''), is_active: false },
  ], settings: [{ id: 'gwcc_global_settings', ...settings }] };
  const originalServices = structuredClone(tables.services);
  let failReads = false, readGate = null, memberWrites = 0, serviceWrites = 0;
  const errors = [], contexts = [];
  const newPage = async (role, width = 390, timeZone = 'Pacific/Auckland') => {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, timezoneId: timeZone });
    contexts.push(context);
    const id = role === 'member' ? '77777777-7777-4777-8777-777777777777' : '88888888-8888-4888-8888-888888888888';
    const user = { id, email: `${role}@example.test`, aud: 'authenticated', role: 'authenticated', email_confirmed_at: clock.toISOString(), app_metadata: { provider: 'email' }, user_metadata: {} };
    const profile = { id, email: user.email, first_name: 'Timetable', last_name: 'Fixture', role, is_active: true, has_login_account: true, authorization_reviewed_at: clock.toISOString() };
    const own = { ...sampleMember, id: 'timetable-member', auth_user_id: id, first_name: 'Timetable', last_name: 'Fixture', member_id: 'GWCC-TIMETABLE' };
    const exp = Math.floor(Date.now() / 1000) + 86400;
    const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', exp })).toString('base64url')}.synthetic`;
    const session = { user, access_token: token, refresh_token: 'synthetic-only', expires_at: exp, expires_in: 86400, token_type: 'bearer' };
    await context.addInitScript(watchSyncStatus);
    await context.addInitScript(({ session }) => {
      localStorage.setItem('gwcc_supabase_url', 'https://gwcc-e2e.supabase.co');
      localStorage.setItem('gwcc_supabase_anon_key', 'test-public-key');
      localStorage.setItem('gwcc-church-auth-token', JSON.stringify(session));
      for (const key of ['gwcc_sunday_time', 'gwcc_midweek_time', 'gwcc_allnight_time', 'gwcc_cell_time']) localStorage.setItem(key, 'Old device-only timetable');
    }, { session });
    await context.route('https://gwcc-e2e.supabase.co/**', async route => {
      const req = route.request(), url = new URL(req.url());
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
      if (req.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
      let result = [];
      if (url.pathname === '/auth/v1/user') result = user;
      else if (url.pathname === '/auth/v1/token') result = session;
      else if (url.pathname === '/rest/v1/rpc/gwcc_security_status') result = { role, required: role !== 'member', verified_factors: role === 'member' ? 0 : 1, satisfied: true };
      else if (url.pathname === '/rest/v1/rpc/gwcc_apply_mutations') {
        assert.notEqual(role, 'member');
        const body = req.postDataJSON();
        result = body.p_changes.filter(c => c.table !== 'audit_logs').map(c => {
          assert.equal(c.table, 'services'); assert.equal(c.operation, 'upsert'); serviceWrites++;
          const record = { ...c.record, updated_at: clock.toISOString() };
          tables.services = tables.services.map(row => row.id === record.id ? record : row);
          return { table: 'services', record };
        });
      } else if (url.pathname.startsWith('/rest/v1/rpc/')) {
        if (role === 'member' && /action|mutation|upsert|delete/.test(url.pathname)) memberWrites++;
      } else if (url.pathname.startsWith('/rest/v1/')) {
        const table = url.pathname.split('/').at(-1);
        if (table === 'services') {
          if (readGate) await readGate;
          if (failReads) { await route.fulfill({ status: 503, headers, json: { message: 'Synthetic timetable unavailable' } }); return; }
        }
        const rows = table === 'profiles' ? [profile] : table === 'members' ? [own] : tables[table] || [];
        const range = req.headers().range?.split('-').map(Number), offset = Number(url.searchParams.get('offset') || range?.[0] || 0), limit = Number(url.searchParams.get('limit') || 500);
        result = req.headers().accept?.includes('vnd.pgrst.object') ? rows[0] || null : rows.slice(offset, offset + limit);
      }
      await route.fulfill({ status: 200, headers, body: JSON.stringify(result) });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: clock });
    return page;
  };
  const gathering = page => page.getByRole('region', { name: 'Next church gathering', exact: true });
  try {
    const admin = await newPage('super_admin', 1440, 'America/Los_Angeles');
    await admin.goto(origin + '/settings');
    await admin.getByRole('button', { name: 'Services & Timetable', exact: true }).click();
    const weekly = admin.getByRole('region', { name: 'Weekly service timetable', exact: true });
    await weekly.getByText('Sundays · 08:00 - 10:30 GMT', { exact: true }).waitFor();
    await weekly.getByText('Wednesdays · 09:00 - 13:00 GMT', { exact: true }).waitFor();
    assert.equal(await weekly.getByRole('textbox').count(), 0);
    assert.equal(await weekly.getByText(/Old device-only|Inactive gathering|Archived gathering/).count(), 0);
    assert.equal(await weekly.getByRole('link', { name: 'Small Groups', exact: true }).getAttribute('href'), '/small-groups');
    await weekly.getByRole('link', { name: 'Manage service timetable', exact: true }).click();
    await admin.locator('[data-service-id="friday"]').getByTitle('Edit service details', { exact: true }).click();
    const form = admin.getByRole('dialog', { name: 'Edit Church Service', exact: true });
    await form.getByLabel('Service start time (GMT)', { exact: true }).fill('19:00');
    const confirmation = admin.waitForResponse(response => response.url().endsWith('/rpc/gwcc_apply_mutations')
      && response.request().postDataJSON()?.p_changes?.some(change => change.table === 'services' && change.record?.start_time === '19:00'));
    await form.getByRole('button', { name: /Save|Update/ }).click();
    await confirmation;
    await waitForSync(admin);
    assert.equal(tables.services.find(row => row.id === 'friday').start_time, '19:00');
    assert.equal(serviceWrites, 1);
    await admin.goto(origin + '/settings');
    await admin.getByRole('button', { name: 'Services & Timetable', exact: true }).click();
    await admin.getByRole('region', { name: 'Weekly service timetable', exact: true }).getByText('Fridays · 19:00 - 20:00 GMT', { exact: true }).waitFor();

    for (const width of [390, 1440]) {
      const page = await newPage('member', width);
      await page.goto(origin + '/portal');
      await gathering(page).getByText('Friday Prophetic Encounter', { exact: true }).waitFor();
      assert.match(await gathering(page).innerText(), /Friday,? 30 Oct · 19:00\s*–\s*20:00 GMT/);
      assert.equal(await page.getByText(/Sunday First Service \(07:00 AM\)|Celebration Service \(10:00 AM\)|Old device-only timetable/).count(), 0);
      assert.equal(await gathering(page).getByRole('link', { name: 'Manage service timetable', exact: true }).count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
      await page.clock.setSystemTime(new Date('2026-10-30T19:00:00Z'));
      await page.clock.runFor(30001);
      await gathering(page).getByText('Gathering in progress:', { exact: true }).waitFor();
      await page.clock.setSystemTime(new Date('2026-10-30T20:00:00Z'));
      await page.clock.runFor(30001);
      await gathering(page).getByText('Sunday Celebration', { exact: true }).waitFor();
      // Another device changes the shared record. Focus reloads it without a new login.
      tables.services = tables.services.map(row => row.id === 'sunday' ? { ...row, start_time: '09:00' } : row);
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await gathering(page).getByText(/Sunday,? 1 Nov · 09:00/).waitFor();
      failReads = true;
      await gathering(page).getByRole('button', { name: 'Refresh service timetable', exact: true }).click();
      await gathering(page).getByText('Saved timetable — refresh to confirm current times.', { exact: true }).waitFor();
      assert.equal(await gathering(page).getByText('Sunday Celebration', { exact: true }).count(), 1);
      failReads = false;
      await gathering(page).getByRole('button', { name: 'Refresh service timetable', exact: true }).click();
      await gathering(page).getByText('Saved timetable — refresh to confirm current times.', { exact: true }).waitFor({ state: 'hidden' });
      await page.context().setOffline(true);
      await gathering(page).getByText('Saved timetable — refresh to confirm current times.', { exact: true }).waitFor();
      assert.equal(await gathering(page).getByRole('button', { name: 'Refresh service timetable', exact: true }).isDisabled(), true);
      await page.context().setOffline(false);
      await gathering(page).getByText('Saved timetable — refresh to confirm current times.', { exact: true }).waitFor({ state: 'hidden' });
      await page.context().close();
    }
    // A genuine empty timetable and a failed load must have different messages.
    tables.services = originalServices.map(row => ({ ...row, is_active: false }));
    const empty = await newPage('member'); await empty.goto(origin + '/portal');
    await gathering(empty).getByText('No active services are scheduled. Please contact the church office.', { exact: true }).waitFor();
    await empty.context().close();
    failReads = true;
    const failed = await newPage('member'); await failed.goto(origin + '/portal');
    await gathering(failed).getByText('Service timetable unavailable. Refresh or contact the church office.', { exact: true }).waitFor();
    assert.equal(await gathering(failed).getByText('No active services are scheduled. Please contact the church office.', { exact: true }).count(), 0);
    failReads = false;
    tables.services = [service('overnight', 'Overnight prayer', 'Friday', '22:00', '02:00')];
    await gathering(failed).getByRole('button', { name: 'Refresh service timetable', exact: true }).click();
    await gathering(failed).getByText('Overnight prayer', { exact: true }).waitFor();
    assert.match(await gathering(failed).innerText(), /Friday,? 30 Oct · 22:00\s*–\s*Saturday,? 31 Oct · 02:00 GMT/);
    await failed.context().close();
    let release;
    readGate = new Promise(resolve => { release = resolve; });
    const loading = await newPage('member'); await loading.goto(origin + '/portal');
    await gathering(loading).getByText('Loading service timetable…', { exact: true }).waitFor();
    readGate = null; release();
    await gathering(loading).getByText('Overnight prayer', { exact: true }).waitFor();
    assert.equal(memberWrites, 0);
    assert.deepEqual(errors, []);
    console.info('Service timetable browser checks passed: shared admin edit across devices, ignored legacy device fields, Ghana dates and times, live/end boundaries, inactive and archived exclusions, overnight dates, loading/empty/error/offline states, retry/focus/reconnect refresh, member permissions and mobile/desktop layout.');
  } finally {
    for (const context of contexts) await context.close();
  }
}
