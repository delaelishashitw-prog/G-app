import React, { useState, useMemo } from 'react';
import {
  HeartHandshake,
  Plus,
  Search,
  Filter,
  Calendar,
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Printer,
  ChevronRight,
  TrendingUp,
  User,
  Shield,
  CreditCard,
  Building,
  Tag,
  Phone,
  ArrowUpRight,
  DollarSign,
  Download,
  Trash2,
} from 'lucide-react';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { WelfareClaim, WelfareContribution, WelfareClaimCategory, WelfareClaimStatus } from '../types/database.types';
import { ApplyWelfareClaimModal } from '../components/welfare/ApplyWelfareClaimModal';
import { ReviewWelfareClaimModal } from '../components/welfare/ReviewWelfareClaimModal';
import { BenevolenceVoucherModal } from '../components/welfare/BenevolenceVoucherModal';
import { RecordWelfareDuesModal } from '../components/welfare/RecordWelfareDuesModal';

export const WelfarePage: React.FC = () => {
  const {
    welfareContributions,
    welfareClaims,
    members,
    settings,
    deleteWelfareContribution,
    deleteWelfareClaim,
  } = useChurchData();
  const { canAccess } = useAuth();
  const { success, warning } = useToast();

  const [activeTab, setActiveTab] = useState<'claims' | 'dues' | 'members' | 'policy'>('claims');

  // Search & Filter state for claims
  const [claimSearch, setClaimSearch] = useState('');
  const [claimCategoryFilter, setClaimCategoryFilter] = useState('ALL');
  const [claimStatusFilter, setClaimStatusFilter] = useState('ALL');

  // Search & Filter state for dues
  const [duesSearch, setDuesSearch] = useState('');
  const [duesMonthFilter, setDuesMonthFilter] = useState('ALL');

  // Modals state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isRecordDuesModalOpen, setIsRecordDuesModalOpen] = useState(false);
  const [selectedClaimForReview, setSelectedClaimForReview] = useState<WelfareClaim | null>(null);
  const [selectedClaimForVoucher, setSelectedClaimForVoucher] = useState<WelfareClaim | null>(null);

  // Aggregations
  const totalDuesCollected = useMemo(() => {
    return welfareContributions.reduce((sum, c) => sum + c.amount, 0);
  }, [welfareContributions]);

  const totalDisbursed = useMemo(() => {
    return welfareClaims
      .filter((c) => c.status === 'disbursed')
      .reduce((sum, c) => sum + (c.amount_approved || c.amount_requested), 0);
  }, [welfareClaims]);

  const fundBalance = Math.max(0, totalDuesCollected - totalDisbursed + 15400.0); // With initial church welfare capital base

  const pendingClaimsCount = welfareClaims.filter((c) => c.status === 'pending' || c.status === 'under_review').length;

  const uniqueContributorsCount = new Set(welfareContributions.map((c) => c.member_id)).size;

  // Filtered Claims
  const filteredClaims = useMemo(() => {
    return welfareClaims.filter((c) => {
      const matchSearch =
        c.claim_number.toLowerCase().includes(claimSearch.toLowerCase()) ||
        c.member_name.toLowerCase().includes(claimSearch.toLowerCase()) ||
        c.title.toLowerCase().includes(claimSearch.toLowerCase());
      const matchCategory = claimCategoryFilter === 'ALL' || c.category === claimCategoryFilter;
      const matchStatus = claimStatusFilter === 'ALL' || c.status === claimStatusFilter;
      return matchSearch && matchCategory && matchStatus;
    });
  }, [welfareClaims, claimSearch, claimCategoryFilter, claimStatusFilter]);

  // Unique Months for dues filter
  const availableMonths = useMemo(() => {
    const set = new Set(welfareContributions.map((c) => c.month));
    return Array.from(set).sort().reverse();
  }, [welfareContributions]);

  // Filtered Dues
  const filteredDues = useMemo(() => {
    return welfareContributions.filter((c) => {
      const matchSearch =
        c.member_name.toLowerCase().includes(duesSearch.toLowerCase()) ||
        (c.tithe_number && c.tithe_number.toLowerCase().includes(duesSearch.toLowerCase())) ||
        (c.reference_no && c.reference_no.toLowerCase().includes(duesSearch.toLowerCase()));
      const matchMonth = duesMonthFilter === 'ALL' || c.month === duesMonthFilter;
      return matchSearch && matchMonth;
    });
  }, [welfareContributions, duesSearch, duesMonthFilter]);

  // Member welfare balances
  const memberWelfareSummary = useMemo(() => {
    return members
      .filter((m) => !m.is_archived)
      .map((m) => {
        const memContributions = welfareContributions.filter((c) => c.member_id === m.id);
        const memClaims = welfareClaims.filter((c) => c.member_id === m.id && c.status === 'disbursed');
        const duesSum = memContributions.reduce((s, c) => s + c.amount, 0);
        const aidSum = memClaims.reduce((s, c) => s + (c.amount_approved || c.amount_requested), 0);
        return {
          member: m,
          contributionsCount: memContributions.length,
          totalContributed: duesSum,
          totalReceived: aidSum,
          claimsCount: memClaims.length,
          netPosition: duesSum - aidSum,
        };
      })
      .sort((a, b) => b.totalContributed - a.totalContributed);
  }, [members, welfareContributions, welfareClaims]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <HeartHandshake className="w-6 h-6 text-emerald-700" />
              Welfare & Benevolence Mutual Fund
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Greater Works City Church congregational benevolence, welfare dues, and emergency relief assistance
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsRecordDuesModalOpen(true)}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 shadow-2xs transition flex items-center gap-1.5"
          >
            <CreditCard className="w-4 h-4 text-emerald-700" />
            Record Welfare Dues
          </button>
          <button
            onClick={() => setIsApplyModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Apply for Benevolence Aid
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Fund Balance */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Fund Reserve Balance</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            GH₵ {fundBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1">
            Capital base + current contributions
          </div>
        </div>

        {/* Total Dues Collected */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Dues Collected</span>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            GH₵ {totalDuesCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {welfareContributions.length} total recorded receipts
          </div>
        </div>

        {/* Benevolence Disbursed */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Benevolence Disbursed</span>
            <HeartHandshake className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            GH₵ {totalDisbursed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Paid out in compassionate aid
          </div>
        </div>

        {/* Pending Claims */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Applications</span>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{pendingClaimsCount}</div>
          <div className="text-[11px] text-amber-700 font-semibold mt-1">
            Awaiting committee review
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 text-sm font-bold">
        <button
          onClick={() => setActiveTab('claims')}
          className={`pb-3 transition flex items-center gap-2 border-b-2 ${
            activeTab === 'claims'
              ? 'border-emerald-800 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          Benevolence Aid Claims
          {pendingClaimsCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
              {pendingClaimsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('dues')}
          className={`pb-3 transition flex items-center gap-2 border-b-2 ${
            activeTab === 'dues'
              ? 'border-emerald-800 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Monthly Welfare Dues Ledger
        </button>

        <button
          onClick={() => setActiveTab('members')}
          className={`pb-3 transition flex items-center gap-2 border-b-2 ${
            activeTab === 'members'
              ? 'border-emerald-800 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <User className="w-4 h-4" />
          Member Welfare Standing
        </button>

        <button
          onClick={() => setActiveTab('policy')}
          className={`pb-3 transition flex items-center gap-2 border-b-2 ${
            activeTab === 'policy'
              ? 'border-emerald-800 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Shield className="w-4 h-4" />
          GWCC Welfare Constitution & Policy
        </button>
      </div>

      {/* TAB 1: CLAIMS & APPLICATIONS */}
      {activeTab === 'claims' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search claims, member, or subject..."
                value={claimSearch}
                onChange={(e) => setClaimSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={claimCategoryFilter}
                onChange={(e) => setClaimCategoryFilter(e.target.value)}
                className="text-xs rounded-xl border border-slate-200 py-1.5 px-2.5 bg-white text-slate-700 font-medium"
              >
                <option value="ALL">All Categories</option>
                <option value="bereavement">Bereavement</option>
                <option value="hospital_medical">Medical & Surgery</option>
                <option value="childbirth_naming">Childbirth & Naming</option>
                <option value="wedding_marriage">Holy Matrimony</option>
                <option value="education_welfare">Education Subsidy</option>
                <option value="emergency_relief">Emergency Relief</option>
              </select>

              <select
                value={claimStatusFilter}
                onChange={(e) => setClaimStatusFilter(e.target.value)}
                className="text-xs rounded-xl border border-slate-200 py-1.5 px-2.5 bg-white text-slate-700 font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="disbursed">Disbursed</option>
                <option value="declined">Declined</option>
              </select>
            </div>
          </div>

          {/* Claims Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Claim ID & Date</th>
                    <th className="py-3 px-4">Member / Payee</th>
                    <th className="py-3 px-4">Assistance Category</th>
                    <th className="py-3 px-4">Subject & Circumstances</th>
                    <th className="py-3 px-4 text-right">Requested</th>
                    <th className="py-3 px-4 text-right">Approved</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredClaims.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No benevolence aid applications found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredClaims.map((claim) => (
                      <tr key={claim.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-slate-900 block">{claim.claim_number}</span>
                          <span className="text-[10px] text-slate-400">{claim.date_submitted}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">{claim.member_name}</span>
                          <span className="text-[10px] text-slate-500">{claim.member_phone || 'N/A'}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium capitalize text-slate-700">
                            {claim.category.replace('_', ' ')}
                          </span>
                          {claim.emergency_level === 'critical' && (
                            <span className="block text-[9px] font-bold text-rose-700 uppercase">Critical</span>
                          )}
                          {claim.emergency_level === 'urgent' && (
                            <span className="block text-[9px] font-bold text-amber-700 uppercase">Urgent</span>
                          )}
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <p className="font-bold text-slate-900 truncate">{claim.title}</p>
                          <p className="text-[11px] text-slate-500 truncate">{claim.description}</p>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                          GH₵ {claim.amount_requested.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                          {claim.amount_approved ? `GH₵ ${claim.amount_approved.toFixed(2)}` : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-semibold text-[10px] uppercase px-2 py-0.5 rounded-lg border ${
                              claim.status === 'disbursed'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : claim.status === 'approved'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : claim.status === 'declined'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : claim.status === 'under_review'
                                ? 'bg-purple-50 text-purple-800 border-purple-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {claim.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedClaimForReview(claim)}
                              className="px-2.5 py-1 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-[11px] transition"
                            >
                              Review
                            </button>
                            {(claim.status === 'approved' || claim.status === 'disbursed') && (
                              <button
                                onClick={() => setSelectedClaimForVoucher(claim)}
                                title="Print / View Payment Voucher"
                                className="p-1 text-emerald-800 hover:bg-emerald-50 rounded-lg transition"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (window.confirm(`Delete claim ${claim.claim_number}?`)) {
                                  deleteWelfareClaim(claim.id);
                                  success('Claim Removed', claim.claim_number);
                                }
                              }}
                              title="Delete record"
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MONTHLY DUES LEDGER */}
      {activeTab === 'dues' && (
        <div className="space-y-4">
          <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search member, tithe no, receipt ref..."
                value={duesSearch}
                onChange={(e) => setDuesSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={duesMonthFilter}
                onChange={(e) => setDuesMonthFilter(e.target.value)}
                className="text-xs rounded-xl border border-slate-200 py-1.5 px-2.5 bg-white text-slate-700 font-medium"
              >
                <option value="ALL">All Contribution Months</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    Month: {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Date & Receipt Ref</th>
                    <th className="py-3 px-4">Member Name</th>
                    <th className="py-3 px-4">Tithe No</th>
                    <th className="py-3 px-4">Month Applicable</th>
                    <th className="py-3 px-4">Payment Channel</th>
                    <th className="py-3 px-4 text-right">Amount Paid</th>
                    <th className="py-3 px-4">Recorded By</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDues.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No welfare dues recorded matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredDues.map((due) => (
                      <tr key={due.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-slate-900 block">{due.reference_no || '—'}</span>
                          <span className="text-[10px] text-slate-400">{due.date}</span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">{due.member_name}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{due.tithe_number || '—'}</td>
                        <td className="py-3 px-4 font-semibold text-slate-700">{due.month}</td>
                        <td className="py-3 px-4">
                          <span className="text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {due.payment_channel || due.payment_method}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800">
                          GH₵ {due.amount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-[11px] text-slate-500">{due.recorded_by}</td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete welfare receipt ${due.reference_no}?`)) {
                                deleteWelfareContribution(due.id);
                                success('Receipt Deleted', due.reference_no);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MEMBER WELFARE STANDING */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Member Benevolence & Dues Standing</h3>
                <p className="text-xs text-slate-500">
                  Lifetime mutual welfare contributions compared to benefits claimed
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                {uniqueContributorsCount} Active Contributors
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Member Name</th>
                    <th className="py-3 px-4">Tithe Index</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4 text-center">Dues Paid Count</th>
                    <th className="py-3 px-4 text-right">Total Contributed</th>
                    <th className="py-3 px-4 text-right">Aid Received</th>
                    <th className="py-3 px-4 text-right">Net Fund Standing</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {memberWelfareSummary.map(({ member, contributionsCount, totalContributed, totalReceived, netPosition }) => (
                    <tr key={member.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {member.first_name} {member.last_name}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">{member.tithe_number || '—'}</td>
                      <td className="py-3 px-4 text-slate-500">{member.phone}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-bold">
                          {contributionsCount} months
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800">
                        GH₵ {totalContributed.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">
                        GH₵ {totalReceived.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span className={netPosition >= 0 ? 'text-emerald-700' : 'text-amber-700'}>
                          {netPosition >= 0 ? '+' : ''}GH₵ {netPosition.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            setIsRecordDuesModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold rounded-lg text-[11px] transition"
                        >
                          + Record Dues
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GWCC WELFARE CONSTITUTION & POLICY */}
      {activeTab === 'policy' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6 max-w-4xl">
          <div className="border-b border-slate-200 pb-4">
            <h3 className="text-base font-bold text-slate-900">
              Greater Works City Church (GWCC) Welfare Constitution & Mutual Aid Guidelines
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Approved by the Pastoral Council under the spiritual oversight of Prophet Elisha K. Richard
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                1. Dues & Eligibility (Article 2)
              </h4>
              <p className="text-slate-600 leading-relaxed">
                Every registered member of GWCC is encouraged to contribute a monthly welfare token of{' '}
                <strong className="text-slate-900">GH₵ 50.00</strong> (minimum GH₵ 20.00 for students/seniors). Members
                are entitled to full benefits after 3 consecutive months of active fellowship.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                2. Bereavement Support (Article 3)
              </h4>
              <ul className="text-slate-600 space-y-1 list-disc pl-4">
                <li>Loss of Member: <strong>GH₵ 2,000.00</strong> + church choir delegation.</li>
                <li>Loss of Nuclear Spouse or Child: <strong>GH₵ 1,000.00</strong>.</li>
                <li>Loss of Biological Parent: <strong>GH₵ 800.00</strong>.</li>
              </ul>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                3. Hospitalization & Medical Relief (Article 4)
              </h4>
              <p className="text-slate-600 leading-relaxed">
                Emergency hospital admission aid up to <strong className="text-slate-900">GH₵ 1,500.00</strong> disbursed
                directly to medical accounts or pharmacy prescriptions upon submission of hospital paperwork.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                4. Celebratory Nuptials & Childbirth (Article 5)
              </h4>
              <ul className="text-slate-600 space-y-1 list-disc pl-4">
                <li>Holy Matrimony Nuptial Grant: <strong>GH₵ 800.00</strong>.</li>
                <li>New Birth / Outdoor Naming Ceremony: <strong>GH₵ 500.00</strong>.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <ApplyWelfareClaimModal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
      />

      <RecordWelfareDuesModal
        isOpen={isRecordDuesModalOpen}
        onClose={() => setIsRecordDuesModalOpen(false)}
      />

      <ReviewWelfareClaimModal
        claim={selectedClaimForReview}
        isOpen={Boolean(selectedClaimForReview)}
        onClose={() => setSelectedClaimForReview(null)}
        onOpenDisburseModal={(claim) => {
          setSelectedClaimForVoucher(claim);
        }}
      />

      <BenevolenceVoucherModal
        claim={selectedClaimForVoucher}
        isOpen={Boolean(selectedClaimForVoucher)}
        onClose={() => setSelectedClaimForVoucher(null)}
      />
    </div>
  );
};
