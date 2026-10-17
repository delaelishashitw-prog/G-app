import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Landmark,
  TrendingDown,
  TrendingUp,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  CreditCard,
  Building2,
  Printer,
  Receipt,
  BarChart3,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  FileText,
  ShieldCheck,
  PieChart as PieChartIcon,
  Calculator,
  Building,
  X,
  Banknote,
  Coins,
  Edit3,
  Ban,
  ChevronLeft,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { AnimatedNumber } from '../components/AnimatedNumber';
import {
  ChurchAccount,
  ChurchFinanceRecord,
  PaymentMethod,
} from '../types/database.types';
import { formatGHS } from '../lib/currencyUtils';
import {budgetPeriodRange} from '../lib/budgetPeriod';
import {budgetSpending,validateBudgetAllocation,financeTotals,financeReconciliation,financeCsv,financeReference,financeDateMatches,isCashAccount,validateCashCount,ghanaToday as todayISO,downloadCsvFile} from '../lib/financeViewUtils';
import {money} from '../lib/ledgerUtils';
import {FinanceApprovals} from '../components/finance/FinanceApprovals';
import {financeApprovalLabel,verifiedApprover,isOutbound} from '../lib/financeApprovals';
import {FinanceReconciliation} from '../components/finance/FinanceReconciliation';

// Modals
import { PaymentVoucherModal } from '../components/finance/PaymentVoucherModal';
import { DepartmentBudgetModal } from '../components/finance/DepartmentBudgetModal';
import { EditChurchFinanceModal } from '../components/finance/EditChurchFinanceModal';
import { VoidChurchFinanceModal } from '../components/finance/VoidChurchFinanceModal';

