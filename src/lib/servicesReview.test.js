import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServiceInsights, countCheckins, resolveServiceId, resolveRosterMember } from '../features/services/serviceInsights.ts';
import { serviceOccurrence, upcomingService, validateService, programDurationSeconds } from '../features/services/serviceSchedule.ts';
import { generateServicesIcs } from '../components/services/serviceCalendarExport.ts';

const service = { id: 's1', name: 'Sunday Worship', type: 'sunday', day_of_week: 'Sunday', start_time: '08:00', end_time: '10:30', is_active: true };
const services = [service, { ...service, id: 's2', name: 'Sunday Worship Evening', start_time: '18:00', end_time: '20:00' }];

test('service links honor IDs, exclude deleted IDs and only use unique exact legacy names', () => {
  assert.equal(resolveServiceId({ service_id: 's2', service_name: service.name }, services), 's2');
  assert.equal(resolveServiceId({ service_id: 'deleted', service_name: service.name }, services), null);
  assert.equal(resolveServiceId({ service_name: '  SUNDAY   WORSHIP ' }, services), 's1');
  assert.equal(resolveServiceId({ service_name: 'Sunday Worship extra text' }, services), null);
  assert.equal(resolveServiceId({ service_name: service.name }, [service, { ...service, id: 'duplicate' }]), null);
});

test('service summaries separate dates, exclude excused/absent attendance and count a person once per session', () => {
  const attendance = [
    { id: 'a', service_id: 's1', date: '2026-10-04', status: 'present', member_id: 'm1' },
    { id: 'b', service_id: 's1', date: '2026-10-11', status: 'present', member_id: 'm1' },
    { id: 'duplicate', service_id: 's1', date: '2026-10-11', status: 'present', member_id: 'm1' },
    { id: 'excused', service_id: 's1', date: '2026-10-11', status: 'excused', member_id: 'm2' },
    { id: 'absent', service_id: 's1', date: '2026-10-11', status: 'absent', member_id: 'm3' },
    { id: 'legacy', service_id: 'deleted', service_name: service.name, date: '2026-10-11', status: 'present', member_id: 'm4' },
  ];
  const result = buildServiceInsights(services, attendance, [{ service_id: 's1', date: '2026-10-11', total_auditorium: 15 }], [], '2026-10-16');
  assert.equal(result.map.get('s1').checkinCount, 2);
  assert.equal(result.map.get('s1').latestCheckinCount, 1);
  assert.equal(result.map.get('s1').todayCheckinCount, 0);
  assert.equal(result.map.get('s1').headcountCount, 15);
  assert.equal(result.unlinkedAttendance, 1);
  assert.equal(countCheckins(attendance.filter(row => row.date === '2026-10-11')), 2);
});

test('connected giving excludes unrelated, deleted-service, pending and voided receipts without a fallback', () => {
  const gifts = [
    { service_id: 's1', amount: 10.1, status: 'completed' },
    { service_name: 'Sunday Worship', amount: 20.2, status: 'completed' },
    { service_id: 's2', service_name: service.name, amount: 5, status: 'completed' },
    { service_id: 'deleted', service_name: service.name, amount: 500, status: 'completed' },
    { amount: 1000, status: 'completed' },
    { service_id: 's1', amount: 200, status: 'pending' },
    { service_id: 's1', amount: 300, status: 'voided' },
  ];
  const result = buildServiceInsights(services, [], [], gifts, '2026-10-16');
  assert.equal(result.connectedGiving, 35.3);
  assert.equal(result.map.get('s1').givingTotal, 30.3);
  assert.equal(result.map.get('s2').givingTotal, 5);
  assert.equal(buildServiceInsights(services, [], [], [{ amount: 1000 }], '2026-10-16').connectedGiving, 0);
});

test('next/live service handles boundaries and overnight services in Ghana time', () => {
  assert.equal(upcomingService(services, new Date('2026-10-18T07:59:00Z')).isLive, false);
  assert.equal(upcomingService(services, new Date('2026-10-18T08:00:00Z')).isLive, true);
  assert.equal(upcomingService(services, new Date('2026-10-18T10:30:00Z')).service.id, 's2');
  const overnight = { ...service, day_of_week: 'Friday', start_time: '22:00', end_time: '02:00' };
  const live = serviceOccurrence(overnight, new Date('2026-10-17T01:30:00Z'));
  assert.equal(live.isLive, true);
  assert.equal(live.occurrenceDate, '2026-10-16');
  assert.equal(live.end.toISOString(), '2026-10-17T02:00:00.000Z');
  assert.equal(serviceOccurrence(overnight, new Date('2026-10-17T02:00:00Z')).start.toISOString(), '2026-10-23T22:00:00.000Z');
  assert.equal(upcomingService([{ ...service, day_of_week: 'invalid' }]), null);
});

test('service form validation rejects invalid times and fractional/negative capacity while allowing overnight meetings', () => {
  assert.equal(programDurationSeconds('1 hour 30 minutes'), 5400);
  assert.equal(programDurationSeconds('25 min'), 1500);
  assert.match(validateService({ ...service, expected_attendance: -1 }), /whole number/);
  assert.match(validateService({ ...service, expected_attendance: 1.5 }), /whole number/);
  assert.match(validateService({ ...service, end_time: '08:00' }), /different/);
  assert.match(validateService({ ...service, start_time: '25:00' }), /valid/);
  assert.equal(validateService({ ...service, start_time: '22:00', end_time: '02:00', expected_attendance: 100 }), null);
});

test('roster member matching rejects partial/ambiguous names and resolves explicit identifiers', () => {
  const members = [{ id: 'm1', member_id: 'GWCC-1', first_name: 'Alex', last_name: 'Mensah', phone: '0241234567' }, { id: 'm2', member_id: 'GWCC-2', first_name: 'Alex', last_name: 'Mensah', phone: '0201234567' }];
  assert.equal(resolveRosterMember('Alex', members), undefined);
  assert.equal(resolveRosterMember('Pastor Alex Mensah', members), undefined);
  assert.equal(resolveRosterMember('GWCC-2', members)?.id, 'm2');
  assert.equal(resolveRosterMember('0241234567', members)?.id, 'm1');
  assert.equal(resolveRosterMember('Pastor Alex Mensah', [members[0]])?.id, 'm1');
});

test('calendar export uses explicit GMT, overnight end dates and safely folds/escapes user text', () => {
  const name = 'Worship, Prayer; ' + 'é'.repeat(90) + '\nBEGIN:VEVENT';
  const ics = generateServicesIcs([{ ...service, name, day_of_week: 'Friday', start_time: '22:00', end_time: '02:00' }], 'Church\nEND:VCALENDAR', new Date('2026-10-16T04:00:00Z'));
  assert.match(ics, /DTSTART:20261016T220000Z/);
  assert.match(ics, /DTEND:20261017T020000Z/);
  assert.equal(ics.split('\r\n').filter(line => line === 'BEGIN:VEVENT').length, 1);
  assert.ok(ics.includes('Worship\\, Prayer\\;'));
  assert.ok(ics.includes('\\nBEGIN:VEVENT'));
  assert.ok(ics.split('\r\n').every(line => Buffer.byteLength(line, 'utf8') <= 75));
});
