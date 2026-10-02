import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Users,
  CalendarCheck,
  UserPlus,
  Sparkles,
  BarChart3,
  Layers,
  Award,
  ChevronRight,
  Filter,
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
} from 'recharts';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';

export interface DashboardChartsSectionProps {
  className?: string;
}

export const DashboardChartsSection: React.FC<DashboardChartsSectionProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const { members, visitors, attendance } = useChurchData();

  // Growth Chart Metric Mode: 'cumulative' | 'monthly_additions' | 'all'
  const [growthMetricMode, setGrowthMetricMode] = useState<'cumulative' | 'monthly_additions' | 'all'>('all');

  // Attendance Distribution View: 'by_service' | 'by_attendee_type'
  const [attendanceViewMode, setAttendanceViewMode] = useState<'by_service' | 'by_attendee_type'>('by_service');

  // Real data calculations
  const totalRegisteredMembers = members.filter((m) => !m.is_archived).length;
  const activeRegisteredMembers = members.filter((m) => m.status === 'active' && !m.is_archived).length;

  const getMemberJoinDate = (member: any) => {
    const rawDate = member?.membership_date || member?.date_joined || member?.first_visit_date;
    if (!rawDate) return null;

    const parsed = new Date(rawDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  // 1. Member Growth Trends Data for the last 6 months based on actual join dates
  const memberGrowthData = useMemo(() => {
    const months: Array<{ key: string; label: string; short: string; start: Date; end: Date }> = [];
    const current = new Date();
    current.setDate(1);
    current.setHours(0, 0, 0, 0);

    for (let index = 5; index >= 0; index -= 1) {
      const monthDate = new Date(current.getFullYear(), current.getMonth() - index, 1);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);

      months.push({
        key: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`,
        label: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        short: monthDate.toLocaleDateString('en-US', { month: 'short' }),
        start: monthStart,
        end: monthEnd,
      });
    }

    return months.map(({ label, short, start, end }) => {
      const monthMembers = members.filter((member) => {
        const joinDate = getMemberJoinDate(member);
        if (!joinDate || member.is_archived) return false;
        return joinDate >= start && joinDate <= end;
      });

      const cumulativeMembers = members.filter((member) => {
        const joinDate = getMemberJoinDate(member);
        if (!joinDate || member.is_archived) return false;
        return joinDate <= end;
      });

      const cumulativeActiveMembers = members.filter((member) => {
        const joinDate = getMemberJoinDate(member);
        if (!joinDate || member.is_archived || member.status !== 'active') return false;
        return joinDate <= end;
      });

      const newConverts = monthMembers.filter((member) => member.status === 'new_convert').length;

      return {
        month: label,
        shortMonth: short,
        totalMembers: cumulativeMembers.length,
        activeMembers: cumulativeActiveMembers.length,
        newMembers: monthMembers.length,
        newConverts,
        netGain: monthMembers.length,
      };
    });
  }, [members]);

  // 2. Attendance Distribution Data for the last 6 months based on actual attendance records
  const attendanceDistributionData = useMemo(() => {
    const months: Array<{ label: string; short: string; start: Date; end: Date }> = [];
    const current = new Date();
    current.setDate(1);
    current.setHours(0, 0, 0, 0);

    for (let index = 5; index >= 0; index -= 1) {
      const monthDate = new Date(current.getFullYear(), current.getMonth() - index, 1);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);

      months.push({
        label: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        short: monthDate.toLocaleDateString('en-US', { month: 'short' }),
        start: monthStart,
        end: monthEnd,
      });
    }

    return months.map(({ label, short, start, end }) => {
      const monthRecords = attendance.filter((record) => {
        if (record.status !== 'present') return false;
        const recordDate = new Date(record.date);
        if (Number.isNaN(recordDate.getTime())) return false;
        return recordDate >= start && recordDate <= end;
      });

      const firstService = monthRecords.filter((record) => /1st|first/i.test(record.service_name || '')).length;
      const secondService = monthRecords.filter((record) => /2nd|second|celebration/i.test(record.service_name || '')).length;
      const midweekPrayer = monthRecords.filter((record) => /midweek|prayer|night/i.test(record.service_name || '')).length;

      const regularMembers = monthRecords.filter((record) => record.person_type === 'member').length;
      const visitors = monthRecords.filter((record) => record.person_type === 'visitor').length;

      return {
        month: label,
        shortMonth: short,
        firstService,
        secondService,
        midweekPrayer,
        regularMembers,
        visitors,
        total: regularMembers + visitors,
      };
    });
  }, [attendance]);

  // Summary Metrics calculations
  const aprTotal = memberGrowthData[0].totalMembers;
  const sepTotal = memberGrowthData[memberGrowthData.length - 1].totalMembers;
  const netGrowthPercent = Math.round(((sepTotal - aprTotal) / aprTotal) * 100);
  const avgMonthlyAdditions = Math.round((sepTotal - aprTotal) / 5);

  const totalSixMonthAttendance = attendanceDistributionData.reduce((acc, curr) => acc + curr.total, 0);
  const avgMonthlyAttendance = Math.round(totalSixMonthAttendance / attendanceDistributionData.length);
  const peakAttendanceMonth = attendanceDistributionData.reduce((prev, curr) =>
    curr.total > prev.total ? curr : prev
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
      className={`space-y-6 ${className}`}
    >
      {/* Section Header & KPI Badges */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                <BarChart3 className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                6-Month Congregation Growth & Attendance Intelligence
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Historical trends tracking total membership growth, new believer additions, and Sunday & midweek service attendance distribution (Apr 2026 – Sep 2026).
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-xs font-bold">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>+{netGrowthPercent}% 6-Mo Growth</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 text-xs font-bold">
              <Award className="w-3.5 h-3.5 text-amber-600" />
              <span>Peak: {peakAttendanceMonth.month} ({peakAttendanceMonth.total.toLocaleString()})</span>
            </span>
          </div>
        </div>

        {/* Quick Highlights Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-500 font-medium block">Current Congregation</span>
            <span className="text-lg font-extrabold text-slate-900">{sepTotal}</span>
            <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
              +{sepTotal - aprTotal} members since Apr
            </span>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-500 font-medium block">Monthly Addition Rate</span>
            <span className="text-lg font-extrabold text-slate-900">+{avgMonthlyAdditions}/mo</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Steady net gain</span>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-500 font-medium block">Avg Monthly Attendance</span>
            <span className="text-lg font-extrabold text-slate-900">{avgMonthlyAttendance.toLocaleString()}</span>
            <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">Across all services</span>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-500 font-medium block">6-Month Total Turnout</span>
            <span className="text-lg font-extrabold text-slate-900">{totalSixMonthAttendance.toLocaleString()}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Total service check-ins</span>
          </div>
        </div>
      </div>

      {/* Grid of 2 Core Charts: Member Growth Trends & Attendance Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: Member Growth Trends (Last 6 Months) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-700" />
                  <h3 className="font-bold text-slate-900 text-base">Member Growth Trends</h3>
                </div>
                <p className="text-xs text-slate-500">6-month congregation growth trajectory and active members</p>
              </div>

              {/* View Switcher Filter */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setGrowthMetricMode('all')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    growthMetricMode === 'all'
                      ? 'bg-white text-emerald-950 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setGrowthMetricMode('cumulative')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    growthMetricMode === 'cumulative'
                      ? 'bg-white text-emerald-950 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Totals
                </button>
                <button
                  type="button"
                  onClick={() => setGrowthMetricMode('monthly_additions')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    growthMetricMode === 'monthly_additions'
                      ? 'bg-white text-emerald-950 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  New Gains
                </button>
              </div>
            </div>

            {/* Recharts Area/Bar Chart */}
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={memberGrowthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="totalMembersGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#047857" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#047857" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="activeMembersGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="newConvertsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d97706" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#d97706" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="shortMonth"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    domain={growthMetricMode === 'monthly_additions' ? [0, 25] : [140, 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                    }}
                    formatter={(value: any, name: any) => {
                      if (name === 'Total Registered') return [`${value} members`, 'Total Registered'];
                      if (name === 'Active Members') return [`${value} members`, 'Active Members'];
                      if (name === 'New Additions') return [`+${value} members`, 'New Members Added'];
                      if (name === 'New Converts') return [`+${value} souls`, 'New Converts'];
                      return [value, name];
                    }}
                    labelFormatter={(label) => `Month: ${label} 2026`}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                  />

                  {/* Render series depending on metric filter */}
                  {(growthMetricMode === 'all' || growthMetricMode === 'cumulative') && (
                    <Area
                      type="monotone"
                      dataKey="totalMembers"
                      name="Total Registered"
                      stroke="#047857"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#totalMembersGradient)"
                    />
                  )}

                  {(growthMetricMode === 'all' || growthMetricMode === 'cumulative') && (
                    <Area
                      type="monotone"
                      dataKey="activeMembers"
                      name="Active Members"
                      stroke="#0d9488"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      fillOpacity={1}
                      fill="url(#activeMembersGradient)"
                    />
                  )}

                  {(growthMetricMode === 'all' || growthMetricMode === 'monthly_additions') && (
                    <Area
                      type="monotone"
                      dataKey="newMembers"
                      name="New Additions"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#newConvertsGradient)"
                    />
                  )}

                  {growthMetricMode === 'monthly_additions' && (
                    <Area
                      type="monotone"
                      dataKey="newConverts"
                      name="New Converts"
                      stroke="#0ea5e9"
                      strokeWidth={2}
                      fillOpacity={0.2}
                      fill="#0ea5e9"
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Footer Highlights */}
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              <span>
                April ({aprTotal}) <span className="text-slate-400">→</span> September (<strong>{sepTotal}</strong>)
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/members')}
              className="text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1 transition"
            >
              <span>View Registry</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* CHART 2: Attendance Distribution Over Last 6 Months */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-1.5">
                  <CalendarCheck className="w-4 h-4 text-emerald-700" />
                  <h3 className="font-bold text-slate-900 text-base">Attendance Distribution</h3>
                </div>
                <p className="text-xs text-slate-500">Service participation and visitor-to-member breakdown</p>
              </div>

              {/* View Switcher Filter */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setAttendanceViewMode('by_service')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    attendanceViewMode === 'by_service'
                      ? 'bg-white text-emerald-950 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  By Service
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceViewMode('by_attendee_type')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    attendanceViewMode === 'by_attendee_type'
                      ? 'bg-white text-emerald-950 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  By Attendee
                </button>
              </div>
            </div>

            {/* Recharts BarChart (Stacked / Grouped) */}
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceDistributionData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="shortMonth"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                    }}
                    formatter={(value: any, name: any) => [`${Number(value).toLocaleString()} attendees`, name]}
                    labelFormatter={(label) => `Month: ${label} 2026`}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
                  />

                  {attendanceViewMode === 'by_service' ? (
                    <>
                      <Bar
                        dataKey="secondService"
                        name="2nd Service (Celebration)"
                        stackId="a"
                        fill="#047857"
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        dataKey="firstService"
                        name="1st Service (Prophetic)"
                        stackId="a"
                        fill="#0d9488"
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        dataKey="midweekPrayer"
                        name="Midweek / All-Night"
                        stackId="a"
                        fill="#d97706"
                        radius={[4, 4, 0, 0]}
                      />
                    </>
                  ) : (
                    <>
                      <Bar
                        dataKey="regularMembers"
                        name="Regular Members"
                        stackId="b"
                        fill="#047857"
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        dataKey="visitors"
                        name="First-Time Visitors"
                        stackId="b"
                        fill="#f59e0b"
                        radius={[4, 4, 0, 0]}
                      />
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Footer Highlights */}
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-semibold text-slate-700">Highest Service:</span>
              <span>2nd Celebration Service (~47% of total volume)</span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/attendance')}
              className="text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1 transition shrink-0"
            >
              <span>Take Attendance</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.section>
  );
};