export const DATE_FILTER_LABELS: Record<ChurchFinanceDateFilter, string> = {
  all: 'All Time',
  today: 'Today',
  this_week: 'This Week',
  last_week: 'Last Week',
  this_month: 'This Month',
  last_month: 'Last Month',
  this_year: 'This Year',
  custom: 'Custom Range',
};

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
    departmentBudgets: storedDepartmentBudgets,
    settings,
    services,
    addChurchAccount,
    recordChurchFinance,
    updateChurchFinance,
    transferBetweenAccounts,
    voidChurchFinance,
    addDepartmentBudget,
    updateDepartmentBudget,
  } = useChurchData();

  const { canAccess, currentUser } = useAuth();
  const { success, error, info } = useToast();

  const [activeTab, setActiveTab] = useState<'treasury' | 'ledger' | 'budgets' | 'counter' | 'reconciliation' | 'approvals'>('treasury');
  const [budgetYear,setBudgetYear]=useState(todayISO().slice(0,4));
  const departmentBudgets=useMemo(()=>storedDepartmentBudgets.map(budget=>({...budget,spent_amount:budgetSpending(budget,churchFinances)??0})),[storedDepartmentBudgets,churchFinances]);
  const visibleBudgets=useMemo(()=>departmentBudgets.filter(budget=>budgetPeriodRange(budget.period)?.year===budgetYear),[departmentBudgets,budgetYear]);
  const budgetYears=useMemo(()=>[...new Set([todayISO().slice(0,4),...departmentBudgets.map(budget=>budgetPeriodRange(budget.period)?.year).filter((year):year is string=>Boolean(year))])].sort().reverse(),[departmentBudgets]);
  const reconciliation=useMemo(()=>financeReconciliation(churchAccounts,churchFinances),[churchAccounts,churchFinances]);
  const activeAccounts=useMemo(()=>churchAccounts.filter(account=>account.is_active&&account.currency==='GHS'),[churchAccounts]);
  const cashAccounts=useMemo(()=>churchAccounts.filter(isCashAccount),[churchAccounts]);

  // Filters
  const [dateFilter, setDateFilter] = useState<ChurchFinanceDateFilter>('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountFilter, setSelectedAccountFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState('all');

  // Pagination & Sorting for Ledger
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortColumn, setSortColumn] = useState<'date' | 'amount' | 'reference_no' | 'title'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [showRecordIncomeModal, setShowRecordIncomeModal] = useState(false);
  const [showRecordExpenseModal, setShowRecordExpenseModal] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [selectedEditBudget, setSelectedEditBudget] = useState<any | null>(null);
  const [selectedVoucherRecord, setSelectedVoucherRecord] = useState<ChurchFinanceRecord | null>(null);
  const [editingFinanceRecord, setEditingFinanceRecord] = useState<ChurchFinanceRecord | null>(null);
  const [voidingFinanceRecord, setVoidingFinanceRecord] = useState<ChurchFinanceRecord | null>(null);

  // Form Submitting States
  const [isSubmittingIncome, setIsSubmittingIncome] = useState(false);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

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

  // Form: Request Church Expenditure
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
  const [counterAccountId,setCounterAccountId]=useState('');
  const [counterDate,setCounterDate]=useState(todayISO());
  const [counter1Name, setCounter1Name] = useState('');
  const [counter2Name, setCounter2Name] = useState('');
  const [counterSupervisor, setCounterSupervisor] = useState('');

  // Date Filter Predicate
  const isDateMatchingFilter = (dateStr: string) => financeDateMatches(dateStr,dateFilter,customStartDate,customEndDate);

  // Filtered Finances with Two-Sided Transfer Support and Dynamic Sorting
  const filteredFinances = useMemo(() => {
    const selectedAcc = selectedAccountFilter !== 'all' ? churchAccounts.find((a) => a.id === selectedAccountFilter) : null;
    const selectedAccName = selectedAcc ? selectedAcc.name.toLowerCase() : '';

    return churchFinances
      .filter((item) => {
        if (!isDateMatchingFilter(item.date)) return false;

        if (selectedAccountFilter !== 'all') {
          const isDirectSource = item.account_id === selectedAccountFilter;
          const isDirectDest = item.to_account_id === selectedAccountFilter;
          const isTransferMatch = item.transaction_type === 'transfer' &&
            Boolean(selectedAccName && (item.recipient_or_vendor?.toLowerCase() === selectedAccName || item.notes?.toLowerCase().includes(selectedAccName)));
          if (!isDirectSource && !isDirectDest && !isTransferMatch) return false;
        }

        if (selectedCategoryFilter !== 'all' && item.category !== selectedCategoryFilter) return false;
        if (selectedDepartmentFilter !== 'all' && item.department !== selectedDepartmentFilter) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const title = (item.title || '').toLowerCase();
          const recipient = (item.recipient_or_vendor || '').toLowerCase();
          const refNo = (item.reference_no || '').toLowerCase();
          const notes = (item.notes || '').toLowerCase();
          const desc = (item.description || '').toLowerCase();
          const voidRes = (item.void_reason || '').toLowerCase();
          return (
            item.id.toLowerCase().includes(q) ||
            title.includes(q) ||
            recipient.includes(q) ||
            refNo.includes(q) ||
            notes.includes(q) ||
            desc.includes(q) ||
            voidRes.includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        let comp = 0;
        if (sortColumn === 'date') {
          comp = new Date(b.date).getTime() - new Date(a.date).getTime();
        } else if (sortColumn === 'amount') {
          comp = b.amount - a.amount;
        } else if (sortColumn === 'reference_no') {
          comp = (b.reference_no || '').localeCompare(a.reference_no || '');
        } else if (sortColumn === 'title') {
          comp = b.title.localeCompare(a.title);
        }
        return sortDirection === 'desc' ? comp : -comp;
      });
  }, [churchFinances, dateFilter, customStartDate, customEndDate, selectedAccountFilter, selectedCategoryFilter, selectedDepartmentFilter, searchQuery, sortColumn, sortDirection, churchAccounts]);

  // Total Available Liquidity across all accounts (Point-in-time active treasury)
  const totalLiquidity = useMemo(() => {
    return churchAccounts
      .filter((a) => a.is_active && a.currency==='GHS')
      .reduce((sum, a) => sum + (Number(a.current_balance) || 0), 0);
  }, [churchAccounts]);

  const periodTotals=useMemo(()=>financeTotals(filteredFinances),[filteredFinances]);
  const totalChurchIncome=periodTotals.income,churchIncomeCount=periodTotals.incomeCount;
  const totalExpenditures=periodTotals.expenditure,expendituresCount=periodTotals.expenditureCount;
  const netCashFlow=periodTotals.net;

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

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(displayedFinances.length / pageSize));
  const validPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedFinances = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    return displayedFinances.slice(start, start + pageSize);
  }, [displayedFinances, validPage, pageSize]);

  // Toggle Column Sort
  const handleSort = (column: 'date' | 'amount' | 'reference_no' | 'title') => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  // Department Budget Utilization Aggregates
  const totalAllocatedBudget = useMemo(() => {
    return visibleBudgets.reduce((sum, b) => sum + (Number(b.allocated_amount) || 0), 0);
  }, [visibleBudgets]);

  const totalSpentBudget = useMemo(() => {
    return visibleBudgets.reduce((sum, b) => sum + (Number(b.spent_amount) || 0), 0);
  }, [visibleBudgets]);

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
    if (isSubmittingExpense) return;

    const parsedAmt = Number(formAmount);
    if (!Number.isFinite(parsedAmt) || parsedAmt <= 0) {
      error('Invalid Amount', 'Please provide a valid expenditure amount.');
      return;
    }
    const amountNum = Math.round(parsedAmt * 100) / 100;

    if (churchAccounts.length === 0) {
      error('No Holding Account', 'Please add a church account before recording an expenditure.');
      return;
    }

    const selectedAcc = activeAccounts.find((a) => a.id === formAccountId);
    if(!selectedAcc){error('Select Account','Select an active GHS holding account.');return;}
    const accName = selectedAcc ? selectedAcc.name : 'Main Operations Account';

    const voucherId = formReferenceNo.trim() || undefined;

    setIsSubmittingExpense(true);
    try {
      recordChurchFinance({
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
        notes: formNotes.trim() || undefined,
        recorded_by: currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Finance Secretariat',
        status: 'pending',
      });

      info('Payment request saved', `${formatGHS(amountNum)} awaits cloud confirmation and independent approval. No payment has been posted.`);
      setShowRecordExpenseModal(false);
      resetExpenseForm();

      // Open the queue; unpaid requests cannot issue a payment voucher.
      setActiveTab('approvals');
    } catch(cause){error('Expenditure not recorded',(cause as Error).message);
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  const resetExpenseForm = () => {
    setFormTitle('');
    setFormTransactionType('expense');
    setFormAccountId(activeAccounts[0]?.id || '');
    setFormCategory(EXPENSE_CATEGORIES[0]);
    setFormDepartment('Facilities & Maintenance');
    setFormRecipient('');
    setFormAmount('');
    setFormDate(todayISO());
    setFormPaymentMethod('bank_transfer');
    setFormReferenceNo('');

    setFormNotes('');
  };

  // Handle Save Church Income
  const handleSaveIncome = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingIncome) return;

    const parsedAmt = Number(incomeAmount);
    if (!Number.isFinite(parsedAmt) || parsedAmt <= 0) {
      error('Invalid Amount', 'Please provide a valid income amount.');
      return;
    }
    const amountNum = Math.round(parsedAmt * 100) / 100;

    if (churchAccounts.length === 0) {
      error('No Holding Account', 'Please add a church account before recording income.');
      return;
    }

    const selectedAcc = activeAccounts.find((a) => a.id === incomeAccountId);
    if(!selectedAcc){error('Select Account','Select an active GHS holding account.');return;}
    const accName = selectedAcc ? selectedAcc.name : 'Main Operations Account';
    const refId = incomeReferenceNo.trim() || undefined;

    setIsSubmittingIncome(true);
    try {
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

      info('Income awaiting confirmation', `${formatGHS(amountNum)} recorded locally for ${accName}. Follow sync status for cloud confirmation.`);
      setShowRecordIncomeModal(false);
      resetIncomeForm();

      // Offer receipt preview
      setSelectedVoucherRecord(newRec);
    } catch(cause){error('Income not recorded',(cause as Error).message);
    } finally {
      setIsSubmittingIncome(false);
    }
  };

  const resetIncomeForm = (targetAccountId?: string) => {
    setIncomeTitle('');
    setIncomeAccountId(targetAccountId || activeAccounts[0]?.id || '');
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

    try {
    const initialBal = money(newAccBalance.trim()?Number(newAccBalance):0);
    if(initialBal<0)throw new Error('Enter a non-negative verified opening balance.');
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

    info('Account awaiting confirmation', `The ${newAccName} account is recorded locally. Follow sync status for cloud confirmation.`);
    setShowAddAccountModal(false);
    setNewAccName('');
    setNewAccNumber('');
    setNewAccBalance('');
    setNewAccDesc('');
    }catch(cause){error('Account not recorded',(cause as Error).message);}
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
      info('Transfer awaiting confirmation', res.message);
      setShowTransferModal(false);
      setTransferAmount('');
      setTransferNotes('');
      setActiveTab('approvals');
    } else {
      error('Transfer Failed', res.message);
    }
  };

  // The physical cash sheet is linked to its exact service/date and cash account.
  const handlePostCashCount = () => {
    try {
      const count=validateCashCount({accountId:counterAccountId,serviceId:counterServiceId,date:counterDate,counter1:counter1Name,counter2:counter2Name,supervisor:counterSupervisor,counts},churchAccounts,services,churchFinances);
      const service=services.find(row=>row.id===counterServiceId)!;
      recordChurchFinance({transaction_type:'income',account_id:count.account.id,account_name:count.account.name,
        category:'Sunday Cash Counter',title:`Cash Tally - ${service.name}`,recipient_or_vendor:'Counting Committee',
        amount:count.amount,currency:'GHS',date:counterDate,payment_method:'cash',department:'Treasury & Accounts',
        cash_count_service_id:service.id,cash_count_key:count.key,cash_count_details:count.details,
        approved_by:counterSupervisor.trim(),notes:`Counted by ${counter1Name.trim()} and ${counter2Name.trim()}. Supervisor: ${counterSupervisor.trim()}.`,
        recorded_by:`${currentUser.first_name} ${currentUser.last_name}`,status:'completed'});
      info('Cash count awaiting confirmation',`${formatGHS(count.amount)} recorded locally for ${count.account.name}. Follow sync status for cloud confirmation.`);
      setCounts(Object.fromEntries(Object.keys(counts).map(key=>[key,0])));
    } catch(cause){error('Cash count not recorded',(cause as Error).message);}
  };

  // CSV Export
  const exportRows=activeTab==='ledger'?displayedFinances:filteredFinances;
  const exportTotals=financeTotals(exportRows);
  const handleExportFinanceCSV = () => {
    if(!exportRows.length){info('No Records','No finance records match the current view.');return;}
    downloadCsvFile(financeCsv(exportRows),`GWCC_Church_Finance_${dateFilter}_${todayISO()}.csv`);
    success('CSV Exported',`Exported ${exportRows.length} transactions from the current view.`);
  };

  // Professional PDF Export
  const handleExportFinancePDF = () => {
    if (exportRows.length === 0) {
      info('No Records', 'No transactions found for the selected period.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
    const periodLabel = dateFilter === 'custom'
      ? `${customStartDate || 'Start'} to ${customEndDate || 'End'}`
      : DATE_FILTER_LABELS[dateFilter];

    // Header
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('GREATER WORKS CITY CHURCH (GWCC)', 14, 16);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Joma New Site, Off Ablekuma-Joma Highway, Accra, Ghana | "Exceeding Abundantly Above All We Ask or Think"', 14, 22);
    doc.text(`OFFICIAL CHURCH FINANCIAL STATEMENT & TREASURY LEDGER • REPORTING PERIOD: ${periodLabel.toUpperCase()}`, 14, 27);

    // Summary box
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 31, 269, 18, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('RECORDED BALANCE (ALL ACCOUNTS)', 20, 38);
    doc.text('PERIOD CHURCH INCOME', 90, 38);
    doc.text('PERIOD DISBURSEMENTS', 160, 38);
    doc.text('NET OPERATING CASH FLOW', 230, 38);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`GHS  ${totalLiquidity.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 20, 45);
    doc.setTextColor(5, 150, 105);
    doc.text(`GHS  ${exportTotals.income.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 90, 45);
    doc.setTextColor(225, 29, 72);
    doc.text(`GHS  ${exportTotals.expenditure.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 160, 45);
    doc.setTextColor(exportTotals.net >= 0 ? 13 : 217, exportTotals.net >= 0 ? 148 : 119, exportTotals.net >= 0 ? 136 : 6);
    doc.text(`${exportTotals.net >= 0 ? '+' : '-'}GHS  ${Math.abs(exportTotals.net).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 230, 45);

    doc.setFontSize(8);doc.setTextColor(100,116,139);
    doc.text(`View: ${activeTab==='ledger'?ledgerTypeFilter:'all'} | Account: ${selectedAccountFilter==='all'?'All':churchAccounts.find(a=>a.id===selectedAccountFilter)?.name||selectedAccountFilter}`,14,54);
    doc.text(reconciliation.pending?'Local changes await cloud confirmation. Verify sync status before relying on this report.':reconciliation.unresolved.length||reconciliation.missingAccounts.length?'Historical records need reconciliation. Verify balances against statements and physical cash.':'Recorded balances should be checked against statements and physical cash.',14,59);

    // Table
    const tableData = exportRows.map((item) => [
      item.date,
      item._sync_status==='pending'?'AWAITING CLOUD':item.approval_state?financeApprovalLabel(item):item.status!=='completed'?item.status.toUpperCase():(item.transaction_type === 'income' || item.transaction_type === 'grant')
        ? 'Income'
        : item.transaction_type === 'transfer'
        ? 'Transfer'
        : 'Expense',
      financeReference(item),
      item.title,
      item.recipient_or_vendor || (item.transaction_type === 'income' ? 'Church Treasury' : 'Authorized Payee'),
      item.transaction_type==='transfer'?`${item.account_name} -> ${item.to_account_name||item.to_account_id||'Unknown destination'}`:item.account_name,
      item.category,
      `${item.transaction_type==='transfer'?'':(item.transaction_type==='income'||item.transaction_type==='grant')?'+':'-'} GHS ${item.amount.toFixed(2)}${item.status==='voided'?' (VOID)':''}`,
      isOutbound(item)?verifiedApprover(item):item.approved_by||'Not recorded',
    ]);

    autoTable(doc, {
      startY: 64,
      head: [['Date', 'Type', 'Voucher #', 'Title / Purpose', 'Payer / Payee', 'Account', 'Category', 'Amount (GHS)', 'Authorized By']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [225, 29, 72],
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: 30,
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
      styles: {
        overflow: 'linebreak',
        cellPadding: 2,
      },
      margin: { left: 14, right: 14 },
      didDrawPage: () => {
        const str = `Page ${doc.getNumberOfPages()} • Generated on ${new Date().toLocaleDateString('en-GB')} by ${currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Church Accounts'} • Greater Works City Church`;
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(str, 14, doc.internal.pageSize.height - 8);
      },
    });

    doc.save(`GWCC_Financial_Statement_${dateFilter}_${todayISO()}.pdf`);
    success('PDF Generated', `Exported official financial statement (${exportRows.length} records).`);
  };

  const handleUpdateFinance = (updates: Partial<ChurchFinanceRecord>) => {
    if (!editingFinanceRecord) return;
    updateChurchFinance(editingFinanceRecord.id, updates);
    info('Update awaiting confirmation', 'The correction is recorded locally. Follow sync status for cloud confirmation.');
    setEditingFinanceRecord(null);
  };

  const handleVoidFinance = (reason: string) => {
    if (!voidingFinanceRecord) return;
    voidChurchFinance(voidingFinanceRecord.id, reason);
    info('Void awaiting confirmation', 'The reversal is recorded locally. Follow sync status for cloud confirmation.');
    setVoidingFinanceRecord(null);
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
                <span>Request Expenditure</span>
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
            <span>Export CSV</span>
          </button>
          <button type="button" onClick={handleExportFinancePDF} className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 text-xs sm:text-sm font-medium">
            <FileText className="w-4 h-4"/><span>Export PDF</span>
          </button>

        </div>
      </div>

      {/* Date Filter Ribbon */}
      {(reconciliation.unresolved.length>0||reconciliation.missingAccounts.length>0||reconciliation.duplicateReferences.length>0)&&<div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex flex-wrap items-center justify-between gap-2"><span>Historical finance records need reconciliation. Verify recorded balances against actual bank, MoMo and cash figures.</span><button type="button" onClick={()=>setActiveTab('reconciliation')} className="underline font-semibold">Review reconciliation</button></div>}
      {reconciliation.pending&&<p role="status" className="text-sm rounded-lg bg-amber-50 border border-amber-200 p-3">Recorded balances and totals include local changes awaiting cloud confirmation.</p>}
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
            <span className="text-xs font-semibold uppercase tracking-wider">Recorded Balance</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            GH₵ <AnimatedNumber value={totalLiquidity} decimals={2} />
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
            GH₵ <AnimatedNumber value={totalChurchIncome} decimals={2} />
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
            GH₵ <AnimatedNumber value={totalExpenditures} decimals={2} />
          </div>
          <div className="mt-2 flex items-center text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-rose-600 dark:text-rose-400 mr-1.5">
              {expendituresCount} vouchers
            </span>
            <span>recorded expenses</span>
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
            {netCashFlow >= 0 ? '+' : '-'}GH₵ <AnimatedNumber value={Math.abs(netCashFlow)} decimals={2} />
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
            <span className="text-xs font-semibold uppercase tracking-wider">Budgets Spent ({budgetYear})</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            GH₵ <AnimatedNumber value={totalSpentBudget} decimals={2} />
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
          { id: 'approvals', label: 'Approvals & Payments', icon: ShieldCheck },
          { id: 'budgets', label: 'Department Budgets', icon: BarChart3 },
          { id: 'reconciliation', label: 'Reconciliation', icon: ShieldCheck },
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

      {activeTab==='approvals'&&<FinanceApprovals key={currentUser.id}/>}

      {/* TAB 1: TREASURY & HOLDING ACCOUNTS */}
      {activeTab === 'treasury' && (
        <div className="space-y-6">
          {churchAccounts.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
              <Landmark className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <h4 className="text-base font-bold text-slate-900 dark:text-white">No Holding Accounts Configured</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-4">
                Add your church's operating bank accounts (e.g. GCB Bank, Ecobank), MTN MoMo Merchant wallets, or petty cash floats to begin tracking balances and recording transactions.
              </p>
              {canAccess('finance') && (
                <button
                  onClick={() => setShowAddAccountModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Church Account</span>
                </button>
              )}
            </div>
          ) : (
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
          )}

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
                Move church funds between GCB Bank, MTN MoMo Merchant, and Cathedral Petty Cash. Transfers need independent approval. Both account balances update when the completed transfer is recorded as paid.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowTransferModal(true)}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                Request Transfer →
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
                <span>Income ({filteredFinances.filter(row=>['income','grant'].includes(row.transaction_type)).length})</span>
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
                <span>Expenses ({filteredFinances.filter(row=>['expense','disbursement'].includes(row.transaction_type)).length})</span>
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
                        <p className="font-semibold text-slate-700 dark:text-slate-200">
                          {churchFinances.length === 0
                            ? 'Your financial ledger is clean and ready'
                            : 'No finance records match current filter'}
                        </p>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                          {churchFinances.length === 0
                            ? 'Start recording institutional church income (rentals, grants, sales) or operational expenditures.'
                            : 'Adjust your date filter, transaction type, or search query.'}
                        </p>
                        {churchFinances.length === 0 && canAccess('finance') && (
                          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                resetIncomeForm();
                                setShowRecordIncomeModal(true);
                              }}
                              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                            >
                              <Plus className="w-4 h-4" />
                              <span>Record Church Income</span>
                            </button>
                            <button
                              onClick={() => {
                                resetExpenseForm();
                                setShowRecordExpenseModal(true);
                              }}
                              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                            >
                              <Plus className="w-4 h-4" />
                              <span>Request Expenditure</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    paginatedFinances.map((item) => {
                      const isVoid = item.status === 'voided';
                      const isTransfer = item.transaction_type === 'transfer';
                      const isInc = item.transaction_type === 'income' || item.transaction_type === 'grant';
                      const badgeColor = isInc
                        ? INCOME_COLORS[item.category] || '#059669'
                        : EXPENSE_COLORS[item.category] || '#64748b';

                      return (
                        <tr
                          key={item.id}
                          className={`transition-colors ${
                            isVoid
                              ? 'bg-slate-50/50 dark:bg-slate-900/60 opacity-60 line-through decoration-slate-400'
                              : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="py-3 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 font-medium text-xs">
                            {item.date}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap no-underline">
                            {isVoid ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                title={`Voided by: ${item.voided_by || 'Church Finance'}. Reason: ${item.void_reason || 'Administrative void'}`}
                              >
                                <Ban className="w-3 h-3" />
                                VOIDED
                              </span>
                            ) : isTransfer ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                                <ArrowRightLeft className="w-3 h-3" />
                                Transfer
                              </span>
                            ) : isInc ? (
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
                            {item._sync_status==='pending'&&<span className="block text-[10px] font-semibold text-amber-800 mt-1">Awaiting cloud confirmation</span>}
                            {!['completed','voided'].includes(item.status)&&<span className="block text-[10px] font-semibold text-amber-800 mt-1">{financeApprovalLabel(item)} · not posted</span>}
                          </td>
                          <td className={`py-3 px-4 whitespace-nowrap font-mono text-xs font-bold ${isVoid ? 'text-slate-400' : isInc ? 'text-emerald-700 dark:text-emerald-400' : isTransfer ? 'text-purple-700 dark:text-purple-400' : 'text-rose-700 dark:text-rose-400'}`}>
                            {financeReference(item)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-white text-xs line-clamp-1">
                              {item.title}
                            </div>
                            {item.department && (
                              <div className="text-[10px] text-slate-400 font-medium">{item.department}</div>
                            )}
                            {isVoid && item.void_reason && (
                              <div className="text-[10px] text-rose-600 dark:text-rose-400 font-medium italic mt-0.5 no-underline">
                                Reason: {item.void_reason} (by {item.voided_by || 'Finance Secretariat'})
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-700 dark:text-slate-300">
                            {isTransfer
                              ? `To: ${item.to_account_name || item.recipient_or_vendor || 'Destination'}`
                              : item.recipient_or_vendor || (isInc ? 'Church Treasury' : 'Authorized Payee')}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
                            {item.account_name}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap no-underline">
                            <span
                              className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold text-white"
                              style={{ backgroundColor: badgeColor }}
                            >
                              {item.category}
                            </span>
                          </td>
                          <td className={`py-3 px-4 text-right font-extrabold whitespace-nowrap ${
                            isVoid
                              ? 'text-slate-400'
                              : isTransfer
                              ? 'text-purple-600 dark:text-purple-400'
                              : isInc
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-900 dark:text-white'
                          }`}>
                            {isVoid
                              ? `GH₵ ${item.amount.toFixed(2)} (VOID)`
                              : isTransfer
                              ? `GH₵ ${item.amount.toFixed(2)}`
                              : isInc
                              ? `+ GH₵ ${item.amount.toFixed(2)}`
                              : `- GH₵ ${item.amount.toFixed(2)}`}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
                            {isInc?item.approved_by||'Not recorded':verifiedApprover(item)}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap no-underline">
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

                              {canAccess('finance') && !isVoid && !isTransfer && !isOutbound(item) && !item.approval_state && (
                                <button
                                  onClick={() => setEditingFinanceRecord(item)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all cursor-pointer"
                                  title="Edit / Correct Transaction Details"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                              )}

                              {canAccess('finance') && !isVoid && !item.approval_state && (
                                <button
                                  onClick={() => setVoidingFinanceRecord(item)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-all cursor-pointer"
                                  title="Void Transaction (Reverses Balance with Audit Trail)"
                                >
                                  <Ban className="w-4 h-4" />
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

            {/* Pagination Controls */}
            {displayedFinances.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <span>
                    Showing {displayedFinances.length === 0 ? 0 : (validPage - 1) * pageSize + 1} to{' '}
                    {Math.min(validPage * pageSize, displayedFinances.length)} of {displayedFinances.length} records
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <label className="flex items-center gap-1.5">
                    <span>Per page:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </label>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={validPage <= 1}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>

                  <div className="flex items-center gap-1 px-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - validPage) <= 1)
                      .map((p, idx, arr) => {
                        const prev = arr[idx - 1];
                        return (
                          <React.Fragment key={p}>
                            {prev && p - prev > 1 && <span className="px-1 text-slate-400">...</span>}
                            <button
                              onClick={() => setCurrentPage(p)}
                              className={`w-7 h-7 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                                validPage === p
                                  ? 'bg-rose-600 text-white shadow-2xs'
                                  : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {p}
                            </button>
                          </React.Fragment>
                        );
                      })}
                  </div>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={validPage >= totalPages}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer flex items-center gap-1"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DEPARTMENT BUDGETS */}
      {activeTab === 'budgets' && (
        <div className="space-y-6">
          {departmentBudgets.filter(budget=>!budgetPeriodRange(budget.period)).map(budget=><div role="alert" key={budget.id} className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm">The {budget.department} budget needs a valid period before usage can be calculated. <button type="button" className="underline" onClick={()=>{setSelectedEditBudget(budget);setShowBudgetModal(true);}}>Review budget period</button></div>)}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Departmental Budget Allocations
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Usage is calculated from recorded expenses within each budget period and currency.
              </p>
            </div>
            <label className="text-xs font-semibold">Budget year<select aria-label="Budget year" value={budgetYear} onChange={e=>setBudgetYear(e.target.value)} className="ml-2 rounded-lg border p-2">{budgetYears.map(year=><option key={year} value={year}>{year}</option>)}</select></label>
            {canAccess('finance') && (
              <button
                onClick={() => setShowBudgetModal(true)}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-all shadow-xs cursor-pointer"
              >
                + Add / Edit Department Budget
              </button>
            )}
          </div>

          {visibleBudgets.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
              <BarChart3 className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <h4 className="text-base font-bold text-slate-900 dark:text-white">No Budgets for This Year</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-4">
                Establish annual departmental budget allocations for Sound & Media, Facilities, Welfare, and Children Ministry to track operational spending.
              </p>
              {canAccess('finance') && (
                <button
                  onClick={() => setShowBudgetModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Department Budget</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleBudgets.map((bgt) => {
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
          )}
        </div>
      )}

      {/* TAB 4: SUNDAY CASH COUNTER SHEET */}
      {activeTab==='reconciliation'&&<FinanceReconciliation accounts={churchAccounts} records={churchFinances}
        onAccount={id=>{setSelectedAccountFilter(id);setSearchQuery('');setDateFilter('all');setSelectedCategoryFilter('all');setSelectedDepartmentFilter('all');setLedgerTypeFilter('all');setCurrentPage(1);setActiveTab('ledger');}}
        onRecord={id=>{setSelectedAccountFilter('all');setSearchQuery(id);setDateFilter('all');setSelectedCategoryFilter('all');setSelectedDepartmentFilter('all');setLedgerTypeFilter('all');setCurrentPage(1);setActiveTab('ledger');}}
        onReference={reference=>{setSelectedAccountFilter('all');setSearchQuery(reference);setDateFilter('all');setSelectedCategoryFilter('all');setSelectedDepartmentFilter('all');setLedgerTypeFilter('all');setCurrentPage(1);setActiveTab('ledger');}}/>}
      {activeTab === 'counter' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <p className="text-sm text-slate-600">Post one denomination sheet per service and date to its selected cash account. Verify counters and the physical total before posting.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-semibold">Cash holding account<select aria-label="Cash holding account" required value={counterAccountId} onChange={e=>setCounterAccountId(e.target.value)} className="block w-full border rounded-lg p-2 mt-1"><option value="">Select cash account</option>{cashAccounts.map(account=><option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
              <label className="text-xs font-semibold">Counted service<select aria-label="Counted service" required value={counterServiceId} onChange={e=>setCounterServiceId(e.target.value)} className="block w-full border rounded-lg p-2 mt-1"><option value="">Select service</option>{services.filter(service=>service.is_active===true).map(service=><option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
              <label className="text-xs font-semibold">Cash-count date<input aria-label="Cash-count date" type="date" required max={todayISO()} value={counterDate} onChange={e=>setCounterDate(e.target.value)} className="block w-full border rounded-lg p-2 mt-1"/></label>
            </div>
            {!cashAccounts.length&&<div role="alert" className="text-sm text-amber-900 bg-amber-50 rounded p-3">Add an active GHS cash account before posting a physical cash count. <button type="button" className="underline font-semibold" onClick={()=>{setNewAccType('cash_petty');setNewAccProvider('Cash on Hand');setShowAddAccountModal(true);}}>Add cash account</button></div>}
          </div>
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Sunday Cash Counting & Denomination Sheet
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Physical currency count with named counters, supervisor and cloud confirmation
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
                    disabled={!cashAccounts.length}
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
                            aria-label={`${den.label} quantity`}
                            step="1"
                            min="0"
                            placeholder="0"
                            value={qty === 0 ? '' : qty}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : Number(e.target.value);
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
                              aria-label={`${den.label} quantity`}
                              step="1"
                              min="0"
                              placeholder="0"
                              value={qty === 0 ? '' : qty}
                              onChange={(e) => {
                                const val = e.target.value === '' ? 0 : Number(e.target.value);
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
                      aria-label="First counter name"
                      value={counter1Name}
                      onChange={(e) => setCounter1Name(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      placeholder="Lead Counter 2 (Name)"
                      aria-label="Second counter name"
                      value={counter2Name}
                      onChange={(e) => setCounter2Name(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Supervisor name"
                    aria-label="Cash-count supervisor name"
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
                <label htmlFor="church-finance-field-1" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Revenue Title / Purpose *
                </label>
                <input id="church-finance-field-1"
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
                  <label htmlFor="church-finance-field-2" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Credit Holding Account *
                  </label>
                  {activeAccounts.length === 0 ? (
                    <div className="p-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
                      <span className="text-[11px]">No accounts exist yet.</span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowRecordIncomeModal(false);
                          setShowAddAccountModal(true);
                        }}
                        className="px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[10px] shrink-0"
                      >
                        + Add Account
                      </button>
                    </div>
                  ) : (
                    <select id="church-finance-field-2"
                      value={incomeAccountId}
                      onChange={(e) => setIncomeAccountId(e.target.value)}
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                    >
                      {activeAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} (Bal: GH₵{acc.current_balance.toFixed(0)})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label htmlFor="church-finance-field-3" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Amount (GH₵) *
                  </label>
                  <input id="church-finance-field-3"
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
                  <label htmlFor="church-finance-field-4" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Revenue Stream / Category
                  </label>
                  <select id="church-finance-field-4"
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
                  <label htmlFor="church-finance-field-5" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Receiving Department
                  </label>
                  <input id="church-finance-field-5"
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
                  <label htmlFor="church-finance-field-6" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payer / Source / Depositor
                  </label>
                  <input id="church-finance-field-6"
                    type="text"
                    placeholder="e.g. Dr. Acheampong Family, General Council, Resource Center..."
                    value={incomeSource}
                    onChange={(e) => setIncomeSource(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="church-finance-field-7" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Receipt Date *
                  </label>
                  <input id="church-finance-field-7"
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
                  <label htmlFor="church-finance-field-8" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Deposit Mode
                  </label>
                  <select id="church-finance-field-8"
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
                  <label htmlFor="church-finance-field-9" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Receipt / Reference #
                  </label>
                  <input id="church-finance-field-9"
                    type="text"
                    placeholder="e.g. REC-2026-081"
                    value={incomeReferenceNo}
                    onChange={(e) => setIncomeReferenceNo(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="church-finance-field-10" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Received / Acknowledged By
                </label>
                <input id="church-finance-field-10"
                  type="text"
                  value={incomeReceivedBy}
                  onChange={(e) => setIncomeReceivedBy(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none font-semibold text-emerald-800 dark:text-emerald-300"
                />
              </div>

              <div>
                <label htmlFor="church-finance-field-11" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes & Audit Remarks
                </label>
                <textarea id="church-finance-field-11"
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
                  disabled={isSubmittingIncome}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer"
                >
                  {isSubmittingIncome ? 'Recording...' : 'Save & Issue Receipt'}
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
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Request Church Expenditure</h3>
                  <p className="text-xs text-slate-500">Submit for independent approval before recording payment</p>
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
                <label htmlFor="church-finance-field-12" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Expense Purpose / Item Title *
                </label>
                <input id="church-finance-field-12"
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
                  <label htmlFor="church-finance-field-13" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Debit Holding Account *
                  </label>
                  <select id="church-finance-field-13"
                    value={formAccountId}
                    onChange={(e) => setFormAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                  >
                    {activeAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} (Bal: GH₵{acc.current_balance.toFixed(0)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="church-finance-field-14" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Amount (GH₵) *
                  </label>
                  <input id="church-finance-field-14"
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
                  <label htmlFor="church-finance-field-15" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Expense Category
                  </label>
                  <select id="church-finance-field-15"
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
                  <label htmlFor="church-finance-field-16" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ministry Department
                  </label>
                  <input id="church-finance-field-16"
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
                  <label htmlFor="church-finance-field-17" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payee / Vendor / Recipient
                  </label>
                  <input id="church-finance-field-17"
                    type="text"
                    placeholder="e.g. ECG Depot Ablekuma, TotalEnergies..."
                    value={formRecipient}
                    onChange={(e) => setFormRecipient(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="church-finance-field-18" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Disbursement Date *
                  </label>
                  <input id="church-finance-field-18"
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
                  <label htmlFor="church-finance-field-19" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Disbursement Mode
                  </label>
                  <select id="church-finance-field-19"
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
                  <label htmlFor="church-finance-field-20" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Voucher / Reference #
                  </label>
                  <input id="church-finance-field-20"
                    type="text"
                    placeholder="e.g. VOUCH-2026-092"
                    value={formReferenceNo}
                    onChange={(e) => setFormReferenceNo(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-300">Your signed-in account will be recorded as the requester. A different finance staff member must approve this request before payment can be recorded.</p>

              <div>
                <label htmlFor="church-finance-field-22" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes & Council Approval Remarks
                </label>
                <textarea id="church-finance-field-22"
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
                  disabled={isSubmittingExpense}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer"
                >
                  {isSubmittingExpense ? 'Saving...' : 'Submit Payment Request'}
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
                <label htmlFor="church-finance-field-23" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Account Name *
                </label>
                <input id="church-finance-field-23"
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
                  <label htmlFor="church-finance-field-24" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Account Type
                  </label>
                  <select id="church-finance-field-24"
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
                  <label htmlFor="church-finance-field-25" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bank / Provider
                  </label>
                  <input id="church-finance-field-25"
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
                  <label htmlFor="church-finance-field-26" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Account / Till #
                  </label>
                  <input id="church-finance-field-26"
                    type="text"
                    placeholder="e.g. 1441002938101"
                    value={newAccNumber}
                    onChange={(e) => setNewAccNumber(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="church-finance-field-27" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Initial Balance (GH₵)
                  </label>
                  <input id="church-finance-field-27"
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
                <label htmlFor="church-finance-field-28" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Purpose
                </label>
                <textarea id="church-finance-field-28"
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
                <label htmlFor="church-finance-field-29" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Source Account (Debit) *
                </label>
                <select id="church-finance-field-29"
                  value={transferFromId}
                  onChange={(e) => setTransferFromId(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="">Select holding account</option>
                  {activeAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} — Balance: GH₵{acc.current_balance.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="church-finance-field-30" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Destination Account (Credit) *
                </label>
                <select id="church-finance-field-30"
                  value={transferToId}
                  onChange={(e) => setTransferToId(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="">Select holding account</option>
                  {activeAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} — Balance: GH₵{acc.current_balance.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="church-finance-field-31" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Transfer Amount (GH₵) *
                </label>
                <input id="church-finance-field-31"
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
                <label htmlFor="church-finance-field-32" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Transfer Purpose & Reference Note
                </label>
                <textarea id="church-finance-field-32"
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
                  Submit Transfer Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAYMENT VOUCHER MODAL */}
      {selectedVoucherRecord && (
        <PaymentVoucherModal
          record={churchFinances.find(row=>row.id===selectedVoucherRecord.id)||selectedVoucherRecord}
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
                  period:selectedEditBudget.period,
                }
              : null
          }
          onSave={(b) => {
            validateBudgetAllocation({id:selectedEditBudget?.id,department:b.name,period:b.period,allocated_amount:b.allocated,currency:selectedEditBudget?.currency||'GHS'},storedDepartmentBudgets);
            if (selectedEditBudget) {
              updateDepartmentBudget(selectedEditBudget.id, {
                department: b.name,
                allocated_amount: b.allocated,
                notes: b.lead,
                period:b.period,
              });
              info('Budget update awaiting confirmation', `The ${b.name} allocation is recorded locally. Follow sync status for cloud confirmation.`);
            } else {
              addDepartmentBudget({
                department: b.name,
                period: b.period,
                allocated_amount: b.allocated,
                spent_amount: 0,
                currency: 'GHS',
                notes: b.lead,
              });
              info('Budget awaiting confirmation', `The ${b.name} budget is recorded locally. Follow sync status for cloud confirmation.`);
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

      {/* EDIT CHURCH FINANCE MODAL */}
      {editingFinanceRecord && (
        <EditChurchFinanceModal
          record={editingFinanceRecord}
          churchAccounts={activeAccounts}
          seniorPastor={settings.senior_pastor || 'Prophet Elisha K. Richard'}
          onSave={handleUpdateFinance}
          onClose={() => setEditingFinanceRecord(null)}
        />
      )}

      {/* VOID CHURCH FINANCE MODAL */}
      {voidingFinanceRecord && (
        <VoidChurchFinanceModal
          record={voidingFinanceRecord}
          onVoid={handleVoidFinance}
          onClose={() => setVoidingFinanceRecord(null)}
        />
      )}

      {/* DELETE CONFIRMATION MODAL */}
    </div>
  );
};
