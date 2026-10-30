import type { ChildCheckInRecord } from '../../types/database.types';
import type { SyncResult } from '../../lib/syncOutbox';
import { createPickupToken, findPickup } from '../../lib/childSafety';

export type ChildInput = Omit<ChildCheckInRecord, 'id' | 'security_code' | 'created_at' | 'status'>;
interface ChildWriter {
  pending: () => ChildCheckInRecord[];
  persist: (record: ChildCheckInRecord) => Promise<SyncResult>;
  retry: () => Promise<SyncResult>;
  flush: () => Promise<SyncResult>;
  current: () => boolean;
}
const intentFields = ['child_name', 'age_group', 'class_room', 'service_id', 'date', 'parent_name',
  'parent_phone', 'parent_member_id', 'alternate_pickup_name', 'alternate_pickup_phone',
  'allergies_medical_notes', 'has_allergy_alert', 'special_instructions'] as const;
const sameCheckIn = (row: ChildCheckInRecord, input: ChildInput) =>
  intentFields.every(key => (row[key] ?? '') === (input[key] ?? ''));
function requireCurrent(writer: ChildWriter) {
  if (!writer.current()) throw new Error('The signed-in account changed. Reopen child safety.');
}
async function confirm(record: ChildCheckInRecord, retained: boolean, writer: ChildWriter) {
  requireCurrent(writer);
  const admission = retained ? await writer.retry() : await writer.persist(record);
  if (!admission.durable) throw new Error(admission.error || 'This device could not preserve the check-in. Keep this form open and retry.');
  requireCurrent(writer);
  const confirmation = await writer.flush();
  if (!confirmation.success) throw new Error(confirmation.error || 'Awaiting cloud confirmation. Retry this form or use Retry sync before issuing a pass or releasing the child.');
  requireCurrent(writer);
  return record;
}
export async function saveChildCheckIn(input: ChildInput, requestId: string, records: ChildCheckInRecord[], writer: ChildWriter) {
  requireCurrent(writer);
  const pending = writer.pending();
  // Reopening a failed form also resumes the original exact intent.
  const retained = pending.find(row => row.id === requestId) || pending.find(row => row.status === 'checked_in' && sameCheckIn(row, input));
  if (retained && (retained.status !== 'checked_in' || !sameCheckIn(retained, input)))
    throw new Error('This check-in is awaiting confirmation with different details. Restore its original details or use Retry sync first.');
  const confirmed = records.find(row => row.id === requestId);
  if (!retained && confirmed) {
    if (confirmed.status !== 'checked_in' || !sameCheckIn(confirmed, input)) throw new Error('This check-in is already confirmed. Open its saved record to review it.');
    return confirmed;
  }
  const record = retained || { ...input, id: requestId, security_code: createPickupToken([...records, ...pending]),
    status: 'checked_in' as const, created_at: new Date().toISOString() };
  return confirm(record, Boolean(retained), writer);
}
export async function saveChildCheckout(current: ChildCheckInRecord, collector: string, leader: string, records: ChildCheckInRecord[], writer: ChildWriter) {
  requireCurrent(writer);
  findPickup(records, current.security_code, collector);
  const retained = writer.pending().find(row => row.id === current.id);
  if (retained && (retained.status !== 'checked_out' || retained.checked_out_to_person !== collector.trim()))
    throw new Error('This child has another change awaiting confirmation. Use Retry sync and refresh before pickup.');
  const record = retained || { ...current, status: 'checked_out' as const, checked_out_to_person: collector.trim(),
    verified_by_leader: leader, check_out_time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Accra' }) };
  return confirm(record, Boolean(retained), writer);
}
