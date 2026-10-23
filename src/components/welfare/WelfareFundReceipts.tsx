import React, { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { useToast } from '../../contexts/ToastContext';
import { ghanaToday } from '../../lib/financeViewUtils';
import { useModalFocus } from '../../hooks/useModalFocus';
import type { WelfareFundReceipt } from '../../types/database.types';
import {
  validateWelfareFundReceipt, welfareFundSources, welfareFundReceiptStatus,
  WELFARE_FUND_VOID_ROLES, type WelfareFundInput,
} from '../../features/welfare/welfareFund';

const currency = (amount: number) => `GH₵ ${amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const inputClass = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100';

function FundDialog({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: React.ReactNode }) {
  const dialog = useModalFocus(true, () => { if (!busy) onClose(); });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3">
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="fund-dialog-title" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 id="fund-dialog-title" className="text-lg font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label={`Close ${title.toLowerCase()}`} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function AddWelfareFundsModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { recordWelfareFundReceipt, welfareFundReceipts } = useChurchData();
  const { info } = useToast();
  const [id] = useState(() => `wfr-${crypto.randomUUID()}`);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(ghanaToday);
  const [source, setSource] = useState<WelfareFundInput['source'] | ''>('');
  const [reference, setReference] = useState(() => `WFR-${ghanaToday().replaceAll('-', '')}-${id.slice(4, 12).toUpperCase()}`);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const attempt = useRef<WelfareFundInput | null>(null);
  const saving = useRef(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving.current) return;
    setError('');
    try {
      const input = attempt.current || { id, amount: Number(amount), date, source: source as WelfareFundInput['source'], reference_no: reference.trim(), notes: notes.trim() };
      validateWelfareFundReceipt(input);
      if (!attempt.current && welfareFundReceipts.some(row => row.id !== id && row.reference_no.toLowerCase() === input.reference_no.toLowerCase())) throw new Error('This reference already has a receipt. Check Fund Receipts before adding it again.');
      attempt.current = input; setLocked(true); saving.current = true; setBusy(true);
      await recordWelfareFundReceipt(input);
      info('Receipt preserved on this device', 'Awaiting cloud confirmation. The fund balance updates after confirmation.');
      onSaved();
    } catch (failure) { setError((failure as Error).message); }
    finally { saving.current = false; setBusy(false); }
  };
  return <FundDialog title="Add Welfare Funds" busy={busy} onClose={onClose}>
    <p className="mb-4 text-sm text-slate-600">Add money to the welfare fund without a member name. Only record funds that are not already included in dues or other receipts.</p>
    <form onSubmit={submit} className="space-y-4" aria-label="Add welfare funds">
      <fieldset disabled={busy || locked} className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">Amount (GH₵)<input data-initial-focus className={inputClass} type="number" step="0.01" min="0.01" max="1000000000" required value={amount} onChange={event => setAmount(event.target.value)} /></label>
        <label className="block text-sm font-medium text-slate-700">Receipt date<input className={inputClass} type="date" required max={ghanaToday()} value={date} onChange={event => setDate(event.target.value)} /></label>
        <div><label htmlFor="welfare-fund-source" className="block text-sm font-medium text-slate-700">Source</label><select id="welfare-fund-source" className={inputClass} required value={source} onChange={event => setSource(event.target.value as WelfareFundInput['source'])}><option value="">Choose source</option>{Object.entries(welfareFundSources).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        <label className="block text-sm font-medium text-slate-700">Reference<input className={inputClass} required maxLength={100} value={reference} onChange={event => setReference(event.target.value)} /></label>
        <label className="block text-sm font-medium text-slate-700">Source note<textarea className={inputClass} required minLength={5} maxLength={1000} rows={3} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Explain where this money came from and the period it covers." /></label>
      </fieldset>
      <p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">These funds count towards the fund balance after cloud confirmation. Record individual dues separately to give members payment credit. Reconcile this receipt with your cash, bank or MoMo records separately.</p>
      {error && <div role="alert" className="space-y-1 rounded-lg bg-rose-50 p-3 text-sm text-rose-800"><p>{error}</p>{locked && <p>Retry keeps this same receipt. Check Fund Receipts and pending changes before starting a replacement.</p>}</div>}
      <div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button><button type="submit" disabled={busy} className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Preserving receipt…' : locked ? 'Retry same receipt' : 'Save fund receipt'}</button></div>
    </form>
  </FundDialog>;
}

function VoidFundReceiptModal({ receipt, onClose }: { receipt: WelfareFundReceipt; onClose: () => void }) {
  const { voidWelfareFundReceipt } = useChurchData();
  const { info } = useToast();
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const savedReason = useRef<string | null>(null), saving = useRef(false);
  return <FundDialog title="Void Welfare Fund Receipt" busy={busy} onClose={onClose}>
    <p className="mb-4 break-words text-sm text-slate-600">{receipt.reference_no} · {currency(receipt.amount)}. Voiding removes this amount from the fund balance after confirmation and preserves the original receipt.</p>
    <form className="space-y-4" onSubmit={async event => {
      event.preventDefault(); if (saving.current) return;
      const note = savedReason.current ?? reason.trim();
      if (note.length < 5 || note.length > 1000) { setError('Enter a void reason in 5–1,000 characters.'); return; }
      savedReason.current = note; saving.current = true; setBusy(true); setError('');
      try { await voidWelfareFundReceipt(receipt.id, note); info('Void request preserved', 'The original amount remains in the balance until cloud confirmation.'); onClose(); }
      catch (failure) { setError((failure as Error).message); }
      finally { saving.current = false; setBusy(false); }
    }}>
      <label className="block text-sm font-medium text-slate-700">Reason for voiding<textarea data-initial-focus className={inputClass} required minLength={5} maxLength={1000} disabled={busy || savedReason.current !== null} rows={3} value={reason} onChange={event => setReason(event.target.value)} /></label>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button><button type="submit" disabled={busy} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Preserving void request…' : 'Confirm void receipt'}</button></div>
    </form>
  </FundDialog>;
}

export function WelfareFundReceiptsPanel() {
  const { welfareFundReceipts } = useChurchData();
  const { currentUser } = useAuth();
  const [toVoid, setToVoid] = useState<WelfareFundReceipt | null>(null);
  const rows = [...welfareFundReceipts].sort((a, b) => b.date.localeCompare(a.date) || a.reference_no.localeCompare(b.reference_no));
  return <section className="space-y-4" aria-label="Welfare fund receipts">
    <div><h3 className="font-bold text-slate-900">Fund Receipts</h3><p className="text-sm text-slate-600">Carried-forward money, unnamed dues and other welfare funds. Members’ payment histories and eligibility are calculated from their individual dues.</p></div>
    {rows.some(row => row._sync_status === 'pending') && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Receipts or void requests are awaiting cloud confirmation. New receipts enter the balance after confirmation; pending voids keep their previous amount.</p>}
    <div className="relative overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="p-3">Date / Reference</th><th className="p-3">Source / Note</th><th className="p-3 text-right">Amount</th><th className="p-3">Status / Recorded by</th><th className="p-3">Actions</th></tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-slate-500">No additional welfare fund receipts recorded.</td></tr> : rows.map(receipt => <tr key={receipt.id}>
        <td className="min-w-40 p-3 align-top"><div>{receipt.date}</div><div className="break-all text-xs text-slate-500">{receipt.reference_no}</div></td>
        <td className="min-w-48 max-w-sm p-3 align-top"><div className="font-semibold text-slate-800">{welfareFundSources[receipt.source]}</div><p className="whitespace-pre-wrap break-words text-xs text-slate-600">{receipt.notes}</p>{receipt.void_reason && <p className="mt-1 break-words text-xs text-rose-700">Void reason: {receipt.void_reason}{receipt.voided_by && ` · ${receipt.voided_by}`}</p>}</td>
        <td className={`whitespace-nowrap p-3 text-right align-top font-semibold ${receipt.status === 'voided' && !receipt._sync_status ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{currency(receipt.amount)}</td>
        <td className="min-w-40 p-3 align-top"><span className={receipt._sync_status ? 'text-amber-800' : receipt.status === 'voided' ? 'text-slate-500' : 'text-emerald-800'}>{welfareFundReceiptStatus(receipt)}</span><div className="text-xs text-slate-500">{receipt.recorded_by || 'Awaiting confirmation'}</div></td>
        <td className="p-3 align-top">{WELFARE_FUND_VOID_ROLES.includes(currentUser.role) && receipt.status === 'active' && !receipt._sync_status && receipt.updated_at && <button onClick={() => setToVoid(receipt)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700" aria-label={`Void receipt ${receipt.reference_no}`}>Void</button>}</td>
      </tr>)}</tbody></table></div>
    {toVoid && <VoidFundReceiptModal key={`${currentUser.id}:${currentUser.role}:${toVoid.id}`} receipt={toVoid} onClose={() => setToVoid(null)} />}
  </section>;
}
