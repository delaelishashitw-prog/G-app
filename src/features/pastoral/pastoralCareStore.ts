import type { Dispatch, SetStateAction } from 'react';
import type {
  IntercessoryWatchSlot,
  Member,
  PastoralCareRecord,
  PastoralCounselingSession,
  PastoralVisitationRecord,
  PrayerRequest,
} from '../../types/database.types';

export function addPastoralCare(
  data: Omit<PastoralCareRecord, 'id' | 'created_at'>,
  members: Member[],
  setPastoralCare: Dispatch<SetStateAction<PastoralCareRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
): PastoralCareRecord {
  const newRecord: PastoralCareRecord = {
    ...data,
    id: `care-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    created_at: new Date().toISOString(),
  };

  setPastoralCare((prev) => [newRecord, ...prev]);
  const member = members.find((item) => item.id === data.member_id);
  const memberName = member ? `${member.first_name} ${member.last_name}` : 'Member';
  logAction('RECORD_PASTORAL_CARE', 'Pastoral Care', `Logged ${data.care_type} visit/session with ${memberName}`, newRecord.id);
  dbSyncUpsert('pastoral_care', newRecord);
  return newRecord;
}

export function addPastoralCareLog(
  data: Omit<PastoralCareRecord, 'id' | 'created_at'>,
  members: Member[],
  setPastoralCare: Dispatch<SetStateAction<PastoralCareRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
): PastoralCareRecord {
  return addPastoralCare(data, members, setPastoralCare, logAction, dbSyncUpsert);
}

export function updatePastoralCareLog(
  id: string,
  updates: Partial<PastoralCareRecord>,
  setPastoralCare: Dispatch<SetStateAction<PastoralCareRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  setPastoralCare((prev) =>
    prev.map((care) => {
      if (care.id === id) {
        const updated = { ...care, ...updates };
        logAction('UPDATE_PASTORAL_CARE', 'Pastoral Care', `Updated pastoral care record for ${care.member_name}`, id);
        dbSyncUpsert('pastoral_care', updated);
        return updated;
      }
      return care;
    })
  );
}

export function deletePastoralCareLog(
  id: string,
  setPastoralCare: Dispatch<SetStateAction<PastoralCareRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncDelete: (table: string, id: string) => void
) {
  setPastoralCare((prev) => prev.filter((care) => care.id !== id));
  logAction('DELETE_PASTORAL_CARE', 'Pastoral Care', `Deleted pastoral record`, id);
  dbSyncDelete('pastoral_care', id);
}

export function addPrayerRequest(
  data: Omit<PrayerRequest, 'id' | 'created_at'>,
  setPrayerRequests: Dispatch<SetStateAction<PrayerRequest[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
): PrayerRequest {
  const newRecord: PrayerRequest = {
    ...data,
    id: `pray-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    created_at: new Date().toISOString(),
  };

  setPrayerRequests((prev) => [newRecord, ...prev]);
  logAction('ADD_PRAYER_REQUEST', 'Prayer Requests', `Received prayer petition from ${data.requester_name} (${data.category})`, newRecord.id);
  dbSyncUpsert('prayer_requests', newRecord);
  return newRecord;
}

