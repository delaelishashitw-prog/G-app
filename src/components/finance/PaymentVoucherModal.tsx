import React from 'react';
import { Printer, Copy, Check, X, ShieldAlert } from 'lucide-react';
import { ExpenseRecord, ChurchSettings } from '../../types/database.types';
import { formatGHS, numberToCedisWords } from '../../lib/currencyUtils';
import { useToast } from '../../contexts/ToastContext';

interface PaymentVoucherModalProps {
  record: ExpenseRecord;
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

  const voucherNumber = record.reference_number || `VCH-${record.id.slice(-6).toUpperCase()}`;

  // Ensure authorized approver displays Prophet Elisha K. Richard (Senior Pastor)
  const getAuthorizedApprover = (): string => {
    const raw = record.approved_by?.trim();
    if (
      !raw ||
      raw === 'Rev. Emmanuel Appiah' ||
      raw.includes('Agyemang-Prempeh') ||
      raw.includes('Emmanuel Agyemang') ||
      raw.includes('Emmanuel Appiah')
    ) {
      return settings.senior_pastor || 'Prophet Elisha K. Richard';
    }
    return raw;
  };

  const approverName = getAuthorizedApprover();

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    const text = `GREATER WORKS CITY CHURCH - PAYMENT VOUCHER
Voucher No: ${voucherNumber}
Date: ${record.date}
Paid To (Payee): ${record.recipient || 'Vendor / Recipient'}
Vote / Category: ${record.category}
Description: ${record.title || record.description}
Amount: ${formatGHS(record.amount)} (${numberToCedisWords(record.amount)})
Payment Method: ${record.payment_method.toUpperCase()} ${record.account ? `(${record.account})` : ''}
Approved By: ${approverName}
Notes: ${record.notes || 'None'}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    success('Voucher Copied', 'Voucher details copied to clipboard.');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto print:bg-transparent print:p-0 print:static print:overflow-visible">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 print:shadow-none print:border-none print:m-0 print:max-w-none print:w-full">
        {/* Top Control Bar (Hidden during print) */}
        <div className="no-print px-5 py-3.5 bg-rose-950 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-rose-500/20 text-rose-300 rounded-lg">
              <ShieldAlert className="w-4 h-4" />
            </span>
            <div>
              <span className="text-xs font-bold block">Church Payment Voucher</span>
              <span className="text-[10px] text-rose-300 font-mono">{voucherNumber}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              className="px-2.5 py-1.5 rounded-lg border border-rose-800 bg-rose-900 text-rose-200 hover:text-white hover:bg-rose-800 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Voucher</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-rose-300 hover:text-white rounded-lg hover:bg-rose-900 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Voucher Paper Body */}
        <div className="p-6 sm:p-8 space-y-5 text-slate-900 bg-white relative print:p-0">
          {/* Header & Letterhead */}
          <div className="flex items-start justify-between pb-4 border-b-2 border-rose-900 gap-4">
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
                <p className="text-xs font-medium text-rose-900">
                  {settings.branch_name || 'Joma Assembly'} • Accra, Ghana
                </p>
                <p className="text-[10px] text-slate-500">
                  Church Treasury & Disbursement Office • Official Expenditure Voucher
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="inline-block px-2 py-0.5 rounded bg-rose-100 text-rose-900 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                Disbursement Voucher
              </span>
              <div className="text-sm font-bold font-mono text-rose-950">{voucherNumber}</div>
              <div className="text-[11px] text-slate-500 font-medium">Date: {record.date}</div>
            </div>
          </div>

          {/* Details Table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50/60 divide-y divide-slate-200 text-xs">
            <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-slate-500 font-medium">Payee / Vendor / Recipient:</span>
              <span className="font-bold text-slate-950 text-sm">{record.recipient || 'Authorized Payee'}</span>
            </div>

            <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-slate-500 font-medium">Vote / Expense Category:</span>
              <span className="font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-900 text-xs">
                {record.category}
              </span>
            </div>

            <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-slate-500 font-medium">Expense Item / Purpose:</span>
              <span className="font-bold text-slate-800 text-xs">{record.title || record.description}</span>
            </div>

            <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-slate-500 font-medium">Payment Mode & Account:</span>
              <span className="font-semibold text-slate-800 capitalize">
                {record.payment_method.replace('_', ' ')}
                {record.account ? ` (${record.account})` : ''}
              </span>
            </div>

            <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-slate-500 font-medium">Authorized / Approved By:</span>
              <span className="font-bold text-slate-900">{approverName}</span>
            </div>

            {record.notes && (
              <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-slate-500 font-medium">Auditor Notes / Reference:</span>
                <span className="text-slate-700 italic">{record.notes}</span>
              </div>
            )}

            {/* Amount Banner */}
            <div className="p-4 bg-rose-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t-2 border-rose-800">
              <div>
                <span className="text-[10px] font-bold text-rose-900 uppercase tracking-wider block">
                  Total Disbursed Amount
                </span>
                <span className="text-xl sm:text-2xl font-black font-mono text-rose-950">
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
              <span className="font-bold text-slate-800 block">Authorized By</span>
              <span className="text-slate-400">{approverName}</span>
            </div>
            <div className="text-center">
              <div className="h-8 border-b border-dashed border-slate-400 mx-auto w-4/5 mb-1.5"></div>
              <span className="font-bold text-slate-800 block">Payee Received</span>
              <span className="text-slate-400">Signature & Date</span>
            </div>
          </div>

          <div className="pt-2 text-center text-[9px] text-slate-400 font-mono">
            Voucher Serial: GWCC-EXP-{record.id} • Greater Works City Church Internal Control & Audit Trail
          </div>
        </div>
      </div>
    </div>
  );
};
