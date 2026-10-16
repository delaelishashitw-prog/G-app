import { HttpError } from './security.js';

const memberFields = 'id,member_id,first_name,last_name,email,status,is_archived,auth_user_id';
const profileFields = 'id,email,first_name,last_name,role,is_active,has_login_account,member_id';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanEmail(value, required = true) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if ((!email && required) || (email && (!emailPattern.test(email) || email.length > 254))) {
    throw new HttpError(400, 'Enter a valid email address belonging to this member.');
  }
  return email;
}

async function readMember(client, id) {
  if (typeof id !== 'string' || !id.trim() || id.length > 200) throw new HttpError(400, 'Choose a member record.');
  const { data, error } = await client.from('members').select(memberFields).eq('id', id).single();
  if (error || !data) throw new HttpError(404, 'Member record not found. Refresh the directory and try again.');
  return data;
}

async function readAccount(admin, profile) {
  if (!profile || !uuidPattern.test(profile.id)) return null;
  const { data, error } = await admin.auth.admin.getUserById(profile.id);
  if (error && error.status !== 404) throw new HttpError(503, 'Account status could not be checked. Try again.');
  const user = data?.user;
  if (!user || !user.email) return null;
  return {
    id: user.id, email: user.email.trim().toLowerCase(),
    name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
    verified: Boolean(user.email_confirmed_at), role: profile.role,
    enabled: profile.is_active === true && profile.has_login_account === true && !(Date.parse(user.banned_until || '') > Date.now()),
    member_id: profile.member_id || null,
  };
}

export async function memberAccessStatus(client, admin, member, requestedEmail) {
  const base = { member: { id: member.id, name: `${member.first_name} ${member.last_name}`, member_id: member.member_id }, account: null };
  if (member.is_archived || ['deceased', 'transferred'].includes(member.status)) {
    return { ...base, state: 'blocked', email: '', message: 'Restore and review this member record before enabling portal access.' };
  }
  let profile, email;
  if (member.auth_user_id) {
    const result = await client.from('profiles').select(profileFields).eq('id', member.auth_user_id).maybeSingle();
    if (result.error) throw new HttpError(503, 'Account status could not be checked. Try again.');
    profile = result.data;
  } else {
    email = cleanEmail(requestedEmail, false);
    if (!email) return { ...base, state: 'unlinked', email: '', message: 'Enter the member’s own email address to check for an existing account.' };
    // Escape LIKE wildcards; an email containing '_' or '%' must match literally.
    const result = await client.from('profiles').select(profileFields).ilike('email', email.replace(/[\\%_]/g, '\\$&')).eq('has_login_account', true).maybeSingle();
    if (result.error) throw new HttpError(503, 'Account status could not be checked. Try again.');
    profile = result.data;
    if (!profile) return { ...base, state: 'unlinked', email, message: 'No login is linked. An invitation will let this member verify their email and choose a password.' };
  }
  const account = await readAccount(admin, profile);
  const blocked = message => ({ ...base, state: 'blocked', email: account?.email || email || '', account, message });
  if (!account) return blocked('The authentication account needs administrator review. No invitation or link was changed.');
  if (account.role !== 'member') return blocked('This email belongs to a staff account. Use a separate member email; staff access will not be changed.');
  if (!account.enabled) return blocked('This login is suspended or disabled. Review it in Users & Roles before linking it.');
  if (!member.auth_user_id && account.email !== email) return blocked('The account email has changed. Refresh and review the exact account.');
  if (account.member_id && account.member_id !== member.id) return blocked('This account is already assigned to another member.');
  const { data: other, error } = await client.from('members').select('id').eq('auth_user_id', account.id).neq('id', member.id).maybeSingle();
  if (error) throw new HttpError(503, 'Member linking could not be checked. Try again.');
  if (other) return blocked('This account is already linked to another member. Each member needs a separate login.');
  return {
    ...base, account, email: account.email,
    state: member.auth_user_id ? (account.verified ? 'ready' : 'pending') : 'existing',
    message: member.auth_user_id
      ? (account.verified ? 'Account linked and email verified. The member can sign in with their email and password.' : 'Account linked. The member must accept their invitation and set a password.')
      : 'An existing member account uses this email. Confirm the identity below before linking it; no email will be sent.',
  };
}

function invitationError(error) {
  if (/not.*authoriz|smtp|email.*send|sending.*email/i.test(error?.message || '') || error?.code === 'email_address_not_authorized') {
    return new HttpError(400, 'The email service could not send this invitation. Check the church’s email sender configuration in Supabase and try again.');
  }
  return new HttpError(400, error?.message || 'The invitation could not be sent. No member link was changed.');
}

export async function handleMemberAccess({ action, body, client, admin, appOrigin }) {
  const member = await readMember(client, body.member_id);
  const email = cleanEmail(body.email, action !== 'member_access');
  const access = await memberAccessStatus(client, admin, member, email);
  if (action === 'member_access') return { access };
  if (access.state === 'blocked') throw new HttpError(409, access.message);
  // Every mutation repeats preflight on the server; a browser cannot substitute an account or role.
  if (!email || access.email !== email) throw new HttpError(409, 'The email or account changed. Check the member account again before continuing.');
  if (action === 'link_member') {
    if (access.state !== 'existing' || access.account?.id !== body.auth_user_id) throw new HttpError(409, 'Check and confirm the existing member account before linking it.');
  } else if (action === 'invite_member') {
    if (access.state !== 'unlinked') throw new HttpError(409, 'This member or email already has an account. Check its status and link the existing account instead.');
  } else if (action === 'resend_member_invite') {
    if (access.state !== 'pending') throw new HttpError(409, 'Only a linked account awaiting email verification can receive a new invitation.');
  } else throw new HttpError(400, 'Unknown member account operation.');

  let accountId = access.account?.id;
  if (action !== 'link_member') {
    let origin;
    try { origin = new URL(appOrigin); } catch { throw new HttpError(503, 'The application email redirect is not configured.'); }
    if (origin.origin !== appOrigin || !['https:', 'http:'].includes(origin.protocol)) throw new HttpError(503, 'The application email redirect is not configured.');
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin.origin}/auth/password`,
      data: { first_name: member.first_name, last_name: member.last_name },
    });
    if (error || !data?.user) throw invitationError(error);
    if (data.user.email?.trim().toLowerCase() !== email || (accountId && data.user.id !== accountId)) {
      throw new HttpError(409, 'The invitation account changed. Review the exact authentication account before linking it.');
    }
    accountId = data.user.id;
  }
  const { error: linkError } = await client.rpc('gwcc_link_member_login', {
    p_member_id: member.id, p_auth_user_id: accountId, p_expected_email: email,
  });
  if (linkError) {
    const prefix = action === 'link_member' ? 'Account was not linked.' : 'Invitation requested, but the member link needs review.';
    throw new HttpError(409, `${prefix} ${linkError.message} Check account status before retrying.`);
  }
  const updated = { ...member, auth_user_id: accountId };
  return {
    access: await memberAccessStatus(client, admin, updated, email),
    message: action === 'link_member' ? 'Existing member account linked. No email was sent.' : 'Invitation requested and account linked. Ask the member to check their inbox and spam folder.',
  };
}
