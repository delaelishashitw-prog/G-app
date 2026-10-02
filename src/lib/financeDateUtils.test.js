import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRecentMonthSeries,
  isDateInCurrentMonth,
  isDateInMonth,
  normalizeDateStr,
  parseDateNormalized,
  isDateInCurrentWeek,
  isDateInLastWeek,
  isDateInPastDays,
  isDateInRange,
  todayISO,
} from './financeDateUtils.js';

test('buildRecentMonthSeries creates a rolling 6-month window based on today', () => {
  const now = new Date(2026, 9, 1);
  const months = buildRecentMonthSeries(now);

  assert.deepEqual(
    months.map((entry) => entry.key),
    ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']
  );
  assert.equal(months[0].shortMonth, 'May');
  assert.equal(months[5].month, 'Oct 2026');
});

test('month checks use the active runtime date instead of fixed 2026 dates', () => {
  const now = new Date(2026, 9, 1);
  assert.equal(isDateInCurrentMonth('2026-10-15', now), true);
  assert.equal(isDateInCurrentMonth('2026-09-30', now), false);
  assert.equal(isDateInMonth('2026-09-30', '2026-09'), true);
  assert.equal(isDateInMonth('2026-09-30T14:20:00.000Z', '2026-09'), true);
  assert.equal(isDateInMonth('2026/09/30', '2026-09'), true);
});

test('normalizeDateStr correctly converts various formats to YYYY-MM-DD', () => {
  assert.equal(normalizeDateStr('2026-10-02'), '2026-10-02');
  assert.equal(normalizeDateStr('2026-10-02T14:30:00.000Z'), '2026-10-02');
  assert.equal(normalizeDateStr('2026-10-02 18:00:00'), '2026-10-02');
  assert.equal(normalizeDateStr('2026/10/02'), '2026-10-02');
  assert.equal(normalizeDateStr(''), '');
  assert.equal(normalizeDateStr(null), '');
  assert.equal(normalizeDateStr(undefined), '');
});

test('isDateInCurrentWeek handles ISO strings and timestamps correctly without NaN errors', () => {
  const friday = new Date(2026, 9, 2); // Friday Oct 2, 2026
  assert.equal(isDateInCurrentWeek('2026-10-02', friday), true);
  assert.equal(isDateInCurrentWeek('2026-10-02T10:00:00.000Z', friday), true);
  assert.equal(isDateInCurrentWeek('2026-09-28', friday), true); // Monday of this week
  assert.equal(isDateInCurrentWeek('2026-10-04', friday), true); // Sunday of this week
  assert.equal(isDateInCurrentWeek('2026-09-27', friday), false); // Sunday of last week
  assert.equal(isDateInCurrentWeek('2026-10-05', friday), false); // Monday of next week
});

test('isDateInLastWeek and isDateInPastDays work accurately', () => {
  const friday = new Date(2026, 9, 2); // Friday Oct 2, 2026
  assert.equal(isDateInLastWeek('2026-09-27', friday), true); // Sunday of last week
  assert.equal(isDateInLastWeek('2026-09-21', friday), true); // Monday of last week
  assert.equal(isDateInLastWeek('2026-10-02', friday), false); // Today

  assert.equal(isDateInPastDays('2026-10-02', 7, friday), true);
  assert.equal(isDateInPastDays('2026-09-26', 7, friday), true); // 6 days ago
  assert.equal(isDateInPastDays('2026-09-24', 7, friday), false); // 8 days ago
});

test('isDateInRange checks custom start and end boundaries', () => {
  assert.equal(isDateInRange('2026-09-15', '2026-09-01', '2026-09-30'), true);
  assert.equal(isDateInRange('2026-09-15T12:00:00.000Z', '2026-09-01', '2026-09-30'), true);
  assert.equal(isDateInRange('2026-10-01', '2026-09-01', '2026-09-30'), false);
  assert.equal(isDateInRange('2026-08-31', '2026-09-01', '2026-09-30'), false);
  // Unbounded start or end
  assert.equal(isDateInRange('2026-09-15', '2026-09-01', undefined), true);
  assert.equal(isDateInRange('2026-08-15', '2026-09-01', undefined), false);
  assert.equal(isDateInRange('2026-09-15', undefined, '2026-09-30'), true);
  assert.equal(isDateInRange('2026-10-05', undefined, '2026-09-30'), false);
});
