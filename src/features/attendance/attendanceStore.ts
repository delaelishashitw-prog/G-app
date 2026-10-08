import type { Dispatch, SetStateAction } from 'react';
import type { AttendanceRecord, ChurchService, HeadcountRecord, Member, Visitor } from '../../types/database.types';

export function createService(
  data: Omit<ChurchService, 'id'>,
  setServices: Dispatch<SetStateAction<ChurchService[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
): ChurchService {
  const newService: ChurchService = {
    ...data,
    id: `ser-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  setServices((prev) =>
    prev.map((s) => {
      if (s.id === id) {
        const updated = { ...s, ...updates };
        logAction('UPDATE_SERVICE', 'Services', `Updated service "${updated.name}"`, id);
        dbSyncUpsert('services', updated);
        return updated;
      }
      return s;
    })
  );
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
  const targetDate = customDate || new Date().toISOString().split('T')[0];

  const exists = attendance.some(
    (a) =>
      a.service_id === serviceId &&
      a.date === targetDate &&
      ((personType === 'member' && a.member_id === personId) ||
        (personType === 'visitor' && a.visitor_id === personId))
  );

  if (exists) {
    return { success: false, message: 'Person already checked in for this service date.' };
  }

  const targetService = services.find((s) => s.id === serviceId);
  const serviceName = targetService ? targetService.name : 'Worship Service';
  const member = personType === 'member' ? members.find((x) => x.id === personId) : undefined;
  const visitor = personType === 'visitor' ? visitors.find((x) => x.id === personId) : undefined;
  const name = member ? `${member.first_name} ${member.last_name}` : visitor ? visitor.full_name : 'Attendee';

  const newRecord: AttendanceRecord = {
    id: `att-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    service_id: serviceId,
    service_name: serviceName,
    date: targetDate,
    member_id: personType === 'member' ? personId : undefined,
    member_name: member ? `${member.first_name} ${member.last_name}` : undefined,
    visitor_id: personType === 'visitor' ? personId : undefined,
    visitor_name: visitor ? visitor.full_name : undefined,
    person_name: name,
    check_in_time: new Date().toISOString(),
    check_in_method: method,
    status: 'present',
  };

  setAttendance((prev) => [newRecord, ...prev]);
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
  const serviceName = targetService ? targetService.name : 'Worship Service';
  const newRecords: AttendanceRecord[] = [];
  let skipped = 0;

  items.forEach((item) => {
    const exists = attendance.some(
      (a) =>
        a.service_id === serviceId &&
        a.date === date &&
        ((item.personType === 'member' && a.member_id === item.personId) ||
          (item.personType === 'visitor' && a.visitor_id === item.personId))
    );
    if (exists) {
      skipped++;
      return;
    }

    const member = item.personType === 'member' ? members.find((x) => x.id === item.personId) : undefined;
    const visitor = item.personType === 'visitor' ? visitors.find((x) => x.id === item.personId) : undefined;
    const name = member ? `${member.first_name} ${member.last_name}` : visitor ? visitor.full_name : 'Attendee';

    const rec: AttendanceRecord = {
      id: `att-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      service_id: serviceId,
      service_name: serviceName,
      date,
      member_id: item.personType === 'member' ? item.personId : undefined,
      member_name: member ? `${member.first_name} ${member.last_name}` : undefined,
      visitor_id: item.personType === 'visitor' ? item.personId : undefined,
      visitor_name: visitor ? visitor.full_name : undefined,
      person_name: name,
      check_in_time: new Date().toISOString(),
      check_in_method: item.method || 'manual',
      status: 'present',
    };
    newRecords.push(rec);
  });

  if (newRecords.length > 0) {
    setAttendance((prev) => [...newRecords, ...prev]);
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
  const existingIndex = headcounts.findIndex((h) => h.service_id === data.service_id && h.date === data.date);
  const newRecord: HeadcountRecord = {
    ...data,
    id: existingIndex >= 0 ? headcounts[existingIndex].id : `hc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    created_at:
      existingIndex >= 0 && headcounts[existingIndex].created_at
        ? headcounts[existingIndex].created_at
        : new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    setHeadcounts((prev) => prev.map((h, i) => (i === existingIndex ? newRecord : h)));
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
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  setHeadcounts((prev) =>
    prev.map((h) => {
      if (h.id === id) {
        const updated = { ...h, ...updates };
        logAction('UPDATE_HEADCOUNT', 'Attendance', `Updated headcount record ${id}`, id);
        dbSyncUpsert('headcounts', updated);
        return updated;
      }
      return h;
    })
  );
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
