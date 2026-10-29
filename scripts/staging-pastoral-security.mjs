import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

// This runner touches only dedicated synthetic accounts in the isolated staging
// Supabase project. It never writes church records, changes roles or sends messages.
const STAGING_REF = 'gvnkviqnjyrsilorlofx';
const STAGING_SUPABASE_ORIGIN = 'https://' + STAGING_REF + '.supabase.co';
const STAGING_API_ORIGIN = 'https://g-app-git-feature-pastoral-ai-phase2-dickedem.vercel.app';
const REQUIRED_ROLES = ['super_admin', 'administrator', 'pastor', 'member'];
const EXCLUDED_ROLES = ['finance_officer', 'attendance_officer', 'data_entry', 'ministry_leader'];
const EXTRA_ROLES = ['disabled', 'unreviewed', 'mfa_incomplete'];
const ALLOWED_KEYS = ['asOf', 'generatedAt', 'myTasks', 'scope', 'status', 'visitors'];
const VISITOR_KEYS = ['awaitingFollowUp', 'closed', 'contacted', 'converted', 'other', 'returning', 'total'];
const TASK_KEYS = ['general', 'open', 'overdue', 'pastoral', 'visitor'];

function invariant(ok, label) {
  if (!ok) throw new Error(label);
}

function exactKeys(data, expected, label) {
  invariant(data !== null && typeof data === 'object' && !Array.isArray(data), label + ' must be an object');
  invariant(Object.keys(data).sort().join(',') === [...expected].sort().join(','), label + ' has unexpected fields');
}

export function assertStagingConfiguration(env) {
  const origin = new URL(env.GWCC_STAGING_API_ORIGIN || '');
  const supabase = new URL(env.GWCC_STAGING_SUPABASE_URL || '');
  invariant(origin.origin === STAGING_API_ORIGIN && origin.pathname === '/' && !origin.search && !origin.hash,
    'The API origin must be the protected GWCC Phase 2 staging preview, not production');
  invariant(supabase.origin === STAGING_SUPABASE_ORIGIN && supabase.pathname === '/' && !supabase.search && !supabase.hash,
    'The Supabase URL must be the dedicated GWCC Staging project, not production');
  const anonKey = env.GWCC_STAGING_ANON_KEY;
  invariant(typeof anonKey === 'string' && anonKey.length >= 10,
    'Set GWCC_STAGING_ANON_KEY to the staging public/anon API key');
  invariant(!/^(sb_secret_|sb_service_role_)/i.test(anonKey),
    'Only a public/anon key is permitted; do not provide a service role key');
  if (anonKey.split('.').length === 3) {
    const payload = JSON.parse(Buffer.from(anonKey.split('.')[1], 'base64url').toString('utf8'));
    invariant(payload.role === 'anon', 'The Supabase API key must have the anon role');
    invariant(payload.ref === undefined || payload.ref === STAGING_REF, 'The anon key project reference is not staging');
  }
  invariant(typeof env.GWCC_STAGING_VERCEL_BYPASS_SECRET === 'string' &&
    env.GWCC_STAGING_VERCEL_BYPASS_SECRET.length > 10,
    'The staging preview is protected; set GWCC_STAGING_VERCEL_BYPASS_SECRET');
  let users;
  try { users = JSON.parse(env.GWCC_STAGING_TEST_USERS || ''); }
  catch { throw new Error('Set GWCC_STAGING_TEST_USERS to the documented JSON of synthetic staging credentials'); }
  invariant(users && typeof users === 'object' && !Array.isArray(users), 'Test users must be a JSON object');
  const full = env.GWCC_STAGING_FULL_MATRIX === 'true';
  for (const role of [...REQUIRED_ROLES, ...(full ? [...EXCLUDED_ROLES, ...EXTRA_ROLES] : [])]) {
    const user = users[role];
    invariant(user && typeof user === 'object' && typeof user.email === 'string' &&
      user.email.includes('@') && typeof user.password === 'string' && user.password.length >= 12,
      'Missing dedicated synthetic staging credentials for ' + role);
  }
  for (const role of ['super_admin', 'administrator']) {
    invariant(typeof users[role].totpSecret === 'string' && users[role].totpSecret.length >= 16,
      'A dedicated synthetic TOTP secret is required for ' + role);
  }
  return {
    origin: STAGING_API_ORIGIN,
    supabaseUrl: STAGING_SUPABASE_ORIGIN,
    anonKey,
    bypass: env.GWCC_STAGING_VERCEL_BYPASS_SECRET,
    users,
    full,
  };
}

function decodeBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = value.toUpperCase().replace(/[\s=-]/g, '');
  invariant(clean.length >= 16 && /^[A-Z2-7]+$/.test(clean), 'Invalid staging-only TOTP secret format');
  const bytes = [];
  let carry = 0;
  let bits = 0;
  for (const char of clean) {
    carry = (carry << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((carry >>> bits) & 255);
      carry &= (1 << bits) - 1;
    }
  }
  return Buffer.from(bytes);
}

