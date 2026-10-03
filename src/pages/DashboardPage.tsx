import React, { useState } from 'react';
import {
  Users,
  UserCheck,
  CalendarCheck,
  Coins,
  TrendingUp,
  UserPlus,
  HeartHandshake,
  Calendar,
  Gift,
  Cake,
  Phone,
  MessageCircle,
  ArrowUpRight,
  MapPin,
  Clock,
  Sparkles,
  Smartphone,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  Shield,
  Activity,
  Bookmark,
  Volume2,
  Mic,
  Music,
  ExternalLink,
  PlusCircle,
  BarChart3,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { DashboardSummary } from '../components/DashboardSummary';
import { DashboardChartsSection } from '../components/DashboardChartsSection';
import { QuickActionModal } from '../components/QuickActionModal';

export { DashboardSummary, DashboardChartsSection };

const PIE_COLORS = ['#064e3b', '#047857', '#059669', '#10b981', '#34d399', '#d97706'];

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { success, warning } = useToast();
  const {
    settings,
    members,
    visitors,
    attendance,
    giving,
    pledges,
    events,
    pastoralCare,
    prayerRequests,
    services,
    auditLogs,
    isRefreshing,
    lastRefreshedAt,
    refreshData,
  } = useChurchData();

  const handleRefresh = async () => {
    const res = await refreshData();
    if (res.success) {
      success('Dashboard Refreshed', res.message);
    } else {
      warning('Refresh Warning', res.message);
    }
  };

  // Active Tab: 'overview' | 'services' | 'pastoral' | 'finance'
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'pastoral' | 'finance'>('overview');

  // Quick Action Modal state
  const [quickActionType, setQuickActionType] = useState<
    'member' | 'visitor' | 'giving' | 'attendance' | 'event' | null
  >(null);

  // Metrics calculation
  const totalMembers = members.filter((m) => !m.is_archived).length;
  const activeMembers = members.filter((m) => m.status === 'active' && !m.is_archived).length;
  const newMembersThisMonth = members.filter((m) => {
    if (!m.membership_date) return false;
    const d = new Date(m.membership_date);
    return d.getMonth() === 8 && d.getFullYear() === 2026; // September 2026
  }).length;

  const totalVisitors = visitors.length;
  const visitorsThisMonth = visitors.filter((v) => v.visit_date.startsWith('2026-09')).length;
  const pendingFollowUps = visitors.filter(
    (v) => v.follow_up_status === 'new' || v.follow_up_status === 'follow_up_required'
  );

  const totalGivingMonth = giving
    .filter((g) => g.date.startsWith('2026-09'))
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalOutstandingPledges = pledges.reduce((acc, curr) => acc + curr.balance, 0);

  // Chart Data: Giving by Category
  const categoryTotals: Record<string, number> = {};
  giving.forEach((g) => {
    categoryTotals[g.category] = (categoryTotals[g.category] || 0) + g.amount;
  });
  const givingCategoryData = Object.entries(categoryTotals).map(([name, value]) => ({
    name,
    value,
  }));

  // Giving by Payment Channel
  const channelTotals: Record<string, number> = {};
  giving.forEach((g) => {
    const ch = g.payment_channel || (g.payment_method === 'mobile_money' ? 'MTN MoMo' : 'Cash');
    channelTotals[ch] = (channelTotals[ch] || 0) + g.amount;
  });
  const givingChannelData = Object.entries(channelTotals).map(([name, value]) => ({
    name,
    value,
  }));

  // Chart Data: Weekly Attendance from real attendance records
  const weeklyAttendanceData = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weeks: Array<{ start: Date; end: Date }> = [];
    const dayOfWeek = (today.getDay() + 6) % 7;

    for (let index = 3; index >= 0; index -= 1) {
      const start = new Date(today);
      const offsetFromCurrentWeek = dayOfWeek + (index * 7);
      start.setDate(today.getDate() - offsetFromCurrentWeek);
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      weeks.push({ start, end });
    }

    return weeks.map((week, index) => {
      const records = attendance.filter((entry) => {
        if (entry.status !== 'present') return false;
        const entryDate = new Date(entry.date);
        if (Number.isNaN(entryDate.getTime())) return false;
        return entryDate >= week.start && entryDate <= week.end;
      });

      const members = records.filter((entry) => entry.person_type === 'member' || Boolean(entry.member_id)).length;
      const visitors = records.filter((entry) => entry.person_type === 'visitor' || Boolean(entry.visitor_id)).length;
      const monthShort = week.start.toLocaleDateString('en-US', { month: 'short' });

      return {
        week: index === weeks.length - 1 ? `Week ${index + 1} (Current)` : `Week ${index + 1} (${monthShort})`,
        members,
        visitors,
        total: members + visitors,
      };
    });
  }, [attendance]);

  // Upcoming birthdays this month
  const birthdayMembers = members.filter((m) => {
    if (!m.date_of_birth) return false;
    const month = parseInt(m.date_of_birth.split('-')[1], 10);
    return month === 9; // September
  });

  // Retention Alert: Members who haven't attended in the last 2 recorded services
  const recentServiceDates = Array.from(new Set(attendance.map((a) => a.date))).sort().reverse().slice(0, 2);
  const attendeesRecent = new Set(
    attendance
      .filter((a) => recentServiceDates.includes(a.date) && a.status === 'present' && Boolean(a.member_id))
      .map((a) => a.member_id as string)
  );
  const absentWatchlist = members
    .filter((m) => m.status === 'active' && !m.is_archived && !attendeesRecent.has(m.id))
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Executive Welcome & Church Pulse Banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#064e3b] via-[#047857] to-[#022c22] p-6 sm:p-8 text-white shadow-xl border border-emerald-800/40"
      >
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4 sm:gap-5">
            <motion.div
              whileHover={{ scale: 1.05, rotate: 1 }}
              transition={{ duration: 0.2 }}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white p-2 shadow-xl shrink-0 flex items-center justify-center border-2 border-amber-400"
            >
              <img
                src={settings.logo_url || '/assets/logo.png'}
                alt="GWCC Official Crest"
                className="w-full h-full object-contain"
                loading="eager"
              />
            </motion.div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-400 text-slate-950 shadow-xs">
                  ChMS Command Center
                </span>
                <span className="text-xs text-emerald-200/90 font-medium flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-300" />
                  {settings.branch_name || 'Main Cathedral'}, Joma - Ablekuma, Accra
                </span>
                <span className="text-xs text-emerald-300/80 font-mono hidden sm:inline">
                  • {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Welcome back, {currentUser.first_name}!
              </h1>
              <p className="text-emerald-100 text-xs sm:text-sm max-w-xl leading-relaxed">
                Operating pulse for <strong>{settings.church_name}</strong>. Manage Sunday attendance, first-time guests, financial tithes, and pastoral care across Ablekuma North.
              </p>
            </div>
          </div>

          {/* Quick Action Speed-Dial Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => setQuickActionType('giving')}
              className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition shadow-xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Gift className="w-4 h-4 text-slate-900" />
              <span>+ Record Giving</span>
            </button>
            <button
              onClick={() => setQuickActionType('attendance')}
              className="px-3.5 py-2 rounded-xl bg-white text-emerald-950 hover:bg-emerald-50 text-xs font-bold transition shadow-xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <CalendarCheck className="w-4 h-4 text-emerald-700" />
              <span>+ Check In</span>
            </button>
            <button
              onClick={() => setQuickActionType('visitor')}
              className="px-3.5 py-2 rounded-xl bg-emerald-800/80 hover:bg-emerald-800 text-white border border-emerald-600/40 text-xs font-bold transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <UserCheck className="w-4 h-4 text-amber-300" />
              <span>+ Add Visitor ({pendingFollowUps.length})</span>
            </button>
            <button
              onClick={() => setQuickActionType('member')}
              className="px-3 py-2 rounded-xl bg-emerald-900/60 hover:bg-emerald-900 text-emerald-100 border border-emerald-700/50 text-xs font-semibold transition flex items-center gap-1 active:scale-95 cursor-pointer"
              title="Add New Member"
            >
              <UserPlus className="w-4 h-4 text-emerald-300" />
              <span>Member</span>
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-3 py-2 rounded-xl bg-emerald-950/70 hover:bg-emerald-900 text-emerald-200 border border-emerald-700/60 text-xs font-semibold transition flex items-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-60"
              title="Refresh Dashboard & Metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-300' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Ambient background crest glow */}
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center justify-end pr-8">
          <Sparkles className="w-64 h-64 text-white" />
        </div>
      </motion.div>

      {/* Navigation View Switcher (Overview / Sunday Hub / Pastoral / Finance) */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-white text-emerald-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-700" />
            <span>Overview & Pulse</span>
          </button>
          <button
            onClick={() => setActiveTab('services')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'services'
                ? 'bg-white text-emerald-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarCheck className="w-4 h-4 text-teal-700" />
            <span>Sunday Service Hub</span>
          </button>
          <button
            onClick={() => setActiveTab('pastoral')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'pastoral'
                ? 'bg-white text-emerald-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HeartHandshake className="w-4 h-4 text-rose-600" />
            <span>Pastoral & Watchlist</span>
            {pendingFollowUps.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-800 font-bold">
                {pendingFollowUps.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('finance')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'finance'
                ? 'bg-white text-emerald-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Coins className="w-4 h-4 text-amber-600" />
            <span>Stewardship & MoMo</span>
          </button>
        </div>

        {/* Quick Launch & Refresh */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 transition shadow-2xs cursor-pointer disabled:opacity-60"
            title={`Refresh Dashboard Data • Last updated: ${lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
            <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <button
            onClick={() => navigate('/attendance')}
            className="hidden md:flex text-xs font-semibold text-emerald-800 hover:text-emerald-950 items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/80 transition"
          >
            <span>Launch Attendance Kiosk</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* TAB 1: OVERVIEW & PULSE */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Executive KPI Summary Cards */}
          <DashboardSummary />

          {/* Quick Ministerial Operations Dock */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Quick Ministerial Shortcuts
              </h3>
              <span className="text-[11px] text-slate-400">High-frequency Sunday & Weekly tasks</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <button
                onClick={() => setQuickActionType('giving')}
                className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-amber-50 hover:border-amber-300 transition text-left group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <Coins className="w-4 h-4" />
                </div>
                <span className="font-bold text-xs text-slate-900 block">Record Giving</span>
                <span className="text-[11px] text-slate-500 block truncate">Tithes & Offerings</span>
              </button>

              <button
                onClick={() => setQuickActionType('attendance')}
                className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-teal-50 hover:border-teal-300 transition text-left group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <CalendarCheck className="w-4 h-4" />
                </div>
                <span className="font-bold text-xs text-slate-900 block">Check-in Attendee</span>
                <span className="text-[11px] text-slate-500 block truncate">Sunday services</span>
              </button>

              <button
                onClick={() => setQuickActionType('visitor')}
                className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-blue-50 hover:border-blue-300 transition text-left group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <UserPlus className="w-4 h-4" />
                </div>
                <span className="font-bold text-xs text-slate-900 block">Add Visitor</span>
                <span className="text-[11px] text-slate-500 block truncate">First-time guest</span>
              </button>

              <button
                onClick={() => navigate('/pledges')}
                className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-purple-50 hover:border-purple-300 transition text-left group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <Bookmark className="w-4 h-4" />
                </div>
                <span className="font-bold text-xs text-slate-900 block">Capital Pledges</span>
                <span className="text-[11px] text-slate-500 block truncate">Cathedral Expansion</span>
              </button>

              <button
                onClick={() => navigate('/communication')}
                className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-emerald-50 hover:border-emerald-300 transition text-left group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <span className="font-bold text-xs text-slate-900 block">Broadcast SMS</span>
                <span className="text-[11px] text-slate-500 block truncate">Congregation alerts</span>
              </button>

              <button
                onClick={() => navigate('/pastoral-care')}
                className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-rose-50 hover:border-rose-300 transition text-left group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <HeartHandshake className="w-4 h-4" />
                </div>
                <span className="font-bold text-xs text-slate-900 block">Pastoral Care</span>
                <span className="text-[11px] text-slate-500 block truncate">Home visits & prayer</span>
              </button>
            </div>
          </div>

          {/* 6-Month Member Growth Trends & Attendance Distribution Charts Section */}
          <DashboardChartsSection />

          {/* Analytics Charts Row */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Weekly Attendance Trend */}
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Weekly Service Attendance Trend</h3>
                  <p className="text-xs text-slate-500">Breakdown of members and visitors across Sunday services</p>
                </div>
                <button
                  onClick={() => navigate('/attendance')}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                >
                  Take Attendance <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyAttendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value: any) => [`${value} people`, '']}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    />
                    <Bar dataKey="members" name="Members Present" fill="#047857" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="visitors" name="First-Time Visitors" fill="#d97706" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Giving by Category Pie Chart */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-900 text-base">Giving Breakdown (GH₵)</h3>
                  <button
                    onClick={() => navigate('/finance')}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                  >
                    View Details
                  </button>
                </div>
                <p className="text-xs text-slate-500 mb-2">Tithes, offerings, and special building seeds</p>

                <div className="h-44 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={givingCategoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {givingCategoryData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any) => [`GH₵ ${Number(val).toLocaleString()}`, '']}
                        contentStyle={{ borderRadius: '10px', fontSize: '11px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                {givingCategoryData.slice(0, 4).map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                      />
                      {item.name}
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      GH₵ {item.value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Actionable Pastoral & Operations Sections */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Visitors Needing Immediate Follow-up */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
                    <UserCheck className="w-4 h-4" />
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm">Visitors Follow-Up</h3>
                </div>
                <button
                  onClick={() => navigate('/visitors')}
                  className="text-xs text-blue-700 hover:text-blue-900 font-semibold cursor-pointer"
                >
                  All ({visitors.length})
                </button>
              </div>

              <div className="space-y-2.5">
                {pendingFollowUps.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                    All visitors have been contacted!
                  </div>
                ) : (
                  pendingFollowUps.slice(0, 3).map((v) => (
                    <div
                      key={v.id}
                      className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-blue-50/40 hover:border-blue-200 transition space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">{v.full_name}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                          {v.follow_up_status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1">
                        {v.prayer_request || `Attended ${v.service_attended}`}
                      </p>
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="text-slate-400 font-mono text-[11px]">{v.phone}</span>
                        <a
                          href={`tel:${v.phone}`}
                          className="flex items-center gap-1 text-emerald-700 hover:underline font-semibold text-[11px]"
                        >
                          <Phone className="w-3 h-3" /> Call
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Upcoming Birthdays with Instant WhatsApp Link */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
                    <Cake className="w-4 h-4" />
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm">September Birthdays</h3>
                </div>
                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                  GWCC Family
                </span>
              </div>

              <div className="space-y-2.5">
                {birthdayMembers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                    No member birthdays recorded this month.
                  </div>
                ) : (
                  birthdayMembers.slice(0, 3).map((m) => {
                    const birthDay = m.date_of_birth ? m.date_of_birth.split('-')[2] : '';
                    const cleanPhone = m.phone.replace(/[^0-9]/g, '');
                    const whatsappUrl = `https://wa.me/${cleanPhone}?text=Happy%20Birthday%20${encodeURIComponent(
                      m.first_name
                    )}!%20May%20the%20Lord%20continually%20bless%20you%20from%20Greater%20Works%20City%20Church!`;

                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50"
                      >
                        <div className="flex items-center gap-2.5">
                          {m.profile_photo_url ? (
                            <img
                              src={m.profile_photo_url}
                              alt={m.first_name}
                              className="w-9 h-9 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                              {m.first_name[0]}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-xs text-slate-900">
                              {m.first_name} {m.last_name}
                            </p>
                            <p className="text-[11px] text-slate-500">Sept {birthDay} • {m.phone}</p>
                          </div>
                        </div>

                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1 text-xs font-semibold cursor-pointer"
                          title="Send WhatsApp Birthday Message"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Wish</span>
                        </a>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Upcoming Church Programs & Services */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-purple-50 text-purple-700 rounded-lg">
                    <Calendar className="w-4 h-4" />
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm">Upcoming Programs</h3>
                </div>
                <button
                  onClick={() => navigate('/events')}
                  className="text-xs text-purple-700 hover:text-purple-900 font-semibold cursor-pointer"
                >
                  Calendar
                </button>
              </div>

              <div className="space-y-2.5">
                {events.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                    No upcoming programs scheduled.
                  </div>
                ) : (
                  events.slice(0, 3).map((e) => (
                    <div key={e.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 truncate max-w-[200px]">{e.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-medium">
                          {e.event_type.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {e.start_date} at {e.start_time}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {e.venue}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>

          {/* Live Church Audit / Operations Feed */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">Recent Operational Ledger Stream</h3>
              </div>
              <button
                onClick={() => navigate('/audit-logs')}
                className="text-xs text-emerald-800 hover:underline font-semibold flex items-center gap-1"
              >
                <span>View Full Audit Log</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {auditLogs.slice(0, 4).map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 truncate max-w-[120px]">{log.user_name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                      {log.module}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px] line-clamp-2">{log.details}</p>
                  <span className="text-[10px] text-slate-400 font-mono block">
                    {new Date(log.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} •{' '}
                    {new Date(log.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SUNDAY SERVICE HUB */}
      {activeTab === 'services' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Services Banner */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800">
                  Weekly Worship Operations
                </span>
                <span className="text-xs text-slate-500">Joma Main Cathedral</span>
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Sunday Services & Liturgy Coordination
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                Real-time service duty roster, order of service bulletin preview, and instant attendee check-in for ushers and technical leaders.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuickActionType('attendance')}
                className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <CalendarCheck className="w-4 h-4" />
                <span>Check-In Member</span>
              </button>
              <button
                onClick={() => navigate('/services')}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition cursor-pointer"
              >
                Manage Services
              </button>
            </div>
          </div>

          {/* Service Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {services.map((service, idx) => {
              const serviceAttendance = attendance.filter((a) => a.service_id === service.id);
              const presentCount = serviceAttendance.filter((a) => a.status === 'present').length;
              return (
                <div
                  key={service.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 hover:border-teal-300 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                        {service.day_of_week}s
                      </span>
                      <h3 className="font-bold text-slate-900 text-base mt-1">{service.name}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {service.start_time} - {service.end_time} • {service.venue}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-extrabold text-slate-900 font-mono">{presentCount}</span>
                      <span className="text-[11px] text-slate-500 block">Checked-in</span>
                    </div>
                  </div>

                  {/* Standard Order of Service Snippet */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1.5">
                    <span className="font-bold text-slate-700 block text-[11px]">Order of Service Flow:</span>
                    <div className="grid grid-cols-2 gap-2 text-slate-600 text-[11px]">
                      <div>1. Opening Prayer & Scripture</div>
                      <div>4. Offertory & Tithes</div>
                      <div>2. Praise & Worship (Choir)</div>
                      <div>5. The Word / Sermon</div>
                      <div>3. Welcome First-Time Guests</div>
                      <div>6. Altar Call & Benediction</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <button
                      onClick={() => navigate('/services')}
                      className="text-teal-700 hover:text-teal-900 font-semibold flex items-center gap-1"
                    >
                      <span>Duty Roster & Bulletin</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setQuickActionType('attendance');
                      }}
                      className="px-3 py-1 bg-teal-50 text-teal-800 rounded-lg font-bold hover:bg-teal-100 transition"
                    >
                      Quick Check-In
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: PASTORAL & CARE PULSE */}
      {activeTab === 'pastoral' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                  Shepherd Care & Assimilation
                </span>
                <span className="text-xs text-slate-500">Pastoral Welfare Protocol</span>
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Congregation Retention & Spiritual Support
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                Proactive tracking for members missing Sunday gatherings, prayer requests submitted during altar calls, and first-time visitor welcoming.
              </p>
            </div>
            <button
              onClick={() => navigate('/pastoral-care')}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <HeartHandshake className="w-4 h-4" />
              <span>Full Pastoral Care Desk</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Absentee Retention Watchlist */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-rose-600" />
                    Congregation Retention Watchlist
                  </h3>
                  <p className="text-xs text-slate-500">Active members not checked in for the last 2 Sunday services</p>
                </div>
                <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                  {absentWatchlist.length} Members
                </span>
              </div>

              <div className="space-y-2">
                {absentWatchlist.map((m) => {
                  const cleanPhone = m.phone.replace(/[^0-9]/g, '');
                  const whatsappUrl = `https://wa.me/${cleanPhone}?text=Hello%20${encodeURIComponent(
                    m.first_name
                  )}!%20Greetings%20from%20Greater%20Works%20City%20Church.%20We%20missed%20you%20at%20service%20and%20wanted%20to%20check%20on%20you!`;

                  return (
                    <div
                      key={m.id}
                      className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-800 font-bold flex items-center justify-center text-xs">
                          {m.first_name[0]}
                        </div>
                        <div>
                          <span className="font-bold text-xs text-slate-900 block">
                            {m.first_name} {m.last_name}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {m.phone} • {m.city || 'Accra'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${m.phone}`}
                          className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-emerald-700 transition"
                          title="Call member"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1 transition"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>Check In</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Prayer Requests Intercession */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <HeartHandshake className="w-4 h-4 text-purple-600" />
                    Altar Prayer & Intercession
                  </h3>
                  <p className="text-xs text-slate-500">Petitions submitted for pastoral counseling and prayer</p>
                </div>
                <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                  {prayerRequests.length} Requests
                </span>
              </div>

              <div className="space-y-2">
                {prayerRequests.slice(0, 4).map((pr) => (
                  <div
                    key={pr.id}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{pr.category}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                        {pr.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-1">{pr.request}</p>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span>Submitted by {pr.requester_name}</span>
                      <span>{pr.date_submitted || 'Recent'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: STEWARDSHIP & FINANCE */}
      {activeTab === 'finance' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                  Church Treasury & Financial Transparency
                </span>
                <span className="text-xs text-slate-500">Ghana Cedi (GH₵)</span>
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Tithe & Offertory Reconciliations
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                Breakdown of Mobile Money (MTN MoMo, Telecel Cash), physical bank transfers, cash collections, and pledge redemptions.
              </p>
            </div>
            <button
              onClick={() => setQuickActionType('giving')}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Coins className="w-4 h-4" />
              <span>Record Contribution</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Payment Channel Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <h3 className="font-bold text-slate-900 text-sm">Payment Channels</h3>
              <div className="space-y-2.5">
                {givingChannelData.map((item) => (
                  <div
                    key={item.name}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-emerald-700" />
                      <span className="font-semibold text-xs text-slate-800">{item.name}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 text-xs">
                      GH₵ {item.value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Giving Transactions Feed */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">Recent Giving Ledger</h3>
                <button
                  onClick={() => navigate('/finance')}
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  View All Receipts
                </button>
              </div>

              <div className="space-y-2">
                {giving.slice(0, 5).map((g) => (
                  <div
                    key={g.id}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">
                          {g.member_name || g.donor_name || 'Anonymous Giver'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          {g.category}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {g.date} • {g.payment_channel || g.payment_method} {g.reference_number ? `(${g.reference_number})` : ''}
                      </span>
                    </div>
                    <span className="font-mono font-extrabold text-slate-900 text-sm">
                      GH₵ {g.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Quick Action Modal */}
      <QuickActionModal
        isOpen={Boolean(quickActionType)}
        type={quickActionType}
        onClose={() => setQuickActionType(null)}
      />
    </div>
  );
};
