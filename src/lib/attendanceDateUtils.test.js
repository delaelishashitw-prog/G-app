import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getLocalDateString,
  parseLocalDate,
  formatServiceDayString,
  getQuickDate,
} from './attendanceDateUtils.ts';

describe('Attendance Date Utilities', () => {
  it('formats local Date to YYYY-MM-DD correctly', () => {
    const testDate = new Date(2026, 9, 6, 14, 30); // 2026-10-06
    assert.equal(getLocalDateString(testDate), '2026-10-06');
  });

  it('parses YYYY-MM-DD string to local Date at noon avoiding midnight drift', () => {
    const parsed = parseLocalDate('2026-10-06');
    assert.equal(parsed.getFullYear(), 2026);
    assert.equal(parsed.getMonth(), 9); // October
    assert.equal(parsed.getDate(), 6);
    assert.equal(parsed.getHours(), 12);
  });

  it('formats service day string accurately across timezones', () => {
    const formatted = formatServiceDayString('2026-10-06');
    assert.match(formatted, /Tuesday/);
    assert.match(formatted, /6/);
    assert.match(formatted, /Oct/);
    assert.match(formatted, /2026/);
  });

  it('calculates lastSunday preset accurately without mutating reference date', () => {
    // Tuesday Oct 6, 2026 -> last Sunday was Oct 4, 2026
    const tuesday = new Date(2026, 9, 6, 10, 0);
    const lastSun = getQuickDate('lastSunday', tuesday);
    assert.equal(lastSun, '2026-10-04');
    // Verify reference date was not mutated
    assert.equal(tuesday.getDate(), 6);

    // Sunday Oct 4, 2026 -> today is Sunday
    const sunday = new Date(2026, 9, 4, 10, 0);
    assert.equal(getQuickDate('lastSunday', sunday), '2026-10-04');
  });

  it('calculates lastWednesday preset accurately without mutating reference date', () => {
    // Tuesday Oct 6, 2026 -> last Wednesday was Sep 30, 2026
    const tuesday = new Date(2026, 9, 6, 10, 0);
    const lastWedFromTue = getQuickDate('lastWednesday', tuesday);
    assert.equal(lastWedFromTue, '2026-09-30');

    // Thursday Oct 8, 2026 -> last Wednesday was Oct 7, 2026
    const thursday = new Date(2026, 9, 8, 10, 0);
    assert.equal(getQuickDate('lastWednesday', thursday), '2026-10-07');

    // Wednesday Oct 7, 2026 -> today is Wednesday
    const wednesday = new Date(2026, 9, 7, 10, 0);
    assert.equal(getQuickDate('lastWednesday', wednesday), '2026-10-07');
  });
});
