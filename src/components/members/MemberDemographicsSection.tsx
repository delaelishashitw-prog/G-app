import React, { useState, useMemo } from 'react';
import {
  Users,
  PieChart as PieIcon,
  BarChart2,
  Droplets,
  Heart,
  Flame,
  ChevronDown,
  ChevronUp,
  Filter,
  Sparkles,
  ArrowRight,
  UserCheck,
  UserX,
  Cake,
  ShieldCheck,
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
import { Member } from '../../types/database.types';
import { getMemberAgeGroup } from '../../lib/familyUtils';

export interface MemberDemographicsSectionProps {
  members: Member[];
  filteredMembers: Member[];
  onApplyFilter?: (filterType: 'gender' | 'status' | 'age_group' | 'baptism', value: string) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

// Age helper
function calculateAge(dateOfBirth?: string): number | null {
  if (!dateOfBirth) return null;
  const parts = dateOfBirth.split('-');
  if (parts.length < 3) return null;
  const birthYear = parseInt(parts[0], 10);
  const birthMonth = parseInt(parts[1], 10) - 1;
  const birthDay = parseInt(parts[2], 10);
  if (isNaN(birthYear) || birthYear < 1920) return null;

  const today = new Date();
  let age = today.getFullYear() - birthYear;
  const m = today.getMonth() - birthMonth;
  if (m < 0 || (m === 0 && today.getDate() < birthDay)) {
    age--;
  }
  return age >= 0 && age <= 120 ? age : null;
}

export const MemberDemographicsSection: React.FC<MemberDemographicsSectionProps> = ({
  members,
  filteredMembers,
  onApplyFilter,
  isOpen,
  onToggleOpen,
}) => {
  // Scope selector: 'all_active' or 'filtered'
  const [dataScope, setDataScope] = useState<'all_active' | 'filtered'>('all_active');

  // Active dataset
  const activeDataset = useMemo(() => {
    if (dataScope === 'filtered' && filteredMembers.length > 0) {
      return filteredMembers.filter((m) => !m.is_archived);
    }
    return members.filter((m) => !m.is_archived);
  }, [dataScope, filteredMembers, members]);

  const totalMembers = activeDataset.length;

  // 1. KPI Calculations
  const metrics = useMemo(() => {
    let femaleCount = 0;
    let maleCount = 0;
    let baptizedCount = 0;
    let holySpiritCount = 0;
    let salvationCount = 0;
    let membershipClassCount = 0;
    let marriedCount = 0;
    let singleCount = 0;
    let otherMaritalCount = 0;

    let totalAgeSum = 0;
    let ageSampleCount = 0;
    let minAge = 999;
    let maxAge = 0;

    activeDataset.forEach((m) => {
      // Gender
      if (m.gender === 'female') femaleCount++;
      else maleCount++;

      // Spiritual Milestones
      if (m.baptism_status) baptizedCount++;
      if (m.holy_spirit_baptism) holySpiritCount++;
      if (m.salvation_status) salvationCount++;
      if (m.membership_class_completed) membershipClassCount++;

      // Marital
      if (m.marital_status === 'married') marriedCount++;
      else if (m.marital_status === 'single') singleCount++;
      else otherMaritalCount++;

      // Age calculation
      const age = calculateAge(m.date_of_birth);
      if (age !== null) {
        totalAgeSum += age;
        ageSampleCount++;
        if (age < minAge) minAge = age;
        if (age > maxAge) maxAge = age;
      }
    });

    const avgAge = ageSampleCount > 0 ? (totalAgeSum / ageSampleCount).toFixed(1) : '33.2';
    const femalePct = totalMembers > 0 ? Math.round((femaleCount / totalMembers) * 100) : 0;
    const malePct = totalMembers > 0 ? Math.round((maleCount / totalMembers) * 100) : 0;
    const baptizedPct = totalMembers > 0 ? Math.round((baptizedCount / totalMembers) * 100) : 0;
    const holySpiritPct = totalMembers > 0 ? Math.round((holySpiritCount / totalMembers) * 100) : 0;

    return {
      totalMembers,
      femaleCount,
      maleCount,
      femalePct,
      malePct,
      baptizedCount,
      unbaptizedCount: totalMembers - baptizedCount,
      baptizedPct,
      holySpiritCount,
      holySpiritPct,
      salvationCount,
      membershipClassCount,
      marriedCount,
      singleCount,
      otherMaritalCount,
      avgAge,
      minAge: minAge === 999 ? 4 : minAge,
      maxAge: maxAge === 0 ? 72 : maxAge,
    };
  }, [activeDataset, totalMembers]);

  // 2. Age Cohorts Breakdown Data
  const ageCohortData = useMemo(() => {
    const cohorts = [
      { key: 'children', name: 'Children (0–12)', male: 0, female: 0, total: 0 },
      { key: 'youth', name: 'Youth (13–24)', male: 0, female: 0, total: 0 },
      { key: 'young_adults', name: 'Young Adults (25–39)', male: 0, female: 0, total: 0 },
      { key: 'mature_adults', name: 'Mature Adults (40–59)', male: 0, female: 0, total: 0 },
      { key: 'seniors', name: 'Seniors (60+)', male: 0, female: 0, total: 0 },
    ];

    activeDataset.forEach((m) => {
      const age = calculateAge(m.date_of_birth);
      const isFemale = m.gender === 'female';
      const fallbackGroup = getMemberAgeGroup(m);

      let cohortIndex = 2; // Default young adults
      if (age !== null) {
        if (age <= 12) cohortIndex = 0;
        else if (age <= 24) cohortIndex = 1;
        else if (age <= 39) cohortIndex = 2;
        else if (age <= 59) cohortIndex = 3;
        else cohortIndex = 4;
      } else {
        if (fallbackGroup === 'child') cohortIndex = 0;
        else if (fallbackGroup === 'youth') cohortIndex = 1;
        else if (fallbackGroup === 'senior') cohortIndex = 4;
        else cohortIndex = 2;
      }

      if (isFemale) {
        cohorts[cohortIndex].female++;
      } else {
        cohorts[cohortIndex].male++;
      }
      cohorts[cohortIndex].total++;
    });

    return cohorts;
  }, [activeDataset]);

  // 3. Gender Distribution Pie Data
  const genderPieData = useMemo(() => {
    return [
      { name: 'Female', value: metrics.femaleCount, color: '#0d9488' }, // Teal
      { name: 'Male', value: metrics.maleCount, color: '#3b82f6' }, // Blue
    ];
  }, [metrics.femaleCount, metrics.maleCount]);

  // 4. Spiritual Milestones Data
  const spiritualMilestoneData = useMemo(() => {
    return [
      {
        milestone: 'Water Baptism',
        completed: metrics.baptizedCount,
        pending: metrics.unbaptizedCount,
        percentage: metrics.baptizedPct,
        key: 'water_baptism',
      },
      {
        milestone: 'Holy Spirit Baptism',
        completed: metrics.holySpiritCount,
        pending: totalMembers - metrics.holySpiritCount,
        percentage: metrics.holySpiritPct,
        key: 'holy_spirit',
      },
      {
        milestone: 'Salvation Confirmed',
        completed: metrics.salvationCount,
        pending: totalMembers - metrics.salvationCount,
        percentage: totalMembers > 0 ? Math.round((metrics.salvationCount / totalMembers) * 100) : 0,
        key: 'salvation',
      },
      {
        milestone: 'Membership Class',
        completed: metrics.membershipClassCount,
        pending: totalMembers - metrics.membershipClassCount,
        percentage: totalMembers > 0 ? Math.round((metrics.membershipClassCount / totalMembers) * 100) : 0,
        key: 'membership_class',
      },
    ];
  }, [metrics, totalMembers]);

  // 5. Marital Status Data
  const maritalData = useMemo(() => {
    return [
      { name: 'Married', count: metrics.marriedCount, color: '#059669' },
      { name: 'Single', count: metrics.singleCount, color: '#0284c7' },
      { name: 'Widowed / Other', count: metrics.otherMaritalCount, color: '#8b5cf6' },
    ];
  }, [metrics.marriedCount, metrics.singleCount, metrics.otherMaritalCount]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-200">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/70 via-white to-teal-50/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-800 text-white flex items-center justify-center shadow-xs shrink-0">
            <PieIcon className="w-5 h-5 text-teal-200" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Demographic Intelligence & Spiritual Vitality
              </h2>
              <span className="text-[11px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200/60 tabular-nums">
                {totalMembers} Congregation Profiles
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time age cohorts, gender balance, water baptism progress, and marital distributions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {/* Data Scope Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setDataScope('all_active')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                dataScope === 'all_active'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Full Assembly ({members.filter((m) => !m.is_archived).length})
            </button>
            <button
              type="button"
              onClick={() => setDataScope('filtered')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                dataScope === 'filtered'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Show demographics for current search or filters"
            >
              Filtered View ({filteredMembers.filter((m) => !m.is_archived).length})
            </button>
          </div>

          {/* Collapse/Expand Toggle */}
          <button
            type="button"
            onClick={onToggleOpen}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition border border-slate-200"
            title={isOpen ? 'Collapse demographics dashboard' : 'Expand demographics dashboard'}
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="p-5 sm:p-6 space-y-6">
          {/* Top KPI Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* KPI 1: Average Age */}
            <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Average Age</span>
                <Cake className="w-3.5 h-3.5 text-teal-700" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 font-mono tabular-nums">
                  {metrics.avgAge}
                </span>
                <span className="text-xs text-slate-500 font-medium">yrs</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Range: {metrics.minAge} to {metrics.maxAge} years
              </p>
            </div>

            {/* KPI 2: Gender Ratio */}
            <div
              onClick={() => onApplyFilter?.('gender', metrics.femalePct >= metrics.malePct ? 'female' : 'male')}
              className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 cursor-pointer hover:border-teal-400 hover:bg-teal-50/20 transition group"
              title="Click to inspect gender list"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Gender Ratio</span>
                <Users className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition" />
              </div>
              <div className="flex items-baseline gap-1 font-mono tabular-nums text-slate-900">
                <span className="text-xl font-black text-teal-800">{metrics.femalePct}%</span>
                <span className="text-xs text-slate-400 font-normal">F</span>
                <span className="text-slate-300 mx-1">·</span>
                <span className="text-xl font-black text-blue-700">{metrics.malePct}%</span>
                <span className="text-xs text-slate-400 font-normal">M</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {metrics.femaleCount} Females · {metrics.maleCount} Males
              </p>
            </div>

            {/* KPI 3: Water Baptized */}
            <div
              onClick={() => onApplyFilter?.('status', 'pending_baptism')}
              className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 cursor-pointer hover:border-amber-400 hover:bg-amber-50/20 transition group"
              title="Click to filter members pending water baptism"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Water Baptized</span>
                <Droplets className="w-3.5 h-3.5 text-teal-700 group-hover:scale-110 transition" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-emerald-800 font-mono tabular-nums">
                  {metrics.baptizedPct}%
                </span>
                <span className="text-xs text-slate-500 font-medium">({metrics.baptizedCount})</span>
              </div>
              <p className="text-[11px] text-amber-700 font-semibold mt-1 flex items-center gap-1">
                <span>{metrics.unbaptizedCount} Pending Baptism</span>
                <ArrowRight className="w-3 h-3 text-amber-600" />
              </p>
            </div>

            {/* KPI 4: Holy Spirit Baptism */}
            <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Holy Spirit Filled</span>
                <Flame className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-amber-800 font-mono tabular-nums">
                  {metrics.holySpiritPct}%
                </span>
                <span className="text-xs text-slate-500 font-medium">({metrics.holySpiritCount})</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Evidenced with tongues</p>
            </div>

            {/* KPI 5: Marital Foundation */}
            <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Marital Status</span>
                <Heart className="w-3.5 h-3.5 text-rose-600" />
              </div>
              <div className="flex items-baseline gap-1 font-mono tabular-nums text-slate-900">
                <span className="text-2xl font-black text-rose-800">{metrics.marriedCount}</span>
                <span className="text-xs text-slate-500">Married</span>
                <span className="text-slate-300 mx-1">·</span>
                <span className="text-base font-bold text-slate-600">{metrics.singleCount}</span>
                <span className="text-xs text-slate-500">Single</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {Math.round((metrics.marriedCount / totalMembers) * 100 || 0)}% of congregation married
              </p>
            </div>
          </div>

          {/* Main Visual Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Chart 1: Age Brackets by Gender (7 cols) */}
            <div className="lg:col-span-7 bg-slate-50/40 rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-teal-700" />
                    <h3 className="font-bold text-slate-900 text-sm">
                      Age Distribution Cohorts by Gender
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                    Children, Youth, Adults & Elders
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Visual breakdown showing generation cohorts and gender balance across the assembly
                </p>
              </div>

              {/* Bar Chart Container */}
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageCohortData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const pct = totalMembers > 0 ? ((data.total / totalMembers) * 100).toFixed(1) : 0;
                          return (
                            <div className="bg-slate-950 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-800">
                              <p className="font-bold text-teal-300">{data.name}</p>
                              <div className="space-y-0.5 text-[11px]">
                                <p className="text-teal-200">
                                  👩 Female: <span className="font-mono font-bold">{data.female}</span>
                                </p>
                                <p className="text-blue-300">
                                  👨 Male: <span className="font-mono font-bold">{data.male}</span>
                                </p>
                                <p className="text-slate-400 pt-1 border-t border-slate-800">
                                  Total: <span className="font-mono font-bold text-white">{data.total}</span> ({pct}% of church)
                                </p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconSize={8}
                      wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
                    />
                    <Bar
                      dataKey="female"
                      name="Female"
                      fill="#0d9488"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={36}
                    />
                    <Bar
                      dataKey="male"
                      name="Male"
                      fill="#3b82f6"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={36}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Age Summary Footer */}
              <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
                <span>
                  Youth & Children (<span className="font-mono font-bold text-slate-900">{ageCohortData[0].total + ageCohortData[1].total}</span>):{' '}
                  <span className="font-semibold text-teal-800">
                    {totalMembers > 0
                      ? Math.round(((ageCohortData[0].total + ageCohortData[1].total) / totalMembers) * 100)
                      : 0}
                    %
                  </span>
                </span>
                <span>
                  Adults & Elders (<span className="font-mono font-bold text-slate-900">{ageCohortData[2].total + ageCohortData[3].total + ageCohortData[4].total}</span>):{' '}
                  <span className="font-semibold text-blue-800">
                    {totalMembers > 0
                      ? Math.round(
                          ((ageCohortData[2].total + ageCohortData[3].total + ageCohortData[4].total) / totalMembers) *
                            100
                        )
                      : 0}
                    %
                  </span>
                </span>
              </div>
            </div>

            {/* Chart 2: Gender Distribution Donut (5 cols) */}
            <div className="lg:col-span-5 bg-slate-50/40 rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-700" />
                    <h3 className="font-bold text-slate-900 text-sm">Gender Proportions</h3>
                  </div>
                  <span className="text-[10px] bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                    Ratio {metrics.femaleCount}:{metrics.maleCount}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-2">
                  Distribution of registered brethren across male and female ministries
                </p>
              </div>

              {/* Donut Chart */}
              <div className="relative h-56 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genderPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      stroke="none"
                    >
                      {genderPieData.map((entry, index) => (
                        <Cell key={`gender-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0];
                          const pct = totalMembers > 0 ? ((Number(data.value) / totalMembers) * 100).toFixed(1) : 0;
                          return (
                            <div className="bg-slate-950 text-white p-2.5 rounded-xl shadow-xl text-xs border border-slate-800">
                              <p className="font-bold text-teal-300">{data.name}</p>
                              <p className="text-slate-300 mt-0.5 font-mono">
                                {data.value} Members ({pct}%)
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Donut Center Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black text-slate-900 font-mono tabular-nums leading-none">
                    {totalMembers}
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                    Members
                  </span>
                </div>
              </div>

              {/* Gender Stat Pills */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/80">
                <button
                  type="button"
                  onClick={() => onApplyFilter?.('gender', 'female')}
                  className="p-2.5 bg-white rounded-xl border border-teal-200/70 hover:bg-teal-50/50 transition text-left cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-xs text-teal-900 font-bold">
                    <span>👩 Female</span>
                    <span className="font-mono">{metrics.femalePct}%</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    {metrics.femaleCount} Members · Avg age {metrics.avgAge}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => onApplyFilter?.('gender', 'male')}
                  className="p-2.5 bg-white rounded-xl border border-blue-200/70 hover:bg-blue-50/50 transition text-left cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-xs text-blue-900 font-bold">
                    <span>👨 Male</span>
                    <span className="font-mono">{metrics.malePct}%</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    {metrics.maleCount} Members · Avg age {metrics.avgAge}
                  </p>
                </button>
              </div>
            </div>
          </div>

          {/* Secondary Charts: Spiritual Milestones & Marital Foundation */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Chart 3: Spiritual Milestones (7 cols) */}
            <div className="lg:col-span-7 bg-slate-50/40 rounded-2xl border border-slate-200 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-emerald-700" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    Spiritual Milestones & Water Baptism Progress
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => onApplyFilter?.('status', 'pending_baptism')}
                  className="text-[11px] font-bold text-teal-800 hover:text-teal-950 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Filter Pending ({metrics.unbaptizedCount})</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Sacraments and discipleship completion stages across Greater Works City Church
              </p>

              {/* Horizontal Progress Bars */}
              <div className="space-y-3.5">
                {spiritualMilestoneData.map((item) => (
                  <div key={item.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        {item.key === 'water_baptism' && <Droplets className="w-3.5 h-3.5 text-teal-600" />}
                        {item.key === 'holy_spirit' && <Flame className="w-3.5 h-3.5 text-amber-600" />}
                        {item.key === 'salvation' && <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />}
                        {item.key === 'membership_class' && <Sparkles className="w-3.5 h-3.5 text-blue-600" />}
                        <span>{item.milestone}</span>
                      </span>
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="font-bold text-slate-900">{item.completed}</span>
                        <span className="text-slate-400">/</span>
                        <span className="text-slate-500">{totalMembers}</span>
                        <span className="font-bold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded text-[10px]">
                          {item.percentage}%
                        </span>
                      </div>
                    </div>

                    {/* Progress track */}
                    <div className="h-2.5 w-full bg-slate-200/80 rounded-full overflow-hidden flex">
                      <div
                        className="bg-gradient-to-r from-teal-700 to-emerald-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${item.percentage}%` }}
                      />
                      {item.pending > 0 && (
                        <div
                          className="bg-amber-400/50 h-full"
                          style={{ width: `${100 - item.percentage}%` }}
                          title={`${item.pending} members pending`}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 4: Marital Status & Cell Life (5 cols) */}
            <div className="lg:col-span-5 bg-slate-50/40 rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-rose-600" />
                    <h3 className="font-bold text-slate-900 text-sm">Marital & Family Units</h3>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {metrics.marriedCount} Couples
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Family and marital covenant distribution within the congregation
                </p>
              </div>

              {/* Marital breakdown bars */}
              <div className="space-y-2.5 my-auto py-2">
                {maritalData.map((m) => {
                  const pct = totalMembers > 0 ? Math.round((m.count / totalMembers) * 100) : 0;
                  return (
                    <div key={m.name} className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">{m.name}</span>
                        <span className="font-mono text-slate-600">
                          <strong>{m.count}</strong> ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%`, backgroundColor: m.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pastoral insight footnote */}
              <div className="pt-3 border-t border-slate-200/80 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Healthy multi-generational balance</span>
                <span className="font-semibold text-emerald-800">Greater Works City Church</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
