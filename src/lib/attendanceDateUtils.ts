/**
 * Attendance Date Utilities
 * Handles timezone-safe date parsing, formatting, and quick preset calculations
 * without UTC off-by-one shifts or Date object mutations.
 */

/**
 * Returns a YYYY-MM-DD string from a local Date object.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string into a Date object set at noon local time.
 * Setting time to 12:00:00 guarantees that day boundaries are not crossed
 * regardless of daylight saving or client timezone offsets.
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month, day, 12, 0, 0);
    }
  }
  return new Date(dateStr);
}

/**
 * Formats a date string (YYYY-MM-DD) into a human-readable service day title,
 * e.g., "Tuesday, 6 Oct 2026" or "Sunday, 4 Oct 2026", without timezone drift.
 */
export function formatServiceDayString(dateStr: string, locale = 'en-GB'): string {
  const dateObj = parseLocalDate(dateStr);
  return dateObj.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Calculates quick date presets ('today', 'lastSunday', 'lastWednesday')
 * without mutating the input date and formatted as YYYY-MM-DD.
 */
export function getQuickDate(
  preset: 'today' | 'lastSunday' | 'lastWednesday',
  referenceDate: Date = new Date()
): string {
  const date = new Date(referenceDate.getTime());
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  if (preset === 'today') {
    return getLocalDateString(date);
  }

  if (preset === 'lastSunday') {
    // If today is Sunday, return today. Otherwise subtract dayOfWeek days.
    const daysToSubtract = dayOfWeek === 0 ? 0 : dayOfWeek;
    const target = new Date(date);
    target.setDate(date.getDate() - daysToSubtract);
    return getLocalDateString(target);
  }

  if (preset === 'lastWednesday') {
    // Wednesday is day 3
    let daysToSubtract = 0;
    if (dayOfWeek === 3) {
      daysToSubtract = 0;
    } else if (dayOfWeek > 3) {
      // Thu (4), Fri (5), Sat (6) -> subtract (dayOfWeek - 3)
      daysToSubtract = dayOfWeek - 3;
    } else {
      // Sun (0), Mon (1), Tue (2) -> subtract (dayOfWeek + 4)
      daysToSubtract = dayOfWeek + 4;
    }
    const target = new Date(date);
    target.setDate(date.getDate() - daysToSubtract);
    return getLocalDateString(target);
  }

  return getLocalDateString(date);
}
