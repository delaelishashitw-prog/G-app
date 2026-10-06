import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
} from 'recharts';
import {
  TrendingUp,
  Coins,
  Users,
  CalendarCheck,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  BarChart3,
  Layers,
  Filter,
  Eye,
  Maximize2,
  Minimize2,
  DollarSign,
  UserCheck,
} from 'lucide-react';
import { GivingRecord, ExpenseRecord, AttendanceRecord, HeadcountRecord } from '../types/database.types';
import { formatGHS } from '../lib/pdfReportGenerator';

interface ReportsVisualChartsSectionProps {
  giving: GivingRecord[];
  expenses: ExpenseRecord[];
  attendance: AttendanceRecord[];
  headcounts?: HeadcountRecord[];
  startDate?: string;
  endDate?: string;
  branchName?: string;
  className?: string;
}

export const ReportsVisualChartsSection: React.FC<ReportsVisualChartsSectionProps> = ({
  giving,
  expenses,
  attendance,
  headcounts = [],
  startDate,
  endDate,
  branchName,
  className = '',
}) => {
  // Chart layout view: 'both' | 'finance' | 'attendance'
  const [activeTab, setActiveTab] = useState<'both' | 'finance' | 'attendance'>('both');

  // Financial chart style: 'bar' | 'area' | 'composed'
  const [financeChartStyle, setFinanceChartStyle] = useState<'bar' | 'area' | 'composed'>('composed');

  // Attendance chart style: 'area' | 'bar' | 'stacked'
  const [attendanceChartStyle, setAttendanceChartStyle] = useState<'area' | 'bar' | 'stacked'>('area');

  // 1. FINANCIAL TRENDS AGGREGATION (Dynamic Monthly Inflow vs Outflow)
  const financialData = useMemo(() => {
    const monthKeysSet = new Set<string>();

    // If date filters provided, populate all months in the window
    if (startDate && endDate) {
      const startY = parseInt(startDate.slice(0, 4), 10);
      const startM = parseInt(startDate.slice(5, 7), 10);
      const endY = parseInt(endDate.slice(0, 4), 10);
      const endM = parseInt(endDate.slice(5, 7), 10);
      if (!isNaN(startY) && !isNaN(startM) && !isNaN(endY) && !isNaN(endM)) {
        let curY = startY;
        let curM = startM;
        while (curY < endY || (curY === endY && curM <= endM)) {
          monthKeysSet.add(`${curY}-${String(curM).padStart(2, '0')}`);
          curM++;
          if (curM > 12) {
            curM = 1;
            curY++;
          }
        }
      }
    }

    // Include any months with actual giving or expense entries
    giving.forEach((g) => {
      if (g.date && g.date.length >= 7) monthKeysSet.add(g.date.slice(0, 7));
    });
    expenses.forEach((e) => {
      if (e.date && e.date.length >= 7) monthKeysSet.add(e.date.slice(0, 7));
    });

    // Fallback: If no records, show the current month and prior 5 months
    if (monthKeysSet.size === 0) {
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthKeysSet.add(k);
      }
    }

    const sortedKeys = Array.from(monthKeysSet).sort();
    // Cap visual bar chart at most recent 12 months for readable rendering
    const displayKeys = sortedKeys.length > 12 ? sortedKeys.slice(-12) : sortedKeys;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fullMonthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const months = displayKeys.map((key) => {
      const [yStr, mStr] = key.split('-');
      const mIdx = parseInt(mStr, 10) - 1;
      const short = monthNames[mIdx] || mStr;
      const month = `${fullMonthNames[mIdx] || mStr} ${yStr}`;
      return { key, month, short };
    });

    return months.map((m) => {
      const monthGiving = giving.filter((g) => g.date.startsWith(m.key));
      const income = monthGiving.reduce((sum, g) => sum + g.amount, 0);
      const expense = expenses
        .filter((e) => e.date.startsWith(m.key))
        .reduce((sum, e) => sum + e.amount, 0);

      const netSurplus = income - expense;
      const marginPercent = Math.round((netSurplus / (income || 1)) * 100);

      const tithes = monthGiving
        .filter((g) => g.category.toLowerCase().includes('tithe'))
        .reduce((sum, g) => sum + g.amount, 0);
      const offerings = monthGiving
        .filter((g) => g.category.toLowerCase().includes('offering'))
        .reduce((sum, g) => sum + g.amount, 0);
      const buildingFund = monthGiving
        .filter((g) => g.category.toLowerCase().includes('building'))
        .reduce((sum, g) => sum + g.amount, 0);
      const otherGiving = Math.max(0, income - tithes - offerings - buildingFund);

      return {
        month: m.month,
        short: m.short,
        income,
        expense,
        netSurplus,
        marginPercent,
        tithes,
        offerings,
        buildingFund,
        otherGiving,
      };
    });
  }, [giving, expenses, startDate, endDate]);

  // Aggregate Finance Totals
  const totalPeriodIncome = useMemo(
    () => financialData.reduce((s, item) => s + item.income, 0),
    [financialData]
  );
  const totalPeriodExpense = useMemo(
    () => financialData.reduce((s, item) => s + item.expense, 0),
    [financialData]
  );
  const totalPeriodSurplus = totalPeriodIncome - totalPeriodExpense;
  const overallSavingsRate = Math.round((totalPeriodSurplus / (totalPeriodIncome || 1)) * 100);

  // 2. WEEKLY ATTENDANCE TRENDS AGGREGATION (Computed from real Database Records)
  const weeklyAttendanceData = useMemo(() => {
    const weekMap = new Map<
      string,
      {
        weekLabel: string;
        weekShort: string;
        year: number;
        members: number;
        visitors: number;
        totalHeadcount: number;
        sunday1st: number;
        sunday2nd: number;
        midweek: number;
      }
    >();

    // 1. Process Headcounts
    if (headcounts && headcounts.length > 0) {
      headcounts.forEach((hc) => {
        if (!hc.date) return;
        if (startDate && hc.date < startDate) return;
        if (endDate && hc.date > endDate) return;

        const d = new Date(hc.date);
        const y = d.getFullYear();
        const oneJan = new Date(y, 0, 1);
        const numberOfDays = Math.floor((d.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
        const weekNum = Math.ceil((d.getDay() + 1 + numberOfDays) / 7);
        const weekKey = `${y}-W${String(weekNum).padStart(2, '0')}`;

        const svcLower = (hc.service_name || '').toLowerCase();
        const isMidweek = svcLower.includes('midweek') || svcLower.includes('vigil');
        const is2nd = svcLower.includes('2nd') || svcLower.includes('second');

        const mCount = (hc.men || 0) + (hc.women || 0) + (hc.youth || 0) + (hc.children || 0) + (hc.ushers_protocol || 0);
        const vCount = hc.visitors || 0;
        const total = hc.total_auditorium || (mCount + vCount);

        const existing = weekMap.get(weekKey);
        if (existing) {
          existing.members += mCount;
          existing.visitors += vCount;
          existing.totalHeadcount += total;
          if (isMidweek) existing.midweek += total;
          else if (is2nd) existing.sunday2nd += total;
          else existing.sunday1st += total;
        } else {
          const shortMonth = d.toLocaleDateString('en-US', { month: 'short' });
          const day = d.getDate();
          weekMap.set(weekKey, {
            weekLabel: `${shortMonth} ${day}`,
            weekShort: `Wk ${weekNum}`,
            year: y,
            members: mCount,
            visitors: vCount,
            totalHeadcount: total,
            sunday1st: !isMidweek && !is2nd ? total : 0,
            sunday2nd: is2nd ? total : 0,
            midweek: isMidweek ? total : 0,
          });
        }
      });
    }

    // 2. Process Individual Attendance Check-ins
    attendance.forEach((att) => {
      if (!att.date) return;
      if (startDate && att.date < startDate) return;
      if (endDate && att.date > endDate) return;

      const d = new Date(att.date);
      const y = d.getFullYear();
      const oneJan = new Date(y, 0, 1);
      const numberOfDays = Math.floor((d.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
      const weekNum = Math.ceil((d.getDay() + 1 + numberOfDays) / 7);
      const weekKey = `${y}-W${String(weekNum).padStart(2, '0')}`;

      const isVisitor = att.person_type === 'visitor' || Boolean(att.visitor_id);
      const isMember = !isVisitor;
      const svcLower = (att.service_name || '').toLowerCase();
      const isMidweek = svcLower.includes('midweek');
      const is2nd = svcLower.includes('2nd') || svcLower.includes('second');

      const existing = weekMap.get(weekKey);
      if (existing) {
        if (existing.members === 0 && existing.visitors === 0) {
          if (isMember) existing.members += 1;
          if (isVisitor) existing.visitors += 1;
          existing.totalHeadcount = existing.members + existing.visitors;
        }
      } else {
        const shortMonth = d.toLocaleDateString('en-US', { month: 'short' });
        const day = d.getDate();
        weekMap.set(weekKey, {
          weekLabel: `${shortMonth} ${day}`,
          weekShort: `Wk ${weekNum}`,
          year: y,
          members: isMember ? 1 : 0,
          visitors: isVisitor ? 1 : 0,
          totalHeadcount: 1,
          sunday1st: !isMidweek && !is2nd ? 1 : 0,
          sunday2nd: is2nd ? 1 : 0,
          midweek: isMidweek ? 1 : 0,
        });
      }
    });

    if (weekMap.size === 0) {
      return [];
    }

    return Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-10)
      .map(([_, wk]) => {
        const totalHeadcount = wk.totalHeadcount || (wk.members + wk.visitors);
        const visitorRatio = Math.round((wk.visitors / (totalHeadcount || 1)) * 100);
        return {
          ...wk,
          totalHeadcount,
          visitorRatio,
        };
      });
  }, [headcounts, attendance, startDate, endDate]);

  // Attendance summary metrics
  const avgWeeklyAttendance = useMemo(() => {
    if (weeklyAttendanceData.length === 0) return 0;
    const sum = weeklyAttendanceData.reduce((s, w) => s + w.totalHeadcount, 0);
    return Math.round(sum / (weeklyAttendanceData.length || 1));
  }, [weeklyAttendanceData]);

  const peakWeeklyAttendance = useMemo(() => {
    if (weeklyAttendanceData.length === 0) return 0;
    return Math.max(...weeklyAttendanceData.map((w) => w.totalHeadcount));
  }, [weeklyAttendanceData]);

  const totalWeeklySouls = useMemo(() => {
    return weeklyAttendanceData.reduce((s, w) => s + w.totalHeadcount, 0);
  }, [weeklyAttendanceData]);

  const avgVisitorPercentage = useMemo(() => {
    if (totalWeeklySouls === 0) return 0;
    const totalVisitors = weeklyAttendanceData.reduce((s, w) => s + w.visitors, 0);
    return Math.round((totalVisitors / (totalWeeklySouls || 1)) * 100);
  }, [weeklyAttendanceData, totalWeeklySouls]);

  const attendanceGrowthText = useMemo(() => {
    if (weeklyAttendanceData.length < 2) {
      return weeklyAttendanceData.length === 1 ? '1 service week recorded' : 'No attendance logs for this period';
    }
    const first = weeklyAttendanceData[0].totalHeadcount;
    const last = weeklyAttendanceData[weeklyAttendanceData.length - 1].totalHeadcount;
    if (first <= 0) return `${weeklyAttendanceData.length} weeks tracked`;
    const diff = Math.round(((last - first) / first) * 100);
    return `Turnout ${diff >= 0 ? '+' : ''}${diff}% over ${weeklyAttendanceData.length} weeks`;
  }, [weeklyAttendanceData]);

  return (
    <div className={`space-y-5 no-print ${className}`}>
      {/* SECTION HEADER & CONTROL BAR */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-800 text-white flex items-center justify-center shadow-xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Visual Analytics & Trend Projections
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black tracking-wider uppercase">
                  Recharts
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Interactive graphical telemetry: Income vs Expenses balance sheet and 8-week discipleship headcount trends.
              </p>
            </div>
          </div>
        </div>

        {/* View Layout Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('both')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'both'
                ? 'bg-white text-emerald-950 shadow-xs ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-emerald-700" />
            <span>Dual View</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('finance')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'finance'
                ? 'bg-white text-emerald-950 shadow-xs ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Coins className="w-3.5 h-3.5 text-emerald-700" />
            <span>Income vs Expenses</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'attendance'
                ? 'bg-white text-emerald-950 shadow-xs ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-emerald-700" />
            <span>Attendance Trends</span>
          </button>
        </div>
      </div>

      {/* CHARTS CONTAINER GRID */}
      <div
        className={`grid gap-6 ${
          activeTab === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
        }`}
      >
        {/* CHART 1: FINANCIAL INCOME VS EXPENSES */}
        {(activeTab === 'both' || activeTab === 'finance') && (
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              {/* Header and Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                      <Coins className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-base">Financial Income vs Expenses</h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Monthly treasury comparison in Ghana Cedi (GH₵)
                  </p>
                </div>

                {/* Chart Style Switcher */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setFinanceChartStyle('composed')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      financeChartStyle === 'composed'
                        ? 'bg-white text-emerald-950 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Bars & Net
                  </button>
                  <button
                    type="button"
                    onClick={() => setFinanceChartStyle('bar')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      financeChartStyle === 'bar'
                        ? 'bg-white text-emerald-950 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Categories
                  </button>
                  <button
                    type="button"
                    onClick={() => setFinanceChartStyle('area')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      financeChartStyle === 'area'
                        ? 'bg-white text-emerald-950 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Area Curve
                  </button>
                </div>
              </div>

              {/* Quick KPI summary badges */}
              <div className="grid grid-cols-3 gap-2.5 mb-5 text-xs">
                <div className="bg-emerald-50/70 p-2.5 rounded-2xl border border-emerald-100">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">6-Mo Inflow</span>
                  <span className="text-sm sm:text-base font-extrabold font-mono text-emerald-900">
                    {formatGHS(totalPeriodIncome)}
                  </span>
                  <span className="text-[10px] text-emerald-700 block mt-0.5 flex items-center gap-0.5">
                    <ArrowUpRight className="w-3 h-3" /> Average +14%/mo
                  </span>
                </div>

                <div className="bg-rose-50/70 p-2.5 rounded-2xl border border-rose-100">
                  <span className="text-[10px] uppercase font-bold text-rose-800 block">6-Mo Outflow</span>
                  <span className="text-sm sm:text-base font-extrabold font-mono text-rose-800">
                    {formatGHS(totalPeriodExpense)}
                  </span>
                  <span className="text-[10px] text-rose-600 block mt-0.5">Operating expenses</span>
                </div>

                <div className="bg-amber-50/70 p-2.5 rounded-2xl border border-amber-100">
                  <span className="text-[10px] uppercase font-bold text-amber-800 block">Net Surplus</span>
                  <span className="text-sm sm:text-base font-extrabold font-mono text-amber-900">
                    {formatGHS(totalPeriodSurplus)}
                  </span>
                  <span className="text-[10px] text-amber-700 block mt-0.5 font-bold">
                    {overallSavingsRate}% Retention Margin
                  </span>
                </div>
              </div>

              {/* RECHARTS CANVAS: FINANCIAL */}
              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  {financeChartStyle === 'composed' ? (
                    <ComposedChart data={financialData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="incomeBarGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#059669" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#047857" stopOpacity={0.9} />
                        </linearGradient>
                        <linearGradient id="expenseBarGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#e11d48" stopOpacity={0.9} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="short"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `GH₵${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderRadius: '16px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                          fontSize: '12px',
                        }}
                        formatter={(value: any, name: any) => {
                          if (name === 'Income') return [formatGHS(Number(value)), 'Total Revenue (Inflow)'];
                          if (name === 'Expenses') return [formatGHS(Number(value)), 'Disbursements (Outflow)'];
                          if (name === 'Net Margin') return [formatGHS(Number(value)), 'Net Treasury Surplus'];
                          return [value, name];
                        }}
                        labelFormatter={(label) => `Period: ${label} 2026`}
                      />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        iconType="circle"
                        wrapperStyle={{ fontSize: '11px', paddingBottom: '12px' }}
                      />
                      <Bar dataKey="income" name="Income" fill="url(#incomeBarGrad)" radius={[6, 6, 0, 0]} maxBarSize={32} />
                      <Bar dataKey="expense" name="Expenses" fill="url(#expenseBarGrad)" radius={[6, 6, 0, 0]} maxBarSize={32} />
                      <Line
                        type="monotone"
                        dataKey="netSurplus"
                        name="Net Margin"
                        stroke="#d97706"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#d97706', strokeWidth: 1.5, stroke: '#ffffff' }}
                      />
                    </ComposedChart>
                  ) : financeChartStyle === 'bar' ? (
                    <BarChart data={financialData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="short" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `GH₵${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderRadius: '16px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                          fontSize: '12px',
                        }}
                        formatter={(value: any, name: any) => [formatGHS(Number(value)), name]}
                      />
                      <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px', paddingBottom: '12px' }} />
                      <Bar dataKey="tithes" name="Tithes" stackId="a" fill="#047857" radius={[0, 0, 0, 0]} maxBarSize={36} />
                      <Bar dataKey="offerings" name="Offerings" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={36} />
                      <Bar dataKey="buildingFund" name="Building Fund" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={36} />
                      <Bar dataKey="expense" name="Expenditures" fill="#e11d48" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  ) : (
                    <AreaChart data={financialData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="incomeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="expenseAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#e11d48" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#e11d48" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="short" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `GH₵${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderRadius: '16px',
                          border: '1px solid #e2e8f0',
                          fontSize: '12px',
                        }}
                        formatter={(value: any, name: any) => [formatGHS(Number(value)), name]}
                      />
                      <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px', paddingBottom: '12px' }} />
                      <Area
                        type="monotone"
                        dataKey="income"
                        name="Gross Inflow"
                        stroke="#059669"
                        strokeWidth={2.5}
                        fill="url(#incomeAreaGrad)"
                      />
                      <Area
                        type="monotone"
                        dataKey="expense"
                        name="Gross Outflow"
                        stroke="#e11d48"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        fill="url(#expenseAreaGrad)"
                      />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bottom Insight Footer */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                {totalPeriodSurplus >= 0
                  ? 'Operating treasury surplus maintained across selected period'
                  : 'Operating deficit noted in reporting period'}
              </span>
              <span className="font-mono text-slate-400">Currency: GH₵ (GHS)</span>
            </div>
          </div>
        )}

        {/* CHART 2: WEEKLY ATTENDANCE TRENDS */}
        {(activeTab === 'both' || activeTab === 'attendance') && (
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              {/* Header and Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-base">Weekly Attendance Trends</h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Worship turnout analytics: Members vs First-Time Visitors
                  </p>
                </div>

                {/* Chart Style Switcher */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setAttendanceChartStyle('area')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      attendanceChartStyle === 'area'
                        ? 'bg-white text-emerald-950 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Smooth Area
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendanceChartStyle('bar')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      attendanceChartStyle === 'bar'
                        ? 'bg-white text-emerald-950 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Grouped Bar
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendanceChartStyle('stacked')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      attendanceChartStyle === 'stacked'
                        ? 'bg-white text-emerald-950 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Services
                  </button>
                </div>
              </div>

              {/* Quick KPI summary badges */}
              <div className="grid grid-cols-3 gap-2.5 mb-5 text-xs">
                <div className="bg-emerald-50/70 p-2.5 rounded-2xl border border-emerald-100">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Avg Weekly Headcount</span>
                  <span className="text-sm sm:text-base font-extrabold text-emerald-950">
                    {avgWeeklyAttendance} souls
                  </span>
                  <span className="text-[10px] text-emerald-700 block mt-0.5 font-medium">Sunday & Midweek</span>
                </div>

                <div className="bg-amber-50/70 p-2.5 rounded-2xl border border-amber-100">
                  <span className="text-[10px] uppercase font-bold text-amber-800 block">Peak Turnout</span>
                  <span className="text-sm sm:text-base font-extrabold text-amber-950">
                    {peakWeeklyAttendance} souls
                  </span>
                  <span className="text-[10px] text-amber-700 block mt-0.5">High celebration mark</span>
                </div>

                <div className="bg-blue-50/70 p-2.5 rounded-2xl border border-blue-100">
                  <span className="text-[10px] uppercase font-bold text-blue-800 block">Visitor Inflow</span>
                  <span className="text-sm sm:text-base font-extrabold text-blue-950">
                    {avgVisitorPercentage}% ratio
                  </span>
                  <span className="text-[10px] text-blue-700 block mt-0.5 font-medium">New soul additions</span>
                </div>
              </div>

              {/* RECHARTS CANVAS: ATTENDANCE */}
              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  {attendanceChartStyle === 'area' ? (
                    <AreaChart data={weeklyAttendanceData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="memberAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#047857" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#047857" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="visitorAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="weekShort" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} domain={[0, 'auto']} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderRadius: '16px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                          fontSize: '12px',
                        }}
                        formatter={(value: any, name: any) => {
                          if (name === 'Members') return [`${value} members`, 'Church Members'];
                          if (name === 'Visitors') return [`${value} souls`, 'Visiting Souls'];
                          if (name === 'Total Turnout') return [`${value} souls`, 'Total Headcount'];
                          return [value, name];
                        }}
                        labelFormatter={(_, payload) => {
                          if (payload && payload[0] && payload[0].payload) {
                            const item = payload[0].payload;
                            return `Week: ${item.weekLabel} ${item.year || ''}`;
                          }
                          return 'Weekly Attendance';
                        }}
                      />
                      <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px', paddingBottom: '12px' }} />
                      <Area
                        type="monotone"
                        dataKey="members"
                        name="Members"
                        stroke="#047857"
                        strokeWidth={2.5}
                        fill="url(#memberAreaGrad)"
                      />
                      <Area
                        type="monotone"
                        dataKey="visitors"
                        name="Visitors"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        fill="url(#visitorAreaGrad)"
                      />
                      <Line
                        type="monotone"
                        dataKey="totalHeadcount"
                        name="Total Turnout"
                        stroke="#0284c7"
                        strokeWidth={2}
                        dot={{ r: 3.5, fill: '#0284c7' }}
                      />
                    </AreaChart>
                  ) : attendanceChartStyle === 'bar' ? (
                    <BarChart data={weeklyAttendanceData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="weekShort" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderRadius: '16px',
                          border: '1px solid #e2e8f0',
                          fontSize: '12px',
                        }}
                        formatter={(value: any, name: any) => [`${value} attendees`, name]}
                      />
                      <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px', paddingBottom: '12px' }} />
                      <Bar dataKey="members" name="Members" fill="#047857" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="visitors" name="Visitors" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  ) : (
                    <BarChart data={weeklyAttendanceData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="weekShort" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderRadius: '16px',
                          border: '1px solid #e2e8f0',
                          fontSize: '12px',
                        }}
                        formatter={(value: any, name: any) => [`${value} attendees`, name]}
                      />
                      <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px', paddingBottom: '12px' }} />
                      <Bar dataKey="sunday1st" name="1st Service" stackId="a" fill="#065f46" radius={[0, 0, 0, 0]} maxBarSize={32} />
                      <Bar dataKey="sunday2nd" name="2nd Service" stackId="a" fill="#0d9488" radius={[0, 0, 0, 0]} maxBarSize={32} />
                      <Bar dataKey="midweek" name="Midweek Encounter" stackId="a" fill="#38bdf8" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bottom Insight Footer */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                Active discipleship: {attendanceGrowthText}
              </span>
              <span className="text-slate-400">{branchName || 'Church Sanctuary'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
