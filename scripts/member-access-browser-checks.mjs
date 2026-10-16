import assert from 'node:assert/strict';

export async function checkPublicMemberLogin(page, context, { origin }) {
  let resetRequests = 0;
  await context.route('https://gwcc-e2e.supabase.co/auth/v1/recover**', async route => {
    assert.equal(route.request().postDataJSON().email, 'member@example.test'); resetRequests++;
    await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: '{}' });
  });
  await page.goto(`${origin}/portal`);
  assert.equal(await page.getByLabel('Email address', { exact: false }).getAttribute('type'), 'email');
  assert.equal(await page.getByLabel(/^Password/).getAttribute('autocomplete'), 'current-password');
  assert.equal(await page.getByText('Member ID, Phone, or Email', { exact: false }).count(), 0);
  assert.equal(await page.getByText('Default: Phone last 4 digits', { exact: false }).count(), 0);
  await page.getByRole('button', { name: 'Forgot password?', exact: true }).click();
  assert.equal(await page.getByLabel(/^Password/).count(), 0);
  await page.getByLabel('Email address', { exact: false }).fill('member@example.test');
  await page.getByRole('button', { name: 'Send password reset link', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'If this account exists' }).waitFor();
  assert.equal(resetRequests, 1);
  await page.getByRole('button', { name: 'Back to member sign-in', exact: true }).click();
  await page.getByRole('button', { name: 'Sign In to Member Portal', exact: true }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'Mobile member sign-in overflows.');
}

export async function checkMemberAccess(page, { origin, data, profile }) {
  const accountId = '44444444-4444-4444-8444-444444444444';
  const status = new Map(); const sent = [], linked = [];
  const access = (member, state, email, account = null, message = '') => ({ state, email, account, message, member: { id: member.id, name: `${member.first_name} ${member.last_name}`, member_id: member.member_id } });
  await page.context().route(`${origin}/api/staff`, async route => {
    const req = route.request(), body = req.postDataJSON();
    assert.match(req.headers().authorization, /^Bearer /);
    const member = data.members.find(m => m.id === body.member_id);
    assert.ok(member, 'Member account request must use a real directory record.');
    let result = status.get(member.id);
    if (body.action === 'member_access') {
      if (body.email === 'staff@example.test') result = access(member, 'blocked', body.email, null, 'This email belongs to a staff account. Use a separate member email.');
      else if (!result && body.email === 'existing@example.test') result = access(member, 'existing', body.email, { id: accountId, email: body.email, name: 'Existing Member', verified: true }, 'Confirm this exact account before linking.');
      else if (!result) result = access(member, 'unlinked', body.email || '', null, 'An invitation is needed.');
    } else if (body.action === 'invite_member') {
      if (body.email === 'failed@example.test') { await route.fulfill({ status: 400, json: { error: 'The email service could not send this invitation.' } }); return; }
      sent.push(body); member.auth_user_id = accountId;
      result = access(member, 'pending', body.email, { id: accountId, email: body.email, name: 'QA Member', verified: false }, 'The member must accept their invitation and set a password.'); status.set(member.id, result);
    } else if (body.action === 'link_member') {
      assert.equal(body.auth_user_id, accountId); linked.push(body); member.auth_user_id = accountId;
      result = access(member, 'ready', body.email, { id: accountId, email: body.email, name: 'Existing Member', verified: true }, 'Account linked and email verified.'); status.set(member.id, result);
    } else throw new Error(`Unexpected member operation: ${body.action}`);
    await route.fulfill({ status: 200, json: { access: result, ...(body.action !== 'member_access' ? { message: 'Account linked successfully.' } : {}) } });
  });
  const open = async id => {
    await page.goto(`${origin}/members/${id}`);
    await page.getByRole('button', { name: 'Portal Access', exact: true }).click();
    return page.getByRole('dialog', { name: 'Member Portal Access', exact: true });
  };
  let modal = await open('qa-member');
  await modal.getByLabel('Member’s login email', { exact: true }).fill('invite@example.test');
  await modal.getByRole('button', { name: 'Check account status', exact: true }).click();
  await modal.getByText('No linked login', { exact: true }).waitFor();
  assert.equal(sent.length, 0); assert.equal(linked.length, 0);
  const send = modal.getByRole('button', { name: 'Send invitation and link account', exact: true });
  assert.equal(await send.isEnabled(), false);
  await modal.getByRole('checkbox').check(); await send.click();
  await modal.getByText('Invitation pending', { exact: true }).waitFor();
  assert.equal(sent.length, 1); assert.equal(sent[0].email, 'invite@example.test');
  await modal.getByRole('button', { name: 'Close portal access', exact: true }).click();

  modal = await open('qa-current');
  await modal.getByLabel('Member’s login email', { exact: true }).fill('existing@example.test');
  await modal.getByRole('button', { name: 'Check account status', exact: true }).click();
  await modal.getByText('Existing account found', { exact: true }).waitFor();
  await modal.getByRole('checkbox').check();
  await modal.getByRole('button', { name: 'Link existing member account', exact: true }).click();
  await modal.getByText('Ready to sign in', { exact: true }).waitFor();
  assert.equal(linked.length, 1); assert.equal(sent.length, 1);
  await modal.getByRole('button', { name: 'Close portal access', exact: true }).click();

  modal = await open('qa-new');
  await modal.getByLabel('Member’s login email', { exact: true }).fill('staff@example.test');
  await modal.getByRole('button', { name: 'Check account status', exact: true }).click();
  await modal.getByText('Administrator review required', { exact: true }).waitFor();
  assert.equal(await modal.getByRole('checkbox').count(), 0);
  await modal.getByLabel('Member’s login email', { exact: true }).fill('failed@example.test');
  await modal.getByRole('button', { name: 'Check account status', exact: true }).click();
  await modal.getByRole('checkbox').check();
  await modal.getByRole('button', { name: 'Send invitation and link account', exact: true }).click();
  await modal.getByRole('alert').filter({ hasText: 'could not send' }).waitFor();
  assert.equal(await modal.getByText('Invitation pending', { exact: true }).count(), 0);
  assert.equal(data.members.find(m => m.id === 'qa-new').auth_user_id, null);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (process.env.MEMBER_SCREENSHOT_DIR) await modal.screenshot({ path: `${process.env.MEMBER_SCREENSHOT_DIR}/member-portal-access-mobile.png` });
  const overflow = await page.evaluate(() => ({width:document.documentElement.scrollWidth,viewport:innerWidth,elements:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+2).slice(-12).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent?.slice(0,70),right:e.getBoundingClientRect().right}))}));
  assert.ok(overflow.width <= overflow.viewport + 2, `Mobile portal access modal overflows: ${JSON.stringify(overflow)}`);
  await modal.getByRole('button', { name: 'Close portal access', exact: true }).click();
  const role = profile.role; profile.role = 'data_entry';
  await page.reload(); await page.locator('main').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Portal Access', exact: true }).count(), 0);
  profile.role = role; await page.setViewportSize({ width: 1440, height: 1000 }); await page.reload();
  await page.context().unroute(`${origin}/api/staff`);
}

