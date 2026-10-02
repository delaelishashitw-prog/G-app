import React, { useState } from 'react';
import { Printer, Copy, Check, X, Calculator, ShieldCheck } from 'lucide-react';
import { ChurchSettings } from '../../types/database.types';
import { formatGHS, numberToCedisWords } from '../../lib/currencyUtils';
import { useToast } from '../../contexts/ToastContext';

interface DenominationRow {
  label: string;
  value: number;
  count: number;
}

interface SundayTallySheetModalProps {
  settings: ChurchSettings;
  serviceName: string;
  date?: string;
  supervisor: string;
  envelopesCount: number;
  denominations: DenominationRow[];
  cashTotal: number;
  momoTotal: number;
  telecelTotal: number;
  usdAmount: number;
  usdRate: number;
  foreignConvertedGhs: number;
  grandTotal: number;
  notes: string;
  onClose: () => void;
}

export const SundayTallySheetModal: React.FC<SundayTallySheetModalProps> = ({
  settings,
  serviceName,
  date,
  supervisor,
  envelopesCount,
  denominations,
  cashTotal,
  momoTotal,
  telecelTotal,
  usdAmount,
  usdRate,
  foreignConvertedGhs,
  grandTotal,
  notes,
  onClose,
}) => {
  const { success } = useToast();
  const [copied, setCopied] = useState(false);
  const effectiveDate = date || new Date().toISOString().split('T')[0];

  const digitalTotal = momoTotal + telecelTotal;

  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = () => {
    const text = `GREATER WORKS CITY CHURCH
SUNDAY OFFERING RECONCILIATION TALLY SHEET
Service: ${serviceName}
Date: ${effectiveDate}
Supervisor: ${supervisor}
Envelopes Counted: ${envelopesCount}

PHYSICAL CASH COUNT:
${denominations
  .filter((d) => d.count > 0)
  .map((d) => `• ${d.label}: ${d.count} pcs = ${formatGHS(d.value * d.count)}`)
  .join('\n')}
Total Physical Cash: ${formatGHS(cashTotal)}

DIGITAL GIVING:
• MTN MoMo: ${formatGHS(momoTotal)}
• Telecel Cash: ${formatGHS(telecelTotal)}
Total Digital: ${formatGHS(digitalTotal)}
${usdAmount > 0 ? `\nFOREIGN CURRENCY:\n• $${usdAmount} USD @ ${usdRate} = ${formatGHS(foreignConvertedGhs)}` : ''}

GRAND SERVICE TOTAL: ${formatGHS(grandTotal)}
(${numberToCedisWords(grandTotal)})

Notes: ${notes || 'Verified by Counting Committee'}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    success('Tally Summary Copied', 'Summary copied to clipboard.');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto print:bg-transparent print:p-0 print:static print:overflow-visible">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[94vh] flex flex-col print:shadow-none print:border-none print:m-0 print:max-w-none print:max-h-none print:w-full">
        {/* Top Control Bar (Hidden on print) */}
        <div className="no-print px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
              <Calculator className="w-4 h-4" />
            </span>
            <div>
              <span className="text-xs font-bold block">Sunday Offering Reconciliation Sheet</span>
              <span className="text-[10px] text-slate-400">{serviceName}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySummary}
              className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
              title="Copy summary text"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Sheet</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Sheet Body */}
        <div className="p-6 sm:p-8 space-y-5 text-slate-900 bg-white overflow-y-auto flex-1 print:p-0">
          {/* Header & Letterhead */}
          <div className="flex items-start justify-between pb-4 border-b-2 border-amber-900 gap-4">
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
                <p className="text-xs font-medium text-amber-900">
                  {settings.branch_name || 'Joma Assembly'} • Accra, Ghana
                </p>
                <p className="text-[10px] text-slate-500">
                  Church Treasury & Ushers Directorate • Sunday Offering Reconciliation Slip
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                Official Tally Slip
              </span>
              <div className="text-xs font-bold font-mono text-slate-800">Date: {effectiveDate}</div>
              <div className="text-[10px] text-slate-500">Audited Form GW-OFF-01</div>
            </div>
          </div>

          {/* Service Meta Bar */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Church Service</span>
              <span className="font-bold text-slate-900">{serviceName}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Supervisor / Lead Usher</span>
              <span className="font-bold text-slate-900">{supervisor || 'Finance Committee'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Envelopes Counted</span>
              <span className="font-bold font-mono text-slate-900">{envelopesCount} envelopes</span>
            </div>
          </div>

          {/* Physical Cash Denominations Table */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center justify-between">
              <span>Section A: Physical Cash Denomination Breakdown</span>
              <span className="text-emerald-800 font-mono font-bold">Subtotal: {formatGHS(cashTotal)}</span>
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  <tr>
                    <th className="py-2 px-3">Ghana Cedi Bill / Coin</th>
                    <th className="py-2 px-3">Unit Value</th>
                    <th className="py-2 px-3 text-center">Pieces Count</th>
                    <th className="py-2 px-3 text-right">Subtotal (GH₵)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {denominations.map((row) => {
                    const rowSubtotal = row.value * row.count;
                    return (
                      <tr key={row.label} className={row.count > 0 ? 'bg-amber-50/20' : ''}>
                        <td className="py-1.5 px-3 font-sans font-semibold text-slate-900">{row.label}</td>
                        <td className="py-1.5 px-3 text-slate-600">GH₵ {row.value.toFixed(2)}</td>
                        <td className="py-1.5 px-3 text-center font-bold text-slate-800">{row.count}</td>
                        <td className="py-1.5 px-3 text-right font-bold text-slate-900">
                          {formatGHS(rowSubtotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-xs">
                  <tr>
                    <td colSpan={3} className="py-2 px-3 text-slate-700 text-right">
                      Total Physical Cash Collection:
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-900">
                      {formatGHS(cashTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Section B: Digital & Foreign Currencies */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Section B: Digital Giving Settlements
              </span>
              <div className="flex justify-between">
                <span className="text-slate-600">MTN Mobile Money:</span>
                <span className="font-mono font-bold text-slate-900">{formatGHS(momoTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Telecel Cash:</span>
                <span className="font-mono font-bold text-slate-900">{formatGHS(telecelTotal)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 font-semibold">
                <span className="text-slate-700">Digital Subtotal:</span>
                <span className="font-mono text-amber-900">{formatGHS(digitalTotal)}</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Section C: Foreign Currencies
              </span>
              <div className="flex justify-between">
                <span className="text-slate-600">US Dollars:</span>
                <span className="font-mono font-bold text-slate-900">${usdAmount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Exchange Rate:</span>
                <span className="font-mono text-slate-700">1 USD = {usdRate} GHS</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 font-semibold">
                <span className="text-slate-700">Converted GHS:</span>
                <span className="font-mono text-blue-900">{formatGHS(foreignConvertedGhs)}</span>
              </div>
            </div>
          </div>

          {/* Grand Service Total Banner */}
          <div className="p-4 bg-amber-950 text-white rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-amber-300 block">
                Grand Offering & Tithe Total
              </span>
              <span className="text-xl sm:text-2xl font-black font-mono">
                {formatGHS(grandTotal)}
              </span>
            </div>
            <div className="sm:text-right max-w-[280px]">
              <span className="text-[10px] text-amber-200 block uppercase">Sum in Words</span>
              <span className="text-xs font-medium italic text-amber-100">
                {numberToCedisWords(grandTotal)}
              </span>
            </div>
          </div>

          {notes && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Counter Notes</span>
              <p className="text-slate-700 italic">{notes}</p>
            </div>
          )}

          {/* Signatures Section */}
          <div className="pt-4 border-t border-slate-200 grid grid-cols-3 gap-4 text-[10px]">
            <div className="text-center">
              <div className="h-8 border-b border-dashed border-slate-400 mx-auto w-4/5 mb-1.5"></div>
              <span className="font-bold text-slate-800 block">Head Usher / Counter</span>
              <span className="text-slate-400">Signature & Date</span>
            </div>
            <div className="text-center">
              <div className="h-8 border-b border-dashed border-slate-400 mx-auto w-4/5 mb-1.5"></div>
              <span className="font-bold text-slate-800 block">Treasury Steward</span>
              <span className="text-slate-400">{supervisor || 'Deacon'}</span>
            </div>
            <div className="text-center">
              <div className="h-8 border-b border-dashed border-slate-400 mx-auto w-4/5 mb-1.5"></div>
              <span className="font-bold text-slate-800 block">Presiding Pastor</span>
              <span className="text-slate-400">Verification</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
