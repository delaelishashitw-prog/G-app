import test from 'node:test';
import assert from 'node:assert/strict';
import { attendancePersonType, uniquePresentAttendance, attendanceSessionError, attendanceCsv, buildAttendanceSessions, membersNotCheckedIn, matchesAttendeeSearch } from '../features/attendance/attendanceInsights.ts';
import { recordAttendance, batchRecordAttendance, recordHeadcount, updateHeadcount } from '../features/attendance/attendanceStore.ts';
import { getChurchDateString, getQuickDate, isValidDateString, formatServiceDayString } from './attendanceDateUtils.ts';
import { validateService, upcomingService, serviceScheduleLabel } from '../features/services/serviceSchedule.ts';

const date = '2026-01-04';
const service = { id: 'service', name: 'Sunday Service', is_active: true, type: 'sunday', day_of_week: 'Sunday', start_time: '08:00', end_time: '10:30' };
const member = { id: 'member', first_name: 'Ama', last_name: 'Mensah', member_id: 'GWCC-1001', phone: '024 123 4567', status: 'active', membership_date: '2020-01-01' };
const visitor = { id: 'visitor', full_name: 'Visitor One', phone: '0241234567' };
const record = (id, changes = {}) => ({ id, service_id: service.id, service_name: service.name, date, member_id: member.id, status: 'present', ...changes });
const tally = { service_id: service.id, service_name: service.name, date, men: 2, women: 3, youth: 4, children: 5, visitors: 1, ushers_protocol: 2, online_viewers: 7, total_auditorium: 999 };
const state = initial => {
  let rows = initial, writes = [], logs = [];
  return { get rows() { return rows; }, writes, logs,
    set(update) { if (typeof update === 'function') { update(rows); rows = update(rows); } else rows = update; },
    sync(table, row) { writes.push({ table, row }); }, log(...args) { logs.push(args); } };
};

test('attendance uses identity IDs, excludes absent/excused rows and counts duplicate people once', () => {
  const rows = [record('one'), record('duplicate'), record('absent', { member_id: 'other', status: 'absent' }),
    record('excused', { member_id: 'excused', status: 'excused' }),
    record('visitor', { member_id: undefined, visitor_id: member.id, person_type: 'member' })];
  assert.equal(attendancePersonType(rows[4]), 'visitor');
  assert.equal(attendancePersonType({ member_id: 'one', visitor_id: 'two' }), null);
  assert.equal(uniquePresentAttendance(rows).length, 2);
});

test('single check-ins validate service/date/person, correctly classify visitors and promote an existing excused row', () => {
  const s = state([record('excused', { status: 'excused' })]);
  const check = (serviceId, type, id, targetDate = date) => recordAttendance(serviceId, type, id, [member], [visitor], s.rows, s.set, [service], s.log, s.sync, 'search', targetDate);
  assert.equal(check('missing', 'member', member.id).success, false);
  assert.equal(check(service.id, 'member', 'missing').success, false);
  assert.equal(check(service.id, 'member', member.id, '2026-02-30').success, false);
  assert.equal(check(service.id, 'member', member.id, '2999-01-01').success, false);
  assert.equal(s.writes.length, 0);
  assert.equal(check(service.id, 'member', member.id).success, true);
  assert.equal(s.rows.length, 1);
  assert.equal(s.rows[0].id, 'excused');
  assert.equal(s.rows[0].status, 'present');
  assert.equal(check(service.id, 'member', member.id).success, false);
  assert.equal(check(service.id, 'visitor', visitor.id).success, true);
  assert.equal(s.rows[0].person_type, 'visitor');
  assert.equal(s.rows[0].member_id, undefined);
  assert.equal(s.logs.length, 2);
});

test('batch check-in deduplicates input, preserves existing rows, and rejects invalid batches before writing', () => {
  const s = state([record('member', { status: 'absent' })]);
  const batch = items => batchRecordAttendance(service.id, date, items, [service], [member], [visitor], s.rows, s.set, s.log, s.sync);
  assert.throws(() => batch([{ personType: 'member', personId: member.id }, { personType: 'visitor', personId: 'missing' }]), /existing/);
  assert.equal(s.writes.length, 0);
  const result = batch([{ personType: 'member', personId: member.id }, { personType: 'member', personId: member.id }, { personType: 'visitor', personId: visitor.id }]);
  assert.deepEqual(result, { added: 2, skipped: 1 });
  assert.equal(s.rows.length, 2);
  assert.equal(s.rows.find(row => row.member_id)?.id, 'member');
  assert.equal(s.rows.find(row => row.visitor_id)?.person_type, 'visitor');
  assert.equal(s.writes.length, 2);
  assert.equal(s.logs.length, 1);
});

