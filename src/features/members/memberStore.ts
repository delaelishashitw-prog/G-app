import type { Dispatch, SetStateAction } from 'react';
import type { Member } from '../../types/database.types';
import { requireConfirmedMember } from './memberRules';

export type MemberInput = Omit<Member, 'id' | 'member_id' | 'created_at' | 'updated_at'>;
export interface MemberWriter {
  members: Member[];
  setMembers: Dispatch<SetStateAction<Member[]>>;
  persist: (records: Array<{table: string; record: unknown}>) => Promise<{durable?: boolean; error?: string}>;
  isCurrent: () => boolean;
  pending?: (id:string) => Member | undefined;
  retryPending?: () => Promise<{durable?: boolean; error?: string}>;
  normalize?: (member:Member) => Member;
  log: (action: string, module: string, details: string, recordId?: string) => void;
}

function validateContact(data: Partial<Member>) {
  for (const key of ['first_name', 'last_name'] as const)
    if (key in data && !data[key]?.trim()) throw new Error('First name and last name are required.');
  if ('phone' in data && (data.phone || '').replace(/[^0-9]/g, '').length < 9)
    throw new Error('Enter a valid phone number before saving.');
}

function sameIntent(a:Record<string,unknown>,b:Record<string,unknown>) {
  const ignored=new Set(['id','member_id','created_at','updated_at','_expected_updated_at','_sync_status']);
  return [...new Set([...Object.keys(a),...Object.keys(b)])].every(key=>ignored.has(key)||JSON.stringify(a[key]??null)===JSON.stringify(b[key]??null));
}
function changeBase(id:string,writer:MemberWriter,version?:string):Member {
  const row=writer.members.find(item=>item.id===id);
  if(row?._sync_status==='pending'){
    const retained=writer.pending?.(id);
    if(retained)return retained;
  }
  return requireConfirmedMember(row,version);
}
async function preserve(rows: Member[], previous: Member[], writer: MemberWriter) {
  const versions = new Map(previous.map(row => [row.id, row.updated_at]));
  const retained=rows.map(row=>writer.pending?.(row.id));
  let result:{durable?:boolean;error?:string};
  if(retained.some(Boolean)){
    if(!writer.retryPending || retained.some((row,index)=>!row||!sameIntent((writer.normalize?.(rows[index]) || rows[index]) as unknown as Record<string,unknown>,row as unknown as Record<string,unknown>)))
      throw new Error('An earlier change is still awaiting confirmation. Keep your edits and use Retry sync before saving different details.');
    result=await writer.retryPending();
    rows=retained as Member[];
  }else result = await writer.persist(rows.map(row => ({
    table: 'members',
    record: {...row, ...(versions.has(row.id) ? {_expected_updated_at: versions.get(row.id)} : {})},
  })));
  if (!result.durable) throw new Error(result.error || 'This device could not preserve the change. Keep the form open and retry.');
  if (!writer.isCurrent()) throw new Error('The signed-in account changed. The saved change remains with its original account.');
  const pending = rows.map(row => ({...row, _sync_status: 'pending' as const}));
  const byId = new Map(pending.map(row => [row.id, row]));
  // The updater has no storage or audit side effects, including under StrictMode.
  writer.setMembers(current => {
    const ids=new Set(current.map(row=>row.id));
    return [...pending.filter(row=>!ids.has(row.id)),...current.map(row=>byId.get(row.id)||row)];
  });
  return pending;
}

export async function addMember(data: MemberInput, writer: MemberWriter, requestId:string=crypto.randomUUID()): Promise<Member> {
  validateContact(data);
  const existing=writer.members.find(row=>row.id===requestId);
  if(existing && existing._sync_status!=='pending'){
    const comparable={...existing,tithe_number:data.tithe_number||existing.tithe_number};
    const intent={...data,tithe_number:data.tithe_number||existing.tithe_number};
    if(!Object.keys(intent).every(key=>['id','created_at','updated_at','_sync_status'].includes(key)||sameIntent({[key]:intent[key as keyof typeof intent]},{[key]:comparable[key as keyof typeof comparable]})))
      throw new Error('This registration is already confirmed. Open its member profile to change the details.');
    return existing;
  }
  const now = new Date().toISOString();
  const row: Member = {...data, id: requestId, member_id: `PENDING-${requestId}`,
    tithe_number: data.tithe_number?.trim() || `PENDING-${requestId}`, created_at: now, updated_at: now};
  const [pending] = await preserve([row], [], writer);
  writer.log('CREATE_MEMBER', 'Members', `Queued registration for ${row.first_name} ${row.last_name}`, row.id);
  return pending;
}

export async function updateMember(id: string, updates: Partial<Member>, writer: MemberWriter, expectedVersion?: string): Promise<Member> {
  validateContact(updates);
  const previous = changeBase(id,writer,expectedVersion);
  const row: Member = {...previous, ...updates, id: previous.id, member_id: previous.member_id, auth_user_id: previous.auth_user_id,
    created_at: previous.created_at, updated_at: new Date().toISOString()};
  const [pending] = await preserve([row], [previous], writer);
  writer.log('UPDATE_MEMBER', 'Members', `Queued profile update for ${row.first_name} ${row.last_name}`, id);
  return pending;
}

export async function bulkUpdateMembers(ids: string[], updates: Partial<Member>, writer: MemberWriter): Promise<Member[]> {
  validateContact(updates);
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) throw new Error('Select at least one member.');
  const previous = uniqueIds.map(id => changeBase(id,writer));
  const now = new Date().toISOString();
  const rows = previous.map(row => ({...row, ...updates, id: row.id, member_id: row.member_id, auth_user_id: row.auth_user_id, created_at: row.created_at, updated_at: now}));
  const pending = await preserve(rows, previous, writer);
  writer.log('BULK_UPDATE_MEMBERS', 'Members', `Queued an update for ${rows.length} selected members`);
  return pending;
}

export const archiveMember = (id: string, writer: MemberWriter, version?: string) =>
  updateMember(id, {is_archived: true}, writer, version);
export const unarchiveMember = (id: string, writer: MemberWriter, version?: string) =>
  updateMember(id, {is_archived: false}, writer, version);
export const getMember = (members: Member[], id: string) => members.find(row => row.id === id);
