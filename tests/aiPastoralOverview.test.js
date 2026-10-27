import test from 'node:test';
import assert from 'node:assert/strict';
import { pastoralOverviewHandler, summarizeVisitors, summarizeAssignedTasks } from '../server/aiPastoralOverview.js';

function harness({ role = 'pastor', body = {}, visitorRows = [], tasks = [], visitorError = null, taskError = null } = {}) {
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
    return { client, profile: { role, id: 'user-1' } };
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
