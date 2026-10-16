import type { ChurchService } from '../../types/database.types';

export const SERVICE_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function programDurationSeconds(value?: string): number {
  const hours = value?.match(/(\d+)\s*h(?:ours?)?/i);
  const minutes = value?.match(/(\d+)\s*m(?:in(?:utes?)?)?/i);
  if (hours || minutes) return Math.max(60, (Number(hours?.[1] || 0) * 60 + Number(minutes?.[1] || 0)) * 60);
  return /^\d+$/.test(value || '') ? Math.max(1, Number(value)) * 60 : 15 * 60;
}
export function serviceTimeMinutes(value?: string): number | null {
  if (!value || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) return null;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
}

/** The schedule is advertised in GMT (Africa/Accra), regardless of the device timezone. */
export function serviceOccurrence(service: ChurchService, now = new Date()) {
  const day = SERVICE_DAYS.findIndex(name => name.toLowerCase() === service.day_of_week?.trim().toLowerCase());
  const start = serviceTimeMinutes(service.start_time), end = serviceTimeMinutes(service.end_time);
  if (day < 0 || start === null || end === null || start === end) return null;
  const duration = ((end - start + 1440) % 1440) * 60000;
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + day - now.getUTCDay(), 0, start));
  if (date.getTime() > now.getTime()) date.setUTCDate(date.getUTCDate() - 7);
  const isLive = now.getTime() < date.getTime() + duration;
  if (!isLive) date.setUTCDate(date.getUTCDate() + 7);
  return { start: date, end: new Date(date.getTime() + duration), isLive, occurrenceDate: date.toISOString().slice(0, 10) };
}

export function upcomingService(services: readonly ChurchService[], now = new Date()) {
  const candidates = services.filter(service => service.is_active).flatMap(service => {
    const occurrence = serviceOccurrence(service, now);
    return occurrence ? [{ service, ...occurrence }] : [];
  }).sort((a, b) => Number(b.isLive) - Number(a.isLive) || a.start.getTime() - b.start.getTime() || a.service.id.localeCompare(b.service.id));
  const next = candidates[0];
  if (!next) return null;
  const minutes = Math.max(0, Math.ceil((next.start.getTime() - now.getTime()) / 60000));
  const hours = Math.floor(minutes / 60), days = Math.floor(minutes / 1440);
  const countdownText = next.isLive ? 'Live In Session Now' : days > 0
    ? `In ${days} day${days === 1 ? '' : 's'} ${hours % 24}h`
    : hours > 0 ? `Starting in ${hours}h ${minutes % 60}m` : `Starting in ${minutes} minutes`;
  return { ...next, countdownText };
}

export function validateService(data: Pick<ChurchService, 'name' | 'day_of_week' | 'start_time' | 'end_time' | 'expected_attendance'>): string | null {
  if (!data.name.trim()) return 'Enter a service name.';
  if (!SERVICE_DAYS.includes(data.day_of_week)) return 'Choose a valid day of the week.';
  const start = serviceTimeMinutes(data.start_time), end = serviceTimeMinutes(data.end_time);
  if (start === null || end === null || start === end) return 'Enter valid, different start and end times. Overnight services may end the following day.';
  if (data.expected_attendance != null && (!Number.isInteger(data.expected_attendance) || data.expected_attendance < 0)) return 'Expected attendance must be a whole number of zero or more.';
  return null;
}
