import React, { useState, useMemo, useEffect } from 'react';
import {
  CalendarDays,
  Clock,
  MapPin,
  Plus,
  CheckCircle,
  Edit2,
  Trash2,
  Users,
  Coins,
  FileText,
  Printer,
  ListOrdered,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Sparkles,
  UserCheck,
  Music,
  Mic,
  Eye,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  Calendar,
  RotateCcw,
  Send,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  ChurchService,
  ServiceProgramItem,
  RosterAssignment,
  RosterDepartment,
  RosterAssignmentStatus,
} from '../types/database.types';
import { cleanGhanaPhone } from '../lib/currencyUtils';

// Modals
import { ServiceFormModal } from '../components/services/ServiceFormModal';
import { ServiceBulletinModal } from '../components/services/ServiceBulletinModal';
import { OrderOfServiceEditorModal } from '../components/services/OrderOfServiceEditorModal';
import { DutyRosterModal } from '../components/services/DutyRosterModal';
import { AssignRosterModal } from '../components/services/AssignRosterModal';
import { PrintRosterModal } from '../components/services/PrintRosterModal';

export const ServicesPage: React.FC = () => {
  const {
    services,
    attendance,
    giving,
    members,
    settings,
    createService,
    updateService,
    deleteService,
    rosterAssignments,
    addRosterAssignment,
    updateRosterAssignment,
    deleteRosterAssignment,
    batchAddOrUpdateRosterAssignments,
    rosterConflicts,
  } = useChurchData();
  const { success, info, warning } = useToast();
  const { canAccess, currentRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Role check: Only authorized staff can create/edit/delete services
  const canManageServices = canAccess('services') && currentRole !== 'member';

  // URL Query Parameters Handling (support ?tab=roster | timeline | bulletins | cards and ?action=new)
  const tabParam = searchParams.get('tab');
  const actionParam = searchParams.get('action');

  const [viewMode, setViewMode] = useState<'cards' | 'timeline' | 'bulletins' | 'roster'>(() => {
    if (tabParam === 'roster' || tabParam === 'timeline' || tabParam === 'bulletins' || tabParam === 'cards') {
      return tabParam;
    }
    return 'cards';
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Roster filters & modals
  const [rosterServiceFilter, setRosterServiceFilter] = useState<string>('ALL');
  const [rosterDeptFilter, setRosterDeptFilter] = useState<string>('ALL');
  const [rosterDateFilter, setRosterDateFilter] = useState<string>('ALL');
  const [isAssignRosterOpen, setIsAssignRosterOpen] = useState(false);
  const [isPrintMasterRosterOpen, setIsPrintMasterRosterOpen] = useState(false);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ChurchService | null>(null);
  const [bulletinService, setBulletinService] = useState<ChurchService | null>(null);
  const [orderEditorService, setOrderEditorService] = useState<ChurchService | null>(null);
  const [rosterService, setRosterService] = useState<ChurchService | null>(null);
  const [deleteConfirmService, setDeleteConfirmService] = useState<ChurchService | null>(null);

  // Sync state if URL search query changes
  useEffect(() => {
    if (tabParam === 'roster' || tabParam === 'timeline' || tabParam === 'bulletins' || tabParam === 'cards') {
      setViewMode(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    if (actionParam === 'new') {
      if (canManageServices) {
        setEditingService(null);
        setIsFormModalOpen(true);
      } else {
        warning('Permission Required', 'You do not have administrative permissions to create church services.');
      }
      // Remove action param to avoid re-triggering
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('action');
          return next;
        },
        { replace: true }
      );
    }
  }, [actionParam, canManageServices, setSearchParams, warning]);

  const handleTabChange = (mode: 'cards' | 'timeline' | 'bulletins' | 'roster') => {
    setViewMode(mode);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', mode);
        return next;
      },
      { replace: true }
    );
  };

  // Compute live connected metrics for each service
  const serviceStatsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        checkinCount: number;
        givingTotal: number;
        lastDate: string;
      }
    >();

    services.forEach((s) => {
      const sName = (s.name || '').trim().toLowerCase();
      const sPrefix = sName.length >= 3 ? sName.slice(0, 15) : '';

      // Find matching attendance
      const matchingAtt = attendance.filter((a) => {
        if (a.service_id && a.service_id === s.id) return true;
        if (sPrefix && a.service_name && a.service_name.toLowerCase().includes(sPrefix)) return true;
        return false;
      });

      // Find matching giving
      const matchingGiving = giving.filter((g) => {
        if (g.service_id && g.service_id === s.id) return true;
        if (sPrefix && g.service_name && g.service_name.toLowerCase().includes(sPrefix)) return true;
        return false;
      });

      const givingTotal = matchingGiving.reduce((sum, g) => sum + g.amount, 0);

      const sortedDates = matchingAtt
        .map((a) => a.date)
        .filter(Boolean)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

      map.set(s.id, {
        checkinCount: matchingAtt.length,
        givingTotal,
        lastDate: sortedDates[0] || 'Recent',
      });
    });

    return map;
  }, [services, attendance, giving]);

  // Overall metrics
  const activeServices = useMemo(() => services.filter((s) => s.is_active), [services]);
  const totalWeeklyCapacity = useMemo(
    () => activeServices.reduce((sum, s) => sum + (s.expected_attendance || 150), 0),
    [activeServices]
  );
  const totalConnectedServiceInflow = useMemo(() => {
    const connected = Array.from(serviceStatsMap.values()).reduce((sum, s) => sum + s.givingTotal, 0);
    return connected > 0 ? connected : giving.reduce((sum, g) => sum + g.amount, 0);
  }, [serviceStatsMap, giving]);

  // Currency configuration
  const currencySymbol = settings.currency_symbol || 'GH₵';
  const formattedConnectedInflow = `${currencySymbol} ${totalConnectedServiceInflow.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  // Filtered services
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const term = (searchTerm || '').toLowerCase();
      const matchesSearch =
        !term ||
        (s.name || '').toLowerCase().includes(term) ||
        (s.day_of_week || '').toLowerCase().includes(term) ||
        (s.venue && s.venue.toLowerCase().includes(term)) ||
        (s.preacher && s.preacher.toLowerCase().includes(term)) ||
        (s.description && s.description.toLowerCase().includes(term));

      const matchesType = typeFilter === 'all' || s.type === typeFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && s.is_active) ||
        (statusFilter === 'inactive' && !s.is_active);

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [services, searchTerm, typeFilter, statusFilter]);

  // Chronological day order for weekly timeline
  const DAYS_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const servicesByDay = useMemo(() => {
    const grouped: Record<string, ChurchService[]> = {};
    DAYS_ORDER.forEach((day) => {
      grouped[day] = [];
    });

    filteredServices.forEach((s) => {
      const rawDay = (s.day_of_week || '').trim();
      const matchedDay = DAYS_ORDER.find((d) => d.toLowerCase() === rawDay.toLowerCase()) || 'Sunday';
      grouped[matchedDay].push(s);
    });

    // Chronologically sort each day's services by start_time
    DAYS_ORDER.forEach((day) => {
      grouped[day].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    });

    return grouped;
  }, [filteredServices]);

  // Handlers
  const handleToggleActive = (s: ChurchService) => {
    if (!canManageServices) {
      warning('Access Denied', 'You do not have permissions to modify service statuses.');
      return;
    }
    const updatedStatus = !s.is_active;
    updateService(s.id, { is_active: updatedStatus });
    info(
      updatedStatus ? 'Service Activated' : 'Service Deactivated',
      `"${s.name}" is now ${updatedStatus ? 'active' : 'inactive'}.`
    );
  };

  const handleSaveService = (data: Omit<ChurchService, 'id'>) => {
    if (!canManageServices) {
      warning('Access Denied', 'You do not have permissions to save church services.');
      return;
    }
    if (editingService) {
      updateService(editingService.id, data);
      success('Service Updated', `"${data.name}" has been updated successfully.`);
    } else {
      createService(data);
      success('Service Scheduled', `"${data.name}" has been scheduled.`);
    }
    setIsFormModalOpen(false);
    setEditingService(null);
  };

  const handleDeleteService = () => {
    if (!canManageServices) {
      warning('Access Denied', 'You do not have permissions to delete church services.');
      return;
    }
    if (!deleteConfirmService) return;
    deleteService(deleteConfirmService.id);
    success('Service Deleted', `"${deleteConfirmService.name}" has been removed.`);
    setDeleteConfirmService(null);
  };

  const handleSaveOrderOfService = (serviceId: string, orderOfService: ServiceProgramItem[]) => {
    updateService(serviceId, { order_of_service: orderOfService });
  };

  const handleSaveDutyRoster = (
    serviceId: string,
    updates: Partial<ChurchService>,
    newAssignments?: Omit<RosterAssignment, 'id' | 'created_at'>[]
  ) => {
    updateService(serviceId, updates);
    if (newAssignments && newAssignments.length > 0) {
      batchAddOrUpdateRosterAssignments(newAssignments);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 rounded-lg">
              <CalendarDays className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Church Services & Worship Schedule
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {settings.church_name || 'Greater Works City Church'}, {settings.branch_name || 'Joma Assembly'} • Weekly Liturgies, Rosters & Bulletins
          </p>
        </div>

        {/* Top Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {canManageServices && (
            <button
              onClick={() => {
                setEditingService(null);
                setIsFormModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-[#064e3b] hover:bg-[#047857] text-white text-xs font-bold flex items-center gap-1.5 transition shadow-md cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule New Service</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Overview Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Active Services */}
        <div className="p-4 bg-white dark:bg-[#0e1726] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Active Weekly Services
            </span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono mt-0.5 block">
              {activeServices.length} <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">of {services.length} scheduled</span>
            </span>
          </div>
          <span className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-xl">
            <CalendarDays className="w-5 h-5" />
          </span>
        </div>

        {/* Estimated Weekly Capacity */}
        <div className="p-4 bg-white dark:bg-[#0e1726] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Auditorium Capacity
            </span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono mt-0.5 block">
              {totalWeeklyCapacity.toLocaleString()} <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">seats / wk</span>
            </span>
          </div>
          <span className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 rounded-xl">
            <Users className="w-5 h-5" />
          </span>
        </div>

        {/* Flagship Sunday Services */}
        <div className="p-4 bg-white dark:bg-[#0e1726] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Flagship Sunday Services
            </span>
            <span className="text-2xl font-extrabold text-emerald-800 dark:text-emerald-400 font-mono mt-0.5 block">
              {services.filter((s) => s.type === 'sunday').length} Services
            </span>
          </div>
          <span className="p-2.5 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded-xl">
            <Clock className="w-5 h-5" />
          </span>
        </div>

        {/* Total Inflow Connections */}
        <div className="p-4 bg-white dark:bg-[#0e1726] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Treasury Inflow Connected
            </span>
            <span className="text-xl font-extrabold text-slate-900 dark:text-white font-mono mt-0.5 block">
              {formattedConnectedInflow}
            </span>
          </div>
          <span className="p-2.5 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 rounded-xl">
            <Coins className="w-5 h-5" />
          </span>
        </div>
      </div>

      {/* View Mode Navigation & Filters */}
      <div className="bg-white dark:bg-[#0e1726] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* View Mode Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl overflow-x-auto no-scrollbar">
          <button
            onClick={() => handleTabChange('cards')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
              viewMode === 'cards'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Services Grid
          </button>
          <button
            onClick={() => handleTabChange('timeline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
              viewMode === 'timeline'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Weekly Timeline
          </button>
          <button
            onClick={() => handleTabChange('bulletins')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
              viewMode === 'bulletins'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Liturgies & Bulletins
          </button>
          <button
            onClick={() => handleTabChange('roster')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
              viewMode === 'roster'
                ? 'bg-white dark:bg-slate-800 text-emerald-950 dark:text-emerald-300 shadow-xs font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Duty Roster & Conflict Radar</span>
            {rosterConflicts.length > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 animate-pulse">
                {rosterConflicts.length} Conflict{rosterConflicts.length > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                {rosterAssignments.length}
              </span>
            )}
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap flex-1 max-w-xl justify-end">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search service, preacher, venue..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-850"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="py-1.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium"
          >
            <option value="all">All Service Types</option>
            <option value="sunday">Sunday Services</option>
            <option value="midweek">Midweek Teaching</option>
            <option value="prayer">Prayer / All-Night</option>
            <option value="youth">Youth Fellowship</option>
            <option value="conference">Conventions</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="py-1.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive</option>
          </select>

          {(searchTerm || typeFilter !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setTypeFilter('all');
                setStatusFilter('all');
              }}
              className="p-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
              title="Reset Filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* VIEW 1: SERVICES CARDS GRID                                  */}
      {/* ============================================================ */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredServices.length === 0 ? (
            <div className="col-span-2 p-12 text-center text-slate-400 bg-white dark:bg-[#0e1726] rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <CalendarDays className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="font-bold text-slate-600 dark:text-slate-300">No church services found</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Try adjusting your search terms or filters.</p>
            </div>
          ) : (
            filteredServices.map((svc) => {
              const stats = serviceStatsMap.get(svc.id) || { checkinCount: 0, givingTotal: 0, lastDate: '-' };
              const programItemsCount = svc.order_of_service?.length || 0;

              return (
                <div
                  key={svc.id}
                  className={`p-5 bg-white dark:bg-[#0e1726] rounded-2xl border transition shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md ${
                    svc.is_active
                      ? 'border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700'
                      : 'border-slate-200 dark:border-slate-800 opacity-75 bg-slate-50/50 dark:bg-slate-900/30'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Row: Title, Day Badge & Active Switch */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">{svc.name}</h3>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                            {svc.day_of_week}s • {svc.start_time} - {svc.end_time}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                            {svc.type}
                          </span>
                        </div>
                      </div>

                      {/* Active Status Toggle */}
                      {canManageServices ? (
                        <button
                          onClick={() => handleToggleActive(svc)}
                          className={`p-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                            svc.is_active
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900'
                              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                          title="Click to toggle active status"
                        >
                          <span className={`w-2 h-2 rounded-full ${svc.is_active ? 'bg-emerald-600' : 'bg-slate-400'}`}></span>
                          <span>{svc.is_active ? 'Active' : 'Inactive'}</span>
                        </button>
                      ) : (
                        <span
                          className={`px-2.5 py-1 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${
                            svc.is_active
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${svc.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          <span>{svc.is_active ? 'Active' : 'Inactive'}</span>
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    {svc.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{svc.description}</p>
                    )}

                    {/* Venue & Ministers on duty badges */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium truncate">{svc.venue || 'Main Cathedral Sanctuary, Joma'}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800 text-[11px]">
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 block text-[10px] uppercase font-bold">Preacher</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                            {svc.preacher || 'Prophet Elisha K. Richard'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 block text-[10px] uppercase font-bold">Moderator / MC</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block">
                            {svc.service_leader || 'Pastoral Board'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Connected Ministry Stats Bar */}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase block">Capacity</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                          {svc.expected_attendance || 200}
                        </span>
                      </div>
                      <div className="p-2 bg-emerald-50/60 dark:bg-emerald-950/40 rounded-lg border border-emerald-100 dark:border-emerald-800">
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase block">Attendees</span>
                        <span className="font-bold text-emerald-900 dark:text-emerald-300 font-mono">
                          {stats.checkinCount} check-ins
                        </span>
                      </div>
                      <div className="p-2 bg-purple-50/60 dark:bg-purple-950/40 rounded-lg border border-purple-100 dark:border-purple-800">
                        <span className="text-[10px] text-purple-700 dark:text-purple-400 font-bold uppercase block">Liturgy</span>
                        <span className="font-bold text-purple-900 dark:text-purple-300 font-mono">
                          {programItemsCount} segments
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => setBulletinService(svc)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:border-emerald-300 dark:hover:border-emerald-700 text-slate-700 dark:text-slate-300 hover:text-emerald-900 dark:hover:text-emerald-300 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                        title="View printable bulletin & program"
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                        <span>Bulletin</span>
                      </button>

                      <button
                        onClick={() => setOrderEditorService(svc)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 hover:bg-purple-50 dark:hover:bg-purple-950/50 hover:border-purple-300 dark:hover:border-purple-700 text-slate-700 dark:text-slate-300 hover:text-purple-900 dark:hover:text-purple-300 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                        title="Plan and edit Order of Service"
                      >
                        <ListOrdered className="w-3.5 h-3.5 text-purple-700 dark:text-purple-400" />
                        <span>Liturgy ({programItemsCount})</span>
                      </button>

                      <button
                        onClick={() => setRosterService(svc)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:border-blue-300 dark:hover:border-blue-700 text-slate-700 dark:text-slate-300 hover:text-blue-900 dark:hover:text-blue-300 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                        title="Manage duty roster and ministers"
                      >
                        <Users className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                        <span>Roster</span>
                      </button>
                    </div>

                    {canManageServices && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingService(svc);
                            setIsFormModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                          title="Edit service details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setDeleteConfirmService(svc)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                          title="Delete service"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* VIEW 2: WEEKLY TIMELINE CHRONOLOGICAL SCHEDULE               */}
      {/* ============================================================ */}
      {viewMode === 'timeline' && (
        <div className="bg-white dark:bg-[#0e1726] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Weekly Worship Calendar & Schedule</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Chronological day-by-day worship flow for Greater Works City Church
              </p>
            </div>
            <span className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
              Accra Time (GMT)
            </span>
          </div>

          <div className="space-y-6">
            {DAYS_ORDER.map((day) => {
              const dayServices = servicesByDay[day] || [];
              if (dayServices.length === 0) return null;

              return (
                <div key={day} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-700 dark:bg-emerald-500"></span>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                      {day}s
                    </h4>
                    <span className="text-xs text-slate-400 dark:text-slate-500">({dayServices.length} service meetings)</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-5 border-l-2 border-slate-200 dark:border-slate-800 ml-1.5">
                    {dayServices.map((svc) => (
                      <div
                        key={svc.id}
                        className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{svc.name}</span>
                          <span className="font-mono text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded">
                            {svc.start_time} - {svc.end_time}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{svc.description}</p>
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1 truncate max-w-[200px]">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {svc.venue || 'Main Sanctuary'}
                          </span>
                          <button
                            onClick={() => setBulletinService(svc)}
                            className="text-emerald-700 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
                          >
                            View Bulletin →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* VIEW 3: LITURGIES & BULLETINS CENTER                         */}
      {/* ============================================================ */}
      {viewMode === 'bulletins' && (
        <div className="bg-white dark:bg-[#0e1726] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-800 dark:text-emerald-400" />
                Liturgy, Order of Service & Sunday Bulletin Center
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Plan the liturgical order of service, program timings, and generate printable church bulletins.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredServices.map((svc) => {
              const programItems = svc.order_of_service || [];

              return (
                <div
                  key={svc.id}
                  className="p-5 bg-slate-50/60 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">{svc.name}</h4>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {svc.day_of_week}s • {svc.start_time} - {svc.end_time} GMT
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold">
                      {programItems.length} Program Items
                    </span>
                  </div>

                  {/* Program Items Preview */}
                  <div className="space-y-1.5 bg-white dark:bg-slate-850 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
                    {programItems.length === 0 ? (
                      <p className="text-slate-400 dark:text-slate-500 italic text-center py-3">
                        No liturgical program items configured yet.
                      </p>
                    ) : (
                      programItems.slice(0, 4).map((item, idx) => (
                        <div key={item.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-700 dark:text-slate-300 truncate max-w-[220px]">
                            <strong>{idx + 1}.</strong> {item.title}
                          </span>
                          <span className="font-mono text-slate-400 dark:text-slate-500 text-[11px]">
                            {item.duration || item.time || ''}
                          </span>
                        </div>
                      ))
                    )}
                    {programItems.length > 4 && (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center pt-1">
                        + {programItems.length - 4} more liturgical items
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => setOrderEditorService(svc)}
                      className="px-3 py-1.5 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <ListOrdered className="w-3.5 h-3.5" />
                      <span>Edit Liturgy Plan</span>
                    </button>

                    <button
                      onClick={() => setBulletinService(svc)}
                      className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Bulletin</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* VIEW 4: MULTI-DEPARTMENT DUTY ROSTER & CONFLICT RADAR        */}
      {/* ============================================================ */}
      {viewMode === 'roster' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Conflict Radar Alert Banner if conflicts exist */}
          {rosterConflicts.length > 0 && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 rounded-2xl shadow-sm text-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-rose-700 dark:text-rose-300" />
                  </span>
                  <div>
                    <h3 className="font-extrabold text-rose-950 dark:text-rose-100 text-sm">
                      Volunteer Scheduling Conflicts Detected ({rosterConflicts.length})
                    </h3>
                    <p className="text-[11px] text-rose-700 dark:text-rose-300">
                      The automated conflict radar detected volunteer double-bookings or concurrent duties.
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-100 font-bold rounded-full text-[10px] uppercase">
                  Action Required
                </span>
              </div>

              <div className="space-y-2">
                {rosterConflicts.map((conf, idx) => (
                  <div
                    key={`${conf.member_id}-${conf.date}-${idx}`}
                    className="p-3 bg-white dark:bg-[#0e1726] border border-rose-200 dark:border-rose-900 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">{conf.member_name}</span>
                      <span className="text-slate-400 mx-1.5">•</span>
                      <span className="font-semibold text-rose-800 dark:text-rose-300">{conf.service_name}</span>
                      <span className="text-slate-400 mx-1.5">•</span>
                      <span className="text-slate-600 dark:text-slate-400">{conf.date}</span>
                      <p className="text-[11px] text-rose-700 dark:text-rose-300 font-medium mt-0.5">{conf.message}</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {conf.assignments.map((asgn) => (
                        <button
                          key={asgn.id}
                          onClick={() => {
                            deleteRosterAssignment(asgn.id);
                            info('Assignment Removed', `Unscheduled ${asgn.member_name} from ${asgn.role_title}.`);
                          }}
                          className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-[10px] font-bold transition"
                        >
                          Remove [{asgn.department.replace('_', ' ')}]
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Roster Controls & Action Bar */}
          <div className="bg-white dark:bg-[#0e1726] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              {/* Department Filter */}
              <select
                value={rosterDeptFilter}
                onChange={(e) => setRosterDeptFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-850"
              >
                <option value="ALL">All Departments</option>
                <option value="sound_media">Sound & Media Technical</option>
                <option value="praise_team">Voice of Dominion (Choir & Band)</option>
                <option value="ushers_protocol">Ushers & Protocol</option>
                <option value="intercessors">Altar Intercessors</option>
                <option value="children_ministry">Children's Ministry</option>
                <option value="car_park_security">Car Park & Security</option>
                <option value="sanctuary_cleaning">Sanctuary Cleaning</option>
              </select>

              {/* Service Filter */}
              <select
                value={rosterServiceFilter}
                onChange={(e) => setRosterServiceFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-850"
              >
                <option value="ALL">All Services ({services.length})</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {/* Date Filter */}
              <select
                value={rosterDateFilter}
                onChange={(e) => setRosterDateFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-850"
              >
                <option value="ALL">All Scheduled Dates</option>
                {Array.from(new Set(rosterAssignments.map((a) => a.date)))
                  .sort()
                  .reverse()
                  .map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPrintMasterRosterOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl shadow-xs transition"
              >
                <Printer className="w-4 h-4 text-slate-500" />
                <span>Print Master Roster</span>
              </button>
              {canManageServices && (
                <button
                  onClick={() => setIsAssignRosterOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Assign Volunteer</span>
                </button>
              )}
            </div>
          </div>

          {/* Roster Assignment List */}
          {rosterAssignments.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-[#0e1726] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No duty assignments yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                Schedule ministers and technical volunteers across all 7 departments for upcoming services.
              </p>
              {canManageServices && (
                <button
                  onClick={() => setIsAssignRosterOpen(true)}
                  className="mt-4 px-4 py-2 bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                >
                  Assign First Volunteer
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Filter roster assignments */}
              {(() => {
                const term = (searchTerm || '').toLowerCase();
                const filtered = rosterAssignments.filter((a) => {
                  const matchService = rosterServiceFilter === 'ALL' || a.service_id === rosterServiceFilter;
                  const matchDept = rosterDeptFilter === 'ALL' || a.department === rosterDeptFilter;
                  const matchDate = rosterDateFilter === 'ALL' || a.date === rosterDateFilter;
                  const matchSearch =
                    !term ||
                    (a.member_name || '').toLowerCase().includes(term) ||
                    (a.role_title || '').toLowerCase().includes(term) ||
                    (a.notes && a.notes.toLowerCase().includes(term));
                  return matchService && matchDept && matchDate && matchSearch;
                });

                // Group filtered items by date and service
                const groups = new Map<string, RosterAssignment[]>();
                filtered.forEach((item) => {
                  const key = `${item.date} — ${item.service_name}`;
                  const list = groups.get(key) || [];
                  list.push(item);
                  groups.set(key, list);
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-8 text-center bg-white dark:bg-[#0e1726] rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs">
                      No duty assignments match your selected department or service filter.
                    </div>
                  );
                }

                return Array.from(groups.entries()).map(([groupKey, groupItems]) => (
                  <div
                    key={groupKey}
                    className="bg-white dark:bg-[#0e1726] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden"
                  >
                    {/* Group Header */}
                    <div className="px-5 py-3 bg-[#064e3b] text-white flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-emerald-200" />
                        <span className="font-bold tracking-wide">{groupKey}</span>
                      </div>
                      <span className="bg-emerald-800/80 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-emerald-100 border border-emerald-600">
                        {groupItems.length} Assigned Steward{groupItems.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Table of assignments */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            <th className="py-2.5 px-4">Volunteer / Minister</th>
                            <th className="py-2.5 px-4">Department & Ministry</th>
                            <th className="py-2.5 px-4">Assigned Role</th>
                            <th className="py-2.5 px-4">Call Time</th>
                            <th className="py-2.5 px-4">Status</th>
                            <th className="py-2.5 px-4">Notes</th>
                            <th className="py-2.5 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                          {groupItems.map((assignment) => {
                            const isConflicted = rosterConflicts.some(
                              (c) => c.member_id === assignment.member_id && c.date === assignment.date
                            );

                            const waPhone = cleanGhanaPhone(assignment.member_phone);
                            const waMessage = `Calvary greetings ${assignment.member_name}! You are scheduled on duty at Greater Works City Church as [${assignment.role_title}] for ${assignment.service_name} on ${assignment.date}. Required call time is ${assignment.report_time}. Pre-service prayer begins promptly. God bless you!`;
                            const waLink = `https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}`;

                            return (
                              <tr
                                key={assignment.id}
                                className={`hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition ${
                                  isConflicted ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                                }`}
                              >
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900 dark:text-white">
                                      {assignment.member_name}
                                    </span>
                                    {isConflicted && (
                                      <span
                                        title="Double-booked on this service date!"
                                        className="px-1.5 py-0.2 bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800 rounded text-[9px] font-bold"
                                      >
                                        Conflict
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                                    {assignment.member_phone || 'No phone'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300 capitalize">
                                  <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] border border-slate-200 dark:border-slate-700">
                                    {assignment.department.replace('_', ' ')}
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-bold text-emerald-950 dark:text-emerald-300">
                                  {assignment.role_title}
                                </td>
                                <td className="py-3 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                                  {assignment.report_time}
                                </td>
                                <td className="py-3 px-4">
                                  <select
                                    value={assignment.status}
                                    onChange={(e) =>
                                      updateRosterAssignment(assignment.id, {
                                        status: e.target.value as RosterAssignmentStatus,
                                      })
                                    }
                                    className={`text-[11px] font-bold px-2 py-1 rounded-lg border focus:outline-emerald-600 ${
                                      assignment.status === 'confirmed'
                                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                        : assignment.status === 'pending'
                                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                        : assignment.status === 'substituted'
                                        ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                        : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                    }`}
                                  >
                                    <option value="confirmed">Confirmed</option>
                                    <option value="pending">Pending</option>
                                    <option value="substituted">Substituted</option>
                                    <option value="declined">Declined</option>
                                  </select>
                                </td>
                                <td className="py-3 px-4 text-[11px] text-slate-500 dark:text-slate-400 max-w-xs truncate">
                                  {assignment.notes || '—'}
                                </td>
                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {waPhone && (
                                      <a
                                        href={waLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="Send WhatsApp Duty Reminder"
                                        className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-bold rounded-lg text-[10px] transition inline-flex items-center gap-1"
                                      >
                                        <Send className="w-2.5 h-2.5" />
                                        <span>WhatsApp</span>
                                      </a>
                                    )}
                                    {canManageServices && (
                                      <button
                                        onClick={() => {
                                          deleteRosterAssignment(assignment.id);
                                          info('Removed', `Unassigned ${assignment.member_name}.`);
                                        }}
                                        title="Remove from roster"
                                        className="p-1 text-slate-400 hover:text-rose-600 transition"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* ALL MODALS                                                   */}
      {/* ============================================================ */}

      {/* Assign Volunteer Modal */}
      {isAssignRosterOpen && (
        <AssignRosterModal
          isOpen={isAssignRosterOpen}
          onClose={() => setIsAssignRosterOpen(false)}
          services={services}
          members={members}
          existingAssignments={rosterAssignments}
          onSave={addRosterAssignment}
          initialServiceId={rosterServiceFilter !== 'ALL' ? rosterServiceFilter : undefined}
          initialDate={rosterDateFilter !== 'ALL' ? rosterDateFilter : undefined}
        />
      )}

      {/* Print Master Roster Modal */}
      {isPrintMasterRosterOpen && (
        <PrintRosterModal
          isOpen={isPrintMasterRosterOpen}
          onClose={() => setIsPrintMasterRosterOpen(false)}
          assignments={rosterAssignments}
          settings={settings}
          selectedDate={rosterDateFilter}
          selectedServiceName={rosterServiceFilter !== 'ALL' ? services.find((s) => s.id === rosterServiceFilter)?.name : undefined}
        />
      )}

      {/* Add / Edit Service Modal */}
      {isFormModalOpen && (
        <ServiceFormModal
          initialService={editingService}
          onSave={handleSaveService}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingService(null);
          }}
        />
      )}

      {/* Printable Bulletin Modal */}
      {bulletinService && (
        <ServiceBulletinModal
          service={bulletinService}
          settings={settings}
          onClose={() => setBulletinService(null)}
        />
      )}

      {/* Order of Service / Liturgy Editor Modal */}
      {orderEditorService && (
        <OrderOfServiceEditorModal
          service={orderEditorService}
          onSave={handleSaveOrderOfService}
          onClose={() => setOrderEditorService(null)}
        />
      )}

      {/* Duty Roster & Minister Assignment Modal */}
      {rosterService && (
        <DutyRosterModal
          service={rosterService}
          members={members}
          existingAssignments={rosterAssignments}
          onSave={handleSaveDutyRoster}
          onClose={() => setRosterService(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="relative w-full max-w-sm bg-white dark:bg-[#0e1726] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Church Service</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Are you sure you want to remove <span className="font-semibold text-slate-800 dark:text-slate-200">{deleteConfirmService.name}</span>?
                This will remove the regular schedule from the church calendar.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmService(null)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteService}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
              >
                Delete Service
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
