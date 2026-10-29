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
  Users,
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
import {
  WelfareClaim,
  WelfareContribution,
  WelfareClaimCategory,
  WelfareClaimStatus,
  WelfareEvent,
  WelfareEventContribution,
  WelfareEventCategory,
  WelfareEventStatus,
} from '../types/database.types';
import { ApplyWelfareClaimModal } from '../components/welfare/ApplyWelfareClaimModal';
import { ReviewWelfareClaimModal } from '../components/welfare/ReviewWelfareClaimModal';
import { BenevolenceVoucherModal } from '../components/welfare/BenevolenceVoucherModal';
import { RecordWelfareDuesModal } from '../components/welfare/RecordWelfareDuesModal';
import { WelfareAuditReportModal } from '../components/welfare/WelfareAuditReportModal';
import { CreateWelfareEventModal } from '../components/welfare/CreateWelfareEventModal';
import { RecordWelfareEventContributionModal } from '../components/welfare/RecordWelfareEventContributionModal';
import { WelfareEventDetailModal } from '../components/welfare/WelfareEventDetailModal';
import { PrintWelfareEventReportModal } from '../components/welfare/PrintWelfareEventReportModal';
import { paidWelfareAmount, summarizeWelfare } from '../features/welfare/welfareSummary';
import { assessWelfareStanding, classifyWelfareEligibility, welfareEligibilityLabel, type WelfareEligibility } from '../features/welfare/welfareEligibility';
import { WelfareStandingNotice } from '../components/welfare/WelfareStandingNotice';
import { AddWelfareFundsModal, WelfareFundReceiptsPanel } from '../components/welfare/WelfareFundReceipts';
import { WELFARE_FUND_WRITE_ROLES } from '../features/welfare/welfareFund';

