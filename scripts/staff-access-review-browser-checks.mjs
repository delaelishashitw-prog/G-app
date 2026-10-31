import assert from 'node:assert/strict';
import { ROLE_PERMISSIONS } from '../src/contexts/AuthContext.tsx';
import { ACCESS_MODULES } from '../src/lib/accessModules.ts';

export async function checkStaffAccessReview(browser, { origin, settings }) {
  const rootId = '11111111-1111-4111-8111-111111111111';
  const root = { id: rootId, first_name: 'Review', last_name: 'Administrator', role: 'super_admin', email: 'review-root@example.test', is_active: true, has_login_account: true, authorization_reviewed_at: '2026-10-31T00:00:00Z' };
  const profile = (id, name, role, extra = {}) => ({ ...root, id, first_name: name, last_name: 'Fixture', email: `${id}@example.test`, role, ...extra });
  const profiles = [root, profile('finance', 'Finance', 'finance_officer'), profile('welfare', 'Welfare', 'welfare_officer'), profile('pending', 'Pending', 'data_entry', { authorization_reviewed_at: null }), profile('suspended', 'Suspended', 'pastor', { is_active: false }), profile('directory', 'Directory', 'ministry_leader', { has_login_account: false }), profile('member', 'Member', 'member', { authorization_reviewed_at: null })];
  const contexts = [], errors = [];
  let staffWrites = 0, mutationWrites = 0, signIns = 0, signOuts = 0;
  const pageFor = async (role, width) => {
    const context = await browser.newContext({ viewport: { width, height: 1000 } }); contexts.push(context);
    const current = role === 'super_admin' ? root : profile('22222222-2222-4222-8222-222222222222', 'Elisha', role, { last_name: 'Richard' });
    const user = { id: current.id, email: current.email, email_confirmed_at: '2026-10-01T00:00:00Z', aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: {} };
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', exp })).toString('base64url')}.synthetic`;
    const session = { user, access_token: token, refresh_token: 'synthetic-only', expires_at: exp, expires_in: 3600, token_type: 'bearer' };
    await context.addInitScript(({ session }) => { localStorage.setItem('gwcc_supabase_url', 'https://gwcc-e2e.supabase.co'); localStorage.setItem('gwcc_supabase_anon_key', 'test-public-key'); localStorage.setItem('gwcc-church-auth-token', JSON.stringify(session)); }, { session });
    await context.route(origin + '/api/staff', async route => { staffWrites++; await route.fulfill({ status: 403, json: { error: 'Unexpected staff operation during access review' } }); });
    await context.route('https://gwcc-e2e.supabase.co/**', async route => {
      const req = route.request(), url = new URL(req.url());
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
      if (req.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
      let result = [];
      if (url.pathname === '/auth/v1/user') result = user;
      else if (url.pathname === '/auth/v1/token') { signIns++; result = session; }
      else if (url.pathname === '/auth/v1/logout') { signOuts++; await route.fulfill({ status: 204, headers }); return; }
      else if (url.pathname === '/rest/v1/rpc/gwcc_security_status') result = { role, required: true, verified_factors: 1, satisfied: true };
      else if (url.pathname === '/rest/v1/rpc/gwcc_apply_mutations') { mutationWrites++; await route.fulfill({ status: 403, headers, json: { message: 'Unexpected mutation during access review' } }); return; }
      else if (url.pathname.startsWith('/rest/v1/') && !url.pathname.includes('/rpc/')) {
        const table = url.pathname.split('/').at(-1);
        const rows = table === 'profiles' ? url.searchParams.has('id') ? [current] : profiles : table === 'settings' ? [{ id: 'gwcc_global_settings', ...settings }] : [];
        const range = req.headers().range?.split('-').map(Number), offset = Number(url.searchParams.get('offset') || range?.[0] || 0), limit = Number(url.searchParams.get('limit') || 500);
        result = req.headers().accept?.includes('vnd.pgrst.object') ? rows[0] || null : rows.slice(offset, offset + limit);
      }
      await route.fulfill({ status: 200, headers, body: JSON.stringify(result) });
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    return { page, token, current };
  };
  const dialog = page => page.getByRole('dialog', { name: 'Staff access review', exact: true });
  const entry = (page, id) => page.locator(`[data-staff-profile-id="${id}"]`);
  const open = async (page, id) => { await entry(page, id).getByRole('button', { name: /^Review access for / }).click(); await dialog(page).waitFor(); };
  const verifyRole = async (page, role) => {
    const rows = dialog(page).getByRole('row');
    assert.equal(await rows.count(), ACCESS_MODULES.length + 1);
    for (const module of ACCESS_MODULES) {
      const row = rows.filter({ has: page.getByRole('rowheader', { name: module.label, exact: true }) });
      assert.equal(await row.getByRole('cell').innerText(), (ROLE_PERMISSIONS[role] || []).includes(module.id) ? 'Included in role' : 'Not included in role');
    }
  };
  try {
    for (const width of [390, 1440]) {
      const { page, token } = await pageFor('super_admin', width);
      await page.goto(origin + '/users'); await entry(page, 'finance').waitFor();
      assert.equal(await page.getByText('Test Access', { exact: true }).count(), 0);
      assert.equal(await page.getByText('Simulate', { exact: true }).count(), 0);
      const initial = await page.evaluate(() => localStorage.getItem('gwcc-church-auth-token'));
      await open(page, 'finance'); await verifyRole(page, 'finance_officer');
      await dialog(page).getByText('The profile is active and its role has been reviewed.', { exact: true }).waitFor();
      assert.equal(await dialog(page).getByRole('button', { name: /Start|Sign in|Switch|Simulat/i }).count(), 0);
      assert.ok(await dialog(page).evaluate(node => node.scrollWidth <= node.clientWidth + 2));
      if (process.env.TEST_STAFF_ACCESS_ARTIFACT_DIR) await dialog(page).screenshot({ path: `${process.env.TEST_STAFF_ACCESS_ARTIFACT_DIR}/access-review-${width}.png` });
      await page.keyboard.press('Escape'); await dialog(page).waitFor({ state: 'hidden' });
      assert.equal(await entry(page, 'finance').getByRole('button', { name: /^Review access for / }).evaluate(node => node === document.activeElement), true);
      await open(page, 'pending'); await dialog(page).getByText('Administrator review is required before staff access is enabled.', { exact: true }).waitFor(); await dialog(page).getByRole('button', { name: 'Done', exact: true }).click();
      await open(page, 'suspended'); await dialog(page).getByText('This profile is suspended.', { exact: true }).waitFor(); await dialog(page).getByRole('button', { name: 'Done', exact: true }).click();
      await open(page, 'directory'); await dialog(page).getByText('Directory only: sign-in is disabled for this profile.', { exact: true }).waitFor(); await dialog(page).getByRole('button', { name: 'Done', exact: true }).click();
      await open(page, 'member'); await dialog(page).getByText('The member profile is active.', { exact: true }).waitFor(); await dialog(page).getByRole('button', { name: 'Done', exact: true }).click();
      await open(page, rootId); await verifyRole(page, 'super_admin'); await dialog(page).getByRole('button', { name: 'Done', exact: true }).click();
      await page.getByTitle('Table View', { exact: true }).click();
      await open(page, 'welfare'); await verifyRole(page, 'welfare_officer'); await dialog(page).getByRole('button', { name: 'Close access review', exact: true }).click();
      await entry(page, 'finance').getByTitle('View Staff Dossier', { exact: true }).click();
      const dossier = page.getByRole('dialog', { name: 'Staff dossier', exact: true }); await dossier.waitFor();
      await dossier.getByRole('button', { name: 'Review Access', exact: true }).click(); await dialog(page).waitFor(); await verifyRole(page, 'finance_officer'); await dialog(page).getByRole('button', { name: 'Done', exact: true }).click();
      const matrixButton = page.getByRole('button', { name: /Permissions Matrix/ }); await matrixButton.click();
      const matrix = page.getByRole('table', { name: 'Role application area permissions', exact: true });
      assert.equal(await matrix.getByRole('row').count(), ACCESS_MODULES.length + 1);
      for (const module of ACCESS_MODULES) await matrix.getByText(module.label, { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem('gwcc-church-auth-token')), initial, 'Review must retain the current identity and token.');
      assert.equal(JSON.parse(initial).access_token, token);
      await page.goto(origin + '/settings'); await page.getByText('Church Settings & Cloud Database Hub', { exact: true }).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
      await page.context().close();
    }
    // A matching pastor's name does not grant the review capability to an administrator.
    const { page: admin } = await pageFor('administrator', 390); await admin.goto(origin + '/users'); await entry(admin, 'finance').waitFor();
    assert.equal(await admin.getByRole('button', { name: /^Review access for / }).count(), 0);
    await entry(admin, 'finance').getByTitle('View Full Staff Dossier', { exact: true }).click();
    assert.equal(await admin.getByRole('dialog', { name: 'Staff dossier', exact: true }).getByRole('button', { name: 'Review Access', exact: true }).count(), 0);
    await admin.context().close();
    const { page: welfare } = await pageFor('welfare_officer', 390); await welfare.goto(origin + '/users');
    await welfare.getByText('Access Restricted', { exact: true }).waitFor(); assert.equal(await welfare.getByRole('button', { name: /^Review access for / }).count(), 0);
    assert.deepEqual({ staffWrites, mutationWrites, signIns, signOuts }, { staffWrites: 0, mutationWrites: 0, signIns: 0, signOuts: 0 });
    assert.deepEqual(errors, []);
    console.info('Staff access review checks passed: all role grants, all three entry points, protected/current profiles, pending/suspended/directory/member states, complete matrix, stable administrator identity/token, zero writes or sign-in requests, keyboard focus, restricted roles and mobile/desktop layout.');
  } finally { for (const context of contexts) await context.close(); }
}
