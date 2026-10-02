import React, { useMemo } from 'react';
import { X, Calendar, MessageCircle, FileText, CheckCircle2, TrendingUp, CreditCard } from 'lucide-react';
import { Member, GivingRecord } from '../../types/database.types';
import { formatGHS, cleanGhanaPhone } from '../../lib/currencyUtils';
import { normalizeDateStr } from '../../lib/financeDateUtils';

interface MemberTitheHistoryModalProps {
  member: Member;
  givingRecords: GivingRecord[];
  onOpenStatement: (member: Member) => void;
  onClose: () => void;
}

export const MemberTitheHistoryModal: React.FC<MemberTitheHistoryModalProps> = ({
  member,
  givingRecords,
  onOpenStatement,
  onClose,
}) => {
  // Tithe records specifically for this member
  const titheRecords = useMemo(() => {
    return givingRecords
      .filter((g) => g.member_id === member.id && g.category === 'Tithe')
      .sort((a, b) => {
        const dateA = normalizeDateStr(a.date);
        const dateB = normalizeDateStr(b.date);
        return dateB.localeCompare(dateA);
      });
  }, [givingRecords, member.id]);

  // Other giving records for this member (offerings, building fund, etc.)
  const otherRecords = useMemo(() => {
    return givingRecords
      .filter((g) => g.member_id === member.id && g.category !== 'Tithe')
      .sort((a, b) => {
        const dateA = normalizeDateStr(a.date);
        const dateB = normalizeDateStr(b.date);
        return dateB.localeCompare(dateA);
      });
  }, [givingRecords, member.id]);

  const totalTithes = useMemo(() => {
    return titheRecords.reduce((sum, r) => sum + r.amount, 0);
  }, [titheRecords]);

  const totalOther = useMemo(() => {
    return otherRecords.reduce((sum, r) => sum + r.amount, 0);
  }, [otherRecords]);

  const averageTithe = titheRecords.length > 0 ? totalTithes / titheRecords.length : 0;

  const cleanPhone = cleanGhanaPhone(member.phone);
  const waAppreciationMsg = `Dear ${member.first_name}, blessings from Greater Works City Church! Prophet Elisha and the pastoral council appreciate your faithful covenant partnership in tithes and offerings. May God richly replenish and protect your household!`;
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waAppreciationMsg)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-[#064e3b] text-white flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold">
                {member.first_name} {member.last_name}
              </h3>
              {member.tithe_number && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-800 text-[11px] font-mono font-bold">
                  Tithe #{member.tithe_number}
                </span>
              )}
            </div>
            <p className="text-xs text-emerald-200">
              {member.member_id} • {member.phone} • {member.residential_address || 'Joma'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-white/80 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Summary Cards */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-3 gap-3 text-xs shrink-0">
          <div className="p-3 bg-white rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Tithes</span>
            <span className="text-base font-extrabold text-emerald-800 font-mono mt-0.5 block">
              {formatGHS(totalTithes)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">{titheRecords.length} tithe records</span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Average Tithe</span>
            <span className="text-base font-extrabold text-slate-900 font-mono mt-0.5 block">
              {formatGHS(averageTithe)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Per contribution</span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Other Giving</span>
            <span className="text-base font-extrabold text-purple-700 font-mono mt-0.5 block">
              {formatGHS(totalOther)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">{otherRecords.length} offerings / seed</span>
          </div>
        </div>

        {/* Transactions Scroll Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          <div>
            <h4 className="font-bold text-slate-900 mb-2 flex items-center justify-between">
              <span>Covenant Tithe History ({titheRecords.length})</span>
              <span className="text-slate-400 font-normal text-[11px]">Most recent first</span>
            </h4>

            {titheRecords.length === 0 ? (
              <div className="p-6 text-center text-slate-400 border border-dashed rounded-xl">
                No tithe records logged for this member yet.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Amount (GH₵)</th>
                      <th className="py-2.5 px-3">Method & Channel</th>
                      <th className="py-2.5 px-3">Service</th>
                      <th className="py-2.5 px-3">Receipt / Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {titheRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-mono text-slate-600">{normalizeDateStr(r.date) || r.date}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-800 text-sm">
                          {formatGHS(r.amount)}
                        </td>
                        <td className="py-2.5 px-3 capitalize text-slate-700">
                          {r.payment_method.replace('_', ' ')}
                          {r.payment_channel ? ` (${r.payment_channel})` : ''}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{r.service_name || 'Sunday Service'}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">{r.reference_number || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {otherRecords.length > 0 && (
            <div>
              <h4 className="font-bold text-slate-900 mb-2">
                Other Church Offerings & Pledges ({otherRecords.length})
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                    <tr>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3">Amount (GH₵)</th>
                      <th className="py-2 px-3">Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {otherRecords.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2 px-3 font-mono text-slate-600">{normalizeDateStr(r.date) || r.date}</td>
                        <td className="py-2 px-3 font-semibold text-slate-800">{r.category}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900">{formatGHS(r.amount)}</td>
                        <td className="py-2 px-3 capitalize text-slate-500">{r.payment_method.replace('_', ' ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          {cleanPhone ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-2xs"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Send WhatsApp Appreciation</span>
            </a>
          ) : (
            <span
              className="px-3 py-2 rounded-xl bg-slate-200 text-slate-500 font-semibold text-xs flex items-center gap-1.5 cursor-not-allowed"
              title="No valid Ghanaian phone number recorded for member"
            >
              <MessageCircle className="w-4 h-4" />
              <span>No Phone Number</span>
            </span>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenStatement(member)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <FileText className="w-4 h-4 text-emerald-800" />
              <span>Generate Full Giving Statement</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
