import React, { useState, useMemo } from 'react';
import {
  UserCheck,
  Search,
  Plus,
  Phone,
  Mail,
  Calendar,
  UserPlus,
  ArrowRight,
  CheckCircle,
  MessageCircle,
  Sparkles,
  MapPin,
  Clock,
  Filter,
  Eye,
  Edit,
  Trash2,
  Printer,
  Download,
  LayoutList,
  LayoutGrid,
  Columns,
  ChevronDown,
  UserX,
  FileText,
  TrendingUp,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useToast } from '../contexts/ToastContext';
import { Visitor, VisitorStatus, GenderType } from '../types/database.types';
import { VisitorDossierModal } from '../components/visitors/VisitorDossierModal';
import { EditVisitorModal } from '../components/visitors/EditVisitorModal';
import { LogInteractionModal } from '../components/visitors/LogInteractionModal';
import { PrintVisitorsModal } from '../components/visitors/PrintVisitorsModal';
import { AssimilationKanbanBoard } from '../components/visitors/AssimilationKanbanBoard';

export const VisitorsPage: React.FC = () => {
  const { visitors, addVisitor, updateVisitor, deleteVisitor, convertVisitorToMember } = useChurchData();
  const { success, error: toastError, info } = useToast();

  // Search & Filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [ministerFilter, setMinisterFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'name_asc'>('date_desc');
  const [viewMode, setViewMode] = useState<'table' | 'cards' | 'kanban'>('table');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedVisitorForDossier, setSelectedVisitorForDossier] = useState<Visitor | null>(null);
  const [selectedVisitorForEdit, setSelectedVisitorForEdit] = useState<Visitor | null>(null);
  const [selectedVisitorForLog, setSelectedVisitorForLog] = useState<Visitor | null>(null);
  const [convertingVisitor, setConvertingVisitor] = useState<Visitor | null>(null);
  const [deletingVisitor, setDeletingVisitor] = useState<Visitor | null>(null);

  // Form State for Adding New Visitor
  const [formData, setFormData] = useState({
    full_name: '',
    gender: 'female' as GenderType,
    phone: '+233 ',
    email: '',
    address: '',
    gps_address: 'GA-',
    service_attended: 'Sunday 2nd Service (Celebration Service)',
    invited_by: '',
    how_heard: 'Friend / Family',
    prayer_request: '',
    follow_up_status: 'new' as VisitorStatus,
    assigned_to_name: 'Pastor David Osei-Tutu',
    notes: '',
  });

  // Calculate Metrics
  const metrics = useMemo(() => {
    const total = visitors.length;
    const followUpRequired = visitors.filter((v) => v.follow_up_status === 'follow_up_required').length;
    const contacted = visitors.filter((v) => v.follow_up_status === 'contacted').length;
    const returning = visitors.filter((v) => v.follow_up_status === 'returning_visitor').length;
    const converted = visitors.filter((v) => v.follow_up_status === 'converted_to_member').length;
    const newVisitors = visitors.filter((v) => v.follow_up_status === 'new').length;

    const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;

    return {
      total,
      followUpRequired,
      contacted,
      returning,
      converted,
      newVisitors,
      conversionRate,
    };
  }, [visitors]);

  // Unique Lists for Filter Dropdowns
  const serviceOptions = useMemo(() => {
    const set = new Set<string>();
    visitors.forEach((v) => {
      if (v.service_attended) set.add(v.service_attended);
    });
    return Array.from(set);
  }, [visitors]);

  const ministerOptions = useMemo(() => {
    const set = new Set<string>();
    visitors.forEach((v) => {
      if (v.assigned_to_name) set.add(v.assigned_to_name);
    });
    return Array.from(set);
  }, [visitors]);

  // Filtered & Sorted Visitors
  const filteredVisitors = useMemo(() => {
    return visitors
      .filter((v) => {
        const term = searchTerm.toLowerCase().trim();
        const matchesSearch =
          !term ||
          v.full_name.toLowerCase().includes(term) ||
          v.phone.includes(term) ||
          (v.address && v.address.toLowerCase().includes(term)) ||
          (v.email && v.email.toLowerCase().includes(term)) ||
          (v.invited_by && v.invited_by.toLowerCase().includes(term)) ||
          (v.prayer_request && v.prayer_request.toLowerCase().includes(term)) ||
          (v.assigned_to_name && v.assigned_to_name.toLowerCase().includes(term));

        const matchesStatus = statusFilter === 'all' || v.follow_up_status === statusFilter;
        const matchesService = serviceFilter === 'all' || v.service_attended === serviceFilter;
        const matchesMinister = ministerFilter === 'all' || v.assigned_to_name === ministerFilter;

        return matchesSearch && matchesStatus && matchesService && matchesMinister;
      })
      .sort((a, b) => {
        if (sortBy === 'date_desc') {
          return new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime();
        }
        if (sortBy === 'date_asc') {
          return new Date(a.visit_date).getTime() - new Date(b.visit_date).getTime();
        }
        return a.full_name.localeCompare(b.full_name);
      });
  }, [visitors, searchTerm, statusFilter, serviceFilter, ministerFilter, sortBy]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name.trim() || !formData.phone.trim()) {
      toastError('Full Name and Phone Number are required.');
      return;
    }

    try {
      const created = addVisitor({
        full_name: formData.full_name.trim(),
        gender: formData.gender,
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
        gps_address: formData.gps_address.trim() || undefined,
        visit_date: new Date().toISOString().split('T')[0],
        service_attended: formData.service_attended,
        invited_by: formData.invited_by.trim() || undefined,
        how_heard: formData.how_heard,
        prayer_request: formData.prayer_request.trim() || undefined,
        follow_up_status: formData.follow_up_status,
        assigned_to_name: formData.assigned_to_name.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      });

      success(`Registered visitor ${created.full_name} successfully!`);
      setIsAddModalOpen(false);
    } catch (err) {
      console.error(err);
      toastError('Could not register visitor.');
    }
  };

  const handleConvert = (visitor: Visitor) => {
    try {
      const createdMember = convertVisitorToMember(visitor.id);
      if (createdMember) {
        success(
          `Converted ${visitor.full_name} into official Member ${createdMember.member_id} with Tithe Number ${createdMember.tithe_number}!`
        );
        setConvertingVisitor(null);
        if (selectedVisitorForDossier?.id === visitor.id) {
          setSelectedVisitorForDossier(null);
        }
      }
    } catch (err) {
      console.error(err);
      toastError('Failed to convert visitor into member.');
    }
  };

  const handleDelete = (visitor: Visitor) => {
    try {
      deleteVisitor(visitor.id);
      success(`Removed visitor record for ${visitor.full_name}`);
      setDeletingVisitor(null);
      if (selectedVisitorForDossier?.id === visitor.id) setSelectedVisitorForDossier(null);
      if (selectedVisitorForEdit?.id === visitor.id) setSelectedVisitorForEdit(null);
    } catch (err) {
      console.error(err);
      toastError('Could not delete visitor record.');
    }
  };

  const handleStatusChange = (visitorId: string, newStatus: VisitorStatus) => {
    updateVisitor(visitorId, { follow_up_status: newStatus });
    success(`Updated status to "${newStatus.replace(/_/g, ' ')}"`);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-blue-700" />
            Visitor Tracking & Assimilation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Nurturing first-time guests into committed disciples and registered church members
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
            title="Print or export Sunday evangelism sheet"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print Register</span>
          </button>

          <button
            onClick={() => {
              setFormData({
                full_name: '',
                gender: 'female',
                phone: '+233 ',
                email: '',
                address: '',
                gps_address: 'GA-',
                service_attended: 'Sunday 2nd Service (Celebration Service)',
                invited_by: '',
                how_heard: 'Friend / Family',
                prayer_request: '',
                follow_up_status: 'new',
                assigned_to_name: 'Pastor David Osei-Tutu',
                notes: '',
              });
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Visitor</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Total Recorded
          </span>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {metrics.total}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span>All guest entries</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-blue-700">{metrics.newVisitors} new</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-amber-200 bg-amber-50/20 shadow-2xs">
          <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide flex items-center justify-between">
            <span>Needs Follow-Up</span>
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
          </span>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-900 mt-1">
            {metrics.followUpRequired}
          </div>
          <div className="text-[11px] text-amber-800/80 mt-1">
            Urgent pastoral care required
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            In Contact
          </span>
          <div className="text-2xl font-bold font-mono tabular-nums text-purple-900 mt-1">
            {metrics.contacted}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Active phone & home visits
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Returning Guests
          </span>
          <div className="text-2xl font-bold font-mono tabular-nums text-indigo-900 mt-1">
            {metrics.returning}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Second/subsequent visits
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide flex items-center justify-between">
            <span>Converted to Members</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </span>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-900 mt-1">
            {metrics.converted}
          </div>
          <div className="text-[11px] text-emerald-800 mt-1 font-medium">
            <span className="font-mono tabular-nums font-bold">{metrics.conversionRate}%</span> conversion rate
          </div>
        </div>
      </div>

      {/* Search, Filters & View Toggle Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search Bar */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, phone, town, inviter..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-blue-600"
            />
          </div>

          {/* View Mode Toggle Buttons */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-stretch sm:self-auto justify-center">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Table Grid View"
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
                viewMode === 'kanban'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Assimilation Pipeline Kanban"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Pipeline</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Card Directory View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 text-xs">
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase">Stage</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-1.5 px-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-slate-700 font-medium"
            >
              <option value="all">All Statuses ({visitors.length})</option>
              <option value="new">New Visitors</option>
              <option value="follow_up_required">Follow-Up Required</option>
              <option value="contacted">Contacted</option>
              <option value="returning_visitor">Returning Guest</option>
              <option value="converted_to_member">Converted to Member</option>
              <option value="closed">Closed / Inactive</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase">Service Attended</label>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="w-full py-1.5 px-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-slate-700 font-medium truncate"
            >
              <option value="all">All Services</option>
              {serviceOptions.map((svc) => (
                <option key={svc} value={svc}>
                  {svc}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase">Assigned Minister</label>
            <select
              value={ministerFilter}
              onChange={(e) => setMinisterFilter(e.target.value)}
              className="w-full py-1.5 px-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-slate-700 font-medium truncate"
            >
              <option value="all">All Pastoral Team</option>
              {ministerOptions.map((min) => (
                <option key={min} value={min}>
                  {min}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase">Sort Order</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full py-1.5 px-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-slate-700 font-medium"
            >
              <option value="date_desc">Newest Visit Date</option>
              <option value="date_asc">Oldest Visit Date</option>
              <option value="name_asc">Visitor Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main View Area */}
      {filteredVisitors.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <UserX className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <h3 className="font-bold text-slate-800 text-sm">No visitors match your search filters</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search query, clearing status filters, or register a new first-time church guest.
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
              setServiceFilter('all');
              setMinisterFilter('all');
            }}
            className="mt-4 px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 text-xs font-semibold"
          >
            Clear All Filters
          </button>
        </div>
      ) : viewMode === 'kanban' ? (
        /* KANBAN ASSIMILATION PIPELINE VIEW */
        <AssimilationKanbanBoard
          visitors={filteredVisitors}
          onViewDossier={(v) => setSelectedVisitorForDossier(v)}
          onEdit={(v) => setSelectedVisitorForEdit(v)}
          onConvert={(v) => setConvertingVisitor(v)}
          onLogInteraction={(v) => setSelectedVisitorForLog(v)}
          onStatusChange={handleStatusChange}
        />
      ) : viewMode === 'table' ? (
        /* HIGH-DENSITY PROFESSIONAL DATA GRID TABLE */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Visitor & Gender</th>
                  <th className="py-3 px-4">Phone & Contacts</th>
                  <th className="py-3 px-4">Visit Date & Service</th>
                  <th className="py-3 px-4">Town / GPS</th>
                  <th className="py-3 px-4">Invited By</th>
                  <th className="py-3 px-4">Assigned Pastor</th>
                  <th className="py-3 px-4">Status & Stage</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVisitors.map((visitor) => {
                  const cleanPhone = visitor.phone.replace(/[^0-9]/g, '');
                  const whatsappUrl = `https://wa.me/${cleanPhone}?text=Calvary%20greetings%20${encodeURIComponent(
                    visitor.full_name
                  )}!%20Thank%20you%20for%20worshipping%20with%20us%20at%20Greater%20Works%20City%20Church.`;

                  const isConverted = visitor.follow_up_status === 'converted_to_member';

                  return (
                    <tr key={visitor.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Name & Gender */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => setSelectedVisitorForDossier(visitor)}
                          className="font-bold text-slate-900 hover:text-blue-700 transition text-left block"
                        >
                          {visitor.full_name}
                        </button>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                          <span className="capitalize">{visitor.gender || 'Not specified'}</span>
                          {visitor.prayer_request && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-amber-700 flex items-center gap-0.5" title={visitor.prayer_request}>
                                <Sparkles className="w-3 h-3" /> Prayer Need
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Phone & Communications */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-slate-800">{visitor.phone}</span>
                          <div className="flex items-center gap-1">
                            <a
                              href={`tel:${visitor.phone}`}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition"
                              title="Voice call"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition"
                              title="Chat on WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                        {visitor.email && (
                          <span className="text-[11px] text-slate-400 truncate max-w-[150px] block">
                            {visitor.email}
                          </span>
                        )}
                      </td>

                      {/* Visit Date & Service */}
                      <td className="py-3 px-4">
                        <span className="font-mono text-slate-800 font-medium block">
                          {visitor.visit_date}
                        </span>
                        <span className="text-[11px] text-slate-500 truncate max-w-[160px] block">
                          {visitor.service_attended}
                        </span>
                      </td>

                      {/* Location & GPS */}
                      <td className="py-3 px-4 text-slate-700">
                        <span className="block truncate max-w-[140px]">
                          {visitor.address || 'Joma area'}
                        </span>
                        {visitor.gps_address ? (
                          <span className="font-mono text-[10px] text-slate-400 block">
                            {visitor.gps_address}
                          </span>
                        ) : null}
                      </td>

                      {/* Invited By */}
                      <td className="py-3 px-4 text-slate-600">
                        <span className="block truncate max-w-[130px]">
                          {visitor.invited_by || 'Walk-in / Banner'}
                        </span>
                        <span className="text-[10px] text-slate-400 block">{visitor.how_heard || 'Friend'}</span>
                      </td>

                      {/* Assigned Minister */}
                      <td className="py-3 px-4 font-medium text-slate-800">
                        <span className="block truncate max-w-[140px]">
                          {visitor.assigned_to_name || 'Pastoral Board'}
                        </span>
                      </td>

                      {/* Stage Selector */}
                      <td className="py-3 px-4">
                        <select
                          value={visitor.follow_up_status}
                          onChange={(e) => handleStatusChange(visitor.id, e.target.value as VisitorStatus)}
                          className={`py-1 px-2 border rounded-lg text-xs font-semibold focus:outline-blue-600 ${
                            visitor.follow_up_status === 'new'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : visitor.follow_up_status === 'follow_up_required'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : visitor.follow_up_status === 'contacted'
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : visitor.follow_up_status === 'returning_visitor'
                              ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                              : isConverted
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          <option value="new">New</option>
                          <option value="follow_up_required">Action Required</option>
                          <option value="contacted">Contacted</option>
                          <option value="returning_visitor">Returning Guest</option>
                          <option value="converted_to_member">Member Enrolled</option>
                          <option value="closed">Closed</option>
                        </select>
                      </td>

                      {/* Action Tools */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedVisitorForDossier(visitor)}
                            className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-slate-100 rounded-lg transition"
                            title="View Visitor Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setSelectedVisitorForLog(visitor)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                            title="Log Follow-Up Call / Note"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setSelectedVisitorForEdit(visitor)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                            title="Edit Record"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {!isConverted ? (
                            <button
                              onClick={() => setConvertingVisitor(visitor)}
                              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 shadow-2xs"
                              title="Transfer visitor into official membership"
                            >
                              <UserPlus className="w-3 h-3" />
                              <span>Convert</span>
                            </button>
                          ) : (
                            <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-0.5">
                              <CheckCircle className="w-3.5 h-3.5" />
                            </span>
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
      ) : (
        /* CARDS GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVisitors.map((visitor) => {
            const cleanPhone = visitor.phone.replace(/[^0-9]/g, '');
            const whatsappUrl = `https://wa.me/${cleanPhone}?text=Calvary%20greetings%20${encodeURIComponent(
              visitor.full_name
            )}!%20Thank%20you%20for%20worshipping%20with%20us%20at%20Greater%20Works%20City%20Church.`;

            const isConverted = visitor.follow_up_status === 'converted_to_member';

            return (
              <div
                key={visitor.id}
                className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs hover:border-slate-300 transition flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <button
                        onClick={() => setSelectedVisitorForDossier(visitor)}
                        className="text-base font-bold text-slate-900 hover:text-blue-700 transition text-left"
                      >
                        {visitor.full_name}
                      </button>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span>Visited {visitor.visit_date}</span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize">{visitor.gender || 'Guest'}</span>
                      </div>
                    </div>

                    <select
                      value={visitor.follow_up_status}
                      onChange={(e) => handleStatusChange(visitor.id, e.target.value as VisitorStatus)}
                      className={`text-[11px] font-semibold py-1 px-2 border rounded-lg focus:outline-blue-600 ${
                        visitor.follow_up_status === 'new'
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : visitor.follow_up_status === 'follow_up_required'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : visitor.follow_up_status === 'contacted'
                          ? 'bg-purple-50 text-purple-800 border-purple-200'
                          : visitor.follow_up_status === 'returning_visitor'
                          ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                          : isConverted
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      <option value="new">New</option>
                      <option value="follow_up_required">Action Required</option>
                      <option value="contacted">Contacted</option>
                      <option value="returning_visitor">Returning Guest</option>
                      <option value="converted_to_member">Member Enrolled</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>

                  {/* Contact & Service Info */}
                  <div className="text-xs space-y-1.5 text-slate-600 bg-slate-50 p-3 rounded-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Phone:</span>
                      <span className="font-mono font-semibold text-slate-800">{visitor.phone}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Service:</span>
                      <span className="font-medium text-slate-800 truncate max-w-[180px]">
                        {visitor.service_attended}
                      </span>
                    </div>
                    {visitor.invited_by && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Invited By:</span>
                        <span className="font-medium text-slate-800 truncate max-w-[180px]">
                          {visitor.invited_by}
                        </span>
                      </div>
                    )}
                    {visitor.address && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Address:</span>
                        <span className="font-medium text-slate-800 truncate max-w-[180px]">
                          {visitor.address}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Prayer Request Quote */}
                  {visitor.prayer_request && (
                    <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs space-y-1">
                      <span className="font-bold text-amber-900 flex items-center gap-1 text-[11px]">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Prayer Request
                      </span>
                      <p className="text-slate-700 italic line-clamp-2">&ldquo;{visitor.prayer_request}&rdquo;</p>
                    </div>
                  )}

                  {/* Assigned Minister */}
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <span>Assigned Pastoral Care:</span>
                    <span className="font-semibold text-slate-800">
                      {visitor.assigned_to_name || 'Pastoral Board'}
                    </span>
                  </div>
                </div>

                {/* Card Bottom Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`tel:${visitor.phone}`}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1 transition"
                    >
                      <Phone className="w-3.5 h-3.5 text-slate-600" />
                      <span>Call</span>
                    </a>
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 transition shadow-2xs"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                    <button
                      onClick={() => setSelectedVisitorForDossier(visitor)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>

                  {!isConverted ? (
                    <button
                      onClick={() => setConvertingVisitor(visitor)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1 transition shadow-2xs"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Convert</span>
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>Member</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CONVERT TO MEMBER CONFIRMATION MODAL */}
      {convertingVisitor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl">
                <UserPlus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Convert Visitor to Official Member</h3>
                <p className="text-xs text-slate-500">Greater Works City Church (GWCC)</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to transition <strong>{convertingVisitor.full_name}</strong> from guest status into full registered church membership?
            </p>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5 text-slate-700">
              <p>• Automatically issues next sequential <strong>Member ID</strong> (e.g. GWCC-######)</p>
              <p>• Automatically provisions initial <strong>Tithe Number</strong></p>
              <p>• Preserves Ghanaian phone ({convertingVisitor.phone}), address, and spiritual notes</p>
              <p>• Retains complete visitor history without creating duplicate entries</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConvertingVisitor(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConvert(convertingVisitor)}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition"
              >
                Yes, Convert Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE VISITOR CONFIRMATION MODAL */}
      {deletingVisitor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 text-rose-700 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Visitor Record</h3>
                <p className="text-xs text-slate-500">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to delete the visitor record for <strong>{deletingVisitor.full_name}</strong>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingVisitor(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deletingVisitor)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD VISITOR MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 bg-blue-800 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Register Church Visitor</h3>
                <p className="text-xs text-blue-100">Greater Works City Church, Joma Assembly</p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-3.5 text-xs overflow-y-auto">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Visitor Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-blue-600"
                  placeholder="e.g. Sister Priscilla Owusu"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone (+233) *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:outline-blue-600"
                    placeholder="+233 24 000 0000"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as GenderType })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-blue-600"
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Residential Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-blue-600"
                    placeholder="e.g. Ablekuma Fanmilk"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">GhanaPost GPS Digital Address</label>
                  <input
                    type="text"
                    value={formData.gps_address}
                    onChange={(e) => setFormData({ ...formData, gps_address: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs uppercase focus:outline-blue-600"
                    placeholder="GA-183-4921"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Service Attended</label>
                  <select
                    value={formData.service_attended}
                    onChange={(e) => setFormData({ ...formData, service_attended: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-blue-600"
                  >
                    <option value="Sunday 1st Service (Prophetic Encounter)">Sunday 1st Service</option>
                    <option value="Sunday 2nd Service (Celebration Service)">Sunday 2nd Service</option>
                    <option value="Midweek Miracle & Teaching Service">Midweek Miracle Service</option>
                    <option value="Friday All-Night Deliverance Vigil">Friday All-Night Vigil</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Invited By</label>
                  <input
                    type="text"
                    value={formData.invited_by}
                    onChange={(e) => setFormData({ ...formData, invited_by: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-blue-600"
                    placeholder="e.g. Kwame Mensah"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">How Heard About GWCC</label>
                  <select
                    value={formData.how_heard}
                    onChange={(e) => setFormData({ ...formData, how_heard: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-blue-600"
                  >
                    <option value="Friend / Family">Friend / Family</option>
                    <option value="Roadside Banner">Roadside Banner</option>
                    <option value="Church Evangelism Outreach">Evangelism Outreach</option>
                    <option value="Social Media (Facebook / TikTok)">Social Media</option>
                    <option value="Radio / Broadcast">Radio / Broadcast</option>
                    <option value="Walked In">Walked In</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Minister</label>
                  <input
                    type="text"
                    value={formData.assigned_to_name}
                    onChange={(e) => setFormData({ ...formData, assigned_to_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-blue-600"
                    placeholder="Pastor David Osei-Tutu"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Prayer Request (Optional)</label>
                <textarea
                  rows={2}
                  value={formData.prayer_request}
                  onChange={(e) => setFormData({ ...formData, prayer_request: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-blue-600"
                  placeholder="Prayer need or spiritual counseling request..."
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs transition"
                >
                  Register Visitor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VISITOR DOSSIER MODAL */}
      <VisitorDossierModal
        visitor={selectedVisitorForDossier}
        isOpen={Boolean(selectedVisitorForDossier)}
        onClose={() => setSelectedVisitorForDossier(null)}
        onEdit={(v) => {
          setSelectedVisitorForDossier(null);
          setSelectedVisitorForEdit(v);
        }}
        onConvert={(v) => {
          setSelectedVisitorForDossier(null);
          setConvertingVisitor(v);
        }}
        onLogInteraction={(v) => {
          setSelectedVisitorForDossier(null);
          setSelectedVisitorForLog(v);
        }}
      />

      {/* EDIT VISITOR MODAL */}
      <EditVisitorModal
        visitor={selectedVisitorForEdit}
        isOpen={Boolean(selectedVisitorForEdit)}
        onClose={() => setSelectedVisitorForEdit(null)}
        onDeleteRequest={(v) => setDeletingVisitor(v)}
      />

      {/* LOG PASTORAL INTERACTION MODAL */}
      <LogInteractionModal
        visitor={selectedVisitorForLog}
        isOpen={Boolean(selectedVisitorForLog)}
        onClose={() => setSelectedVisitorForLog(null)}
      />

      {/* PRINT VISITORS REGISTER MODAL */}
      <PrintVisitorsModal
        visitors={filteredVisitors}
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
      />
    </div>
  );
};
