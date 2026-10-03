import React, { useRef } from 'react';
import { Printer, Copy, Check, X, ShieldCheck } from 'lucide-react';
import { GivingRecord, ChurchSettings } from '../../types/database.types';
import { formatGHS, numberToCedisWords } from '../../lib/currencyUtils';
import { useToast } from '../../contexts/ToastContext';

interface OfficialReceiptModalProps {
  record: GivingRecord;
  settings: ChurchSettings;
  onClose: () => void;
}

export const OfficialReceiptModal: React.FC<OfficialReceiptModalProps> = ({
  record,
  settings,
  onClose,
}) => {
  const { info, success } = useToast();
  const [copied, setCopied] = React.useState(false);

  const donorDisplayName = record.member_name || record.donor_name || 'Anonymous Giver';
  const receiptNumber = record.reference_number || `REC-${record.id.slice(-6).toUpperCase()}`;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    const text = `GREATER WORKS CITY CHURCH - OFFICIAL RECEIPT
Receipt No: ${receiptNumber}
Date: ${record.date}
Received From: ${donorDisplayName}${record.tithe_number ? ` (Tithe #${record.tithe_number})` : ''}
Category: ${record.category}
Amount: ${formatGHS(record.amount)} (${numberToCedisWords(record.amount)})
Payment Method: ${record.payment_method.toUpperCase()} ${record.payment_channel ? `(${record.payment_channel})` : ''}
Service: ${record.service_name || 'Church Service'}
Reference: ${record.reference_number || 'N/A'}
"Bring all the tithes into the storehouse..." — Malachi 3:10
Thank you for your generous stewardship!`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    success('Receipt Copied', 'Receipt details copied to clipboard.');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto print:bg-transparent print:p-0 print:static print:overflow-visible">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 print:shadow-none print:border-none print:m-0 print:max-w-none print:w-full">
        {/* Top Control Bar (Hidden during print) */}
        <div className="no-print px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <div>
              <span className="text-xs font-bold block">Official Church Receipt</span>
              <span className="text-[10px] text-slate-400 font-mono">{receiptNumber}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
              title="Copy receipt summary to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper Body */}
        <div className="p-6 sm:p-8 space-y-5 text-slate-900 bg-white relative print:p-0">
          {/* Watermark Logo Seal in background */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
            <img src="/assets/logo.png" alt="GWCC Seal" className="w-72 h-72 object-contain" />
          </div>

          {/* Header & Letterhead */}
          <div className="flex items-start justify-between pb-4 border-b-2 border-emerald-900 gap-4">
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
                <p className="text-xs font-medium text-emerald-900">
                  {settings.branch_name || 'Joma Assembly'} • Accra, Ghana
                </p>
                <p className="text-[10px] text-slate-500">
                  GPS: GA-183-4921 • Tel: +233 24 000 0000 • treasury@gwccgh.org
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                Official Receipt
              </span>
              <div className="text-sm font-bold font-mono text-emerald-950">{receiptNumber}</div>
              <div className="text-[11px] text-slate-500 font-medium">Date: {record.date}</div>
            </div>
          </div>

          {/* Details Table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50/60 divide-y divide-slate-200 text-xs">
            <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-slate-500 font-medium">Received With Thanks From:</span>
              <span className="font-bold text-slate-950 text-sm">{donorDisplayName}</span>
            </div>

            {record.tithe_number && (
              <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-slate-500 font-medium">Tithe Envelope / Member No:</span>
                <span className="font-mono font-bold text-emerald-900 bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-300">
                  Tithe #{record.tithe_number}
                </span>
              </div>
            )}

            <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-slate-500 font-medium">Giving Category / Designation:</span>
              <span className="font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-xs">
                {record.category}
              </span>
            </div>

            <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-slate-500 font-medium">Payment Mode & Channel:</span>
              <span className="font-semibold text-slate-800 capitalize">
                {record.payment_method.replace('_', ' ')}
                {record.payment_channel ? ` • ${record.payment_channel}` : ''}
              </span>
            </div>

            {record.service_name && (
              <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-slate-500 font-medium">Church Service / Meeting:</span>
                <span className="text-slate-700 font-medium">{record.service_name}</span>
              </div>
            )}

            {record.notes && (
              <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-slate-500 font-medium">Purpose / Giver's Note:</span>
                <span className="text-slate-700 italic">{record.notes}</span>
              </div>
            )}

            {/* Amount Banner */}
            <div className="p-4 bg-emerald-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t-2 border-emerald-800">
              <div>
                <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider block">
                  Amount Received (Ghana Cedis)
                </span>
                <span className="text-xl sm:text-2xl font-black font-mono text-emerald-950">
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

          {/* Scripture Quotation */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
            <p className="text-[11px] text-slate-600 italic">
              "Bring the whole tithe into the storehouse, that there may be food in my house. Test me in this, says the LORD Almighty, and see if I will not throw open the floodgates of heaven..."
            </p>
            <span className="text-[10px] font-bold text-emerald-900 uppercase mt-0.5 block">
              Malachi 3:10 • 2 Corinthians 9:7
            </span>
          </div>

          {/* Signatures & Seal Section */}
          <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-6 text-[10px]">
            <div className="text-center">
              <div className="h-8 border-b border-dashed border-slate-400 mx-auto w-4/5 mb-1.5"></div>
              <span className="font-bold text-slate-800 block">Church Treasurer / Steward</span>
              <span className="text-slate-400">Finance & Stewardship Committee</span>
            </div>
            <div className="text-center">
              <div className="h-8 border-b border-dashed border-slate-400 mx-auto w-4/5 mb-1.5"></div>
              <span className="font-bold text-slate-800 block">{settings.senior_pastor || 'Prophet Elisha K. Richard'}</span>
              <span className="text-slate-400">Senior Pastor & General Overseer</span>
            </div>
          </div>

          {/* Security & Audit Footer */}
          <div className="pt-2 text-center text-[9px] text-slate-400 font-mono">
            Generated via GWCC Church Management System • Verification Ref: GWCC-TX-{record.id}
          </div>
        </div>
      </div>
    </div>
  );
};
