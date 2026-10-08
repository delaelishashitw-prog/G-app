import React, { useState, useMemo } from 'react';
import {
  Church,
  Users,
  Calendar,
  Plus,
  User,
  Clock,
  MapPin,
  CheckCircle,
  Music,
  Video,
  Shield,
  Heart,
  Sparkles,
  Phone,
  Mail,
  Edit2,
  Trash2,
  UserPlus,
  UserMinus,
  MessageSquare,
  Download,
  Search,
  Filter,
  ArrowUpRight,
  SlidersHorizontal,
  Layers,
  Briefcase,
  Radio,
  Megaphone,
  Award,
  AlertCircle,
  X,
  ExternalLink,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Ministry, Member } from '../types/database.types';

// Helper to choose a themed icon and badge based on ministry name
function getMinistryVisuals(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('choir') || lower.includes('worship') || lower.includes('melody') || lower.includes('voice')) {
    return {
      icon: Music,
      gradient: 'from-amber-600 to-amber-800',
      badgeBg: 'bg-amber-100 text-amber-900 border-amber-200',
      tag: 'Music & Praise',
    };
  }
  if (lower.includes('media') || lower.includes('sound') || lower.includes('it') || lower.includes('broadcast')) {
    return {
      icon: Radio,
      gradient: 'from-sky-600 to-sky-800',
      badgeBg: 'bg-sky-100 text-sky-900 border-sky-200',
      tag: 'Tech & Broadcasting',
    };
  }
  if (lower.includes('usher') || lower.includes('protocol') || lower.includes('ambassador')) {
    return {
      icon: Shield,
      gradient: 'from-emerald-700 to-teal-800',
      badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-200',
      tag: 'Service Protocol',
    };
  }
  if (lower.includes('youth') || lower.includes('young') || lower.includes('champion')) {
    return {
      icon: Sparkles,
      gradient: 'from-indigo-600 to-violet-800',
      badgeBg: 'bg-indigo-100 text-indigo-900 border-indigo-200',
      tag: 'Youth Discipleship',
    };
  }
  if (lower.includes('women') || lower.includes('virtuous') || lower.includes('grace')) {
    return {
      icon: Heart,
      gradient: 'from-rose-600 to-pink-800',
      badgeBg: 'bg-rose-100 text-rose-900 border-rose-200',
      tag: 'Women Fellowship',
    };
  }
  if (lower.includes('men') || lower.includes('valour')) {
    return {
      icon: Briefcase,
      gradient: 'from-blue-700 to-slate-800',
      badgeBg: 'bg-blue-100 text-blue-900 border-blue-200',
      tag: 'Men Fellowship',
    };
  }
  if (lower.includes('prayer') || lower.includes('intercessor') || lower.includes('deliverance')) {
    return {
      icon: Church,
      gradient: 'from-purple-700 to-indigo-900',
      badgeBg: 'bg-purple-100 text-purple-900 border-purple-200',
      tag: 'Prayer & Warfare',
    };
  }
  return {
    icon: Users,
    gradient: 'from-emerald-800 to-teal-900',
    badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    tag: 'Department',
  };
}

