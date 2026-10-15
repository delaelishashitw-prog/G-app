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
    id: crypto.randomUUID(),
    status: 'draft',
    sent_at: new Date().toISOString(),
    created_by: data.sender_id,
  };

  setCommunications((prev) => [newRecord, ...prev]);
  logAction(
    'SAVE_COMMUNICATION_DRAFT',
    'Communication',
    `Prepared ${data.channel.toUpperCase()} draft for ${data.recipient_count} intended recipients (${data.title}); no delivery requested`,
    newRecord.id
  );
  dbSyncUpsert('communications', newRecord);
  return newRecord;
}
