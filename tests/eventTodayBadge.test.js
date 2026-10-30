import assert from 'node:assert/strict';
import test from 'node:test';
import { eventIsScheduledToday } from '../src/features/events/eventRules.ts';

const now = Date.parse('2026-10-30T12:00:00Z');
const event = {
  id: 'event-1', title: 'GWCC Morning Service',
  venue: 'GWCC', event_type: 'conference',
  start_date: '2026-10-30', end_date: '2026-10-30',
  start_time: '09:00', end_time: '13:00',
  status: 'upcoming',
};

test('TODAY is shown for a live Ghana service', () => {
  assert.equal(eventIsScheduledToday(event, now), true);
});
test('TODAY badge is not shown for draft, cancelled, or unsynced programs', () => {
  for (const status of ['draft', 'cancelled', 'completed']) {
    assert.equal(eventIsScheduledToday({ ...event, status }, now), false);
  }
  assert.equal(eventIsScheduledToday({ ...event, _sync_status: 'pending' }, now), false);
});
test('TODAY badge respects exact Ghana service date boundaries', () => {
  assert.equal(eventIsScheduledToday({ ...event, start_date: '2026-10-31', end_date: '2026-10-31' }, now), false);
  assert.equal(eventIsScheduledToday({ ...event, start_date: '2026-10-29', end_date: '2026-10-30' }, now), true);
  assert.equal(eventIsScheduledToday({ ...event, start_date: '2026-10-29', end_date: '2026-10-29' }, now), false);
  assert.equal(eventIsScheduledToday({ ...event, start_time: '09:00', end_time: '10:00' }, now), false);
});