export function updatePrayerStatus(
  id: string,
  status: PrayerRequest['status'],
  testimony: string | undefined,
  setPrayerRequests: Dispatch<SetStateAction<PrayerRequest[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  setPrayerRequests((prev) =>
    prev.map((request) => {
      if (request.id === id) {
        const updated = {
          ...request,
          status,
          testimony: testimony !== undefined ? testimony : request.testimony,
        };
        logAction('UPDATE_PRAYER_STATUS', 'Prayer Requests', `Prayer request status changed to ${status}`, id);
        dbSyncUpsert('prayer_requests', updated);
        return updated;
      }
      return request;
    })
  );
}

export function deletePrayerRequest(
  id: string,
  setPrayerRequests: Dispatch<SetStateAction<PrayerRequest[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncDelete: (table: string, id: string) => void
) {
  setPrayerRequests((prev) => prev.filter((request) => request.id !== id));
  logAction('DELETE_PRAYER_REQUEST', 'Prayer Requests', `Deleted prayer request`, id);
  dbSyncDelete('prayer_requests', id);
}

export function addPastoralVisitation(
  data: Omit<PastoralVisitationRecord, 'id' | 'created_at'>,
  setPastoralVisitations: Dispatch<SetStateAction<PastoralVisitationRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
): PastoralVisitationRecord {
  const newRecord: PastoralVisitationRecord = {
    ...data,
    id: `vis-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    created_at: new Date().toISOString(),
  };

  setPastoralVisitations((prev) => [newRecord, ...prev]);
  logAction('RECORD_VISITATION', 'Pastoral Care', `Logged ${data.visitation_type.replace('_', ' ')} to ${data.member_name} at ${data.location}`, newRecord.id);
  dbSyncUpsert('pastoral_visitations', newRecord);
  return newRecord;
}

export function updatePastoralVisitation(
  id: string,
  updates: Partial<PastoralVisitationRecord>,
  setPastoralVisitations: Dispatch<SetStateAction<PastoralVisitationRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  setPastoralVisitations((prev) =>
    prev.map((visit) => {
      if (visit.id === id) {
        const updated = { ...visit, ...updates };
        logAction('UPDATE_VISITATION', 'Pastoral Care', `Updated visitation for ${visit.member_name} (${updated.status})`, id);
        dbSyncUpsert('pastoral_visitations', updated);
        return updated;
      }
      return visit;
    })
  );
}

export function deletePastoralVisitation(
  id: string,
  setPastoralVisitations: Dispatch<SetStateAction<PastoralVisitationRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncDelete: (table: string, id: string) => void
) {
  setPastoralVisitations((prev) => prev.filter((visit) => visit.id !== id));
  logAction('DELETE_VISITATION', 'Pastoral Care', `Deleted visitation record`, id);
  dbSyncDelete('pastoral_visitations', id);
}

export function addCounselingSession(
  session: Omit<PastoralCounselingSession, 'id' | 'created_at'>,
  setCounselingSessions: Dispatch<SetStateAction<PastoralCounselingSession[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
): PastoralCounselingSession {
  const newSession: PastoralCounselingSession = {
    ...session,
    id: `coun-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    created_at: new Date().toISOString(),
  };

  setCounselingSessions((prev) => [newSession, ...prev]);
  logAction('SCHEDULE_COUNSELING', 'Pastoral Care', `Logged counseling session #${session.session_number} with ${session.member_name}`, newSession.id);
  dbSyncUpsert('pastoral_counseling', newSession);
  return newSession;
}

export function updateCounselingSession(
  id: string,
  updates: Partial<PastoralCounselingSession>,
  setCounselingSessions: Dispatch<SetStateAction<PastoralCounselingSession[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  setCounselingSessions((prev) =>
    prev.map((session) => {
      if (session.id === id) {
        const updated = { ...session, ...updates };
        logAction('UPDATE_COUNSELING', 'Pastoral Care', `Updated counseling session for ${session.member_name}`, id);
        dbSyncUpsert('pastoral_counseling', updated);
        return updated;
      }
      return session;
    })
  );
}

export function deleteCounselingSession(
  id: string,
  setCounselingSessions: Dispatch<SetStateAction<PastoralCounselingSession[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncDelete: (table: string, id: string) => void
) {
  setCounselingSessions((prev) => prev.filter((session) => session.id !== id));
  logAction('DELETE_COUNSELING', 'Pastoral Care', `Deleted counseling session`, id);
  dbSyncDelete('pastoral_counseling', id);
}

export function addIntercessorySlot(
  slot: Omit<IntercessoryWatchSlot, 'id' | 'created_at'>,
  setIntercessorySlots: Dispatch<SetStateAction<IntercessoryWatchSlot[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
): IntercessoryWatchSlot {
  const newSlot: IntercessoryWatchSlot = {
    ...slot,
    id: `watch-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    created_at: new Date().toISOString(),
  };

  setIntercessorySlots((prev) => [newSlot, ...prev]);
  logAction('ADD_INTERCESSORY_SLOT', 'Pastoral Care', `Assigned ${slot.intercessor_name} to ${slot.watch_name} on ${slot.day_of_week}`, newSlot.id);
  dbSyncUpsert('intercessory_slots', newSlot);
  return newSlot;
}

export function updateIntercessorySlot(
  id: string,
  updates: Partial<IntercessoryWatchSlot>,
  setIntercessorySlots: Dispatch<SetStateAction<IntercessoryWatchSlot[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  setIntercessorySlots((prev) =>
    prev.map((slot) => {
      if (slot.id === id) {
        const updated = { ...slot, ...updates };
        logAction('UPDATE_INTERCESSORY_SLOT', 'Pastoral Care', `Updated watch slot for ${slot.intercessor_name}`, id);
        dbSyncUpsert('intercessory_slots', updated);
        return updated;
      }
      return slot;
    })
  );
}

export function deleteIntercessorySlot(
  id: string,
  setIntercessorySlots: Dispatch<SetStateAction<IntercessoryWatchSlot[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncDelete: (table: string, id: string) => void
) {
  setIntercessorySlots((prev) => prev.filter((slot) => slot.id !== id));
  logAction('DELETE_INTERCESSORY_SLOT', 'Pastoral Care', `Removed intercessory watch assignment`, id);
  dbSyncDelete('intercessory_slots', id);
}
