export const normalizeDateStr = (dateString: string | undefined | null): string => {
  if (!dateString) return '';
  const trimmed = String(dateString).trim();
  if (!trimmed) return '';

  // Match YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const match = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) {
    const y = match[1];
    const m = match[2].padStart(2, '0');
    const d = match[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Fallback to JS Date parse
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDateNormalized = (dateString: string | undefined | null): Date | null => {
  if (!dateString) return null;
  const normalized = normalizeDateStr(dateString);
  if (!normalized) return null;
  const [y, m, d] = normalized.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setHours(12, 0, 0, 0); // Noon to prevent timezone/DST boundary shifts
  return date;
};

export const todayISO = (referenceDate: Date = new Date()): string => {
  const date = new Date(referenceDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatMonthKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const getCurrentMonthKey = (referenceDate: Date = new Date()): string => {
  return formatMonthKey(referenceDate);
};

export const getPreviousMonthKey = (referenceDate: Date = new Date()): string => {
  const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);
  return formatMonthKey(date);
};

export const isDateInMonth = (dateString: string | undefined | null, monthKey: string): boolean => {
  if (!dateString) return false;
  const normalized = normalizeDateStr(dateString);
  return normalized.startsWith(monthKey);
};

export const isDateInCurrentMonth = (dateString: string | undefined | null, referenceDate: Date = new Date()): boolean => {
  return isDateInMonth(dateString, getCurrentMonthKey(referenceDate));
};

export const getWeekStart = (referenceDate: Date = new Date(), startDay: 'monday' | 'sunday' = 'monday'): Date => {
  const date = new Date(referenceDate);
  const day = date.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = startDay === 'sunday' ? day : (day + 6) % 7;
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(date.getDate() - diff);
  return start;
};

export const getWeekEnd = (referenceDate: Date = new Date(), startDay: 'monday' | 'sunday' = 'monday'): Date => {
  const start = getWeekStart(referenceDate, startDay);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
};

export const isDateInCurrentWeek = (dateString: string | undefined | null, referenceDate: Date = new Date()): boolean => {
  if (!dateString) return false;
  const target = parseDateNormalized(dateString);
  if (!target) return false;

  const start = getWeekStart(referenceDate, 'monday');
  const end = getWeekEnd(referenceDate, 'monday');

  return target.getTime() >= start.getTime() && target.getTime() <= end.getTime();
};

export const isDateInLastWeek = (dateString: string | undefined | null, referenceDate: Date = new Date()): boolean => {
  if (!dateString) return false;
  const target = parseDateNormalized(dateString);
  if (!target) return false;

  const currentStart = getWeekStart(referenceDate, 'monday');
  const lastWeekStart = new Date(currentStart);
  lastWeekStart.setDate(currentStart.getDate() - 7);
  lastWeekStart.setHours(0, 0, 0, 0);

  const lastWeekEnd = new Date(currentStart);
  lastWeekEnd.setMilliseconds(-1);

  return target.getTime() >= lastWeekStart.getTime() && target.getTime() <= lastWeekEnd.getTime();
};

export const isDateInPastDays = (dateString: string | undefined | null, days = 7, referenceDate: Date = new Date()): boolean => {
  if (!dateString) return false;
  const target = parseDateNormalized(dateString);
  if (!target) return false;

  const end = new Date(referenceDate);
  end.setHours(23, 59, 59, 999);

  const start = new Date(referenceDate);
  start.setDate(referenceDate.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  return target.getTime() >= start.getTime() && target.getTime() <= end.getTime();
};

export const isDateInRange = (
  dateString: string | undefined | null,
  startDate?: string,
  endDate?: string
): boolean => {
  if (!dateString) return false;
  const normalized = normalizeDateStr(dateString);
  if (!normalized) return false;

  if (startDate && normalized < startDate) return false;
  if (endDate && normalized > endDate) return false;
  return true;
};

export const buildRecentMonthSeries = (referenceDate: Date = new Date(), count = 6) => {
  const firstOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);

  return Array.from({ length: count }, (_, index) => {
    const monthDate = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth() - (count - 1 - index), 1);
    const key = formatMonthKey(monthDate);

    return {
      key,
      month: new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(monthDate),
      shortMonth: new Intl.DateTimeFormat('en-US', { month: 'short' }).format(monthDate),
    };
  });
};
