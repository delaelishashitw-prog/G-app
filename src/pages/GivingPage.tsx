import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Coins,
  Landmark,
  TrendingUp,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  CreditCard,
  Phone,
  FileSpreadsheet,
  Printer,
  Receipt,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Users,
  ChevronRight,
  ArrowUpRight,
  RefreshCw,
  FileText,
  Sparkles,
  ShieldCheck,
  Hash,
  User,
  Tag,
  DollarSign,
  HeartHandshake,
  Layers,
  Building,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { GivingCategory, PaymentMethod, GivingRecord, Member } from '../types/database.types';
import { formatGHS, cleanGhanaPhone } from '../lib/currencyUtils';
import {
  buildRecentMonthSeries,
  getCurrentMonthKey,
  getPreviousMonthKey,
  isDateInCurrentWeek,
  isDateInLastWeek,
  isDateInPastDays,
  isDateInRange,
  isDateInMonth,
  normalizeDateStr,
  todayISO,
} from '../lib/financeDateUtils';

// Modals
import { OfficialReceiptModal } from '../components/finance/OfficialReceiptModal';
import { BatchGivingModal } from '../components/finance/BatchGivingModal';
import { EditGivingModal } from '../components/finance/EditGivingModal';
import { MemberGivingStatementModal } from '../components/finance/MemberGivingStatementModal';
import { MemberTitheHistoryModal } from '../components/finance/MemberTitheHistoryModal';

export type GivingDateFilterType =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'last_7_days'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'custom';

const GIVING_CATEGORIES: GivingCategory[] = [
  'Tithe',
  'Offering',
  'Thanksgiving',
  'First Fruit',
  'Building Fund',
  'Missions',
  'Special Offering',
  'Seed',
  'Donation',
  'Other',
];

const CATEGORY_COLORS: Record<string, string> = {
  Tithe: '#059669', // Emerald
  Offering: '#2563eb', // Blue
  Thanksgiving: '#d97706', // Amber
  'First Fruit': '#7c3aed', // Purple
  'Building Fund': '#0284c7', // Sky
  Missions: '#dc2626', // Red
  'Special Offering': '#ea580c', // Orange
  Seed: '#16a34a', // Green
  Donation: '#4f46e5', // Indigo
  Other: '#64748b', // Slate
};