export function totp(secret, now = Date.now()) {
  const key = decodeBase32(secret);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30000)));
  const digest = createHmac('sha1', key).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
}

export function assertAggregateOnly(report) {
  exactKeys(report, ALLOWED_KEYS, 'Pastoral overview');
  exactKeys(report.visitors, VISITOR_KEYS, 'Visitor totals');
  exactKeys(report.myTasks, TASK_KEYS, 'Task totals');
  for (const [label, fields] of [['visitors', VISITOR_KEYS], ['myTasks', TASK_KEYS]]) {
    for (const field of fields) {
      const value = report[label][field];
      invariant(Number.isSafeInteger(value) && value >= 0, label + ' count is invalid');
    }
  }
  invariant(report.visitors.awaitingFollowUp <= report.visitors.total, 'Follow-up totals exceed visitors');
  invariant(report.myTasks.overdue <= report.myTasks.open, 'Overdue tasks exceed open tasks');
  invariant(report.status === 'recorded', 'Invalid overview status');
  invariant(typeof report.asOf === 'string' && /^\d{4}-\d\d-\d\d$/.test(report.asOf), 'Invalid overview date');
  invariant(typeof report.generatedAt === 'string' && Number.isFinite(Date.parse(report.generatedAt)),
    'Invalid overview generation date');
  invariant(report.scope === 'Your authorized visitor totals and tasks assigned to you. No personal details are included.',
    'Unrecognized overview data scope');
  return true;
}

function jwtClaims(token) {
  const parts = (token || '').split('.');
  invariant(parts.length === 3, 'Missing or malformed staging session token');
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
}

function newClient(config) {
  return createClient(config.supabaseUrl, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function signIn(client, user, label) {
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email, password: user.password,
  });
  invariant(!error && data?.session?.access_token && data?.user?.id,
    label + ': dedicated staging account could not sign in; no API authorization result is recorded');
  return { token: data.session.access_token, id: data.user.id };
}

async function securityStatus(client) {
  const { data, error } = await client.rpc('gwcc_security_status');
  invariant(!error && data && typeof data.satisfied === 'boolean',
    'Could not verify the real staging security status RPC');
  return data;
}

async function completeMfa(client, totpSecret, label) {
  const { data, error } = await client.auth.mfa.listFactors();
  invariant(!error && Array.isArray(data?.totp), label + ': MFA factor listing unavailable');
  const factor = data.totp.find(item => item.status === 'verified');
  invariant(factor?.id, label + ': dedicated staging account has no verified TOTP factor');
  const { data: verified, error: verifyError } = await client.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: totp(totpSecret),
  });
  invariant(!verifyError && verified?.access_token, label + ': TOTP verification failed');
  const session = await client.auth.getSession();
  invariant(session.data?.session?.access_token &&
    jwtClaims(session.data.session.access_token).aal === 'aal2',
    label + ': AAL2 staging session could not be established');
  return session.data.session.access_token;
}

async function apiCall(config, token, method = 'POST', body = '{}') {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'x-vercel-protection-bypass': config.bypass,
  };
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await fetch(config.origin + '/api/ai/pastoral-overview', {
    method,
    headers,
    body: method === 'POST' ? body : undefined,
    cache: 'no-store',
    redirect: 'manual',
    signal: AbortSignal.timeout(25000),
  });
  // Redirects and HTML generally indicate a Vercel protection error or wrong preview.
  invariant(![301, 302, 303, 307, 308].includes(response.status),
    'The request was redirected; confirm preview protection bypass and deployment URL');
  const type = response.headers.get('content-type') || '';
  invariant(type.includes('application/json'),
    'The preview did not return JSON; check deployment protection and function routing');
  let json;
  try { json = await response.json(); }
  catch { throw new Error('The staging API returned malformed JSON'); }
  return { status: response.status, json, headers: response.headers };
}

function expectStatus(result, expected, label) {
  invariant(result.status === expected,
    label + ': expected HTTP ' + expected + ' but received ' + result.status);
}

async function assertAssignedTaskScope(client, tokenOwner, overview, label, admin) {
  const { data, error } = await client.rpc('gwcc_follow_up_list');
  invariant(!error && Array.isArray(data), label + ': follow-up RPC did not return a list');
  const assigned = data.filter(task => task?.assigned_to_id === tokenOwner &&
    ['open', 'in_progress'].includes(task.status));
  invariant(overview.myTasks.open === assigned.length,
    label + ': overview includes tasks not assigned to this account');
  const overdue = assigned.filter(task => /^\d{4}-\d\d-\d\d$/.test(task.due_date || '') &&
    task.due_date < overview.asOf).length;
  invariant(overview.myTasks.overdue === overdue, label + ': overdue totals do not match owned tasks');
  if (admin) {
    invariant(data.every(task => task?.kind !== 'pastoral'),
      'Administrator received confidential pastoral tasks from the real follow-up RPC');
    invariant(overview.myTasks.pastoral === 0,
      'Administrator overview exposed a confidential pastoral task count');
  }
}

