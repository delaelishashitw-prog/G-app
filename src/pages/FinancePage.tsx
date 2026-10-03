import React, { useState, useMemo } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Coins,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  CreditCard,
  Phone,
  FileSpreadsheet,
  Building,
  Printer,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Calculator,
  PieChart as PieChartIcon,
  BarChart3,
  Users,
  MessageCircle,
  Check,
  X,
  ChevronRight,
  ArrowUpRight,
  RefreshCw,
  FileText,
  Sparkles,
  ShieldCheck,
  Percent,
  Trash2,
  Edit3,
  Layers,
  DollarSign,
  UserCheck,
  Hash,
  User,
  Tag,
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
import { useToast } from '../contexts/ToastContext';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { GivingCategory, PaymentMethod, GivingRecord, ExpenseRecord, Member } from '../types/database.types';
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

export type FinanceDateFilterType =
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

// Modals
import { OfficialReceiptModal } from '../components/finance/OfficialReceiptModal';
import { PaymentVoucherModal } from '../components/finance/PaymentVoucherModal';
import { BatchGivingModal } from '../components/finance/BatchGivingModal';
import { EditGivingModal } from '../components/finance/EditGivingModal';
import { EditExpenseModal } from '../components/finance/EditExpenseModal';
import { MemberGivingStatementModal } from '../components/finance/MemberGivingStatementModal';
import { DepartmentBudgetModal, DepartmentBudget } from '../components/finance/DepartmentBudgetModal';
import { MemberTitheHistoryModal } from '../components/finance/MemberTitheHistoryModal';
import { SundayTallySheetModal } from '../components/finance/SundayTallySheetModal';

// Palette for charts
const CATEGORY_COLORS: Record<string, string> = {
  Tithe: '#047857', // Emerald
  Offering: '#d97706', // Amber
  Thanksgiving: '#0284c7', // Sky
  'Building Fund': '#7c3aed', // Purple
  Seed: '#e11d48', // Rose
  'First Fruit': '#0d9488', // Teal
  Missions: '#ea580c', // Orange
  Donation: '#4f46e5', // Indigo
  'Special Offering': '#ca8a04', // Yellow
  Other: '#64748b', // Slate
};

const PIE_COLORS = ['#047857', '#d97706', '#7c3aed', '#0284c7', '#e11d48', '#0d9488', '#ea580c', '#4f46e5'];

// Cash bill denominations for Sunday Cash Counter Sheet
interface DenominationRow {
  label: string;
  value: number;
  count: number;
}

const createDefaultDenominations = (): DenominationRow[] => [
  { label: 'GH₵ 200 Note', value: 200, count: 0 },
  { label: 'GH₵ 100 Note', value: 100, count: 0 },
  { label: 'GH₵ 50 Note', value: 50, count: 0 },
  { label: 'GH₵ 20 Note', value: 20, count: 0 },
  { label: 'GH₵ 10 Note', value: 10, count: 0 },
  { label: 'GH₵ 5 Note', value: 5, count: 0 },
  { label: 'GH₵ 2 Note', value: 2, count: 0 },
  { label: 'GH₵ 1 Coin / Note', value: 1, count: 0 },
  { label: '50 Pesewas (GH₵ 0.50)', value: 0.5, count: 0 },
];

