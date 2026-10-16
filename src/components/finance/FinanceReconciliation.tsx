import React,{useMemo} from 'react';
import type {ChurchAccount,ChurchFinanceRecord} from '../../types/database.types';
import {buildCsv,downloadCsvFile,financeReconciliation,financeReference,ghanaToday} from '../../lib/financeViewUtils';
import {formatGHS} from '../../lib/currencyUtils';

interface Props {
  accounts:ChurchAccount[];
  records:ChurchFinanceRecord[];
  onAccount:(id:string)=>void;
  onRecord:(id:string)=>void;
  onReference:(reference:string)=>void;
}
export function FinanceReconciliation({accounts,records,onAccount,onRecord,onReference}:Props) {
  const review=useMemo(()=>financeReconciliation(accounts,records),[accounts,records]);
  const amount=(value:number|null)=>value===null?'Needs verification':formatGHS(value);
  const exportReview=()=>downloadCsvFile(buildCsv([
    ['Account ID','Account','Currency','Opening balance','Posted ledger movement','Expected recorded balance','Current recorded balance','Difference','Review status'],
    ...review.accountChecks.map(row=>[row.account.id,row.account.name,row.account.currency,row.opening??'',row.movement,row.expected??'',row.account.current_balance,row.difference??'',row.difference===0?'Matches recorded history':'Review needed']),
  ]),`GWCC_Reconciliation_${ghanaToday()}.csv`);
  return <section aria-label="Finance reconciliation" className="space-y-5">
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-2 text-amber-950">
      <h3 className="font-bold">Verify recorded balances against actual funds</h3>
      <p className="text-sm">Compare these figures with bank and MoMo statements and a physical cash count before recording corrections. This review uses all ledger history, including records outside the selected reporting period.</p>
      {review.pending&&<p role="status" className="text-sm font-semibold">Local finance changes are awaiting cloud confirmation. Synchronize them before completing reconciliation.</p>}
      <p className="text-sm">{review.unresolved.length} account(s) need review · {review.missingAccounts.length} receipt(s) reference missing accounts · {review.duplicateReferences.length} repeated reference(s).</p>
    </div>
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">Account reconciliation</h3><button type="button" onClick={exportReview} className="rounded-lg border px-3 py-2 text-xs font-semibold">Export reconciliation CSV</button></div>
      <div className="overflow-x-auto"><table className="w-full text-xs text-left">
        <caption className="sr-only">All recorded opening balances, posted movements and current balances in GHS</caption>
        <thead className="bg-slate-50"><tr>{['Account','Opening','Posted movement','Expected balance','Recorded balance','Difference','Action'].map(label=><th key={label} scope="col" className="p-3 whitespace-nowrap">{label}</th>)}</tr></thead>
        <tbody>{review.accountChecks.map(row=><tr key={row.account.id} className="border-t"><th scope="row" className="p-3 font-semibold">{row.account.name}<span className="block text-[10px] text-slate-500">{row.account.currency} · {row.account.is_active?'Active':'Inactive'}</span></th>
          {[row.opening,row.movement,row.expected,row.account.current_balance,row.difference].map((value,index)=><td key={index} className={`p-3 whitespace-nowrap ${index===4&&value!==0?'text-rose-700 font-semibold':''}`}>{amount(value)}</td>)}
          <td className="p-3"><button type="button" onClick={()=>onAccount(row.account.id)} className="underline text-emerald-800 whitespace-nowrap">Review ledger</button></td></tr>)}</tbody>
      </table></div>
      <p className="px-4 py-3 text-xs text-slate-600">A difference identifies a recorded-data mismatch. It does not establish that cash is missing or authorize an opening-balance adjustment.</p>
    </div>
    {review.missingAccounts.length>0&&<div className="rounded-xl border border-rose-200 bg-white p-4 space-y-3"><h3 className="font-bold text-rose-900">Receipts with missing account links</h3><p className="text-xs text-slate-600">Verify the original holding account and its history before editing these receipts.</p>
      {review.missingAccounts.map(row=><div key={row.id} className="flex flex-wrap justify-between gap-2 border-t pt-3 text-sm"><span>{financeReference(row)} · {row.date} · {formatGHS(row.amount)}<span className="block text-xs text-slate-500">{row.account_name} · {row.status}</span></span><button type="button" onClick={()=>onRecord(row.id)} className="underline text-emerald-800">View receipt</button></div>)}
    </div>}
    {review.duplicateReferences.length>0&&<div className="rounded-xl border border-amber-200 bg-white p-4 space-y-3"><h3 className="font-bold">Historical repeated references</h3><p className="text-xs text-slate-600">Different receipts can share an old reference. Check each receipt before correcting it. New references are assigned uniquely by the server.</p>
      {review.duplicateReferences.map(group=><div key={group.reference} className="flex flex-wrap justify-between gap-2 border-t pt-3 text-sm"><span>{group.reference} · {group.records.length} receipts</span><button type="button" onClick={()=>onReference(group.reference)} className="underline text-emerald-800">Review matching receipts</button></div>)}
    </div>}
    {review.paymentsToReview.length>0&&<div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"><h3 className="font-bold">Verify payments on accounts with balance differences</h3><p className="text-xs text-slate-600">Check whether each payment was actually made and match it to the supporting bank, MoMo or cash record before recording a correction.</p>
      {review.paymentsToReview.map(row=><div key={row.id} className="flex flex-wrap justify-between gap-2 border-t pt-3 text-sm"><span>{financeReference(row)} · {formatGHS(row.amount)}<span className="block text-xs text-slate-500">{row.account_name} · {row.date} · {row.status}</span></span><button type="button" onClick={()=>onRecord(row.id)} className="underline text-emerald-800">Review payment</button></div>)}
    </div>}
  </section>;
}
