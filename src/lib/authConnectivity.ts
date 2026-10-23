import type {Session} from '@supabase/supabase-js';

/** Only transport failures can preserve an already verified, unexpired session. */
export function isTemporaryAuthFailure(error: unknown): boolean {
  const cause=error as {status?:number;name?:string;message?:string};
  if(cause?.status===401||cause?.status===403)return false;
  return cause?.status===0||cause?.status===408||cause?.status===429||Boolean(cause?.status&&cause.status>=500)
    ||cause?.name==='AuthRetryableFetchError'
    ||/failed to fetch|fetch failed|networkerror|network request failed|load failed|timed? out|timeout/i.test(cause?.message||'');
}
export function verifiedSessionExpiresAt(session:Session|null):number {
  if(!session||!Number.isFinite(session.expires_at))return 0;
  let expiry=session.expires_at!;
  try{
    const payload=JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    if(!Number.isFinite(payload.exp))return 0;
    expiry=Math.min(expiry,payload.exp);
  }catch{return 0;}
  return expiry*1000;
}
export const unexpiredVerifiedSession=(session:Session|null)=>verifiedSessionExpiresAt(session)>Date.now();
export function authRequestError(error:{message:string},status?:number):Error {
  return Object.assign(new Error(error.message),error,status===undefined?{}:{status});
}
