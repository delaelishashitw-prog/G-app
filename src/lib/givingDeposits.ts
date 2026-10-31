import { getSupabaseClient } from './supabase';
import type { ChurchFinanceRecord } from '../types/database.types';
export interface GivingDepositLink {giving_id:string;finance_id:string;amount:number;active:boolean;linked_by_name:string;linked_at:string}
export interface GivingDepositRequest {p_operation_id:string;p_receipts:{id:string;updated_at:string}[];p_account_id:string;p_date:string;p_payment_method:string;p_reference:string;p_existing_finance_id:string|null;p_expected_updated_at:string|null}
function client() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Connect to the internet to review or post Giving deposits.');
  const value = getSupabaseClient(); if (!value) throw new Error('Connect to the church database before posting Giving deposits.'); return value;
}
export async function loadGivingDepositLinks():Promise<GivingDepositLink[]> {
  const {data,error}=await client().rpc('gwcc_giving_deposit_links');
  if(error)throw new Error(error.message);
  if(!Array.isArray(data))throw new Error('Giving deposit links could not be verified.');
  return data;
}
export async function postGivingDeposit(request:GivingDepositRequest):Promise<ChurchFinanceRecord> {
  const {data,error}=await client().rpc('gwcc_post_giving_deposit',request);
  if(error)throw new Error(error.message);
  if(!data?.id || !(Number(data.giving_deposit_amount)>0))throw new Error('Deposit confirmation could not be verified. Refresh before trying again.');
  return data;
}
