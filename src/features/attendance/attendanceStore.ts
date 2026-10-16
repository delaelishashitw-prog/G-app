import type { Dispatch, SetStateAction } from 'react';
import type { AttendanceRecord, ChurchService, HeadcountRecord, Member, Visitor } from '../../types/database.types';
import { validateService } from '../services/serviceSchedule';
import { attendanceSessionError, headcountError, headcountTotal } from './attendanceInsights';
import { resolveServiceId } from '../services/serviceInsights';
import { getChurchDateString, isValidDateString } from '../../lib/attendanceDateUtils';

export function createService(
  data: Omit<ChurchService, 'id'>,
  setServices: Dispatch<SetStateAction<ChurchService[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
): ChurchService {
  const validationError = validateService(data);
  if (validationError) throw new Error(validationError);
  const newService: ChurchService = {
    ...data,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  };
  setServices((prev) => [newService, ...prev]);
  logAction('CREATE_SERVICE', 'Services', `Created service "${newService.name}"`, newService.id);
  dbSyncUpsert('services', newService);
  return newService;
}

export function updateService(
  id: string,
  updates: Partial<ChurchService>,
  setServices: Dispatch<SetStateAction<ChurchService[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void,
  services: ChurchService[] = []
) {
  const existing = services.find(service => service.id === id);
  if (!existing) throw new Error('Service not found. Refresh and try again.');
  const updated = { ...existing, ...updates, id, updated_at: new Date().toISOString(), _expected_updated_at: existing.updated_at };
  const validationError = validateService(updated);
  if (validationError) throw new Error(validationError);
  setServices(prev => prev.map(service => service.id === id ? updated : service));
  logAction('UPDATE_SERVICE', 'Services', `Updated service "${updated.name}"`, id);
  dbSyncUpsert('services', updated);
}

export function deleteService(
  id: string,
  setServices: Dispatch<SetStateAction<ChurchService[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncDelete: (table: string, id: string) => void
) {
  setServices((prev) => prev.filter((s) => s.id !== id));
  logAction('DELETE_SERVICE', 'Services', `Deleted church service ${id}`, id);
  dbSyncDelete('services', id);
}

export function recordAttendance(
  serviceId: string,
  personType: 'member' | 'visitor',
  personId: string,
  members: Member[],
  visitors: Visitor[],
  attendance: AttendanceRecord[],
  setAttendance: Dispatch<SetStateAction<AttendanceRecord[]>>,
  services: ChurchService[],
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void,
  method: 'manual' | 'search' | 'qr_code' = 'manual',
  customDate?: string
): { success: boolean; message: string } {
  const targetDate = customDate ?? getChurchDateString();
  const targetService = services.find((s) => s.id === serviceId);
  const sessionError = attendanceSessionError(targetService, targetDate);
  if (sessionError) return { success: false, message: sessionError };
  const member = personType === 'member' ? members.find((x) => x.id === personId && !x.is_archived) : undefined;
  const visitor = personType === 'visitor' ? visitors.find((x) => x.id === personId) : undefined;
  if (!member && !visitor) return { success: false, message: 'Choose an existing member or visitor.' };

  const existing = attendance.find(
    (a) =>
      resolveServiceId(a, services) === serviceId &&
      a.date === targetDate &&
      ((personType === 'member' && a.member_id === personId) ||
        (personType === 'visitor' && a.visitor_id === personId))
  );

  if (existing?.status === 'present') {
    return { success: false, message: 'Person already checked in for this service date.' };
  }

  const serviceName = targetService!.name;
  const name = member ? `${member.first_name} ${member.last_name}` : visitor ? visitor.full_name : 'Attendee';

  const newRecord = {
    ...existing,
    id: existing?.id || crypto.randomUUID(),
    service_id: serviceId,
    service_name: serviceName,
    date: targetDate,
    member_id: personType === 'member' ? personId : undefined,
    member_name: member ? `${member.first_name} ${member.last_name}` : undefined,
    visitor_id: personType === 'visitor' ? personId : undefined,
    visitor_name: visitor ? visitor.full_name : undefined,
    person_name: name,
    person_type: personType,
    check_in_time: new Date().toISOString(),
    check_in_method: method,
    status: 'present',
    updated_at: new Date().toISOString(),
    _expected_updated_at: existing?.updated_at,
  } satisfies AttendanceRecord & { _expected_updated_at?: string };

  setAttendance((prev) => [newRecord, ...prev.filter(row => row.id !== newRecord.id)]);
  dbSyncUpsert('attendance', newRecord);
  logAction('RECORD_ATTENDANCE', 'Attendance', `Checked in ${name} (${personType}) for ${targetDate}`, newRecord.id);
  return { success: true, message: `Checked in ${name} successfully!` };
}

export function batchRecordAttendance(
  serviceId: string,
  date: string,
  items: Array<{ personType: 'member' | 'visitor'; personId: string; method?: 'manual' | 'search' | 'qr_code' }>,
  services: ChurchService[],
  members: Member[],
  visitors: Visitor[],
  attendance: AttendanceRecord[],
  setAttendance: Dispatch<SetStateAction<AttendanceRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
): { added: number; skipped: number } {
  const targetService = services.find((s) => s.id === serviceId);
  const sessionError = attendanceSessionError(targetService, date);
  if (sessionError) throw new Error(sessionError);
  if (items.some(item => item.personType === 'member'
    ? !members.some(member => member.id === item.personId && !member.is_archived)
    : item.personType !== 'visitor' || !visitors.some(visitor => visitor.id === item.personId))) {
    throw new Error('Every attendee must be an existing member or visitor.');
  }
  const serviceName = targetService!.name;
  const newRecords: AttendanceRecord[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  items.forEach((item) => {
    const key = `${item.personType}:${item.personId}`;
    const existing = attendance.find(
      (a) =>
        resolveServiceId(a, services) === serviceId &&
        a.date === date &&
        ((item.personType === 'member' && a.member_id === item.personId) ||
          (item.personType === 'visitor' && a.visitor_id === item.personId))
    );
    if (existing?.status === 'present' || seen.has(key)) {
      skipped++;
      return;
    }
    seen.add(key);

    const member = item.personType === 'member' ? members.find((x) => x.id === item.personId) : undefined;
    const visitor = item.personType === 'visitor' ? visitors.find((x) => x.id === item.personId) : undefined;
    const name = member ? `${member.first_name} ${member.last_name}` : visitor ? visitor.full_name : 'Attendee';

    const rec = {
      ...existing,
      id: existing?.id || crypto.randomUUID(),
      service_id: serviceId,
      service_name: serviceName,
      date,
      member_id: item.personType === 'member' ? item.personId : undefined,
      member_name: member ? `${member.first_name} ${member.last_name}` : undefined,
      visitor_id: item.personType === 'visitor' ? item.personId : undefined,
      visitor_name: visitor ? visitor.full_name : undefined,
      person_name: name,
      person_type: item.personType,
      check_in_time: new Date().toISOString(),
      check_in_method: item.method || 'manual',
      status: 'present',
      updated_at: new Date().toISOString(),
      _expected_updated_at: existing?.updated_at,
    } satisfies AttendanceRecord & { _expected_updated_at?: string };
    newRecords.push(rec);
  });

  if (newRecords.length > 0) {
    const replacedIds = new Set(newRecords.map(row => row.id));
    setAttendance((prev) => [...newRecords, ...prev.filter(row => !replacedIds.has(row.id))]);
    newRecords.forEach((r) => dbSyncUpsert('attendance', r));
    logAction('BATCH_ATTENDANCE', 'Attendance', `Batch checked in ${newRecords.length} attendees for ${date}`);
  }

  return { added: newRecords.length, skipped };
}

export function recordHeadcount(
  data: Omit<HeadcountRecord, 'id' | 'created_at'>,
  headcounts: HeadcountRecord[],
  setHeadcounts: Dispatch<SetStateAction<HeadcountRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
): HeadcountRecord {
  const validationError = headcountError(data);
  if (validationError) throw new Error(validationError);
  if (!isValidDateString(data.date) || data.date > getChurchDateString()) throw new Error('Choose a valid service date that is not in the future.');
  const existingIndex = headcounts.findIndex((h) => h.service_id === data.service_id && h.date === data.date);
  const existing = headcounts[existingIndex];
  const newRecord = {
    ...data,
    id: existing?.id || crypto.randomUUID(),
    total_auditorium: headcountTotal(data),
    updated_at: new Date().toISOString(),
    _expected_updated_at: existing?.updated_at,
    created_at:
      existingIndex >= 0 && headcounts[existingIndex].created_at
        ? headcounts[existingIndex].created_at
        : new Date().toISOString(),
  } satisfies HeadcountRecord & { _expected_updated_at?: string };

  if (existingIndex >= 0) {
    setHeadcounts((prev) => prev.map((h) => (h.id === existing.id ? newRecord : h)));
    logAction(
      'UPDATE_HEADCOUNT',
      'Attendance',
      `Updated auditorium headcount for ${data.service_name} on ${data.date} (Total: ${data.total_auditorium})`,
      newRecord.id
    );
  } else {
    setHeadcounts((prev) => [newRecord, ...prev]);
    logAction(
      'RECORD_HEADCOUNT',
      'Attendance',
      `Recorded auditorium headcount for ${data.service_name} on ${data.date} (Total: ${data.total_auditorium})`,
      newRecord.id
    );
  }

  dbSyncUpsert('headcounts', newRecord);
  return newRecord;
}

export function updateHeadcount(
  id: string,
  updates: Partial<HeadcountRecord>,
  setHeadcounts: Dispatch<SetStateAction<HeadcountRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void,
  headcounts: HeadcountRecord[]
) {
  const existing = headcounts.find(row => row.id === id);
  if (!existing) throw new Error('Headcount not found. Refresh and try again.');
  const updated = { ...existing, ...updates, id, updated_at: new Date().toISOString(), _expected_updated_at: existing.updated_at };
  const validationError = headcountError(updated);
  if (validationError) throw new Error(validationError);
  updated.total_auditorium = headcountTotal(updated);
  setHeadcounts(prev => prev.map(row => row.id === id ? updated : row));
  logAction('UPDATE_HEADCOUNT', 'Attendance', `Updated headcount record ${id}`, id);
  dbSyncUpsert('headcounts', updated);
}

export function deleteHeadcount(
  id: string,
  setHeadcounts: Dispatch<SetStateAction<HeadcountRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncDelete: (table: string, id: string) => void
) {
  setHeadcounts((prev) => prev.filter((h) => h.id !== id));
  logAction('DELETE_HEADCOUNT', 'Attendance', `Deleted headcount record ${id}`, id);
  dbSyncDelete('headcounts', id);
}

export function deleteAttendanceRecord(
  id: string,
  setAttendance: Dispatch<SetStateAction<AttendanceRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncDelete: (table: string, id: string) => void
) {
  setAttendance((prev) => prev.filter((a) => a.id !== id));
  logAction('DELETE_ATTENDANCE', 'Attendance', `Removed attendance record ${id}`, id);
  dbSyncDelete('attendance', id);
}
