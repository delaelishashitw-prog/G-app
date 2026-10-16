import test from 'node:test';
import assert from 'node:assert/strict';
import { handleMemberAccess } from '../server/memberAccess.js';
import { staffHandler } from '../server/staff.js';
import { HttpError } from '../server/security.js';

const uid = '22222222-2222-4222-8222-222222222222';
const staffId = '33333333-3333-4333-8333-333333333333';
function fixture() {
  const tables = { members: [{ id: 'person', member_id: 'GWCC-123', first_name: 'Test', last_name: 'Member', email: 'person@example.test', is_archived: false, status: 'active', auth_user_id: null }], profiles: [] };
  const users = new Map(), invitations = [], links = [];
  const client = {
    from(table) {
      let rows = tables[table] || [];
      const query = {
        select() { return this; }, eq(key,value) { rows = rows.filter(row => row[key] === value); return this; },
        neq(key,value) { rows = rows.filter(row => row[key] !== value); return this; },
        ilike(key,value) { const literal = value.replace(/\\([\\%_])/g, '$1').toLowerCase(); rows = rows.filter(row => row[key]?.toLowerCase() === literal); return this; },
        single: async () => ({ data: rows[0] || null }), maybeSingle: async () => ({ data: rows[0] || null }),
      };
      return query;
    },
    async rpc(name,args) {
      links.push({ name, args });
      if (client.linkError) return { error: { message: client.linkError } };
      tables.members.find(row => row.id === args.p_member_id).auth_user_id = args.p_auth_user_id;
      tables.profiles.find(row => row.id === args.p_auth_user_id).member_id = args.p_member_id;
      return { data: {} };
    },
  };
  const addAccount = (overrides = {}, auth = {}) => {
    const profile = { id: uid, email: 'person@example.test', first_name: 'Test', last_name: 'Member', role: 'member', is_active: true, has_login_account: true, ...overrides };
    tables.profiles.push(profile); users.set(profile.id, { id: profile.id, email: profile.email, email_confirmed_at: null, ...auth }); return profile;
  };
  const admin = { auth: { admin: {
    getUserById: async id => users.has(id) ? { data: { user: users.get(id) } } : { error: { status: 404 } },
    inviteUserByEmail: async (email, options) => {
      invitations.push({ email, options });
      if (admin.inviteError) return { error: admin.inviteError };
      let profile = tables.profiles.find(row => row.email === email);
      if (!profile) profile = addAccount({ email });
      return { data: { user: users.get(profile.id) } };
    },
  } } };
  const call = (action, body = {}) => handleMemberAccess({ action, body: { member_id: 'person', email: 'person@example.test', ...body }, client, admin, appOrigin: 'https://app.example.test' });
  return { tables, users, invitations, links, client, admin, addAccount, call };
}

test('member account preflight sends no email; invitation links the exact Auth UUID and uses a fixed password redirect', async () => {
  const f = fixture();
  assert.equal((await f.call('member_access')).access.state, 'unlinked');
  assert.equal(f.invitations.length, 0); assert.equal(f.links.length, 0);
  const result = await f.call('invite_member', { email: '  PERSON@example.test  ', role: 'super_admin' });
  assert.equal(result.access.state, 'pending'); assert.equal(f.tables.members[0].auth_user_id, uid);
  assert.equal(f.invitations[0].email, 'person@example.test');
  assert.equal(f.invitations[0].options.redirectTo, 'https://app.example.test/auth/password');
  assert.deepEqual(Object.keys(f.invitations[0].options.data).sort(), ['first_name','last_name']);
  assert.deepEqual(f.links[0], { name: 'gwcc_link_member_login', args: { p_member_id: 'person', p_auth_user_id: uid, p_expected_email: 'person@example.test' } });
  await assert.rejects(f.call('invite_member'), /already has an account/); assert.equal(f.invitations.length, 1);
});

test('existing verified member accounts are reviewed and linked without sending an invitation or changing their role', async () => {
  const f = fixture(); f.addAccount({}, { email_confirmed_at: '2026-10-01' });
  assert.equal((await f.call('member_access')).access.state, 'existing');
  await assert.rejects(f.call('link_member', { auth_user_id: staffId }), /confirm/);
  await assert.rejects(f.call('invite_member'), /already has an account/);
  const result = await f.call('link_member', { auth_user_id: uid });
  assert.equal(result.access.state, 'ready'); assert.equal(f.invitations.length, 0);
  assert.equal(f.tables.profiles[0].role, 'member');
  assert.equal(f.tables.profiles[0].member_id, 'person');
  await assert.rejects(f.call('resend_member_invite'), /awaiting email verification/);
});