export const FinancePage: React.FC = () => {
  const {
    giving,
    expenses,
    members,
    settings,
    recordGiving,
    updateGiving,
    deleteGiving,
    recordExpense,
    updateExpense,
    deleteExpense,
  } = useChurchData();
  const { success, info, error } = useToast();

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'giving' | 'expenses' | 'tithers' | 'counter' | 'budgets'>('overview');

  // Filter & Search states for Giving Ledger
  const [givingSearch, setGivingSearch] = useState('');
  const [givingCategoryFilter, setGivingCategoryFilter] = useState('all');
  const [givingMethodFilter, setGivingMethodFilter] = useState('all');
  const [givingDateFilter, setGivingDateFilter] = useState<FinanceDateFilterType>('all');
  const [givingStartDate, setGivingStartDate] = useState('');
  const [givingEndDate, setGivingEndDate] = useState('');
  const [givingServiceFilter, setGivingServiceFilter] = useState('all');

  // Filter states for Expenses Ledger
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('all');
  const [expenseDateFilter, setExpenseDateFilter] = useState<FinanceDateFilterType>('all');
  const [expenseStartDate, setExpenseStartDate] = useState('');
  const [expenseEndDate, setExpenseEndDate] = useState('');

  // Filter for Tithers Tab
  const [titherSearch, setTitherSearch] = useState('');
  const [titherStatusFilter, setTitherStatusFilter] = useState<'all' | 'consistent' | 'periodic' | 'needs_care'>('all');

  // Modals state
  const [isGivingModalOpen, setIsGivingModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);

  // Active modal targets
  const [activeReceiptRecord, setActiveReceiptRecord] = useState<GivingRecord | null>(null);
  const [activeVoucherRecord, setActiveVoucherRecord] = useState<ExpenseRecord | null>(null);
  const [editingGivingRecord, setEditingGivingRecord] = useState<GivingRecord | null>(null);
  const [editingExpenseRecord, setEditingExpenseRecord] = useState<ExpenseRecord | null>(null);
  const [editingBudget, setEditingBudget] = useState<DepartmentBudget | null>(null);
  const [statementMember, setStatementMember] = useState<Member | null>(null);
  const [memberTitheHistory, setMemberTitheHistory] = useState<Member | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'giving' | 'expense'; id: string; title: string } | null>(null);

  // Sunday Offering Counter tool state
  const [denominations, setDenominations] = useState<DenominationRow[]>(createDefaultDenominations);
  const [counterServiceName, setCounterServiceName] = useState('Sunday 2nd Service (Celebration Service)');
  const [counterDate, setCounterDate] = useState(todayISO());
  const [counterEnvelopesCount, setCounterEnvelopesCount] = useState<number>(34);
  const [counterMoMoTotal, setCounterMoMoTotal] = useState<number>(3250);
  const [counterTelecelTotal, setCounterTelecelTotal] = useState<number>(650);
  const [counterSupervisor, setCounterSupervisor] = useState('Deacon Kofi Asante');
  const [counterNotes, setCounterNotes] = useState('Open basket collection & tither envelopes counted by Finance Committee');
  const [counterUsdAmount, setCounterUsdAmount] = useState<number>(0);
  const [counterUsdRate, setCounterUsdRate] = useState<number>(15.8);
  const [isCounterPrintSheetOpen, setIsCounterPrintSheetOpen] = useState(false);

  // Tithe / Giving Entry Mode: by member name or by tithe number
  const [givingEntryMode, setGivingEntryMode] = useState<'name' | 'tithe_number'>('name');

  // Quick single Giving Form state
  const [givingForm, setGivingForm] = useState({
    member_id: '',
    tithe_number: '',
    donor_name: '',
    category: 'Tithe' as GivingCategory,
    amount: '',
    date: todayISO(),
    payment_method: 'mobile_money' as PaymentMethod,
    payment_channel: 'MTN MoMo',
    reference_number: '',
    service_name: 'Sunday 2nd Service (Celebration)',
    notes: '',
  });

  // Quick Expense Form state
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    category: 'Utilities',
    amount: '',
    date: todayISO(),
    payment_method: 'mobile_money' as PaymentMethod,
    recipient: '',
    account: 'Mobile Money Account',
    approved_by: 'Prophet Elisha K. Richard',
    reference_number: '',
    notes: '',
  });

  // Default Departmental Budgets
  const DEFAULT_DEPARTMENT_BUDGETS: DepartmentBudget[] = useMemo(() => [
    {
      id: 'bdg-1',
      name: 'Sanctuary Utilities & Power (ECG / Water / Fuel)',
      allocated: 4500,
      spent: 2850,
      lead: 'Deacon Kwabena Mensah',
    },
    {
      id: 'bdg-2',
      name: 'Media, Sound & Digital Broadcasting',
      allocated: 3500,
      spent: 1920,
      lead: 'Bro. Emmanuel Boateng',
    },
    {
      id: 'bdg-3',
      name: 'Cathedral Expansion & Facilities Maintenance',
      allocated: 12000,
      spent: 8500,
      lead: 'Elder Joseph Koomson',
    },
    {
      id: 'bdg-4',
      name: 'Pastoral Honorarium & Guest Ministry Logistics',
      allocated: 4000,
      spent: 3200,
      lead: 'Church Council',
    },
    {
      id: 'bdg-5',
      name: 'Evangelism, Community Outreach & Benevolence',
      allocated: 3000,
      spent: 1450,
      lead: 'Pastor Mrs. Grace Appiah',
    },
    {
      id: 'bdg-6',
      name: 'Youth, Children Ministry & Sunday School Materials',
      allocated: 2000,
      spent: 850,
      lead: 'Sis. Priscilla Adjei',
    },
  ], []);

  // Departmental Budgets with localStorage persistence
  const [departmentBudgets, setDepartmentBudgets] = useState<DepartmentBudget[]>(() => {
    try {
      const saved = localStorage.getItem('gwcc_department_budgets');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'bdg-1',
        name: 'Sanctuary Utilities & Power (ECG / Water / Fuel)',
        allocated: 4500,
        spent: 2850,
        lead: 'Deacon Kwabena Mensah',
      },
      {
        id: 'bdg-2',
        name: 'Media, Sound & Digital Broadcasting',
        allocated: 3500,
        spent: 1920,
        lead: 'Bro. Emmanuel Boateng',
      },
      {
        id: 'bdg-3',
        name: 'Cathedral Expansion & Facilities Maintenance',
        allocated: 12000,
        spent: 8500,
        lead: 'Elder Joseph Koomson',
      },
      {
        id: 'bdg-4',
        name: 'Pastoral Honorarium & Guest Ministry Logistics',
        allocated: 4000,
        spent: 3200,
        lead: 'Church Council',
      },
      {
        id: 'bdg-5',
        name: 'Evangelism, Community Outreach & Benevolence',
        allocated: 3000,
        spent: 1450,
        lead: 'Pastor Mrs. Grace Appiah',
      },
      {
        id: 'bdg-6',
        name: 'Youth, Children Ministry & Sunday School Materials',
        allocated: 2000,
        spent: 850,
        lead: 'Sis. Priscilla Adjei',
      },
    ];
  });

  const saveBudgetsToStorage = (updated: DepartmentBudget[]) => {
    setDepartmentBudgets(updated);
    try {
      localStorage.setItem('gwcc_department_budgets', JSON.stringify(updated));
    } catch {}
  };

  // Overall Financial Calculations
  const totalIncome = useMemo(() => giving.reduce((sum, g) => sum + g.amount, 0), [giving]);
  const totalExpenses = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);
  const netBalance = totalIncome - totalExpenses;

  const totalTithes = useMemo(
    () => giving.filter((g) => g.category === 'Tithe').reduce((sum, g) => sum + g.amount, 0),
    [giving]
  );
  const totalOfferings = useMemo(
    () => giving.filter((g) => g.category === 'Offering').reduce((sum, g) => sum + g.amount, 0),
    [giving]
  );
  const totalBuildingFund = useMemo(
    () => giving.filter((g) => g.category === 'Building Fund').reduce((sum, g) => sum + g.amount, 0),
    [giving]
  );

  const momoTransactions = useMemo(
    () => giving.filter((g) => g.payment_method === 'mobile_money'),
    [giving]
  );
  const momoTotal = useMemo(() => momoTransactions.reduce((sum, g) => sum + g.amount, 0), [momoTransactions]);
  const momoPercentage = totalIncome > 0 ? Math.round((momoTotal / totalIncome) * 100) : 0;

  // Monthly Cashflow Trend
  const monthlyCashflowData = useMemo(() => {
    const months = buildRecentMonthSeries(new Date(), 6);

    return months.map(({ key, month, shortMonth }) => {
      const income = giving
        .filter((record) => isDateInMonth(record.date, key))
        .reduce((sum, record) => sum + record.amount, 0);
      const monthlyExpenses = expenses
        .filter((record) => isDateInMonth(record.date, key))
        .reduce((sum, record) => sum + record.amount, 0);

      return { month, shortMonth, income, expenses: monthlyExpenses, net: income - monthlyExpenses };
    });
  }, [giving, expenses]);

  const averageMonthlySurplus = useMemo(
    () => monthlyCashflowData.reduce((sum, month) => sum + month.net, 0) / (monthlyCashflowData.length || 1),
    [monthlyCashflowData]
  );

  // Giving by Category breakdown for pie chart
  const categoryChartData = useMemo(() => {
    const map: Record<string, number> = {};
    giving.forEach((g) => {
      map[g.category] = (map[g.category] || 0) + g.amount;
    });

    return Object.entries(map).map(([name, value]) => ({
      name,
      value,
    }));
  }, [giving]);

  // Payment method breakdown
  const paymentMethodData = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    giving.forEach((g) => {
      const key = g.payment_method;
      if (!map[key]) map[key] = { count: 0, total: 0 };
      map[key].count += 1;
      map[key].total += g.amount;
    });

    return Object.entries(map).map(([method, data]) => ({
      method: method.replace('_', ' ').toUpperCase(),
      count: data.count,
      total: data.total,
    }));
  }, [giving]);

  // Dynamic budget spent mapper: recalculates spend from matching recorded expenses!
  const computedBudgets = useMemo(() => {
    return departmentBudgets.map((dept) => {
      const dName = dept.name.toLowerCase();
      // Match with actual expenses recorded
      const matchingExpenses = expenses.filter((e) => {
        const cat = (e.category || '').toLowerCase();
        const desc = (e.title || e.description || '').toLowerCase();

        if (dName.includes('utilities') && (cat.includes('util') || desc.includes('ecg') || desc.includes('power') || desc.includes('water'))) {
          return true;
        }
        if (dName.includes('media') && (cat.includes('media') || desc.includes('sound') || desc.includes('stream') || desc.includes('bundle'))) {
          return true;
        }
        if ((dName.includes('expansion') || dName.includes('building')) && (cat.includes('building') || desc.includes('repair') || desc.includes('roof') || desc.includes('paint'))) {
          return true;
        }
        if (dName.includes('honorarium') && (cat.includes('salaries') || cat.includes('guest') || desc.includes('stipend') || desc.includes('honorarium'))) {
          return true;
        }
        if (dName.includes('evangelism') && (cat.includes('evangelism') || cat.includes('outreach') || desc.includes('tract') || desc.includes('crusade'))) {
          return true;
        }
        if (dName.includes('youth') && (cat.includes('youth') || desc.includes('children') || desc.includes('camp') || desc.includes('sunday school'))) {
          return true;
        }
        // General matching for any custom added department
        const nameTokens = dName.split(/[\s,&/]+/).filter((w) => w.length > 3);
        if (nameTokens.some((t) => cat.includes(t) || desc.includes(t))) {
          return true;
        }
        return false;
      });

      const actualSpentFromExpenses = matchingExpenses.reduce((s, e) => s + e.amount, 0);
      const totalSpent = Math.max(dept.spent, actualSpentFromExpenses);

      return {
        ...dept,
        spent: totalSpent,
      };
    });
  }, [departmentBudgets, expenses]);

  // Filtered Giving Records
  const currentMonthKey = getCurrentMonthKey();
  const previousMonthKey = getPreviousMonthKey();
  const todayStr = todayISO();
  const currentYear = String(new Date().getFullYear());
  const yesterdayStr = useMemo(() => {
    const yDate = new Date();
    yDate.setDate(yDate.getDate() - 1);
    return todayISO(yDate);
  }, []);

  const { currentMonthLabel, previousMonthLabel } = useMemo(() => {
    const now = new Date();
    const curr = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(now);
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prev = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(prevDate);
    return { currentMonthLabel: curr, previousMonthLabel: prev };
  }, []);

  const trajectoryRange = useMemo(() => {
    if (monthlyCashflowData.length === 0) return '';
    const first = monthlyCashflowData[0]?.month;
    const last = monthlyCashflowData[monthlyCashflowData.length - 1]?.month;
    return `${first} – ${last}`;
  }, [monthlyCashflowData]);

  const filteredGiving = useMemo(() => {
    return giving
      .filter((g) => {
        const term = givingSearch.toLowerCase();
        const memberObj = g.member_id ? members.find((m) => m.id === g.member_id) : undefined;
        const titheNum = (g.tithe_number || memberObj?.tithe_number || '').toLowerCase();
        const matchesSearch =
          !term ||
          (g.member_name && g.member_name.toLowerCase().includes(term)) ||
          (g.donor_name && g.donor_name.toLowerCase().includes(term)) ||
          (titheNum && titheNum.includes(term)) ||
          (g.reference_number && g.reference_number.toLowerCase().includes(term)) ||
          (g.notes && g.notes.toLowerCase().includes(term)) ||
          (g.payment_channel && g.payment_channel.toLowerCase().includes(term)) ||
          (g.category || '').toLowerCase().includes(term);

        const matchesCategory = givingCategoryFilter === 'all' || g.category === givingCategoryFilter;
        const matchesMethod = givingMethodFilter === 'all' || g.payment_method === givingMethodFilter;
        const matchesService = givingServiceFilter === 'all' || (g.service_name && g.service_name.toLowerCase().includes(givingServiceFilter.toLowerCase()));

        let matchesDate = true;
        const recDate = normalizeDateStr(g.date);
        if (givingDateFilter === 'today') {
          matchesDate = recDate === todayStr;
        } else if (givingDateFilter === 'yesterday') {
          matchesDate = recDate === yesterdayStr;
        } else if (givingDateFilter === 'this_week') {
          matchesDate = isDateInCurrentWeek(recDate);
        } else if (givingDateFilter === 'last_week') {
          matchesDate = isDateInLastWeek(recDate);
        } else if (givingDateFilter === 'last_7_days') {
          matchesDate = isDateInPastDays(recDate, 7);
        } else if (givingDateFilter === 'this_month') {
          matchesDate = isDateInMonth(recDate, currentMonthKey);
        } else if (givingDateFilter === 'last_month') {
          matchesDate = isDateInMonth(recDate, previousMonthKey);
        } else if (givingDateFilter === 'this_year') {
          matchesDate = recDate.startsWith(currentYear);
        } else if (givingDateFilter === 'custom') {
          matchesDate = isDateInRange(recDate, givingStartDate, givingEndDate);
        }

        return matchesSearch && matchesCategory && matchesMethod && matchesService && matchesDate;
      })
      .sort((a, b) => {
        const dateA = normalizeDateStr(a.date);
        const dateB = normalizeDateStr(b.date);
        if (dateB !== dateA) return dateB.localeCompare(dateA);
        return (b.id || '').localeCompare(a.id || '');
      });
  }, [
    giving,
    givingSearch,
    givingCategoryFilter,
    givingMethodFilter,
    givingServiceFilter,
    givingDateFilter,
    givingStartDate,
    givingEndDate,
    currentMonthKey,
    previousMonthKey,
    todayStr,
    yesterdayStr,
    currentYear,
  ]);

  const filteredGivingTotal = useMemo(
    () => filteredGiving.reduce((sum, g) => sum + g.amount, 0),
    [filteredGiving]
  );

  // Filtered Expenses Records
  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((e) => {
        const term = expenseSearch.toLowerCase();
        const matchesSearch =
          !term ||
          (e.title && e.title.toLowerCase().includes(term)) ||
          (e.recipient && e.recipient.toLowerCase().includes(term)) ||
          (e.description && e.description.toLowerCase().includes(term)) ||
          (e.reference_number && e.reference_number.toLowerCase().includes(term)) ||
          (e.approved_by && e.approved_by.toLowerCase().includes(term)) ||
          (e.category || '').toLowerCase().includes(term);

        const matchesCategory = expenseCategoryFilter === 'all' || (e.category || '').toLowerCase().includes(expenseCategoryFilter.toLowerCase());

        let matchesDate = true;
        const expDate = normalizeDateStr(e.date);
        if (expenseDateFilter === 'today') {
          matchesDate = expDate === todayStr;
        } else if (expenseDateFilter === 'yesterday') {
          matchesDate = expDate === yesterdayStr;
        } else if (expenseDateFilter === 'this_week') {
          matchesDate = isDateInCurrentWeek(expDate);
        } else if (expenseDateFilter === 'last_week') {
          matchesDate = isDateInLastWeek(expDate);
        } else if (expenseDateFilter === 'last_7_days') {
          matchesDate = isDateInPastDays(expDate, 7);
        } else if (expenseDateFilter === 'this_month') {
          matchesDate = isDateInMonth(expDate, currentMonthKey);
        } else if (expenseDateFilter === 'last_month') {
          matchesDate = isDateInMonth(expDate, previousMonthKey);
        } else if (expenseDateFilter === 'this_year') {
          matchesDate = expDate.startsWith(currentYear);
        } else if (expenseDateFilter === 'custom') {
          matchesDate = isDateInRange(expDate, expenseStartDate, expenseEndDate);
        }

        return matchesSearch && matchesCategory && matchesDate;
      })
      .sort((a, b) => {
        const dateA = normalizeDateStr(a.date);
        const dateB = normalizeDateStr(b.date);
        if (dateB !== dateA) return dateB.localeCompare(dateA);
        return (b.id || '').localeCompare(a.id || '');
      });
  }, [
    expenses,
    expenseSearch,
    expenseCategoryFilter,
    expenseDateFilter,
    expenseStartDate,
    expenseEndDate,
    currentMonthKey,
    previousMonthKey,
    todayStr,
    yesterdayStr,
    currentYear,
  ]);

  const filteredExpensesTotal = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
    [filteredExpenses]
  );

  // Tither Intelligence List: cross-referencing registered church members with tithe payments
  const tithersAnalysis = useMemo(() => {
    const memberTitheMap = new Map<
      string,
      {
        member: Member;
        totalAmount: number;
        recordsCount: number;
        lastDate: string;
      }
    >();

    // Seed all active members with a tithe number or active status
    members.forEach((m) => {
      if (!m.is_archived) {
        memberTitheMap.set(m.id, {
          member: m,
          totalAmount: 0,
          recordsCount: 0,
          lastDate: '',
        });
      }
    });

    // Populate from actual giving records
    giving.forEach((g) => {
      if (g.category === 'Tithe' && g.member_id && memberTitheMap.has(g.member_id)) {
        const item = memberTitheMap.get(g.member_id)!;
        item.totalAmount += g.amount;
        item.recordsCount += 1;
        const nDate = normalizeDateStr(g.date);
        if (!item.lastDate || nDate > item.lastDate) {
          item.lastDate = nDate;
        }
      }
    });

    return Array.from(memberTitheMap.values())
      .map((row) => {
        let status: 'consistent' | 'periodic' | 'needs_care' = 'needs_care';
        if (row.recordsCount >= 2 || (row.lastDate && isDateInMonth(row.lastDate, currentMonthKey))) {
          status = 'consistent';
        } else if (row.recordsCount > 0) {
          status = 'periodic';
        }

        return {
          ...row,
          status,
        };
      })
      .filter((row) => {
        const term = titherSearch.toLowerCase().trim();
        const matchesTerm =
          !term ||
          (row.member.first_name || '').toLowerCase().includes(term) ||
          (row.member.last_name || '').toLowerCase().includes(term) ||
          (row.member.tithe_number && row.member.tithe_number.toLowerCase().includes(term)) ||
          (row.member.phone || '').includes(term);

        const matchesStatus = titherStatusFilter === 'all' || row.status === titherStatusFilter;
        return matchesTerm && matchesStatus;
      })
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [members, giving, titherSearch, titherStatusFilter, currentMonthKey]);

  // Sunday Offering Counter Calculated Total
  const calculatedCashTotal = useMemo(() => {
    return denominations.reduce((sum, d) => sum + d.value * d.count, 0);
  }, [denominations]);

  const foreignConvertedGhs = Math.round((Number(counterUsdAmount) || 0) * (Number(counterUsdRate) || 15.8) * 100) / 100;
  const digitalSettlementTotal = (Number(counterMoMoTotal) || 0) + (Number(counterTelecelTotal) || 0);
  const grandServiceTotal = Math.round((calculatedCashTotal + digitalSettlementTotal + foreignConvertedGhs) * 100) / 100;

  const handleDenominationChange = (index: number, newCount: number) => {
    setDenominations((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, count: Math.max(0, isNaN(newCount) ? 0 : newCount) } : row
      )
    );
  };

  const handleResetCounter = () => {
    setDenominations(createDefaultDenominations());
    setCounterMoMoTotal(0);
    setCounterTelecelTotal(0);
    setCounterUsdAmount(0);
    setCounterEnvelopesCount(0);
    setCounterNotes('');
    info('Counter Reset', 'All bill counts, digital collections, and notes have been cleared.');
  };

  const handleSaveCounterOffering = () => {
    if (calculatedCashTotal <= 0 && digitalSettlementTotal <= 0 && foreignConvertedGhs <= 0) {
      error('Empty Tally', 'Please enter bill counts or digital settlements before recording.');
      return;
    }

    const serviceDate = counterDate || todayISO();

    // Record Cash Offering
    if (calculatedCashTotal > 0) {
      recordGiving({
        donor_name: `${counterServiceName} (Cash Bowl Collection)`,
        category: 'Offering',
        amount: calculatedCashTotal,
        currency: 'GHS',
        date: serviceDate,
        payment_method: 'cash',
        payment_channel: 'Cash Bowl Collection',
        reference_number: `CSH-${Date.now().toString().slice(-6)}`,
        service_name: counterServiceName,
        notes: `Tally Verified by ${counterSupervisor}. ${counterEnvelopesCount} envelopes tallied. Notes: ${counterNotes}`,
      });
    }

    // Record MoMo & Digital Giving
    if (counterMoMoTotal > 0) {
      recordGiving({
        donor_name: `${counterServiceName} (MTN MoMo Settlement)`,
        category: 'Offering',
        amount: counterMoMoTotal,
        currency: 'GHS',
        date: serviceDate,
        payment_method: 'mobile_money',
        payment_channel: 'MTN MoMo',
        reference_number: `MM-${Date.now().toString().slice(-6)}`,
        service_name: counterServiceName,
        notes: `Service digital giving settlement verified by ${counterSupervisor}.`,
      });
    }

    if (counterTelecelTotal > 0) {
      recordGiving({
        donor_name: `${counterServiceName} (Telecel Cash Settlement)`,
        category: 'Offering',
        amount: counterTelecelTotal,
        currency: 'GHS',
        date: serviceDate,
        payment_method: 'mobile_money',
        payment_channel: 'Telecel Cash',
        reference_number: `TC-${Date.now().toString().slice(-6)}`,
        service_name: counterServiceName,
        notes: `Service digital giving settlement verified by ${counterSupervisor}.`,
      });
    }

    if (foreignConvertedGhs > 0) {
      recordGiving({
        donor_name: `${counterServiceName} (Foreign Currencies)`,
        category: 'Offering',
        amount: foreignConvertedGhs,
        currency: 'GHS',
        date: serviceDate,
        payment_method: 'cash',
        payment_channel: `Foreign Currency ($${counterUsdAmount} @ ${counterUsdRate})`,
        reference_number: `FX-${Date.now().toString().slice(-6)}`,
        service_name: counterServiceName,
        notes: `Foreign currency offering exchanged into GHS treasury funds.`,
      });
    }

    success(
      'Service Offering Recorded Successfully!',
      `Added ${formatGHS(grandServiceTotal)} to the church treasury.`
    );

    // Reset counts
    setDenominations(createDefaultDenominations());
    setCounterUsdAmount(0);
    setCounterMoMoTotal(0);
    setCounterTelecelTotal(0);
    setCounterEnvelopesCount(0);
    setCounterNotes('');
  };

  // Export CSV Handler for Giving
  const handleExportCSV = () => {
    const headers = ['Date', 'Donor Name', 'Member ID', 'Category', 'Amount (GHS)', 'Method', 'Channel', 'Reference', 'Service', 'Notes'];
    const rows = filteredGiving.map((g) => [
      normalizeDateStr(g.date) || g.date,
      `"${(g.member_name || g.donor_name || 'Anonymous').replace(/"/g, '""')}"`,
      `"${g.member_id || '-'}"`,
      `"${g.category}"`,
      g.amount.toFixed(2),
      `"${g.payment_method}"`,
      `"${g.payment_channel || ''}"`,
      `"${g.reference_number || ''}"`,
      `"${g.service_name || ''}"`,
      `"${(g.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GWCC_Giving_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    info('Giving Ledger Exported', 'CSV spreadsheet file downloaded.');
  };

  // Export CSV Handler for Expenses
  const handleExportExpensesCSV = () => {
    const headers = ['Date', 'Title / Description', 'Category', 'Amount (GHS)', 'Recipient', 'Method', 'Account', 'Approved By', 'Reference'];
    const rows = filteredExpenses.map((e) => [
      normalizeDateStr(e.date) || e.date,
      `"${(e.title || e.description || '').replace(/"/g, '""')}"`,
      `"${e.category}"`,
      e.amount.toFixed(2),
      `"${(e.recipient || '').replace(/"/g, '""')}"`,
      `"${e.payment_method}"`,
      `"${(e.account || '').replace(/"/g, '""')}"`,
      `"${(e.approved_by || '').replace(/"/g, '""')}"`,
      `"${(e.reference_number || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GWCC_Expense_Vouchers_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    info('Expense Vouchers Exported', 'CSV spreadsheet file downloaded.');
  };

  // Fast Batch Entry Callback
  const handleSaveBatchRecords = (records: any[]) => {
    records.forEach((rec) => {
      recordGiving(rec);
    });

    const sum = records.reduce((s, r) => s + r.amount, 0);
    setIsBatchModalOpen(false);
    success(
      'Batch Giving Recorded!',
      `Logged ${records.length} transactions totaling ${formatGHS(sum)}.`
    );
  };

  // Form Submits
  const handleGivingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(givingForm.amount);
    if (isNaN(amt) || amt <= 0) return;

    let memberName = '';
    let titheNum = givingForm.tithe_number ? givingForm.tithe_number.trim() : '';
    let finalMemberId = givingForm.member_id;

    if (finalMemberId) {
      const mem = members.find((m) => m.id === finalMemberId);
      memberName = mem ? `${mem.first_name} ${mem.last_name}` : '';
      if (!titheNum && mem?.tithe_number) {
        titheNum = mem.tithe_number;
      }
    } else if (titheNum) {
      const mem = members.find(
        (m) =>
          m.tithe_number?.trim().toLowerCase() === titheNum.toLowerCase() ||
          (m.tithe_number && titheNum.replace(/\D/g, '') && m.tithe_number.replace(/\D/g, '') === titheNum.replace(/\D/g, ''))
      );
      if (mem) {
        finalMemberId = mem.id;
        memberName = `${mem.first_name} ${mem.last_name}`;
        titheNum = mem.tithe_number || titheNum;
      }
    }

    const rec = recordGiving({
      member_id: finalMemberId || undefined,
      member_name: memberName || undefined,
      tithe_number: titheNum || undefined,
      donor_name: memberName ? undefined : givingForm.donor_name || (titheNum ? `Tithe Envelope #${titheNum}` : 'Anonymous Giver'),
      category: givingForm.category,
      amount: amt,
      currency: 'GHS',
      date: givingForm.date || todayISO(),
      payment_method: givingForm.payment_method,
      payment_channel: givingForm.payment_channel,
      reference_number: givingForm.reference_number || `REC-${Date.now().toString().slice(-6)}`,
      service_name: givingForm.service_name,
      notes: givingForm.notes || undefined,
    });

    setIsGivingModalOpen(false);
    success(
      'Giving Recorded!',
      `${formatGHS(amt)} recorded for ${rec.member_name || rec.donor_name}${titheNum ? ` (Tithe #${titheNum})` : ''}.`
    );

    // Reset
    setGivingForm({
      member_id: '',
      tithe_number: '',
      donor_name: '',
      category: 'Tithe',
      amount: '',
      date: todayISO(),
      payment_method: 'mobile_money',
      payment_channel: 'MTN MoMo',
      reference_number: '',
      service_name: 'Sunday 2nd Service (Celebration)',
      notes: '',
    });
  };

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(expenseForm.amount);
    if (isNaN(amt) || amt <= 0) return;

    recordExpense({
      title: expenseForm.title,
      description: expenseForm.title,
      category: expenseForm.category,
      amount: amt,
      currency: 'GHS',
      date: expenseForm.date || todayISO(),
      payment_method: expenseForm.payment_method,
      account: expenseForm.account,
      recipient: expenseForm.recipient,
      approved_by: expenseForm.approved_by,
      reference_number: expenseForm.reference_number || `VCH-${Date.now().toString().slice(-6)}`,
      notes: expenseForm.notes || undefined,
    });

    setIsExpenseModalOpen(false);
    success('Expense Voucher Logged!', `${formatGHS(amt)} disbursed for "${expenseForm.title}".`);

    setExpenseForm({
      title: '',
      category: 'Utilities',
      amount: '',
      date: todayISO(),
      payment_method: 'mobile_money',
      account: 'Mobile Money Account',
      recipient: '',
      approved_by: 'Prophet Elisha K. Richard',
      reference_number: '',
      notes: '',
    });
  };

  // Delete Action
  const executeDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'giving') {
      deleteGiving(deleteConfirm.id);
      success('Record Deleted', 'The giving record has been removed.');
    } else {
      deleteExpense(deleteConfirm.id);
      success('Voucher Deleted', 'The expense voucher has been removed.');
    }
    setDeleteConfirm(null);
  };

  // Department Budget Handlers
  const handleSaveBudget = (b: DepartmentBudget) => {
    const idx = departmentBudgets.findIndex((x) => x.id === b.id);
    let updated: DepartmentBudget[];
    if (idx >= 0) {
      updated = [...departmentBudgets];
      updated[idx] = b;
    } else {
      updated = [...departmentBudgets, b];
    }
    saveBudgetsToStorage(updated);
    setIsBudgetModalOpen(false);
    setEditingBudget(null);
    success('Budget Updated', `Allocated ${formatGHS(b.allocated)} for ${b.name}.`);
  };

  const handleDeleteBudget = (id: string) => {
    const target = departmentBudgets.find((b) => b.id === id);
    const updated = departmentBudgets.filter((b) => b.id !== id);
    saveBudgetsToStorage(updated);
    setIsBudgetModalOpen(false);
    setEditingBudget(null);
    success('Budget Removed', `Budget allocation for "${target?.name || 'Department'}" deleted.`);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
              <Wallet className="w-5 h-5 text-emerald-800" />
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Church Treasury & Financial Stewardship
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            {settings.church_name || 'Greater Works City Church'}, {settings.branch_name || 'Joma Assembly'} • Currency: Ghana Cedi (GH₵)
          </p>
        </div>

        {/* Quick Top Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsBatchModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
            title="Fast multi-envelope giving entry"
          >
            <Layers className="w-4 h-4 text-emerald-700" />
            <span>Sunday Batch Entry</span>
          </button>

          <button
            onClick={() => setActiveTab('counter')}
            className="px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100 text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
          >
            <Calculator className="w-4 h-4 text-amber-700" />
            <span>Sunday Cash Counter</span>
          </button>

          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <TrendingDown className="w-4 h-4 text-rose-600" />
            <span>Post Expense</span>
          </button>

          <button
            onClick={() => setIsGivingModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-[#064e3b] hover:bg-[#047857] text-white text-xs font-bold flex items-center gap-1.5 transition shadow-md cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Record Giving (GH₵)</span>
          </button>
        </div>
      </div>

      {/* KPI Financial Overview Cards with Animated Numbers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Inflow */}
        <motion.div
          whileHover={{ y: -3, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const } }}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Revenue (Inflow)
            </span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-800 flex items-baseline gap-1 font-mono">
            <span className="text-xs">GH₵</span>
            <AnimatedNumber value={totalIncome} decimals={2} duration={900} />
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Tithes: {formatGHS(totalTithes)}</span>
            <span className="text-emerald-700 font-semibold">{giving.length} records</span>
          </div>
        </motion.div>

        {/* Total Outflow */}
        <motion.div
          whileHover={{ y: -3, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const } }}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-rose-300 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Expenditure
            </span>
            <span className="p-2 rounded-xl bg-rose-50 text-rose-700">
              <TrendingDown className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-rose-700 flex items-baseline gap-1 font-mono">
            <span className="text-xs">GH₵</span>
            <AnimatedNumber value={totalExpenses} decimals={2} duration={900} />
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Utilities & Operations</span>
            <span className="text-rose-700 font-semibold">{expenses.length} vouchers</span>
          </div>
        </motion.div>

        {/* Net Operating Surplus */}
        <motion.div
          whileHover={{ y: -3, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const } }}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-teal-300 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Net Church Reserves
            </span>
            <span className={`p-2 rounded-xl ${netBalance >= 0 ? 'bg-teal-50 text-teal-700' : 'bg-rose-50 text-rose-700'}`}>
              <Coins className="w-4 h-4" />
            </span>
          </div>
          <div className={`mt-2 text-2xl font-extrabold flex items-baseline gap-1 font-mono ${netBalance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
            <span className="text-xs">GH₵</span>
            <AnimatedNumber value={netBalance} decimals={2} duration={950} />
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{netBalance >= 0 ? 'Operating Surplus' : 'Operating Deficit'}</span>
            </span>
            <span className="text-slate-400">Audited</span>
          </div>
        </motion.div>

        {/* Digital MoMo Penetration */}
        <motion.div
          whileHover={{ y: -3, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const } }}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-amber-300 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              MoMo & Digital Giving
            </span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-700">
              <CreditCard className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-800 flex items-baseline gap-1 font-mono">
            <span>{momoPercentage}%</span>
            <span className="text-xs text-slate-500 font-sans font-normal ml-1">of total giving</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>{formatGHS(momoTotal)}</span>
            <span className="text-amber-800 font-semibold">{momoTransactions.length} digital gifts</span>
          </div>
        </motion.div>
      </div>

      {/* Main Tab Navigation Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1 text-xs font-bold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-[#064e3b] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Treasury Overview & Analytics</span>
        </button>

        <button
          onClick={() => setActiveTab('giving')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'giving'
              ? 'bg-[#064e3b] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Giving & Tithes Ledger ({giving.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'expenses'
              ? 'bg-[#064e3b] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          <span>Expenditure Vouchers ({expenses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tithers')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'tithers'
              ? 'bg-[#064e3b] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Tither Intelligence & Care ({tithersAnalysis.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('counter')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'counter'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>Sunday Offering Counter</span>
        </button>

        <button
          onClick={() => setActiveTab('budgets')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'budgets'
              ? 'bg-[#064e3b] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Departmental Budgets</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: TREASURY OVERVIEW & ANALYTICS                         */}
      {/* ============================================================ */}
      {activeTab === 'overview' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          {/* Charts Row: Cashflow Trends & Giving Category Share */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 6-Month Inflow vs Outflow Area Chart */}
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-emerald-50 text-emerald-800 rounded-lg">
                      <TrendingUp className="w-4 h-4" />
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm">6-Month Cashflow Trajectory (GH₵)</h3>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">{trajectoryRange}</span>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Comparative tracking of church revenue inflows against operational and capital expenditures.
                </p>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyCashflowData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#047857" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#047857" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#e11d48" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#e11d48" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="shortMonth" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          fontSize: '12px',
                        }}
                        formatter={(val: any, name: any) => [`GH₵ ${Number(val).toLocaleString()}`, name]}
                      />
                      <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }} />
                      <Area type="monotone" dataKey="income" name="Total Revenue" stroke="#047857" strokeWidth={2.5} fill="url(#incomeGrad)" />
                      <Area type="monotone" dataKey="expenses" name="Expenditures" stroke="#e11d48" strokeWidth={2} fill="url(#expenseGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Average monthly surplus: <strong>{formatGHS(averageMonthlySurplus)}</strong></span>
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  Healthy Liquid Reserve <CheckCircle2 className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>

            {/* Giving Category Share Donut */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="p-1.5 bg-amber-50 text-amber-800 rounded-lg">
                    <PieChartIcon className="w-4 h-4" />
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm">Giving Distribution</h3>
                </div>
                <p className="text-xs text-slate-500 mb-3">Portfolio share across church ministerial funds.</p>

                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {categoryChartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CATEGORY_COLORS[entry.name] || PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any) => [`GH₵ ${Number(val).toLocaleString()}`, '']}
                        contentStyle={{ borderRadius: '10px', fontSize: '11px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                  {categoryChartData.map((item, idx) => {
                    const pct = totalIncome > 0 ? Math.round((item.value / totalIncome) * 100) : 0;
                    return (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-slate-600 truncate max-w-[130px]">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: CATEGORY_COLORS[item.name] || PIE_COLORS[idx % PIE_COLORS.length] }}
                          />
                          <span className="truncate">{item.name}</span>
                        </span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-slate-400 text-[10px]">{pct}%</span>
                          <span className="font-bold text-slate-900">{formatGHS(item.value)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Channels Grid */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-700" />
              Settlement Channels & MoMo Processing
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60">
                <span className="text-slate-500 font-medium block">MTN Mobile Money</span>
                <span className="text-lg font-bold text-slate-900 mt-1 block font-mono">
                  {formatGHS(giving.filter(g => (g.payment_channel || '').toLowerCase().includes('mtn')).reduce((s, g) => s + g.amount, 0))}
                </span>
                <span className="text-[11px] text-emerald-700 font-semibold block mt-0.5">Primary Telco Merchant</span>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60">
                <span className="text-slate-500 font-medium block">Telecel Cash</span>
                <span className="text-lg font-bold text-slate-900 mt-1 block font-mono">
                  {formatGHS(giving.filter(g => {
                    const ch = (g.payment_channel || '').toLowerCase();
                    return ch.includes('telecel') || ch.includes('vodafone');
                  }).reduce((s, g) => s + g.amount, 0))}
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">Prompt digital settlement</span>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60">
                <span className="text-slate-500 font-medium block">Bank Transfer (GCB / Ecobank)</span>
                <span className="text-lg font-bold text-slate-900 mt-1 block font-mono">
                  {formatGHS(giving.filter(g => g.payment_method === 'bank_transfer').reduce((s, g) => s + g.amount, 0))}
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">Church Treasury Main Account</span>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60">
                <span className="text-slate-500 font-medium block">Physical Cash Bowl</span>
                <span className="text-lg font-bold text-slate-900 mt-1 block font-mono">
                  {formatGHS(giving.filter(g => g.payment_method === 'cash').reduce((s, g) => s + g.amount, 0))}
                </span>
                <span className="text-[11px] text-amber-700 font-semibold block mt-0.5">Sunday Counter Verified</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: GIVING & TITHES LEDGER                                */}
      {/* ============================================================ */}
      {activeTab === 'giving' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 flex-1">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={givingSearch}
                  onChange={(e) => setGivingSearch(e.target.value)}
                  placeholder="Search member, tithe # (e.g. T-1001), ref..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Category Filter */}
              <div>
                <select
                  value={givingCategoryFilter}
                  onChange={(e) => setGivingCategoryFilter(e.target.value)}
                  className="w-full py-2 px-3 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-medium"
                >
                  <option value="all">All Giving Categories</option>
                  <option value="Tithe">Tithes Only</option>
                  <option value="Offering">Offerings</option>
                  <option value="Building Fund">Building Fund</option>
                  <option value="Thanksgiving">Thanksgiving</option>
                  <option value="Seed">Sacrificial Seed</option>
                  <option value="First Fruit">First Fruit</option>
                  <option value="Missions">Missions</option>
                  <option value="Special Offering">Special Offering</option>
                  <option value="Donation">Special Donation</option>
                  <option value="Other">Other Category</option>
                </select>
              </div>

              {/* Payment Method Filter */}
              <div>
                <select
                  value={givingMethodFilter}
                  onChange={(e) => setGivingMethodFilter(e.target.value)}
                  className="w-full py-2 px-3 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-medium"
                >
                  <option value="all">All Payment Methods</option>
                  <option value="mobile_money">Mobile Money (MoMo)</option>
                  <option value="cash">Cash Collection</option>
                  <option value="bank_transfer">Bank Wire</option>
                  <option value="card">Card / POS</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Service Filter */}
              <div>
                <select
                  value={givingServiceFilter}
                  onChange={(e) => setGivingServiceFilter(e.target.value)}
                  className="w-full py-2 px-3 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-medium"
                >
                  <option value="all">All Services</option>
                  <option value="Sunday 1st Service">Sunday 1st Service</option>
                  <option value="Sunday 2nd Service">Sunday 2nd Service</option>
                  <option value="Midweek">Midweek Service</option>
                  <option value="Celebration">Celebration Service</option>
                </select>
              </div>

              {/* Date Filter */}
              <div>
                <select
                  value={givingDateFilter}
                  onChange={(e) => setGivingDateFilter(e.target.value as FinanceDateFilterType)}
                  className="w-full py-2 px-3 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-medium cursor-pointer"
                >
                  <option value="all">All Dates (Lifetime)</option>
                  <option value="today">Today ({todayStr})</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="this_week">This Week</option>
                  <option value="last_week">Last Week</option>
                  <option value="last_7_days">Last 7 Days</option>
                  <option value="this_month">{currentMonthLabel} (Current)</option>
                  <option value="last_month">{previousMonthLabel}</option>
                  <option value="this_year">This Year ({currentYear})</option>
                  <option value="custom">Custom Date Range...</option>
                </select>
              </div>
            </div>

            {/* Custom Date Range Picker (When 'custom' filter selected) */}
            {givingDateFilter === 'custom' && (
              <div className="w-full pt-3 mt-1 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                  Date Range:
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-medium">From:</span>
                  <input
                    type="date"
                    value={givingStartDate}
                    onChange={(e) => setGivingStartDate(e.target.value)}
                    className="py-1 px-2.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-medium">To:</span>
                  <input
                    type="date"
                    value={givingEndDate}
                    onChange={(e) => setGivingEndDate(e.target.value)}
                    className="py-1 px-2.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                {(givingStartDate || givingEndDate) && (
                  <button
                    onClick={() => {
                      setGivingStartDate('');
                      setGivingEndDate('');
                    }}
                    className="text-[11px] text-slate-400 hover:text-rose-600 underline font-medium cursor-pointer"
                  >
                    Clear Range
                  </button>
                )}
              </div>
            )}

            {/* Export and Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                title="Export filtered records to CSV"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => setIsBatchModalOpen(true)}
                className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Layers className="w-4 h-4 text-emerald-700" />
                <span>Batch Entry</span>
              </button>
            </div>
          </div>

          {/* Quick Aggregate Stats Ribbon */}
          <div className="bg-emerald-900 text-white p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
            <div className="flex items-center gap-4">
              <span>Showing <strong>{filteredGiving.length}</strong> donation records</span>
              <span className="hidden sm:inline text-emerald-400">•</span>
              <span className="hidden sm:inline">
                Filtered Volume: <strong>{formatGHS(filteredGivingTotal)}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-200">Average Gift:</span>
              <span className="font-mono font-bold">
                {formatGHS(filteredGiving.length > 0 ? filteredGivingTotal / filteredGiving.length : 0)}
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Donor / Member</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Amount (GH₵)</th>
                    <th className="py-3 px-4">Method & Channel</th>
                    <th className="py-3 px-4">Reference / Notes</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredGiving.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No giving records found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredGiving.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-mono text-slate-600">{normalizeDateStr(rec.date) || rec.date}</td>
                        <td className="py-3 px-4">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 block">
                                {rec.member_name || rec.donor_name || 'Anonymous Giver'}
                              </span>
                              {(rec.tithe_number || (rec.member_id && members.find((m) => m.id === rec.member_id)?.tithe_number)) && (
                                <span
                                  className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-0.5"
                                  title="Assigned Tithe Envelope Number"
                                >
                                  <Hash className="w-2.5 h-2.5 text-amber-600" />
                                  {rec.tithe_number || members.find((m) => m.id === rec.member_id)?.tithe_number}
                                </span>
                              )}
                            </div>
                            {rec.service_name && (
                              <span className="text-[10px] text-slate-400">{rec.service_name}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className="font-semibold px-2 py-0.5 rounded text-[11px] border"
                            style={{
                              backgroundColor: `${CATEGORY_COLORS[rec.category] || '#64748b'}15`,
                              color: CATEGORY_COLORS[rec.category] || '#64748b',
                              borderColor: `${CATEGORY_COLORS[rec.category] || '#64748b'}40`,
                            }}
                          >
                            {rec.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-800 text-sm">
                          {formatGHS(rec.amount)}
                        </td>
                        <td className="py-3 px-4 capitalize">
                          <span className="flex items-center gap-1 text-slate-700">
                            <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                            {rec.payment_method.replace('_', ' ')}
                            {rec.payment_channel && (
                              <span className="text-slate-400 text-[10px]">({rec.payment_channel})</span>
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {rec.reference_number || rec.notes || '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setActiveReceiptRecord(rec)}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-emerald-800 hover:border-emerald-300 hover:bg-emerald-50 transition cursor-pointer"
                              title="Generate Official Church Receipt"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingGivingRecord(rec)}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-700 hover:border-blue-300 hover:bg-blue-50 transition cursor-pointer"
                              title="Edit Record"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm({ type: 'giving', id: rec.id, title: `${rec.category} of ${formatGHS(rec.amount)}` })}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-700 hover:border-rose-300 hover:bg-rose-50 transition cursor-pointer"
                              title="Delete Record"
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
        </motion.div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: EXPENDITURE VOUCHERS                                  */}
      {/* ============================================================ */}
      {activeTab === 'expenses' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={expenseSearch}
                  onChange={(e) => setExpenseSearch(e.target.value)}
                  placeholder="Search item, payee, voucher #..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <select
                  value={expenseCategoryFilter}
                  onChange={(e) => setExpenseCategoryFilter(e.target.value)}
                  className="w-full py-2 px-3 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-medium"
                >
                  <option value="all">All Expense Categories</option>
                  <option value="Utilities">Utilities & Power</option>
                  <option value="Media">Media & Production</option>
                  <option value="Salaries">Salaries & Allowances</option>
                  <option value="Building">Building Maintenance</option>
                  <option value="Evangelism">Evangelism & Outreach</option>
                  <option value="Honorarium">Guest Minister Honorarium</option>
                  <option value="Youth">Youth & Children</option>
                  <option value="Administration">Administration & Office</option>
                </select>
              </div>

              <div>
                <select
                  value={expenseDateFilter}
                  onChange={(e) => setExpenseDateFilter(e.target.value as FinanceDateFilterType)}
                  className="w-full py-2 px-3 text-xs border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-medium cursor-pointer"
                >
                  <option value="all">All Dates (Lifetime)</option>
                  <option value="today">Today ({todayStr})</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="this_week">This Week</option>
                  <option value="last_week">Last Week</option>
                  <option value="last_7_days">Last 7 Days</option>
                  <option value="this_month">{currentMonthLabel} (Current)</option>
                  <option value="last_month">{previousMonthLabel}</option>
                  <option value="this_year">This Year ({currentYear})</option>
                  <option value="custom">Custom Date Range...</option>
                </select>
              </div>
            </div>

            {/* Custom Date Range Picker for Expenses */}
            {expenseDateFilter === 'custom' && (
              <div className="w-full pt-3 mt-1 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-rose-700" />
                  Date Range:
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-medium">From:</span>
                  <input
                    type="date"
                    value={expenseStartDate}
                    onChange={(e) => setExpenseStartDate(e.target.value)}
                    className="py-1 px-2.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-rose-500"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-medium">To:</span>
                  <input
                    type="date"
                    value={expenseEndDate}
                    onChange={(e) => setExpenseEndDate(e.target.value)}
                    className="py-1 px-2.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-rose-500"
                  />
                </div>
                {(expenseStartDate || expenseEndDate) && (
                  <button
                    onClick={() => {
                      setExpenseStartDate('');
                      setExpenseEndDate('');
                    }}
                    className="text-[11px] text-slate-400 hover:text-rose-600 underline font-medium cursor-pointer"
                  >
                    Clear Range
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExpensesCSV}
                className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                title="Export vouchers to CSV"
              >
                <FileSpreadsheet className="w-4 h-4 text-rose-700" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => setIsExpenseModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Post Expense</span>
              </button>
            </div>
          </div>

          {/* Quick Aggregate Stats Ribbon */}
          <div className="bg-rose-950 text-white p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
            <div className="flex items-center gap-4">
              <span>Showing <strong>{filteredExpenses.length}</strong> disbursement vouchers</span>
              <span className="hidden sm:inline text-rose-400">•</span>
              <span className="hidden sm:inline">
                Disbursed Volume: <strong>{formatGHS(filteredExpensesTotal)}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-rose-200">Average Voucher:</span>
              <span className="font-mono font-bold">
                {formatGHS(filteredExpenses.length > 0 ? filteredExpensesTotal / filteredExpenses.length : 0)}
              </span>
            </div>
          </div>

          {/* Expenses Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Expense Item / Description</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Amount (GH₵)</th>
                    <th className="py-3 px-4">Payment Account</th>
                    <th className="py-3 px-4">Approved By</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No expense records found matching filters.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-mono text-slate-600">{normalizeDateStr(exp.date) || exp.date}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">{exp.title || exp.description}</span>
                          {exp.recipient && <span className="text-[10px] text-slate-400">Vendor: {exp.recipient}</span>}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-medium">
                            {exp.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-rose-700 text-sm">
                          {formatGHS(exp.amount)}
                        </td>
                        <td className="py-3 px-4 text-slate-600 capitalize">
                          {exp.account || exp.payment_method.replace('_', ' ')}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">{exp.approved_by || 'Church Council'}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setActiveVoucherRecord(exp)}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-rose-800 hover:border-rose-300 hover:bg-rose-50 transition cursor-pointer"
                              title="Print Payment Voucher"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingExpenseRecord(exp)}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-700 hover:border-blue-300 hover:bg-blue-50 transition cursor-pointer"
                              title="Edit Voucher"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm({ type: 'expense', id: exp.id, title: `${exp.title || exp.description} (${formatGHS(exp.amount)})` })}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-700 hover:border-rose-300 hover:bg-rose-50 transition cursor-pointer"
                              title="Delete Voucher"
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
        </motion.div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: TITHER CONSISTENCY & CARE INTELLIGENCE                */}
      {/* ============================================================ */}
      {activeTab === 'tithers' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-800" />
                  Covenant Tither Engagement & Pastoral Care
                </h3>
                <p className="text-xs text-slate-500">
                  Tracking member consistency to provide pastoral appreciation or care checks when giving lapses.
                </p>
              </div>

              {/* Status Filters */}
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <button
                  onClick={() => setTitherStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    titherStatusFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All ({members.filter(m => !m.is_archived).length})
                </button>
                <button
                  onClick={() => setTitherStatusFilter('consistent')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    titherStatusFilter === 'consistent'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  Consistent Tithers
                </button>
                <button
                  onClick={() => setTitherStatusFilter('periodic')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    titherStatusFilter === 'periodic'
                      ? 'bg-blue-700 text-white'
                      : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
                  }`}
                >
                  Periodic
                </button>
                <button
                  onClick={() => setTitherStatusFilter('needs_care')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    titherStatusFilter === 'needs_care'
                      ? 'bg-amber-700 text-white'
                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                  }`}
                >
                  Pastoral Care Check
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={titherSearch}
                onChange={(e) => setTitherSearch(e.target.value)}
                placeholder="Search member, tithe #, phone..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                  <tr>
                    <th className="py-3 px-4">Member Name</th>
                    <th className="py-3 px-4">Tithe #</th>
                    <th className="py-3 px-4">Total Tithed (YTD)</th>
                    <th className="py-3 px-4">Gifts Count</th>
                    <th className="py-3 px-4">Last Tithed Date</th>
                    <th className="py-3 px-4">Consistency Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tithersAnalysis.map((row) => {
                    const cleanPhone = cleanGhanaPhone(row.member.phone);
                    const waMessage =
                      row.status === 'consistent'
                        ? `Dear ${row.member.first_name}, blessings from Greater Works City Church! Prophet Elisha and the leadership want to thank you for your faithful covenant stewardship and tithes. May God open the windows of heaven upon you!`
                        : `Dear ${row.member.first_name}, warm greetings from Greater Works City Church! We are praying for you and wanted to check in on you and your family. Let us know if you need any pastoral support or prayer.`;
                    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMessage)}`;

                    return (
                      <tr key={row.member.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4">
                          <button
                            onClick={() => setMemberTitheHistory(row.member)}
                            className="font-bold text-slate-900 hover:text-emerald-800 hover:underline text-left cursor-pointer"
                          >
                            {row.member.first_name} {row.member.last_name}
                          </button>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-slate-600">
                          {row.member.tithe_number || '-'}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-800">
                          {formatGHS(row.totalAmount)}
                        </td>
                        <td className="py-3 px-4">{row.recordsCount} times</td>
                        <td className="py-3 px-4 font-mono text-slate-500">{row.lastDate || 'No record yet'}</td>
                        <td className="py-3 px-4">
                          {row.status === 'consistent' && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" /> Faithful
                            </span>
                          )}
                          {row.status === 'periodic' && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold text-[10px]">
                              Periodic
                            </span>
                          )}
                          {row.status === 'needs_care' && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] inline-flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-amber-700" /> Care Check
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setStatementMember(row.member)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:text-emerald-800 hover:border-emerald-300 text-[11px] font-semibold transition cursor-pointer"
                              title="Generate Giving Statement"
                            >
                              Statement
                            </button>
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] transition shadow-2xs"
                              title="Send WhatsApp message"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>{row.status === 'consistent' ? 'Thank' : 'Care'}</span>
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* ============================================================ */}
      {/* TAB 5: SUNDAY OFFERING CASH COUNTER & TALLY SHEET            */}
      {/* ============================================================ */}
      {activeTab === 'counter' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-amber-700" />
                  Sunday Service Offering Denomination Counter
                </h3>
                <p className="text-xs text-slate-500">
                  Digital tally sheet for Ushers & Treasury stewards to count Ghana Cedi bills, foreign currencies, and envelopes after church service.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl">
                <span className="text-xs text-amber-900 font-medium">Grand Tally Total:</span>
                <span className="text-xl font-extrabold font-mono text-amber-950">
                  {formatGHS(grandServiceTotal)}
                </span>
              </div>
            </div>

            {/* Service Details Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Service Date</label>
                <input
                  type="date"
                  value={counterDate}
                  onChange={(e) => setCounterDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Church Service</label>
                <input
                  type="text"
                  value={counterServiceName}
                  onChange={(e) => setCounterServiceName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Finance Supervisor</label>
                <input
                  type="text"
                  value={counterSupervisor}
                  onChange={(e) => setCounterSupervisor(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Envelopes Counted</label>
                <input
                  type="number"
                  value={counterEnvelopesCount}
                  onChange={(e) => setCounterEnvelopesCount(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono text-xs"
                />
              </div>
            </div>

            {/* Denomination Grid */}
            <div className="mt-6 border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                  <tr>
                    <th className="py-3 px-4">Ghana Cedi Denomination</th>
                    <th className="py-3 px-4">Value per Unit</th>
                    <th className="py-3 px-4">Quantity / Pieces</th>
                    <th className="py-3 px-4 text-right">Subtotal (GH₵)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {denominations.map((row, index) => {
                    const rowSubtotal = row.value * row.count;
                    return (
                      <tr key={row.label} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-bold text-slate-900">{row.label}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">GH₵ {row.value.toFixed(2)}</td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            min="0"
                            value={row.count || ''}
                            onChange={(e) => handleDenominationChange(index, parseInt(e.target.value, 10) || 0)}
                            className="w-28 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                            placeholder="0"
                          />
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                          {formatGHS(rowSubtotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50/80 border-t border-slate-200 font-bold">
                  <tr>
                    <td colSpan={3} className="py-3 px-4 text-slate-700 text-right">
                      Total Physical Cash Count:
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-800 text-base">
                      {formatGHS(calculatedCashTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Digital Settlements & Foreign Currencies */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2">
                <label className="block text-xs font-bold text-amber-950">
                  MTN Mobile Money Settlement (GH₵)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={counterMoMoTotal || ''}
                  onChange={(e) => setCounterMoMoTotal(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-amber-300 rounded-xl bg-white font-mono font-bold text-sm text-amber-950"
                  placeholder="0.00"
                />
                <p className="text-[11px] text-slate-500">
                  Electronic tithes & offerings settled through church MTN merchant code.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2">
                <label className="block text-xs font-bold text-amber-950">
                  Telecel Cash Settlement (GH₵)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={counterTelecelTotal || ''}
                  onChange={(e) => setCounterTelecelTotal(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-amber-300 rounded-xl bg-white font-mono font-bold text-sm text-amber-950"
                  placeholder="0.00"
                />
                <p className="text-[11px] text-slate-500">
                  Telecel Cash electronic giving payments for this service.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2">
                <label className="block text-xs font-bold text-blue-950 flex items-center justify-between">
                  <span>Foreign Currencies (USD $)</span>
                  <span className="text-[10px] text-blue-600 font-mono">Rate: 1 USD = {counterUsdRate} GHS</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="1"
                    value={counterUsdAmount || ''}
                    onChange={(e) => setCounterUsdAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-xl bg-white font-mono font-bold text-sm text-blue-950"
                    placeholder="$ 0.00"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={counterUsdRate}
                    onChange={(e) => setCounterUsdRate(parseFloat(e.target.value) || 15.8)}
                    className="w-24 px-2 py-2 border border-blue-300 rounded-xl bg-white font-mono text-xs text-blue-950"
                    title="Exchange rate to GHS"
                  />
                </div>
                <p className="text-[11px] text-blue-700 font-semibold font-mono">
                  Converted: {formatGHS(foreignConvertedGhs)}
                </p>
              </div>
            </div>

            {/* Notes */}
            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">Auditor & Counter Notes</label>
              <textarea
                rows={2}
                value={counterNotes}
                onChange={(e) => setCounterNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            {/* Commit & Print Buttons */}
            <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-3 mt-6 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetCounter}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold cursor-pointer active:scale-95 transition"
                >
                  Reset Counts
                </button>
                <button
                  type="button"
                  onClick={() => setIsCounterPrintSheetOpen(true)}
                  className="px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-2xs"
                >
                  <Printer className="w-4 h-4 text-amber-700" />
                  <span>Print Tally Sheet</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleSaveCounterOffering}
                className="px-6 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Commit & Record as Service Offering</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ============================================================ */}
      {/* TAB 6: DEPARTMENTAL BUDGETS & FUND ALLOCATION                */}
      {/* ============================================================ */}
      {activeTab === 'budgets' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Building className="w-5 h-5 text-purple-700" />
                  Monthly Departmental Budgets & Live Variance Tracking
                </h3>
                <p className="text-xs text-slate-500">
                  Real-time budget allocation versus actual expenditures for {currentMonthLabel}.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-xs text-slate-500 block">Total Budget Allocation</span>
                  <span className="text-lg font-bold font-mono text-slate-900">
                    {formatGHS(computedBudgets.reduce((s, b) => s + b.allocated, 0))}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setEditingBudget(null);
                    setIsBudgetModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-purple-900 hover:bg-purple-800 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Budget</span>
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {computedBudgets.map((dept) => {
                const burnPct = Math.min(100, Math.round((dept.spent / dept.allocated) * 100));
                const remaining = dept.allocated - dept.spent;
                const isOverBudget = remaining < 0;

                return (
                  <div key={dept.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                      <div>
                        <span className="font-bold text-slate-900 text-sm block">{dept.name}</span>
                        <span className="text-slate-500 text-[11px]">Led by: {dept.lead}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-mono">
                        <div>
                          <span className="text-slate-400 block text-[10px]">SPENT</span>
                          <span className="font-bold text-slate-900">{formatGHS(dept.spent)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">BUDGET</span>
                          <span className="font-semibold text-slate-600">{formatGHS(dept.allocated)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">VARIANCE</span>
                          <span className={`font-bold ${isOverBudget ? 'text-rose-600' : 'text-emerald-700'}`}>
                            {isOverBudget ? '-' : '+'}{formatGHS(Math.abs(remaining))}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setEditingBudget(dept);
                            setIsBudgetModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-purple-700 rounded transition cursor-pointer"
                          title="Edit Budget Allocation"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            burnPct > 90 ? 'bg-rose-500' : burnPct > 70 ? 'bg-amber-500' : 'bg-emerald-600'
                          }`}
                          style={{ width: `${burnPct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>{burnPct}% budget consumed</span>
                        <span className={isOverBudget ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                          {isOverBudget ? 'Budget Exceeded' : 'On Track'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* ============================================================ */}
      {/* ALL MODALS & ACTIONS                                         */}
      {/* ============================================================ */}

      {/* Official Receipt Modal */}
      {activeReceiptRecord && (
        <OfficialReceiptModal
          record={activeReceiptRecord}
          settings={settings}
          onClose={() => setActiveReceiptRecord(null)}
        />
      )}

      {/* Sunday Offering Tally Sheet Modal */}
      {isCounterPrintSheetOpen && (
        <SundayTallySheetModal
          settings={settings}
          serviceName={counterServiceName}
          date={counterDate}
          supervisor={counterSupervisor}
          envelopesCount={counterEnvelopesCount}
          denominations={denominations}
          cashTotal={calculatedCashTotal}
          momoTotal={counterMoMoTotal}
          telecelTotal={counterTelecelTotal}
          usdAmount={counterUsdAmount}
          usdRate={counterUsdRate}
          foreignConvertedGhs={foreignConvertedGhs}
          grandTotal={grandServiceTotal}
          notes={counterNotes}
          onClose={() => setIsCounterPrintSheetOpen(false)}
        />
      )}

      {/* Payment Voucher Modal */}
      {activeVoucherRecord && (
        <PaymentVoucherModal
          record={activeVoucherRecord}
          settings={settings}
          onClose={() => setActiveVoucherRecord(null)}
        />
      )}

      {/* Fast Sunday Batch Giving Modal */}
      {isBatchModalOpen && (
        <BatchGivingModal
          members={members}
          onSaveBatch={handleSaveBatchRecords}
          onClose={() => setIsBatchModalOpen(false)}
        />
      )}

      {/* Edit Giving Modal */}
      {editingGivingRecord && (
        <EditGivingModal
          record={editingGivingRecord}
          members={members}
          onSave={(id, updates) => {
            updateGiving(id, updates);
            setEditingGivingRecord(null);
            success('Record Updated', 'The giving record has been saved.');
          }}
          onClose={() => setEditingGivingRecord(null)}
        />
      )}

      {/* Edit Expense Modal */}
      {editingExpenseRecord && (
        <EditExpenseModal
          record={editingExpenseRecord}
          onSave={(id, updates) => {
            updateExpense(id, updates);
            setEditingExpenseRecord(null);
            success('Voucher Updated', 'The expense voucher has been saved.');
          }}
          onClose={() => setEditingExpenseRecord(null)}
        />
      )}

      {/* Member Giving Statement Modal */}
      {statementMember && (
        <MemberGivingStatementModal
          member={statementMember}
          givingRecords={giving}
          settings={settings}
          onClose={() => setStatementMember(null)}
        />
      )}

      {/* Member Tithe History Modal */}
      {memberTitheHistory && (
        <MemberTitheHistoryModal
          member={memberTitheHistory}
          givingRecords={giving}
          onOpenStatement={(m) => {
            setMemberTitheHistory(null);
            setStatementMember(m);
          }}
          onClose={() => setMemberTitheHistory(null)}
        />
      )}

      {/* Department Budget Modal */}
      {isBudgetModalOpen && (
        <DepartmentBudgetModal
          initialBudget={editingBudget}
          onSave={handleSaveBudget}
          onDelete={handleDeleteBudget}
          onClose={() => {
            setIsBudgetModalOpen(false);
            setEditingBudget(null);
          }}
        />
      )}

      {/* Record Giving Modal */}
      {isGivingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4">
            <div className="px-6 py-4 bg-[#064e3b] text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Record Tithe or Offering (GH₵)</h3>
                <p className="text-xs text-emerald-200">{settings.church_name || 'Greater Works City Church'} Treasury</p>
              </div>
              <button onClick={() => setIsGivingModalOpen(false)} className="p-1 text-white/80 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleGivingSubmit} className="p-6 space-y-3.5 text-xs">
              {/* Entry Mode Switcher: By Member Name vs By Tithe Number */}
              <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setGivingEntryMode('name')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    givingEntryMode === 'name'
                      ? 'bg-white text-emerald-950 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <User className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Record by Member Name</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setGivingEntryMode('tithe_number');
                    setGivingForm((prev) => ({ ...prev, category: 'Tithe' }));
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    givingEntryMode === 'tithe_number'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Hash className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Record by Tithe Number</span>
                </button>
              </div>

              {/* Mode A: Record by Tithe Number */}
              {givingEntryMode === 'tithe_number' && (
                <div className="space-y-2 p-3.5 bg-amber-50/60 rounded-xl border border-amber-200">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-amber-950 text-xs flex items-center gap-1.5">
                      <Hash className="w-4 h-4 text-amber-700" />
                      Enter Tithe Envelope / Member Card # *
                    </label>
                    <span className="text-[11px] text-amber-800 font-medium">
                      Auto-resolves member
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      list="finance-tithe-numbers-list"
                      value={givingForm.tithe_number}
                      onChange={(e) => {
                        const val = e.target.value;
                        const cleanedVal = val.trim();
                        const matched = members.find(
                          (m) =>
                            m.tithe_number?.toLowerCase() === cleanedVal.toLowerCase() ||
                            (cleanedVal.length >= 2 &&
                              m.tithe_number &&
                              cleanedVal.replace(/\D/g, '') &&
                              m.tithe_number.replace(/\D/g, '') === cleanedVal.replace(/\D/g, ''))
                        );

                        if (matched) {
                          setGivingForm((prev) => ({
                            ...prev,
                            tithe_number: val,
                            member_id: matched.id,
                            category: 'Tithe',
                          }));
                        } else {
                          setGivingForm((prev) => ({
                            ...prev,
                            tithe_number: val,
                            member_id: '',
                            category: 'Tithe',
                          }));
                        }
                      }}
                      placeholder="Type or select tithe # (e.g. T-1001, 1002)..."
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg text-xs font-mono font-bold bg-white focus:outline-emerald-600"
                      autoFocus
                    />
                    <datalist id="finance-tithe-numbers-list">
                      {members
                        .filter((m) => !m.is_archived && m.tithe_number)
                        .map((m) => (
                          <option key={m.id} value={m.tithe_number}>
                            {m.first_name} {m.last_name} ({m.member_id})
                          </option>
                        ))}
                    </datalist>
                  </div>

                  {/* Instant Tithe Lookup Resolution Status */}
                  {givingForm.tithe_number && (
                    <div>
                      {givingForm.member_id ? (
                        (() => {
                          const m = members.find((x) => x.id === givingForm.member_id);
                          if (!m) return null;
                          return (
                            <div className="p-2.5 bg-emerald-100/90 border border-emerald-300 rounded-lg flex items-center justify-between text-xs animate-in fade-in">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-xs shrink-0">
                                  {m.first_name[0]}{m.last_name[0]}
                                </div>
                                <div>
                                  <span className="font-bold text-emerald-950 block">
                                    {m.first_name} {m.last_name}
                                  </span>
                                  <span className="text-[11px] text-emerald-800">
                                    {m.member_id} • Tel: {m.phone || 'N/A'}
                                  </span>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-800 text-white font-mono font-bold text-[10px]">
                                Tithe #{m.tithe_number || givingForm.tithe_number}
                              </span>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="p-2.5 bg-amber-100/90 border border-amber-300 rounded-lg text-[11px] text-amber-950 space-y-1.5">
                          <span className="font-bold flex items-center gap-1 text-amber-900">
                            <Tag className="w-3.5 h-3.5 text-amber-700" />
                            Tithe Envelope #{givingForm.tithe_number} (Unassigned Envelope)
                          </span>
                          <p className="text-[10px] text-amber-800">
                            This envelope is not yet registered to an existing member. Tithe will still be logged under this envelope number.
                          </p>
                          <div>
                            <label className="block text-[10px] font-semibold text-amber-950 mb-0.5">
                              Giver / Donor Name (optional):
                            </label>
                            <input
                              type="text"
                              value={givingForm.donor_name}
                              onChange={(e) => setGivingForm((prev) => ({ ...prev, donor_name: e.target.value }))}
                              placeholder="e.g. Visitor Kwabena or Anonymous"
                              className="w-full px-2 py-1 border border-amber-300 rounded text-xs bg-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Mode B: Record by Member Name */}
              {givingEntryMode === 'name' && (
                <div className="space-y-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Select Member (or leave blank for Guest/Basket)
                  </label>
                  <select
                    value={givingForm.member_id}
                    onChange={(e) => {
                      const memId = e.target.value;
                      const selected = members.find((m) => m.id === memId);
                      setGivingForm((prev) => ({
                        ...prev,
                        member_id: memId,
                        tithe_number: selected?.tithe_number || '',
                        donor_name: selected ? '' : prev.donor_name,
                      }));
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="">-- General Anonymous / Non-Member --</option>
                    {members
                      .filter((m) => !m.is_archived)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.first_name} {m.last_name} ({m.member_id}{m.tithe_number ? ` • Tithe #${m.tithe_number}` : ''})
                        </option>
                      ))}
                  </select>

                  {/* Selected Member Info Pill */}
                  {givingForm.member_id && (
                    (() => {
                      const m = members.find((x) => x.id === givingForm.member_id);
                      if (!m) return null;
                      return (
                        <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                          <span className="text-slate-600 font-medium">
                            Member ID: <strong className="text-slate-900">{m.member_id}</strong>
                          </span>
                          {m.tithe_number ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono font-bold text-[11px] border border-emerald-300 flex items-center gap-1">
                              <Hash className="w-3 h-3 text-emerald-700" />
                              Tithe #{m.tithe_number}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No Tithe # Assigned</span>
                          )}
                        </div>
                      );
                    })()
                  )}

                  {!givingForm.member_id && (
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Donor Name / Source (if guest)</label>
                      <input
                        type="text"
                        value={givingForm.donor_name}
                        onChange={(e) => setGivingForm({ ...givingForm, donor_name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                        placeholder="e.g. Visitor Kwabena or Sunday 2nd Service Basket"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Giving Category *</label>
                  <select
                    value={givingForm.category}
                    onChange={(e) => setGivingForm({ ...givingForm, category: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
                  >
                    <option value="Tithe">Tithe (10%)</option>
                    <option value="Offering">Offering</option>
                    <option value="Thanksgiving">Thanksgiving</option>
                    <option value="Building Fund">Building Fund</option>
                    <option value="First Fruit">First Fruit</option>
                    <option value="Missions">Missions</option>
                    <option value="Special Offering">Special Offering</option>
                    <option value="Seed">Sacrificial Seed</option>
                    <option value="Donation">Special Donation</option>
                    <option value="Other">Other Category</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount (GH₵) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={givingForm.amount}
                    onChange={(e) => setGivingForm({ ...givingForm, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                    placeholder="100.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={givingForm.payment_method}
                    onChange={(e) => setGivingForm({ ...givingForm, payment_method: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs capitalize"
                  >
                    <option value="mobile_money">Mobile Money (MoMo)</option>
                    <option value="cash">Cash Collection</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Channel / Telco</label>
                  <input
                    type="text"
                    value={givingForm.payment_channel}
                    onChange={(e) => setGivingForm({ ...givingForm, payment_channel: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    placeholder="MTN MoMo / Telecel / GCB"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Transaction Ref #</label>
                  <input
                    type="text"
                    value={givingForm.reference_number}
                    onChange={(e) => setGivingForm({ ...givingForm, reference_number: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                    placeholder="e.g. MM-20260924-001"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Service Attended</label>
                  <input
                    type="text"
                    value={givingForm.service_name}
                    onChange={(e) => setGivingForm({ ...givingForm, service_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    placeholder="Sunday 2nd Service"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes / Purpose (Optional)</label>
                <input
                  type="text"
                  value={givingForm.notes}
                  onChange={(e) => setGivingForm({ ...givingForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  placeholder="e.g. September Tithe or Thanksgiving for promotion"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsGivingModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#064e3b] hover:bg-[#047857] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                >
                  Save Giving Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4">
            <div className="px-6 py-4 bg-rose-800 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Record Church Expenditure</h3>
                <p className="text-xs text-rose-200">Disbursement & Voucher Authorization</p>
              </div>
              <button onClick={() => setIsExpenseModalOpen(false)} className="p-1 text-white/80 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleExpenseSubmit} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Expense Item Title *</label>
                <input
                  type="text"
                  required
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  placeholder="e.g. ECG Power Prepaid for Sanctuary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="Utilities">Utilities & Power (ECG / Water)</option>
                    <option value="Media & Production">Media & Streaming Equipment</option>
                    <option value="Salaries/Allowances">Salaries & Staff Welfare</option>
                    <option value="Building Maintenance">Building Maintenance & Repairs</option>
                    <option value="Evangelism & Outreach">Evangelism & Outreach Logistics</option>
                    <option value="Guest Minister Honorarium">Guest Minister Honorarium</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount (GH₵) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                    placeholder="250.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Recipient / Vendor</label>
                  <input
                    type="text"
                    value={expenseForm.recipient}
                    onChange={(e) => setExpenseForm({ ...expenseForm, recipient: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    placeholder="e.g. ECG Ablekuma District"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Approved By</label>
                  <input
                    type="text"
                    value={expenseForm.approved_by}
                    onChange={(e) => setExpenseForm({ ...expenseForm, approved_by: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    placeholder="e.g. Prophet Elisha K. Richard"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Method & Account</label>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={expenseForm.payment_method}
                    onChange={(e) => setExpenseForm({ ...expenseForm, payment_method: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs capitalize"
                  >
                    <option value="mobile_money">Mobile Money (MoMo)</option>
                    <option value="bank_transfer">Bank Wire</option>
                    <option value="cash">Petty Cash</option>
                    <option value="cheque">Cheque</option>
                  </select>
                  <input
                    type="text"
                    value={expenseForm.account}
                    onChange={(e) => setExpenseForm({ ...expenseForm, account: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    placeholder="e.g. MoMo Merchant Account"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-800 hover:bg-rose-900 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                >
                  Post Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Confirm Deletion</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete <span className="font-semibold text-slate-800">{deleteConfirm.title}</span>?
                This action will update treasury balances and log an audit entry.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