async function assertNoDirectPastoralRead(client, label) {
  const { data, error } = await client.from('gwcc_documents')
    .select('id').eq('namespace', 'follow_up_tasks').limit(1);
  // No permission (42501) and empty RLS results are both safe outcomes.
  invariant(Boolean(error) || (Array.isArray(data) && data.length === 0),
    label + ': direct SELECT exposed confidential follow-up documents');
}

async function testAuthorized(config, role) {
  const user = config.users[role];
  const client = newClient(config);
  const initial = await signIn(client, user, role);
  const before = await securityStatus(client);
  invariant(before.role === role, role + ': staged Auth role is incorrect');
  let token = initial.token;
  if (['super_admin', 'administrator'].includes(role)) {
    invariant(before.required === true, role + ': MFA is not required');
    invariant(jwtClaims(token).aal !== 'aal2', role + ': expected a fresh AAL1 password session');
    expectStatus(await apiCall(config, token), 403, role + ' without MFA');
    token = await completeMfa(client, user.totpSecret, role);
  } else if (before.required && !before.satisfied) {
    invariant(typeof user.totpSecret === 'string',
      role + ': existing MFA factor requires a staging-only TOTP secret');
    token = await completeMfa(client, user.totpSecret, role);
  }
  const verified = await securityStatus(client);
  invariant(verified.role === role && verified.satisfied === true,
    role + ': the staging security state is not satisfied');
  const response = await apiCall(config, token);
  expectStatus(response, 200, role + ' overview');
  assertAggregateOnly(response.json);
  invariant((response.headers.get('cache-control') || '').includes('no-store'),
    role + ': confidential API response is cacheable');
  await assertAssignedTaskScope(client, initial.id, response.json, role, role === 'administrator');
  if (role === 'administrator') await assertNoDirectPastoralRead(client, role);
}

async function testDenied(config, role) {
  const client = newClient(config);
  const user = config.users[role];
  const session = await signIn(client, user, role);
  const state = await securityStatus(client);
  if (EXCLUDED_ROLES.includes(role) || role === 'member') {
    invariant(state.role === role, role + ': staging user was assigned the wrong role');
  }
  if (role === 'mfa_incomplete') {
    invariant(state.required === true && state.satisfied === false,
      'MFA-incomplete fixture does not exercise the missing-MFA condition');
  }
  if (role === 'disabled' || role === 'unreviewed') {
    invariant(state.role === 'disabled' && state.satisfied === false,
      role + ': fixture is not actually blocked by authorization review');
  }
  expectStatus(await apiCall(config, session.token), 403, role + ' denied');
  if (role === 'member') await assertNoDirectPastoralRead(client, role);
}

async function run() {
  const config = assertStagingConfiguration(process.env);
  let passed = 0;
  let failed = 0;
  async function check(label, fn) {
    try {
      await fn();
      console.log('PASS ' + label);
      passed++;
    } catch (error) {
      // Never print raw HTTP response bodies, tokens, emails, credentials or TOTP codes.
      console.error('FAIL ' + label + ': ' +
        (error instanceof Error ? error.message.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]') : 'Check failed'));
      failed++;
    }
  }
  await check('No session gives HTTP 401', async () =>
    expectStatus(await apiCall(config, null), 401, 'Anonymous request'));
  await check('Invalid session gives HTTP 401', async () =>
    expectStatus(await apiCall(config, 'not.a.valid.token'), 401, 'Invalid bearer'));
  await check('Unsupported GET gives HTTP 405', async () =>
    expectStatus(await apiCall(config, null, 'GET'), 405, 'GET request'));
  await check('Caller-selected report parameters give HTTP 400', async () =>
    expectStatus(await apiCall(config, null, 'POST', '{"table":"members"}'), 400, 'Parameterized request'));

  for (const role of ['super_admin', 'pastor', 'administrator'])
    await check(role + ' authorized overview and task ownership', () => testAuthorized(config, role));
  await check('Member denied overview and private task documents', () => testDenied(config, 'member'));
  for (const role of [...EXCLUDED_ROLES, ...EXTRA_ROLES]) {
    if (config.users[role]) {
      await check(role + ' denied access', () => testDenied(config, role));
    } else {
      console.log('NOT RUN ' + role + ': dedicated staging fixture is not configured');
    }
  }
  console.log('GWCC isolated staging API checks: ' + passed + ' passed; ' +
    failed + ' failed. Full negative matrix: ' + (config.full ? 'required' : 'optional') + '.');
  invariant(failed === 0, 'The staging security acceptance test failed');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(error => {
    // Configuration failures are intentionally concise and never print secrets.
    console.error('STAGING SECURITY CHECK FAILED: ' +
      (error instanceof Error ? error.message : 'Check failed'));
    process.exitCode = 1;
  });
}
