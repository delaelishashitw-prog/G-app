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
import { useSearchParams } from 'react-router-dom';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { ChurchService, AttendanceRecord, HeadcountRecord, Member, Visitor } from '../types/database.types';
import { getChurchDateString, isValidDateString, formatServiceDayString, getQuickDate } from '../lib/attendanceDateUtils';
import { attendancePersonType, attendeeKey, uniquePresentAttendance, matchesAttendeeSearch, attendanceSessionError, headcountError, headcountTotal, buildAttendanceSessions, membersNotCheckedIn, attendanceCsv } from '../features/attendance/attendanceInsights';
import { resolveServiceId } from '../features/services/serviceInsights';

// Modals
import { AttendanceKioskModal } from '../components/attendance/AttendanceKioskModal';
import { QuickAddVisitorModal } from '../components/attendance/QuickAddVisitorModal';
import { PrintAttendanceRegisterModal } from '../components/attendance/PrintAttendanceRegisterModal';
import { DigitalPassModal } from '../components/attendance/DigitalPassModal';
import { ChildSafetyPickupModal } from '../components/attendance/ChildSafetyPickupModal';
import { ChildCheckInRecord } from '../types/database.types';

export const AttendancePage: React.FC = () => {
  const {
    services,
    members,
    visitors,
    ministries,
    attendance,
    headcounts,
    childCheckIns,
    summonChildParent,
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
  const { isAuthenticated, canAccess } = useAuth();
  const canEditAttendance = isAuthenticated && canAccess('attendance');
  const [searchParams] = useSearchParams();

  // Active service and date selection
  const requestedServiceId = searchParams.get('serviceId');
  const [selectedServiceId, setSelectedServiceId] = useState(requestedServiceId || services.find(service => service.is_active)?.id || services[0]?.id || '');
  React.useEffect(() => {
    if (requestedServiceId) setSelectedServiceId(requestedServiceId);
  }, [requestedServiceId]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const urlDate = searchParams.get('date');
    return urlDate == null ? getChurchDateString() : isValidDateString(urlDate) ? urlDate : '';
  });

  // Keep selectedDate in sync if URL param changes
  React.useEffect(() => {
    const urlDate = searchParams.get('date');
    if (urlDate != null) setSelectedDate(isValidDateString(urlDate) ? urlDate : '');
  }, [searchParams]);

  // Ensure selectedServiceId is kept in sync if services load or change
  React.useEffect(() => {
    if (!selectedServiceId && services.length > 0) {
      setSelectedServiceId(services.find(service => service.is_active)?.id || services[0].id);
    }
  }, [services, selectedServiceId]);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<
    'checkin' | 'headcount' | 'batch' | 'absentees' | 'children_security' | 'analytics' | 'history'
  >('checkin');

  // Search & Filters in Check-in terminal
  const [searchMemberTerm, setSearchMemberTerm] = useState('');
  const [attendeeFilter, setAttendeeFilter] = useState<'all' | 'member' | 'visitor'>('all');
  const [attendeeSearch, setAttendeeSearch] = useState('');
  const [childSearchTerm, setChildSearchTerm] = useState('');

  // Modals state
  const [isKioskOpen, setIsKioskOpen] = useState(false);
  const [isQuickVisitorOpen, setIsQuickVisitorOpen] = useState(false);
  const [isPrintRegisterOpen, setIsPrintRegisterOpen] = useState(false);
  const [digitalPassMember, setDigitalPassMember] = useState<Member | null>(null);
  const [isChildSafetyModalOpen, setIsChildSafetyModalOpen] = useState(false);
  const [selectedChildRecordForPass, setSelectedChildRecordForPass] = useState<ChildCheckInRecord | null>(null);

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
    () => services.find((s) => s.id === selectedServiceId),
    [services, selectedServiceId]
  );

  // Current session attendance records
  const currentSessionRecords = useMemo(
    () =>
      uniquePresentAttendance(attendance.filter(
        (a) => (resolveServiceId(a, services) || a.service_id) === selectedServiceId && a.date === selectedDate
      ).map(row => ({ ...row, service_id: selectedServiceId }))),
    [attendance, services, selectedServiceId, selectedDate]
  );

  const membersCheckedIn = useMemo(
    () => currentSessionRecords.filter((a) => attendancePersonType(a) === 'member'),
    [currentSessionRecords]
  );
  const visitorsCheckedIn = useMemo(
    () => currentSessionRecords.filter((a) => attendancePersonType(a) === 'visitor'),
    [currentSessionRecords]
  );

  const alreadyCheckedInIds = useMemo(() => {
    const set = new Set<string>();
    currentSessionRecords.forEach((r) => {
      if (r.member_id) set.add(attendeeKey('member', r.member_id));
      if (r.visitor_id) set.add(attendeeKey('visitor', r.visitor_id));
    });
    return set;
  }, [currentSessionRecords]);

  // Current Headcount Record for active service and date
  const currentHeadcountRecord = useMemo(
    () => headcounts.filter((h) => (resolveServiceId(h, services) || h.service_id) === selectedServiceId && h.date === selectedDate).sort((a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || ''))[0],
    [headcounts, services, selectedServiceId, selectedDate]
  );
  const sessionError = attendanceSessionError(selectedService, selectedDate);
  const canRecordSession = canEditAttendance && !sessionError;
  const canRegisterVisitor = canRecordSession && canAccess('visitors');
  const selectedDay = isValidDateString(selectedDate) ? new Date(`${selectedDate}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'Africa/Accra' }) : '';
  const sessionChildren = childCheckIns.filter(record => record.service_id === selectedServiceId && record.date === selectedDate);
  const sessions = useMemo(() => buildAttendanceSessions(services, attendance, headcounts), [services, attendance, headcounts]);
  const serviceSessions = sessions.filter(session => session.service_id === selectedServiceId);

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
  const [headcountDirty, setHeadcountDirty] = useState(false);
  const headcountDraftVersion = React.useRef(currentHeadcountRecord?.updated_at);
  const headcountConflict = headcountDirty && currentHeadcountRecord?.updated_at !== headcountDraftVersion.current;
  const editHeadcountForm = (values: typeof headcountForm) => {
    setHeadcountDirty(true);
    setHeadcountForm(values);
  };

  // Active session key to only re-initialize when switching service or date
  const activeSessionKey = `${selectedServiceId}_${selectedDate}`;
  const prevSessionKeyRef = React.useRef(activeSessionKey);

  // Sync form when selectedServiceId or selectedDate changes
  React.useEffect(() => {
    if (prevSessionKeyRef.current !== activeSessionKey || !headcountDirty) {
      prevSessionKeyRef.current = activeSessionKey;
      headcountDraftVersion.current = currentHeadcountRecord?.updated_at;
      if (currentHeadcountRecord) {
        setHeadcountForm({
          men: currentHeadcountRecord.men ?? 0,
          women: currentHeadcountRecord.women ?? 0,
          youth: currentHeadcountRecord.youth ?? 0,
          children: currentHeadcountRecord.children ?? 0,
          visitors: currentHeadcountRecord.visitors ?? 0,
          ushers_protocol: currentHeadcountRecord.ushers_protocol ?? 0,
          online_viewers: currentHeadcountRecord.online_viewers ?? 0,
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
      setHeadcountDirty(false);
    }
  }, [activeSessionKey, currentHeadcountRecord, visitorsCheckedIn.length, headcountDirty]);

  React.useEffect(() => { setBatchSelectedMembers(new Set()); }, [activeSessionKey, selectedMinistryId, batchSearchTerm]);

  const totalAuditorium = headcountTotal(headcountForm);

  const savedHeadcount = currentHeadcountRecord?.total_auditorium ?? 0;
  const totalChurchReach = savedHeadcount + (currentHeadcountRecord?.online_viewers ?? 0);

  // Search Members for Live Check-In
  const matchingMembers = useMemo(() => {
    const term = searchMemberTerm.trim().toLowerCase();
    if (!term) return [];
    return members
      .filter((m) => !m.is_archived)
      .filter(m => matchesAttendeeSearch(m, term))
      .slice(0, 10);
  }, [members, searchMemberTerm]);

  // Handle single check-in
  const handleCheckIn = (
    personType: 'member' | 'visitor',
    personId: string,
    method: 'manual' | 'search' | 'qr_code' = 'search'
  ) => {
    if (!canRecordSession) {
      const message = sessionError || 'Attendance staff access is required.';
      error(message);
      return { success: false, message };
    }
    const res = recordAttendance(selectedServiceId, personType, personId, method, selectedDate);
    if (res.success) {
      success(res.message);
      setSearchMemberTerm('');
    } else {
      error(res.message);
    }
    return res;
  };

  // Quick preset dates using timezone-safe calculator
  const handleSetQuickDate = (preset: 'today' | 'lastSunday' | 'lastWednesday') => {
    const newDate = getQuickDate(preset);
    setSelectedDate(newDate);
  };

  // Save Headcount
  const handleSaveHeadcount = () => {
    if (headcountConflict) { error('This headcount changed while you were editing. Load the latest saved headcount before saving.'); return; }
    if (!canRecordSession || headcountError(headcountForm)) {
      error(sessionError || headcountError(headcountForm) || 'Attendance staff access is required.');
      return;
    }
    try {
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
      setHeadcountDirty(false);
      success('Headcount saved for this service session.');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Headcount could not be saved.');
    }
  };

  // Reset Headcount (opens in-app confirmation modal)
  const handleResetHeadcount = () => {
    setIsResetHeadcountConfirmOpen(true);
  };

  const handleConfirmResetHeadcount = () => {
    editHeadcountForm({
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
          (selectedMin && m.ministry_name?.toLowerCase() === (selectedMin.name || '').toLowerCase())
      );
    }
    if (batchSearchTerm.trim()) {
      const term = batchSearchTerm.toLowerCase();
      list = list.filter(m => matchesAttendeeSearch(m, term));
    }
    return list;
  }, [members, ministries, selectedMinistryId, batchSearchTerm]);

  // Handle Commit Batch Check-In
  const handleCommitBatchCheckIn = () => {
    if (!canRecordSession) { error(sessionError || 'Attendance staff access is required.'); return; }
    if (batchSelectedMembers.size === 0) {
      error('Please select at least one member to check in.');
      return;
    }

    const visibleIds = new Set(departmentMembers.map(member => member.id));
    const items = Array.from(batchSelectedMembers).filter(id => visibleIds.has(id)).map((id) => ({
      personType: 'member' as const,
      personId: id,
      method: 'manual' as const,
    }));

    try {
      const result = batchRecordAttendance(selectedServiceId, selectedDate, items);
    success(
      `Successfully checked in ${result.added} member(s). ${
        result.skipped > 0 ? `(${result.skipped} were already checked in)` : ''
      }`
    );
    setBatchSelectedMembers(new Set());
    } catch (err) { error(err instanceof Error ? err.message : 'Batch check-in could not be saved.'); }
  };

  // Absentee Radar: Members who are NOT checked in for selected service
  const absentMembers = useMemo(() => {
    if (!isValidDateString(selectedDate) || selectedDate > getChurchDateString() || (!currentSessionRecords.length && !currentHeadcountRecord)) return [];
    return membersNotCheckedIn(members, currentSessionRecords, selectedDate)
      .map((m) => {
        // Find last attended record
        const memberPastAtt = attendance
          .filter((a) => a.member_id === m.id && a.status === 'present' && a.date <= selectedDate)
          .sort((a, b) => b.date.localeCompare(a.date));
        const lastAttended = memberPastAtt[0]?.date || 'Never recorded';

        return {
          ...m,
          lastAttended,
        };
      });
  }, [members, currentSessionRecords, currentHeadcountRecord, attendance, selectedDate]);

  // Filtered Attendees in Terminal
  const filteredLoggedAttendees = useMemo(() => {
    return currentSessionRecords.filter((rec) => {
      if (attendeeFilter === 'member' && attendancePersonType(rec) !== 'member') return false;
      if (attendeeFilter === 'visitor' && attendancePersonType(rec) !== 'visitor') return false;

      if (attendeeSearch.trim()) {
        const term = attendeeSearch.toLowerCase();
        const name = (rec.person_name || rec.member_name || rec.visitor_name || '').toLowerCase();
        return name.includes(term);
      }
      return true;
    });
  }, [currentSessionRecords, attendeeFilter, attendeeSearch]);

  const handleConfirmUndoCheckIn = () => {
    if (!recordToUndo || !canEditAttendance) return;
    removeAttendance(recordToUndo.id);
    info(`Check-in for ${recordToUndo.person_name || recordToUndo.member_name || 'attendee'} reversed.`);
    setRecordToUndo(null);
  };

  // The session export follows the selected service; the audit export contains every stored row.
  const handleExportCSV = (allRecords = false) => {
    const rows = allRecords ? attendance : currentSessionRecords;
    if (!rows.length) { error('No attendance records to export.'); return; }
    const url = URL.createObjectURL(new Blob([attendanceCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    const serviceName = (selectedService?.name || 'Service').replace(/[^a-zA-Z0-9]/g, '_');
    const prefix = (settings.short_name || 'Church').replace(/[^a-zA-Z0-9]/g, '_');
    link.download = allRecords ? `${prefix}_All_Attendance.csv` : `${prefix}_Attendance_${serviceName}_${selectedDate}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    success('Attendance CSV downloaded.');
  };

  // One point per selected service session. A saved headcount takes precedence over unique check-ins.
  const weeklyTrendData = serviceSessions.filter(session => session.date <= getChurchDateString())
    .slice(0, 6).reverse().map(session => ({
      date: session.date,
      total: session.headcount?.total_auditorium ?? session.checkins,
    }));

  const demographicData = useMemo(() => {
    if (currentHeadcountRecord) return [
      { name: 'Men', value: currentHeadcountRecord.men ?? 0, color: '#0d9488' },
      { name: 'Women', value: currentHeadcountRecord.women ?? 0, color: '#0284c7' },
      { name: 'Youth', value: currentHeadcountRecord.youth ?? 0, color: '#8b5cf6' },
      { name: 'Children', value: currentHeadcountRecord.children ?? 0, color: '#f59e0b' },
      { name: 'Visitors', value: currentHeadcountRecord.visitors ?? 0, color: '#10b981' },
      { name: 'Ushers', value: currentHeadcountRecord.ushers_protocol ?? 0, color: '#64748b' },
    ].filter(item => item.value > 0);
    const memberMap = new Map(members.map(member => [member.id, member]));
    let male = 0, female = 0, unspecified = 0, visitorCount = 0;
    currentSessionRecords.forEach(row => {
      if (attendancePersonType(row) === 'visitor') { visitorCount++; return; }
      const gender = memberMap.get(row.member_id || '')?.gender;
      if (gender === 'male') male++;
      else if (gender === 'female') female++;
      else unspecified++;
    });
    return [
      { name: 'Male Members', value: male, color: '#0d9488' },
      { name: 'Female Members', value: female, color: '#0284c7' },
      { name: 'Unspecified', value: unspecified, color: '#64748b' },
      { name: 'Visitors', value: visitorCount, color: '#10b981' },
    ].filter(item => item.value > 0);
  }, [currentHeadcountRecord, currentSessionRecords, members]);

  const capacityTarget = selectedService?.expected_attendance || 0;
  const capacityPercent = capacityTarget > 0
    ? Math.round(((currentHeadcountRecord?.total_auditorium ?? currentSessionRecords.length) / capacityTarget) * 100) : 0;

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
            onClick={() => {
              setSelectedChildRecordForPass(null);
              setIsChildSafetyModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition shadow-xs"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Child Safety Tags</span>
          </button>

          <button
            onClick={() => setIsKioskOpen(true)}
            disabled={!canRecordSession}
            className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-md shadow-teal-700/20"
          >
            <Maximize2 className="w-4 h-4" />
            <span>Open Check-In Screen</span>
          </button>

          <button
            onClick={() => setIsPrintRegisterOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition shadow-xs"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print Register</span>
          </button>

          <button
            onClick={() => handleExportCSV()}
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
          <div className="min-w-0 max-w-full">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Select Service
            </label>
            <select
              aria-label="Attendance service"
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              className="max-w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-teal-600 focus:bg-white"
            >
              {!services.some(service => service.id === selectedServiceId) && <option value={selectedServiceId}>Unlinked historical service</option>}
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.is_active ? s.name : `Archived · ${s.name} [${s.id.slice(-8)}]`}{s.start_time ? ` (${s.start_time})` : ''}
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
              aria-label="Attendance date (GMT)"
              max={getChurchDateString()}
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

      {sessionError && <p role="status" className="p-3 rounded-xl bg-amber-50 text-amber-900 text-sm">{sessionError}</p>}
      {!sessionError && selectedService && selectedDay !== selectedService.day_of_week && <p role="status" className="p-3 rounded-xl bg-amber-50 text-amber-900 text-sm">The selected date is a {selectedDay}; this service is normally on {selectedService.day_of_week}. Check the service and date before recording an exceptional session.</p>}

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
            {savedHeadcount}
          </div>
          <p className="text-[11px] text-teal-700 mt-0.5">
            {currentHeadcountRecord ? 'Saved usher headcount' : 'No headcount saved'}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Headcount + Online Views
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {totalChurchReach}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            +{currentHeadcountRecord?.online_viewers ?? 0} online views
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Visitor Check-Ins
          </span>
          <div className="text-2xl font-black text-blue-800 mt-1">
            {visitorsCheckedIn.length}
          </div>
          <p className="text-[11px] text-blue-700 mt-0.5">
            Ready for follow-up
          </p>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Attendance Target
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900">{capacityPercent}%</span>
            <span className="text-xs text-slate-400">
              / {capacityTarget > 0 ? `${capacityTarget} expected` : 'target not set'}
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
                <span>Not Checked In & Pastoral Follow-Up</span>
          {absentMembers.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 border border-amber-200">
              {absentMembers.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('children_security')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 rounded-t-xl transition whitespace-nowrap ${
            activeTab === 'children_security'
              ? 'border-emerald-700 text-emerald-800 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Children & Security Passes</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800">
            {sessionChildren.filter((c) => c.status === 'checked_in').length} In Hall
          </span>
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

      {/* TAB: CHILDREN'S MINISTRY SAFETY & SECURITY PASSES */}
      {activeTab === 'children_security' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Children in Sunday School
              </span>
              <div className="text-2xl font-black text-emerald-800 mt-1">
                {sessionChildren.filter((c) => c.status === 'checked_in').length}
              </div>
              <p className="text-[11px] text-emerald-700 mt-0.5">Currently under church supervision</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Safely Released
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {sessionChildren.filter((c) => c.status === 'checked_out').length}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Checked out with verified pass</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Medical / Allergy Alerts
              </span>
              <div className="text-2xl font-black text-rose-700 mt-1">
                {sessionChildren.filter((c) => c.status === 'checked_in' && c.has_allergy_alert).length}
              </div>
              <p className="text-[11px] text-rose-600 mt-0.5">High-priority care required</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Quick Security Actions
              </span>
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedChildRecordForPass(null);
                    setIsChildSafetyModalOpen(true);
                  }}
                  className="w-full py-1.5 px-3 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition"
                >
                  + Check In Child
                </button>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search child name, tag code (e.g. GWCC-K412), or parent..."
                value={childSearchTerm}
                onChange={(e) => setChildSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedChildRecordForPass(null);
                  setIsChildSafetyModalOpen(true);
                }}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <QrCode className="w-3.5 h-3.5 text-emerald-700" />
                <span>Verify Pickup Stub</span>
              </button>
            </div>
          </div>

          {/* Children Roster Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Tag Code</th>
                    <th className="py-3 px-4">Child Name</th>
                    <th className="py-3 px-4">Class Room</th>
                    <th className="py-3 px-4">Parent / Guardian</th>
                    <th className="py-3 px-4">Medical / Allergy Notes</th>
                    <th className="py-3 px-4">Time & Status</th>
                    <th className="py-3 px-4 text-center">Safety Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessionChildren
                    .filter((c) => {
                      if (!childSearchTerm.trim()) return true;
                      const term = childSearchTerm.toLowerCase();
                      return (
                        (c.child_name || '').toLowerCase().includes(term) ||
                        (c.security_code || '').toLowerCase().includes(term) ||
                        (c.parent_name || '').toLowerCase().includes(term) ||
                        (c.parent_phone || '').includes(term)
                      );
                    })
                    .map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-mono font-black text-slate-900 text-sm">
                          <span className="bg-slate-900 text-white px-2 py-0.5 rounded-lg shadow-2xs">
                            {rec.security_code}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {rec.child_name}
                        </td>
                        <td className="py-3 px-4 text-slate-700">{rec.class_room}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">{rec.parent_name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{rec.parent_phone}</span>
                        </td>
                        <td className="py-3 px-4">
                          {rec.has_allergy_alert ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              {rec.allergies_medical_notes}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">None</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-semibold text-[10px] uppercase px-2 py-0.5 rounded border ${
                              rec.status === 'checked_in'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {rec.status === 'checked_in' ? 'In Sunday School' : `Released (${rec.check_out_time})`}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedChildRecordForPass(rec);
                                setIsChildSafetyModalOpen(true);
                              }}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-[11px] transition flex items-center gap-1"
                              title="View & Print Badges"
                            >
                              <Printer className="w-3 h-3" />
                              Tag
                            </button>
                            {rec.status === 'checked_in' && (
                              <button
                                type="button"
                                onClick={() => {
                                  summonChildParent(rec.id, 'Summoned to Sunday School');
                                  warning('Parent contact recorded', `Call ${rec.parent_name} at ${rec.parent_phone}. No message has been sent.`);
                                }}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-lg text-[11px] transition flex items-center gap-1 border border-amber-200"
                                title="Summon Parent from Main Sanctuary"
                              >
                                <Phone className="w-3 h-3" />
                                Summon
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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
                  disabled={!canRegisterVisitor}
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
                  aria-label="Find attendance member"
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
                                disabled={!canRecordSession}
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
                  disabled={!canRegisterVisitor}
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
                    aria-label="Attendance person type"
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
                                attendancePersonType(rec) === 'visitor'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {attendancePersonType(rec) || 'unknown'}
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
                                    timeZone: 'Africa/Accra',
                                  })}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setRecordToUndo(rec)}
                        disabled={!canEditAttendance}
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
                      Use the search bar above or use the staff check-in screen at the entrance desk.
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
            disabled={!canRecordSession}
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
                <h4 className="font-bold text-sm">Visitor Check-Ins ({visitorsCheckedIn.length})</h4>
              </div>
              <p className="text-xs text-blue-100/80 leading-relaxed">
                Connect our newcomers to the Pastoral Care & Follow-Up team before they leave the premises.
              </p>
              <button
                onClick={() => setIsQuickVisitorOpen(true)}
                  disabled={!canRegisterVisitor}
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
                  Tally for {selectedService?.name} on {selectedDate}. Count each person once; exclude visitors and ushers from the other categories.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {headcountDirty && <span className="text-xs text-amber-800">Unsaved changes</span>}
                {headcountConflict && <button onClick={() => setHeadcountDirty(false)} className="px-3 py-2 text-xs text-amber-900 bg-amber-100 rounded-xl">Load latest saved headcount</button>}
                <button
                  onClick={handleResetHeadcount}
                  disabled={!canRecordSession}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Counters</span>
                </button>
                <button
                  onClick={handleSaveHeadcount}
                  disabled={!canRecordSession || headcountConflict || !!headcountError(headcountForm)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition shadow-md shadow-teal-700/20"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Headcount</span>
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
                  aria-label="Headcount men"
                  step="1"
                  max="1000000"
                  disabled={!canRecordSession}
                  value={headcountForm.men}
                  onChange={(e) =>
                    editHeadcountForm({ ...headcountForm, men: Number(e.target.value) })
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
                  aria-label="Headcount women"
                  step="1"
                  max="1000000"
                  disabled={!canRecordSession}
                  value={headcountForm.women}
                  onChange={(e) =>
                    editHeadcountForm({ ...headcountForm, women: Number(e.target.value) })
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
                  aria-label="Headcount youth"
                  step="1"
                  max="1000000"
                  disabled={!canRecordSession}
                  value={headcountForm.youth}
                  onChange={(e) =>
                    editHeadcountForm({ ...headcountForm, youth: Number(e.target.value) })
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
                  aria-label="Headcount children"
                  step="1"
                  max="1000000"
                  disabled={!canRecordSession}
                  value={headcountForm.children}
                  onChange={(e) =>
                    editHeadcountForm({ ...headcountForm, children: Number(e.target.value) })
                  }
                  className="w-full text-2xl font-black text-slate-900 bg-white border border-slate-300 rounded-xl p-2.5 font-mono"
                />
                <p className="text-[11px] text-slate-400">Children classrooms & crèche</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Visitors In Auditorium
                </span>
                <input
                  type="number"
                  min="0"
                  aria-label="Headcount visitors"
                  step="1"
                  max="1000000"
                  disabled={!canRecordSession}
                  value={headcountForm.visitors}
                  onChange={(e) =>
                    editHeadcountForm({ ...headcountForm, visitors: Number(e.target.value) })
                  }
                  className="w-full text-2xl font-black text-blue-800 bg-white border border-slate-300 rounded-xl p-2.5 font-mono"
                />
                <p className="text-[11px] text-blue-600">Visitors counted separately</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Ushers & Protocol On Duty
                </span>
                <input
                  type="number"
                  min="0"
                  aria-label="Headcount ushers_protocol"
                  step="1"
                  max="1000000"
                  disabled={!canRecordSession}
                  value={headcountForm.ushers_protocol}
                  onChange={(e) =>
                    editHeadcountForm({
                      ...headcountForm,
                      ushers_protocol: Number(e.target.value),
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
                  aria-label="Headcount online_viewers"
                  step="1"
                  max="1000000"
                  disabled={!canRecordSession}
                  value={headcountForm.online_viewers}
                  onChange={(e) =>
                    editHeadcountForm({
                      ...headcountForm,
                      online_viewers: Number(e.target.value),
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
                  onChange={(e) => editHeadcountForm({ ...headcountForm, counted_by: e.target.value })}
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
                  onChange={(e) => editHeadcountForm({ ...headcountForm, notes: e.target.value })}
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
                Service Headcounts Log ({serviceSessions.filter(session => session.headcount).length} Recorded)
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
                  {serviceSessions.flatMap(session => session.headcount ? [session.headcount] : []).map((h) => (
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
                disabled={!canRecordSession || batchSelectedMembers.size === 0}
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
                aria-label="Batch ministry"
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
                  aria-label="Batch member search"
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
                const isAlreadyCheckedIn = alreadyCheckedInIds.has(attendeeKey('member', m.id));

                return (
                  <label
                    key={m.id}
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
                        disabled={!canRecordSession || isAlreadyCheckedIn}
                        aria-label={`Select ${m.first_name} ${m.last_name}`}
                        onChange={event => setBatchSelectedMembers(previous => {
                          const next = new Set(previous);
                          if (event.target.checked) next.add(m.id); else next.delete(m.id);
                          return next;
                        })}
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
                  </label>
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
                {absentMembers.length} Members Not Checked In
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
                      `Praise the Lord Brother/Sister ${m.first_name}, greetings from ${settings.church_name || 'the church family'}! We missed your presence at our ${selectedService?.name || 'service'} on ${formatServiceDayString(selectedDate)}. Just checking on your well-being and praying God's richest blessings over your week. Let us know if you need any pastoral prayers. God bless you!`
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
                      {currentSessionRecords.length || currentHeadcountRecord ? 'No active members without a check-in are listed for this session.' : 'Record a service session before reviewing members who have not checked in.'}
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
                    Selected service only. Saved headcounts take precedence over unique check-ins.
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
                      name="Session Attendance"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Demographic Breakdown Pie */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Session Demographics</h3>
                <p className="text-xs text-slate-500">Saved headcount categories, or check-in demographics when no headcount is saved</p>
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
                  <span className="text-slate-600">Men: {currentHeadcountRecord?.men ?? 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-600"></span>
                  <span className="text-slate-600">Women: {currentHeadcountRecord?.women ?? 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                  <span className="text-slate-600">Youth: {currentHeadcountRecord?.youth ?? 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <span className="text-slate-600">Children: {currentHeadcountRecord?.children ?? 0}</span>
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
                All recorded sessions for the selected service, including sessions without a headcount
              </p>
            </div>

            <button
              onClick={() => handleExportCSV(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export All Attendance</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {serviceSessions.map((h) => (
              <div
                key={h.key}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 p-3 rounded-xl transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{h.service_name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                      {h.date}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{h.headcount?.notes || `${h.checkins} verified check-ins`}</p>
                  <p className="text-[11px] text-slate-400">Recorded by: {h.headcount?.counted_by || 'Check-in register'}</p>
                </div>

                <div className="flex items-center gap-6 text-xs">
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Headcount</span>
                    <p className="font-black text-teal-800 text-base">{h.headcount?.total_auditorium ?? '—'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Visitors</span>
                    <p className="font-bold text-blue-700">{h.headcount?.visitors ?? h.visitors}</p>
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
        onCheckIn={(type, id) => handleCheckIn(type, id, 'search')}
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
      {/* Unmount between openings so a previous child's pickup tag never persists. */}
      {isChildSafetyModalOpen && (
        <ChildSafetyPickupModal
          isOpen={isChildSafetyModalOpen}
          onClose={() => setIsChildSafetyModalOpen(false)}
          targetRecord={selectedChildRecordForPass}
          serviceId={selectedServiceId}
          date={selectedDate}
        />
      )}
    </div>
  );
};
