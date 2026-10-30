import type { ChildCheckInRecord, ChurchService } from '../../types/database.types';
import { getChurchDateString, isValidDateString } from '../../lib/attendanceDateUtils';

/** Pickup passes are bound to exactly the selected service and Ghana calendar date. */
export function childSessionRecord(
  record: ChildCheckInRecord | null | undefined,
  serviceId: string,
  date: string,
): ChildCheckInRecord | null {
  return record?.service_id === serviceId && record.date === date ? record : null;
}

export function childSessionRecords(
  records: readonly ChildCheckInRecord[],
  serviceId: string,
  date: string,
): ChildCheckInRecord[] {
  return records.filter(record => childSessionRecord(record, serviceId, date) !== null);
}

/** Never silently file a new safety tag against a different service or past session. */
export function childSessionActionError(
  service: Pick<ChurchService, 'id' | 'is_active'> | undefined,
  serviceId: string,
  date: string,
  today = getChurchDateString(),
): string | null {
  if (!serviceId || !service || service.id !== serviceId || service.is_active !== true) {
    return 'Select an active service before checking in or releasing a child.';
  }
  if (!isValidDateString(date) || date !== today) {
    return "Child check-in and pickup must use today's service date in Ghana. Select Today on Attendance to continue.";
  }
  return null;
}

export function canPrintChildPickupPass(
  record: ChildCheckInRecord | null | undefined,
  serviceId: string,
  date: string,
  today = getChurchDateString(),
): boolean {
  return !!childSessionRecord(record, serviceId, date) && record?.status === 'checked_in' && date === today;
}
