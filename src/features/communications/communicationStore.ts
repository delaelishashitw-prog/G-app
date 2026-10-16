import type {Dispatch,SetStateAction} from 'react';
import type {CommunicationRecord} from '../../types/database.types';
import type {SyncResult} from '../../lib/syncOutbox';
import {validateCommunicationDraft,type DraftInput} from '../../lib/communicationUtils';
type Setter=Dispatch<SetStateAction<CommunicationRecord[]>>;
type Sync=(table:string,record:unknown)=>Promise<SyncResult>;
type Logger=(action:string,module:string,details:string,id?:string)=>void;

async function persist(record:CommunicationRecord,records:CommunicationRecord[],set:Setter,sync:Sync,log:Logger,action:string) {
  set([record,...records.filter(row=>row.id!==record.id)]);
  const result=await sync('communications',record);
  if(!result.durable)throw new Error(result.error||'This change is only in memory. Keep this tab open and export pending changes before reloading.');
  log(action,'Communication',`Saved draft ${record.title}; no message sent or scheduled`,record.id);
  return record;
}
export async function saveCommunicationDraft(data:DraftInput,records:CommunicationRecord[],set:Setter,log:Logger,sync:Sync):Promise<CommunicationRecord> {
  validateCommunicationDraft(data);
  const existing=records.find(row=>row.id===data.id);
  if(existing&&existing.status!=='draft')throw new Error('Copy this historical message to a new draft instead of changing its record.');
  const now=new Date().toISOString();
  const record={...existing,...data,id:data.id||crypto.randomUUID(),title:data.title.trim(),message:data.message.trim(),sender_id:data.sender_id.trim(),status:'draft' as const,
    sent_at:existing?.sent_at||now,created_at:existing?.created_at||existing?.sent_at||now,created_by:existing?.created_by||data.created_by,
    updated_at:existing?.updated_at||null,archived_at:null,_sync_status:'pending' as const,_expected_updated_at:existing?.updated_at||undefined};
  return persist(record,records,set,sync,log,existing?'UPDATE_COMMUNICATION_DRAFT':'SAVE_COMMUNICATION_DRAFT');
}
export async function archiveCommunicationDraft(id:string,archived:boolean,records:CommunicationRecord[],set:Setter,log:Logger,sync:Sync) {
  const existing=records.find(row=>row.id===id);
  if(!existing||existing.status!=='draft')throw new Error('Choose a saved draft.');
  const record={...existing,archived_at:archived?new Date().toISOString():null,_sync_status:'pending' as const,_expected_updated_at:existing.updated_at||undefined};
  return persist(record,records,set,sync,log,archived?'ARCHIVE_COMMUNICATION_DRAFT':'RESTORE_COMMUNICATION_DRAFT');
}