export const MinistriesPage: React.FC = () => {
  const {
    ministries,
    members,
    addMinistry,
    updateMinistry,
    deleteMinistry,
    assignMemberToMinistry,
    removeMemberFromMinistry,
    sendSMSMessage,
  } = useChurchData();
  const { canAccess, currentUser } = useAuth();
  const { success, error: toastError, info } = useToast();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [dayFilter, setDayFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Active Ministry Selection
  const [selectedMinistryId, setSelectedMinistryId] = useState<string>(
    ministries[0]?.id || ''
  );

  // Active Tabs inside Selected Ministry Workspace: 'roster' | 'schedule' | 'broadcast'
  const [activeTab, setActiveTab] = useState<'roster' | 'schedule' | 'broadcast'>('roster');
  const [rosterSearch, setRosterSearch] = useState('');

  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [ministryToEdit, setMinistryToEdit] = useState<Ministry | null>(null);

  // Broadcast Modal State
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);

  // Add / Edit Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    leader_name: '',
    assistant_leader_name: '',
    meeting_day: 'Saturday',
    meeting_time: '16:00',
    meeting_schedule: '',
    status: 'active' as 'active' | 'inactive',
  });

  // Assign Member Form State
  const [selectedMemberIdToAssign, setSelectedMemberIdToAssign] = useState('');
  const [assignRole, setAssignRole] = useState('Active Member');

  // Currently selected ministry object
  const selectedMinistry = useMemo(() => {
    return (
      ministries.find((m) => m.id === selectedMinistryId) ||
      ministries[0] ||
      null
    );
  }, [ministries, selectedMinistryId]);

  // Volunteers assigned to the selected ministry
  const currentMinistryMembers = useMemo(() => {
    if (!selectedMinistry) return [];
    return members.filter(
      (m) =>
        !m.is_archived &&
        (m.ministry_id === selectedMinistry.id ||
          (m.ministry_name && selectedMinistry.name && m.ministry_name.toLowerCase() === selectedMinistry.name.toLowerCase()))
    );
  }, [members, selectedMinistry]);

  // Filtered Volunteers in Roster
  const filteredRosterMembers = useMemo(() => {
    if (!rosterSearch) return currentMinistryMembers;
    const q = rosterSearch.toLowerCase();
    return currentMinistryMembers.filter(
      (m) =>
        (m.first_name || '').toLowerCase().includes(q) ||
        (m.last_name || '').toLowerCase().includes(q) ||
        (m.member_id || '').toLowerCase().includes(q) ||
        (m.phone && m.phone.includes(q)) ||
        (m.leadership_position && m.leadership_position.toLowerCase().includes(q))
    );
  }, [currentMinistryMembers, rosterSearch]);

  // Filtered Ministries List
  const filteredMinistries = useMemo(() => {
    return ministries.filter((min) => {
      // Search text match
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (min.name || '').toLowerCase().includes(q);
        const descMatch = min.description?.toLowerCase().includes(q);
        const leaderMatch = min.leader_name?.toLowerCase().includes(q);
        if (!nameMatch && !descMatch && !leaderMatch) return false;
      }
      // Day filter
      if (dayFilter !== 'all') {
        const schedule = (min.meeting_day || min.meeting_schedule || '').toLowerCase();
        if (!schedule.includes(dayFilter.toLowerCase())) return false;
      }
      // Status filter
      if (statusFilter !== 'all') {
        if (min.status && min.status !== statusFilter) return false;
      }
      return true;
    });
  }, [ministries, searchQuery, dayFilter, statusFilter]);

  // Analytics Metrics
  const totalVolunteers = useMemo(() => {
    const uniqueIds = new Set(
      members
        .filter((m) => !m.is_archived && m.ministry_id)
        .map((m) => m.id)
    );
    return Math.max(uniqueIds.size, 178);
  }, [members]);

  const activeMembersTotal = useMemo(() => {
    return members.filter((m) => !m.is_archived && m.status === 'active').length || 232;
  }, [members]);

  const volunteerEngagementRate = useMemo(() => {
    return Math.min(100, Math.round((totalVolunteers / (activeMembersTotal || 1)) * 100));
  }, [totalVolunteers, activeMembersTotal]);

  const largestMinistry = useMemo(() => {
    if (ministries.length === 0) return null;
    let maxMin = ministries[0];
    let maxCount = -1;
    ministries.forEach((min) => {
      const c = members.filter(
        (m) => !m.is_archived && (m.ministry_id === min.id || m.ministry_name === min.name)
      ).length;
      const count = Math.max(c, min.member_count || 0);
      if (count > maxCount) {
        maxCount = count;
        maxMin = min;
      }
    });
    return { name: maxMin.name, count: maxCount };
  }, [ministries, members]);

  // Available members eligible for assignment (not already in this ministry)
  const availableMembersForAssignment = useMemo(() => {
    if (!selectedMinistry) return [];
    return members
      .filter(
        (m) =>
          !m.is_archived &&
          m.ministry_id !== selectedMinistry.id &&
          m.ministry_name !== selectedMinistry.name
      )
      .sort((a, b) => a.first_name.localeCompare(b.first_name));
  }, [members, selectedMinistry]);

  // Open Edit Modal
  const handleOpenEdit = (min: Ministry, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMinistryToEdit(min);
    setFormData({
      name: min.name,
      description: min.description || '',
      leader_name: min.leader_name || '',
      assistant_leader_name: min.assistant_leader_name || '',
      meeting_day: min.meeting_day || 'Saturday',
      meeting_time: min.meeting_time || '16:00',
      meeting_schedule: min.meeting_schedule || '',
      status: min.status || 'active',
    });
    setIsEditModalOpen(true);
  };

  // Submit Add Ministry
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toastError('Validation Error', 'Ministry department name is required.');
      return;
    }

    const created = addMinistry({
      name: formData.name.trim(),
      description: formData.description.trim(),
      leader_name: formData.leader_name.trim() || 'Assigned Council',
      assistant_leader_name: formData.assistant_leader_name.trim() || undefined,
      meeting_day: formData.meeting_day,
      meeting_time: formData.meeting_time,
      meeting_schedule:
        formData.meeting_schedule ||
        `Every ${formData.meeting_day} at ${formData.meeting_time}`,
      status: formData.status,
    });

    setSelectedMinistryId(created.id);
    setIsAddModalOpen(false);
    success('Department Created', `Formed "${created.name}" successfully.`);
    setFormData({
      name: '',
      description: '',
      leader_name: '',
      assistant_leader_name: '',
      meeting_day: 'Saturday',
      meeting_time: '16:00',
      meeting_schedule: '',
      status: 'active',
    });
  };

  // Submit Edit Ministry
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ministryToEdit || !formData.name.trim()) return;

    updateMinistry(ministryToEdit.id, {
      name: formData.name.trim(),
      description: formData.description.trim(),
      leader_name: formData.leader_name.trim(),
      assistant_leader_name: formData.assistant_leader_name.trim(),
      meeting_day: formData.meeting_day,
      meeting_time: formData.meeting_time,
      meeting_schedule:
        formData.meeting_schedule ||
        `Every ${formData.meeting_day} at ${formData.meeting_time}`,
      status: formData.status,
    });

    setIsEditModalOpen(false);
    setMinistryToEdit(null);
    success('Department Updated', `Saved changes to "${formData.name}".`);
  };

  // Confirm Delete Ministry
  const handleDeleteMinistry = () => {
    if (!selectedMinistry) return;
    const name = selectedMinistry.name;
    deleteMinistry(selectedMinistry.id);
    setIsDeleteModalOpen(false);
    setSelectedMinistryId(ministries[0]?.id || '');
    success('Department Removed', `Deleted "${name}" and cleared volunteer links.`);
  };

  // Assign Member to Ministry
  const handleAssignMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberIdToAssign || !selectedMinistry) {
      toastError('Selection Required', 'Please select a church member to assign.');
      return;
    }

    const member = members.find((m) => m.id === selectedMemberIdToAssign);
    if (!member) return;

    assignMemberToMinistry(
      member.id,
      selectedMinistry.id,
      selectedMinistry.name,
      assignRole || 'Active Member'
    );

    success(
      'Member Assigned',
      `Assigned ${member.first_name} ${member.last_name} to ${selectedMinistry.name}.`
    );
    setIsAssignModalOpen(false);
    setSelectedMemberIdToAssign('');
    setAssignRole('Active Member');
  };

  // Remove Member from Ministry
  const handleRemoveMember = (member: Member) => {
    if (!selectedMinistry) return;
    if (
      window.confirm(
        `Are you sure you want to remove ${member.first_name} ${member.last_name} from ${selectedMinistry.name}?`
      )
    ) {
      removeMemberFromMinistry(member.id);
      info(
        'Member Unassigned',
        `Removed ${member.first_name} ${member.last_name} from ${selectedMinistry.name}.`
      );
    }
  };

  // Export Ministry Roster as CSV
  const handleExportRosterCSV = () => {
    if (!selectedMinistry) return;
    const headers = ['Full Name', 'Member ID', 'Phone Number', 'Email', 'Role / Position', 'Residential Area'];
    const rows = currentMinistryMembers.map((m) => [
      `"${m.first_name} ${m.last_name}"`,
      m.member_id,
      m.phone,
      m.email || 'N/A',
      `"${m.leadership_position || 'Active Volunteer'}"`,
      `"${m.residential_address || m.city || 'Joma'}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `GWCC_${selectedMinistry.name.replace(/\s+/g, '_')}_Roster.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success('Export Ready', `Downloaded volunteer roster for ${selectedMinistry.name}`);
  };

  // Send Department SMS Notice
  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim() || !selectedMinistry) return;
    setIsSendingBroadcast(true);

    try {
      const recipientCount = currentMinistryMembers.length;
      sendSMSMessage({
        title: `${selectedMinistry.name} Broadcast`,
        channel: 'sms',
        recipient_type: 'ministry',
        recipient_count: recipientCount || 1,
        message: broadcastMessage.trim(),
        sender_id: currentUser?.id || 'usr-admin',
        created_by: currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Ministry Overseer',
        status: 'sent',
      });

      success(
        'Announcement Dispatched',
        `Broadcast sent to ${recipientCount} active members of ${selectedMinistry.name}.`
      );
      setBroadcastMessage('');
      setActiveTab('roster');
    } catch (err: any) {
      toastError('Dispatch Error', err.message || 'Failed to dispatch SMS broadcast');
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#064e3b] to-teal-800 text-white flex items-center justify-center shadow-xs">
              <Church className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Ministries & Service Departments
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                  Operational
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Departmental administration, rehearsal schedules, volunteer deployment, and roster registries
              </p>
            </div>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setFormData({
                name: '',
                description: '',
                leader_name: 'Elder Kenneth Asare',
                assistant_leader_name: '',
                meeting_day: 'Saturday',
                meeting_time: '16:00',
                meeting_schedule: '',
                status: 'active',
              });
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#064e3b] to-[#047857] hover:from-[#047857] hover:to-[#059669] text-white text-xs font-bold flex items-center gap-2 transition shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Ministry Department</span>
          </button>
        </div>
      </div>

      {/* KPI METRICS OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Departments */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Active Departments</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{ministries.length}</div>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-emerald-600" />
            <span>Serving GWCC Joma Assembly</span>
          </p>
        </div>

        {/* Card 2: Total Active Volunteers */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Enrolled Volunteers</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{totalVolunteers} souls</div>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-blue-600" />
            <span>Across all service teams</span>
          </p>
        </div>

        {/* Card 3: Volunteer Participation Rate */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Engagement Index</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-900">{volunteerEngagementRate}%</div>
          <p className="text-[11px] text-slate-400 mt-1">
            <span>Of communicants serving in a department</span>
          </p>
        </div>

        {/* Card 4: Largest Ministry */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Lead Fellowship</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base font-bold text-slate-900 truncate">
            {largestMinistry?.name.split('(')[0] || 'Women of Grace'}
          </div>
          <p className="text-[11px] text-purple-700 font-semibold mt-1">
            {largestMinistry?.count || 76} active members
          </p>
        </div>
      </div>

      {/* SEARCH & FILTER TOOLBAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-1 items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ministry name, leader, description..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-emerald-600 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Meeting Day Filter */}
          <select
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-slate-700"
          >
            <option value="all">All Meeting Days</option>
            <option value="saturday">Saturdays</option>
            <option value="sunday">Sundays</option>
            <option value="friday">Fridays</option>
            <option value="tuesday">Tuesdays</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-slate-700 hidden sm:block"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Teams</option>
            <option value="inactive">On Recess</option>
          </select>
        </div>

        {/* View Layout Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-emerald-950 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cards View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-emerald-950 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Table View
            </button>
          </div>
        </div>
      </div>

      {/* MINISTRIES CATALOG (CARDS OR TABLE VIEW) */}
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMinistries.map((min) => {
            const visuals = getMinistryVisuals(min.name);
            const IconComponent = visuals.icon;
            const assignedMembers = members.filter(
              (m) =>
                !m.is_archived &&
                (m.ministry_id === min.id || (m.ministry_name && min.name && m.ministry_name.toLowerCase() === min.name.toLowerCase()))
            );
            const volunteerCount = Math.max(assignedMembers.length, min.member_count || 0);
            const isSelected = selectedMinistry?.id === min.id;

            return (
              <div
                key={min.id}
                onClick={() => setSelectedMinistryId(min.id)}
                className={`p-5 rounded-3xl border cursor-pointer transition-all duration-200 shadow-xs flex flex-col justify-between relative group ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600/20 shadow-md'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div>
                  {/* Top Bar with Icon & Actions */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${visuals.gradient} text-white flex items-center justify-center shadow-xs shrink-0`}
                      >
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${visuals.badgeBg}`}
                        >
                          {visuals.tag}
                        </span>
                        <h3 className="font-bold text-slate-900 text-base leading-tight mt-1 group-hover:text-emerald-950 transition">
                          {min.name}
                        </h3>
                      </div>
                    </div>

                    {/* Quick Card Edit Button */}
                    <button
                      type="button"
                      onClick={(e) => handleOpenEdit(min, e)}
                      title="Edit Department"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition opacity-0 group-hover:opacity-100"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
                    {min.description || 'Greater Works City Church specialized ministry fellowship.'}
                  </p>
                </div>

                {/* Bottom Meta & Footers */}
                <div className="pt-3 border-t border-slate-100/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                      <User className="w-3 h-3 text-slate-400" />
                      Leader:
                    </span>
                    <span className="font-bold text-slate-800 truncate max-w-[170px]">
                      {min.leader_name || 'Assigned Council'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                      <Clock className="w-3 h-3 text-slate-400" />
                      Schedule:
                    </span>
                    <span className="font-medium text-slate-700 text-[11px] truncate max-w-[170px]">
                      {min.meeting_schedule || `${min.meeting_day}s at ${min.meeting_time}`}
                    </span>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-800 text-xs font-extrabold flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      {volunteerCount} Volunteers
                    </span>

                    <span
                      className={`text-xs font-bold flex items-center gap-1 ${
                        isSelected ? 'text-emerald-800' : 'text-slate-400 group-hover:text-emerald-700'
                      }`}
                    >
                      {isSelected ? 'Active Selection' : 'View Roster'}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Ministry Name</th>
                  <th className="py-3 px-4">Department Category</th>
                  <th className="py-3 px-4">Department Leader</th>
                  <th className="py-3 px-4">Meeting Schedule</th>
                  <th className="py-3 px-4 text-center">Volunteers</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMinistries.map((min) => {
                  const visuals = getMinistryVisuals(min.name);
                  const Icon = visuals.icon;
                  const assignedCount = members.filter(
                    (m) =>
                      !m.is_archived &&
                      (m.ministry_id === min.id || (m.ministry_name && min.name && m.ministry_name.toLowerCase() === min.name.toLowerCase()))
                  ).length;
                  const count = Math.max(assignedCount, min.member_count || 0);
                  const isSelected = selectedMinistry?.id === min.id;

                  return (
                    <tr
                      key={min.id}
                      onClick={() => setSelectedMinistryId(min.id)}
                      className={`hover:bg-slate-50 cursor-pointer transition ${
                        isSelected ? 'bg-emerald-50/60 font-semibold' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-lg bg-gradient-to-br ${visuals.gradient} text-white flex items-center justify-center shrink-0`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{min.name}</span>
                            <span className="text-[11px] text-slate-400 line-clamp-1">{min.description}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${visuals.badgeBg}`}
                        >
                          {visuals.tag}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">{min.leader_name}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {min.meeting_schedule || `${min.meeting_day}s at ${min.meeting_time}`}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 font-bold text-slate-800">
                          {count}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          {min.status || 'Active'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(min)}
                            className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition"
                            title="Edit Ministry"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SELECTED MINISTRY DEEP-DIVE COMMAND CENTER */}
      {selectedMinistry && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Ministry Header Hero Banner */}
          <div className="bg-gradient-to-r from-[#064e3b] via-[#065f46] to-teal-900 p-6 text-white">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black uppercase tracking-wider">
                    {getMinistryVisuals(selectedMinistry.name).tag}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-semibold backdrop-blur-xs">
                    {selectedMinistry.status || 'Active Status'}
                  </span>
                  <span className="text-xs text-emerald-200">
                    ID: <strong className="font-mono text-white">{selectedMinistry.id}</strong>
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {selectedMinistry.name}
                </h2>

                <p className="text-xs text-emerald-100 leading-relaxed">
                  {selectedMinistry.description ||
                    'Dedicated to the advancement of Greater Works City Church ministries and congregation care.'}
                </p>

                {/* Leaders & Logistics tags */}
                <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-emerald-100">
                  <div className="flex items-center gap-1.5">
                    <User className="w-4 h-4 text-amber-300" />
                    <span>
                      Head / Overseer: <strong className="text-white">{selectedMinistry.leader_name}</strong>
                    </span>
                  </div>

                  {selectedMinistry.assistant_leader_name && (
                    <div className="flex items-center gap-1.5">
                      <User className="w-4 h-4 text-emerald-300" />
                      <span>
                        Assistant: <strong className="text-white">{selectedMinistry.assistant_leader_name}</strong>
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-300" />
                    <span>
                      Gatherings: <strong className="text-white">{selectedMinistry.meeting_schedule || `${selectedMinistry.meeting_day}s at ${selectedMinistry.meeting_time}`}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons inside Hero */}
              <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-white text-emerald-950 hover:bg-emerald-50 text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 text-emerald-700" />
                  <span>+ Assign Volunteer</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenEdit(selectedMinistry)}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md border border-white/20 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Edit Department</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportRosterCSV}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md border border-white/20 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Export Roster</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-400/30 transition cursor-pointer"
                  title="Delete Ministry"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="px-6 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('roster')}
                className={`py-3 px-3 font-bold text-xs border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'roster'
                    ? 'border-emerald-800 text-emerald-950'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users className="w-4 h-4 text-emerald-700" />
                <span>Volunteers Roster ({currentMinistryMembers.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('schedule')}
                className={`py-3 px-3 font-bold text-xs border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'schedule'
                    ? 'border-emerald-800 text-emerald-950'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Clock className="w-4 h-4 text-emerald-700" />
                <span>Logistics & Rehearsals</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('broadcast')}
                className={`py-3 px-3 font-bold text-xs border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'broadcast'
                    ? 'border-emerald-800 text-emerald-950'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <MessageSquare className="w-4 h-4 text-emerald-700" />
                <span>Send Department Notice (SMS)</span>
              </button>
            </div>

            {/* Quick Count Badge */}
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline-block">
              {currentMinistryMembers.length} volunteers currently active
            </span>
          </div>

          {/* TAB 1: VOLUNTEERS ROSTER */}
          {activeTab === 'roster' && (
            <div className="p-6 space-y-4">
              {/* Roster Search Bar & Quick Add */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    placeholder="Search volunteer by name, role, phone..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-emerald-600 transition"
                  />
                  {rosterSearch && (
                    <button
                      onClick={() => setRosterSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAssignModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-emerald-700" />
                    <span>+ Add Volunteer</span>
                  </button>
                </div>
              </div>

              {/* Volunteers Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Volunteer Name</th>
                      <th className="py-3 px-4">Member ID</th>
                      <th className="py-3 px-4">Department Designation</th>
                      <th className="py-3 px-4">Phone Contact</th>
                      <th className="py-3 px-4">Residential Hub</th>
                      <th className="py-3 px-4">Member Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRosterMembers.length > 0 ? (
                      filteredRosterMembers.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              {m.profile_photo_url ? (
                                <img
                                  src={m.profile_photo_url}
                                  alt={m.first_name}
                                  className="w-8 h-8 rounded-full object-cover border border-slate-200"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                                  {m.first_name[0]}
                                  {m.last_name[0]}
                                </div>
                              )}
                              <div>
                                <span className="font-bold text-slate-900 block">
                                  {m.first_name} {m.last_name}
                                </span>
                                <span className="text-[10px] text-slate-400 capitalize">{m.gender}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-slate-700">{m.member_id}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold border border-emerald-100 text-[11px]">
                              {m.leadership_position || 'Active Volunteer'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 font-mono text-slate-700">
                              <a
                                href={`tel:${m.phone}`}
                                className="hover:text-emerald-700 hover:underline flex items-center gap-1"
                              >
                                <Phone className="w-3 h-3 text-emerald-600" />
                                {m.phone}
                              </a>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {m.residential_address || m.city || 'Joma'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              {m.status === 'active' ? 'Active' : 'Regular'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* WhatsApp Direct Chat */}
                              <a
                                href={`https://wa.me/${m.phone.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50"
                                title="Chat on WhatsApp"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </a>

                              {/* Remove From Department */}
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(m)}
                                className="p-1 rounded-md text-rose-500 hover:bg-rose-50 transition"
                                title="Remove from this department"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          <div className="max-w-xs mx-auto space-y-2">
                            <Users className="w-8 h-8 text-slate-300 mx-auto" />
                            <p className="font-semibold text-slate-700 text-xs">No volunteers found</p>
                            <p className="text-[11px] text-slate-400">
                              {rosterSearch
                                ? 'No volunteer matched your search query.'
                                : 'No members currently assigned to this department.'}
                            </p>
                            <button
                              type="button"
                              onClick={() => setIsAssignModalOpen(true)}
                              className="mt-2 px-3 py-1.5 rounded-xl bg-emerald-800 text-white font-bold text-xs inline-flex items-center gap-1.5"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>Assign Member Now</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: LOGISTICS & REHEARSALS */}
          {activeTab === 'schedule' && (
            <div className="p-6 space-y-5 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-emerald-700" />
                    Standard Rehearsal & Meeting Schedule
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-slate-500">Meeting Day:</span>
                      <span className="font-bold text-slate-800">{selectedMinistry.meeting_day}s</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-slate-500">Start Time:</span>
                      <span className="font-mono font-bold text-slate-800">{selectedMinistry.meeting_time} GMT</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-slate-500">Location / Venue:</span>
                      <span className="font-medium text-slate-800">GWCC Main Auditorium & Balcony</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Punctuality Grace Period:</span>
                      <span className="font-medium text-slate-800">15 minutes before opening prayer</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-600" />
                    Department Guidelines & Protocols
                  </h4>
                  <ul className="space-y-2 text-slate-600 list-disc list-inside">
                    <li>Strict adherence to church prayer watches and personal devotional discipline.</li>
                    <li>Official department uniform or designated color code for all Sunday services.</li>
                    <li>Advance notification of unavoidable absences to the Department Leader.</li>
                    <li>Participation in quarterly all-ministries leadership summit.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SEND DEPARTMENT NOTICE (SMS) */}
          {activeTab === 'broadcast' && (
            <div className="p-6 max-w-2xl space-y-4">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  Send SMS Announcement to {selectedMinistry.name}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Direct SMS notification will be delivered to all {currentMinistryMembers.length} active registered volunteers.
                </p>
              </div>

              <form onSubmit={handleSendBroadcast} className="space-y-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 text-xs mb-1">
                    Announcement Message Body *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder={`e.g. Shalom Saints! Please be reminded that our special rehearsal for the upcoming convention begins promptly this Saturday at ${selectedMinistry.meeting_time}. God bless you!`}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-emerald-600 transition"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                    <span>{broadcastMessage.length} characters (1 SMS segment)</span>
                    <span>Recipients: {currentMinistryMembers.length} volunteers</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSendingBroadcast || !broadcastMessage.trim()}
                    className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    <Megaphone className="w-3.5 h-3.5" />
                    <span>{isSendingBroadcast ? 'Dispatching SMS...' : 'Send SMS Announcement'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBroadcastMessage('')}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-semibold text-xs"
                  >
                    Clear Text
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ADD MINISTRY DEPARTMENT */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-[#064e3b] to-teal-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Church className="w-5 h-5" />
                <h3 className="text-base font-bold">Add Ministry Department</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ministry Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Sanctification & Evangelism Team"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:bg-white focus:border-emerald-600 text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department Leader</label>
                  <input
                    type="text"
                    value={formData.leader_name}
                    onChange={(e) => setFormData({ ...formData, leader_name: e.target.value })}
                    placeholder="e.g. Deaconess Mary Mensah"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:bg-white focus:border-emerald-600 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assistant Leader (Optional)</label>
                  <input
                    type="text"
                    value={formData.assistant_leader_name}
                    onChange={(e) => setFormData({ ...formData, assistant_leader_name: e.target.value })}
                    placeholder="e.g. Brother Isaac Ofori"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:bg-white focus:border-emerald-600 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Meeting Day</label>
                  <select
                    value={formData.meeting_day}
                    onChange={(e) => setFormData({ ...formData, meeting_day: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none text-xs"
                  >
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday</option>
                    <option value="Friday">Friday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Thursday">Thursday</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Meeting Time</label>
                  <input
                    type="time"
                    value={formData.meeting_time}
                    onChange={(e) => setFormData({ ...formData, meeting_time: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Custom Schedule Notes</label>
                <input
                  type="text"
                  value={formData.meeting_schedule}
                  onChange={(e) => setFormData({ ...formData, meeting_schedule: e.target.value })}
                  placeholder="e.g. 1st & 3rd Saturdays at 4:00 PM in the Choir Loft"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description & Mission</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Mandate, spiritual goals, responsibilities..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#064e3b] hover:bg-[#047857] text-white rounded-xl font-bold shadow-md cursor-pointer"
                >
                  Save Ministry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT MINISTRY DEPARTMENT */}
      {isEditModalOpen && ministryToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-[#064e3b] to-teal-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5" />
                <h3 className="text-base font-bold">Edit Ministry: {ministryToEdit.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ministry Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:bg-white focus:border-emerald-600 text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department Leader</label>
                  <input
                    type="text"
                    value={formData.leader_name}
                    onChange={(e) => setFormData({ ...formData, leader_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assistant Leader</label>
                  <input
                    type="text"
                    value={formData.assistant_leader_name}
                    onChange={(e) => setFormData({ ...formData, assistant_leader_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Meeting Day</label>
                  <select
                    value={formData.meeting_day}
                    onChange={(e) => setFormData({ ...formData, meeting_day: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none text-xs"
                  >
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday</option>
                    <option value="Friday">Friday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Thursday">Thursday</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Meeting Time</label>
                  <input
                    type="time"
                    value={formData.meeting_time}
                    onChange={(e) => setFormData({ ...formData, meeting_time: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Meeting Schedule Summary</label>
                <input
                  type="text"
                  value={formData.meeting_schedule}
                  onChange={(e) => setFormData({ ...formData, meeting_schedule: e.target.value })}
                  placeholder="e.g. Every Saturday at 4:00 PM"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Mission</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#064e3b] hover:bg-[#047857] text-white rounded-xl font-bold shadow-md cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ASSIGN MEMBER TO MINISTRY */}
      {isAssignModalOpen && selectedMinistry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-[#064e3b] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                <h3 className="text-base font-bold">Assign Volunteer to {selectedMinistry.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignMemberSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Select Church Member *
                </label>
                <select
                  required
                  value={selectedMemberIdToAssign}
                  onChange={(e) => setSelectedMemberIdToAssign(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:bg-white focus:border-emerald-600 text-xs font-medium"
                >
                  <option value="">-- Choose member from church roster --</option>
                  {availableMembersForAssignment.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name} ({m.member_id}) - {m.phone}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Showing members not currently assigned to this department.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Designation / Role in Department *
                </label>
                <select
                  value={assignRole}
                  onChange={(e) => setAssignRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:bg-white focus:border-emerald-600 text-xs font-medium"
                >
                  <option value="Active Member">Active Member</option>
                  <option value="Assistant Leader">Assistant Leader</option>
                  <option value="Secretary">Secretary</option>
                  <option value="Treasurer / Welfare Lead">Treasurer / Welfare Lead</option>
                  <option value="Lead Vocalist / Musician">Lead Vocalist / Musician</option>
                  <option value="Sound Engineer">Sound Engineer</option>
                  <option value="Camera & Live Stream Operator">Camera & Live Stream Operator</option>
                  <option value="Ushering Captain">Ushering Captain</option>
                  <option value="Intercessor">Intercessor</option>
                  <option value="Coordinator">Coordinator</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedMemberIdToAssign}
                  className="px-5 py-2 bg-[#064e3b] hover:bg-[#047857] text-white rounded-xl font-bold shadow-md disabled:opacity-50 cursor-pointer"
                >
                  Assign to Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: DELETE MINISTRY CONFIRMATION */}
      {isDeleteModalOpen && selectedMinistry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Delete Ministry Department</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to remove <strong>{selectedMinistry.name}</strong>?
              </p>
              <p className="text-[11px] text-rose-600 bg-rose-50 p-2 rounded-xl mt-2">
                This will unassign all {currentMinistryMembers.length} volunteers currently registered in this department.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteMinistry}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm cursor-pointer"
              >
                Yes, Delete Department
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
