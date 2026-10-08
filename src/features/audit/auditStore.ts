import type { Dispatch, SetStateAction } from 'react';
import type { AuditLog } from '../../types/database.types';

export function logAction(
  action: string,
  module: string,
  details: string,
  recordId: string | undefined,
  currentUser: { first_name: string; last_name: string; role: string },
  setAuditLogs: Dispatch<SetStateAction<AuditLog[]>>,
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  const newLog: AuditLog = {
    id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    user_name: `${currentUser.first_name} ${currentUser.last_name}`,
    user_role: currentUser.role.replace('_', ' ').toUpperCase(),
    action,
    module,
    record_id: recordId,
    details,
    timestamp: new Date().toISOString(),
  };

  setAuditLogs((prev) => [newLog, ...prev]);
  dbSyncUpsert('audit_logs', newLog);
}
