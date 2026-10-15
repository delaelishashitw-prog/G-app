import type { ChildCheckInRecord } from '../types/database.types';

export function createPickupToken(existing: Pick<ChildCheckInRecord,'security_code'|'status'>[]): string {
  for(let attempt=0;attempt<10;attempt++) {
    const token=`GWCC-${crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase()}`;
    if(!existing.some(row=>row.status==='checked_in' && row.security_code===token))return token;
  }
  throw new Error('Could not generate a unique pickup token. Try again.');
}
export function findPickup(records: ChildCheckInRecord[],code:string,collector:string) {
  const matches=records.filter(row=>row.status==='checked_in' && row.security_code.toUpperCase()===code.trim().toUpperCase());
  if(matches.length!==1)throw new Error(matches.length?'This tag is ambiguous. Ask the ministry leader to verify the records.':'No active check-in matches this tag.');
  const record=matches[0]; const name=collector.trim().toLocaleLowerCase();
  if(!name || ![record.parent_name,record.alternate_pickup_name].some(value=>value?.trim().toLocaleLowerCase()===name))throw new Error('Enter the name of the parent or authorized pickup person recorded at check-in.');
  return record;
}
