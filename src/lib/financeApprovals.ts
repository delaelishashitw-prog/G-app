import type { ChurchFinanceRecord } from '../types/database.types';
import {getSupabaseClient} from './supabase';
export type FinanceApprovalAction='approve'|'reject'|'cancel'|'paid'|'void';
export const financeApprovalLabel=(row:Pick<ChurchFinanceRecord,'approval_state'|'status'>)=>row.approval_state?({requested:'Awaiting approval',approved:'Approved · awaiting payment',rejected:'Rejected',cancelled:'Cancelled',paid:'Paid',voided:'Voided'}[row.approval_state]):row.status==='completed'?'Historical entry':row.status;
export const isOutbound=(row:Pick<ChurchFinanceRecord,'transaction_type'>)=>['expense','disbursement','transfer'].includes(row.transaction_type);
export const verifiedApprover=(row:ChurchFinanceRecord)=>row.approval_state?(row.approved_by_id?row.approved_by||'Approved staff account':'Awaiting independent approval'):(row.approved_by?`${row.approved_by} (historical entry)`:'No approval recorded');
export interface FinanceActionRequest {p_operation_id:string;p_finance_id:string;p_expected_updated_at:string;p_action:FinanceApprovalAction;p_reason:string;p_payment_reference:string}
export async function performFinanceAction(request:FinanceActionRequest):Promise<ChurchFinanceRecord>{
  if(typeof navigator!=='undefined'&&!navigator.onLine)throw new Error('Connect to the internet to confirm this action.');
  const client=getSupabaseClient();if(!client)throw new Error('Connect to Supabase before reviewing payments.');
  const {data,error}=await client.rpc('gwcc_finance_approval_action',request);
  if(error)throw new Error(error.message);
  if(!data||data.id!==request.p_finance_id||!Array.isArray(data.approval_history))throw new Error('Payment confirmation could not be verified. Refresh the request before continuing.');
  return data as ChurchFinanceRecord;
}
