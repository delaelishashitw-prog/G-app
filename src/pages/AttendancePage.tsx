import React, { useState, useMemo } from 'react';
import {
  ClipboardCheck,
  Calendar,
  Search,
  CheckCircle,
  AlertCircle,
  Users,
  UserCheck,
  Plus,
  Clock,
  Trash2,
  TrendingUp,
  Download,
  Printer,
  Sparkles,
  QrCode,
  ShieldCheck,
  RotateCcw,
  Save,
  MessageCircle,
  Phone,
  Layers,
  ChevronRight,
  Filter,
  Eye,
  Maximize2,
  HeartHandshake,
  CheckCircle2,
  CalendarDays,
  FileSpreadsheet,
  BarChart3,
  UserX,
  Building,
  Check,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useToast } from '../contexts/ToastContext';
import { ChurchService, AttendanceRecord, HeadcountRecord, Member, Visitor } from '../types/database.types';
import { getLocalDateString, formatServiceDayString, getQuickDate } from '../lib/attendanceDateUtils';

// Modals
import { AttendanceKioskModal } from '../components/attendance/AttendanceKioskModal';
import { QuickAddVisitorModal } from '../components/attendance/QuickAddVisitorModal';
import { PrintAttendanceRegisterModal } from '../components/attendance/PrintAttendanceRegisterModal';
import { DigitalPassModal } from '../components/attendance/DigitalPassModal';

