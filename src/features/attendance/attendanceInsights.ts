import type { AttendanceRecord, ChurchService, HeadcountRecord, Member } from '../../types/database.types';
import { resolveServiceId } from '../services/serviceInsights';
import { isValidDateString } from '../../lib/attendanceDateUtils';

/** Legacy person_type values were missing, or defaulted visitors to member. IDs are authoritative. */
export function attendancePersonType(row: Pick<AttendanceRecord, 'member_id' | 'visitor_id'>): 'member' | 'visitor' | null {
  if (row.member_id && !row.visitor_id) return 'member';
  if (row.visitor_id && !row.member_id) return 'visitor';
  return null;
}

export function attendeeKey(type: 'member' | 'visitor', id: string): string {
  return `${type}:${id}`;
}

export function uniquePresentAttendance(rows: readonly AttendanceRecord[]): AttendanceRecord[] {
  const seen = new Set<string>();
  return rows.filter(row => {
    const type = attendancePersonType(row);
    if (row.status !== 'present' || !type) return false;
    const key = `${row.service_id}:${row.date}:${attendeeKey(type, (type === 'member' ? row.member_id : row.visitor_id)!)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function matchesAttendeeSearch(person: { first_name?: string; last_name?: string; full_name?: string; member_id?: string; phone?: string }, search: string): boolean {
  const term = search.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!term) return false;
  const name = (person.full_name || `${person.first_name || ''} ${person.last_name || ''}`).trim().replace(/\s+/g, ' ').toLowerCase();
  const digits = term.replace(/\D/g, '');
  return name.includes(term) || !!person.member_id?.toLowerCase().includes(term) ||
    (digits.length >= 3 && !!person.phone?.replace(/\D/g, '').includes(digits));
}

export function attendanceSessionError(service: ChurchService | undefined, date: string, now = new Date()): string | null {
  if (!service) return 'Select an existing service.';
  if (!service.is_active) return 'This service is archived. Select an active service for new records.';
  if (!isValidDateString(date)) return 'Choose a valid service date.';
  if (date > now.toISOString().slice(0, 10)) return 'Attendance cannot be recorded for a future date.';
  return null;
}

export const HEADCOUNT_FIELDS = ['men', 'women', 'youth', 'children', 'visitors', 'ushers_protocol', 'online_viewers'] as const;
export function headcountTotal(data: Pick<HeadcountRecord, typeof HEADCOUNT_FIELDS[number]>): number {
  return HEADCOUNT_FIELDS.filter(field => field !== 'online_viewers').reduce((sum, field) => sum + data[field], 0);
}
export function headcountError(data: Pick<HeadcountRecord, typeof HEADCOUNT_FIELDS[number]>): string | null {
  return HEADCOUNT_FIELDS.some(field => !Number.isSafeInteger(data[field]) || data[field] < 0 || data[field] > 1_000_000)
    ? 'Headcounts must be whole numbers between 0 and 1,000,000.' : null;
}

export function buildAttendanceSessions(services: readonly ChurchService[], attendance: readonly AttendanceRecord[], headcounts: readonly HeadcountRecord[]) {
  type Session = { key: string; service_id: string; service_name: string; date: string; records: AttendanceRecord[]; headcount?: HeadcountRecord; unlinked: boolean };
  const sessions = new Map<string, Session>();
  const get = (row: { service_id: string; service_name: string; date: string }) => {
    const resolved = resolveServiceId(row, services);
    const id = resolved || row.service_id || `unlinked:${row.service_name}`;
    const key = `${id}:${row.date}`;
    let session = sessions.get(key);
    if (!session) {
      session = { key, service_id: id, service_name: services.find(service => service.id === resolved)?.name || row.service_name || 'Unlinked service', date: row.date, records: [], unlinked: !resolved };
      sessions.set(key, session);
    }
    return session;
  };
  attendance.forEach(row => { get(row).records.push(row); });
  headcounts.forEach(row => {
    const session = get(row);
    if (!session.headcount || (row.updated_at || row.created_at || '') > (session.headcount.updated_at || session.headcount.created_at || '')) session.headcount = row;
  });
  return [...sessions.values()].map(session => {
    const records = uniquePresentAttendance(session.records.map(row => ({ ...row, service_id: session.service_id })));
    return { ...session, records, checkins: records.length, visitors: records.filter(row => attendancePersonType(row) === 'visitor').length };
  }).sort((a, b) => b.date.localeCompare(a.date) || a.service_name.localeCompare(b.service_name) || a.key.localeCompare(b.key));
}

export function membersNotCheckedIn(members: readonly Member[], session: readonly AttendanceRecord[], date: string): Member[] {
  const present = new Set(uniquePresentAttendance(session).map(row => row.member_id).filter(Boolean));
  return members.filter(member => !member.is_archived && member.status === 'active' &&
    (!isValidDateString(member.membership_date || '') || member.membership_date <= date) && !present.has(member.id));
}

/** Quote every field and neutralize spreadsheet formulas, including whitespace-prefixed formulas. */
export function attendanceCsv(rows: readonly AttendanceRecord[]): string {
  const cell = (value: unknown) => {
    let text = String(value ?? '');
    if (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const lines: unknown[][] = [['Attendance ID', 'Service Name', 'Date', 'Person Name', 'Person Type', 'Check-In Method', 'Check-In Time', 'Status']];
  rows.forEach(row => lines.push([row.id, row.service_name, row.date, row.person_name || row.member_name || row.visitor_name || 'Attendee', attendancePersonType(row) || 'unknown', row.check_in_method || 'manual', row.check_in_time || '', row.status]));
  return '\uFEFF' + lines.map(line => line.map(cell).join(',')).join('\r\n');
}