test('staff, suspended, banned, archived and already assigned accounts cannot be linked or invited again', async () => {
  for (const kind of ['staff','disabled','banned','archived','profile-linked','member-linked','missing-auth','changed-email']) {
    const f = fixture(); const p = f.addAccount();
    if (kind === 'staff') p.role = 'super_admin';
    if (kind === 'disabled') p.is_active = false;
    if (kind === 'banned') f.users.get(uid).banned_until = '2999-01-01';
    if (kind === 'archived') f.tables.members[0].is_archived = true;
    if (kind === 'profile-linked') p.member_id = 'other';
    if (kind === 'member-linked') f.tables.members.push({ id: 'other', auth_user_id: uid });
    if (kind === 'missing-auth') f.users.clear();
    if (kind === 'changed-email') f.users.get(uid).email = 'changed@example.test';
    assert.equal((await f.call('member_access')).access.state, 'blocked', kind);
    await assert.rejects(f.call('link_member', { auth_user_id: uid }), error => error.status === 409, kind);
    await assert.rejects(f.call('invite_member'), error => error.status === 409, kind);
    assert.equal(f.invitations.length, 0, kind); assert.equal(f.links.length, 0, kind);
  }
});

test('literal email checks escape LIKE wildcards and invalid emails or missing members cause no invitation', async () => {
  const f = fixture(); f.addAccount({ email: 'a_other@example.test' });
  assert.equal((await f.call('member_access', { email: 'a_other@example.test' })).access.state, 'existing');
  assert.equal((await f.call('member_access', { email: 'a%other@example.test' })).access.state, 'unlinked');
  await assert.rejects(f.call('invite_member', { email: '0241234567' }), /valid email/);
  await assert.rejects(f.call('invite_member', { member_id: 'missing' }), /not found/);
  assert.equal(f.invitations.length, 0);
});

test('pending invitation retries preserve the exact linked identity; delivery and partial link failures are reported honestly', async () => {
  const f = fixture(); f.addAccount(); f.tables.members[0].auth_user_id = uid;
  const result = await f.call('resend_member_invite');
  assert.equal(result.access.state, 'pending'); assert.equal(f.invitations.length, 1);
  const bad = fixture(); bad.admin.inviteError = { code: 'email_address_not_authorized', message: 'Email address not authorized' };
  await assert.rejects(bad.call('invite_member'), /email sender configuration/); assert.equal(bad.links.length, 0);
  const partial = fixture(); partial.client.linkError = 'This member already has a different login';
  await assert.rejects(partial.call('invite_member'), /Invitation requested, but the member link needs review/);
  assert.equal(partial.tables.members[0].auth_user_id, null);
  assert.equal((await partial.call('member_access')).access.state, 'existing');
});

test('the staff endpoint restricts member account operations to root and redirects generic member creation to the linked flow', async () => {
  process.env.SUPABASE_URL = 'https://server-test.supabase.co'; process.env.SUPABASE_ANON_KEY = 'test-public-key';
  const previous = process.env.SUPABASE_SERVICE_ROLE_KEY; process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only-test-key';
  const response = () => ({ code: 0, body: null, setHeader(){}, status(code){this.code=code;return this;}, json(body){this.body=body;} });
  try {
    const res = response();
    await staffHandler({ method: 'POST', body: { action: 'invite_member', member_id: 'person', email: 'person@example.test' } }, res, {
      authorizeRequest: async (_req, options) => { assert.deepEqual(options.roles, ['super_admin']); throw new HttpError(403, 'Not authorized'); },
    });
    assert.equal(res.code, 403);
    const generic = response(); let writes = 0;
    await staffHandler({ method: 'POST', body: { action: 'create', role: 'member', first_name: 'Test', last_name: 'Person' } }, generic, {
      authorizeRequest: async () => ({ client: {}, profile: { role: 'super_admin' } }), createClient: () => { writes++; return {}; },
    });
    assert.equal(generic.code, 400); assert.match(generic.body.error, /Portal Access/); assert.equal(writes, 1);
  } finally { if (previous === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previous; }
});
