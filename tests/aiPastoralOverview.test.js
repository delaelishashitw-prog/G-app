import test from 'node:test';
import assert from 'node:assert/strict';
import { pastoralOverviewHandler, summarizeVisitors, summarizeAssignedTasks } from '../server/aiPastoralOverview.js';

function harness({ role = 'pastor', body = {}, visitorRows = [], tasks = [], visitorError = null, taskError = null, recheckProfile = null } = {}) {
  let queriedVisitors = 0, queriedTasks = 0, checks = 0;
  const client = {
    from(name) {
      assert.equal(name, 'visitors');
      queriedVisitors++;
      return {
        select(projection) {
          assert.equal(projection, 'id,follow_up_status');
          return { order() { return { range() { return Promise.resolve({ data: visitorRows, count: visitorRows.length, error: visitorError }); } }; } };
        },
      };
    },
    rpc(name) {
      assert.equal(name, 'gwcc_follow_up_list');
      queriedTasks++;
      return Promise.resolve({ data: tasks, error: taskError });
    },
  };
  const authorization = async (_req, options) => {
    checks++;
    assert.deepEqual([...options.roles], ['super_admin','senior_pastor','administrator','pastor']);
    return { client, profile: checks > 1 && recheckProfile ? recheckProfile : { role, id: 'user-1' } };
  };
  const result = { status: 0, data: null, headers: {} };
  const res = {
    setHeader(key, value) { result.headers[key] = value; },
    status(code) { result.status = code; return this; },
    json(data) { result.data = data; return this; },
  };
  return {
    run: async () => { await pastoralOverviewHandler({ method: 'POST', body }, res, { authorizeRequest: authorization }); return { ...result, queriedVisitors, queriedTasks, checks }; },
  };
}

test('summaries never include names, phones or free-text task descriptions', async () => {
  const report = await harness({
    visitorRows: [
      { id: 'v1', follow_up_status: 'new', phone: 'hidden', notes: 'private' },
      { id: 'v2', follow_up_status: 'contacted', full_name: 'private' },
      { id: 'v3', follow_up_status: 'follow_up_required', prayer_request: 'private' },
    ],
    tasks: [
      { id: 't1', assigned_to_id: 'user-1', kind: 'visitor', status: 'open', due_date: '2020-01-01', description: 'private' },
      { id: 't2', assigned_to_id: 'someone-else', kind: 'pastoral', status: 'open', due_date: '2020-01-01', description: 'private' },
    ],
  }).run();
  assert.equal(report.status, 200);
  assert.equal(report.data.visitors.total, 3);
  assert.equal(report.data.visitors.awaitingFollowUp, 2);
  assert.equal(report.data.myTasks.open, 1);
  assert.equal(report.data.myTasks.overdue, 1);
  assert.equal(report.checks, 2);
  assert.doesNotMatch(JSON.stringify(report.data), /hidden|private|full_name|phone|description|prayer_request/);
  assert.equal(report.data.status, 'recorded');
});

test('refuses all caller-selected parameters', async () => {
  const result = await harness({ body: { table: 'giving', includePrivateNotes: true } }).run();
  assert.equal(result.status, 400);
  assert.equal(result.queriedVisitors, 0);
});

test('denies staff outside the overview capability even when auth stub grants a session', async () => {
  const result = await harness({ role: 'finance_officer' }).run();
  assert.equal(result.status, 403);
  assert.equal(result.queriedVisitors, 0);
  assert.equal(result.queriedTasks, 0);
});

test('fails closed instead of inventing task totals', async () => {
  const result = await harness({ taskError: { code: '42501' } }).run();
  assert.equal(result.status, 503);
  assert.equal(result.queriedTasks, 1);
});

