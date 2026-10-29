import { authorizeRequest, HttpError, requirePost, sendError } from './security.js';

// The first agent tools are aggregate-only. No names, phone numbers, private notes,
// attendance identities, financial records, or arbitrary model-selected tables.
export const PASTORAL_OVERVIEW_ROLES = Object.freeze([
  'super_admin', 'senior_pastor', 'administrator', 'pastor',
]);
const PAGE_SIZE = 500;
const MAX_VISITORS = 5000;
const FOLLOW_UP_STATUSES = new Set(['new', 'follow_up_required']);

export function summarizeVisitors(rows) {
  const result = { total: 0, awaitingFollowUp: 0, contacted: 0, returning: 0, converted: 0, closed: 0, other: 0 };
  for (const row of rows) {
    result.total++;
    const status = row?.follow_up_status;
    if (FOLLOW_UP_STATUSES.has(status)) result.awaitingFollowUp++;
    else if (status === 'contacted') result.contacted++;
    else if (status === 'returning_visitor') result.returning++;
    else if (status === 'converted_to_member') result.converted++;
    else if (status === 'closed') result.closed++;
    else result.other++;
  }
  return result;
}

export async function readVisitorSummary(client) {
  const rows = [];
  let expected;
  for (let offset = 0; offset < MAX_VISITORS; offset += PAGE_SIZE) {
    // Stable ordering, restrictive projection, and RLS through the caller's JWT.
    const { data, count, error } = await client.from('visitors')
      .select('id,follow_up_status', { count: 'exact' })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error || !Array.isArray(data) || !Number.isInteger(count) || count < 0) {
      throw new HttpError(503, 'Visitor summary could not be loaded securely.');
    }
    if (count > MAX_VISITORS) throw new HttpError(422, 'Visitor summary exceeds the safe reporting limit.');
    if (expected !== undefined && expected !== count) throw new HttpError(409, 'Visitor records changed while loading. Refresh the summary.');
    expected = count;
    rows.push(...data);
    if (rows.length > count) throw new HttpError(409, 'Visitor records changed while loading. Refresh the summary.');
    if (rows.length === count || data.length < PAGE_SIZE) break;
  }
  if (rows.length !== expected || new Set(rows.map(row => row?.id)).size !== rows.length || rows.some(row => !row?.id)) {
    throw new HttpError(503, 'Visitor summary could not be verified. Refresh and try again.');
  }
  return summarizeVisitors(rows);
}

export function summarizeAssignedTasks(rows, userId, today) {
  if (!Array.isArray(rows)) throw new HttpError(503, 'Follow-up tasks could not be verified.');
  const result = { open: 0, overdue: 0, visitor: 0, pastoral: 0, general: 0 };
  for (const task of rows) {
    if (!task || typeof task !== 'object') throw new HttpError(503, 'Follow-up tasks could not be verified.');
    if (task.assigned_to_id !== userId || !['open', 'in_progress'].includes(task.status)) continue;
    result.open++;
    if (typeof task.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(task.due_date) && task.due_date < today) result.overdue++;
    if (Object.hasOwn(result, task.kind)) result[task.kind]++;
  }
  return result;
}

export async function readAssignedTaskSummary(client, userId, today) {
  const { data, error } = await client.rpc('gwcc_follow_up_list');
  if (error) throw new HttpError(503, 'Follow-up tasks could not be loaded securely.');
  if (!Array.isArray(data) || data.length > MAX_VISITORS) throw new HttpError(503, 'Follow-up tasks could not be verified.');
  return summarizeAssignedTasks(data, userId, today);
}

export async function pastoralOverviewHandler(req, res, dependencies = {}) {
  if (!requirePost(req, res)) return;
  try {
    // Do not permit caller-selected filters, SQL, instructions or tool names.
    const body = req.body ?? {};
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length) {
      throw new HttpError(400, 'This report does not accept parameters.');
    }
    const authorize = dependencies.authorizeRequest || authorizeRequest;
    const access = await authorize(req, { roles: PASTORAL_OVERVIEW_ROLES, bucket: 'ai' });
    if (!PASTORAL_OVERVIEW_ROLES.includes(access.profile?.role) || !access.profile?.id) {
      throw new HttpError(403, 'Your role cannot access the pastoral overview.');
    }
    const today = new Date().toISOString().slice(0, 10); // Africa/Accra is UTC.
    const visitors = await readVisitorSummary(access.client);
    const myTasks = await readAssignedTaskSummary(access.client, access.profile.id, today);
    // Recheck revocation and MFA status after external I/O, without charging again.
    const refreshed = await authorize(req, { roles: PASTORAL_OVERVIEW_ROLES, bucket: null });
    if (refreshed.profile?.id !== access.profile.id || refreshed.profile?.role !== access.profile.role) {
      throw new HttpError(403, 'Your account permissions changed. Refresh the page.');
    }
    res.status(200).json({
      visitors, myTasks, asOf: today, generatedAt: new Date().toISOString(),
      scope: 'Your authorized visitor totals and tasks assigned to you. No personal details are included.',
      status: 'recorded',
    });
  } catch (error) { sendError(res, error); }
}