export async function checkMemberPasswordSetup(browser, { origin, settings, sampleMember }) {
  const id = '55555555-5555-4555-8555-555555555555';
  const user = { id, email: 'setup@example.test', email_confirmed_at: '2026-10-16T00:00:00Z', role: 'authenticated', aud: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: {} };
  const profile = { id, role: 'member', email: user.email, first_name: 'Setup', last_name: 'Member', is_active: true, has_login_account: true };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', exp })).toString('base64url')}.test-signature`;
  const session = { user, access_token: token, refresh_token: 'test-member-refresh', expires_at: exp, expires_in: 3600, token_type: 'bearer' };
  const own = { ...sampleMember, id: 'setup-member', member_id: 'GWCC-SETUP', first_name: 'Setup', last_name: 'Member', auth_user_id: id };
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const errors = []; let passwordUpdates = 0;
  await context.addInitScript(({ session }) => {
    localStorage.setItem('gwcc_supabase_url', 'https://gwcc-e2e.supabase.co'); localStorage.setItem('gwcc_supabase_anon_key', 'test-public-key'); localStorage.setItem('gwcc-church-auth-token', JSON.stringify(session));
  }, { session });
  await context.route('https://gwcc-e2e.supabase.co/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
    let result = [];
    if (url.pathname === '/auth/v1/user') {
      if (request.method() === 'PUT') { assert.equal(request.postDataJSON().password.length >= 12, true); passwordUpdates++; }
      result = user;
    } else if (url.pathname === '/auth/v1/token') result = session;
    else if (url.pathname === '/rest/v1/profiles') result = request.headers().accept?.includes('vnd.pgrst.object') ? profile : [profile];
    else if (url.pathname === '/rest/v1/members') result = request.headers().accept?.includes('vnd.pgrst.object') ? own : [own];
    else if (url.pathname === '/rest/v1/settings') result = [{ id: 'gwcc_global_settings', ...settings }];
    await route.fulfill({ status: 200, headers, body: JSON.stringify(result) });
  });
  try {
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/auth/password`);
    await page.getByLabel('New password', { exact: true }).fill('a-long-member-password');
    await page.getByLabel('Confirm password', { exact: true }).fill('a-long-member-password');
    await page.getByRole('button', { name: 'Save password', exact: true }).click();
    const next = page.getByRole('link', { name: 'Continue to Member Portal', exact: true }); await next.waitFor();
    assert.equal(await next.getAttribute('href'), '/portal'); assert.equal(passwordUpdates, 1);
    await next.click(); await page.getByRole('button', { name: /Sign Out|Log Out|Logout/i }).first().waitFor();
    assert.equal(await page.getByText('QA Current', { exact: true }).count(), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'Mobile authenticated member portal overflows.');
    if (process.env.MEMBER_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.MEMBER_SCREENSHOT_DIR}/member-portal-signed-in-mobile.png`, fullPage: true });
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
}
