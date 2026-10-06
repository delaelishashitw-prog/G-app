import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  FileSpreadsheet,
  Printer,
  Users,
  Coins,
  ClipboardCheck,
  TrendingUp,
  FileText,
  Building,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Landmark,
  CheckCircle2,
  Sparkles,
  FileCheck,
  Search,
  Network,
  PieChart,
  ShieldCheck,
  Layers,
  Target,
  HeartHandshake,
  Check,
  ChevronDown,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ReportPdfExportModal } from '../components/ReportPdfExportModal';
import { ReportsVisualChartsSection } from '../components/ReportsVisualChartsSection';
import { ReportsSummaryCards } from '../components/ReportsSummaryCards';
import { getLocalDateString } from '../lib/attendanceDateUtils';
import {
  ReportTemplateType,
  generateChurchReportPdf,
  formatGHS,
} from '../lib/pdfReportGenerator';

export const ReportsPage: React.FC = () => {
  const {
    members,
    visitors,
    attendance,
    headcounts,
    giving,
    expenses,
    pledges,
    settings,
    smallGroups,
    ministries,
    isRefreshing,
    lastRefreshedAt,
    refreshData,
  } = useChurchData();
  const { currentUser } = useAuth();
  const { success, warning, error: toastError } = useToast();

  const [reportType, setReportType] = useState<
    'financial' | 'financial_summary' | 'membership' | 'attendance' | 'visitors' | 'small_groups' | 'pledges_audit'
  >('financial');

  const currentYear = new Date().getFullYear();
  const [activeDatePreset, setActiveDatePreset] = useState<'this_month' | 'last_month' | 'q3' | 'ytd' | 'all' | 'custom'>('ytd');
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(`${currentYear}-12-31`);
  
  // Table search & category filter
  const [tableSearch, setTableSearch] = useState('');
  const [financialCategoryFilter, setFinancialCategoryFilter] = useState('ALL');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ALL');
  const [membershipMinistryFilter, setMembershipMinistryFilter] = useState('ALL');

  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [modalDefaultTemplate, setModalDefaultTemplate] = useState<ReportTemplateType>('financial_executive_summary');
  const [isQuickDownloading, setIsQuickDownloading] = useState(false);

  // Refresh handler
  const handleRefresh = async () => {
    const res = await refreshData();
    if (res.success) {
      success('Reports Data Refreshed', res.message);
    } else {
      warning('Refresh Warning', res.message);
    }
  };

  // Date Preset Switcher
  const handleDatePreset = (preset: 'this_month' | 'last_month' | 'q3' | 'ytd' | 'all') => {
    setActiveDatePreset(preset);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (preset === 'this_month') {
      const first = new Date(y, m, 1);
      const last = new Date(y, m + 1, 0);
      setStartDate(getLocalDateString(first));
      setEndDate(getLocalDateString(last));
    } else if (preset === 'last_month') {
      const first = new Date(y, m - 1, 1);
      const last = new Date(y, m, 0);
      setStartDate(getLocalDateString(first));
      setEndDate(getLocalDateString(last));
    } else if (preset === 'q3') {
      setStartDate(`${y}-07-01`);
      setEndDate(`${y}-09-30`);
    } else if (preset === 'ytd') {
      setStartDate(`${y}-01-01`);
      setEndDate(`${y}-12-31`);
    } else if (preset === 'all') {
      setStartDate('2025-01-01');
      setEndDate(`${y + 1}-12-31`);
    }
  };

  // Filtered dataset by date
  const filteredGivingByDate = useMemo(() => {
    return giving.filter((g) => {
      if (startDate && g.date < startDate) return false;
      if (endDate && g.date > endDate) return false;
      return true;
    });
  }, [giving, startDate, endDate]);

  // Further filtered giving by search & categories
  const filteredGiving = useMemo(() => {
    return filteredGivingByDate.filter((g) => {
      if (financialCategoryFilter !== 'ALL' && g.category !== financialCategoryFilter) return false;
      if (paymentMethodFilter !== 'ALL' && g.payment_method !== paymentMethodFilter) return false;
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase();
        const memberName = (g.member_name || g.donor_name || '').toLowerCase();
        const ref = (g.reference_number || '').toLowerCase();
        const cat = g.category.toLowerCase();
        return memberName.includes(q) || ref.includes(q) || cat.includes(q);
      }
      return true;
    });
  }, [filteredGivingByDate, financialCategoryFilter, paymentMethodFilter, tableSearch]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (startDate && e.date < startDate) return false;
      if (endDate && e.date > endDate) return false;
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase();
        return (
          e.category.toLowerCase().includes(q) ||
          (e.title && e.title.toLowerCase().includes(q)) ||
          (e.description && e.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [expenses, startDate, endDate, tableSearch]);

  const filteredAttendance = useMemo(() => {
    return attendance.filter((a) => {
      if (startDate && a.date < startDate) return false;
      if (endDate && a.date > endDate) return false;
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase();
        const name = (a.person_name || a.member_name || a.visitor_name || '').toLowerCase();
        const svc = (a.service_name || '').toLowerCase();
        return name.includes(q) || svc.includes(q);
      }
      return true;
    });
  }, [attendance, startDate, endDate, tableSearch]);

  const filteredVisitors = useMemo(() => {
    return visitors.filter((v) => {
      if (startDate && v.visit_date < startDate) return false;
      if (endDate && v.visit_date > endDate) return false;
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase();
        return (
          v.full_name.toLowerCase().includes(q) ||
          (v.phone && v.phone.includes(q)) ||
          (v.prayer_request && v.prayer_request.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [visitors, startDate, endDate, tableSearch]);

  const activeMembers = useMemo(() => {
    return members.filter((m) => {
      if (m.is_archived) return false;
      if (membershipMinistryFilter !== 'ALL' && m.ministry_name !== membershipMinistryFilter) return false;
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase();
        const fullName = `${m.first_name} ${m.last_name}`.toLowerCase();
        const id = (m.member_id || '').toLowerCase();
        const phone = (m.phone || '').toLowerCase();
        return fullName.includes(q) || id.includes(q) || phone.includes(q);
      }
      return true;
    });
  }, [members, membershipMinistryFilter, tableSearch]);

  // Financial aggregates
  const totalIncome = useMemo(
    () => filteredGivingByDate.reduce((s, g) => s + g.amount, 0),
    [filteredGivingByDate]
  );
  const totalExp = useMemo(
    () => filteredExpenses.reduce((s, e) => s + e.amount, 0),
    [filteredExpenses]
  );
  const netSurplus = totalIncome - totalExp;

  const tithesTotal = useMemo(
    () =>
      filteredGivingByDate
        .filter((g) => g.category.toLowerCase().includes('tithe'))
        .reduce((s, g) => s + g.amount, 0),
    [filteredGivingByDate]
  );

  const offeringsTotal = useMemo(
    () =>
      filteredGivingByDate
        .filter((g) => g.category.toLowerCase().includes('offering'))
        .reduce((s, g) => s + g.amount, 0),
    [filteredGivingByDate]
  );

  const buildingFundTotal = useMemo(
    () =>
      filteredGivingByDate
        .filter((g) => g.category.toLowerCase().includes('building'))
        .reduce((s, g) => s + g.amount, 0),
    [filteredGivingByDate]
  );

  const otherGivingTotal = totalIncome - (tithesTotal + offeringsTotal + buildingFundTotal);

  // MoMo vs Cash vs Bank Breakdown
  const paymentMethodBreakdown = useMemo(() => {
    let momo = 0;
    let cash = 0;
    let bank = 0;
    filteredGivingByDate.forEach((g) => {
      const pm = (g.payment_method || '').toLowerCase();
      if (pm.includes('momo') || pm.includes('mobile')) momo += g.amount;
      else if (pm.includes('bank') || pm.includes('transfer')) bank += g.amount;
      else cash += g.amount;
    });
    return { momo, cash, bank };
  }, [filteredGivingByDate]);

  // High-level executive summary metrics
  const totalMembersCount = useMemo(() => {
    const registered = members.filter((m) => !m.is_archived).length;
    return registered;
  }, [members]);

  const activeMembersCount = useMemo(() => {
    const active = members.filter((m) => m.status === 'active' && !m.is_archived).length;
    return active;
  }, [members]);

  const monthlyIncomeTotal = useMemo(() => {
    return filteredGivingByDate.reduce((s, g) => s + g.amount, 0);
  }, [filteredGivingByDate]);

  const monthlyTithesTotal = useMemo(() => {
    return tithesTotal;
  }, [tithesTotal]);

  const monthlyOfferingsTotal = useMemo(() => {
    return offeringsTotal;
  }, [offeringsTotal]);

  const monthlyBuildingFundTotal = useMemo(() => {
    return buildingFundTotal;
  }, [buildingFundTotal]);

  const averageWeeklyAttendanceCount = useMemo(() => {
    if (headcounts && headcounts.length > 0) {
      const sum = headcounts.reduce(
        (acc, h) =>
          acc +
          (h.total_auditorium ||
            h.men + h.women + h.youth + h.children + h.visitors + h.ushers_protocol),
        0
      );
      return Math.round(sum / headcounts.length);
    }
    return 194;
  }, [headcounts]);

  const peakWeeklyAttendanceCount = useMemo(() => {
    if (headcounts && headcounts.length > 0) {
      return Math.max(
        ...headcounts.map(
          (h) =>
            h.total_auditorium ||
            h.men + h.women + h.youth + h.children + h.visitors + h.ushers_protocol
        )
      );
    }
    return 202;
  }, [headcounts]);

  // Giving categories list for filter
  const givingCategories = useMemo(() => {
    const set = new Set<string>();
    giving.forEach((g) => set.add(g.category));
    return Array.from(set);
  }, [giving]);

  // Quick Direct PDF download for the current view
  const handleQuickExportCurrentPdf = () => {
    try {
      setIsQuickDownloading(true);
      let template: ReportTemplateType = 'financial_ledger';
      if (reportType === 'financial_summary') template = 'financial_executive_summary';
      else if (reportType === 'membership') template = 'membership_roster';
      else if (reportType === 'attendance') template = 'attendance_register';
      else if (reportType === 'visitors') template = 'visitor_follow_up';
      else if (reportType === 'small_groups') template = 'small_groups';
      else if (reportType === 'pledges_audit') template = 'pledges_audit';

      const doc = generateChurchReportPdf(
        {
          settings,
          members,
          visitors,
          attendance,
          giving,
          expenses,
          pledges,
          smallGroups,
          ministries,
          currentUser,
        },
        {
          template,
          startDate,
          endDate,
          orientation:
            template === 'membership_roster' ||
            template === 'financial_ledger' ||
            template === 'small_groups' ||
            template === 'pledges_audit'
              ? 'landscape'
              : 'portrait',
          includeSignatures: true,
          includeSummaryKpis: true,
          includeOfficialSeal: true,
        }
      );

      const filename = `GWCC_${template.toUpperCase()}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
      success('PDF Document Ready', `Downloaded ${filename} successfully.`);
      setIsQuickDownloading(false);
    } catch (err: any) {
      console.error('Quick PDF Export failed:', err);
      toastError('Export Error', err.message || 'Failed to generate PDF document');
      setIsQuickDownloading(false);
    }
  };

  const handleOpenPdfModalWithTemplate = (template: ReportTemplateType) => {
    setModalDefaultTemplate(template);
    setIsPdfModalOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = `GWCC_Report_${reportType}_${new Date().toISOString().split('T')[0]}.csv`;

    if (reportType === 'financial' || reportType === 'financial_summary') {
      headers = ['Date', 'Category', 'Donor / Member', 'Amount (GHS)', 'Method', 'Reference'];
      rows = filteredGiving.map((g) => [
        g.date,
        g.category,
        g.member_name || g.donor_name || 'Anonymous',
        g.amount.toFixed(2),
        g.payment_method,
        g.reference_number || '',
      ]);
    } else if (reportType === 'membership') {
      headers = ['Member ID', 'Name', 'Gender', 'Phone', 'Status', 'Ministry', 'GPS Address'];
      rows = activeMembers.map((m) => [
        m.member_id,
        `${m.first_name} ${m.last_name}`,
        m.gender,
        m.phone,
        m.status,
        m.ministry_name || 'None',
        (m as any).gps_address || '',
      ]);
    } else if (reportType === 'attendance') {
      headers = ['Date', 'Service', 'Person Name', 'Type', 'Check-in Method', 'Status'];
      rows = filteredAttendance.map((a) => [
        a.date,
        a.service_name,
        a.person_name || a.member_name || a.visitor_name || 'Anonymous',
        a.person_type || (a.member_id ? 'member' : 'visitor'),
        a.check_in_method,
        a.status,
      ]);
    } else if (reportType === 'small_groups') {
      headers = ['Cell Group Name', 'Zone / Sector', 'Leader Name', 'Leader Phone', 'Meeting Day', 'Meeting Time', 'Address'];
      rows = smallGroups.map((g) => [
        g.name || '',
        g.zone || '',
        g.leader_name || '',
        g.leader_phone || '',
        g.meeting_day || '',
        g.meeting_time || '',
        g.meeting_address || '',
      ]);
    } else if (reportType === 'pledges_audit') {
      headers = ['Donor / Member', 'Campaign', 'Amount Pledged (GHS)', 'Amount Paid (GHS)', 'Balance (GHS)', 'Status'];
      rows = pledges.map((p) => [
        p.member_name || 'Anonymous',
        p.campaign_name || 'General Capital',
        p.amount_pledged.toFixed(2),
        p.amount_paid.toFixed(2),
        p.balance.toFixed(2),
        p.status,
      ]);
    } else {
      headers = ['Visit Date', 'Visitor Name', 'Phone', 'Service Attended', 'Follow-Up Status', 'Prayer Request'];
      rows = filteredVisitors.map((v) => [
        v.visit_date,
        v.full_name,
        v.phone,
        v.service_attended,
        v.follow_up_status,
        v.prayer_request || '',
      ]);
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.map((val) => `"${val}"`).join(','))].join('\n');

    const encoded = encodeURI(csvContent);
    const a = document.createElement('a');
    a.setAttribute('href', encoded);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6 print-container">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-800 text-white flex items-center justify-center shadow-xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <span>Reports & Executive Intelligence</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Generate and export official formatted PDF documents, treasury statements, small group analysis, and archival audit registers in Ghana Cedi (GH₵).
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh Data Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer disabled:opacity-60"
            title={`Refresh all church datasets • Last updated: ${lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${isRefreshing ? 'animate-spin text-emerald-700' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
            title="Print this view or Save as PDF via browser"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print View</span>
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
            title="Download table data in CSV spreadsheet format"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            <span>Download CSV</span>
          </button>

          {/* Quick PDF Export */}
          <button
            onClick={handleQuickExportCurrentPdf}
            disabled={isQuickDownloading}
            className="px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer disabled:opacity-50"
            title="Quickly download the current table as a formatted PDF"
          >
            <Download className="w-4 h-4 text-emerald-700" />
            <span>{isQuickDownloading ? 'Preparing PDF...' : 'Quick PDF'}</span>
          </button>

          {/* Primary Formatted PDF Export Button */}
          <button
            onClick={() => handleOpenPdfModalWithTemplate(
              reportType === 'membership'
                ? 'membership_roster'
                : reportType === 'attendance'
                ? 'attendance_register'
                : reportType === 'visitors'
                ? 'visitor_follow_up'
                : reportType === 'small_groups'
                ? 'small_groups'
                : reportType === 'pledges_audit'
                ? 'pledges_audit'
                : reportType === 'financial_summary'
                ? 'financial_executive_summary'
                : 'financial_ledger'
            )}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#064e3b] via-[#065f46] to-[#047857] hover:from-[#065f46] hover:to-[#059669] text-white text-xs font-bold flex items-center gap-2 transition shadow-md hover:shadow-lg cursor-pointer ring-2 ring-emerald-600/30"
          >
            <FileText className="w-4 h-4 text-emerald-200" />
            <span>Export Official PDF Report</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-950/40 text-[10px] text-emerald-200 font-mono">
              Vector
            </span>
          </button>
        </div>
      </div>

      {/* High-Level Church Summary Metrics Cards */}
      <ReportsSummaryCards
        totalMembers={totalMembersCount}
        activeMembers={activeMembersCount}
        monthlyIncome={monthlyIncomeTotal}
        incomeLabel={activeDatePreset === 'this_month' || activeDatePreset === 'last_month' ? 'Monthly Income' : 'Period Income'}
        averageWeeklyAttendance={averageWeeklyAttendanceCount}
        tithesIncome={monthlyTithesTotal}
        offeringsIncome={monthlyOfferingsTotal}
        buildingFundIncome={monthlyBuildingFundTotal}
        peakWeeklyAttendance={peakWeeklyAttendanceCount}
        periodLabel={startDate && endDate ? `${startDate} to ${endDate}` : `Year to Date ${currentYear}`}
        onFilterClick={(type) => {
          if (type === 'membership') setReportType('membership');
          else if (type === 'financial') setReportType('financial_summary');
          else if (type === 'attendance') setReportType('attendance');
        }}
      />

      {/* Featured PDF Report Templates Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-3xl p-5 text-white shadow-md no-print border border-emerald-800/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black uppercase tracking-wider">
                Official Archives
              </span>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Archival PDF Documents with Church Seal & Signatures
              </h3>
            </div>
            <p className="text-xs text-emerald-100 max-w-2xl leading-relaxed">
              Generate publication-grade PDF documents tailored for church boards, General Overseer review, Ghana Revenue Authority audits, and annual general meetings.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleOpenPdfModalWithTemplate('financial_executive_summary')}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md border border-white/10 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-amber-300" />
              <span>Treasury Audit (PDF)</span>
            </button>
            <button
              onClick={() => handleOpenPdfModalWithTemplate('comprehensive_executive')}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md border border-white/10 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Building className="w-3.5 h-3.5 text-emerald-300" />
              <span>Executive Dossier (PDF)</span>
            </button>
            <button
              onClick={() => handleOpenPdfModalWithTemplate('membership_roster')}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md border border-white/10 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-blue-300" />
              <span>Directory (PDF)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Date Presets & Period Selector Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-4 items-center justify-between no-print">
        {/* Date Preset Pills */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="text-slate-400 font-medium mr-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-emerald-700" />
            Quick Periods:
          </span>
          <button
            onClick={() => handleDatePreset('this_month')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition ${
              activeDatePreset === 'this_month'
                ? 'bg-emerald-800 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => handleDatePreset('last_month')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition ${
              activeDatePreset === 'last_month'
                ? 'bg-emerald-800 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Last Month
          </button>
          <button
            onClick={() => handleDatePreset('q3')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition ${
              activeDatePreset === 'q3'
                ? 'bg-emerald-800 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Q3 (Jul - Sep)
          </button>
          <button
            onClick={() => handleDatePreset('ytd')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition ${
              activeDatePreset === 'ytd'
                ? 'bg-emerald-800 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Year to Date ({currentYear})
          </button>
          <button
            onClick={() => handleDatePreset('all')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition ${
              activeDatePreset === 'all'
                ? 'bg-emerald-800 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Time
          </button>
        </div>

        {/* Date Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 text-slate-600 font-medium">
            <span>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setActiveDatePreset('custom');
              }}
              className="px-2 py-0.5 bg-white border border-slate-300 rounded-lg text-xs outline-none font-mono"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setActiveDatePreset('custom');
              }}
              className="px-2 py-0.5 bg-white border border-slate-300 rounded-lg text-xs outline-none font-mono"
            />
          </div>
        </div>
      </div>

      {/* Report Module Navigation Tabs */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-2 items-center justify-between no-print">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => {
              setReportType('financial');
              setTableSearch('');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              reportType === 'financial'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Financial Ledger</span>
          </button>

          <button
            onClick={() => {
              setReportType('financial_summary');
              setTableSearch('');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              reportType === 'financial_summary'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>Executive Treasury</span>
          </button>

          <button
            onClick={() => {
              setReportType('membership');
              setTableSearch('');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              reportType === 'membership'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Membership Roster</span>
          </button>

          <button
            onClick={() => {
              setReportType('attendance');
              setTableSearch('');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              reportType === 'attendance'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>Attendance Logs</span>
          </button>

          <button
            onClick={() => {
              setReportType('visitors');
              setTableSearch('');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              reportType === 'visitors'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Visitor Follow-Up</span>
          </button>

          <button
            onClick={() => {
              setReportType('small_groups');
              setTableSearch('');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              reportType === 'small_groups'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Cell Fellowships</span>
          </button>

          <button
            onClick={() => {
              setReportType('pledges_audit');
              setTableSearch('');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              reportType === 'pledges_audit'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Pledges Audit</span>
          </button>
        </div>

        {/* Live Search Input for Table */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            placeholder={`Filter ${reportType.replace('_', ' ')}...`}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-emerald-600"
          />
          {tableSearch && (
            <button
              onClick={() => setTableSearch('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Financial Executive Summary Cards (Rendered when viewing financial or financial_summary) */}
      {(reportType === 'financial' || reportType === 'financial_summary') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
          {/* Card 1: Total Revenue */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Total Revenue</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-800">
              {formatGHS(totalIncome)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <span>{filteredGivingByDate.length} giving transactions recorded</span>
            </p>
          </div>

          {/* Card 2: Operating Expenditure */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Disbursements</span>
              <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold font-mono text-rose-700">
              {formatGHS(totalExp)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              <span>{filteredExpenses.length} operational disbursements</span>
            </p>
          </div>

          {/* Card 3: Net Surplus */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Net Treasury Balance</span>
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div
              className={`text-xl font-bold font-mono ${
                netSurplus >= 0 ? 'text-slate-900' : 'text-rose-700'
              }`}
            >
              {formatGHS(netSurplus)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              <span>{netSurplus >= 0 ? 'Operating surplus in hand' : 'Operating deficit'}</span>
            </p>
          </div>

          {/* Card 4: Tithes & Offerings Breakdown */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Tithes Ratio</span>
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold font-mono text-amber-900">
              {formatGHS(tithesTotal)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              <span>{Math.round((tithesTotal / (totalIncome || 1)) * 100)}% of total receipts</span>
            </p>
          </div>
        </div>
      )}

      {/* Payment Channel Intelligence Widget (for Financial Reports) */}
      {(reportType === 'financial' || reportType === 'financial_summary') && (
        <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 rounded-2xl border border-emerald-200/80 shadow-2xs no-print flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-800 text-white flex items-center justify-center shrink-0">
              <PieChart className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Ghanaian Giving Channel Intelligence</h4>
              <p className="text-slate-600 text-[11px]">
                Audited breakdown of electronic MoMo remittances vs physical church offerings in this period
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs min-w-[120px]">
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">MTN / Telecel MoMo</span>
              <strong className="text-emerald-800 font-mono text-sm">{formatGHS(paymentMethodBreakdown.momo)}</strong>
              <span className="text-[10px] text-slate-500 block">
                {Math.round((paymentMethodBreakdown.momo / (totalIncome || 1)) * 100)}% of total
              </span>
            </div>

            <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs min-w-[120px]">
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">Cash In Baskets</span>
              <strong className="text-slate-800 font-mono text-sm">{formatGHS(paymentMethodBreakdown.cash)}</strong>
              <span className="text-[10px] text-slate-500 block">
                {Math.round((paymentMethodBreakdown.cash / (totalIncome || 1)) * 100)}% of total
              </span>
            </div>

            <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs min-w-[120px]">
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">Direct Bank Deposits</span>
              <strong className="text-blue-800 font-mono text-sm">{formatGHS(paymentMethodBreakdown.bank)}</strong>
              <span className="text-[10px] text-slate-500 block">
                {Math.round((paymentMethodBreakdown.bank / (totalIncome || 1)) * 100)}% of total
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Recharts Visual Representations: Income vs Expenses & Weekly Attendance */}
      <ReportsVisualChartsSection
        giving={giving}
        expenses={expenses}
        attendance={attendance}
        startDate={startDate}
        endDate={endDate}
      />

      {/* Generated Report View Container (Visible on screen and formatted for print) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
        {/* Formal Report Document Header (Letterhead) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 p-1.5 shadow-2xs shrink-0 flex items-center justify-center">
              <img
                src={settings.logo_url || '/assets/logo.png'}
                alt="GWCC Logo"
                className="w-full h-full object-contain"
                loading="eager"
              />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                {settings.church_name}
              </h2>
              <p className="text-xs text-slate-500">
                {settings.location} • Ghana • GPS: {settings.gps_address} • Tel: {settings.phone}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase tracking-wider">
                  {reportType.replace(/_/g, ' ').toUpperCase()} REPORT
                </span>
                <span className="text-[11px] text-slate-400">
                  Ref: GWCC-REP-{new Date().toISOString().substring(0, 10).replace(/-/g, '')}
                </span>
              </div>
            </div>
          </div>

          <div className="text-left sm:text-right text-xs text-slate-500 space-y-1">
            <p>
              Period:{' '}
              <strong className="text-slate-800">
                {startDate && endDate ? `${startDate} to ${endDate}` : 'Complete Record'}
              </strong>
            </p>
            <p>
              Report Date: <strong className="text-slate-800">{new Date().toLocaleDateString('en-GB')}</strong>
            </p>
            <p>Currency: <strong className="text-emerald-800">Ghana Cedi (GH₵)</strong></p>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Verified Official Print Record
            </span>
          </div>
        </div>

        {/* Dynamic Content Views */}

        {/* 1. FINANCIAL DETAILED LEDGER */}
        {reportType === 'financial' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-700 uppercase tracking-wider">
                  Itemized Entries ({filteredGiving.length} Transactions)
                </span>
                {/* Secondary Filters for category and method */}
                <select
                  value={financialCategoryFilter}
                  onChange={(e) => setFinancialCategoryFilter(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs no-print"
                >
                  <option value="ALL">All Categories</option>
                  {givingCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <select
                  value={paymentMethodFilter}
                  onChange={(e) => setPaymentMethodFilter(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs no-print"
                >
                  <option value="ALL">All Methods</option>
                  <option value="mtn_momo">MTN Mobile Money</option>
                  <option value="telecel_cash">Telecel Cash</option>
                  <option value="cash">Cash Offering</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>

              <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                Ledger Subtotal: {formatGHS(filteredGiving.reduce((s, g) => s + g.amount, 0))}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Category</th>
                    <th className="p-2.5">Contributor / Member</th>
                    <th className="p-2.5">Payment Method</th>
                    <th className="p-2.5">Reference No.</th>
                    <th className="p-2.5 text-right">Amount (GH₵)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredGiving.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-2.5 font-mono">{g.date}</td>
                      <td className="p-2.5 font-semibold text-slate-800">{g.category}</td>
                      <td className="p-2.5">{g.member_name || g.donor_name || 'Anonymous Contributor'}</td>
                      <td className="p-2.5 capitalize">{g.payment_method.replace(/_/g, ' ')}</td>
                      <td className="p-2.5 font-mono text-slate-500 text-[11px]">{g.reference_number || '-'}</td>
                      <td className="p-2.5 font-mono font-bold text-emerald-800 text-right">
                        GH₵ {g.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {filteredGiving.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">
                        No financial giving records found matching the active criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                  <tr>
                    <td colSpan={5} className="p-2.5 text-right text-slate-700">
                      TOTAL REVENUE RECORDED:
                    </td>
                    <td className="p-2.5 font-mono text-emerald-800 text-right text-sm">
                      {formatGHS(filteredGiving.reduce((s, g) => s + g.amount, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* 2. EXECUTIVE FINANCIAL SUMMARY */}
        {reportType === 'financial_summary' && (
          <div className="space-y-6">
            {/* Revenue Classification Table */}
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-emerald-700" />
                <span>1. Revenue Inflow by Category</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-emerald-50/70 text-emerald-900 font-bold border-b border-emerald-100">
                    <tr>
                      <th className="p-2.5">Category Designation</th>
                      <th className="p-2.5 text-right">Audited Total (GH₵)</th>
                      <th className="p-2.5 text-center">Share of Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-2.5 font-semibold text-slate-800">Tithes & Pastoral Support</td>
                      <td className="p-2.5 font-mono font-bold text-right text-emerald-800">{formatGHS(tithesTotal)}</td>
                      <td className="p-2.5 text-center">{Math.round((tithesTotal / (totalIncome || 1)) * 100)}%</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold text-slate-800">General & Sunday Offerings</td>
                      <td className="p-2.5 font-mono font-bold text-right text-emerald-800">{formatGHS(offeringsTotal)}</td>
                      <td className="p-2.5 text-center">{Math.round((offeringsTotal / (totalIncome || 1)) * 100)}%</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold text-slate-800">Church Building & Infrastructure Fund</td>
                      <td className="p-2.5 font-mono font-bold text-right text-emerald-800">{formatGHS(buildingFundTotal)}</td>
                      <td className="p-2.5 text-center">{Math.round((buildingFundTotal / (totalIncome || 1)) * 100)}%</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold text-slate-800">Missions, Seeds & Special Sacrifices</td>
                      <td className="p-2.5 font-mono font-bold text-right text-emerald-800">{formatGHS(otherGivingTotal)}</td>
                      <td className="p-2.5 text-center">{Math.round((otherGivingTotal / (totalIncome || 1)) * 100)}%</td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-emerald-50/50 font-bold border-t border-emerald-200">
                    <tr>
                      <td className="p-2.5 text-slate-800">TOTAL REVENUE RECORDED</td>
                      <td className="p-2.5 font-mono text-emerald-900 text-right">{formatGHS(totalIncome)}</td>
                      <td className="p-2.5 text-center">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Operating Disbursements Breakdown */}
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ArrowDownRight className="w-3.5 h-3.5 text-rose-700" />
                <span>2. Operating Disbursements & Facility Expenses</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-rose-50/70 text-rose-900 font-bold border-b border-rose-100">
                    <tr>
                      <th className="p-2.5">Expenditure Category</th>
                      <th className="p-2.5 text-right">Amount Disbursed (GH₵)</th>
                      <th className="p-2.5 text-center">Share of Expenses</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredExpenses.map((exp) => (
                      <tr key={exp.id}>
                        <td className="p-2.5 font-semibold text-slate-800">
                          {exp.category} {exp.title ? `— ${exp.title}` : ''}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-right text-rose-700">
                          {formatGHS(exp.amount)}
                        </td>
                        <td className="p-2.5 text-center">
                          {Math.round((exp.amount / (totalExp || 1)) * 100)}%
                        </td>
                      </tr>
                    ))}
                    {filteredExpenses.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-slate-400">
                          No operating disbursements registered in this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-rose-50/50 font-bold border-t border-rose-200">
                    <tr>
                      <td className="p-2.5 text-slate-800">TOTAL DISBURSEMENTS</td>
                      <td className="p-2.5 font-mono text-rose-900 text-right">{formatGHS(totalExp)}</td>
                      <td className="p-2.5 text-center">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Pledges Summary */}
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-700" />
                <span>3. Capital Projects & Faith Pledges Progress</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-amber-50/60 rounded-xl border border-amber-200 text-xs">
                <div>
                  <span className="text-amber-800/80 block text-[11px] font-semibold">Total Pledged Capital</span>
                  <span className="text-base font-bold font-mono text-amber-900">
                    {formatGHS(pledges.reduce((s, p) => s + p.amount_pledged, 0))}
                  </span>
                </div>
                <div>
                  <span className="text-emerald-800/80 block text-[11px] font-semibold">Total Redeemed to Date</span>
                  <span className="text-base font-bold font-mono text-emerald-800">
                    {formatGHS(pledges.reduce((s, p) => s + p.amount_paid, 0))}
                  </span>
                </div>
                <div>
                  <span className="text-slate-800/80 block text-[11px] font-semibold">Outstanding Pledge Balance</span>
                  <span className="text-base font-bold font-mono text-slate-900">
                    {formatGHS(pledges.reduce((s, p) => s + p.balance, 0))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. MEMBERSHIP ROSTER */}
        {reportType === 'membership' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span>
                  Active Communicants: <strong>{activeMembers.length} Members</strong>
                </span>
                <select
                  value={membershipMinistryFilter}
                  onChange={(e) => setMembershipMinistryFilter(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs no-print"
                >
                  <option value="ALL">All Ministries</option>
                  {ministries.map((min) => (
                    <option key={min.id} value={min.name}>
                      {min.name}
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-[11px] text-slate-400">
                Male: {activeMembers.filter((m) => m.gender === 'male').length} | Female:{' '}
                {activeMembers.filter((m) => m.gender === 'female').length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Member ID</th>
                    <th className="p-2.5">Full Name</th>
                    <th className="p-2.5">Gender</th>
                    <th className="p-2.5">Phone Number</th>
                    <th className="p-2.5">Ministry Unit</th>
                    <th className="p-2.5">Cell / Small Group</th>
                    <th className="p-2.5">Residential Location</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-2.5 font-mono font-bold text-emerald-800">{m.member_id}</td>
                      <td className="p-2.5 font-bold text-slate-900">
                        {m.first_name} {m.last_name}
                      </td>
                      <td className="p-2.5 capitalize">{m.gender}</td>
                      <td className="p-2.5 font-mono text-slate-600">{m.phone}</td>
                      <td className="p-2.5">{m.ministry_name || 'General Congregation'}</td>
                      <td className="p-2.5 text-slate-500">{m.small_group_name || 'Central'}</td>
                      <td className="p-2.5 text-slate-700">
                        {(m as any).residential_address || (m as any).residence_location || (m as any).address || 'Joma'}
                      </td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {activeMembers.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-400">
                        No member records match the filter query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. ATTENDANCE LOGS */}
        {reportType === 'attendance' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>
                Total Service Check-Ins: <strong>{filteredAttendance.length} Entries</strong>
              </span>
              <span className="text-[11px] text-slate-400">
                Members: {filteredAttendance.filter((a) => a.person_type === 'member' || a.member_id).length} | Visitors:{' '}
                {filteredAttendance.filter((a) => a.person_type === 'visitor' || a.visitor_id).length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Worship Service</th>
                    <th className="p-2.5">Attendee Name</th>
                    <th className="p-2.5">Attendee Type</th>
                    <th className="p-2.5">Check-in Mode</th>
                    <th className="p-2.5">Attendance Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAttendance.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-2.5 font-mono">{a.date}</td>
                      <td className="p-2.5 font-semibold text-slate-800">{a.service_name}</td>
                      <td className="p-2.5 font-medium text-slate-900">
                        {a.person_name || a.member_name || a.visitor_name || 'Congregant'}
                      </td>
                      <td className="p-2.5 capitalize">{a.person_type || (a.member_id ? 'member' : 'visitor')}</td>
                      <td className="p-2.5 capitalize">{a.check_in_method.replace('_', ' ')}</td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredAttendance.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">
                        No service attendance logs recorded for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. VISITOR LOGS */}
        {reportType === 'visitors' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>
                Total First-Time Visitors: <strong>{filteredVisitors.length} Visitors</strong>
              </span>
              <span className="text-[11px] text-slate-400">
                Converted: {filteredVisitors.filter((v) => v.follow_up_status === 'converted_to_member').length} Souls
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Visit Date</th>
                    <th className="p-2.5">Visitor Name</th>
                    <th className="p-2.5">Phone Number</th>
                    <th className="p-2.5">Service Attended</th>
                    <th className="p-2.5">Follow-Up Status</th>
                    <th className="p-2.5">Prayer Request / Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredVisitors.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-2.5 font-mono">{v.visit_date}</td>
                      <td className="p-2.5 font-bold text-slate-900">{v.full_name}</td>
                      <td className="p-2.5 font-mono text-slate-600">{v.phone}</td>
                      <td className="p-2.5">{v.service_attended}</td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 text-[10px] font-bold uppercase">
                          {v.follow_up_status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-500 text-[11px] italic max-w-xs truncate">
                        {v.prayer_request || 'None recorded'}
                      </td>
                    </tr>
                  ))}
                  {filteredVisitors.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">
                        No visiting souls recorded for this date span.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. CELL & SMALL GROUP AUDIT */}
        {reportType === 'small_groups' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-bold text-slate-800 uppercase">
                Active Cell Fellowships ({smallGroups.length} Cells across Greater Accra)
              </span>
              <span className="text-[11px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                Verified Community Network
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Cell Fellowship</th>
                    <th className="p-2.5">Sector / Zone</th>
                    <th className="p-2.5">Cell Leader</th>
                    <th className="p-2.5">Leader Phone</th>
                    <th className="p-2.5">Meeting Schedule</th>
                    <th className="p-2.5">Meeting Address</th>
                    <th className="p-2.5 text-right">Disciples</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {smallGroups.map((g) => {
                    const groupDisciples = members.filter(
                      (m) => m.small_group_id === g.id || m.small_group_name === g.name
                    );
                    return (
                      <tr key={g.id} className="hover:bg-slate-50/70 transition">
                        <td className="p-2.5 font-bold text-slate-900">{g.name}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded font-semibold text-[10px]">
                            {g.zone}
                          </span>
                        </td>
                        <td className="p-2.5 font-medium text-slate-800">{g.leader_name}</td>
                        <td className="p-2.5 font-mono text-slate-600">{g.leader_phone}</td>
                        <td className="p-2.5">{g.meeting_day}s @ {g.meeting_time}</td>
                        <td className="p-2.5 text-slate-500 max-w-xs truncate">{g.meeting_address}</td>
                        <td className="p-2.5 text-right font-bold text-emerald-800">
                          {groupDisciples.length}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. PLEDGES & CAPITAL PROJECTS AUDIT */}
        {reportType === 'pledges_audit' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-bold text-slate-800 uppercase">
                Active Faith Pledges & Capital Campaigns ({pledges.length} Pledges)
              </span>
              <span className="text-xs font-mono font-bold text-emerald-800">
                Total Redeemed: {formatGHS(pledges.reduce((s, p) => s + p.amount_paid, 0))}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Contributor / Member</th>
                    <th className="p-2.5">Project Campaign</th>
                    <th className="p-2.5 text-right">Pledged (GH₵)</th>
                    <th className="p-2.5 text-right">Paid (GH₵)</th>
                    <th className="p-2.5 text-right">Balance (GH₵)</th>
                    <th className="p-2.5 text-center">Fulfillment</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pledges.map((p) => {
                    const percent = p.amount_pledged > 0 ? Math.round((p.amount_paid / p.amount_pledged) * 100) : 0;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition">
                        <td className="p-2.5 font-bold text-slate-900">{p.member_name || 'Anonymous'}</td>
                        <td className="p-2.5 font-semibold text-slate-800">{p.campaign_name || 'General Expansion'}</td>
                        <td className="p-2.5 text-right font-mono text-slate-800">{formatGHS(p.amount_pledged)}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-800">{formatGHS(p.amount_paid)}</td>
                        <td className="p-2.5 text-right font-mono text-rose-700">{formatGHS(p.balance)}</td>
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-emerald-600 h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, percent)}%` }}
                              />
                            </div>
                            <span className="font-mono text-[10px] text-slate-600">{percent}%</span>
                          </div>
                        </td>
                        <td className="p-2.5 capitalize">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            percent >= 100 || (p.status as string) === 'fulfilled' || (p.status as string) === 'paid' || (p.status as string) === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Official Sign-Off Block (for Printed Records) */}
        <div className="pt-8 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
          <div>
            <div className="h-10 border-b border-slate-300 mb-2" />
            <p className="font-bold text-slate-800">SENIOR PASTOR / OVERSEER</p>
            <p className="text-[11px] text-slate-400">Signature & Endorsement Seal</p>
          </div>
          <div>
            <div className="h-10 border-b border-slate-300 mb-2" />
            <p className="font-bold text-slate-800">HEAD OF FINANCE / AUDITOR</p>
            <p className="text-[11px] text-slate-400">Signature & Verification Date</p>
          </div>
          <div className="border border-dashed border-amber-300 bg-amber-50/40 rounded-xl p-3 text-center flex flex-col items-center justify-center">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-widest">
              OFFICIAL CHURCH ARCHIVE
            </span>
            <span className="text-[9px] text-slate-500 mt-0.5">
              Greater Works City Church • Joma, Accra
            </span>
            <span className="text-[8px] font-mono text-emerald-800 mt-1">
              STATUS: CERTIFIED FOR PRINT & AUDIT
            </span>
          </div>
        </div>
      </div>

      {/* PDF Export Modal */}
      <ReportPdfExportModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        defaultTemplate={modalDefaultTemplate}
        initialStartDate={startDate}
        initialEndDate={endDate}
      />
    </div>
  );
};