test('aggregate helpers ignore tasks assigned to other people', () => {
  assert.deepEqual(summarizeVisitors([]), { total: 0, awaitingFollowUp: 0, contacted: 0, returning: 0, converted: 0, closed: 0, other: 0 });
  assert.deepEqual(summarizeAssignedTasks([
    { assigned_to_id: 'someone-else', kind: 'pastoral', status: 'open', due_date: '2020-01-01' },
  ], 'user-1', '2026-10-27'), { open: 0, overdue: 0, visitor: 0, pastoral: 0, general: 0 });
});

test('overview permits each approved pastoral role with an authorized session', async () => {
  for (const role of ['super_admin', 'senior_pastor', 'administrator', 'pastor']) {
    const result = await harness({ role }).run();
    assert.equal(result.status, 200, role);
    assert.equal(result.checks, 2, role);
    assert.deepEqual(result.data.visitors, {
      total: 0, awaitingFollowUp: 0, contacted: 0,
      returning: 0, converted: 0, closed: 0, other: 0,
    }, role);
  }
});

test('overview denies every excluded role before querying visitors or tasks', async () => {
  for (const role of ['finance_officer', 'attendance_officer', 'data_entry', 'ministry_leader', 'member']) {
    const result = await harness({ role }).run();
    assert.equal(result.status, 403, role);
    assert.equal(result.queriedVisitors, 0, role);
    assert.equal(result.queriedTasks, 0, role);
    assert.equal(result.checks, 1, role);
  }
});

test('assigned task summary counts only the current assignee and open states', () => {
  const tasks = [
    { assigned_to_id: 'user-1', kind: 'visitor', status: 'open', due_date: '2026-10-26' },
    { assigned_to_id: 'user-1', kind: 'general', status: 'in_progress', due_date: '2026-11-01' },
    { assigned_to_id: 'user-1', kind: 'pastoral', status: 'completed', due_date: '2020-01-01' },
    { assigned_to_id: 'other-user', kind: 'pastoral', status: 'open', due_date: '2020-01-01' },
    { assigned_to_id: 'user-1', kind: 'pastoral', status: 'cancelled', due_date: '2020-01-01' },
  ];
  assert.deepEqual(summarizeAssignedTasks(tasks, 'user-1', '2026-10-28'), {
    open: 2, overdue: 1, visitor: 1, pastoral: 0, general: 1,
  });
});

test('malformed task responses fail closed without a usable report', async () => {
  for (const tasks of [null, {}, 'not a list', [null]]) {
    const result = await harness({ tasks }).run();
    assert.equal(result.status, 503);
    assert.equal(result.data.status, undefined);
  }
});

test('visitor database failures prevent any follow-up query and report', async () => {
  const result = await harness({ visitorError: { code: '42501' } }).run();
  assert.equal(result.status, 503);
  assert.equal(result.queriedVisitors, 1);
  assert.equal(result.queriedTasks, 0);
});


test('overview denies a switched identity on the final authorization check', async () => {
  const result = await harness({
    role: 'pastor',
    visitorRows: [{ id: 'v1', follow_up_status: 'new' }],
    recheckProfile: { role: 'administrator', id: 'different-user' },
  }).run();
  assert.equal(result.status, 403);
  assert.equal(result.checks, 2);
  assert.equal(result.data.visitors, undefined);
  assert.equal(result.data.myTasks, undefined);
});

test('overview denies role changes even when the user ID remains the same', async () => {
  const result = await harness({
    role: 'pastor',
    visitorRows: [{ id: 'v1', follow_up_status: 'new' }],
    recheckProfile: { role: 'administrator', id: 'user-1' },
  }).run();
  assert.equal(result.status, 403);
  assert.equal(result.checks, 2);
  assert.equal(result.data.visitors, undefined);
  assert.equal(result.data.myTasks, undefined);
});

test('overview denies an account that becomes unavailable at the final security check', async () => {
  const result = await harness({
    role: 'administrator',
    recheckProfile: { role: 'administrator', id: null },
  }).run();
  assert.equal(result.status, 403);
  assert.equal(result.checks, 2);
  assert.equal(result.data.visitors, undefined);
});
