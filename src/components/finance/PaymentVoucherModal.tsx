import React from 'react';
import { Printer, Copy, Check, X, ShieldAlert } from 'lucide-react';
import { ExpenseRecord, ChurchFinanceRecord, ChurchSettings } from '../../types/database.types';
import { formatGHS, numberToCedisWords } from '../../lib/currencyUtils';
import { useToast } from '../../contexts/ToastContext';
import {verifiedApprover} from '../../lib/financeApprovals';
import {financeReference} from '../../lib/financeViewUtils';

interface PaymentVoucherModalProps {
  record: ExpenseRecord | ChurchFinanceRecord | any;
  settings: ChurchSettings;
  onClose: () => void;
}

export const PaymentVoucherModal: React.FC<PaymentVoucherModalProps> = ({
  record,
  settings,
  onClose,
}) => {
  const { success } = useToast();
  const [copied, setCopied] = React.useState(false);
  const pending=record._sync_status==='pending';
  const canIssue=!pending&&!['pending','cancelled','failed'].includes(record.status)&&(!record.approval_state||['paid','voided'].includes(record.approval_state));

  const isIncome = record.transaction_type === 'income' || record.transaction_type === 'grant';
  const voucherNumber = record.reference_no?financeReference(record):record.reference_number||'No reference recorded';
  const payeeName = record.recipient_or_vendor || record.recipient || (isIncome ? 'Church Treasury Deposit' : 'Authorized Payee');
  const accountName = record.account_name || record.account || '';
  const descriptionText = record.title || record.description || (isIncome ? 'Church Revenue / Income' : 'Church Expenditure');

  const approverName = isIncome ? record.approved_by || record.recorded_by || 'Not recorded' : verifiedApprover(record);

  const handlePrint = () => {
    if(!canIssue)return;
    window.print();
  };

  const handleCopyText = () => {
    if(!canIssue)return;
    const text = isIncome
      ? `GREATER WORKS CITY CHURCH - OFFICIAL INCOME RECEIPT
Receipt No: ${voucherNumber}
Date: ${record.date}
Received From: ${payeeName}
Income Stream: ${record.category}
Description: ${descriptionText}
Amount: ${formatGHS(record.amount)} (${numberToCedisWords(record.amount)})
Credit Account: ${accountName || 'Church Treasury'}
Payment Method: ${record.payment_method?.toUpperCase()}
Received By: ${approverName}
Notes: ${record.notes || 'None'}`
      : `GREATER WORKS CITY CHURCH - PAYMENT VOUCHER
Voucher No: ${voucherNumber}
Date: ${record.date}
Paid To (Payee): ${payeeName}
Vote / Category: ${record.category}
Description: ${descriptionText}
Amount: ${formatGHS(record.amount)} (${numberToCedisWords(record.amount)})
Payment Method: ${record.payment_method?.toUpperCase()} ${accountName ? `(${accountName})` : ''}
Approved By: ${approverName}
Requested By: ${record.requested_by || 'Historical entry'}
Payment Recorded By: ${record.paid_by || 'Historical entry'}
Payment Reference: ${record.payment_reference || 'Not recorded'}
Notes: ${record.notes || 'None'}`;

    navigator.clipboard.writeText(record.status==='voided'?`VOIDED — retained for audit\n${text}`:text);
    setCopied(true);
    success(isIncome ? 'Receipt Copied' : 'Voucher Copied', isIncome ? 'Receipt details copied to clipboard.' : 'Voucher details copied to clipboard.');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto print:bg-transparent print:p-0 print:static print:overflow-visible">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 print:shadow-none print:border-none print:m-0 print:max-w-none print:w-full">
        {record.approval_state&&<div className="p-4 text-xs bg-slate-50 text-slate-700 break-words">Requested by {record.requested_by||'Awaiting cloud identity'} · Approved by {record.approved_by_id?record.approved_by:'Awaiting independent approval'}<br/>Payment recorded by {record.paid_by||'Awaiting payment'} · {record.payment_reference||'No payment reference'}</div>}
        {/* Top Control Bar (Hidden during print) */}
        <div className={`no-print px-5 py-3.5 ${isIncome ? 'bg-emerald-950' : 'bg-rose-950'} text-white flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-2">
            <span className={`p-1.5 ${isIncome ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'} rounded-lg`}>
              <ShieldAlert className="w-4 h-4" />
            </span>
            <div>
              <span className="text-xs font-bold block">{isIncome ? 'Church Official Income Receipt' : 'Church Payment Voucher'}</span>
              <span className={`text-[10px] ${isIncome ? 'text-emerald-300' : 'text-rose-300'} font-mono`}>{voucherNumber}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              disabled={!canIssue}
              aria-label="Copy receipt or voucher"
              className={`px-2.5 py-1.5 rounded-lg border ${isIncome ? 'border-emerald-800 bg-emerald-900 text-emerald-200 hover:bg-emerald-800' : 'border-rose-800 bg-rose-900 text-rose-200 hover:bg-rose-800'} hover:text-white text-xs font-medium flex items-center gap-1 transition cursor-pointer`}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={!canIssue}
              className={`px-3 py-1.5 rounded-lg ${isIncome ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-rose-700 hover:bg-rose-800'} text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isIncome ? 'Print Receipt' : 'Print Voucher'}</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Close receipt or voucher"
              className={`p-1.5 ${isIncome ? 'text-emerald-300 hover:bg-emerald-900' : 'text-rose-300 hover:bg-rose-900'} hover:text-white rounded-lg transition cursor-pointer`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!canIssue&&<p role="status" className="bg-amber-50 text-amber-950 border-b border-amber-200 p-4 text-sm font-semibold">{pending?'Awaiting cloud confirmation. Printing and copying become available after this receipt is confirmed.':'This transaction is not posted. A payment receipt cannot be issued yet.'}</p>}
        {record.status==='voided'&&<p className="p-3 text-rose-800 font-bold text-center border-b">VOIDED — retained for audit</p>}
        {/* Printable Voucher Paper Body */}
        <div className="p-6 sm:p-8 space-y-5 text-slate-900 bg-white relative print:p-0">
          {/* Header & Letterhead */}
          <div className={`flex items-start justify-between pb-4 border-b-2 ${isIncome ? 'border-emerald-800' : 'border-rose-900'} gap-4`}>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-slate-50 p-1 border border-slate-200 shrink-0 flex items-center justify-center overflow-hidden">
                <img
                  src={settings.logo_url || '/assets/logo.png'}
                  alt="GWCC Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h2 className="font-extrabold text-base text-slate-950 uppercase tracking-tight">
                  {settings.church_name || 'Greater Works City Church'}
                </h2>
                <p className={`text-xs font-medium ${isIncome ? 'text-emerald-800' : 'text-rose-900'}`}>
                  {settings.branch_name || 'Joma Assembly'} • Accra, Ghana
                </p>
                <p className="text-[10px] text-slate-500">
                  {isIncome ? 'Church Treasury & Accounts Office • Official Revenue Receipt' : 'Church Treasury & Disbursement Office • Official Expenditure Voucher'}
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className={`inline-block px-2 py-0.5 rounded ${isIncome ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'} text-[10px] font-extrabold uppercase tracking-wider mb-1`}>
                {isIncome ? 'Official Income Receipt' : 'Disbursement Voucher'}
              </span>
              <div className={`text-sm font-bold font-mono ${isIncome ? 'text-emerald-950' : 'text-rose-950'}`}>{voucherNumber}</div>
              <div className="text-[11px] text-slate-500 font-medium">Date: {record.date}</div>
            </div>
          </div>

          {/* Details Table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50/60 divide-y divide-slate-200 text-xs">
            <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-slate-500 font-medium">{isIncome ? 'Received From (Payer / Source):' : 'Payee / Vendor / Recipient:'}</span>
              <span className="font-bold text-slate-950 text-sm">{payeeName}</span>
            </div>

            <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-slate-500 font-medium">{isIncome ? 'Revenue Stream / Category:' : 'Vote / Expense Category:'}</span>
              <span className={`font-bold px-2 py-0.5 rounded ${isIncome ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'} text-xs`}>
                {record.category}
              </span>
            </div>

            <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-slate-500 font-medium">{isIncome ? 'Revenue Item / Purpose:' : 'Expense Item / Purpose:'}</span>
              <span className="font-bold text-slate-800 text-xs">{descriptionText}</span>
            </div>

            <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-slate-500 font-medium">{isIncome ? 'Deposit Mode & Account:' : 'Payment Mode & Account:'}</span>
              <span className="font-semibold text-slate-800 capitalize">
                {record.payment_method?.replace('_', ' ')}
                {accountName ? ` (${accountName})` : ''}
              </span>
            </div>

            <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-slate-500 font-medium">{isIncome ? 'Received / Acknowledged By:' : 'Authorized / Approved By:'}</span>
              <span className="font-bold text-slate-900">{approverName}</span>
            </div>

            {record.notes && (
              <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-slate-500 font-medium">Auditor Notes / Reference:</span>
                <span className="text-slate-700 italic">{record.notes}</span>
              </div>
            )}

            {/* Amount Banner */}
            <div className={`p-4 ${isIncome ? 'bg-emerald-50/80 border-emerald-800' : 'bg-rose-50/80 border-rose-800'} flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t-2`}>
              <div>
                <span className={`text-[10px] font-bold ${isIncome ? 'text-emerald-900' : 'text-rose-900'} uppercase tracking-wider block`}>
                  {isIncome ? 'Total Received Amount' : 'Total Disbursed Amount'}
                </span>
                <span className={`text-xl sm:text-2xl font-black font-mono ${isIncome ? 'text-emerald-950' : 'text-rose-950'}`}>
                  {formatGHS(record.amount)}
                </span>
              </div>
              <div className="text-right sm:max-w-[260px]">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Sum in Words</span>
                <span className="text-[11px] font-semibold text-slate-800 italic">
                  {numberToCedisWords(record.amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Authorization Grid */}
          <div className="pt-4 border-t border-slate-200 grid grid-cols-3 gap-4 text-[10px]">
            <div className="text-center">
              <div className="h-8 border-b border-dashed border-slate-400 mx-auto w-4/5 mb-1.5"></div>
              <span className="font-bold text-slate-800 block">Prepared By</span>
              <span className="text-slate-400">Church Finance Officer</span>
            </div>
            <div className="text-center">
              <div className="h-8 border-b border-dashed border-slate-400 mx-auto w-4/5 mb-1.5"></div>
              <span className="font-bold text-slate-800 block">{isIncome ? 'Received By' : 'Authorized By'}</span>
              <span className="text-slate-400">{approverName}</span>
            </div>
            <div className="text-center">
              <div className="h-8 border-b border-dashed border-slate-400 mx-auto w-4/5 mb-1.5"></div>
              <span className="font-bold text-slate-800 block">{isIncome ? 'Payer / Depositor' : 'Payee Received'}</span>
              <span className="text-slate-400">Signature & Date</span>
            </div>
          </div>

          <div className="pt-2 text-center text-[9px] text-slate-400 font-mono">
            Serial: GWCC-{isIncome ? 'INC' : 'EXP'}-{record.id} • Greater Works City Church Internal Control & Audit Trail
          </div>
        </div>
      </div>
    </div>
  );
};
