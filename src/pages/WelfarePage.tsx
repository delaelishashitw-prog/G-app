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
  ChevronDown,
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
  Calculator,
  RotateCcw,
  Info,
  Check,
  AlertTriangle,
  X,
  Database,
  CloudCheck,
} from 'lucide-react';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { WelfareClaim, WelfareContribution, WelfareClaimCategory, WelfareClaimStatus } from '../types/database.types';
import { ApplyWelfareClaimModal } from '../components/welfare/ApplyWelfareClaimModal';
import { ReviewWelfareClaimModal } from '../components/welfare/ReviewWelfareClaimModal';
import { BenevolenceVoucherModal } from '../components/welfare/BenevolenceVoucherModal';
import { RecordWelfareDuesModal } from '../components/welfare/RecordWelfareDuesModal';
import { WelfareAuditReportModal } from '../components/welfare/WelfareAuditReportModal';

export const WelfarePage: React.FC = () => {
  const {
    welfareContributions,
    welfareClaims,
    members,
    settings,
    deleteWelfareContribution,
    deleteWelfareClaim,
    isSupabaseConfigured,
    supabaseStatus,
  } = useChurchData();
  const { canAccess } = useAuth();
  const { success, warning } = useToast();

  const [activeTab, setActiveTab] = useState<'claims' | 'dues' | 'members' | 'analytics' | 'policy'>('claims');

  // Search & Filter state for claims
  const [claimSearch, setClaimSearch] = useState('');
  const [claimCategoryFilter, setClaimCategoryFilter] = useState('ALL');
  const [claimStatusFilter, setClaimStatusFilter] = useState('ALL');
  const [claimUrgencyFilter, setClaimUrgencyFilter] = useState('ALL');
  const [expandedClaimId, setExpandedClaimId] = useState<string | null>(null);

  // Search & Filter state for dues
  const [duesSearch, setDuesSearch] = useState('');
  const [duesMonthFilter, setDuesMonthFilter] = useState('ALL');

  // Search for members tab
  const [memberSearch, setMemberSearch] = useState('');
  const [memberStandingFilter, setMemberStandingFilter] = useState<'ALL' | 'good' | 'probation' | 'none'>('ALL');

  // Modals state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isRecordDuesModalOpen, setIsRecordDuesModalOpen] = useState(false);
  const [selectedMemberForDues, setSelectedMemberForDues] = useState<string | undefined>(undefined);
  const [selectedClaimForReview, setSelectedClaimForReview] = useState<WelfareClaim | null>(null);
  const [selectedClaimForVoucher, setSelectedClaimForVoucher] = useState<WelfareClaim | null>(null);
  const [isAuditReportModalOpen, setIsAuditReportModalOpen] = useState(false);

  // In-App Deletion Confirmation Modal state
  const [itemToDelete, setItemToDelete] = useState<{
    type: 'claim' | 'due';
    id: string;
    title: string;
  } | null>(null);

  // Policy Calculator State
  const [calcCategory, setCalcCategory] = useState<WelfareClaimCategory>('bereavement');
  const [calcMonthsContributed, setCalcMonthsContributed] = useState<number>(6);

  // Aggregations
  const totalDuesCollected = useMemo(() => {
    return welfareContributions.reduce((sum, c) => sum + c.amount, 0);
  }, [welfareContributions]);

  const disbursedClaims = useMemo(() => {
    return welfareClaims.filter((c) => c.status === 'disbursed');
  }, [welfareClaims]);

  const totalDisbursed = useMemo(() => {
    return disbursedClaims.reduce((sum, c) => sum + (c.amount_approved || c.amount_requested), 0);
  }, [disbursedClaims]);

  const fundBalance = Math.max(0, totalDuesCollected - totalDisbursed + 15400.0); // Baseline church welfare reserve

  const pendingClaimsCount = useMemo(() => {
    return welfareClaims.filter((c) => c.status === 'pending' || c.status === 'under_review').length;
  }, [welfareClaims]);

  const uniqueContributorsCount = useMemo(() => {
    return new Set(welfareContributions.map((c) => c.member_id)).size;
  }, [welfareContributions]);

  // Filtered Claims
  const filteredClaims = useMemo(() => {
    const q = (claimSearch || '').toLowerCase().trim();
    return welfareClaims.filter((c) => {
      const matchSearch =
        !q ||
        (c.claim_number || '').toLowerCase().includes(q) ||
        (c.member_name || '').toLowerCase().includes(q) ||
        (c.title || '').toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q);
      const matchCategory = claimCategoryFilter === 'ALL' || c.category === claimCategoryFilter;
      const matchStatus = claimStatusFilter === 'ALL' || c.status === claimStatusFilter;
      const matchUrgency = claimUrgencyFilter === 'ALL' || c.emergency_level === claimUrgencyFilter;
      return matchSearch && matchCategory && matchStatus && matchUrgency;
    });
  }, [welfareClaims, claimSearch, claimCategoryFilter, claimStatusFilter, claimUrgencyFilter]);

  // Unique Months for dues filter
  const availableMonths = useMemo(() => {
    const set = new Set(welfareContributions.map((c) => c.month));
    return Array.from(set).sort().reverse();
  }, [welfareContributions]);

  // Filtered Dues
  const filteredDues = useMemo(() => {
    const q = (duesSearch || '').toLowerCase().trim();
    return welfareContributions.filter((c) => {
      const matchSearch =
        !q ||
        (c.member_name || '').toLowerCase().includes(q) ||
        (c.tithe_number && c.tithe_number.toLowerCase().includes(q)) ||
        (c.reference_no && c.reference_no.toLowerCase().includes(q)) ||
        (c.payment_channel && c.payment_channel.toLowerCase().includes(q));
      const matchMonth = duesMonthFilter === 'ALL' || c.month === duesMonthFilter;
      return matchSearch && matchMonth;
    });
  }, [welfareContributions, duesSearch, duesMonthFilter]);

  // Member welfare balances & standing
  const memberWelfareSummary = useMemo(() => {
    const q = (memberSearch || '').toLowerCase().trim();
    return members
      .filter((m) => !m.is_archived)
      .map((m) => {
        const memContributions = welfareContributions.filter((c) => c.member_id === m.id);
        const memClaims = welfareClaims.filter((c) => c.member_id === m.id && c.status === 'disbursed');
        const duesSum = memContributions.reduce((s, c) => s + c.amount, 0);
        const aidSum = memClaims.reduce((s, c) => s + (c.amount_approved || c.amount_requested), 0);
        const count = memContributions.length;

        // Article 2 Standing: >= 3 months = Good Standing
        let standingStatus: 'good' | 'probation' | 'none' = 'none';
        if (count >= 3) {
          standingStatus = 'good';
        } else if (count >= 1) {
          standingStatus = 'probation';
        }

        return {
          member: m,
          contributionsCount: count,
          totalContributed: duesSum,
          totalReceived: aidSum,
          claimsCount: memClaims.length,
          netPosition: duesSum - aidSum,
          standingStatus,
        };
      })
      .filter((item) => {
        const matchSearch =
          !q ||
          `${item.member.first_name} ${item.member.last_name}`.toLowerCase().includes(q) ||
          (item.member.tithe_number && item.member.tithe_number.toLowerCase().includes(q)) ||
          (item.member.phone && item.member.phone.toLowerCase().includes(q));
        const matchStanding = memberStandingFilter === 'ALL' || item.standingStatus === memberStandingFilter;
        return matchSearch && matchStanding;
      })
      .sort((a, b) => b.totalContributed - a.totalContributed);
  }, [members, welfareContributions, welfareClaims, memberSearch, memberStandingFilter]);

  // Category statistics breakdown
  const categoryStats = useMemo(() => {
    const categories: { key: WelfareClaimCategory; label: string }[] = [
      { key: 'bereavement', label: 'Bereavement' },
      { key: 'hospital_medical', label: 'Medical & Surgery' },
      { key: 'emergency_relief', label: 'Emergency Relief' },
      { key: 'education_welfare', label: 'Education Subsidy' },
      { key: 'childbirth_naming', label: 'Childbirth & Naming' },
      { key: 'wedding_marriage', label: 'Holy Matrimony' },
    ];

    return categories.map((cat) => {
      const claimsInCat = welfareClaims.filter((c) => c.category === cat.key);
      const disbursedInCat = claimsInCat.filter((c) => c.status === 'disbursed');
      const amount = disbursedInCat.reduce((s, c) => s + (c.amount_approved || c.amount_requested), 0);
      return {
        ...cat,
        totalClaims: claimsInCat.length,
        disbursedClaims: disbursedInCat.length,
        amount,
        percentage: totalDisbursed > 0 ? (amount / totalDisbursed) * 100 : 0,
      };
    });
  }, [welfareClaims, totalDisbursed]);

  // CSV Export Functions
  const exportClaimsCSV = () => {
    if (filteredClaims.length === 0) {
      warning('Export Notice', 'No claims to export');
      return;
    }
    const headers = [
      'Claim ID',
      'Date Submitted',
      'Member Name',
      'Phone',
      'Category',
      'Emergency Level',
      'Title',
      'Amount Requested (GHS)',
      'Amount Approved (GHS)',
      'Status',
      'Disbursement Voucher',
    ];
    const rows = filteredClaims.map((c) => [
      c.claim_number,
      c.date_submitted,
      `"${c.member_name.replace(/"/g, '""')}"`,
      c.member_phone || '',
      c.category,
      c.emergency_level,
      `"${c.title.replace(/"/g, '""')}"`,
      c.amount_requested.toFixed(2),
      (c.amount_approved || 0).toFixed(2),
      c.status,
      c.disbursement_voucher_no || '',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `welfare_claims_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success('Export Successful', `Exported ${filteredClaims.length} welfare claims`);
  };

  const exportDuesCSV = () => {
    if (filteredDues.length === 0) {
      warning('Export Notice', 'No dues records to export');
      return;
    }
    const headers = [
      'Receipt Ref',
      'Date',
      'Member Name',
      'Tithe No',
      'Month Applicable',
      'Payment Channel',
      'Amount (GHS)',
      'Recorded By',
    ];
    const rows = filteredDues.map((d) => [
      d.reference_no || '',
      d.date,
      `"${d.member_name.replace(/"/g, '""')}"`,
      d.tithe_number || '',
      d.month,
      d.payment_channel || d.payment_method,
      d.amount.toFixed(2),
      `"${d.recorded_by.replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `welfare_dues_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success('Export Successful', `Exported ${filteredDues.length} dues receipts`);
  };

  const exportMemberStandingCSV = () => {
    const headers = [
      'Member Name',
      'Tithe No',
      'Phone',
      'Dues Months Paid',
      'Total Contributed (GHS)',
      'Aid Received (GHS)',
      'Net Standing (GHS)',
      'Eligibility Status',
    ];
    const rows = memberWelfareSummary.map((item) => [
      `"${item.member.first_name} ${item.member.last_name}"`,
      item.member.tithe_number || '',
      item.member.phone || '',
      item.contributionsCount,
      item.totalContributed.toFixed(2),
      item.totalReceived.toFixed(2),
      item.netPosition.toFixed(2),
      item.standingStatus === 'good' ? 'Eligible (Active)' : item.standingStatus === 'probation' ? 'Probationary' : 'Inactive',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `welfare_member_standing_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success('Export Successful', `Exported ${memberWelfareSummary.length} member standing records`);
  };

  const confirmDeleteItem = () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === 'claim') {
      deleteWelfareClaim(itemToDelete.id);
      success('Claim Removed', `Claim ${itemToDelete.title} was removed`);
    } else {
      deleteWelfareContribution(itemToDelete.id);
      success('Receipt Removed', `Receipt ${itemToDelete.title} was removed`);
    }
    setItemToDelete(null);
  };

  // Calculator logic
  const calcResult = useMemo(() => {
    const isEligible = calcMonthsContributed >= 3;
    let entitlement = 0;
    let details = '';
    let requiredDocs = '';

    switch (calcCategory) {
      case 'bereavement':
        entitlement = 2000.0;
        details = 'Bereavement Aid for member or immediate nuclear family.';
        requiredDocs = 'Obituary notice, death certificate, or pastoral elder confirmation.';
        break;
      case 'hospital_medical':
        entitlement = 1500.0;
        details = 'Emergency surgery, hospitalization, or critical prescription support.';
        requiredDocs = 'Official hospital discharge sheet, pharmacy bill, or doctor prescription.';
        break;
      case 'wedding_marriage':
        entitlement = 800.0;
        details = 'Holy Matrimony celebratory blessing gift.';
        requiredDocs = 'Formal wedding banns announcement and pastoral council counseling clearance.';
        break;
      case 'childbirth_naming':
        entitlement = 500.0;
        details = 'Child naming & dedication ceremony blessing.';
        requiredDocs = 'Maternity card or birth notification.';
        break;
      case 'emergency_relief':
        entitlement = 1000.0;
        details = 'Accident, flood, displacement, or domestic emergency relief.';
        requiredDocs = 'Pastoral care visit assessment or emergency documentation.';
        break;
      case 'education_welfare':
        entitlement = 600.0;
        details = 'Educational term subsidy for students.';
        requiredDocs = 'School bill or academic enrollment slip.';
        break;
    }

    return {
      isEligible,
      entitlement,
      details,
      requiredDocs,
    };
  }, [calcCategory, calcMonthsContributed]);

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
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <span>{settings.church_name || 'Greater Works City Church'}</span>
            <span aria-hidden="true">·</span>
            <span>Emergency Relief, Dues Ledger & Member Benevolence</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-700 font-semibold">{uniqueContributorsCount} Active Contributors</span>
            <span aria-hidden="true">·</span>
            {isSupabaseConfigured ? (
              <span className={`inline-flex items-center gap-1 font-medium ${supabaseStatus === 'connected' ? 'text-emerald-700' : supabaseStatus === 'connecting' ? 'text-amber-600' : 'text-slate-500'}`}>
                <Database className="w-3 h-3" />
                Supabase {supabaseStatus === 'connected' ? 'Synced (welfare_contributions, welfare_claims)' : 'Connecting...'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                <Database className="w-3 h-3" />
                Supabase Local-Storage Mode
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsAuditReportModalOpen(true)}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 shadow-2xs transition flex items-center gap-1.5"
            title="Generate and print full pastoral audit statement"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            Audit Report
          </button>
          <button
            onClick={() => {
              setSelectedMemberForDues(undefined);
              setIsRecordDuesModalOpen(true);
            }}
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
            Apply for Relief Aid
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
            {welfareContributions.length} total receipts recorded
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
            {disbursedClaims.length} compassion grants paid out
          </div>
        </div>

        {/* Pending Claims */}
        <div
          onClick={() => {
            setActiveTab('claims');
            setClaimStatusFilter('pending');
          }}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs cursor-pointer hover:border-amber-300 transition"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Applications</span>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{pendingClaimsCount}</div>
          <div className="text-[11px] text-amber-700 font-semibold mt-1 flex items-center justify-between">
            <span>Awaiting committee review</span>
            <span className="text-[10px] underline">Filter</span>
          </div>
        </div>
      </div>

      {/* Navigation Segmented Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 text-sm font-bold overflow-x-auto">
        <button
          onClick={() => setActiveTab('claims')}
          className={`pb-3 transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'claims'
              ? 'border-emerald-800 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          Benevolence Aid Claims
          {pendingClaimsCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800">
              {pendingClaimsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('dues')}
          className={`pb-3 transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
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
          className={`pb-3 transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'members'
              ? 'border-emerald-800 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <User className="w-4 h-4" />
          Member Standing & Balances
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'analytics'
              ? 'border-emerald-800 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Relief Fund Distribution
        </button>

        <button
          onClick={() => setActiveTab('policy')}
          className={`pb-3 transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'policy'
              ? 'border-emerald-800 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Shield className="w-4 h-4" />
          Constitution & Eligibility Calculator
        </button>
      </div>

      {/* TAB 1: CLAIMS & APPLICATIONS */}
      {activeTab === 'claims' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search claims by ID, member, title, or reason..."
                value={claimSearch}
                onChange={(e) => setClaimSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Category Filter */}
              <select
                value={claimCategoryFilter}
                onChange={(e) => setClaimCategoryFilter(e.target.value)}
                className="text-xs rounded-xl border border-slate-200 py-1.5 px-2.5 bg-white text-slate-700 font-medium"
              >
                <option value="ALL">All Categories</option>
                <option value="bereavement">Bereavement Aid</option>
                <option value="hospital_medical">Medical & Surgery</option>
                <option value="childbirth_naming">Childbirth & Naming</option>
                <option value="wedding_marriage">Holy Matrimony</option>
                <option value="education_welfare">Education Subsidy</option>
                <option value="emergency_relief">Emergency Relief</option>
              </select>

              {/* Status Filter */}
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

              {/* Urgency Filter */}
              <select
                value={claimUrgencyFilter}
                onChange={(e) => setClaimUrgencyFilter(e.target.value)}
                className="text-xs rounded-xl border border-slate-200 py-1.5 px-2.5 bg-white text-slate-700 font-medium"
              >
                <option value="ALL">All Urgencies</option>
                <option value="critical">Critical</option>
                <option value="urgent">Urgent</option>
                <option value="normal">Normal</option>
              </select>

              {(claimSearch || claimCategoryFilter !== 'ALL' || claimStatusFilter !== 'ALL' || claimUrgencyFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setClaimSearch('');
                    setClaimCategoryFilter('ALL');
                    setClaimStatusFilter('ALL');
                    setClaimUrgencyFilter('ALL');
                  }}
                  className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition flex items-center gap-1"
                  title="Reset filters"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              )}

              <button
                onClick={exportClaimsCSV}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Quick Filter Counts Segmented Buttons */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'ALL', label: 'All Claims', count: welfareClaims.length },
              { id: 'pending', label: 'Pending', count: welfareClaims.filter((c) => c.status === 'pending').length },
              { id: 'under_review', label: 'Under Review', count: welfareClaims.filter((c) => c.status === 'under_review').length },
              { id: 'approved', label: 'Approved', count: welfareClaims.filter((c) => c.status === 'approved').length },
              { id: 'disbursed', label: 'Disbursed', count: welfareClaims.filter((c) => c.status === 'disbursed').length },
              { id: 'declined', label: 'Declined', count: welfareClaims.filter((c) => c.status === 'declined').length },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setClaimStatusFilter(btn.id)}
                className={`px-3 py-1 rounded-lg font-medium transition whitespace-nowrap flex items-center gap-1.5 ${
                  claimStatusFilter === btn.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>{btn.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    claimStatusFilter === btn.id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {btn.count}
                </span>
              </button>
            ))}
          </div>

          {/* Claims Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Claim ID & Date</th>
                    <th className="py-3 px-4">Member / Payee</th>
                    <th className="py-3 px-4">Category & Urgency</th>
                    <th className="py-3 px-4">Assistance Request</th>
                    <th className="py-3 px-4 text-right">Requested</th>
                    <th className="py-3 px-4 text-right">Approved</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredClaims.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <HeartHandshake className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-slate-600">No benevolence aid claims found</p>
                        <p className="text-xs text-slate-400 mt-0.5">Try clearing your filters or create a new application.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredClaims.map((claim) => {
                      const isExpanded = expandedClaimId === claim.id;
                      return (
                        <React.Fragment key={claim.id}>
                          <tr className="hover:bg-slate-50 transition cursor-pointer">
                            <td
                              onClick={() => setExpandedClaimId(isExpanded ? null : claim.id)}
                              className="py-3 px-4"
                            >
                              <div className="flex items-center gap-1.5">
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                )}
                                <div>
                                  <span className="font-mono font-bold text-slate-900 block">{claim.claim_number}</span>
                                  <span className="text-[10px] text-slate-400">{claim.date_submitted}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-bold text-slate-900 block">{claim.member_name}</span>
                              <span className="text-[10px] text-slate-500">{claim.member_phone || 'No phone'}</span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-medium capitalize text-slate-800 block">
                                {claim.category.replace('_', ' ')}
                              </span>
                              {claim.emergency_level === 'critical' && (
                                <span className="text-[10px] font-bold text-rose-700 uppercase tracking-tight flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
                                  Critical Relief
                                </span>
                              )}
                              {claim.emergency_level === 'urgent' && (
                                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-tight flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                  Urgent
                                </span>
                              )}
                              {claim.emergency_level === 'normal' && (
                                <span className="text-[10px] text-slate-400">Standard</span>
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
                                className={`font-semibold text-[10px] uppercase px-2 py-0.5 rounded-md border ${
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
                                    title="View / Authorize Payment Voucher"
                                    className="p-1.5 text-emerald-800 hover:bg-emerald-50 rounded-lg transition"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() =>
                                    setItemToDelete({
                                      type: 'claim',
                                      id: claim.id,
                                      title: claim.claim_number,
                                    })
                                  }
                                  title="Delete record"
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Details Drawer */}
                          {isExpanded && (
                            <tr className="bg-slate-50/80">
                              <td colSpan={8} className="py-4 px-6 text-xs border-b border-slate-200">
                                <div className="space-y-3">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                      <span className="font-bold text-slate-700 block mb-0.5">Full Case Details</span>
                                      <p className="text-slate-600 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200">
                                        {claim.description}
                                      </p>
                                    </div>
                                    <div>
                                      <span className="font-bold text-slate-700 block mb-0.5">Pastoral Evaluation Notes</span>
                                      <p className="text-slate-600 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200">
                                        {claim.pastoral_notes || 'No pastoral evaluation notes filed yet.'}
                                      </p>
                                    </div>
                                    <div className="space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200">
                                      <span className="font-bold text-slate-700 block">Disbursement & Verification</span>
                                      <div className="flex justify-between text-slate-600">
                                        <span>Voucher Number:</span>
                                        <span className="font-mono font-bold text-slate-900">
                                          {claim.disbursement_voucher_no || 'Pending'}
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-slate-600">
                                        <span>Disbursement Method:</span>
                                        <span className="capitalize">{claim.disbursement_channel || claim.disbursement_method || '—'}</span>
                                      </div>
                                      <div className="flex justify-between text-slate-600">
                                        <span>Reviewed By:</span>
                                        <span className="font-medium text-slate-800">{claim.reviewed_by || '—'}</span>
                                      </div>
                                      <div className="flex justify-between text-slate-600">
                                        <span>Review Date:</span>
                                        <span>{claim.date_reviewed || '—'}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
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
          <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search member, tithe no, receipt ref..."
                value={duesSearch}
                onChange={(e) => setDuesSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
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

              {(duesSearch || duesMonthFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setDuesSearch('');
                    setDuesMonthFilter('ALL');
                  }}
                  className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              )}

              <button
                onClick={exportDuesCSV}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                Export CSV
              </button>
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
                      <td colSpan={8} className="py-10 text-center text-slate-400">
                        <CreditCard className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        No welfare dues recorded matching current criteria.
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
                            onClick={() =>
                              setItemToDelete({
                                type: 'due',
                                id: due.id,
                                title: due.reference_no || due.member_name,
                              })
                            }
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition"
                            title="Delete receipt"
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
          <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search member name, phone, or tithe index..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={memberStandingFilter}
                onChange={(e) => setMemberStandingFilter(e.target.value as any)}
                className="text-xs rounded-xl border border-slate-200 py-1.5 px-2.5 bg-white text-slate-700 font-medium"
              >
                <option value="ALL">All Standing Levels</option>
                <option value="good">Eligible (3+ Months Dues)</option>
                <option value="probation">Probationary (1-2 Months)</option>
                <option value="none">No Dues Recorded</option>
              </select>

              <button
                onClick={exportMemberStandingCSV}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                Export CSV
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Member Benevolence Standing Ledger</h3>
                <p className="text-xs text-slate-500">
                  Lifetime mutual welfare contributions compared to compassionate benefits claimed
                </p>
              </div>
              <div className="text-xs text-slate-500">
                Showing <strong className="text-slate-900">{memberWelfareSummary.length}</strong> church members
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Member Name</th>
                    <th className="py-3 px-4">Tithe Index</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4 text-center">Dues Standing</th>
                    <th className="py-3 px-4 text-right">Total Contributed</th>
                    <th className="py-3 px-4 text-right">Aid Received</th>
                    <th className="py-3 px-4 text-right">Net Standing</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {memberWelfareSummary.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400">
                        No members matching current criteria.
                      </td>
                    </tr>
                  ) : (
                    memberWelfareSummary.map(({ member, contributionsCount, totalContributed, totalReceived, netPosition, standingStatus }) => (
                      <tr key={member.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {member.first_name} {member.last_name}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">{member.tithe_number || '—'}</td>
                        <td className="py-3 px-4 text-slate-500">{member.phone || '—'}</td>
                        <td className="py-3 px-4 text-center">
                          {standingStatus === 'good' ? (
                            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              {contributionsCount} mos · Eligible
                            </span>
                          ) : standingStatus === 'probation' ? (
                            <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                              {contributionsCount} mos · Probation
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              0 mos · Inactive
                            </span>
                          )}
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
                              setSelectedMemberForDues(member.id);
                              setIsRecordDuesModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold rounded-lg text-[11px] transition"
                          >
                            + Record Dues
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

      {/* TAB 4: RELIEF FUND DISTRIBUTION ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Category Distribution Breakdown */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Relief Disbursements by Category</h3>
                <p className="text-xs text-slate-500">
                  Allocation of benevolent assistance across church support channels
                </p>
              </div>

              <div className="space-y-4 pt-2">
                {categoryStats.map((cat) => (
                  <div key={cat.key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">{cat.label}</span>
                      <div className="text-right">
                        <span className="font-mono font-bold text-slate-900">GH₵ {cat.amount.toFixed(2)}</span>
                        <span className="text-slate-400 text-[11px] ml-1.5">({cat.percentage.toFixed(1)}%)</span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-700 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, cat.percentage))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>{cat.disbursedClaims} grants disbursed</span>
                      <span>{cat.totalClaims} total claims filed</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fund Health & Reserve Ratios */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Mutual Fund Sustainability</h3>
                <p className="text-xs text-slate-500">
                  GWCC Welfare reserve capital and solvency metrics
                </p>
              </div>

              <div className="space-y-3 pt-2 text-xs">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Capital Inflow to Disbursement Ratio
                  </span>
                  <div className="text-xl font-black text-slate-900">
                    {totalDisbursed > 0 ? (totalDuesCollected / totalDisbursed).toFixed(2) : '100%'} : 1.00
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Fund dues collection exceeds lifetime disbursements, keeping fund fully solvent.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Average Disbursed Grant Size
                  </span>
                  <div className="text-xl font-black text-slate-900">
                    GH₵ {disbursedClaims.length > 0 ? (totalDisbursed / disbursedClaims.length).toFixed(2) : '0.00'}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Calculated over {disbursedClaims.length} approved benevolence interventions.
                  </p>
                </div>

                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                    Available Liquid Reserve
                  </span>
                  <div className="text-xl font-black text-emerald-900">
                    GH₵ {fundBalance.toFixed(2)}
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    Sufficient to fund approximately {Math.floor(fundBalance / 1000)} emergency relief interventions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: GWCC WELFARE CONSTITUTION & INTERACTIVE CALCULATOR */}
      {activeTab === 'policy' && (
        <div className="space-y-6 max-w-5xl">
          {/* Interactive Entitlement Calculator */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-emerald-700" />
                <h3 className="text-base font-bold text-slate-900">Welfare Benefit Entitlement Calculator</h3>
              </div>
              <span className="text-xs text-slate-500">Article 2 & 3 Evaluation Model</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Select Assistance Category</label>
                  <select
                    value={calcCategory}
                    onChange={(e) => setCalcCategory(e.target.value as WelfareClaimCategory)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  >
                    <option value="bereavement">Bereavement Support (Article 3)</option>
                    <option value="hospital_medical">Hospitalization & Medical Relief (Article 4)</option>
                    <option value="wedding_marriage">Holy Matrimony Nuptials (Article 5)</option>
                    <option value="childbirth_naming">Childbirth & Naming Ceremony (Article 5)</option>
                    <option value="emergency_relief">Emergency Disaster & Crisis Relief</option>
                    <option value="education_welfare">Education Subsidy Support</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Consecutive Months of Dues Contributed: {calcMonthsContributed} months
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="24"
                    value={calcMonthsContributed}
                    onChange={(e) => setCalcMonthsContributed(parseInt(e.target.value, 10))}
                    className="w-full accent-emerald-700"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>0 months (New)</span>
                    <span className="font-bold text-emerald-700">3 months (Eligibility Threshold)</span>
                    <span>24+ months (Veteran)</span>
                  </div>
                </div>
              </div>

              {/* Calculator Output Card */}
              <div
                className={`p-5 rounded-xl border flex flex-col justify-between ${
                  calcResult.isEligible
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : 'bg-amber-50/70 border-amber-200'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Calculated Entitlement
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        calcResult.isEligible
                          ? 'bg-emerald-200 text-emerald-900'
                          : 'bg-amber-200 text-amber-900'
                      }`}
                    >
                      {calcResult.isEligible ? 'Eligible under Article 2' : 'Probationary Standing (<3 Mos)'}
                    </span>
                  </div>

                  <div className="text-2xl font-black text-slate-900">
                    GH₵ {calcResult.entitlement.toFixed(2)}
                  </div>
                  <p className="text-slate-600">{calcResult.details}</p>

                  <div className="pt-2 border-t border-slate-200/60">
                    <span className="font-bold text-slate-700 block mb-0.5">Required Substantiating Evidence:</span>
                    <p className="text-slate-600">{calcResult.requiredDocs}</p>
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    onClick={() => setIsApplyModalOpen(true)}
                    className="w-full py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold text-xs shadow-xs transition"
                  >
                    Open Relief Application for this Category
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Full Constitution Guidelines */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-base font-bold text-slate-900">
                Greater Works City Church (GWCC) Welfare Constitution & Mutual Aid Guidelines
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Approved by Pastoral Council under the spiritual oversight of Prophet Elisha K. Richard
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
        </div>
      )}

      {/* In-App Deletion Confirmation Modal (No window.confirm) */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Delete {itemToDelete.type === 'claim' ? 'Welfare Claim' : 'Dues Receipt'}?
              </h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to permanently remove <strong className="text-slate-700">{itemToDelete.title}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2 px-3 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteItem}
                className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition"
              >
                Delete
              </button>
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
        onClose={() => {
          setIsRecordDuesModalOpen(false);
          setSelectedMemberForDues(undefined);
        }}
        preselectedMemberId={selectedMemberForDues}
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

      <WelfareAuditReportModal
        isOpen={isAuditReportModalOpen}
        onClose={() => setIsAuditReportModalOpen(false)}
      />
    </div>
  );
};
