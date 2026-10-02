import React, { useState, useMemo } from 'react';
import { Printer, Calendar, X, Download, ShieldCheck, UserCheck } from 'lucide-react';
import { Member, GivingRecord, ChurchSettings } from '../../types/database.types';
import { formatGHS, numberToCedisWords } from '../../lib/currencyUtils';
import { normalizeDateStr } from '../../lib/financeDateUtils';

interface MemberGivingStatementModalProps {
  member: Member;
  givingRecords: GivingRecord[];
  settings: ChurchSettings;
  onClose: () => void;
}

export const MemberGivingStatementModal: React.FC<MemberGivingStatementModalProps> = ({
  member,
  givingRecords,
  settings,
  onClose,
}) => {
  const currentYear = new Date().getFullYear().toString();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Dynamically compute available giving years from records and current calendar
  const availableYears = useMemo(() => {
    const yNow = new Date().getFullYear();
    const set = new Set<string>([String(yNow), String(yNow - 1), String(yNow - 2)]);
    givingRecords.forEach((r) => {
      const normalized = normalizeDateStr(r.date);
      if (normalized) {
        const y = normalized.slice(0, 4);
        if (/^\d{4}$/.test(y)) set.add(y);
      }
    });
    return Array.from(set).sort().reverse();
  }, [givingRecords]);

  // Filter records belonging to this member for selected year
  const memberRecords = useMemo(() => {
    return givingRecords
      .filter((g) => g.member_id === member.id && normalizeDateStr(g.date).startsWith(selectedYear))
      .sort((a, b) => {
        const dateA = normalizeDateStr(a.date);
        const dateB = normalizeDateStr(b.date);
        return dateB.localeCompare(dateA);
      });
  }, [givingRecords, member.id, selectedYear]);

  // Aggregate totals by category
  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    memberRecords.forEach((r) => {
      map[r.category] = (map[r.category] || 0) + r.amount;
    });
    return map;
  }, [memberRecords]);

  const grandTotal = useMemo(() => {
    return memberRecords.reduce((sum, r) => sum + r.amount, 0);
  }, [memberRecords]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto print:bg-transparent print:p-0 print:static print:overflow-visible">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[92vh] flex flex-col print:shadow-none print:border-none print:m-0 print:max-w-none print:max-h-none print:w-full">
        {/* Top Control Bar (Hidden during print) */}
        <div className="no-print px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <UserCheck className="w-4 h-4" />
            </span>
            <div>
              <span className="text-xs font-bold block">Annual Member Giving & Tithe Statement</span>
              <span className="text-[10px] text-slate-400">
                {member.first_name} {member.last_name} ({member.member_id})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-hidden cursor-pointer"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr} className="bg-slate-800">
                    Tax Year {yr}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Statement Printable Body */}
        <div className="p-6 sm:p-8 space-y-6 text-slate-900 bg-white overflow-y-auto flex-1 print:p-0">
          {/* Header Letterhead */}
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
              <span className="inline-block px-2.5 py-1 rounded bg-emerald-100 text-emerald-900 text-xs font-extrabold uppercase tracking-wider mb-1">
                Giving Statement
              </span>
              <div className="text-xs font-bold text-slate-700">Period: Jan 1 – Dec 31, {selectedYear}</div>
              <div className="text-[10px] text-slate-400">Date Issued: {new Date().toISOString().split('T')[0]}</div>
            </div>
          </div>

          {/* Member Details */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Contributor Name</span>
              <span className="text-sm font-bold text-slate-900 block">
                {member.first_name} {member.middle_name ? `${member.middle_name} ` : ''}{member.last_name}
              </span>
              <span className="text-[11px] text-slate-600">
                {member.residential_address || 'Joma, Greater Accra'}
              </span>
            </div>
            <div className="sm:text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Member ID & Tithe #</span>
              <span className="font-mono font-bold text-slate-900 block">
                {member.member_id} {member.tithe_number ? `• Tithe #${member.tithe_number}` : ''}
              </span>
              <span className="text-[11px] text-slate-600">{member.phone}</span>
            </div>
          </div>

          {/* Category Summary Breakdown */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Summary of Contributions ({selectedYear})
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {Object.entries(categoryTotals).length === 0 ? (
                <div className="col-span-4 p-4 text-center text-slate-400 border border-dashed rounded-xl text-xs">
                  No giving records found for {member.first_name} in {selectedYear}.
                </div>
              ) : (
                Object.entries(categoryTotals).map(([cat, total]) => (
                  <div key={cat} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-semibold block uppercase truncate">{cat}</span>
                    <span className="text-sm font-extrabold text-slate-900 font-mono mt-0.5 block">
                      {formatGHS(total)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Grand Total Callout */}
          <div className="p-4 bg-emerald-900 text-white rounded-xl flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-300 block">
                Total Cumulative Contributions ({selectedYear})
              </span>
              <span className="text-xl sm:text-2xl font-black font-mono">
                {formatGHS(grandTotal)}
              </span>
            </div>
            <div className="text-right max-w-[280px]">
              <span className="text-[10px] text-emerald-200 block uppercase">In Words</span>
              <span className="text-xs font-medium italic text-emerald-100">
                {numberToCedisWords(grandTotal)}
              </span>
            </div>
          </div>

          {/* Itemized Transactions Table */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Itemized Giving Ledger ({memberRecords.length} entries)
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Method & Channel</th>
                    <th className="py-2.5 px-3">Receipt / Ref</th>
                    <th className="py-2.5 px-3 text-right">Amount (GH₵)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {memberRecords.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 px-3 font-mono text-slate-600">{normalizeDateStr(r.date) || r.date}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900">{r.category}</td>
                      <td className="py-2 px-3 text-slate-600 capitalize">
                        {r.payment_method.replace('_', ' ')}
                        {r.payment_channel ? ` (${r.payment_channel})` : ''}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-500">{r.reference_number || '-'}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        {formatGHS(r.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Closing & Signatures */}
          <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-8 text-[10px]">
            <div className="text-center">
              <div className="h-10 border-b border-dashed border-slate-400 mx-auto w-4/5 mb-1.5 flex items-end justify-center pb-0.5">
                <span className="font-serif italic text-xs text-slate-700">{settings.senior_pastor || 'Prophet Elisha K. Richard'}</span>
              </div>
              <span className="font-bold text-slate-800 block">Senior Minister / Overseer</span>
              <span className="text-slate-400">Greater Works City Church</span>
            </div>
            <div className="text-center">
              <div className="h-10 border-b border-dashed border-slate-400 mx-auto w-4/5 mb-1.5 flex items-end justify-center pb-0.5">
                <span className="font-serif italic text-xs text-slate-700">{settings.general_secretary || 'Tamekloe Clara Gaewornu'}</span>
              </div>
              <span className="font-bold text-slate-800 block">General Secretary</span>
              <span className="text-slate-400">Official Church Seal</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
