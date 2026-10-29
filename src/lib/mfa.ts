import type {SupabaseClient} from '@supabase/supabase-js';
import {USER_ROLES} from './authPolicy';
import type {UserRole} from '../types/database.types';
import {authRequestError} from './authConnectivity';

export type SecurityStatus={role:UserRole;required:boolean;verified_factors:number;satisfied:boolean};
export async function readSecurityStatus(client:SupabaseClient,role:UserRole):Promise<SecurityStatus>{
  const {data,error,status}=await client.rpc('gwcc_security_status');
  if(error)throw authRequestError({...error,message:`Account security could not be checked. ${error.message}`},status);
  if(!data || data.role!==role || typeof data.required!=='boolean' || typeof data.satisfied!=='boolean'
    || !Number.isInteger(data.verified_factors) || data.verified_factors<0 || !USER_ROLES.includes(data.role)){
    throw new Error('Account security could not be checked. Please reconnect and try again.');
  }
  if((['super_admin','senior_pastor','administrator','finance_officer','welfare_officer'].includes(role)||data.verified_factors>0) && !data.required){
    throw new Error('The account security policy needs an administrator review.');
  }
  return data;
}
export const validMfaCode=(code:string)=>/^\d{6}$/.test(code);
export const mfaError=(error:unknown)=>{
  const message=error instanceof Error?error.message:String((error as {message?:string})?.message||'');
  if(/invalid|expired|verification failed|challenge.*not found/i.test(message))return 'That code was not accepted. Use the latest code from your authenticator and check that your phone’s clock is automatic.';
  if(/rate|too many/i.test(message))return 'Too many attempts. Wait a moment before trying again.';
  if(/friendly.*name|already exists/i.test(message))return 'Choose a different name for this authenticator.';
  if(/aal2|insufficient.*aal/i.test(message))return 'Verify your existing authenticator before changing devices.';
  return 'The authenticator request could not be completed. Check your connection and try again.';
};