test('headcounts reject negatives, fractions and nonfinite values and compute the official total', () => {
  const s = state([]);
  for (const men of [-1, 0.5, NaN, Infinity, 1000001]) assert.throws(() => recordHeadcount({ ...tally, men }, s.rows, s.set, s.log, s.sync), /whole numbers/);
  assert.equal(s.writes.length, 0);
  const saved = recordHeadcount(tally, s.rows, s.set, s.log, s.sync);
  assert.equal(saved.total_auditorium, 17);
  const next = recordHeadcount({ ...tally, women: 4 }, s.rows, s.set, s.log, s.sync);
  assert.equal(next.id, saved.id);
  assert.equal(next.total_auditorium, 18);
  updateHeadcount(saved.id, { men: 4 }, s.set, s.log, s.sync, s.rows);
  assert.equal(s.rows[0].total_auditorium, 20);
  assert.equal(s.writes.length, 3, 'React updater replay must not duplicate persistence');
});

test('service sessions include attendance-only dates, deduplicate check-ins and preserve zero headcounts', () => {
  const evening = { ...service, id: 'evening', name: 'Evening Service' };
  const sessions = buildAttendanceSessions([service, evening], [record('one'), record('duplicate'), record('evening', { service_id: evening.id })], [{ ...tally, id: 'head', total_auditorium: 0 }]);
  assert.equal(sessions.length, 2);
  assert.equal(sessions.find(row => row.service_id === service.id).checkins, 1);
  assert.equal(sessions.find(row => row.service_id === service.id).headcount.total_auditorium, 0);
  assert.equal(sessions.find(row => row.service_id === evening.id).checkins, 1);
  assert.equal(sessions.find(row => row.service_id === evening.id).headcount, undefined);
});

test('follow-up excludes members who joined later and does not count excused rows as present', () => {
  const people = [member, { ...member, id: 'excused' }, { ...member, id: 'later', membership_date: '2026-02-01' }, { ...member, id: 'archived', is_archived: true }];
  assert.deepEqual(membersNotCheckedIn(people, [record('one'), record('excused', { member_id: 'excused', status: 'excused' })], date).map(person => person.id), ['excused']);
});

test('attendance exports escape CSV content and neutralize spreadsheet formulas without misclassifying visitors', () => {
  const csv = attendanceCsv([record('csv', { service_name: 'A, "B"', person_name: '  =HYPERLINK("bad")', member_id: undefined, visitor_id: 'visitor', person_type: 'member' })]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"A, ""B"""'));
  assert.ok(csv.includes('"\'  =HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('"visitor"'));
});

test('church date presets use GMT and invalid/future dates cannot create attendance', () => {
  const reference = new Date('2026-10-16T00:15:00Z');
  assert.equal(getChurchDateString(reference), '2026-10-16');
  assert.equal(getQuickDate('today', reference), '2026-10-16');
  assert.equal(getQuickDate('lastSunday', reference), '2026-10-11');
  assert.equal(getQuickDate('lastWednesday', reference), '2026-10-14');
  assert.equal(isValidDateString('2026-02-30'), false);
  assert.equal(isValidDateString('2024-02-29'), true);
  assert.equal(formatServiceDayString(''), 'Choose a valid service date');
  assert.match(attendanceSessionError(service, '2026-10-17', reference), /future/);
});

test('historical service references have no invented schedule and require a schedule before activation', () => {
  const archived = { ...service, is_active: false, day_of_week: '', start_time: '', end_time: '' };
  assert.equal(validateService(archived), null);
  assert.match(validateService({ ...archived, is_active: true }), /day/);
  assert.equal(upcomingService([archived]), null);
  assert.match(serviceScheduleLabel(archived), /original schedule unavailable/);
  assert.match(attendanceSessionError(archived, date), /archived/);
});

test('attendance searches support full names and formatted phone numbers', () => {
  assert.equal(matchesAttendeeSearch(member, 'ama mensah'), true);
  assert.equal(matchesAttendeeSearch(member, '024123'), true);
  assert.equal(matchesAttendeeSearch(member, 'gwcc-1001'), true);
  assert.equal(matchesAttendeeSearch(member, 'someone else'), false);
});
