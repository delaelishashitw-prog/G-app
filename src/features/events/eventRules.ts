import type { ChurchEvent, UserRole } from '../../types/database.types';

export const EVENT_WRITE_ROLES: UserRole[] = ['super_admin', 'senior_pastor', 'administrator', 'pastor', 'ministry_leader'];
export const EVENT_SAVE_NOTICE = 'Saved on this device. Awaiting cloud confirmation.';
export function requireEventPublication(event: ChurchEvent) {
  if (event._sync_status === 'pending') throw new Error('Wait for cloud confirmation before sharing, printing or downloading this program.');
}
export const ghanaToday = () => new Date().toISOString().slice(0, 10);
export const eventInstant = (date: string, time: string) => Date.parse(`${date}T${time?.slice(0, 5)}:00Z`);

/** Event dates and times are Ghana civil time (UTC), regardless of the viewer's location. */
export function effectiveEventStatus(event: ChurchEvent, now = Date.now()): ChurchEvent['status'] {
  if (['draft', 'cancelled', 'completed'].includes(event.status)) return event.status;
  if (now >= eventInstant(event.end_date || event.start_date, event.end_time)) return 'completed';
  if (now >= eventInstant(event.start_date, event.start_time)) return 'ongoing';
  return 'upcoming';
}
/** Show TODAY only for a confirmed program actually scheduled for Ghana's current date. */
export function eventIsScheduledToday(event: ChurchEvent, now = Date.now()): boolean {
  const today = new Date(now).toISOString().slice(0, 10);
  const status = effectiveEventStatus(event, now);
  return (status === 'upcoming' || status === 'ongoing') &&
    event._sync_status !== 'pending' &&
    event.start_date <= today &&
    (event.end_date || event.start_date) >= today;
}

export function canMemberRsvp(event: ChurchEvent, now = Date.now()) {
  return event.requires_registration === true && ['upcoming', 'ongoing'].includes(effectiveEventStatus(event, now));
}
export function validateEvent(event: ChurchEvent) {
  if (!event.title?.trim() || event.title.length > 300) throw new Error('Enter an event title of up to 300 characters.');
  if (!event.venue?.trim() || event.venue.length > 1000) throw new Error('Enter a venue or meeting link of up to 1,000 characters.');
  for (const date of [event.start_date, event.end_date]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Enter valid start and end dates.');
  }
  if (![event.start_time, event.end_time].every(time => /^([01]\d|2[0-3]):[0-5]\d(:00)?$/.test(time))) throw new Error('Enter valid start and end times.');
  if (eventInstant(event.end_date, event.end_time) <= eventInstant(event.start_date, event.start_time)) throw new Error('The event must end after it starts.');
  if (event.expected_attendance != null && (!Number.isInteger(event.expected_attendance) || event.expected_attendance < 0 || event.expected_attendance > 1000000)) throw new Error('Expected attendance must be a whole number from 0 to 1,000,000.');
  if (event.budget != null && (!Number.isFinite(event.budget) || event.budget < 0 || event.budget > 1000000000 || Math.abs(event.budget * 100 - Math.round(event.budget * 100)) > 0.00001)) throw new Error('Enter a non-negative budget with up to two decimal places.');
}