export const AttendancePage: React.FC = () => {
  const {
    services,
    members,
    visitors,
    ministries,
    attendance,
    headcounts,
    recordAttendance,
    batchRecordAttendance,
    removeAttendance,
    recordHeadcount,
    settings,
    isRefreshing,
    lastRefreshedAt,
    refreshData,
  } = useChurchData();
  const { success, error, warning, info } = useToast();

  // Active service and date selection
  const [selectedServiceId, setSelectedServiceId] = useState(services[0]?.id || '');
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString());

  // Ensure selectedServiceId is kept in sync if services load or change
  React.useEffect(() => {
    if (!selectedServiceId && services.length > 0) {
      setSelectedServiceId(services[0].id);
    }
  }, [services, selectedServiceId]);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<
    'checkin' | 'headcount' | 'batch' | 'absentees' | 'analytics' | 'history'
  >('checkin');

  // Search & Filters in Check-in terminal
  const [searchMemberTerm, setSearchMemberTerm] = useState('');
  const [attendeeFilter, setAttendeeFilter] = useState<'all' | 'member' | 'visitor'>('all');
  const [attendeeSearch, setAttendeeSearch] = useState('');

  // Modals state
  const [isKioskOpen, setIsKioskOpen] = useState(false);
  const [isQuickVisitorOpen, setIsQuickVisitorOpen] = useState(false);
  const [isPrintRegisterOpen, setIsPrintRegisterOpen] = useState(false);
  const [digitalPassMember, setDigitalPassMember] = useState<Member | null>(null);

  // In-app confirmations (replaces window.confirm)
  const [recordToUndo, setRecordToUndo] = useState<AttendanceRecord | null>(null);
  const [isResetHeadcountConfirmOpen, setIsResetHeadcountConfirmOpen] = useState(false);

  const handleRefresh = async () => {
    const res = await refreshData();
    if (res.success) {
      success('Attendance Data Refreshed', res.message);
    } else {
      warning('Refresh Warning', res.message);
    }
  };

  // Batch Department Check-In state
  const [selectedMinistryId, setSelectedMinistryId] = useState<string>('all');
  const [batchSelectedMembers, setBatchSelectedMembers] = useState<Set<string>>(new Set());
  const [batchSearchTerm, setBatchSearchTerm] = useState('');

  // Selected Service
  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId) || services[0],
    [services, selectedServiceId]
  );

  // Current session attendance records
  const currentSessionRecords = useMemo(
    () =>
      attendance.filter(
        (a) => a.service_id === selectedServiceId && a.date === selectedDate
      ),
    [attendance, selectedServiceId, selectedDate]
  );

  const membersCheckedIn = useMemo(
    () => currentSessionRecords.filter((a) => a.person_type === 'member'),
    [currentSessionRecords]
  );
  const visitorsCheckedIn = useMemo(
    () => currentSessionRecords.filter((a) => a.person_type === 'visitor'),
    [currentSessionRecords]
  );

  const alreadyCheckedInIds = useMemo(() => {
    const set = new Set<string>();
    currentSessionRecords.forEach((r) => {
      if (r.member_id) set.add(r.member_id);
      if (r.visitor_id) set.add(r.visitor_id);
    });
    return set;
  }, [currentSessionRecords]);

  // Current Headcount Record for active service and date
  const currentHeadcountRecord = useMemo(
    () => headcounts.find((h) => h.service_id === selectedServiceId && h.date === selectedDate),
    [headcounts, selectedServiceId, selectedDate]
  );

  // Headcount form state
  const [headcountForm, setHeadcountForm] = useState({
    men: currentHeadcountRecord?.men ?? 0,
    women: currentHeadcountRecord?.women ?? 0,
    youth: currentHeadcountRecord?.youth ?? 0,
    children: currentHeadcountRecord?.children ?? 0,
    visitors: currentHeadcountRecord?.visitors ?? visitorsCheckedIn.length,
    ushers_protocol: currentHeadcountRecord?.ushers_protocol ?? 0,
    online_viewers: currentHeadcountRecord?.online_viewers ?? 0,
    counted_by: currentHeadcountRecord?.counted_by ?? '',
    notes: currentHeadcountRecord?.notes ?? '',
  });

  // Active session key to only re-initialize when switching service or date
  const activeSessionKey = `${selectedServiceId}_${selectedDate}`;
  const prevSessionKeyRef = React.useRef(activeSessionKey);

  // Sync form when selectedServiceId or selectedDate changes
  React.useEffect(() => {
    if (prevSessionKeyRef.current !== activeSessionKey) {
      prevSessionKeyRef.current = activeSessionKey;
      if (currentHeadcountRecord) {
        setHeadcountForm({
          men: currentHeadcountRecord.men,
          women: currentHeadcountRecord.women,
          youth: currentHeadcountRecord.youth,
          children: currentHeadcountRecord.children,
          visitors: currentHeadcountRecord.visitors,
          ushers_protocol: currentHeadcountRecord.ushers_protocol,
          online_viewers: currentHeadcountRecord.online_viewers,
          counted_by: currentHeadcountRecord.counted_by || '',
          notes: currentHeadcountRecord.notes || '',
        });
      } else {
        setHeadcountForm({
          men: 0,
          women: 0,
          youth: 0,
          children: 0,
          visitors: visitorsCheckedIn.length,
          ushers_protocol: 0,
          online_viewers: 0,
          counted_by: '',
          notes: '',
        });
      }
    }
  }, [activeSessionKey, currentHeadcountRecord, visitorsCheckedIn.length]);

  const totalAuditorium =
    headcountForm.men +
    headcountForm.women +
    headcountForm.youth +
    headcountForm.children +
    headcountForm.visitors +
    headcountForm.ushers_protocol;

  const totalChurchReach = totalAuditorium + headcountForm.online_viewers;

  // Search Members for Live Check-In
  const matchingMembers = useMemo(() => {
    const term = searchMemberTerm.trim().toLowerCase();
    if (!term) return [];
    return members
      .filter((m) => !m.is_archived)
      .filter(
        (m) =>
          m.first_name.toLowerCase().includes(term) ||
          m.last_name.toLowerCase().includes(term) ||
          m.member_id.toLowerCase().includes(term) ||
          (m.phone && m.phone.includes(term))
      )
      .slice(0, 10);
  }, [members, searchMemberTerm]);

  // Handle single check-in
  const handleCheckIn = (
    personType: 'member' | 'visitor',
    personId: string,
    method: 'manual' | 'search' | 'qr_code' = 'search'
  ) => {
    const res = recordAttendance(selectedServiceId, personType, personId, method, selectedDate);
    if (res.success) {
      success(res.message);
      setSearchMemberTerm('');
    } else {
      error(res.message);
    }
  };

  // Quick preset dates using timezone-safe calculator
  const handleSetQuickDate = (preset: 'today' | 'lastSunday' | 'lastWednesday') => {
    const newDate = getQuickDate(preset);
    setSelectedDate(newDate);
  };

  // Save Headcount
  const handleSaveHeadcount = () => {
    if (!selectedServiceId) {
      error('Please select a service before saving headcount.');
      return;
    }
    recordHeadcount({
      service_id: selectedServiceId,
      service_name: selectedService?.name || 'Worship Service',
      date: selectedDate,
      men: headcountForm.men,
      women: headcountForm.women,
      youth: headcountForm.youth,
      children: headcountForm.children,
      visitors: headcountForm.visitors,
      ushers_protocol: headcountForm.ushers_protocol,
      online_viewers: headcountForm.online_viewers,
      total_auditorium: totalAuditorium,
      counted_by: headcountForm.counted_by,
      notes: headcountForm.notes,
    });
    success('Auditorium headcount saved and locked into official records.');
  };

  // Reset Headcount (opens in-app confirmation modal)
  const handleResetHeadcount = () => {
    setIsResetHeadcountConfirmOpen(true);
  };

  const handleConfirmResetHeadcount = () => {
    setHeadcountForm({
      men: 0,
      women: 0,
      youth: 0,
      children: 0,
      visitors: 0,
      ushers_protocol: 0,
      online_viewers: 0,
      counted_by: '',
      notes: '',
    });
    setIsResetHeadcountConfirmOpen(false);
    info('Counters reset to zero.');
  };

  // Department members for Batch Check-In
  const departmentMembers = useMemo(() => {
    let list = members.filter((m) => !m.is_archived);
    if (selectedMinistryId !== 'all') {
      const selectedMin = ministries.find((min) => min.id === selectedMinistryId);
      list = list.filter(
        (m) =>
          m.ministry_id === selectedMinistryId ||
          (selectedMin && m.ministry_name?.toLowerCase() === selectedMin.name.toLowerCase())
      );
    }
    if (batchSearchTerm.trim()) {
      const term = batchSearchTerm.toLowerCase();
      list = list.filter(
        (m) =>
          m.first_name.toLowerCase().includes(term) ||
          m.last_name.toLowerCase().includes(term) ||
          m.member_id.toLowerCase().includes(term) ||
          (m.phone && m.phone.includes(term))
      );
    }
    return list;
  }, [members, ministries, selectedMinistryId, batchSearchTerm]);

  // Handle Commit Batch Check-In
  const handleCommitBatchCheckIn = () => {
    if (batchSelectedMembers.size === 0) {
      error('Please select at least one member to check in.');
      return;
    }

    const items = Array.from(batchSelectedMembers).map((id) => ({
      personType: 'member' as const,
      personId: id,
      method: 'manual' as const,
    }));

    const result = batchRecordAttendance(selectedServiceId, selectedDate, items);
    success(
      `Successfully checked in ${result.added} member(s). ${
        result.skipped > 0 ? `(${result.skipped} were already checked in)` : ''
      }`
    );
    setBatchSelectedMembers(new Set());
  };

  // Absentee Radar: Members who are NOT checked in for selected service
  const absentMembers = useMemo(() => {
    const presentMemberIds = new Set(membersCheckedIn.map((r) => r.member_id));
    return members
      .filter((m) => !m.is_archived && m.status === 'active')
      .filter((m) => !presentMemberIds.has(m.id))
      .map((m) => {
        // Find last attended record
        const memberPastAtt = attendance
          .filter((a) => a.member_id === m.id)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const lastAttended = memberPastAtt[0]?.date || 'Never recorded';

        return {
          ...m,
          lastAttended,
        };
      });
  }, [members, membersCheckedIn, attendance]);

  // Filtered Attendees in Terminal
  const filteredLoggedAttendees = useMemo(() => {
    return currentSessionRecords.filter((rec) => {
      if (attendeeFilter === 'member' && rec.person_type !== 'member') return false;
      if (attendeeFilter === 'visitor' && rec.person_type !== 'visitor') return false;

      if (attendeeSearch.trim()) {
        const term = attendeeSearch.toLowerCase();
        const name = (rec.person_name || rec.member_name || rec.visitor_name || '').toLowerCase();
        return name.includes(term);
      }
      return true;
    });
  }, [currentSessionRecords, attendeeFilter, attendeeSearch]);

  const handleConfirmUndoCheckIn = () => {
    if (!recordToUndo) return;
    removeAttendance(recordToUndo.id);
    info(`Check-in for ${recordToUndo.person_name || recordToUndo.member_name || 'attendee'} reversed.`);
    setRecordToUndo(null);
  };

  // Export Attendance CSV
  const handleExportCSV = () => {
    if (currentSessionRecords.length === 0) {
      error('No attendance records to export for this service session.');
      return;
    }

    const headers = [
      'Attendance ID',
      'Service Name',
      'Date',
      'Person Name',
      'Person Type',
      'Check-In Method',
      'Check-In Time',
      'Status',
    ];

    const rows = currentSessionRecords.map((r) => [
      r.id,
      r.service_name,
      r.date,
      `"${r.person_name || r.member_name || r.visitor_name || 'Attendee'}"`,
      r.person_type || 'member',
      r.check_in_method || 'manual',
      r.check_in_time || '',
      r.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const safeServiceName = (selectedService?.name || 'Worship_Service').replace(/[^a-zA-Z0-9]/g, '_');
    const churchPrefix = (settings?.short_name || 'Church').replace(/[^a-zA-Z0-9]/g, '_');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `${churchPrefix}_Attendance_${safeServiceName}_${selectedDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    success('Attendance record CSV downloaded.');
  };

  // Analytics Data (Weekly trends)
  const weeklyTrendData = useMemo(() => {
    // Unique dates from headcounts and attendance
    const datesMap = new Map<string, { date: string; total: number; men: number; women: number; children: number; visitors: number }>();

    // Load from headcounts
    headcounts.forEach((h) => {
      datesMap.set(h.date, {
        date: h.date,
        total: h.total_auditorium,
        men: h.men,
        women: h.women,
        children: h.children,
        visitors: h.visitors,
      });
    });

    // Also include attendance check-in dates if not already present
    attendance.forEach((a) => {
      if (!datesMap.has(a.date)) {
        const recordsOnDate = attendance.filter((att) => att.date === a.date);
        const visitorsCount = recordsOnDate.filter((att) => att.person_type === 'visitor').length;
        datesMap.set(a.date, {
          date: a.date,
          total: recordsOnDate.length,
          men: 0,
          women: 0,
          children: 0,
          visitors: visitorsCount,
        });
      }
    });

    return Array.from(datesMap.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-6);
  }, [headcounts, attendance]);

  // Demographic Pie Data
  const demographicData = useMemo(() => {
    const fromHeadcount = [
      { name: 'Men', value: headcountForm.men, color: '#0d9488' },
      { name: 'Women', value: headcountForm.women, color: '#0284c7' },
      { name: 'Youth', value: headcountForm.youth, color: '#8b5cf6' },
      { name: 'Children', value: headcountForm.children, color: '#f59e0b' },
      { name: 'Visitors', value: headcountForm.visitors, color: '#10b981' },
    ].filter((d) => d.value > 0);

    if (fromHeadcount.length > 0) return fromHeadcount;

    // Fallback to current session check-ins if headcount form has not been entered yet
    if (currentSessionRecords.length > 0) {
      let maleMembers = 0;
      let femaleMembers = 0;
      let visitorsCount = 0;

      currentSessionRecords.forEach((r) => {
        if (r.person_type === 'visitor') {
          visitorsCount++;
        } else {
          const m = members.find((mem) => mem.id === r.member_id);
          if (m?.gender === 'female') femaleMembers++;
          else maleMembers++;
        }
      });

      return [
        { name: 'Male Members', value: maleMembers, color: '#0d9488' },
        { name: 'Female Members', value: femaleMembers, color: '#0284c7' },
        { name: 'Visitors', value: visitorsCount, color: '#10b981' },
      ].filter((d) => d.value > 0);
    }

    return [];
  }, [headcountForm, currentSessionRecords, members]);

  // Expected capacity comparison
  const capacityTarget = selectedService?.expected_attendance || 0;
  const capacityPercent = Math.min(
    capacityTarget > 0 ? Math.round((totalAuditorium / capacityTarget) * 100) : 0,
    150
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <ClipboardCheck className="w-7 h-7 text-teal-700" />
              Service Attendance & Check-In
            </h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
              Live Terminal
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time congregation headcount, usher audit tallies, department registers, and personal check-in
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-60 cursor-pointer"
            title={`Refresh attendance records • Last updated: ${lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 ${isRefreshing ? 'animate-spin text-teal-600' : ''}`} />
            <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={() => setIsKioskOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-md shadow-teal-700/20"
          >
            <Maximize2 className="w-4 h-4" />
            <span>Launch Kiosk Mode</span>
          </button>

          <button
            onClick={() => setIsPrintRegisterOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition shadow-xs"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print Register</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition shadow-xs"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Service & Date Selector Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Select Service
            </label>
            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-teal-600 focus:bg-white"
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.start_time})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Service Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-teal-600 focus:bg-white"
            />
          </div>

          <div className="pt-4 flex items-center gap-1.5">
            <button
              onClick={() => handleSetQuickDate('today')}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition"
            >
              Today
            </button>
            <button
              onClick={() => handleSetQuickDate('lastSunday')}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition"
            >
              Last Sunday
            </button>
            <button
              onClick={() => handleSetQuickDate('lastWednesday')}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition"
            >
              Last Midweek
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-slate-500">Service Day:</span>
          <span className="font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
            {formatServiceDayString(selectedDate)}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Verified Check-Ins
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {currentSessionRecords.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {membersCheckedIn.length} members • {visitorsCheckedIn.length} visitors
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Auditorium Headcount
          </span>
          <div className="text-2xl font-black text-teal-800 mt-1">
            {totalAuditorium}
          </div>
          <p className="text-[11px] text-teal-700 mt-0.5">
            Usher verified tally
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Church Reach
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {totalChurchReach}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            +{headcountForm.online_viewers} online streamers
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            First-Time Visitors
          </span>
          <div className="text-2xl font-black text-blue-800 mt-1">
            {headcountForm.visitors || visitorsCheckedIn.length}
          </div>
          <p className="text-[11px] text-blue-700 mt-0.5">
            Ready for follow-up
          </p>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Capacity Fill Rate
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900">{capacityPercent}%</span>
            <span className="text-xs text-slate-400">
              / {capacityTarget > 0 ? `${capacityTarget} seats` : 'capacity not set'}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                capacityPercent >= 90 ? 'bg-emerald-600' : 'bg-teal-600'
              }`}
              style={{ width: `${Math.min(capacityPercent, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="border-b border-slate-200 flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
        <button
          onClick={() => setActiveTab('checkin')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 rounded-t-xl transition whitespace-nowrap ${
            activeTab === 'checkin'
              ? 'border-teal-700 text-teal-800 bg-teal-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Live Check-In Terminal</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-700">
            {currentSessionRecords.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('headcount')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 rounded-t-xl transition whitespace-nowrap ${
            activeTab === 'headcount'
              ? 'border-teal-700 text-teal-800 bg-teal-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Auditorium Headcount (Usher Board)</span>
        </button>

        <button
          onClick={() => setActiveTab('batch')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 rounded-t-xl transition whitespace-nowrap ${
            activeTab === 'batch'
              ? 'border-teal-700 text-teal-800 bg-teal-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Batch Department Check-In</span>
        </button>

        <button
          onClick={() => setActiveTab('absentees')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 rounded-t-xl transition whitespace-nowrap ${
            activeTab === 'absentees'
              ? 'border-teal-700 text-teal-800 bg-teal-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <UserX className="w-4 h-4" />
          <span>Absentee Radar & Pastoral Follow-Up</span>
          {absentMembers.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 border border-amber-200">
              {absentMembers.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 rounded-t-xl transition whitespace-nowrap ${
            activeTab === 'analytics'
              ? 'border-teal-700 text-teal-800 bg-teal-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Analytics & Trends</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 rounded-t-xl transition whitespace-nowrap ${
            activeTab === 'history'
              ? 'border-teal-700 text-teal-800 bg-teal-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>Session History</span>
        </button>
      </div>

      {/* TAB 1: LIVE CHECK-IN TERMINAL */}
      {activeTab === 'checkin' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
          {/* Left 2 Cols: Search and Quick Check-in terminal */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Search className="w-4 h-4 text-teal-700" />
                    Member Quick Check-In Scanner
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Type member name, Member ID (e.g. {settings.short_name || 'GWCC'}-0001) or phone number to check in.
                  </p>
                </div>

                <button
                  onClick={() => setIsQuickVisitorOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl text-xs font-bold transition shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Quick Add Visitor</span>
                </button>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchMemberTerm}
                  onChange={(e) => setSearchMemberTerm(e.target.value)}
                  placeholder={`Search member to check-in (e.g. Kwame, Abena, ${settings.short_name || 'GWCC'}-0002, 0244...)`}
                  className="w-full pl-10 pr-4 py-3 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-teal-600 font-medium transition shadow-inner"
                  autoFocus
                />
              </div>

              {/* Live Search Results */}
              {searchMemberTerm.trim() && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-64 overflow-y-auto shadow-md">
                  {matchingMembers.length > 0 ? (
                    matchingMembers.map((m) => {
                      const isAlreadyIn = currentSessionRecords.some((r) => r.member_id === m.id);
                      return (
                        <div
                          key={m.id}
                          className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 font-black flex items-center justify-center text-xs">
                              {m.first_name[0]}
                              {m.last_name[0]}
                            </div>
                            <div>
                              <p className="font-bold text-xs text-slate-900">
                                {m.first_name} {m.last_name}
                              </p>
                              <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
                                <span>{m.member_id}</span>
                                <span>•</span>
                                <span>{m.phone}</span>
                                {m.ministry_name && (
                                  <>
                                    <span>•</span>
                                    <span className="text-teal-700">{m.ministry_name}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setDigitalPassMember(m)}
                              className="p-1.5 text-slate-400 hover:text-teal-700 rounded-lg hover:bg-teal-50 transition"
                              title="Show Member QR Digital Pass"
                            >
                              <QrCode className="w-4 h-4" />
                            </button>

                            {isAlreadyIn ? (
                              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                <CheckCircle className="w-3.5 h-3.5" /> Checked In
                              </span>
                            ) : (
                              <button
                                onClick={() => handleCheckIn('member', m.id, 'search')}
                                className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold transition shadow-xs"
                              >
                                Check In
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-6 text-center text-xs text-slate-400 space-y-2">
                      <p>No registered members match &quot;{searchMemberTerm}&quot;.</p>
                      <button
                        onClick={() => setIsQuickVisitorOpen(true)}
                        className="text-teal-700 hover:text-teal-800 font-bold underline"
                      >
                        Click here to register them as a visitor
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Logged Check-Ins Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                    Logged Check-Ins ({filteredLoggedAttendees.length})
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Date: {selectedDate}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter attendees..."
                      value={attendeeSearch}
                      onChange={(e) => setAttendeeSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-white focus:outline-teal-600 font-medium"
                    />
                  </div>

                  <select
                    value={attendeeFilter}
                    onChange={(e) => setAttendeeFilter(e.target.value as any)}
                    className="text-xs font-bold text-slate-700 border border-slate-200 rounded-xl px-2.5 py-1.5 bg-white"
                  >
                    <option value="all">All Attendees</option>
                    <option value="member">Members Only</option>
                    <option value="visitor">Visitors Only</option>
                  </select>
                </div>
              </div>

              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {filteredLoggedAttendees.length > 0 ? (
                  filteredLoggedAttendees.map((rec, index) => (
                    <div
                      key={rec.id}
                      className="p-3.5 flex items-center justify-between hover:bg-slate-50 text-xs transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 font-mono text-[11px] w-6 text-center">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-bold text-slate-900">
                            {rec.person_name || rec.member_name || rec.visitor_name}
                          </p>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold capitalize ${
                                rec.person_type === 'visitor'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {rec.person_type || 'member'}
                            </span>
                            <span>•</span>
                            <span className="capitalize">Method: {rec.check_in_method}</span>
                            {rec.check_in_time && (
                              <>
                                <span>•</span>
                                <span>
                                  {new Date(rec.check_in_time).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setRecordToUndo(rec)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                        title="Undo check-in"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-slate-400 space-y-1">
                    <p>No individual check-ins recorded yet for {selectedService?.name} on this date.</p>
                    <p className="text-[11px] text-slate-400">
                      Use the search bar above or launch Kiosk Mode for the foyer entrance desk.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Col: Quick Summary & Headcount Quick Widget */}
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-teal-700" />
                  Service Summary
                </h3>
                <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  {selectedService?.type?.toUpperCase() || 'SUNDAY'}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Service</span>
                  <span className="font-bold text-slate-900">{selectedService?.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Service Time</span>
                  <span className="font-bold text-slate-900">
                    {selectedService?.start_time} - {selectedService?.end_time}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Auditorium Headcount</span>
                  <span className="font-black text-teal-800 text-sm">{totalAuditorium}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Online Streamers</span>
                  <span className="font-bold text-slate-700">{headcountForm.online_viewers}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Logged Verified Names</span>
                  <span className="font-bold text-emerald-800">{currentSessionRecords.length}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setIsKioskOpen(true)}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-teal-400" />
                  <span>Open Self Check-In Kiosk</span>
                </button>
              </div>
            </div>

            {/* Quick Visitor Follow-up Card */}
            <div className="bg-gradient-to-br from-blue-900 to-slate-900 p-5 rounded-2xl text-white shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-5 h-5 text-blue-300" />
                <h4 className="font-bold text-sm">First-Time Visitors ({visitorsCheckedIn.length})</h4>
              </div>
              <p className="text-xs text-blue-100/80 leading-relaxed">
                Connect our newcomers to the Pastoral Care & Follow-Up team before they leave the premises.
              </p>
              <button
                onClick={() => setIsQuickVisitorOpen(true)}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register New Visitor</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUDITORIUM HEADCOUNT (USHER BOARD) */}
      {activeTab === 'headcount' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-teal-700" />
                  Official Auditorium Headcount & Usher Tally Sheet
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Count reported by protocol and ushering board for {selectedService?.name} on {selectedDate}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetHeadcount}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Counters</span>
                </button>
                <button
                  onClick={handleSaveHeadcount}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition shadow-md shadow-teal-700/20"
                >
                  <Save className="w-4 h-4" />
                  <span>Save & Lock to Records</span>
                </button>
              </div>
            </div>

            {/* Counters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Men In Attendance
                </span>
                <input
                  type="number"
                  min="0"
                  value={headcountForm.men}
                  onChange={(e) =>
                    setHeadcountForm({ ...headcountForm, men: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full text-2xl font-black text-slate-900 bg-white border border-slate-300 rounded-xl p-2.5 font-mono"
                />
                <p className="text-[11px] text-slate-400">Adult males</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Women In Attendance
                </span>
                <input
                  type="number"
                  min="0"
                  value={headcountForm.women}
                  onChange={(e) =>
                    setHeadcountForm({ ...headcountForm, women: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full text-2xl font-black text-slate-900 bg-white border border-slate-300 rounded-xl p-2.5 font-mono"
                />
                <p className="text-[11px] text-slate-400">Adult females</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Youth & Young Adults
                </span>
                <input
                  type="number"
                  min="0"
                  value={headcountForm.youth}
                  onChange={(e) =>
                    setHeadcountForm({ ...headcountForm, youth: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full text-2xl font-black text-slate-900 bg-white border border-slate-300 rounded-xl p-2.5 font-mono"
                />
                <p className="text-[11px] text-slate-400">Ages 13 to 25</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Children & Sunday School
                </span>
                <input
                  type="number"
                  min="0"
                  value={headcountForm.children}
                  onChange={(e) =>
                    setHeadcountForm({ ...headcountForm, children: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full text-2xl font-black text-slate-900 bg-white border border-slate-300 rounded-xl p-2.5 font-mono"
                />
                <p className="text-[11px] text-slate-400">Children classrooms & crèche</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  First-Time Visitors
                </span>
                <input
                  type="number"
                  min="0"
                  value={headcountForm.visitors}
                  onChange={(e) =>
                    setHeadcountForm({ ...headcountForm, visitors: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full text-2xl font-black text-blue-800 bg-white border border-slate-300 rounded-xl p-2.5 font-mono"
                />
                <p className="text-[11px] text-blue-600">New first-time attendees</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Ushers & Protocol On Duty
                </span>
                <input
                  type="number"
                  min="0"
                  value={headcountForm.ushers_protocol}
                  onChange={(e) =>
                    setHeadcountForm({
                      ...headcountForm,
                      ushers_protocol: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full text-2xl font-black text-slate-900 bg-white border border-slate-300 rounded-xl p-2.5 font-mono"
                />
                <p className="text-[11px] text-slate-400">Protocol & security team</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Online Stream Viewers
                </span>
                <input
                  type="number"
                  min="0"
                  value={headcountForm.online_viewers}
                  onChange={(e) =>
                    setHeadcountForm({
                      ...headcountForm,
                      online_viewers: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full text-2xl font-black text-slate-900 bg-white border border-slate-300 rounded-xl p-2.5 font-mono"
                />
                <p className="text-[11px] text-slate-400">Facebook Live & YouTube peak</p>
              </div>

              <div className="bg-teal-50 p-4 rounded-xl border border-teal-200 flex flex-col justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
                  Total Sanctuary Count
                </span>
                <div className="text-3xl font-black text-teal-900 font-mono mt-1">
                  {totalAuditorium}
                </div>
                <p className="text-[11px] text-teal-700">Physical auditorium congregation</p>
              </div>
            </div>

            {/* Counted By & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Head Usher / Counted By
                </label>
                <input
                  type="text"
                  value={headcountForm.counted_by}
                  onChange={(e) => setHeadcountForm({ ...headcountForm, counted_by: e.target.value })}
                  placeholder="Enter usher or verifier name"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-teal-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Service Notes / Weather / Canopies
                </label>
                <input
                  type="text"
                  value={headcountForm.notes}
                  onChange={(e) => setHeadcountForm({ ...headcountForm, notes: e.target.value })}
                  placeholder="e.g. Overflow courtyard canopy opened; heavy rain in early morning..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-teal-600 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Historical Headcounts Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                Archived Headcounts Log ({headcounts.length} Recorded)
              </h4>
              <span className="text-xs text-slate-500">Usher Audit Records</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Service</th>
                    <th className="p-3 text-right">Men</th>
                    <th className="p-3 text-right">Women</th>
                    <th className="p-3 text-right">Youth</th>
                    <th className="p-3 text-right">Children</th>
                    <th className="p-3 text-right">Visitors</th>
                    <th className="p-3 text-right font-black text-teal-800">Total Sanctuary</th>
                    <th className="p-3">Counted By</th>
                    <th className="p-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {headcounts.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-bold text-slate-900 font-mono">{h.date}</td>
                      <td className="p-3 font-medium text-slate-800">{h.service_name}</td>
                      <td className="p-3 text-right font-mono">{h.men}</td>
                      <td className="p-3 text-right font-mono">{h.women}</td>
                      <td className="p-3 text-right font-mono">{h.youth}</td>
                      <td className="p-3 text-right font-mono">{h.children}</td>
                      <td className="p-3 text-right font-mono text-blue-700 font-bold">{h.visitors}</td>
                      <td className="p-3 text-right font-mono font-black text-teal-800 text-sm">
                        {h.total_auditorium}
                      </td>
                      <td className="p-3 text-slate-600">{h.counted_by || 'Usher Board'}</td>
                      <td className="p-3 text-slate-500 text-[11px] max-w-xs truncate">
                        {h.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BATCH DEPARTMENT CHECK-IN */}
      {activeTab === 'batch' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-teal-700" />
                Batch Ministry & Department Check-In
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Mass check-in members by their church department (Voice of Dominion, Ushers, Youth, etc.)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const allIds = new Set(departmentMembers.map((m) => m.id));
                  setBatchSelectedMembers(allIds);
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Select All ({departmentMembers.length})
              </button>
              <button
                onClick={() => setBatchSelectedMembers(new Set())}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Clear
              </button>
              <button
                onClick={handleCommitBatchCheckIn}
                disabled={batchSelectedMembers.size === 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition shadow-md shadow-teal-700/20 disabled:opacity-40"
              >
                <Check className="w-4 h-4" />
                <span>Commit Check-In ({batchSelectedMembers.size})</span>
              </button>
            </div>
          </div>

          {/* Department Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Filter by Ministry / Department
              </label>
              <select
                value={selectedMinistryId}
                onChange={(e) => setSelectedMinistryId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold text-slate-800 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-teal-600"
              >
                <option value="all">All Church Ministries ({members.length} Members)</option>
                {ministries.map((min) => (
                  <option key={min.id} value={min.id}>
                    {min.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Search within this department
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter name or ID..."
                  value={batchSearchTerm}
                  onChange={(e) => setBatchSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-teal-600 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Member Selection List */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {departmentMembers.length > 0 ? (
              departmentMembers.map((m) => {
                const isSelected = batchSelectedMembers.has(m.id);
                const isAlreadyCheckedIn = alreadyCheckedInIds.has(m.id);

                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      if (!isAlreadyCheckedIn) {
                        const next = new Set(batchSelectedMembers);
                        if (next.has(m.id)) next.delete(m.id);
                        else next.add(m.id);
                        setBatchSelectedMembers(next);
                      }
                    }}
                    className={`p-3.5 flex items-center justify-between transition cursor-pointer ${
                      isAlreadyCheckedIn
                        ? 'bg-slate-50 opacity-60 cursor-default'
                        : isSelected
                        ? 'bg-teal-50/70 border-l-4 border-teal-700'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected || isAlreadyCheckedIn}
                        disabled={isAlreadyCheckedIn}
                        onChange={() => {}} // handled by row click
                        className="w-4 h-4 text-teal-600 rounded-sm focus:ring-teal-500"
                      />
                      <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-xs">
                        {m.first_name[0]}
                        {m.last_name[0]}
                      </div>
                      <div>
                        <p className="font-bold text-xs text-slate-900">
                          {m.first_name} {m.last_name}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {m.member_id} • {m.phone}
                        </p>
                      </div>
                    </div>

                    <div>
                      {isAlreadyCheckedIn ? (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Already Present
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 font-medium">
                          {m.ministry_name || 'Church Member'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                No members found in this selection.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: ABSENTEE RADAR & PASTORAL FOLLOW-UP */}
      {activeTab === 'absentees' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UserX className="w-5 h-5 text-amber-600" />
                Absentee Radar & Pastoral Outreach
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Active registered church members who have not checked in today ({selectedDate}).
                Reach out via WhatsApp or phone.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-xl border border-amber-200">
                {absentMembers.length} Members Missing Today
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">Member Name</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Ministry / Fellowship</th>
                  <th className="p-3">Cell Group</th>
                  <th className="p-3">Last Recorded Attendance</th>
                  <th className="p-3 text-right">Pastoral Outreach</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {absentMembers.length > 0 ? (
                  absentMembers.map((m) => {
                    const cleanPhone = m.phone ? m.phone.replace(/[^0-9]/g, '') : '';
                    const ghanaPhone = cleanPhone.startsWith('0')
                      ? '233' + cleanPhone.slice(1)
                      : cleanPhone;

                    const whatsappMessage = encodeURIComponent(
                      `Praise the Lord Brother/Sister ${m.first_name}, greetings from ${settings.church_name || 'the church family'}! We missed your presence at our worship service today. Just checking on your well-being and praying God's richest blessings over your week. Let us know if you need any pastoral prayers. God bless you!`
                    );

                    return (
                      <tr key={m.id} className="hover:bg-slate-50 transition">
                        <td className="p-3">
                          <p className="font-bold text-slate-900">
                            {m.first_name} {m.last_name}
                          </p>
                          <span className="text-[10px] text-slate-400 font-mono">{m.member_id}</span>
                        </td>
                        <td className="p-3 font-mono text-slate-700">{m.phone}</td>
                        <td className="p-3 text-slate-600">{m.ministry_name || 'General Member'}</td>
                        <td className="p-3 text-slate-600">{m.small_group_name || 'None'}</td>
                        <td className="p-3 font-mono text-slate-600">
                          {m.lastAttended !== 'Never recorded' ? (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px]">
                              {m.lastAttended}
                            </span>
                          ) : (
                            <span className="text-slate-400">None</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {cleanPhone && (
                              <a
                                href={`https://wa.me/${ghanaPhone}?text=${whatsappMessage}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                                title="Send WhatsApp Pastoral Check-In"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>WhatsApp Care</span>
                              </a>
                            )}
                            <a
                              href={`tel:${m.phone}`}
                              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition"
                              title="Direct Phone Call"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                      All active registered members are logged present today! Glory to God!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: ANALYTICS & TRENDS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Weekly Attendance Growth Trend */}
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Congregation Attendance Trend (Recent Weeks)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Total auditorium headcount across verified Sunday services
                  </p>
                </div>
                <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg">
                  Auditorium Headcount
                </span>
              </div>

              <div className="h-72 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyTrendData}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderRadius: '12px',
                        border: 'none',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#0d9488"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorTotal)"
                      name="Total Auditorium"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Demographic Breakdown Pie */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Demographic Share</h3>
                <p className="text-xs text-slate-500">Gender & Age group distribution</p>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={demographicData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {demographicData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-600"></span>
                  <span className="text-slate-600">Men: {headcountForm.men}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-600"></span>
                  <span className="text-slate-600">Women: {headcountForm.women}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                  <span className="text-slate-600">Youth: {headcountForm.youth}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <span className="text-slate-600">Children: {headcountForm.children}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: SESSION HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-teal-700" />
                Historical Attendance Logs & Registers
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Past Sunday and midweek worship sessions across church calendar
              </p>
            </div>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export All Records</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {headcounts.map((h) => (
              <div
                key={h.id}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 p-3 rounded-xl transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{h.service_name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                      {h.date}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{h.notes || 'Worship service session'}</p>
                  <p className="text-[11px] text-slate-400">Recorded by: {h.counted_by || 'Usher Board'}</p>
                </div>

                <div className="flex items-center gap-6 text-xs">
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Headcount</span>
                    <p className="font-black text-teal-800 text-base">{h.total_auditorium}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Visitors</span>
                    <p className="font-bold text-blue-700">{h.visitors}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedServiceId(h.service_id);
                      setSelectedDate(h.date);
                      setActiveTab('checkin');
                    }}
                    className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg font-bold text-xs transition"
                  >
                    View Session
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <AttendanceKioskModal
        isOpen={isKioskOpen}
        onClose={() => setIsKioskOpen(false)}
        service={selectedService}
        date={selectedDate}
        members={members}
        visitors={visitors}
        settings={settings}
        alreadyCheckedInIds={alreadyCheckedInIds}
        onCheckIn={(type, id) => handleCheckIn(type, id, 'qr_code')}
        onOpenQuickVisitorModal={() => {
          setIsKioskOpen(false);
          setIsQuickVisitorOpen(true);
        }}
      />

      <QuickAddVisitorModal
        isOpen={isQuickVisitorOpen}
        onClose={() => setIsQuickVisitorOpen(false)}
        serviceId={selectedServiceId}
        serviceName={selectedService?.name || 'Worship Service'}
        date={selectedDate}
      />

      <PrintAttendanceRegisterModal
        isOpen={isPrintRegisterOpen}
        onClose={() => setIsPrintRegisterOpen(false)}
        service={selectedService}
        date={selectedDate}
        settings={settings}
        records={currentSessionRecords}
        headcount={currentHeadcountRecord}
      />

      {digitalPassMember && (
        <DigitalPassModal
          isOpen={!!digitalPassMember}
          onClose={() => setDigitalPassMember(null)}
          member={digitalPassMember}
          settings={settings}
        />
      )}

      {/* Confirm Undo Check-In Modal (replaces window.confirm) */}
      {recordToUndo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900">Undo Check-In</h4>
                <p className="text-xs text-slate-500">Remove from session register</p>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to reverse the attendance check-in for{' '}
              <span className="font-bold text-slate-900">
                {recordToUndo.person_name || recordToUndo.member_name || recordToUndo.visitor_name}
              </span>
              ?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRecordToUndo(null)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmUndoCheckIn}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Yes, Reverse Check-In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Reset Headcount Modal (replaces window.confirm) */}
      {isResetHeadcountConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900">Reset Headcount</h4>
                <p className="text-xs text-slate-500">Clear tally sheet counts</p>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to reset all auditorium counters for this service to zero?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetHeadcountConfirmOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResetHeadcount}
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Reset to Zero
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
