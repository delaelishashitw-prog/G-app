import React from 'react';
import { X, Printer, HeartHandshake, ShieldCheck, Download, Calendar, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { WelfareClaim, WelfareContribution } from '../../types/database.types';

interface WelfareAuditReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WelfareAuditReportModal: React.FC<WelfareAuditReportModalProps> = ({ isOpen, onClose }) => {
  const { settings, welfareContributions, welfareClaims, members } = useChurchData();

  if (!isOpen) return null;

  const totalDuesCollected = welfareContributions.reduce((sum, c) => sum + c.amount, 0);
  const disbursedClaims = welfareClaims.filter((c) => c.status === 'disbursed');
  const totalDisbursed = disbursedClaims.reduce((sum, c) => sum + (c.amount_approved || c.amount_requested), 0);
  const fundReserve = Math.max(0, totalDuesCollected - totalDisbursed + 15400.0);
  const pendingClaims = welfareClaims.filter((c) => c.status === 'pending' || c.status === 'under_review');
  const pendingLiabilities = pendingClaims.reduce((sum, c) => sum + c.amount_requested, 0);

  // Category breakdown
  const categorySummary = [
    { key: 'bereavement', label: 'Bereavement Aid' },
    { key: 'hospital_medical', label: 'Medical & Surgery' },
    { key: 'emergency_relief', label: 'Emergency Relief' },
    { key: 'education_welfare', label: 'Education Subsidy' },
    { key: 'childbirth_naming', label: 'Childbirth & Naming' },
    { key: 'wedding_marriage', label: 'Holy Matrimony' },
  ].map((cat) => {
    const claimsInCat = welfareClaims.filter((c) => c.category === cat.key && c.status === 'disbursed');
    const amount = claimsInCat.reduce((s, c) => s + (c.amount_approved || c.amount_requested), 0);
    return {
      ...cat,
      count: claimsInCat.length,
      amount,
      percentage: totalDisbursed > 0 ? (amount / totalDisbursed) * 100 : 0,
    };
  });

  const handlePrint = () => {
    window.print();
  };

  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Controls Header (Hidden in Print) */}
        <div className="no-print px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold tracking-tight">GWCC Welfare & Benevolence Mutual Fund Statement</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-sm"
            >
              <Printer className="w-4 h-4" />
              Print Report
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Report Body */}
        <div className="p-8 overflow-y-auto space-y-6 text-slate-800 font-sans print:p-4 print:text-black">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-5 text-center sm:text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-widest text-emerald-700 font-bold">
                {settings.church_name || 'Greater Works City Church'}
              </span>
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight mt-0.5">
                Mutual Welfare & Benevolence Audit Report
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                {settings.location} · {settings.address} · Phone: {settings.phone}
              </p>
            </div>
            <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Statement Date</span>
              <span className="text-sm font-bold text-slate-800">{currentDate}</span>
              <span className="text-[11px] text-emerald-700 block mt-0.5 font-medium">Fiscal Status: Active</span>
            </div>
          </div>

          {/* Executive Overview KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Dues Collected</span>
              <span className="text-lg font-black text-slate-900 block mt-1">GH₵ {totalDuesCollected.toFixed(2)}</span>
              <span className="text-[11px] text-slate-500">{welfareContributions.length} contributions</span>
            </div>
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Relief Disbursed</span>
              <span className="text-lg font-black text-slate-900 block mt-1">GH₵ {totalDisbursed.toFixed(2)}</span>
              <span className="text-[11px] text-slate-500">{disbursedClaims.length} grants authorized</span>
            </div>
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Fund Reserve</span>
              <span className="text-lg font-black text-emerald-700 block mt-1">GH₵ {fundReserve.toFixed(2)}</span>
              <span className="text-[11px] text-slate-500">Includes seed capital</span>
            </div>
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Pending Requests</span>
              <span className="text-lg font-black text-amber-700 block mt-1">GH₵ {pendingLiabilities.toFixed(2)}</span>
              <span className="text-[11px] text-slate-500">{pendingClaims.length} awaiting review</span>
            </div>
          </div>

          {/* Aid Category Distribution Breakdown */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Disbursed Benevolence Allocation by Category
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {categorySummary.map((cat) => (
                <div key={cat.key} className="p-3 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block">{cat.label}</span>
                    <span className="text-[11px] text-slate-500">{cat.count} grants issued</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-900 block">GH₵ {cat.amount.toFixed(2)}</span>
                    <span className="text-[11px] text-slate-500">{cat.percentage.toFixed(1)}% of total</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Disbursements Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Recent Benevolence Disbursements Log
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Voucher / Claim</th>
                    <th className="py-2.5 px-3">Beneficiary</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-right">Amount Disbursed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {disbursedClaims.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400">
                        No disbursed claims recorded.
                      </td>
                    </tr>
                  ) : (
                    disbursedClaims.slice(0, 8).map((c) => (
                      <tr key={c.id}>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-700">
                          {c.disbursement_voucher_no || c.claim_number}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-900">{c.member_name}</td>
                        <td className="py-2 px-3 capitalize text-slate-600">{c.category.replace('_', ' ')}</td>
                        <td className="py-2 px-3 text-slate-500">{c.disbursement_date || c.date_submitted}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          GH₵ {(c.amount_approved || c.amount_requested).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Official Endorsements & Signatures */}
          <div className="pt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center text-xs">
            <div>
              <div className="border-b border-slate-400 h-10 mb-2"></div>
              <span className="font-bold text-slate-900 block">{settings.senior_pastor || 'Prophet Elisha K. Richard'}</span>
              <span className="text-[11px] text-slate-500">General Overseer & Spiritual Patron</span>
            </div>
            <div>
              <div className="border-b border-slate-400 h-10 mb-2"></div>
              <span className="font-bold text-slate-900 block">Welfare Committee Chairman</span>
              <span className="text-[11px] text-slate-500">Mutual Fund Director</span>
            </div>
            <div>
              <div className="border-b border-slate-400 h-10 mb-2"></div>
              <span className="font-bold text-slate-900 block">{settings.general_secretary || 'General Secretary'}</span>
              <span className="text-[11px] text-slate-500">Church Administration & Audit</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
