import assert from 'node:assert/strict';
import { watchSyncStatus, waitForSync } from './sync-browser-utils.mjs';

export async function checkAttendancePasses(browser, { origin, settings, sampleMember }) {
  const date = new Date().toISOString().slice(0, 10);
  const own = { ...sampleMember, id: 'qr-fixture-one', member_id: 'GWCC-QR-0001', first_name: 'QR', last_name: 'Fixture', profile_photo_url: '', is_archived: false, status: 'active' };
  const tables = { members: [own, { ...own, id: 'qr-other', member_id: 'GWCC-QR-0002', first_name: 'Other' }, { ...own, id: 'qr-archived', member_id: 'GWCC-QR-ARCHIVED', is_archived: true }],
    services: [{ id: 'qr-service-a', name: 'QR First Service', type: 'sunday', day_of_week: 'Sunday', start_time: '08:00', end_time: '10:30', is_active: true }, { id: 'qr-service-b', name: 'QR Second Service', type: 'prayer', day_of_week: 'Friday', start_time: '18:30', end_time: '20:00', is_active: true }], attendance: [], settings: [{ id: 'gwcc_global_settings', ...settings }] };
  const contexts = [], errors = [], writes = [];
  let externalQrRequests = 0;
  const createPage = async (role, width) => {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, timezoneId: 'Pacific/Auckland' }); contexts.push(context);
    const id = role === 'member' ? '77777777-7777-4777-8777-777777777777' : '88888888-8888-4888-8888-888888888888';
    const user = { id, email: `${role}@example.test`, aud: 'authenticated', role: 'authenticated', email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email' }, user_metadata: {} };
    const profile = { id, first_name: 'QR', last_name: 'Staff', email: user.email, role, is_active: true, has_login_account: true, authorization_reviewed_at: new Date().toISOString() };
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', exp })).toString('base64url')}.synthetic`;
    const session = { user, access_token: token, refresh_token: 'synthetic-only', expires_at: exp, expires_in: 3600, token_type: 'bearer' };
    await context.addInitScript(watchSyncStatus);
    await context.addInitScript(({ session }) => {
      localStorage.setItem('gwcc_supabase_url', 'https://gwcc-e2e.supabase.co'); localStorage.setItem('gwcc_supabase_anon_key', 'test-public-key'); localStorage.setItem('gwcc-church-auth-token', JSON.stringify(session));
      window.__qrCameraRequests = 0; window.__qrStreams = []; window.__qrCameraMode = 'normal'; window.__qrCameraImage = null;
      // Exercise the bundled decoder, including browsers without BarcodeDetector.
      delete window.BarcodeDetector;
      const makeStream = async () => {
        const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
        const ctx = canvas.getContext('2d'); let image = null;
        if (window.__qrCameraImage) { image = new Image(); image.src = window.__qrCameraImage; await image.decode(); }
        const draw = () => { ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 512, 512); if (image) { ctx.imageSmoothingEnabled = false; ctx.drawImage(image, 128, 128, 256, 256); } };
        draw(); const stream = canvas.captureStream(10); window.__qrStreams.push(stream);
        const timer = setInterval(() => { if (stream.getTracks().every(track => track.readyState === 'ended')) clearInterval(timer); else draw(); }, 100);
        return stream;
      };
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => {
        window.__qrCameraRequests++;
        if (window.__qrCameraMode === 'deny') throw new DOMException('Synthetic permission denial', 'NotAllowedError');
        if (window.__qrCameraMode === 'pending') return new Promise(resolve => { window.__releaseQrCamera = async () => resolve(await makeStream()); });
        return makeStream();
      } });
      window.print = () => { window.__qrPrints = (window.__qrPrints || 0) + 1; };
    }, { session });
    context.on('request', request => { if (new URL(request.url()).hostname === 'api.qrserver.com') externalQrRequests++; });
    await context.route('https://gwcc-e2e.supabase.co/**', async route => {
      const request = route.request(), url = new URL(request.url());
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
      if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
      let result = [];
      if (url.pathname === '/auth/v1/user') result = user;
      else if (url.pathname === '/auth/v1/token') result = session;
      else if (url.pathname === '/rest/v1/rpc/gwcc_security_status') result = { role, required: role !== 'member', verified_factors: role === 'member' ? 0 : 1, satisfied: true };
      else if (url.pathname === '/rest/v1/rpc/gwcc_apply_mutations') {
        assert.equal(role, 'attendance_officer');
        const body = request.postDataJSON(); writes.push(body);
        result = body.p_changes.filter(change => change.table !== 'audit_logs').map(change => {
          assert.equal(change.table, 'attendance'); assert.equal(change.operation, 'upsert');
          const record = { ...change.record, updated_at: new Date().toISOString() };
          assert.ok(!tables.attendance.some(row => row.id !== record.id && row.member_id === record.member_id && row.service_id === record.service_id && row.date === record.date), 'Duplicate attendance intent reached the cloud.');
          tables.attendance = [...tables.attendance.filter(row => row.id !== record.id), record];
          return { table: 'attendance', record };
        });
      } else if (url.pathname.startsWith('/rest/v1/') && !url.pathname.includes('/rpc/')) {
        const table = url.pathname.split('/').at(-1);
        const rows = table === 'profiles' ? [profile] : table === 'members' && role === 'member' ? [{ ...own, auth_user_id: id }] : tables[table] || [];
        const range = request.headers().range?.split('-').map(Number), offset = Number(url.searchParams.get('offset') || range?.[0] || 0), limit = Number(url.searchParams.get('limit') || 500);
        result = request.headers().accept?.includes('vnd.pgrst.object') ? rows[0] || null : rows.slice(offset, offset + limit);
      }
      await route.fulfill({ status: 200, headers, body: JSON.stringify(result) });
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message)); return page;
  };
  const staffScreen = page => page.getByRole('dialog', { name: 'Staff check-in screen', exact: true });
  const candidate = page => staffScreen(page).getByRole('region', { name: 'Scanned member', exact: true });
  const find = async (page, value) => { await staffScreen(page).getByLabel('Member pass or Member ID', { exact: true }).fill(value); await staffScreen(page).getByRole('button', { name: 'Find pass', exact: true }).click(); };
  const upload = (page, buffer, name = 'pass.png', mimeType = 'image/png') => staffScreen(page).getByLabel('Choose QR image', { exact: true }).setInputFiles({ name, mimeType, buffer });
  const confirm = async page => {
    const response = page.waitForResponse(response => response.url().endsWith('/rpc/gwcc_apply_mutations') && response.request().postDataJSON().p_changes.some(change => change.table === 'attendance'));
    await candidate(page).getByRole('button', { name: 'Confirm check-in', exact: true }).evaluate(button => { button.click(); button.click(); });
    await response; await waitForSync(page);
  };
  try {
    for (const width of [390, 1440]) {
      tables.attendance = []; writes.length = 0;
      const portal = await createPage('member', width);
      await portal.goto(origin + '/portal?tab=attendance');
      const portalQr = portal.getByRole('img', { name: 'Attendance QR code for GWCC-QR-0001', exact: true }); await portalQr.waitFor();
      const portalImage = await portalQr.screenshot();
      assert.equal(await portal.evaluate(() => window.__qrCameraRequests), 0);
      const staff = await createPage('attendance_officer', width);
      await staff.goto(`${origin}/attendance?serviceId=qr-service-a&date=${date}`);
      await staff.getByLabel('Find attendance member', { exact: true }).fill('GWCC-QR-0001');
      await staff.getByTitle('Show Member QR Digital Pass', { exact: true }).click();
      const pass = staff.getByRole('dialog', { name: 'Member digital attendance pass', exact: true });
      const printedQr = pass.getByRole('img', { name: 'Attendance QR code for GWCC-QR-0001', exact: true });
      await printedQr.waitFor(); assert.equal(await pass.getByText('Verified', { exact: true }).count(), 0);
      await pass.getByRole('button', { name: 'Print Pass', exact: true }).click(); assert.equal(await staff.evaluate(() => window.__qrPrints), 1);
      await staff.emulateMedia({ media: 'print' });
      assert.equal(await staff.locator('#root').isVisible(), false); assert.equal(await printedQr.isVisible(), true);
      const printedImage = await printedQr.screenshot();
      await staff.emulateMedia({ media: 'screen' });
      if (process.env.TEST_QR_ARTIFACT_DIR) await pass.screenshot({ path: `${process.env.TEST_QR_ARTIFACT_DIR}/member-pass-${width}.png` });
      await pass.getByRole('button', { name: 'Close member pass', exact: true }).click();
      assert.equal(await staff.evaluate(() => document.body.classList.contains('attendance-pass-print-open')), false);
      await staff.getByRole('button', { name: 'Open Check-In Screen', exact: true }).click();
      assert.equal(await staff.evaluate(() => window.__qrCameraRequests), 0);
      assert.ok(await staffScreen(staff).evaluate(node => node.scrollWidth <= node.clientWidth + 2), 'The staff check-in screen must fit the viewport.');
      // Decode the actual member SVG screenshot with the independent bundled scanner.
      await upload(staff, portalImage); await candidate(staff).getByText('QR Fixture', { exact: true }).waitFor();
      if (process.env.TEST_QR_ARTIFACT_DIR) await staffScreen(staff).screenshot({ path: `${process.env.TEST_QR_ARTIFACT_DIR}/qr-checkin-${width}.png` });
      assert.equal(writes.length, 0, 'Reading a pass must not record attendance.');
      await confirm(staff);
      assert.equal(tables.attendance.length, 1); assert.equal(tables.attendance[0].member_id, own.id);
      assert.equal(tables.attendance[0].check_in_method, 'qr_code'); assert.equal(tables.attendance[0].date, date);
      await upload(staff, printedImage); await candidate(staff).getByText('Already checked in for this service date.', { exact: true }).waitFor();
      assert.equal(tables.attendance.length, 1); assert.equal(await candidate(staff).getByRole('button', { name: 'Confirm check-in', exact: true }).count(), 0);
      await find(staff, 'GWCC-QR-ARCHIVED'); await staffScreen(staff).getByRole('alert').filter({ hasText: 'member pass is unavailable' }).waitFor();
      assert.equal(await candidate(staff).count(), 0);
      for (const value of ['GWCC-QR', 'GWCC:CHILD:pickup-code', 'https://example.test/QR']) {
        await find(staff, value); await staffScreen(staff).getByRole('alert').waitFor(); assert.equal(await candidate(staff).count(), 0);
      }
      await find(staff, own.member_id); await candidate(staff).waitFor();
      await upload(staff, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'unsupported.svg', 'image/svg+xml');
      await staffScreen(staff).getByRole('alert').filter({ hasText: 'Choose a PNG, JPEG or WebP' }).waitFor(); assert.equal(await candidate(staff).count(), 0, 'A failed new read must clear the earlier member.');
      // Permission denial leaves manual lookup available and never keeps an old selection.
      await find(staff, own.member_id); await candidate(staff).waitFor();
      await staff.evaluate(() => { window.__qrCameraMode = 'deny'; });
      await staffScreen(staff).getByRole('button', { name: 'Scan with camera', exact: true }).click();
      await staffScreen(staff).getByRole('alert').filter({ hasText: 'Camera unavailable or permission denied' }).waitFor(); assert.equal(await candidate(staff).count(), 0);
      await find(staff, own.member_id); await candidate(staff).waitFor();
      await staffScreen(staff).getByRole('button', { name: 'Return to attendance', exact: true }).click();
      await staff.goto(`${origin}/attendance?serviceId=qr-service-b&date=${date}`); await staff.getByRole('button', { name: 'Open Check-In Screen', exact: true }).click();
      await staff.evaluate(image => { window.__qrCameraMode = 'normal'; window.__qrCameraImage = image; }, `data:image/png;base64,${portalImage.toString('base64')}`);
      await staffScreen(staff).getByRole('button', { name: 'Scan with camera', exact: true }).click();
      await candidate(staff).getByText('QR Fixture', { exact: true }).waitFor();
      await staff.waitForFunction(() => window.__qrStreams.length && window.__qrStreams.every(stream => stream.getTracks().every(track => track.readyState === 'ended')));
      assert.equal(tables.attendance.length, 1, 'A camera read requires staff confirmation.');
      await confirm(staff); assert.equal(tables.attendance.length, 2); assert.equal(tables.attendance[1].service_id, 'qr-service-b');
      // Closing an active scanner and closing while permission is pending release all tracks.
      await staff.evaluate(() => { window.__qrCameraImage = null; });
      await staffScreen(staff).getByRole('button', { name: 'Scan with camera', exact: true }).click();
      await staff.waitForFunction(() => window.__qrStreams.some(stream => stream.getTracks().some(track => track.readyState === 'live')));
      await staffScreen(staff).getByRole('button', { name: 'Return to attendance', exact: true }).click();
      await staff.waitForFunction(() => window.__qrStreams.every(stream => stream.getTracks().every(track => track.readyState === 'ended')));
      await staff.getByRole('button', { name: 'Open Check-In Screen', exact: true }).click();
      await staff.evaluate(() => { window.__qrCameraMode = 'pending'; });
      await staffScreen(staff).getByRole('button', { name: 'Scan with camera', exact: true }).click();
      await staff.waitForFunction(() => typeof window.__releaseQrCamera === 'function');
      await staffScreen(staff).getByRole('button', { name: 'Return to attendance', exact: true }).click();
      await staff.evaluate(() => window.__releaseQrCamera());
      await staff.waitForFunction(() => window.__qrStreams.every(stream => stream.getTracks().every(track => track.readyState === 'ended')));
      assert.equal(tables.attendance.length, 2);
      assert.ok(await staff.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
      await staff.context().close(); await portal.context().close();
    }
    const finance = await createPage('finance_officer', 390); await finance.goto(origin + '/attendance');
    await finance.getByText('Access Restricted', { exact: true }).waitFor(); assert.equal(await finance.getByRole('button', { name: 'Scan with camera', exact: true }).count(), 0);
    assert.equal(externalQrRequests, 0); assert.deepEqual(errors, []);
    console.info('Attendance pass browser checks passed: actual portal and printed QR decoding, local generation, explicit staff confirmation, duplicate-click prevention, exact/legacy lookup, invalid and archived rejection, service/date isolation, camera video decoding, denied and pending permission cleanup, print isolation, member/finance restrictions and mobile/desktop layout. All records and camera streams were synthetic.');
  } finally { for (const context of contexts) await context.close(); }
}