export const WelfarePage: React.FC = () => {
  const {
    welfareContributions,
    welfareFundReceipts,
    welfareClaims,
    welfareEvents,
    welfareEventContributions,
    members,
    settings,
    deleteWelfareContribution,
    deleteWelfareClaim,
    closeWelfareEvent,
    updateWelfareEvent,
    deleteWelfareEvent,
    clearAllWelfareEvents,
    isSupabaseConfigured,
    supabaseStatus,
  } = useChurchData();
  const { canAccess, currentUser } = useAuth();
  const { success, warning } = useToast();

  const [activeTab, setActiveTab] = useState<'events' | 'claims' | 'dues' | 'fund' | 'members' | 'analytics' | 'policy'>('events');
  const [isAddFundsOpen, setIsAddFundsOpen] = useState(false);

  // Search & Filter state for welfare events
  const [eventSearch, setEventSearch] = useState('');
  const [eventCategoryFilter, setEventCategoryFilter] = useState('ALL');
  const [eventStatusFilter, setEventStatusFilter] = useState('ALL');

  // Event Modals state
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<WelfareEvent | null>(null);
  const [isRecordEventContributionModalOpen, setIsRecordEventContributionModalOpen] = useState(false);
  const [selectedEventForContribution, setSelectedEventForContribution] = useState<string | undefined>(undefined);
  const [contributionToEdit, setContributionToEdit] = useState<WelfareEventContribution | null>(null);
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<WelfareEvent | null>(null);
  const [selectedEventForReport, setSelectedEventForReport] = useState<WelfareEvent | null>(null);
  const [eventToDelete, setEventToDelete] = useState<WelfareEvent | null>(null);
  const [isConfirmingClearAllEvents, setIsConfirmingClearAllEvents] = useState(false);

  const canManageEvents =
    canAccess('admin') ||
    currentUser?.role === 'super_admin' ||
    currentUser?.role === 'senior_pastor' ||
    currentUser?.role === 'administrator' ||
    currentUser?.role === 'pastor' ||
    currentUser?.role === 'welfare_officer';

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
  const [memberStandingFilter, setMemberStandingFilter] = useState<'ALL' | WelfareEligibility>('ALL');

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
  const [calcArrearsMonths, setCalcArrearsMonths] = useState<number>(0);
  const assessmentDate = new Date().toISOString().slice(0, 10);

  // Aggregations
  const { totalDuesCollected, totalAdditionalFunds, paidClaims, totalDisbursed, fundBalance } = useMemo(
    () => summarizeWelfare(welfareContributions, welfareClaims, welfareFundReceipts),
    [welfareContributions, welfareClaims, welfareFundReceipts],
  );

  const pendingClaimsCount = useMemo(() => {
    return welfareClaims.filter((c) => c.status === 'pending' || c.status === 'under_review').length;
  }, [welfareClaims]);

  const uniqueContributorsCount = useMemo(() => {
    return new Set(welfareContributions.map((c) => c.member_id)).size;
  }, [welfareContributions]);

  // Welfare Event Contributions Aggregations
  const totalEventFundsCollected = useMemo(() => {
    return welfareEventContributions
      .filter((c) => c.payment_status === 'confirmed')
      .reduce((sum, c) => sum + c.amount, 0);
  }, [welfareEventContributions]);

  const openEventsCount = useMemo(() => {
    return welfareEvents.filter((e) => e.status === 'open').length;
  }, [welfareEvents]);

  // Filtered Welfare Events
  const filteredEvents = useMemo(() => {
    return welfareEvents
      .filter((e) => {
        const q = (eventSearch || '').toLowerCase().trim();
        const matchSearch =
          !q ||
          e.title.toLowerCase().includes(q) ||
          e.member_name.toLowerCase().includes(q) ||
          (e.beneficiary_family_name && e.beneficiary_family_name.toLowerCase().includes(q)) ||
          e.description.toLowerCase().includes(q) ||
          (e.category_custom && e.category_custom.toLowerCase().includes(q));

        const matchCat = eventCategoryFilter === 'ALL' || e.category === eventCategoryFilter;
        const matchStatus = eventStatusFilter === 'ALL' || e.status === eventStatusFilter;

        return matchSearch && matchCat && matchStatus;
      })
      .sort((a, b) => {
        if (a.status === 'open' && b.status !== 'open') return -1;
        if (a.status !== 'open' && b.status === 'open') return 1;
        return new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
      });
  }, [welfareEvents, eventSearch, eventCategoryFilter, eventStatusFilter]);

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
  const allMemberWelfareSummaries = useMemo(() => {
    return members
      .filter((m) => !m.is_archived)
      .map((m) => {
        const memContributions = welfareContributions.filter((c) => c.member_id === m.id || c.member_id === m.member_id);
        const memClaims = welfareClaims.filter((c) => (c.member_id === m.id || c.member_id === m.member_id) && c.beneficiary_type !== 'external_community' && paidWelfareAmount(c) > 0);
        const { totalDuesCollected: duesSum, totalDisbursed: aidSum } = summarizeWelfare(memContributions, memClaims);
        const standing = assessWelfareStanding(m, memContributions, new Date(`${assessmentDate}T00:00:00Z`));

        return {
          member: m,
          standing,
          totalContributed: duesSum,
          totalReceived: aidSum,
          claimsCount: memClaims.length,
          netPosition: duesSum - aidSum,
        };
      });
  }, [members, welfareContributions, welfareClaims, assessmentDate]);

  const defaultersCount = allMemberWelfareSummaries.filter(item => item.standing.isDefaulter).length;
  const standingByMemberId = useMemo(() => new Map(allMemberWelfareSummaries.flatMap(item =>
    [[item.member.id, item.standing], [item.member.member_id, item.standing]] as const)), [allMemberWelfareSummaries]);
  const memberWelfareSummary = useMemo(() => {
    const q = memberSearch.toLowerCase().trim();
    return allMemberWelfareSummaries
      .filter((item) => {
        const matchSearch =
          !q ||
          `${item.member.first_name} ${item.member.last_name}`.toLowerCase().includes(q) ||
          (item.member.tithe_number && item.member.tithe_number.toLowerCase().includes(q)) ||
          (item.member.phone && item.member.phone.toLowerCase().includes(q));
        const matchStanding = memberStandingFilter === 'ALL' || item.standing.eligibility === memberStandingFilter;
        return matchSearch && matchStanding;
      })
      .sort((a, b) => b.totalContributed - a.totalContributed);
  }, [allMemberWelfareSummaries, memberSearch, memberStandingFilter]);

  // Category statistics breakdown
  const categoryStats = useMemo(() => {
    const categories: { key: WelfareClaimCategory; label: string }[] = [
      { key: 'bereavement', label: 'Bereavement' },
      { key: 'hospital_medical', label: 'Medical & Surgery' },
      { key: 'food_nutrition', label: 'Food & Nutrition' },
      { key: 'emergency_relief', label: 'Emergency Relief' },
      { key: 'education_welfare', label: 'Education Subsidy' },
      { key: 'childbirth_naming', label: 'Childbirth & Naming' },
      { key: 'wedding_marriage', label: 'Holy Matrimony' },
    ];

    return categories.map((cat) => {
      const claimsInCat = welfareClaims.filter((c) => c.category === cat.key);
      const paidInCat = claimsInCat.filter((c) => paidWelfareAmount(c) > 0);
      const amount = summarizeWelfare([], paidInCat).totalDisbursed;
      return {
        ...cat,
        totalClaims: claimsInCat.length,
        paidClaims: paidInCat.length,
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
      'Welfare Joining Date (First Payment)',
      'Unpaid Completed Months',
      'Unpaid Month List',
      'Assessed From',
      'Assessed Through',
      'Assessment Basis',
    ];
    const rows = memberWelfareSummary.map((item) => [
      `${item.member.first_name} ${item.member.last_name}`,
      item.member.tithe_number || '',
      item.member.phone || '',
      item.standing.paidMonths.length,
      item.totalContributed.toFixed(2),
      item.totalReceived.toFixed(2),
      item.netPosition.toFixed(2),
      item.standing.label,
      item.standing.welfareJoiningDate ?? '',
      item.standing.arrearsCount ?? 'Unknown',
      item.standing.arrearsMonths.join('; '),
      item.standing.startMonth ?? '',
      item.standing.assessedThrough,
      item.standing.startBasis ?? 'Review needed',
    ]);
    const csvCell = (value: string | number) => {
      const raw = String(value);
      const safe = typeof value === 'string' && /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const csvContent = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
    const csvUrl = URL.createObjectURL(new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.setAttribute('href', csvUrl);
    link.setAttribute('download', `welfare_member_standing_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(csvUrl);
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
    const eligibility = classifyWelfareEligibility(calcArrearsMonths, calcMonthsContributed);
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
      case 'food_nutrition':
        entitlement = 450.0;
        details = 'Emergency food parcel, dry staples, and nutritional sustenance aid.';
        requiredDocs = 'Pastoral home visitation report or deacon recommendation.';
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
      eligibility,
      entitlement,
      details,
      requiredDocs,
    };
  }, [calcCategory, calcMonthsContributed, calcArrearsMonths]);

  return (
    <div className="min-w-0 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <HeartHandshake className="w-6 h-6 shrink-0 text-emerald-700" />
              Welfare & Benevolence Mutual Fund
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 mt-1">
            <span>{settings.church_name || 'Greater Works City Church'}</span>
            <span aria-hidden="true">·</span>
            <span>Emergency Relief, Dues Ledger & Member Benevolence</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-700 font-semibold">{uniqueContributorsCount} Active Contributors</span>
            <span aria-hidden="true">·</span>
            {isSupabaseConfigured ? (
              <span className={`inline-flex items-center gap-1 font-medium ${supabaseStatus === 'connected' ? 'text-emerald-700' : supabaseStatus === 'syncing' ? 'text-amber-600' : 'text-slate-500'}`}>
                <Database className="w-3 h-3" />
                Supabase {supabaseStatus === 'connected' ? 'Synced (welfare_contributions, welfare_claims)' : supabaseStatus === 'syncing' ? 'Syncing...' : 'Offline'}
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
          {WELFARE_FUND_WRITE_ROLES.includes(currentUser.role) && <button
            onClick={() => setIsAddFundsOpen(true)}
            className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
          ><Plus className="w-4 h-4" />Add to Fund</button>}
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
            onClick={() => {
              setEventToEdit(null);
              setIsCreateEventModalOpen(true);
            }}
            className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Create Welfare Event
          </button>
          <button
            onClick={() => setIsApplyModalOpen(true)}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 shadow-2xs transition flex items-center gap-1.5"
          >
            <HeartHandshake className="w-4 h-4 text-emerald-800" />
            Apply for Relief Aid
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Fund Balance */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Welfare Fund Balance</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className={`text-2xl font-black ${fundBalance < 0 ? 'text-rose-700' : 'text-slate-900'}`}>
            GH₵ {fundBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1">
            Dues + confirmed fund receipts − payouts
          </div>
        </div>

        {/* Event Contributions Collected */}
        <div
          onClick={() => {
            setActiveTab('events');
            setEventStatusFilter('ALL');
          }}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs cursor-pointer hover:border-emerald-300 transition"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Event Appeal Funds</span>
            <HeartHandshake className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl font-black text-emerald-900">
            GH₵ {totalEventFundsCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center justify-between">
            <span>{openEventsCount} active welfare appeal(s)</span>
            <span className="text-[10px] underline">View</span>
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
            {welfareContributions.length} monthly dues receipts
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
            {paidClaims.length} claims with recorded payouts
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
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Claims</span>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{pendingClaimsCount}</div>
          <div className="text-[11px] text-amber-700 font-semibold mt-1 flex items-center justify-between">
            <span>Awaiting review</span>
            <span className="text-[10px] underline">Filter</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950" aria-label="Welfare fund balance breakdown">
        Member dues GH₵ {totalDuesCollected.toFixed(2)} + additional fund receipts GH₵ {totalAdditionalFunds.toFixed(2)} − payouts GH₵ {totalDisbursed.toFixed(2)} = fund balance GH₵ {fundBalance.toFixed(2)}.
        <button onClick={() => setActiveTab('fund')} className="ml-2 font-semibold underline">View fund receipts</button>
      </div>

      {/* Navigation Segmented Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 text-sm font-bold overflow-x-auto">
        <button
          onClick={() => setActiveTab('events')}
          className={`pb-3 transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'events'
              ? 'border-emerald-800 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <HeartHandshake className="w-4 h-4" />
          Event Contributions
          {openEventsCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
              {openEventsCount}
            </span>
          )}
        </button>

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

        <button onClick={() => setActiveTab('fund')} className={`pb-3 transition flex items-center gap-2 border-b-2 whitespace-nowrap ${activeTab === 'fund' ? 'border-emerald-800 text-emerald-800' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><Wallet className="w-4 h-4" />Fund Receipts</button>

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

      {activeTab === 'fund' && <WelfareFundReceiptsPanel key={`${currentUser.id}:${currentUser.role}`} />}

      {/* TAB 0: WELFARE EVENT CONTRIBUTIONS */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search event title, affected member, beneficiary..."
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Category Filter */}
              <select
                value={eventCategoryFilter}
                onChange={(e) => setEventCategoryFilter(e.target.value)}
                className="text-xs rounded-xl border border-slate-200 py-1.5 px-2.5 bg-white text-slate-700 font-medium"
              >
                <option value="ALL">All Categories</option>
                <option value="death_member">Death of Member</option>
                <option value="death_parent">Death of Parent(s)</option>
                <option value="death_spouse">Death of Spouse</option>
                <option value="sickness_hospitalization">Sickness / Hospitalisation</option>
                <option value="emergency_assistance">Emergency Assistance</option>
                <option value="other">Other Welfare Needs</option>
              </select>

              {/* Status Filter */}
              <select
                value={eventStatusFilter}
                onChange={(e) => setEventStatusFilter(e.target.value)}
                className="text-xs rounded-xl border border-slate-200 py-1.5 px-2.5 bg-white text-slate-700 font-medium"
              >
                <option value="ALL">All Status</option>
                <option value="open">Open (Active)</option>
                <option value="closed">Closed</option>
                <option value="draft">Draft</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <button
                onClick={() => {
                  setSelectedEventForContribution(undefined);
                  setContributionToEdit(null);
                  setIsRecordEventContributionModalOpen(true);
                }}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 shadow-2xs transition flex items-center gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
                Record Contribution
              </button>

              <button
                onClick={() => {
                  setEventToEdit(null);
                  setIsCreateEventModalOpen(true);
                }}
                className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                New Event Appeal
              </button>

              {welfareEvents.length > 0 && canManageEvents && currentUser.role !== 'welfare_officer' && (
                <button
                  onClick={() => setIsConfirmingClearAllEvents(true)}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 shadow-2xs transition flex items-center gap-1.5"
                  title="Delete all welfare events to start fresh"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All / Start Fresh
                </button>
              )}
            </div>
          </div>

          {/* Events Grid */}
          {filteredEvents.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-300 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-800">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">No Welfare Events Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No welfare contribution appeals match your filter criteria. Create a new event appeal to mobilize congregational benevolence.
              </p>
              <button
                onClick={() => {
                  setEventToEdit(null);
                  setIsCreateEventModalOpen(true);
                }}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Create Welfare Event
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEvents.map((evt) => {
                const contributions = welfareEventContributions.filter((c) => c.event_id === evt.id);
                const confirmed = contributions.filter((c) => c.payment_status === 'confirmed');
                const confirmedTotal = confirmed.reduce((sum, c) => sum + c.amount, 0);
                const uniqueContributors = new Set(contributions.map((c) => c.member_id || c.contributor_name)).size;
                const target = evt.target_amount || 0;
                const progress = target > 0 ? Math.min(100, (confirmedTotal / target) * 100) : 0;
                const isClosed = evt.status === 'closed' || evt.status === 'cancelled';
                const deadline = new Date(evt.end_date);
                const isPast = deadline < new Date();

                return (
                  <div
                    key={evt.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition flex flex-col justify-between overflow-hidden"
                  >
                    <div className="p-5 space-y-3">
                      {/* Category & Status Bar */}
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                            evt.category === 'death_member'
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : evt.category === 'death_parent'
                              ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                              : evt.category === 'death_spouse'
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : evt.category === 'sickness_hospitalization'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : evt.category === 'emergency_assistance'
                              ? 'bg-orange-50 text-orange-800 border-orange-200'
                              : 'bg-slate-100 text-slate-800 border-slate-200'
                          }`}
                        >
                          {evt.category.replace('_', ' ')}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                              evt.status === 'open'
                                ? 'bg-emerald-100 text-emerald-800'
                                : evt.status === 'closed'
                                ? 'bg-slate-800 text-white'
                                : evt.status === 'draft'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {evt.status}
                          </span>
                        </div>
                      </div>

                      {/* Event Title */}
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                          {evt.title}
                        </h3>
                        <div className="text-xs text-slate-500 mt-1 flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                            <span>Member: <strong className="text-slate-800 font-semibold">{evt.member_name}</strong></span>
                          </div>
                          {evt.beneficiary_family_name && (
                            <div className="flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="line-clamp-1">Beneficiary: <strong className="text-slate-700">{evt.beneficiary_family_name}</strong></span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Public Description */}
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {evt.description}
                      </p>

                      {/* Mandatory Min & Deadline Badges */}
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                        <span className="text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px]">
                          Min: GH¢ {evt.minimum_contribution.toFixed(2)}
                        </span>
                        <span className={`text-[11px] font-medium ${isClosed ? 'text-slate-500' : isPast ? 'text-rose-600 font-semibold' : 'text-slate-600'}`}>
                          Deadline: {evt.end_date}
                        </span>
                      </div>

                      {/* Financial Progress Box */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                          <span>GH₵ {confirmedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          <span className="text-[11px] text-slate-500 font-normal">
                            {target > 0 ? `Target: GH₵ ${target.toLocaleString('en-US')}` : `${uniqueContributors} donor(s)`}
                          </span>
                        </div>
                        {target > 0 && (
                          <div className="space-y-1">
                            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-600 rounded-full"
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-500">
                              <span>{progress.toFixed(0)}% reached</span>
                              <span>{uniqueContributors} contributor(s)</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="p-3 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setSelectedEventForDetail(evt)}
                        className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition flex items-center gap-1"
                      >
                        Details & Ledger
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedEventForReport(evt)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                          title="Print official audit report"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>

                        {canManageEvents && currentUser.role !== 'welfare_officer' && (
                          <button
                            onClick={() => setEventToDelete(evt)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 rounded-lg transition"
                            title="Delete welfare event"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {evt.status === 'open' ? (
                          <button
                            onClick={() => {
                              setSelectedEventForContribution(evt.id);
                              setContributionToEdit(null);
                              setIsRecordEventContributionModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Contribute
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium px-2 py-1">
                            {evt.status.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
                <option value="food_nutrition">Food & Nutrition Relief</option>
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
                      const standing = claim.beneficiary_type === 'external_community' ? undefined : standingByMemberId.get(claim.member_id);
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
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 block">{claim.member_name}</span>
                                {claim.beneficiary_type === 'external_community' && (
                                  <span className="text-[9px] uppercase font-bold px-1 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                    Community
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500">
                                {claim.member_phone || 'No phone'}
                                {claim.beneficiary_community ? ` · ${claim.beneficiary_community}` : ''}
                              </span>
                              {standing?.isDefaulter && <p className="text-[10px] font-bold text-rose-700">Defaulter — Partially eligible · {standing.arrearsCount} unpaid months</p>}
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
                            <td className="py-3 px-4 text-right font-mono">
                              {claim.amount_approved ? (
                                <div>
                                  <span className="font-bold text-emerald-700 block">
                                    GH₵ {claim.amount_approved.toFixed(2)}
                                  </span>
                                  {claim.amount_disbursed !== undefined && claim.amount_disbursed > 0 && (
                                    <span className="text-[10px] text-blue-600 font-semibold block">
                                      Disbursed: GH₵ {claim.amount_disbursed.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
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
                                {currentUser.role !== 'welfare_officer' && (claim.status === 'approved' || claim.status === 'disbursed') && (
                                  <button
                                    onClick={() => setSelectedClaimForVoucher(claim)}
                                    title="View / Authorize Payment Voucher"
                                    className="p-1.5 text-emerald-800 hover:bg-emerald-50 rounded-lg transition"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {canAccess('admin') && (
                                  <button
                                    onClick={() =>
                                      setItemToDelete({
                                        type: 'claim',
                                        id: claim.id,
                                        title: claim.claim_number,
                                      })
                                    }
                                    title="Delete record (Admins only)"
                                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
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
                                      {claim.case_owner && (
                                        <p className="text-[11px] text-slate-500 mt-2">
                                          Case Owner: <strong className="text-slate-800">{claim.case_owner}</strong>
                                        </p>
                                      )}
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
                                      {claim.finance_account_name && (
                                        <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-100">
                                          <span>Funding Account:</span>
                                          <span className="font-medium text-emerald-800">{claim.finance_account_name}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Disbursement History Breakdown if multiple payments logged */}
                                  {claim.disbursements && claim.disbursements.length > 0 && (
                                    <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                                      <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px] block">
                                        Disbursement Payment Installments ({claim.disbursements.length})
                                      </span>
                                      <div className="divide-y divide-slate-100 text-[11px]">
                                        {claim.disbursements.map((d, dIdx) => (
                                          <div key={d.id || dIdx} className="py-1 flex items-center justify-between">
                                            <div>
                                              <span className="font-mono font-semibold text-slate-800">{d.voucher_no}</span>
                                              <span className="text-slate-400 ml-2">{d.date}</span>
                                              <span className="text-slate-500 ml-2">({d.payment_channel || d.payment_method})</span>
                                            </div>
                                            <div className="font-mono font-bold text-emerald-800">
                                              GH₵ {d.amount.toFixed(2)}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
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
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-rose-900">Defaulters: {defaultersCount} members</p>
              <p className="text-xs text-rose-800">3 or more unpaid completed months: partially eligible. Committee approval determines the benefit amount.</p>
            </div>
            <button onClick={() => { setMemberStandingFilter('partial'); setMemberSearch(''); }} className="text-xs font-bold rounded-lg border border-rose-300 bg-white px-3 py-2 text-rose-900">Show defaulters</button>
          </div>
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
                aria-label="Filter member welfare standing"
                value={memberStandingFilter}
                onChange={(e) => setMemberStandingFilter(e.target.value as 'ALL' | WelfareEligibility)}
                className="text-xs rounded-xl border border-slate-200 py-1.5 px-2.5 bg-white text-slate-700 font-medium"
              >
                <option value="ALL">All Standing Levels</option>
                <option value="full">Fully eligible</option>
                <option value="partial">Defaulters — Partially eligible (3+ months arrears)</option>
                <option value="probation">Probation — Committee review</option>
                <option value="not_enrolled">Not enrolled — No welfare payment</option>
                <option value="review">Review needed — Payment date missing</option>
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
                  Welfare starts on the first dues payment date. Arrears run from that payment month through the last completed month. Duplicate receipts count once per month.
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
                    memberWelfareSummary.map(({ member, totalContributed, totalReceived, netPosition, standing }) => (
                      <tr key={member.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {member.first_name} {member.last_name}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">{member.tithe_number || '—'}</td>
                        <td className="py-3 px-4 text-slate-500">{member.phone || '—'}</td>
                        <td className="py-3 px-4 min-w-72 max-w-sm">
                          <WelfareStandingNotice standing={standing} />
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
                      <span>{cat.paidClaims} claims with payouts</span>
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
                  Recorded welfare dues and relief payouts
                </p>
              </div>

              <div className="space-y-3 pt-2 text-xs">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Capital Inflow to Disbursement Ratio
                  </span>
                  <div className="text-xl font-black text-slate-900">
                    {totalDisbursed > 0 ? `${(totalDuesCollected / totalDisbursed).toFixed(2)} : 1.00` : '—'}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {totalDisbursed === 0 ? 'No payouts have been recorded.' : fundBalance >= 0 ? 'Recorded dues cover the recorded payouts.' : 'Recorded payouts exceed recorded dues. Reconcile funding and opening records.'}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Average Paid per Claim
                  </span>
                  <div className="text-xl font-black text-slate-900">
                    GH₵ {paidClaims.length > 0 ? (totalDisbursed / paidClaims.length).toFixed(2) : '0.00'}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Calculated over {paidClaims.length} claims with recorded payouts.
                  </p>
                </div>

                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                    Recorded Fund Balance
                  </span>
                  <div className="text-xl font-black text-emerald-900">
                    GH₵ {fundBalance.toFixed(2)}
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    Member dues plus confirmed fund receipts, less relief payouts. Reconcile with Church Finance before further payments.
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
                    aria-label="Consecutive months paid"
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
                <div>
                  <label htmlFor="welfare-calc-arrears" className="block text-slate-700 font-bold mb-1">Unpaid completed months (arrears)</label>
                  <input id="welfare-calc-arrears" type="number" min="0" step="1" value={calcArrearsMonths}
                    onChange={e => setCalcArrearsMonths(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                    className="w-full p-2.5 rounded-xl border border-slate-200" />
                  <p className="text-slate-500 mt-1">At 3 or more months of arrears, benefits are partial and require a committee-approved amount.</p>
                </div>
              </div>

              {/* Calculator Output Card */}
              <div
                className={`p-5 rounded-xl border flex flex-col justify-between ${
                  calcResult.eligibility === 'full'
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
                        calcResult.eligibility === 'full'
                          ? 'bg-emerald-200 text-emerald-900'
                          : 'bg-amber-200 text-amber-900'
                      }`}
                    >
                      {welfareEligibilityLabel[calcResult.eligibility]}
                    </span>
                  </div>

                  <div className="text-2xl font-black text-slate-900">
                    {calcResult.eligibility === 'full' ? `GH₵ ${calcResult.entitlement.toFixed(2)}` : 'Committee decision required'}
                  </div>
                  {calcResult.eligibility !== 'full' && <p className="font-semibold text-slate-700">Standard full benefit reference: GH₵ {calcResult.entitlement.toFixed(2)}. This is not an approved amount.</p>}
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
                  qualify for full benefits after 3 consecutive months of recorded dues, provided arrears are below 3 completed months.
                  Members with 3 or more unpaid completed months are defaulters and remain partially eligible for benefits.
                  The Welfare Committee decides the partial benefit amount; no automatic reduction percentage is assumed.
                  A member joins the welfare scheme on the date of their first recorded positive welfare dues payment.
                  Arrears count months without a positive dues receipt from that payment month. Members with no dues payment are not yet enrolled and have no assigned arrears.
                  The current month is not overdue, and repeated receipts for the same month count once.
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

      {isAddFundsOpen && WELFARE_FUND_WRITE_ROLES.includes(currentUser.role) && <AddWelfareFundsModal
        key={`${currentUser.id}:${currentUser.role}`}
        onClose={() => setIsAddFundsOpen(false)}
        onSaved={() => { setIsAddFundsOpen(false); setActiveTab('fund'); }}
      />}
      <RecordWelfareDuesModal
        isOpen={isRecordDuesModalOpen}
        onClose={() => {
          setIsRecordDuesModalOpen(false);
          setSelectedMemberForDues(undefined);
        }}
        preselectedMemberId={selectedMemberForDues}
      />

      <ReviewWelfareClaimModal
        key={selectedClaimForReview?.id ?? 'no-claim'}
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

      {/* Welfare Event Modals */}
      <CreateWelfareEventModal
        isOpen={isCreateEventModalOpen}
        onClose={() => {
          setIsCreateEventModalOpen(false);
          setEventToEdit(null);
        }}
        eventToEdit={eventToEdit}
      />

      <RecordWelfareEventContributionModal
        isOpen={isRecordEventContributionModalOpen}
        onClose={() => {
          setIsRecordEventContributionModalOpen(false);
          setSelectedEventForContribution(undefined);
          setContributionToEdit(null);
        }}
        preselectedEventId={selectedEventForContribution}
        contributionToEdit={contributionToEdit}
      />

      {selectedEventForDetail && (
        <WelfareEventDetailModal
          isOpen={Boolean(selectedEventForDetail)}
          onClose={() => setSelectedEventForDetail(null)}
          event={selectedEventForDetail}
          onRecordContribution={(evt) => {
            setSelectedEventForContribution(evt.id);
            setContributionToEdit(null);
            setIsRecordEventContributionModalOpen(true);
          }}
          onEditContribution={(contrib) => {
            setContributionToEdit(contrib);
            setIsRecordEventContributionModalOpen(true);
          }}
          onPrintReport={(evt) => {
            setSelectedEventForReport(evt);
          }}
          onEditEvent={(evt) => {
            setEventToEdit(evt);
            setIsCreateEventModalOpen(true);
          }}
        />
      )}

      {selectedEventForReport && (
        <PrintWelfareEventReportModal
          isOpen={Boolean(selectedEventForReport)}
          onClose={() => setSelectedEventForReport(null)}
          event={selectedEventForReport}
        />
      )}

      {/* Delete Event Confirmation Modal */}
      {eventToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Delete Welfare Event?</h4>
                <p className="text-xs text-slate-500 line-clamp-1">{eventToDelete.title}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete this event appeal? This will remove the event record and allow you to start fresh.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEventToDelete(null)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const res = deleteWelfareEvent(eventToDelete.id, true);
                  if (res.success) {
                    success('Event Deleted', res.message);
                  } else {
                    warning('Deletion Notice', res.message);
                  }
                  setEventToDelete(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Events Confirmation Modal */}
      {isConfirmingClearAllEvents && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Delete All Events & Start Fresh?</h4>
                <p className="text-xs text-slate-500">{welfareEvents.length} event(s) in database</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will clear all welfare contribution appeals and their contributions so you can start with a completely fresh, empty welfare register.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsConfirmingClearAllEvents(false)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const res = clearAllWelfareEvents();
                  success('Welfare Reset', res.message);
                  setIsConfirmingClearAllEvents(false);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Clear All Events
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
