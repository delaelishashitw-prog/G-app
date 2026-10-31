import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useChurchData} from '../../contexts/ChurchDataContext';
import {useAuth} from '../../contexts/AuthContext';
import {formatGHS} from '../../lib/currencyUtils';
import {ghanaToday,financeReference} from '../../lib/financeViewUtils';
import {loadGivingDepositLinks,postGivingDeposit,type GivingDepositLink,type GivingDepositRequest} from '../../lib/givingDeposits';

export function GivingDeposits(){
 const {giving,churchAccounts,churchFinances,refreshData}=useChurchData();const {currentUser}=useAuth();
 const [links,setLinks]=useState<GivingDepositLink[]>([]),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const [problem,setProblem]=useState(''),[notice,setNotice]=useState(''),[search,setSearch]=useState(''),[selected,setSelected]=useState<string[]>([]);
 const [mode,setMode]=useState<'existing'|'new'>('existing'),[accountId,setAccountId]=useState(''),[existingId,setExistingId]=useState('');
 const [date,setDate]=useState(ghanaToday()),[method,setMethod]=useState('cash'),[reference,setReference]=useState(''),[reviewed,setReviewed]=useState(false),[page,setPage]=useState(1);
 const alive=useRef(true),locked=useRef(false),operation=useRef<{key:string;request:GivingDepositRequest}|null>(null),owner=useRef(currentUser.id);owner.current=currentUser.id;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const refresh=async()=>{
  if(locked.current)return;locked.current=true;setLoading(true);setProblem('');setReady(false);const actor=currentUser.id;
  try{const result=await refreshData();if(!result.success)throw new Error(result.message);const saved=await loadGivingDepositLinks();if(alive.current&&owner.current===actor){setLinks(saved);setReady(true);}}
  catch(cause){if(alive.current&&owner.current===actor)setProblem((cause as Error).message);}
  finally{locked.current=false;if(alive.current&&owner.current===actor)setLoading(false);}
 };
 useEffect(()=>{void refresh();},[]);
 const accounts=churchAccounts.filter(row=>row.is_active&&row.currency==='GHS'&&!(row as any)._sync_status);
 const allocated=useMemo(()=>new Set(links.filter(row=>row.active).map(row=>row.giving_id)),[links]);
 const available=useMemo(()=>giving.filter(row=>row.currency==='GHS'&&(!row.status||row.status==='completed')&&row.updated_at&&row._sync_status!=='pending'&&!allocated.has(row.id)).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id)),[giving,allocated]);
 const chosen=available.filter(row=>selected.includes(row.id)),total=chosen.reduce((sum,row)=>sum+Math.round(row.amount*100),0)/100;
 const filtered=available.filter(row=>`${row.member_name||row.donor_name||'Anonymous'} ${row.category} ${row.reference_number||''} ${row.date}`.toLowerCase().includes(search.toLowerCase()));
 const pages=Math.max(1,Math.ceil(filtered.length/25)),validPage=Math.min(page,pages),displayed=filtered.slice((validPage-1)*25,validPage*25);
 const incomes=churchFinances.filter(row=>row.account_id===accountId&&row.currency==='GHS'&&row.status==='completed'&&['income','grant'].includes(row.transaction_type)&&row.updated_at&&row._sync_status!=='pending'&&row.amount>Number(row.giving_deposit_amount||0));
 const existing=incomes.find(row=>row.id===existingId);
 const pending=churchFinances.some(row=>row._sync_status==='pending')||giving.some(row=>row._sync_status==='pending');
 useEffect(()=>{setReviewed(false);},[selected,mode,accountId,existingId,date,method,reference]);
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();if(locked.current||!ready||!reviewed||pending||!chosen.length||chosen.length>100)return;
  if(mode==='existing'&&!existing){setProblem('Select a confirmed income receipt.');return;}
  const input={p_receipts:chosen.map(row=>({id:row.id,updated_at:row.updated_at!})).sort((a,b)=>a.id.localeCompare(b.id)),p_account_id:accountId,p_date:mode==='existing'?existing!.date:date,p_payment_method:mode==='existing'?existing!.payment_method:method,p_reference:mode==='existing'?'':reference.trim(),p_existing_finance_id:mode==='existing'?existing!.id:null,p_expected_updated_at:mode==='existing'?existing!.updated_at!:null};
  const key=JSON.stringify(input);if(operation.current?.key!==key)operation.current={key,request:{...input,p_operation_id:crypto.randomUUID()}};
  const actor=currentUser.id;locked.current=true;setBusy(true);setProblem('');setNotice('');
  try{
   const saved=await postGivingDeposit(operation.current.request);if(!alive.current||owner.current!==actor)return;
   operation.current=null;setSelected([]);setReviewed(false);setNotice(`${formatGHS(total)} linked to ${financeReference(saved)}. ${mode==='new'?'The deposit is posted once to the selected account.':'The existing account credit was preserved.'}`);
   setReady(false);try{const result=await refreshData();if(!result.success)throw new Error(result.message);const next=await loadGivingDepositLinks();if(alive.current&&owner.current===actor){setLinks(next);setReady(true);}}catch{if(alive.current&&owner.current===actor)setProblem('Deposit saved. Refresh the deposit list to load current balances before another allocation.');}
  }catch(cause){if(alive.current&&owner.current===actor)setProblem(`${(cause as Error).message} If confirmation was interrupted, retry the same details or refresh to check the saved allocation.`);}
  finally{locked.current=false;if(alive.current&&owner.current===actor)setBusy(false);}
 };
 return <section aria-label="Giving deposits" className="space-y-4">
  <div className="rounded-xl border bg-white dark:bg-slate-900 p-4 space-y-3"><h2 className="font-bold text-lg">Giving deposits</h2>
   <p className="text-sm">Allocate confirmed Member Giving receipts to their holding account. For collections already included in treasury, link the existing income or cash-count receipt. Create a new deposit only when the account has not already been credited.</p>
   <p className="text-xs text-slate-600">Receipts linked to posted income stay protected. To correct one, first void the linked treasury income and then correct the Giving receipt. Allocations retain their history and are included in recovery backups.</p>
   <button type="button" disabled={busy||loading} onClick={()=>void refresh()} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{loading?'Refreshing deposits…':'Refresh deposits'}</button>
   {pending&&<p role="status" className="text-sm text-amber-900">Finance changes await cloud confirmation. Finish synchronization before allocating deposits.</p>}
   {problem&&<p role="alert" className="text-sm text-rose-800 break-words">{problem}</p>}{notice&&<p role="status" className="text-sm text-emerald-800 break-words">{notice}</p>}
  </div>
  <form onSubmit={submit} className="rounded-xl border bg-white dark:bg-slate-900 p-4 space-y-4">
   <fieldset disabled={busy||loading||!ready} className="space-y-4 min-w-0">
    <label className="block text-sm font-semibold">Find Giving receipts<input aria-label="Find Giving receipts" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} className="block w-full rounded-lg border p-2 mt-1 bg-transparent"/></label>
    <p className="text-xs">{available.length} confirmed unallocated receipt(s). Select up to 100 per allocation. Previously recorded collections require review; the system makes no automatic historical deposits.</p>
    <div className="overflow-x-auto"><table className="w-full text-xs text-left"><caption className="sr-only">Unallocated Giving receipts</caption><thead><tr>{['Select','Date','Donor','Category','Method','Amount'].map(label=><th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>
     {displayed.map(row=><tr key={row.id} className="border-t"><td className="p-2"><input type="checkbox" aria-label={`Select receipt ${row.reference_number||row.id}`} checked={selected.includes(row.id)} disabled={!selected.includes(row.id)&&chosen.length>=100} onChange={e=>setSelected(ids=>e.target.checked?[...ids,row.id]:ids.filter(id=>id!==row.id))}/></td><td className="p-2 whitespace-nowrap">{row.date}</td><td className="p-2">{row.member_name||row.donor_name||'Anonymous'}</td><td className="p-2">{row.category}</td><td className="p-2">{row.payment_method.replaceAll('_',' ')}</td><td className="p-2 whitespace-nowrap">{formatGHS(row.amount)}</td></tr>)}
    </tbody></table></div>
    {!displayed.length&&<p className="text-sm">{ready?'No matching unallocated receipts.':'Load confirmed receipts before allocating.'}</p>}
    <div className="flex flex-wrap gap-3 items-center text-xs"><button type="button" disabled={validPage<=1} onClick={()=>setPage(validPage-1)} className="border rounded-lg px-3 py-2">Previous receipts</button><span>Page {validPage} of {pages}</span><button type="button" disabled={validPage>=pages} onClick={()=>setPage(validPage+1)} className="border rounded-lg px-3 py-2">Next receipts</button><button type="button" onClick={()=>setSelected([])} className="underline">Clear selection</button></div>
    <p className="font-bold">{chosen.length} selected · {formatGHS(total)}</p>
    <label className="block text-sm font-semibold">Allocation action<select aria-label="Allocation action" value={mode} onChange={e=>setMode(e.target.value as typeof mode)} className="block w-full border rounded-lg p-2 mt-1 bg-transparent"><option value="existing">Link an existing income receipt (balance unchanged)</option><option value="new">Create a new treasury deposit (increases balance)</option></select></label>
    <label className="block text-sm font-semibold">Deposit holding account<select aria-label="Deposit holding account" required value={accountId} onChange={e=>{setAccountId(e.target.value);setExistingId('');}} className="block w-full border rounded-lg p-2 mt-1 bg-transparent"><option value="">Choose an account</option>{accounts.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
    {mode==='existing'?<label className="block text-sm font-semibold">Existing treasury income<select aria-label="Existing treasury income" required value={existingId} onChange={e=>setExistingId(e.target.value)} className="block w-full border rounded-lg p-2 mt-1 bg-transparent"><option value="">Choose a confirmed income receipt</option>{incomes.map(row=><option key={row.id} value={row.id}>{financeReference(row)} · {row.date} · {row.title} · {formatGHS(row.amount-Number(row.giving_deposit_amount||0))} unallocated</option>)}</select>{existing&&<span className="block mt-1 font-normal text-xs">{formatGHS(existing.amount-Number(existing.giving_deposit_amount||0))} remains available to link. Linking does not add another account credit.</span>}</label>:<div className="grid sm:grid-cols-2 gap-3">
     <label className="text-sm">Deposit date<input aria-label="Deposit date" type="date" required max={ghanaToday()} value={date} onChange={e=>setDate(e.target.value)} className="block w-full rounded-lg border p-2 bg-transparent"/></label>
     <label className="text-sm">Deposit method<select aria-label="Deposit method" value={method} onChange={e=>setMethod(e.target.value)} className="block w-full rounded-lg border p-2 bg-transparent">{['cash','mobile_money','bank_transfer','card','cheque','other'].map(value=><option key={value} value={value}>{value.replaceAll('_',' ')}</option>)}</select></label>
     <label className="text-sm sm:col-span-2">Deposit reference<input aria-label="Deposit reference" maxLength={200} value={reference} onChange={e=>setReference(e.target.value)} className="block w-full rounded-lg border p-2 bg-transparent"/><span className="text-xs">Leave blank for a unique server number.</span></label>
    </div>}
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>{mode==='new'?`I verified these receipts and confirm that ${formatGHS(total)} has not already been credited to this holding account.`:'I verified that these Giving receipts are included in the selected existing income receipt.'}</label>
   </fieldset>
   <button type="submit" disabled={busy||loading||!ready||pending||!reviewed||!chosen.length||!accountId||(mode==='existing'&&(!existing||total>existing.amount-Number(existing.giving_deposit_amount||0)))} className="rounded-lg bg-emerald-800 text-white px-4 py-3 text-sm font-semibold disabled:opacity-50">{busy?'Confirming deposit…':mode==='new'?'Post Giving deposit':'Link Giving receipts'}</button>
  </form>
  {links.length>0&&<details className="rounded-xl border bg-white dark:bg-slate-900 p-4"><summary className="cursor-pointer font-semibold text-sm">Giving allocation history ({links.length})</summary><div className="overflow-x-auto mt-3"><table className="w-full text-xs text-left"><thead><tr>{['Giving receipt','Treasury reference','Amount','Allocation status','Recorded by'].map(label=><th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{links.slice(0,100).map(link=><tr key={link.giving_id+link.finance_id} className="border-t"><td className="p-2 break-all">{giving.find(row=>row.id===link.giving_id)?.reference_number||link.giving_id}</td><td className="p-2">{churchFinances.find(row=>row.id===link.finance_id)?.reference_no||link.finance_id}</td><td className="p-2 whitespace-nowrap">{formatGHS(link.amount)}</td><td className="p-2">{link.active?'Linked to posted income':'Income voided · retained history'}</td><td className="p-2">{link.linked_by_name}</td></tr>)}</tbody></table></div>{links.length>100&&<p className="text-xs mt-2">Showing the latest 100 allocations. Older links remain in the recovery backup.</p>}</details>}
 </section>;
}
