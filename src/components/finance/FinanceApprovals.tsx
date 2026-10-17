import React,{useEffect,useRef,useState} from 'react';
import {RefreshCw,ShieldCheck,X} from 'lucide-react';
import {useChurchData} from '../../contexts/ChurchDataContext';
import {useAuth} from '../../contexts/AuthContext';
import {useToast} from '../../contexts/ToastContext';
import {formatGHS} from '../../lib/currencyUtils';
import {financeReference} from '../../lib/financeViewUtils';
import {financeApprovalLabel,performFinanceAction,type FinanceApprovalAction,type FinanceActionRequest} from '../../lib/financeApprovals';
import type {ChurchFinanceRecord} from '../../types/database.types';
import {PaymentVoucherModal} from './PaymentVoucherModal';

const actionLabels:Record<FinanceApprovalAction,string>={approve:'Approve request',reject:'Reject request',cancel:'Cancel request',paid:'Record payment as paid',void:'Void payment'};
const dateTime=(value?:string|null)=>value?new Date(value).toLocaleString('en-GB',{timeZone:'Africa/Accra'})+' GMT':'Not recorded';
export function FinanceApprovals(){
  const {churchFinances,refreshData,settings}=useChurchData();const {currentUser}=useAuth();const {success,error:toastError}=useToast();
  const [showAll,setShowAll]=useState(false),[busy,setBusy]=useState(false),[selection,setSelection]=useState<{row:ChurchFinanceRecord;action:FinanceApprovalAction}|null>(null);
  const [reason,setReason]=useState(''),[reference,setReference]=useState(''),[reviewed,setReviewed]=useState(false),[problem,setProblem]=useState('');
  const [confirmed,setConfirmed]=useState<Record<string,ChurchFinanceRecord>>({}),[voucher,setVoucher]=useState<ChurchFinanceRecord|null>(null);
  const dialog=useRef<HTMLFormElement>(null);
  const owner=useRef(currentUser.id);owner.current=currentUser.id;
  const alive=useRef(true),locked=useRef(false),operation=useRef<{key:string;request:FinanceActionRequest}|null>(null);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[currentUser.id]);
  useEffect(()=>{
    if(!selection)return;const previous=document.activeElement as HTMLElement|null;dialog.current?.querySelector<HTMLElement>('button')?.focus();
    const keydown=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!locked.current){setSelection(null);return;}if(event.key!=='Tab')return;const fields=[...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex="0"]')||[])];if(!fields.length)return;const first=fields[0],last=fields.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}};
    document.addEventListener('keydown',keydown);return()=>{document.removeEventListener('keydown',keydown);previous?.focus();};
  },[selection]);
  const rows=churchFinances.map(row=>confirmed[row.id]&&new Date(confirmed[row.id].updated_at||0)>new Date(row.updated_at||0)?confirmed[row.id]:row).filter(row=>row.approval_state)
    .filter(row=>showAll||['requested','approved'].includes(row.approval_state!)).sort((a,b)=>(b.requested_at||b.created_at).localeCompare(a.requested_at||a.created_at));
  const senior=['super_admin','senior_pastor'].includes(currentUser.role),finance=senior||currentUser.role==='finance_officer';
  const open=(row:ChurchFinanceRecord,action:FinanceApprovalAction)=>{setSelection({row,action});setReason('');setReference('');setReviewed(false);setProblem('');operation.current=null;};
  const refresh=async()=>{if(locked.current)return;const actor=currentUser.id;locked.current=true;setBusy(true);try{const result=await refreshData();if(alive.current&&owner.current===actor&&!result.success)toastError('Refresh incomplete',result.message);}catch(cause){if(alive.current&&owner.current===actor)toastError('Refresh incomplete',(cause as Error).message);}finally{locked.current=false;if(alive.current&&owner.current===actor)setBusy(false);}};
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();if(locked.current||!selection||!reviewed)return;
    const actor=currentUser.id;const {row,action}=selection;if(row._sync_status==='pending'||!row.updated_at){setProblem('Wait for cloud confirmation before reviewing this request.');return;}
    const input={p_finance_id:row.id,p_expected_updated_at:row.updated_at,p_action:action,p_reason:reason.trim(),p_payment_reference:reference.trim()};
    const key=JSON.stringify(input);if(operation.current?.key!==key)operation.current={key,request:{...input,p_operation_id:crypto.randomUUID()}};
    locked.current=true;setBusy(true);setProblem('');
    try{
      const saved=await performFinanceAction(operation.current.request);if(!alive.current||owner.current!==actor)return;
      setConfirmed(prev=>({...prev,[saved.id]:saved}));setSelection(null);success('Cloud confirmed',financeApprovalLabel(saved));
      try{const result=await refreshData();if(!result.success)throw new Error(result.message);}catch{if(alive.current&&owner.current===actor)toastError('Action saved; refresh incomplete','The action is confirmed. Refresh to load current account balances.');}
    }catch(cause){if(alive.current&&owner.current===actor)setProblem(`${(cause as Error).message} Refresh to check the latest state if confirmation was interrupted.`);}
    finally{locked.current=false;if(alive.current&&owner.current===actor)setBusy(false);}
  };
  return <section className="space-y-4" aria-label="Payment approvals">
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3"><div className="min-w-0 flex-1"><h2 className="font-bold text-lg flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-rose-600"/>Approvals & Payments</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">A different signed-in finance staff member must approve each request. Requests and approvals do not change balances. Record payment only after the bank, MoMo or cash payment has actually been made.</p>
        <p className="text-xs text-slate-500 mt-2">A second trusted staff account needs a reviewed finance, senior pastor or super administrator role and two-factor authentication. Saved requests are fixed: cancel and submit a replacement to correct details.</p></div>
        <button type="button" disabled={busy} onClick={()=>void refresh()} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50"><RefreshCw className="w-4 h-4"/>Refresh requests</button></div>
      <label className="flex items-center gap-2 mt-4 text-sm"><input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)}/>Include paid, rejected, cancelled and voided requests</label>
    </div>
    {!rows.length&&<p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">No {showAll?'payment':'open payment'} requests. Use Request Expenditure or Internal Transfer to submit one.</p>}
    {rows.map(row=><article key={row.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3 break-words">
      <div className="flex flex-wrap justify-between gap-2"><div className="min-w-0"><p className="font-mono text-xs text-slate-500">{financeReference(row)}</p><h3 className="font-bold mt-1">{row.title}</h3></div><div><p className="font-bold text-lg">{formatGHS(row.amount)}</p><p className="text-xs font-semibold text-rose-700 dark:text-rose-300">{row._sync_status==='pending'?'Awaiting cloud confirmation':financeApprovalLabel(row)}</p></div></div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm"><div><dt className="text-xs text-slate-500">Payee / destination</dt><dd>{row.transaction_type==='transfer'?row.to_account_name:row.recipient_or_vendor||'Not specified'}</dd></div><div><dt className="text-xs text-slate-500">From account</dt><dd>{row.account_name}</dd></div>
        <div><dt className="text-xs text-slate-500">Date / method</dt><dd>{row.date} · {row.payment_method.replaceAll('_',' ')}</dd></div><div><dt className="text-xs text-slate-500">Category / department</dt><dd>{row.category}{row.department?` · ${row.department}`:''}</dd></div>
        <div><dt className="text-xs text-slate-500">Requested by</dt><dd>{row.requested_by||'Awaiting cloud identity'} · {dateTime(row.requested_at)}</dd></div>
        <div><dt className="text-xs text-slate-500">Approved by</dt><dd>{row.approved_by_id?`${row.approved_by} · ${dateTime(row.approved_at)}`:['cancelled','rejected'].includes(row.approval_state||'')?'No approval recorded':'Awaiting independent approval'}</dd></div>
        {row.paid_by_id&&<div><dt className="text-xs text-slate-500">Payment recorded by</dt><dd>{row.paid_by} · {dateTime(row.paid_at)}<span className="block font-mono">{row.payment_reference}</span></dd></div>}
      </dl>{row.notes&&<p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{row.notes}</p>}
      <details className="text-sm"><summary className="cursor-pointer font-semibold">Request history ({row.approval_history?.length||0})</summary><ol className="mt-2 space-y-2">{row.approval_history?.map((event,index)=><li key={index} className="border-l-2 border-slate-200 pl-3"><strong>{event.action}</strong> · {event.actor_name} · {dateTime(event.at)}{event.reason&&<p>{event.reason}</p>}{event.payment_reference&&<p>Payment reference: {event.payment_reference}</p>}</li>)}</ol></details>
      {finance&&<div className="flex flex-wrap gap-2 pt-2">
        {row.approval_state==='requested'&&row.requested_by_id===currentUser.id&&<p className="text-sm text-slate-500 w-full">You requested this payment. Another finance staff member must review it.</p>}
        {row.approval_state==='requested'&&row.requested_by_id!==currentUser.id&&['approve','reject'].map(action=><button key={action} disabled={busy||row._sync_status==='pending'} onClick={()=>open(row,action as FinanceApprovalAction)} className="px-3 py-2 rounded-lg border text-sm font-semibold disabled:opacity-50">{actionLabels[action as FinanceApprovalAction]}</button>)}
        {row.approval_state==='approved'&&<button disabled={busy||row._sync_status==='pending'} onClick={()=>open(row,'paid')} className="px-3 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold disabled:opacity-50">Record payment as paid</button>}
        {['requested','approved'].includes(row.approval_state!)&&(senior||row.requested_by_id===currentUser.id)&&<button disabled={busy||row._sync_status==='pending'} onClick={()=>open(row,'cancel')} className="px-3 py-2 rounded-lg border text-sm disabled:opacity-50">Cancel request</button>}
        {row.approval_state==='paid'&&<button onClick={()=>setVoucher(row)} className="px-3 py-2 rounded-lg border text-sm">View payment voucher</button>}
        {row.approval_state==='paid'&&senior&&!row.welfare_claim_id&&<button disabled={busy} onClick={()=>open(row,'void')} className="px-3 py-2 rounded-lg border text-sm">Void payment</button>}
      </div>}
    </article>)}
    {selection&&<div role="dialog" aria-modal="true" aria-labelledby="finance-action-title" className="fixed inset-0 z-50 bg-slate-950/70 p-4 flex items-center justify-center overflow-y-auto"><form ref={dialog} onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-5 space-y-4 max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between gap-3"><h2 id="finance-action-title" className="font-bold text-lg">{actionLabels[selection.action]}</h2><button type="button" disabled={busy} onClick={()=>setSelection(null)} aria-label="Close payment action"><X className="w-5 h-5"/></button></div>
      <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-sm break-words"><p className="font-bold">{selection.row.title} · {formatGHS(selection.row.amount)}</p><p>From: {selection.row.account_name}</p><p>To: {selection.row.to_account_name||selection.row.recipient_or_vendor||'Not specified'}</p><p>{selection.row.date} · {selection.row.payment_method.replaceAll('_',' ')}</p><p>{selection.row.notes}</p></div>
      {selection.action==='paid'?<><p className="text-sm">This records a payment already made outside the app and updates the account balance. Check the payment reference to avoid recording the same real payment twice.</p><label className="block text-sm font-semibold">Bank, MoMo or signed cash payment reference<input required minLength={3} maxLength={200} value={reference} onChange={e=>setReference(e.target.value)} disabled={busy} className="block mt-1 w-full border rounded-lg px-3 py-2 bg-transparent"/></label></>:['reject','cancel','void'].includes(selection.action)?<label className="block text-sm font-semibold">Reason<textarea required minLength={3} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)} disabled={busy} className="block mt-1 w-full border rounded-lg px-3 py-2 bg-transparent"/></label>:<p className="text-sm">Approval authorizes these exact details. It does not record or send a payment.</p>}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={reviewed} onChange={e=>setReviewed(e.target.checked)} disabled={busy}/>{selection.action==='paid'?'I confirm this payment has actually been made and I checked the payment reference.':'I have reviewed this request and confirm this action.'}</label>
      {problem&&<p role="alert" className="text-sm text-red-700 dark:text-red-300">{problem}</p>}
      <button type="submit" disabled={busy||!reviewed} className="w-full rounded-lg bg-rose-600 text-white font-semibold p-3 disabled:opacity-50">{busy?'Confirming with cloud…':actionLabels[selection.action]}</button>
    </form></div>}
    {voucher&&<PaymentVoucherModal record={voucher} settings={settings} onClose={()=>setVoucher(null)}/>}
  </section>;
}
