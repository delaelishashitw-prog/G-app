import type { Dispatch, SetStateAction } from 'react';
import type { CommunicationRecord } from '../../types/database.types';

export function sendSMSMessage(
  data: Omit<CommunicationRecord, 'id' | 'sent_at'>,
  setCommunications: Dispatch<SetStateAction<CommunicationRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
): CommunicationRecord {
  const newRecord: CommunicationRecord = {
    ...data,
    id: `com-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    sent_at: new Date().toISOString(),
    created_by: data.sender_id,
  };

  setCommunications((prev) => [newRecord, ...prev]);
  logAction(
    'SEND_COMMUNICATION',
    'Communication',
    `Sent ${data.channel.toUpperCase()} to ${data.recipient_count} recipients (${data.title})`,
    newRecord.id
  );
  dbSyncUpsert('communications', newRecord);
  return newRecord;
}