export const GivingPage: React.FC = () => {
  const navigate = useNavigate();
  const { giving, members, services, settings, recordGiving, updateGiving, deleteGiving } = useChurchData();
  const { canAccess, currentUser } = useAuth();
  const { success, error, info } = useToast();

  const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'tithers' | 'services'>('overview');

  // Filters
  const [dateFilter, setDateFilter] = useState<GivingDateFilterType>('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [selectedService, setSelectedService] = useState<string>('all');

  // Modals state
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<GivingRecord | null>(null);
  const [receiptRecord, setReceiptRecord] = useState<GivingRecord | null>(null);
  const [statementMember, setStatementMember] = useState<Member | null>(null);
  const [titherHistoryMember, setTitherHistoryMember] = useState<Member | null>(null);

  // Single Giving Form State
  const [formMemberSearch, setFormMemberSearch] = useState('');
  const [formSelectedMemberId, setFormSelectedMemberId] = useState<string>('');
  const [formDonorName, setFormDonorName] = useState('');
  const [formTitheNumber, setFormTitheNumber] = useState('');
  const [formCategory, setFormCategory] = useState<GivingCategory>('Tithe');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(todayISO());
  const [formPaymentMethod, setFormPaymentMethod] = useState<PaymentMethod>('mobile_money');
  const [formPaymentChannel, setFormPaymentChannel] = useState('MTN MoMo');
  const [formReferenceNumber, setFormReferenceNumber] = useState('');
  const [formServiceId, setFormServiceId] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Date Filtering Predicate
  const isDateMatchingFilter = (dateStr: string) => {
    if (dateFilter === 'all') return true;
    if (dateFilter === 'today') return normalizeDateStr(dateStr) === todayISO();
    if (dateFilter === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return normalizeDateStr(dateStr) === d.toISOString().split('T')[0];
    }
    if (dateFilter === 'this_week') return isDateInCurrentWeek(dateStr);
    if (dateFilter === 'last_week') return isDateInLastWeek(dateStr);
    if (dateFilter === 'last_7_days') return isDateInPastDays(dateStr, 7);
    if (dateFilter === 'this_month') return isDateInMonth(dateStr, getCurrentMonthKey());
    if (dateFilter === 'last_month') return isDateInMonth(dateStr, getPreviousMonthKey());
    if (dateFilter === 'this_year') {
      const year = new Date().getFullYear().toString();
      return normalizeDateStr(dateStr).startsWith(year);
    }
    if (dateFilter === 'custom') {
      return isDateInRange(dateStr, customStartDate, customEndDate);
    }
    return true;
  };

  // Filtered Giving Records
  const filteredGiving = useMemo(() => {
    return giving
      .filter((item) => {
        if (!isDateMatchingFilter(item.date)) return false;
        if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
        if (selectedPaymentMethod !== 'all' && item.payment_method !== selectedPaymentMethod) return false;
        if (selectedService !== 'all' && item.service_name !== selectedService) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const memberName = (item.member_name || '').toLowerCase();
          const donorName = (item.donor_name || '').toLowerCase();
          const titheNum = (item.tithe_number || '').toLowerCase();
          const refNum = (item.reference_number || '').toLowerCase();
          const notes = (item.notes || '').toLowerCase();
          return (
            memberName.includes(q) ||
            donorName.includes(q) ||
            titheNum.includes(q) ||
            refNum.includes(q) ||
            notes.includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [giving, dateFilter, customStartDate, customEndDate, selectedCategory, selectedPaymentMethod, selectedService, searchQuery]);

  // Aggregate Metrics for Active Period
  const totalGivingAmount = useMemo(() => {
    return filteredGiving.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [filteredGiving]);

  const titheAmount = useMemo(() => {
    return filteredGiving
      .filter((item) => item.category === 'Tithe')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [filteredGiving]);

  const offeringAmount = useMemo(() => {
    return filteredGiving
      .filter((item) => item.category === 'Offering' || item.category === 'Special Offering')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [filteredGiving]);

  const thanksgivingAndSeeds = useMemo(() => {
    return filteredGiving
      .filter((item) => item.category === 'Thanksgiving' || item.category === 'Seed' || item.category === 'First Fruit')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [filteredGiving]);

  // Active Tithers Count in Period
  const activeTithersCount = useMemo(() => {
    const tithers = new Set<string>();
    filteredGiving.forEach((item) => {
      if (item.category === 'Tithe') {
        const id = item.member_id || item.tithe_number || item.member_name || item.donor_name;
        if (id) tithers.add(id);
      }
    });
    return tithers.size;
  }, [filteredGiving]);

  // Average Giving per Giver
  const averageGivingPerGiver = useMemo(() => {
    const givers = new Set<string>();
    filteredGiving.forEach((item) => {
      const id = item.member_id || item.donor_name || item.member_name;
      if (id) givers.add(id);
    });
    return givers.size > 0 ? totalGivingAmount / givers.size : 0;
  }, [filteredGiving, totalGivingAmount]);

  // Monthly Series for Chart
  const monthlyChartData = useMemo(() => {
    const months = buildRecentMonthSeries(new Date(), 6);
    return months.map((m) => {
      const monthRecords = giving.filter((g) => isDateInMonth(g.date, m.key));
      const tithes = monthRecords.filter((g) => g.category === 'Tithe').reduce((s, g) => s + (Number(g.amount) || 0), 0);
      const offerings = monthRecords.filter((g) => g.category !== 'Tithe').reduce((s, g) => s + (Number(g.amount) || 0), 0);
      return {
        month: m.shortMonth,
        Tithe: tithes,
        Offering: offerings,
        Total: tithes + offerings,
      };
    });
  }, [giving]);

  // Category Breakdown for Pie Chart
  const categoryPieData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredGiving.forEach((item) => {
      map[item.category] = (map[item.category] || 0) + (Number(item.amount) || 0);
    });
    return Object.entries(map).map(([name, value]) => ({
      name,
      value,
      color: CATEGORY_COLORS[name] || '#64748b',
    })).sort((a, b) => b.value - a.value);
  }, [filteredGiving]);

  // Tithers Directory Data
  const tithersDirectory = useMemo(() => {
    const titherMap = new Map<string, { member: Member; totalTithe: number; count: number; lastDate: string }>();

    // Initial populate all members with tithe numbers
    members.forEach((m) => {
      if (m.tithe_number) {
        titherMap.set(m.id, { member: m, totalTithe: 0, count: 0, lastDate: '' });
      }
    });

    // Accumulate actual tithe records
    giving.forEach((g) => {
      if (g.category === 'Tithe') {
        let m = g.member_id ? members.find((x) => x.id === g.member_id) : undefined;
        if (!m && g.tithe_number) {
          m = members.find((x) => x.tithe_number?.trim().toLowerCase() === g.tithe_number?.trim().toLowerCase());
        }
        if (m) {
          const current = titherMap.get(m.id) || { member: m, totalTithe: 0, count: 0, lastDate: '' };
          current.totalTithe += Number(g.amount) || 0;
          current.count += 1;
          if (!current.lastDate || new Date(g.date).getTime() > new Date(current.lastDate).getTime()) {
            current.lastDate = g.date;
          }
          titherMap.set(m.id, current);
        }
      }
    });

    return Array.from(titherMap.values()).sort((a, b) => b.totalTithe - a.totalTithe);
  }, [members, giving]);

  // Service Breakdown
  const serviceBreakdown = useMemo(() => {
    const serviceMap = new Map<string, { serviceName: string; total: number; tithes: number; offerings: number; count: number }>();
    filteredGiving.forEach((g) => {
      const sName = g.service_name || 'General / Midweek Service';
      const cur = serviceMap.get(sName) || { serviceName: sName, total: 0, tithes: 0, offerings: 0, count: 0 };
      const amt = Number(g.amount) || 0;
      cur.total += amt;
      cur.count += 1;
      if (g.category === 'Tithe') {
        cur.tithes += amt;
      } else {
        cur.offerings += amt;
      }
      serviceMap.set(sName, cur);
    });
    return Array.from(serviceMap.values()).sort((a, b) => b.total - a.total);
  }, [filteredGiving]);

  // Handle Save Single Giving
  const handleSaveSingleGiving = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(formAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      error('Invalid Amount', 'Please provide a valid giving amount in Ghana Cedis.');
      return;
    }

    let member = formSelectedMemberId ? members.find((m) => m.id === formSelectedMemberId) : undefined;
    if (!member && formTitheNumber.trim()) {
      member = members.find((m) => m.tithe_number?.trim().toLowerCase() === formTitheNumber.trim().toLowerCase());
    }

    const selectedSrv = services.find((s) => s.id === formServiceId);

    const record = recordGiving({
      member_id: member?.id,
      member_name: member ? `${member.first_name} ${member.last_name}` : undefined,
      tithe_number: formTitheNumber.trim() || member?.tithe_number,
      donor_name: !member ? (formDonorName.trim() || 'Anonymous Giver') : undefined,
      category: formCategory,
      amount: amountNum,
      currency: 'GHS',
      date: formDate || todayISO(),
      payment_method: formPaymentMethod,
      payment_channel: formPaymentChannel || undefined,
      reference_number: formReferenceNumber.trim() || undefined,
      service_id: selectedSrv?.id,
      service_name: selectedSrv?.name || 'Sunday Service',
      notes: formNotes.trim() || undefined,
      recorded_by: currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Finance Secretariat',
    });

    success('Giving Recorded', `Recorded ${formCategory} of ${formatGHS(amountNum)} successfully.`);
    setShowRecordModal(false);
    resetForm();
    // Prompt for official receipt
    setReceiptRecord(record);
  };

  const resetForm = () => {
    setFormMemberSearch('');
    setFormSelectedMemberId('');
    setFormDonorName('');
    setFormTitheNumber('');
    setFormCategory('Tithe');
    setFormAmount('');
    setFormDate(todayISO());
    setFormPaymentMethod('mobile_money');
    setFormPaymentChannel('MTN MoMo');
    setFormReferenceNumber('');
    setFormServiceId('');
    setFormNotes('');
  };

  // CSV Export
  const handleExportCSV = () => {
    if (filteredGiving.length === 0) {
      info('No Records', 'No giving records match the active filters to export.');
      return;
    }

    const headers = [
      'Record ID',
      'Date',
      'Member Name / Donor',
      'Tithe Number',
      'Category',
      'Amount (GHS)',
      'Payment Method',
      'Payment Channel',
      'Reference Number',
      'Service',
      'Notes',
    ];

    const rows = filteredGiving.map((item) => [
      `"${item.id}"`,
      `"${item.date}"`,
      `"${item.member_name || item.donor_name || 'Anonymous'}"`,
      `"${item.tithe_number || ''}"`,
      `"${item.category}"`,
      item.amount.toFixed(2),
      `"${item.payment_method}"`,
      `"${item.payment_channel || ''}"`,
      `"${item.reference_number || ''}"`,
      `"${item.service_name || ''}"`,
      `"${(item.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GWCC_Member_Giving_${dateFilter}_${todayISO()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success('Export Successful', `Exported ${filteredGiving.length} giving records.`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Coins className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Member Giving & Stewardship
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Congregational tithes, general offerings, first fruits, seeds, and official member statements.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canAccess('finance') && (
            <>
              <button
                onClick={() => {
                  resetForm();
                  setShowRecordModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Record Member Giving</span>
              </button>

              <button
                onClick={() => setShowBatchModal(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 dark:text-emerald-300 font-semibold text-xs sm:text-sm border border-emerald-200 dark:border-emerald-800/60 transition-all cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                <span>Batch Sunday Entry</span>
              </button>
            </>
          )}

          <button
            onClick={() => navigate('/church-finance')}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-semibold border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
            title="Go to Church Finance & Accounts"
          >
            <Landmark className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>Church Finance</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-medium border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Date Filter & Presets Ribbon */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 sm:px-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
            Period:
          </span>
          {(
            [
              ['this_month', 'This Month'],
              ['this_week', 'This Week'],
              ['today', 'Today'],
              ['last_month', 'Last Month'],
              ['this_year', 'This Year'],
              ['all', 'All Time'],
              ['custom', 'Custom Range'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setDateFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                dateFilter === key
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            />
          </div>
        )}
      </div>

      {/* Primary KPI Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Giving */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Member Giving</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            GH₵ <AnimatedNumber value={totalGivingAmount} />
          </div>
          <div className="mt-2 flex items-center text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 mr-1.5">
              {filteredGiving.length} records
            </span>
            <span>in selected period</span>
          </div>
        </div>

        {/* Card 2: Tithe Stewardship */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Tithe Stewardship</span>
            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            GH₵ <AnimatedNumber value={titheAmount} />
          </div>
          <div className="mt-2 flex items-center text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-teal-600 dark:text-teal-400 mr-1.5">
              {activeTithersCount} faithful tithers
            </span>
            <span>contributed</span>
          </div>
        </div>

        {/* Card 3: Sunday & Midweek Offerings */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">General Offerings</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            GH₵ <AnimatedNumber value={offeringAmount} />
          </div>
          <div className="mt-2 flex items-center text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-blue-600 dark:text-blue-400 mr-1.5">
              {totalGivingAmount > 0 ? ((offeringAmount / totalGivingAmount) * 100).toFixed(0) : 0}%
            </span>
            <span>of total giving</span>
          </div>
        </div>

        {/* Card 4: First Fruits, Seeds & Thanksgiving */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Thanksgiving & Seeds</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            GH₵ <AnimatedNumber value={thanksgivingAndSeeds} />
          </div>
          <div className="mt-2 flex items-center text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-amber-600 dark:text-amber-400 mr-1.5">
              GH₵ {averageGivingPerGiver.toFixed(0)} avg
            </span>
            <span>per active giver</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-px overflow-x-auto scrollbar-none">
        {[
          { id: 'overview', label: 'Giving Analytics', icon: BarChart3 },
          { id: 'ledger', label: 'Giving Ledger', icon: Receipt },
          { id: 'tithers', label: 'Tithers Directory', icon: ShieldCheck },
          { id: 'services', label: 'Sunday Service Breakdown', icon: Building },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.id === 'ledger' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                  {filteredGiving.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & ANALYTICS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Area Chart: 6-Month Rolling Trend */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    6-Month Giving Growth & Trend
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Monthly breakdown comparing Tithe contributions vs General Offerings
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Tithe
                  </span>
                  <span className="flex items-center gap-1.5 text-blue-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Offerings
                  </span>
                </div>
              </div>

              <div className="h-64 sm:h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="titheGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="offeringGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(val) => `GH₵${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                    />
                    <Tooltip
                      formatter={(value: any) => [`GH₵ ${Number(value).toFixed(2)}`, '']}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="Tithe" stroke="#059669" strokeWidth={2.5} fillOpacity={1} fill="url(#titheGradient)" />
                    <Area type="monotone" dataKey="Offering" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#offeringGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Category Pie Chart */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                Category Distribution
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Breakdown of active period stewardship
              </p>

              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {categoryPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => [`GH₵ ${Number(value).toFixed(2)}`, '']}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-1.5 mt-2 max-h-36 overflow-y-auto pr-1">
                {categoryPieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span>{item.name}</span>
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      GH₵ {item.value.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stewardship Highlights & Payment Channels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Payment Channels Breakdown */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                Stewardship Channels & Gateways
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Mobile Money vs Bank vs Cash collection distribution
              </p>

              <div className="space-y-3">
                {[
                  {
                    name: 'Mobile Money (MTN MoMo & Telecel)',
                    filter: (g: GivingRecord) => g.payment_method === 'mobile_money',
                    color: 'bg-amber-500',
                  },
                  {
                    name: 'Bank Direct Deposit & Wire Transfer',
                    filter: (g: GivingRecord) => g.payment_method === 'bank_transfer',
                    color: 'bg-blue-600',
                  },
                  {
                    name: 'Auditorium Physical Cash Envelopes',
                    filter: (g: GivingRecord) => g.payment_method === 'cash',
                    color: 'bg-emerald-600',
                  },
                  {
                    name: 'POS Card & Online Giving',
                    filter: (g: GivingRecord) => g.payment_method === 'card',
                    color: 'bg-indigo-600',
                  },
                ].map((channel) => {
                  const subtotal = filteredGiving.filter(channel.filter).reduce((s, g) => s + (Number(g.amount) || 0), 0);
                  const pct = totalGivingAmount > 0 ? (subtotal / totalGivingAmount) * 100 : 0;
                  return (
                    <div key={channel.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-300">{channel.name}</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          GH₵ {subtotal.toFixed(2)} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div className={`h-2 rounded-full ${channel.color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions & Statement Generator Helper */}
            <div className="bg-gradient-to-br from-emerald-900 to-teal-950 text-white p-5 rounded-2xl border border-emerald-800 shadow-xs relative overflow-hidden flex flex-col justify-between">
              <div>
                <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-[10px] uppercase tracking-wider mb-2">
                  GWCC Member Stewardship
                </span>
                <h3 className="text-lg font-bold mb-1">
                  Official Member Giving Statements
                </h3>
                <p className="text-xs text-emerald-200/80 leading-relaxed">
                  Generate annual or monthly signed giving certificates for members, complete with church seal, Prophet Elisha K. Richard’s signature, and itemized tithes.
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveTab('tithers')}
                  className="px-3.5 py-2 rounded-xl bg-white text-emerald-950 font-bold text-xs hover:bg-emerald-50 transition-all cursor-pointer"
                >
                  View Tithers Directory →
                </button>
                <button
                  onClick={() => setActiveTab('ledger')}
                  className="px-3.5 py-2 rounded-xl bg-emerald-800/80 hover:bg-emerald-800 text-white font-medium text-xs border border-emerald-700 transition-all cursor-pointer"
                >
                  View Complete Ledger
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GIVING LEDGER */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col lg:flex-row gap-3 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search member name, donor, tithe #, reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Categories</option>
              {GIVING_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Payment Method Filter */}
            <select
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Payment Methods</option>
              <option value="mobile_money">Mobile Money (MoMo)</option>
              <option value="cash">Auditorium Cash</option>
              <option value="bank_transfer">Bank Wire / Transfer</option>
              <option value="card">Card / POS</option>
              <option value="cheque">Bank Cheque</option>
            </select>

            {/* Service Filter */}
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Church Services</option>
              {services.map((srv) => (
                <option key={srv.id} value={srv.name}>
                  {srv.name}
                </option>
              ))}
            </select>
          </div>

          {/* Ledger Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Member / Donor</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Amount (GH₵)</th>
                    <th className="py-3 px-4">Method & Channel</th>
                    <th className="py-3 px-4">Service</th>
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredGiving.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <Coins className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="font-semibold">No giving records found</p>
                        <p className="text-xs">Adjust your date filter or search query.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredGiving.map((record) => {
                      const categoryColor = CATEGORY_COLORS[record.category] || '#64748b';
                      const displayName = record.member_name || record.donor_name || 'Anonymous Giver';
                      return (
                        <tr
                          key={record.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 font-medium text-xs">
                            {record.date}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{displayName}</span>
                              {record.tithe_number && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                  #{record.tithe_number}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold text-white"
                              style={{ backgroundColor: categoryColor }}
                            >
                              {record.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                            GH₵ {record.amount.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="text-xs text-slate-700 dark:text-slate-300 capitalize">
                              {record.payment_method.replace('_', ' ')}
                            </div>
                            {record.payment_channel && (
                              <div className="text-[10px] text-slate-400">{record.payment_channel}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {record.service_name || 'Sunday Service'}
                          </td>
                          <td className="py-3 px-4 text-xs font-mono text-slate-400 whitespace-nowrap">
                            {record.reference_number || '—'}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setReceiptRecord(record)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all cursor-pointer"
                                title="Print Official Receipt"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              {canAccess('finance') && (
                                <>
                                  <button
                                    onClick={() => setEditingRecord(record)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all cursor-pointer"
                                    title="Edit Entry"
                                  >
                                    <FileText className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`Delete giving entry for ${displayName} (GH₵ ${record.amount.toFixed(2)})?`)) {
                                        deleteGiving(record.id);
                                        success('Deleted', 'Giving entry removed.');
                                      }
                                    }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                                    title="Delete"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TITHERS DIRECTORY */}
      {activeTab === 'tithers' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                GWCC Registered Tithers Directory
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tracking covenant faithfulness, envelope identifiers, and cumulative annual contributions
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                {tithersDirectory.length} Registered Tithers
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tithersDirectory.map(({ member, totalTithe, count, lastDate }) => {
              const isRegular = count >= 4;
              return (
                <div
                  key={member.id}
                  className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                          {member.first_name} {member.last_name}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{member.phone || 'No phone'}</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                        #{member.tithe_number || 'T-AUTO'}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Total Tithes</span>
                        <div className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                          GH₵ {totalTithe.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Frequency</span>
                        <div className="font-semibold text-slate-700 dark:text-slate-300">
                          {count} installments
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
                      <span>Last tithe:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {lastDate || 'Not yet recorded'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <button
                      onClick={() => setTitherHistoryMember(member)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold text-center transition-all cursor-pointer"
                    >
                      History
                    </button>
                    <button
                      onClick={() => setStatementMember(member)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold text-center transition-all cursor-pointer"
                    >
                      Annual Statement
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: SUNDAY SERVICE BREAKDOWN */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Service Program Collections
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Aggregated collections per church service gathering in active period
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {serviceBreakdown.map((srv) => (
              <div
                key={srv.serviceName}
                className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                    <Building className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {srv.count} givers
                  </span>
                </div>

                <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-2">
                  {srv.serviceName}
                </h4>

                <div className="text-2xl font-extrabold text-slate-900 dark:text-white mb-4">
                  GH₵ {srv.total.toFixed(2)}
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Tithe Collections:</span>
                    <span className="font-bold text-emerald-600">GH₵ {srv.tithes.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">General Offerings:</span>
                    <span className="font-bold text-blue-600">GH₵ {srv.offerings.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RECORD SINGLE GIVING MODAL */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <Plus className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Record Member Giving</h3>
                  <p className="text-xs text-slate-500">Post tithe, offering or special thanksgiving</p>
                </div>
              </div>
              <button
                onClick={() => setShowRecordModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSingleGiving} className="space-y-4">
              {/* Member Selection / Autocomplete */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Registered Member (or leave blank for external donor)
                </label>
                <select
                  value={formSelectedMemberId}
                  onChange={(e) => {
                    const memId = e.target.value;
                    setFormSelectedMemberId(memId);
                    const mem = members.find((m) => m.id === memId);
                    if (mem?.tithe_number) setFormTitheNumber(mem.tithe_number);
                  }}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="">-- External or Anonymous Donor --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name} {m.tithe_number ? `(Tithe #${m.tithe_number})` : ''} - {m.phone || ''}
                    </option>
                  ))}
                </select>
              </div>

              {!formSelectedMemberId && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Donor Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Visitor Kwesi Badu"
                      value={formDonorName}
                      onChange={(e) => setFormDonorName(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Tithe Envelope # (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. T-1002"
                      value={formTitheNumber}
                      onChange={(e) => setFormTitheNumber(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Category & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Giving Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as GivingCategory)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                  >
                    {GIVING_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Amount (GH₵) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none font-bold"
                  />
                </div>
              </div>

              {/* Date & Service */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Contribution Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Church Service
                  </label>
                  <select
                    value={formServiceId}
                    onChange={(e) => setFormServiceId(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="">-- General Service --</option>
                    {services.map((srv) => (
                      <option key={srv.id} value={srv.id}>
                        {srv.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Payment Method & Channel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => {
                      const m = e.target.value as PaymentMethod;
                      setFormPaymentMethod(m);
                      if (m === 'mobile_money') setFormPaymentChannel('MTN MoMo');
                      else if (m === 'bank_transfer') setFormPaymentChannel('GCB Bank');
                      else setFormPaymentChannel('');
                    }}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="mobile_money">Mobile Money (MoMo)</option>
                    <option value="cash">Auditorium Cash</option>
                    <option value="bank_transfer">Bank Wire / Transfer</option>
                    <option value="card">Card / POS</option>
                    <option value="cheque">Bank Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Channel / Provider
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MTN MoMo, Telecel Cash, GCB Bank"
                    value={formPaymentChannel}
                    onChange={(e) => setFormPaymentChannel(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Reference & Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  MoMo Transaction ID / Reference (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 7819203912 or Envelope #"
                  value={formReferenceNumber}
                  onChange={(e) => setFormReferenceNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Pastoral Notes / Prayer Point
                </label>
                <textarea
                  rows={2}
                  placeholder="Prophetic seed prayer focus or thanksgiving note..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer"
                >
                  Save Giving Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BATCH SUNDAY GIVING MODAL */}
      {showBatchModal && (
        <BatchGivingModal
          members={members}
          onSaveBatch={(batchRecords) => {
            batchRecords.forEach((record) => {
              recordGiving({
                ...record,
                currency: 'GHS',
                recorded_by: currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Sunday Finance Secretariat',
              });
            });
            success('Batch Saved', `Successfully posted ${batchRecords.length} Sunday giving records.`);
            setShowBatchModal(false);
          }}
          onClose={() => setShowBatchModal(false)}
        />
      )}

      {/* OFFICIAL RECEIPT MODAL */}
      {receiptRecord && (
        <OfficialReceiptModal
          record={receiptRecord}
          settings={settings}
          onClose={() => setReceiptRecord(null)}
        />
      )}

      {/* MEMBER GIVING STATEMENT MODAL */}
      {statementMember && (
        <MemberGivingStatementModal
          member={statementMember}
          givingRecords={giving}
          settings={settings}
          onClose={() => setStatementMember(null)}
        />
      )}

      {/* MEMBER TITHE HISTORY MODAL */}
      {titherHistoryMember && (
        <MemberTitheHistoryModal
          member={titherHistoryMember}
          givingRecords={giving}
          onOpenStatement={(m) => {
            setTitherHistoryMember(null);
            setStatementMember(m);
          }}
          onClose={() => setTitherHistoryMember(null)}
        />
      )}

      {/* EDIT GIVING MODAL */}
      {editingRecord && (
        <EditGivingModal
          record={editingRecord}
          members={members}
          onSave={(id, updated) => {
            updateGiving(id, updated);
            success('Updated', 'Giving record updated.');
            setEditingRecord(null);
          }}
          onClose={() => setEditingRecord(null)}
        />
      )}
    </div>
  );
};
