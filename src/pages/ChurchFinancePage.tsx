import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Landmark,
  Wallet,
  TrendingDown,
  TrendingUp,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  CreditCard,
  Building2,
  FileSpreadsheet,
  Printer,
  Receipt,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Users,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  RefreshCw,
  FileText,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Hash,
  DollarSign,
  PieChart as PieChartIcon,
  Calculator,
  Building,
  Check,
  X,
  Layers,
  Banknote,
  Coins,
} from 'lucide-react';
import {
  ResponsiveContainer,
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
import {
  ChurchAccount,
  ChurchFinanceRecord,
  DepartmentBudget,
  PaymentMethod,
} from '../types/database.types';
import { formatGHS, numberToCedisWords } from '../lib/currencyUtils';
import {
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
import { PaymentVoucherModal } from '../components/finance/PaymentVoucherModal';
import { DepartmentBudgetModal } from '../components/finance/DepartmentBudgetModal';

export type ChurchFinanceDateFilter =
  | 'all'
  | 'today'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'custom';

export const EXPENSE_CATEGORIES = [
  'Utilities & Power',
  'Maintenance & Facility',
  'Ministry & Honorarium',
  'Hospitality & Protocol',
  'Media & Technology',
  'Sanctuary & Building Project',
  'Welfare & Relief',
  'Administration & Office',
  'Evangelism & Missions',
  'Transportation & Logistics',
  'Other Operational',
];

export const EXPENSE_COLORS: Record<string, string> = {
  'Utilities & Power': '#ea580c', // Orange
  'Maintenance & Facility': '#d97706', // Amber
  'Ministry & Honorarium': '#7c3aed', // Purple
  'Hospitality & Protocol': '#2563eb', // Blue
  'Media & Technology': '#0284c7', // Sky
  'Sanctuary & Building Project': '#059669', // Emerald
  'Welfare & Relief': '#10b981', // Teal
  'Administration & Office': '#64748b', // Slate
  'Evangelism & Missions': '#dc2626', // Red
  'Transportation & Logistics': '#8b5cf6', // Indigo
  'Other Operational': '#475569',
};

export const CHURCH_INCOME_CATEGORIES = [
  'Facility & Premises Rental',
  'Grants & Headquarters Subvention',
  'Harvest & Annual Thanksgiving Seed',
  'Investments & Bank Interest',
  'Bookshop, Audio & Media Sales',
  'External Ministry Donation',
  'Transportation & Vehicle Hire',
  'Sanctuary Project Contributions',
  'General Church Revenue',
  'Other Institutional Income',
];

export const INCOME_COLORS: Record<string, string> = {
  'Facility & Premises Rental': '#059669', // Emerald
  'Grants & Headquarters Subvention': '#0d9488', // Teal
  'Harvest & Annual Thanksgiving Seed': '#d97706', // Amber
  'Investments & Bank Interest': '#2563eb', // Blue
  'Bookshop, Audio & Media Sales': '#7c3aed', // Purple
  'External Ministry Donation': '#16a34a', // Green
  'Transportation & Vehicle Hire': '#ea580c', // Orange
  'Sanctuary Project Contributions': '#0284c7', // Sky
  'General Church Revenue': '#475569', // Slate
  'Other Institutional Income': '#64748b',
};

// Ghanaian Cedi denominations
interface DenominationRow {
  label: string;
  value: number;
  type: 'note' | 'coin';
}

const GHANA_DENOMINATIONS: DenominationRow[] = [
  { label: 'GH₵ 200 Note', value: 200, type: 'note' },
  { label: 'GH₵ 100 Note', value: 100, type: 'note' },
  { label: 'GH₵ 50 Note', value: 50, type: 'note' },
  { label: 'GH₵ 20 Note', value: 20, type: 'note' },
  { label: 'GH₵ 10 Note', value: 10, type: 'note' },
  { label: 'GH₵ 5 Note', value: 5, type: 'note' },
  { label: 'GH₵ 2 Note / Coin', value: 2, type: 'note' },
  { label: 'GH₵ 1 Note / Coin', value: 1, type: 'coin' },
  { label: '50 Pesewas (GH₵ 0.50)', value: 0.5, type: 'coin' },
  { label: '20 Pesewas (GH₵ 0.20)', value: 0.2, type: 'coin' },
  { label: '10 Pesewas (GH₵ 0.10)', value: 0.1, type: 'coin' },
];

export const ChurchFinancePage: React.FC = () => {
  const navigate = useNavigate();
  const {
    churchAccounts,
    churchFinances,
    departmentBudgets,
    settings,
    services,
    addChurchAccount,
    updateChurchAccount,
    deleteChurchAccount,
    recordChurchFinance,
    updateChurchFinance,
    deleteChurchFinance,
    transferBetweenAccounts,
    addDepartmentBudget,
    updateDepartmentBudget,
  } = useChurchData();

  const { canAccess, currentUser } = useAuth();
  const { success, error, info } = useToast();

  const [activeTab, setActiveTab] = useState<'treasury' | 'ledger' | 'budgets' | 'counter'>('treasury');

  // Filters
  const [dateFilter, setDateFilter] = useState<ChurchFinanceDateFilter>('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountFilter, setSelectedAccountFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState('all');

  // Modals
  const [showRecordIncomeModal, setShowRecordIncomeModal] = useState(false);
  const [showRecordExpenseModal, setShowRecordExpenseModal] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [selectedEditBudget, setSelectedEditBudget] = useState<any | null>(null);
  const [selectedVoucherRecord, setSelectedVoucherRecord] = useState<ChurchFinanceRecord | null>(null);
  const [editingFinanceRecord, setEditingFinanceRecord] = useState<ChurchFinanceRecord | null>(null);

  // Ledger Filter: All, Income Only, Expense Only
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<'all' | 'income' | 'expense'>('all');

  // Form: Record Church Income (Institutional Revenue, Grants, Rentals, Sales)
  const [incomeTitle, setIncomeTitle] = useState('');
  const [incomeAccountId, setIncomeAccountId] = useState(churchAccounts[0]?.id || '');
  const [incomeCategory, setIncomeCategory] = useState(CHURCH_INCOME_CATEGORIES[0]);
  const [incomeDepartment, setIncomeDepartment] = useState('Treasury & Accounts');
  const [incomeSource, setIncomeSource] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeDate, setIncomeDate] = useState(todayISO());
  const [incomePaymentMethod, setIncomePaymentMethod] = useState('bank_transfer');
  const [incomeReferenceNo, setIncomeReferenceNo] = useState('');
  const [incomeReceivedBy, setIncomeReceivedBy] = useState(settings.senior_pastor || 'Prophet Elisha K. Richard');
  const [incomeNotes, setIncomeNotes] = useState('');

  // Form: Record Church Expenditure
  const [formTitle, setFormTitle] = useState('');
  const [formTransactionType, setFormTransactionType] = useState<'expense' | 'disbursement' | 'income' | 'grant'>('expense');
  const [formAccountId, setFormAccountId] = useState(churchAccounts[0]?.id || '');
  const [formCategory, setFormCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [formDepartment, setFormDepartment] = useState('Facilities & Maintenance');
  const [formRecipient, setFormRecipient] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(todayISO());
  const [formPaymentMethod, setFormPaymentMethod] = useState('bank_transfer');
  const [formReferenceNo, setFormReferenceNo] = useState('');
  const [formApprovedBy, setFormApprovedBy] = useState(settings.senior_pastor || 'Prophet Elisha K. Richard');
  const [formNotes, setFormNotes] = useState('');

  // Form: Add Church Account
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<'bank' | 'momo' | 'cash_petty' | 'treasury'>('bank');
  const [newAccNumber, setNewAccNumber] = useState('');
  const [newAccProvider, setNewAccProvider] = useState('GCB Bank');
  const [newAccBalance, setNewAccBalance] = useState('');
  const [newAccDesc, setNewAccDesc] = useState('');

  // Form: Transfer Between Accounts
  const [transferFromId, setTransferFromId] = useState(churchAccounts[0]?.id || '');
  const [transferToId, setTransferToId] = useState(churchAccounts[1]?.id || '');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNotes, setTransferNotes] = useState('');

  // Sunday Cash Counter State
  const [counts, setCounts] = useState<Record<number, number>>({
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    2: 0,
    1: 0,
    0.5: 0,
    0.2: 0,
    0.1: 0,
  });
  const [counterServiceId, setCounterServiceId] = useState('');
  const [counter1Name, setCounter1Name] = useState('');
  const [counter2Name, setCounter2Name] = useState('');
  const [counterSupervisor, setCounterSupervisor] = useState('');

  // Date Filter Predicate
  const isDateMatchingFilter = (dateStr: string) => {
    if (dateFilter === 'all') return true;
    if (dateFilter === 'today') return normalizeDateStr(dateStr) === todayISO();
    if (dateFilter === 'this_week') return isDateInCurrentWeek(dateStr);
    if (dateFilter === 'last_week') return isDateInLastWeek(dateStr);
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

  // Filtered Finances
  const filteredFinances = useMemo(() => {
    return churchFinances
      .filter((item) => {
        if (!isDateMatchingFilter(item.date)) return false;
        if (selectedAccountFilter !== 'all' && item.account_id !== selectedAccountFilter) return false;
        if (selectedCategoryFilter !== 'all' && item.category !== selectedCategoryFilter) return false;
        if (selectedDepartmentFilter !== 'all' && item.department !== selectedDepartmentFilter) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const title = (item.title || '').toLowerCase();
          const recipient = (item.recipient_or_vendor || '').toLowerCase();
          const refNo = (item.reference_no || '').toLowerCase();
          const notes = (item.notes || '').toLowerCase();
          const desc = (item.description || '').toLowerCase();
          return (
            title.includes(q) ||
            recipient.includes(q) ||
            refNo.includes(q) ||
            notes.includes(q) ||
            desc.includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [churchFinances, dateFilter, customStartDate, customEndDate, selectedAccountFilter, selectedCategoryFilter, selectedDepartmentFilter, searchQuery]);

  // Total Available Liquidity across all accounts
  const totalLiquidity = useMemo(() => {
    return churchAccounts
      .filter((a) => a.is_active)
      .reduce((sum, a) => sum + (Number(a.current_balance) || 0), 0);
  }, [churchAccounts]);

  // Total Institutional Church Income in Filtered Period
  const totalChurchIncome = useMemo(() => {
    return filteredFinances
      .filter((f) => f.transaction_type === 'income' || f.transaction_type === 'grant')
      .reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
  }, [filteredFinances]);

  const churchIncomeCount = useMemo(() => {
    return filteredFinances.filter((f) => f.transaction_type === 'income' || f.transaction_type === 'grant').length;
  }, [filteredFinances]);

  // Operational Burn / Expenditures in Filtered Period
  const totalExpenditures = useMemo(() => {
    return filteredFinances
      .filter((f) => f.transaction_type === 'expense' || f.transaction_type === 'disbursement')
      .reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
  }, [filteredFinances]);

  const expendituresCount = useMemo(() => {
    return filteredFinances.filter((f) => f.transaction_type === 'expense' || f.transaction_type === 'disbursement').length;
  }, [filteredFinances]);

  // Net Operating Cash Flow (Surplus / Deficit)
  const netCashFlow = totalChurchIncome - totalExpenditures;

  // Displayed records filtered by ledger tab type (all vs income vs expense)
  const displayedFinances = useMemo(() => {
    if (ledgerTypeFilter === 'income') {
      return filteredFinances.filter((f) => f.transaction_type === 'income' || f.transaction_type === 'grant');
    }
    if (ledgerTypeFilter === 'expense') {
      return filteredFinances.filter((f) => f.transaction_type === 'expense' || f.transaction_type === 'disbursement');
    }
    return filteredFinances;
  }, [filteredFinances, ledgerTypeFilter]);

  // Department Budget Utilization Aggregates
  const totalAllocatedBudget = useMemo(() => {
    return departmentBudgets.reduce((sum, b) => sum + (Number(b.allocated_amount) || 0), 0);
  }, [departmentBudgets]);

  const totalSpentBudget = useMemo(() => {
    return departmentBudgets.reduce((sum, b) => sum + (Number(b.spent_amount) || 0), 0);
  }, [departmentBudgets]);

  // Expense by Category Breakdown for Chart
  const categoryExpenseData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredFinances
      .filter((f) => f.transaction_type === 'expense' || f.transaction_type === 'disbursement')
      .forEach((item) => {
        map[item.category] = (map[item.category] || 0) + (Number(item.amount) || 0);
      });
    return Object.entries(map).map(([name, value]) => ({
      name,
      value,
      color: EXPENSE_COLORS[name] || '#64748b',
    })).sort((a, b) => b.value - a.value);
  }, [filteredFinances]);

  // Sunday Cash Calculator Totals
  const cashTotals = useMemo(() => {
    let grandTotal = 0;
    let notesTotal = 0;
    let coinsTotal = 0;
    let noteCount = 0;
    let coinCount = 0;

    GHANA_DENOMINATIONS.forEach((d) => {
      const qty = counts[d.value] || 0;
      const subtotal = qty * d.value;
      grandTotal += subtotal;
      if (d.type === 'note') {
        notesTotal += subtotal;
        noteCount += qty;
      } else {
        coinsTotal += subtotal;
        coinCount += qty;
      }
    });

    return { grandTotal, notesTotal, coinsTotal, noteCount, coinCount };
  }, [counts]);

  // Handle Save Expenditure
  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(formAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      error('Invalid Amount', 'Please provide a valid expenditure amount.');
      return;
    }

    const selectedAcc = churchAccounts.find((a) => a.id === formAccountId);
    const accName = selectedAcc ? selectedAcc.name : 'Main Operations Account';

    const voucherId = formReferenceNo.trim() || `VOUCH-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const newRec = recordChurchFinance({
      transaction_type: formTransactionType,
      account_id: selectedAcc?.id,
      account_name: accName,
      category: formCategory,
      title: formTitle.trim(),
      recipient_or_vendor: formRecipient.trim() || 'General Vendor',
      amount: amountNum,
      currency: 'GHS',
      date: formDate || todayISO(),
      payment_method: formPaymentMethod,
      reference_no: voucherId,
      department: formDepartment,
      approved_by: formApprovedBy.trim() || 'Prophet Elisha K. Richard',
      notes: formNotes.trim() || undefined,
      recorded_by: currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Finance Secretariat',
      status: 'completed',
    });

    // Also update department budget spent if matched
    const matchedBudget = departmentBudgets.find((b) => b.department.toLowerCase() === formDepartment.toLowerCase());
    if (matchedBudget) {
      updateDepartmentBudget(matchedBudget.id, {
        spent_amount: matchedBudget.spent_amount + amountNum,
      });
    }

    success('Expenditure Recorded', `Disbursed ${formatGHS(amountNum)} from ${accName}.`);
    setShowRecordExpenseModal(false);
    resetExpenseForm();

    // Offer voucher preview
    setSelectedVoucherRecord(newRec);
  };

  const resetExpenseForm = () => {
    setFormTitle('');
    setFormTransactionType('expense');
    setFormAccountId(churchAccounts[0]?.id || '');
    setFormCategory(EXPENSE_CATEGORIES[0]);
    setFormDepartment('Facilities & Maintenance');
    setFormRecipient('');
    setFormAmount('');
    setFormDate(todayISO());
    setFormPaymentMethod('bank_transfer');
    setFormReferenceNo('');
    setFormApprovedBy(settings.senior_pastor || 'Prophet Elisha K. Richard');
    setFormNotes('');
  };

  // Handle Save Church Income
  const handleSaveIncome = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(incomeAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      error('Invalid Amount', 'Please provide a valid income amount.');
      return;
    }

    const selectedAcc = churchAccounts.find((a) => a.id === incomeAccountId) || churchAccounts[0];
    const accName = selectedAcc ? selectedAcc.name : 'Main Operations Account';
    const refId = incomeReferenceNo.trim() || `INC-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const newRec = recordChurchFinance({
      transaction_type: 'income',
      account_id: selectedAcc?.id,
      account_name: accName,
      category: incomeCategory,
      title: incomeTitle.trim(),
      recipient_or_vendor: incomeSource.trim() || 'Church Treasury Deposit',
      amount: amountNum,
      currency: 'GHS',
      date: incomeDate || todayISO(),
      payment_method: incomePaymentMethod as any,
      reference_no: refId,
      department: incomeDepartment,
      approved_by: incomeReceivedBy.trim() || settings.senior_pastor || 'Prophet Elisha K. Richard',
      notes: incomeNotes.trim() || undefined,
      recorded_by: currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Finance Secretariat',
      status: 'completed',
    });

    success('Church Income Recorded', `Recorded ${formatGHS(amountNum)} credited to ${accName}.`);
    setShowRecordIncomeModal(false);
    resetIncomeForm();

    // Offer receipt preview
    setSelectedVoucherRecord(newRec);
  };

  const resetIncomeForm = (targetAccountId?: string) => {
    setIncomeTitle('');
    setIncomeAccountId(targetAccountId || churchAccounts[0]?.id || '');
    setIncomeCategory(CHURCH_INCOME_CATEGORIES[0]);
    setIncomeDepartment('Treasury & Accounts');
    setIncomeSource('');
    setIncomeAmount('');
    setIncomeDate(todayISO());
    setIncomePaymentMethod('bank_transfer');
    setIncomeReferenceNo('');
    setIncomeReceivedBy(currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : settings.senior_pastor || 'Prophet Elisha K. Richard');
    setIncomeNotes('');
  };

  // Handle Add Holding Account
  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) {
      error('Name Required', 'Please enter account name.');
      return;
    }

    const initialBal = parseFloat(newAccBalance) || 0;
    addChurchAccount({
      name: newAccName.trim(),
      account_type: newAccType,
      account_number: newAccNumber.trim() || undefined,
      bank_or_provider: newAccProvider.trim() || 'GCB Bank',
      current_balance: initialBal,
      currency: 'GHS',
      is_active: true,
      description: newAccDesc.trim() || undefined,
    });

    success('Account Created', `Created holding account ${newAccName}.`);
    setShowAddAccountModal(false);
    setNewAccName('');
    setNewAccNumber('');
    setNewAccBalance('');
    setNewAccDesc('');
  };

  // Handle Internal Account Transfer
  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(transferAmount);
    if (isNaN(amt) || amt <= 0) {
      error('Invalid Amount', 'Enter a valid transfer amount.');
      return;
    }

    const res = transferBetweenAccounts(transferFromId, transferToId, amt, transferNotes.trim() || undefined);
    if (res.success) {
      success('Transfer Successful', res.message);
      setShowTransferModal(false);
      setTransferAmount('');
      setTransferNotes('');
    } else {
      error('Transfer Failed', res.message);
    }
  };

  // Handle Post Sunday Cash Count
  const handlePostCashCount = () => {
    if (cashTotals.grandTotal <= 0) {
      error('Empty Count', 'Please record counted notes or coins before posting.');
      return;
    }

    const pettyCashAcc = churchAccounts.find((a) => a.account_type === 'cash_petty') || churchAccounts[0];
    const srv = services.find((s) => s.id === counterServiceId);

    recordChurchFinance({
      transaction_type: 'income',
      account_id: pettyCashAcc?.id,
      account_name: pettyCashAcc?.name || 'Cathedral Petty Cash & Vestry Float',
      category: 'Sunday Cash Counter',
      title: `Sunday Cash Tally - ${srv?.name || 'Main Prophetic Service'}`,
      recipient_or_vendor: 'Sunday Counting Committee',
      amount: cashTotals.grandTotal,
      currency: 'GHS',
      date: todayISO(),
      payment_method: 'cash',
      reference_no: `CASH-COUNT-${todayISO().replace(/-/g, '')}`,
      department: 'Treasury & Accounts',
      approved_by: counterSupervisor || 'Chief Usher & Finance Lead',
      notes: `Verified by: ${counter1Name || 'Counter 1'}, ${counter2Name || 'Counter 2'}. Notes: GH₵ ${cashTotals.notesTotal.toFixed(2)}, Coins: GH₵ ${cashTotals.coinsTotal.toFixed(2)}.`,
      recorded_by: currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Sunday Tally Room',
      status: 'completed',
    });

    success('Cash Posted', `Posted GH₵ ${cashTotals.grandTotal.toFixed(2)} to ${pettyCashAcc?.name}.`);

    // Reset counts
    setCounts({
      200: 0,
      100: 0,
      50: 0,
      20: 0,
      10: 0,
      5: 0,
      2: 0,
      1: 0,
      0.5: 0,
      0.2: 0,
      0.1: 0,
    });
  };

  // CSV Export
  const handleExportFinanceCSV = () => {
    if (filteredFinances.length === 0) {
      info('No Records', 'No finance records match current filter.');
      return;
    }

    const headers = [
      'Record ID',
      'Date',
      'Transaction Type',
      'Voucher / Ref #',
      'Title / Description',
      'Vendor / Recipient',
      'Holding Account',
      'Category',
      'Department',
      'Amount (GHS)',
      'Payment Method',
      'Approved By',
      'Status',
    ];

    const rows = filteredFinances.map((item) => [
      `"${item.id}"`,
      `"${item.date}"`,
      `"${item.transaction_type}"`,
      `"${item.reference_no || ''}"`,
      `"${item.title}"`,
      `"${item.recipient_or_vendor || ''}"`,
      `"${item.account_name}"`,
      `"${item.category}"`,
      `"${item.department || ''}"`,
      item.amount.toFixed(2),
      `"${item.payment_method}"`,
      `"${item.approved_by || ''}"`,
      `"${item.status}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GWCC_Church_Finance_${dateFilter}_${todayISO()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success('Export Successful', `Exported ${filteredFinances.length} financial transactions.`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <Landmark className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Church Finance & Treasury
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Institutional church holding accounts, operational expenditures, payment vouchers, department budgets, and cash counting.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canAccess('finance') && (
            <>
              <button
                onClick={() => {
                  resetIncomeForm();
                  setShowRecordIncomeModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm transition-all shadow-xs cursor-pointer ring-2 ring-emerald-500/20"
                title="Record institutional church income, venue rentals, grants & merchandise"
              >
                <Plus className="w-4 h-4" />
                <span>Record Income</span>
              </button>

              <button
                onClick={() => {
                  resetExpenseForm();
                  setShowRecordExpenseModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs sm:text-sm transition-all shadow-xs cursor-pointer"
                title="Record operational expense vouchers & disbursements"
              >
                <Plus className="w-4 h-4" />
                <span>Record Expenditure</span>
              </button>

              <button
                onClick={() => setShowTransferModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs sm:text-sm border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
              >
                <ArrowRightLeft className="w-4 h-4 text-slate-500" />
                <span>Internal Transfer</span>
              </button>

              <button
                onClick={() => setShowAddAccountModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-800 dark:text-rose-300 font-semibold text-xs sm:text-sm border border-rose-200 dark:border-rose-800/60 transition-all cursor-pointer"
              >
                <Building2 className="w-4 h-4" />
                <span>Add Account</span>
              </button>
            </>
          )}

          <button
            onClick={() => navigate('/giving')}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-semibold border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
            title="Go to Member Tithes & Offerings Giving"
          >
            <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Member Giving</span>
          </button>

          <button
            onClick={handleExportFinanceCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-medium border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Date Filter Ribbon */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 sm:px-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <Calendar className="w-4 h-4 text-rose-600 shrink-0" />
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
                  ? 'bg-rose-600 text-white shadow-2xs'
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

      {/* Treasury KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Liquid Treasury */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Liquidity</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            GH₵ <AnimatedNumber value={totalLiquidity} />
          </div>
          <div className="mt-2 flex items-center text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 mr-1.5">
              {churchAccounts.length} accounts
            </span>
            <span>in treasury</span>
          </div>
        </div>

        {/* Card 2: Church Institutional Income */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs relative overflow-hidden ring-1 ring-emerald-500/10">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/15 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Church Income</span>
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-900 dark:text-emerald-300 tracking-tight">
            GH₵ <AnimatedNumber value={totalChurchIncome} />
          </div>
          <div className="mt-2 flex items-center text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 mr-1.5">
              {churchIncomeCount} deposits
            </span>
            <span>in active period</span>
          </div>
        </div>

        {/* Card 3: Operating Burn / Total Expenditures */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Disbursements</span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            GH₵ <AnimatedNumber value={totalExpenditures} />
          </div>
          <div className="mt-2 flex items-center text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-rose-600 dark:text-rose-400 mr-1.5">
              {expendituresCount} vouchers
            </span>
            <span>paid out</span>
          </div>
        </div>

        {/* Card 4: Net Operating Cash Flow */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs relative overflow-hidden">
          <div className={`absolute top-0 right-0 w-24 h-24 ${netCashFlow >= 0 ? 'bg-teal-500/10' : 'bg-amber-500/10'} rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none`} />
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Net Cash Flow</span>
            <div className={`p-2 rounded-xl ${netCashFlow >= 0 ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400' : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'}`}>
              <ArrowRightLeft className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-xl sm:text-2xl font-extrabold tracking-tight ${netCashFlow >= 0 ? 'text-teal-700 dark:text-teal-300' : 'text-amber-700 dark:text-amber-300'}`}>
            {netCashFlow >= 0 ? '+' : '-'}GH₵ <AnimatedNumber value={Math.abs(netCashFlow)} />
          </div>
          <div className="mt-2 flex items-center text-xs text-slate-500 dark:text-slate-400">
            <span className={`font-semibold mr-1.5 ${netCashFlow >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {netCashFlow >= 0 ? 'Net Surplus' : 'Operating Deficit'}
            </span>
            <span>income vs burn</span>
          </div>
        </div>

        {/* Card 5: Department Budget Utilization */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Budgets Spent</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            GH₵ <AnimatedNumber value={totalSpentBudget} />
          </div>
          <div className="mt-2 flex items-center text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-blue-600 dark:text-blue-400 mr-1.5">
              {totalAllocatedBudget > 0 ? ((totalSpentBudget / totalAllocatedBudget) * 100).toFixed(0) : 0}% used
            </span>
            <span>of GH₵ {totalAllocatedBudget.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-px overflow-x-auto scrollbar-none">
        {[
          { id: 'treasury', label: 'Holding Accounts & Treasury', icon: Landmark },
          { id: 'ledger', label: 'Income & Expense Ledger', icon: Receipt },
          { id: 'budgets', label: 'Department Budgets', icon: BarChart3 },
          { id: 'counter', label: 'Sunday Cash Counter Sheet', icon: Calculator },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-rose-600 text-rose-600 dark:text-rose-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.id === 'ledger' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                  {filteredFinances.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: TREASURY & HOLDING ACCOUNTS */}
      {activeTab === 'treasury' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {churchAccounts.map((acc) => {
              const isBank = acc.account_type === 'bank';
              const isMoMo = acc.account_type === 'momo';
              const isPetty = acc.account_type === 'cash_petty';

              return (
                <div
                  key={acc.id}
                  className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`p-2 rounded-xl ${
                          isBank
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                            : isMoMo
                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                            : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                        }`}
                      >
                        {isBank ? <Building2 className="w-5 h-5" /> : isMoMo ? <CreditCard className="w-5 h-5" /> : <Banknote className="w-5 h-5" />}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {acc.account_type.replace('_', ' ')}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1">
                      {acc.name}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      {acc.bank_or_provider}
                    </p>
                    {acc.account_number && (
                      <p className="text-[11px] font-mono text-slate-400 mt-1">
                        Acct: {acc.account_number}
                      </p>
                    )}

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Current Balance</span>
                      <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                        GH₵ {acc.current_balance.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div>
                    {acc.description && (
                      <p className="text-[11px] text-slate-500 italic mt-3 line-clamp-2">
                        {acc.description}
                      </p>
                    )}

                    {canAccess('finance') && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            resetIncomeForm(acc.id);
                            setShowRecordIncomeModal(true);
                          }}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          title={`Record institutional income credited into ${acc.name}`}
                        >
                          <TrendingUp className="w-3 h-3" />
                          <span>+ Income</span>
                        </button>
                        <button
                          onClick={() => {
                            resetExpenseForm();
                            setFormAccountId(acc.id);
                            setShowRecordExpenseModal(true);
                          }}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-semibold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          title={`Record expenditure disbursed from ${acc.name}`}
                        >
                          <TrendingDown className="w-3 h-3" />
                          <span>- Expense</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Treasury Actions Banner */}
          <div className="bg-gradient-to-br from-slate-900 via-rose-950 to-slate-900 text-white p-6 rounded-2xl border border-rose-900 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="inline-block px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-[10px] uppercase tracking-wider mb-2">
                Treasury Internal Transfers
              </span>
              <h3 className="text-lg font-bold">
                Rebalance Holding Accounts & Cash Floats
              </h3>
              <p className="text-xs text-slate-300 max-w-xl mt-1 leading-relaxed">
                Move church funds between GCB Bank, MTN MoMo Merchant, and Cathedral Petty Cash. Transfers automatically log two-way debit/credit entries for full council audit compliance.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowTransferModal(true)}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                Execute Transfer →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FINANCIAL LEDGER (INCOME & EXPENDITURES) */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          {/* Filters Toolbar */}
          <div className="flex flex-col lg:flex-row gap-3 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            {/* Transaction Type Segmented Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setLedgerTypeFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  ledgerTypeFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All ({filteredFinances.length})
              </button>
              <button
                type="button"
                onClick={() => setLedgerTypeFilter('income')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  ledgerTypeFilter === 'income'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-800'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>Income ({churchIncomeCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setLedgerTypeFilter('expense')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  ledgerTypeFilter === 'expense'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-rose-700 dark:text-rose-400 hover:text-rose-800'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Expenses ({expendituresCount})</span>
              </button>
            </div>

            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search transaction title, payer/vendor, ref #, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            {/* Account Filter */}
            <select
              value={selectedAccountFilter}
              onChange={(e) => setSelectedAccountFilter(e.target.value)}
              className="px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Holding Accounts</option>
              {churchAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Categories</option>
              {Array.from(new Set([...CHURCH_INCOME_CATEGORIES, ...EXPENSE_CATEGORIES])).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Department Filter */}
            <select
              value={selectedDepartmentFilter}
              onChange={(e) => setSelectedDepartmentFilter(e.target.value)}
              className="px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Departments</option>
              {departmentBudgets.map((b) => (
                <option key={b.id} value={b.department}>
                  {b.department}
                </option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Ref / Voucher #</th>
                    <th className="py-3 px-4">Title / Purpose</th>
                    <th className="py-3 px-4">Payer / Payee</th>
                    <th className="py-3 px-4">Holding Account</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Amount (GH₵)</th>
                    <th className="py-3 px-4">Authorized By</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {displayedFinances.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="font-semibold">No finance records match current filter</p>
                        <p className="text-xs">Adjust your date filter, transaction type, or search query.</p>
                      </td>
                    </tr>
                  ) : (
                    displayedFinances.map((item) => {
                      const isInc = item.transaction_type === 'income' || item.transaction_type === 'grant';
                      const badgeColor = isInc
                        ? INCOME_COLORS[item.category] || '#059669'
                        : EXPENSE_COLORS[item.category] || '#64748b';

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 font-medium text-xs">
                            {item.date}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {isInc ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                <ArrowDownLeft className="w-3 h-3" />
                                Income
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                <ArrowUpRight className="w-3 h-3" />
                                Expense
                              </span>
                            )}
                          </td>
                          <td className={`py-3 px-4 whitespace-nowrap font-mono text-xs font-bold ${isInc ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                            {item.reference_no || '—'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-white text-xs line-clamp-1">
                              {item.title}
                            </div>
                            {item.department && (
                              <div className="text-[10px] text-slate-400 font-medium">{item.department}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-700 dark:text-slate-300">
                            {item.recipient_or_vendor || (isInc ? 'Church Treasury' : 'Authorized Payee')}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
                            {item.account_name}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold text-white"
                              style={{ backgroundColor: badgeColor }}
                            >
                              {item.category}
                            </span>
                          </td>
                          <td className={`py-3 px-4 text-right font-extrabold whitespace-nowrap ${isInc ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                            {isInc ? `+ GH₵ ${item.amount.toFixed(2)}` : `- GH₵ ${item.amount.toFixed(2)}`}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
                            {item.approved_by || settings.senior_pastor}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setSelectedVoucherRecord(item)}
                                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                  isInc
                                    ? 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                                    : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                }`}
                                title={isInc ? 'Print Official Church Income Receipt' : 'Print Official Payment Voucher'}
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              {canAccess('finance') && (
                                <button
                                  onClick={() => {
                                    if (confirm(`Delete ${isInc ? 'income' : 'expenditure'} entry "${item.title}" (GH₵ ${item.amount.toFixed(2)})?`)) {
                                      deleteChurchFinance(item.id);
                                      success('Deleted', `${isInc ? 'Income' : 'Expenditure'} record removed.`);
                                    }
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                                  title="Delete"
                                >
                                  <X className="w-4 h-4" />
                                </button>
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

      {/* TAB 3: DEPARTMENT BUDGETS */}
      {activeTab === 'budgets' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Departmental Budget Allocations
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tracking annual budget burn rates across GWCC ministry departments
              </p>
            </div>
            {canAccess('finance') && (
              <button
                onClick={() => setShowBudgetModal(true)}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-all shadow-xs cursor-pointer"
              >
                + Add / Edit Department Budget
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departmentBudgets.map((bgt) => {
              const allocated = Number(bgt.allocated_amount) || 0;
              const spent = Number(bgt.spent_amount) || 0;
              const remaining = Math.max(0, allocated - spent);
              const pct = allocated > 0 ? (spent / allocated) * 100 : 0;
              const isOver = spent > allocated;

              return (
                <div
                  key={bgt.id}
                  className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {bgt.period}
                      </span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          isOver
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : pct > 80
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}
                      >
                        {pct.toFixed(0)}% Utilized
                      </span>
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                        {bgt.department}
                      </h4>
                      {canAccess('finance') && (
                        <button
                          onClick={() => {
                            setSelectedEditBudget(bgt);
                            setShowBudgetModal(true);
                          }}
                          className="text-xs text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                        >
                          Edit
                        </button>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden mb-3">
                      <div
                        className={`h-2.5 rounded-full ${
                          isOver ? 'bg-rose-600' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Allocated</span>
                        <div className="font-bold text-slate-900 dark:text-white">
                          GH₵ {allocated.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Spent to Date</span>
                        <div className="font-bold text-rose-600 dark:text-rose-400">
                          GH₵ {spent.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {bgt.notes && (
                    <p className="text-[11px] text-slate-500 italic mt-3 line-clamp-2">
                      {bgt.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: SUNDAY CASH COUNTER SHEET */}
      {activeTab === 'counter' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Sunday Cash Counting & Denomination Sheet
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Physical currency counting calculator with counter signatures and instant posting to treasury float
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Grand Total Count</span>
                  <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    GH₵ {cashTotals.grandTotal.toFixed(2)}
                  </div>
                </div>
                {canAccess('finance') && (
                  <button
                    onClick={handlePostCashCount}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                  >
                    Post Cash to Treasury
                  </button>
                )}
              </div>
            </div>

            {/* Denomination Input Table */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Notes Table */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Bank Notes (Paper Currency)</span>
                  <span className="text-emerald-600">Subtotal: GH₵ {cashTotals.notesTotal.toFixed(2)}</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 p-2">
                  {GHANA_DENOMINATIONS.filter((d) => d.type === 'note').map((den) => {
                    const qty = counts[den.value] || 0;
                    const subtotal = qty * den.value;
                    return (
                      <div key={den.value} className="flex items-center justify-between py-2 px-2 text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 w-32">
                          {den.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-[11px]">×</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={qty === 0 ? '' : qty}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setCounts((prev) => ({ ...prev, [den.value]: val }));
                            }}
                            className="w-20 px-2 py-1 text-center font-bold text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                          />
                        </div>
                        <span className="font-mono font-bold text-slate-900 dark:text-white w-24 text-right">
                          GH₵ {subtotal.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Coins Table */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Coins (Pesewas & Cedis)</span>
                    <span className="text-emerald-600">Subtotal: GH₵ {cashTotals.coinsTotal.toFixed(2)}</span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 p-2">
                    {GHANA_DENOMINATIONS.filter((d) => d.type === 'coin').map((den) => {
                      const qty = counts[den.value] || 0;
                      const subtotal = qty * den.value;
                      return (
                        <div key={den.value} className="flex items-center justify-between py-2 px-2 text-xs">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 w-32">
                            {den.label}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-[11px]">×</span>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={qty === 0 ? '' : qty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setCounts((prev) => ({ ...prev, [den.value]: val }));
                              }}
                              className="w-20 px-2 py-1 text-center font-bold text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                            />
                          </div>
                          <span className="font-mono font-bold text-slate-900 dark:text-white w-24 text-right">
                            GH₵ {subtotal.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Counter Verification Signatures */}
                <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Counting Sign-Off
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <input
                      type="text"
                      placeholder="Lead Counter 1 (Name)"
                      value={counter1Name}
                      onChange={(e) => setCounter1Name(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      placeholder="Lead Counter 2 (Name)"
                      value={counter2Name}
                      onChange={(e) => setCounter2Name(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Chief Usher / Supervisor Signature"
                    value={counterSupervisor}
                    onChange={(e) => setCounterSupervisor(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECORD CHURCH INCOME MODAL */}
      {showRecordIncomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <TrendingUp className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Record Church Income</h3>
                  <p className="text-xs text-slate-500">Official institutional revenue, venue rentals, grants & merchandise</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRecordIncomeModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveIncome} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Revenue Title / Purpose *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cathedral Hall Wedding Hire, National Council Subvention, Bookstore Proceeds..."
                  value={incomeTitle}
                  onChange={(e) => setIncomeTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Credit Account & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Credit Holding Account *
                  </label>
                  <select
                    value={incomeAccountId}
                    onChange={(e) => setIncomeAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                  >
                    {churchAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} (Bal: GH₵{acc.current_balance.toFixed(0)})
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
                    min="0.01"
                    placeholder="0.00"
                    required
                    value={incomeAmount}
                    onChange={(e) => setIncomeAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none font-bold text-emerald-700 dark:text-emerald-400"
                  />
                </div>
              </div>

              {/* Category & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Revenue Stream / Category
                  </label>
                  <select
                    value={incomeCategory}
                    onChange={(e) => setIncomeCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                  >
                    {CHURCH_INCOME_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Receiving Department
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Treasury & Accounts, Media, Projects..."
                    value={incomeDepartment}
                    onChange={(e) => setIncomeDepartment(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Payer / Source & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payer / Source / Depositor
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Acheampong Family, General Council, Resource Center..."
                    value={incomeSource}
                    onChange={(e) => setIncomeSource(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Receipt Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={incomeDate}
                    onChange={(e) => setIncomeDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Deposit Mode & Reference # */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Deposit Mode
                  </label>
                  <select
                    value={incomePaymentMethod}
                    onChange={(e) => setIncomePaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="bank_transfer">Bank Wire / Deposit</option>
                    <option value="mobile_money">Mobile Money (MoMo)</option>
                    <option value="cash">Petty Cash / Counter Float</option>
                    <option value="cheque">Bank Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Receipt / Reference #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. REC-2026-081"
                    value={incomeReferenceNo}
                    onChange={(e) => setIncomeReferenceNo(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Received / Acknowledged By
                </label>
                <input
                  type="text"
                  value={incomeReceivedBy}
                  onChange={(e) => setIncomeReceivedBy(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none font-semibold text-emerald-800 dark:text-emerald-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes & Audit Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="Minutes reference, contract remarks or deposit confirmation..."
                  value={incomeNotes}
                  onChange={(e) => setIncomeNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRecordIncomeModal(false)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer"
                >
                  Save & Issue Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD EXPENDITURE MODAL */}
      {showRecordExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                  <Plus className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Record Church Expenditure</h3>
                  <p className="text-xs text-slate-500">Official church disbursement & payment voucher</p>
                </div>
              </div>
              <button
                onClick={() => setShowRecordExpenseModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Expense Purpose / Item Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ECG Power Recharge, Diesel Fuel for 65kVA Generator..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              {/* Holding Account & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Debit Holding Account *
                  </label>
                  <select
                    value={formAccountId}
                    onChange={(e) => setFormAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                  >
                    {churchAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} (Bal: GH₵{acc.current_balance.toFixed(0)})
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

              {/* Category & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Expense Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ministry Department
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Facilities & Maintenance, Media..."
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Vendor & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payee / Vendor / Recipient
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ECG Depot Ablekuma, TotalEnergies..."
                    value={formRecipient}
                    onChange={(e) => setFormRecipient(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Disbursement Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Payment Method & Voucher Ref */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Disbursement Mode
                  </label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="bank_transfer">Bank Wire / Transfer</option>
                    <option value="mobile_money">Mobile Money (MoMo)</option>
                    <option value="cash">Petty Cash / Float</option>
                    <option value="cheque">Bank Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Voucher / Reference #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. VOUCH-2026-092"
                    value={formReferenceNo}
                    onChange={(e) => setFormReferenceNo(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Authorized By
                </label>
                <input
                  type="text"
                  value={formApprovedBy}
                  onChange={(e) => setFormApprovedBy(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none font-semibold text-rose-800 dark:text-rose-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes & Council Approval Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="Minutes reference or purpose notes..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRecordExpenseModal(false)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer"
                >
                  Save & Issue Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD HOLDING ACCOUNT MODAL */}
      {showAddAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <Building2 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">New Holding Account</h3>
                  <p className="text-xs text-slate-500">Bank, MoMo merchant, or cash float</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddAccountModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Account Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ecobank - Welfare Account"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Account Type
                  </label>
                  <select
                    value={newAccType}
                    onChange={(e) => setNewAccType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="bank">Bank Account</option>
                    <option value="momo">MoMo Merchant</option>
                    <option value="cash_petty">Petty Cash Float</option>
                    <option value="treasury">General Treasury</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bank / Provider
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. GCB, CalBank, MTN"
                    value={newAccProvider}
                    onChange={(e) => setNewAccProvider(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Account / Till #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1441002938101"
                    value={newAccNumber}
                    onChange={(e) => setNewAccNumber(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Initial Balance (GH₵)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newAccBalance}
                    onChange={(e) => setNewAccBalance(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Purpose
                </label>
                <textarea
                  rows={2}
                  placeholder="Designated purpose of this holding account..."
                  value={newAccDesc}
                  onChange={(e) => setNewAccDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-xs cursor-pointer"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INTERNAL TRANSFER MODAL */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                  <ArrowRightLeft className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Internal Account Transfer</h3>
                  <p className="text-xs text-slate-500">Move funds between church treasury accounts</p>
                </div>
              </div>
              <button
                onClick={() => setShowTransferModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Source Account (Debit) *
                </label>
                <select
                  value={transferFromId}
                  onChange={(e) => setTransferFromId(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                >
                  {churchAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} — Balance: GH₵{acc.current_balance.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Destination Account (Credit) *
                </label>
                <select
                  value={transferToId}
                  onChange={(e) => setTransferToId(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                >
                  {churchAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} — Balance: GH₵{acc.current_balance.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Transfer Amount (GH₵) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Transfer Purpose & Reference Note
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Replenish Cathedral Petty Cash float from GCB Operations..."
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-bold shadow-xs cursor-pointer"
                >
                  Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAYMENT VOUCHER MODAL */}
      {selectedVoucherRecord && (
        <PaymentVoucherModal
          record={selectedVoucherRecord}
          settings={settings}
          onClose={() => setSelectedVoucherRecord(null)}
        />
      )}

      {/* DEPARTMENT BUDGET MODAL */}
      {showBudgetModal && (
        <DepartmentBudgetModal
          initialBudget={
            selectedEditBudget
              ? {
                  id: selectedEditBudget.id,
                  name: selectedEditBudget.department,
                  allocated: selectedEditBudget.allocated_amount,
                  spent: selectedEditBudget.spent_amount,
                  lead: selectedEditBudget.notes || 'Department Committee',
                }
              : null
          }
          onSave={(b) => {
            if (selectedEditBudget) {
              updateDepartmentBudget(selectedEditBudget.id, {
                department: b.name,
                allocated_amount: b.allocated,
                notes: b.lead,
              });
              success('Budget Updated', `Updated ${b.name} allocation.`);
            } else {
              addDepartmentBudget({
                department: b.name,
                period: `${new Date().getFullYear()} Annual`,
                allocated_amount: b.allocated,
                spent_amount: 0,
                currency: 'GHS',
                notes: b.lead,
              });
              success('Budget Created', `Allocated GH₵ ${b.allocated.toFixed(2)} to ${b.name}.`);
            }
            setShowBudgetModal(false);
            setSelectedEditBudget(null);
          }}
          onClose={() => {
            setShowBudgetModal(false);
            setSelectedEditBudget(null);
          }}
        />
      )}
    </div>
  );
};
