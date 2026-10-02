import React from 'react';
import {
  Users,
  Coins,
  CalendarCheck,
  TrendingUp,
  ArrowUpRight,
  Sparkles,
  Award,
  CheckCircle2,
  UserCheck,
  Building2,
} from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';
import { formatGHS } from '../lib/pdfReportGenerator';

export interface ReportsSummaryCardsProps {
  totalMembers: number;
  activeMembers: number;
  monthlyIncome: number;
  averageWeeklyAttendance: number;
  tithesIncome?: number;
  offeringsIncome?: number;
  buildingFundIncome?: number;
  peakWeeklyAttendance?: number;
  periodLabel?: string;
  onFilterClick?: (type: 'membership' | 'financial' | 'attendance') => void;
  className?: string;
}

export const ReportsSummaryCards: React.FC<ReportsSummaryCardsProps> = ({
  totalMembers,
  activeMembers,
  monthlyIncome,
  averageWeeklyAttendance,
  tithesIncome,
  offeringsIncome,
  buildingFundIncome,
  peakWeeklyAttendance,
  periodLabel = 'Current Month (September 2026)',
  onFilterClick,
  className = '',
}) => {
  const activeRate = totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 100) : 92;

  return (
    <div className={`space-y-2 no-print ${className}`}>
      {/* Small Section Sub-Header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          High-Level Church Performance Metrics ({periodLabel})
        </span>
        <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
          Greater Works City Church • Joma
        </span>
      </div>

      {/* 3-Card Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {/* CARD 1: TOTAL MEMBERS */}
        <div
          onClick={() => onFilterClick?.('membership')}
          className={`bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-emerald-300 group ${
            onFilterClick ? 'cursor-pointer' : ''
          }`}
        >
          {/* Top Decorative Subtle Glow */}
          <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all pointer-events-none" />

          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Total Members
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  <AnimatedNumber value={totalMembers} duration={800} />
                </span>
                <span className="text-xs font-semibold text-slate-500">souls</span>
              </div>
            </div>

            {/* Icon Avatar */}
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shadow-2xs group-hover:scale-105 group-hover:bg-emerald-100 transition-all">
              <Users className="w-6 h-6" />
            </div>
          </div>

          {/* Context Metrics & Pills */}
          <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col gap-2 relative z-10">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Active Communicants
              </span>
              <span className="font-bold text-slate-800">
                {activeMembers} ({activeRate}%)
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                Net Quarterly Growth
              </span>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md text-[11px]">
                +16 disciples
              </span>
            </div>
          </div>
        </div>

        {/* CARD 2: MONTHLY INCOME */}
        <div
          onClick={() => onFilterClick?.('financial')}
          className={`bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-amber-300 group ${
            onFilterClick ? 'cursor-pointer' : ''
          }`}
        >
          {/* Top Decorative Subtle Glow */}
          <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all pointer-events-none" />

          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Monthly Income
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-950 font-mono tracking-tight">
                  <AnimatedNumber
                    value={monthlyIncome}
                    duration={800}
                    decimals={2}
                    prefix="GH₵ "
                  />
                </span>
              </div>
            </div>

            {/* Icon Avatar */}
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 shadow-2xs group-hover:scale-105 group-hover:bg-amber-100 transition-all">
              <Coins className="w-6 h-6" />
            </div>
          </div>

          {/* Context Metrics & Breakdown */}
          <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col gap-2 relative z-10">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-600" />
                Tithes Collected
              </span>
              <span className="font-bold font-mono text-emerald-800">
                {tithesIncome !== undefined ? formatGHS(tithesIncome) : 'GH₵ 12,400.00'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                Sunday Offerings
              </span>
              <span className="font-bold font-mono text-slate-800">
                {offeringsIncome !== undefined ? formatGHS(offeringsIncome) : 'GH₵ 8,600.00'}
              </span>
            </div>
          </div>
        </div>

        {/* CARD 3: AVERAGE WEEKLY ATTENDANCE */}
        <div
          onClick={() => onFilterClick?.('attendance')}
          className={`bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-sky-300 group ${
            onFilterClick ? 'cursor-pointer' : ''
          }`}
        >
          {/* Top Decorative Subtle Glow */}
          <div className="absolute top-0 right-0 w-28 h-28 bg-sky-500/5 rounded-full blur-2xl group-hover:bg-sky-500/10 transition-all pointer-events-none" />

          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Average Weekly Attendance
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  <AnimatedNumber value={averageWeeklyAttendance} duration={800} />
                </span>
                <span className="text-xs font-semibold text-slate-500">attendees</span>
              </div>
            </div>

            {/* Icon Avatar */}
            <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-700 shadow-2xs group-hover:scale-105 group-hover:bg-sky-100 transition-all">
              <CalendarCheck className="w-6 h-6" />
            </div>
          </div>

          {/* Context Metrics & Pills */}
          <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col gap-2 relative z-10">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-sky-600" />
                Peak Celebration Turnout
              </span>
              <span className="font-bold text-sky-900 bg-sky-50 px-1.5 py-0.5 rounded-md text-[11px]">
                {peakWeeklyAttendance ? `${peakWeeklyAttendance} souls` : '202 souls'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                Worship Services
              </span>
              <span className="font-bold text-slate-700">1st, 2nd & Midweek</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
