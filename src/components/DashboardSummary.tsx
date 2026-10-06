import React from 'react';
import {
  Users,
  CalendarCheck,
  Coins,
  TrendingUp,
  UserCheck,
  ArrowUpRight,
  Sparkles,
  Smartphone,
  CheckCircle2,
  Clock,
  HeartHandshake,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useChurchData } from '../contexts/ChurchDataContext';
import { AnimatedNumber } from './AnimatedNumber';

export interface DashboardSummaryProps {
  className?: string;
  onNavigateTab?: (path: string) => void;
  onOpenQuickAction?: (type: 'member' | 'visitor' | 'giving' | 'attendance') => void;
}

export const DashboardSummary: React.FC<DashboardSummaryProps> = ({
  className,
  onNavigateTab,
  onOpenQuickAction,
}) => {
  const navigate = useNavigate();
  const { members, visitors, attendance, headcounts, services, giving, pledges, settings } = useChurchData();

  const handleNavigate = (path: string) => {
    if (onNavigateTab) {
      onNavigateTab(path);
    } else {
      navigate(path);
    }
  };

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthNum = now.getMonth() + 1; // 1-12
  const currentYearMonth = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;
  const currentMonthName = now.toLocaleDateString('en-US', { month: 'long' });

  // 1. Total Members Metric
  const totalMembers = members.filter((m) => !m.is_archived).length;
  const activeMembers = members.filter((m) => m.status === 'active' && !m.is_archived).length;
  const retentionRate = totalMembers > 0
    ? ((activeMembers / totalMembers) * 100).toFixed(1)
    : '100';

  // Dynamic month determination for giving/records (fallback to latest data month if current month is new)
  const hasGivingCurrentMonth = giving.some((g) => g.date && g.date.startsWith(currentYearMonth));
  const activeGivingYearMonth = hasGivingCurrentMonth
    ? currentYearMonth
    : giving.length > 0
    ? [...giving].sort((a, b) => b.date.localeCompare(a.date))[0]?.date?.slice(0, 7) || currentYearMonth
    : currentYearMonth;

  const [givingYear, givingMonth] = activeGivingYearMonth.split('-').map(Number);
  const activeGivingMonthName = !Number.isNaN(givingYear) && !Number.isNaN(givingMonth)
    ? new Date(givingYear, givingMonth - 1, 1).toLocaleDateString('en-US', { month: 'long' })
    : currentMonthName;

  const newMembersThisMonth = members.filter((m) => {
    const raw = m.membership_date || (m as any).date_joined || m.created_at;
    if (!raw || m.is_archived) return false;
    return raw.startsWith(currentYearMonth) || raw.startsWith(activeGivingYearMonth);
  }).length;
  const newConvertsCount = members.filter((m) => m.status === 'new_convert' && !m.is_archived).length;

  // 2. Last Service Attendance & Percentage
  const allRecordedDates = Array.from(
    new Set([...attendance.map((a) => a.date), ...headcounts.map((h) => h.date)].filter(Boolean))
  ).sort().reverse();

  const lastServiceDate = allRecordedDates[0] || currentYearMonth + '-01';
  const lastServiceAttendanceRecords = attendance.filter(
    (a) => a.date === lastServiceDate && a.status === 'present'
  );
  const lastServiceHeadcount = headcounts.find((h) => h.date === lastServiceDate);

  const lastServiceName =
    lastServiceAttendanceRecords[0]?.service_name ||
    lastServiceHeadcount?.service_name ||
    services[0]?.name ||
    'Sunday Service';

  const lastServiceAttendeesCount =
    lastServiceAttendanceRecords.length > 0
      ? lastServiceAttendanceRecords.length
      : lastServiceHeadcount
      ? lastServiceHeadcount.total_auditorium ||
        lastServiceHeadcount.men +
          lastServiceHeadcount.women +
          lastServiceHeadcount.youth +
          lastServiceHeadcount.children +
          lastServiceHeadcount.visitors
      : 0;

  const attendanceRate = activeMembers > 0
    ? Math.min(100, Math.round((lastServiceAttendeesCount / activeMembers) * 100))
    : 0;

  const formattedLastServiceDate = allRecordedDates[0]
    ? new Date(lastServiceDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'No recent service';

  // 3. Total Contributions for Active Month
  const currentMonthGivingRecords = giving.filter((g) => g.date && g.date.startsWith(activeGivingYearMonth));
  const totalContributionsMonth = currentMonthGivingRecords.reduce((sum, g) => sum + g.amount, 0);

  const titheContributions = currentMonthGivingRecords
    .filter((g) => g.category === 'Tithe')
    .reduce((sum, g) => sum + g.amount, 0);

  const moMoContributions = currentMonthGivingRecords
    .filter((g) => g.payment_method === 'mobile_money')
    .reduce((sum, g) => sum + g.amount, 0);

  const moMoPercentage = totalContributionsMonth > 0
    ? Math.round((moMoContributions / totalContributionsMonth) * 100)
    : 0;

  // 4. Visitors & Follow-ups
  const hasVisitorsCurrentMonth = visitors.some((v) => v.visit_date && v.visit_date.startsWith(currentYearMonth));
  const activeVisitorYearMonth = hasVisitorsCurrentMonth
    ? currentYearMonth
    : visitors.length > 0
    ? [...visitors].sort((a, b) => b.visit_date.localeCompare(a.visit_date))[0]?.visit_date?.slice(0, 7) || currentYearMonth
    : currentYearMonth;

  const visitorsThisMonth = visitors.filter((v) => v.visit_date && v.visit_date.startsWith(activeVisitorYearMonth)).length;
  const pendingFollowUps = visitors.filter(
    (v) => v.follow_up_status === 'new' || v.follow_up_status === 'follow_up_required'
  ).length;

  // 5. Outstanding Pledges & Campaigns
  const totalOutstandingPledges = pledges.reduce((acc, curr) => acc + curr.balance, 0);
  const totalPledged = pledges.reduce((acc, curr) => acc + curr.amount_pledged, 0);
  const totalPledgeRedeemed = pledges.reduce((acc, curr) => acc + curr.amount_paid, 0);
  const pledgeRedeemedPercent = totalPledged > 0 ? Math.round((totalPledgeRedeemed / totalPledged) * 100) : 0;
  const pledgeCampaigns = Array.from(new Set(pledges.map((p) => p.campaign_name).filter(Boolean)));
  const campaignSummary = pledgeCampaigns.slice(0, 2).join(' & ') || 'Church Campaigns';

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.07,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 14, scale: 0.98 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.35,
        ease: [0.16, 1, 0.3, 1] as const,
      },
    },
  };

  return (
    <div className={`space-y-3.5 ${className || ''}`}>
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            Executive Performance Pulse
          </h2>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-400">
          <span className="hidden sm:inline">Greater Accra Timezone (GMT+0)</span>
          <span className="px-2 py-0.5 rounded-md bg-slate-100 font-mono text-slate-600 font-semibold">
            {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} GMT
          </span>
        </div>
      </div>

      {/* Primary KPI Summary Cards Grid with Staggered Entrance */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {/* CARD 1: Total Members */}
        <motion.div
          variants={cardVariants}
          whileHover={{ y: -3, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } }}
          whileTap={{ scale: 0.985 }}
          onClick={() => handleNavigate('/members')}
          className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none transition group-hover:scale-110" />

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                Total Members
              </span>
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-200 shadow-2xs">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                <AnimatedNumber value={totalMembers} duration={800} />
              </span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <AnimatedNumber value={activeMembers} duration={800} /> Active
              </span>
            </div>

            <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-500">
              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium">
                {newConvertsCount} new converts
              </span>
              <span>•</span>
              <span className="text-emerald-700 font-semibold">
                +{newMembersThisMonth} this month
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>{retentionRate}% retention</span>
            </span>
            <span className="text-emerald-700 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              Directory <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </motion.div>

        {/* CARD 2: Attendance Percentage for Last Service */}
        <motion.div
          variants={cardVariants}
          whileHover={{ y: -3, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } }}
          whileTap={{ scale: 0.985 }}
          onClick={() => handleNavigate('/attendance')}
          className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-teal-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-bl-full pointer-events-none transition group-hover:scale-110" />

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Last Service Attendance
              </span>
              <div className="p-2.5 rounded-xl bg-teal-50 text-teal-700 group-hover:bg-teal-600 group-hover:text-white transition-colors duration-200 shadow-2xs">
                <CalendarCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                <AnimatedNumber value={attendanceRate} suffix="%" duration={900} />
              </span>
              <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200/60">
                <AnimatedNumber value={lastServiceAttendeesCount} duration={750} /> Present
              </span>
            </div>

            {/* Attendance Progress Bar with smooth animation */}
            <div className="mt-2.5 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${attendanceRate}%` }}
                transition={{ duration: 0.9, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="bg-gradient-to-r from-teal-500 to-emerald-500 h-2 rounded-full"
              />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 truncate max-w-[170px]" title={`${lastServiceName} • ${formattedLastServiceDate}`}>
              {formattedLastServiceDate}
            </span>
            <span className="text-teal-700 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              Check-In <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </motion.div>

        {/* CARD 3: Total Contributions for the Current Month */}
        <motion.div
          variants={cardVariants}
          whileHover={{ y: -3, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } }}
          whileTap={{ scale: 0.985 }}
          onClick={() => handleNavigate('/finance')}
          className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-amber-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full pointer-events-none transition group-hover:scale-110" />

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {activeGivingMonthName} Giving
              </span>
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors duration-200 shadow-2xs">
                <Coins className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-xs font-bold font-mono text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60">
                {settings.currency_symbol || 'GH₵'}
              </span>
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                <AnimatedNumber value={totalContributionsMonth} decimals={2} duration={950} />
              </span>
            </div>

            <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1 font-medium text-emerald-700">
                <Smartphone className="w-3 h-3" />
                {moMoPercentage}% via MoMo
              </span>
              <span>•</span>
              <span>Tithes: GH₵ {titheContributions.toLocaleString()}</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">
              Reconciled ledger
            </span>
            <span className="text-amber-800 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              Finance <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </motion.div>

        {/* CARD 4: Outstanding Pledges & Campaigns */}
        <motion.div
          variants={cardVariants}
          whileHover={{ y: -3, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } }}
          whileTap={{ scale: 0.985 }}
          onClick={() => handleNavigate('/pledges')}
          className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-purple-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-bl-full pointer-events-none transition group-hover:scale-110" />

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Outstanding Pledges
              </span>
              <div className="p-2.5 rounded-xl bg-purple-50 text-purple-700 group-hover:bg-purple-600 group-hover:text-white transition-colors duration-200 shadow-2xs">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-xs font-bold font-mono text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/60">
                {settings.currency_symbol || 'GH₵'}
              </span>
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                <AnimatedNumber value={totalOutstandingPledges} decimals={2} duration={950} />
              </span>
            </div>

            <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-500">
              <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-bold border border-purple-200/60">
                {pledgeRedeemedPercent}% Redeemed
              </span>
              <span>•</span>
              <span>{pledges.length} vows</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium truncate max-w-[150px]" title={campaignSummary}>
              {campaignSummary}
            </span>
            <span className="text-purple-700 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              Pledges <ArrowUpRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};
