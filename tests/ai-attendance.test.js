import test from 'node:test';
import assert from 'node:assert/strict';
import { attendanceInsightsHandler, buildAttendanceSummary, validateAttendancePeriod } from '../server/aiAttendance.js';
import serverlessHandler from '../api/ai/attendance-insights.js';

const period = { startDate: '2026-10-01', endDate: '2026-10-21' };
function response() { return { code: 0, headers: {}, body: null, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }
function queryClient(rows, { error = null, count = rows.length } = {}) {
  return { from(table) {
    assert.equal(table, 'attendance');
    const query = {
      select(columns) { assert.equal(columns, 'service_id,service_name,date,status,member_id,visitor_id'); return this; },
      gte() { return this; }, lte() { return this; }, order() { return this; },
      async range(from, to) { return { data: error ? null : rows.slice(from, to + 1), error, count }; },
    };
    return query;
  } };
}
function req(body = period) { return { method: 'POST', body, headers: {} }; }

test('Vercel attendance handler exports the same secured entry point', () => {
  assert.equal(serverlessHandler, attendanceInsightsHandler);
});
test('rejects malformed dates, reversed ranges, extra input and periods over 31 days', () => {
  assert.throws(() => validateAttendancePeriod({ ...period, unrestricted: true }), e => e.status === 400);
  for (const dates of [
    { startDate: '2026-02-30', endDate: '2026-03-01' },
    { startDate: '2026-10-21', endDate: '2026-10-01' },
    { startDate: '2026-08-01', endDate: '2026-10-01' },
    { startDate: '2026-10-01', endDate: '2099-01-01' },
  ]) assert.throws(() => validateAttendancePeriod(dates), e => e.status === 400);
});
test('counts unique present entries by service and date without sending personally identifying data', () => {
  const row = (id, status = 'present') => ({ service_id: 'sun', service_name: 'Sunday Service', date: '2026-10-18', member_id: id, visitor_id: null, status });
  const rows = [row('alice'), row('alice'), row('bob', 'absent'), { ...row(null), member_id: null, visitor_id: 'v1' }, { ...row(null), member_id: null, visitor_id: null }];
  const output = buildAttendanceSummary(rows, period);
  assert.equal(output.totalCheckins, 2);
  assert.equal(output.memberCheckins, 1);
  assert.equal(output.visitorCheckins, 1);
  assert.equal(output.excludedRecords, 3);
  assert.equal(output.byService[0].checkins, 2);
  assert.equal(output.byDay[0].checkins, 2);
  assert.equal(JSON.stringify(output).includes('alice'), false);
  assert.equal(JSON.stringify(output).includes('v1'), false);
});
test('denies access if no verified staff authorisation and allows attendance officer for bounded aggregate query', async () => {
  const record = { service_id: 'wed', service_name: 'Wednesday Encounter', date: '2026-10-21', member_id: 'private-123', visitor_id: null, status: 'present' };
  const deny = response();
  await attendanceInsightsHandler(req(), deny, { authorizeRequest: async () => { throw Object.assign(new Error('Sign-in is required.'), { status: 401 }); } });
  assert.equal(deny.code, 500); // plain Error is not an HttpError; security errors are HttpError in production
  const res = response();
  await attendanceInsightsHandler(req(), res, { authorizeRequest: async () => ({ profile: { role: 'attendance_officer' }, client: queryClient([record]) }) });
  assert.equal(res.code, 200);
  assert.equal(res.body.totalCheckins, 1);
  assert.equal(JSON.stringify(res.body).includes('private-123'), false);
  const forbidden = response();
  await attendanceInsightsHandler(req(), forbidden, { authorizeRequest: async () => ({ profile: { role: 'member' }, client: queryClient([record]) }) });
  assert.equal(forbidden.code, 403);
});
test('fails closed rather than presenting incomplete results on database error or oversized dataset', async () => {
  const failing = response();
  await attendanceInsightsHandler(req(), failing, { authorizeRequest: async () => ({ profile: { role: 'pastor' }, client: queryClient([], { error: { message: 'denied' } }) }) });
  assert.equal(failing.code, 503);
  const large = response();
  await attendanceInsightsHandler(req(), large, { authorizeRequest: async () => ({ profile: { role: 'pastor' }, client: queryClient([], { count: 6000 }) }) });
  assert.equal(large.code, 422);
});
