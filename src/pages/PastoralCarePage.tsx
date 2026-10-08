import React, { useState, useMemo } from 'react';
import {
  HeartHandshake,
  Plus,
  Lock,
  Unlock,
  Heart,
  Calendar,
  Sparkles,
  CheckCircle2,
  Phone,
  User,
  Shield,
  ShieldCheck,
  MessageSquare,
  MapPin,
  Clock,
  BookOpen,
  Printer,
  Search,
  Filter,
  AlertCircle,
  MessageCircle,
  Check,
  Eye,
  EyeOff,
  Trash2,
  Edit2,
  Layers,
  ChevronRight,
  Flame,
  Radio,
} from 'lucide-react';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  PastoralCareLog,
  PastoralVisitationRecord,
  PastoralCounselingSession,
  PrayerRequest,
  IntercessoryWatchSlot,
  PastoralVisitationType,
} from '../types/database.types';

// Modals
import { LogVisitationModal } from '../components/pastoral/LogVisitationModal';
import { ScheduleCounselingModal } from '../components/pastoral/ScheduleCounselingModal';
import { AnsweredPrayerModal } from '../components/pastoral/AnsweredPrayerModal';
import { PrintPastoralReportModal } from '../components/pastoral/PrintPastoralReportModal';

export const PastoralCarePage: React.FC = () => {
  const { currentUser } = useAuth();
  const {
    pastoralCare,
    addPastoralCareLog,
    updatePastoralCareLog,
    deletePastoralCareLog,
    prayerRequests,
    addPrayerRequest,
    updatePrayerStatus,
    deletePrayerRequest,
    pastoralVisitations,
    addPastoralVisitation,
    updatePastoralVisitation,
    deletePastoralVisitation,
    counselingSessions,
    addCounselingSession,
    updateCounselingSession,
    deleteCounselingSession,
    intercessorySlots,
    members,
    settings,
  } = useChurchData();
  const { success, info, warning } = useToast();

  const defaultPastorName = currentUser?.first_name
    ? `${currentUser.first_name} ${currentUser.last_name}`
    : settings.senior_pastor || 'Prophet Elisha K. Richard';

  // Active Tab
  const [activeTab, setActiveTab] = useState<'visitations' | 'counseling' | 'prayers' | 'intercession' | 'radar'>('visitations');

  // Search & Filter State
  const [visitationSearch, setVisitationSearch] = useState('');
  const [visitationTypeFilter, setVisitationTypeFilter] = useState<string>('ALL');
  const [visitationStatusFilter, setVisitationStatusFilter] = useState<string>('ALL');

  const [counselingSearch, setCounselingSearch] = useState('');
  const [counselingTypeFilter, setCounselingTypeFilter] = useState<string>('ALL');
  const [counselingConfidentialUnlocked, setCounselingConfidentialUnlocked] = useState(false);

  const [prayerSearch, setPrayerSearch] = useState('');
  const [prayerCategoryFilter, setPrayerCategoryFilter] = useState<string>('ALL');
  const [prayerStatusFilter, setPrayerStatusFilter] = useState<string>('ALL');

  // Modals state
  const [isLogVisitationOpen, setIsLogVisitationOpen] = useState(false);
  const [editingVisitation, setEditingVisitation] = useState<PastoralVisitationRecord | null>(null);

  const [isScheduleCounselingOpen, setIsScheduleCounselingOpen] = useState(false);
  const [editingCounseling, setEditingCounseling] = useState<PastoralCounselingSession | null>(null);

  const [isPrayerModalOpen, setIsPrayerModalOpen] = useState(false);
  const [answeredPrayerTarget, setAnsweredPrayerTarget] = useState<PrayerRequest | null>(null);

  const [isPrintReportOpen, setIsPrintReportOpen] = useState(false);

  // New Prayer Request Simple Form State
  const [prayerForm, setPrayerForm] = useState({
    requester_name: '',
    requester_phone: '',
    member_id: '',
    category: 'Healing & Deliverance',
    request: '',
    is_confidential: false,
  });

  // Filtered Visitations
  const filteredVisitations = useMemo(() => {
    const q = (visitationSearch || '').toLowerCase();
    return pastoralVisitations.filter((v) => {
      const matchSearch =
        !q ||
        (v.member_name || '').toLowerCase().includes(q) ||
        (v.location || '').toLowerCase().includes(q) ||
        (v.pastor_in_charge || '').toLowerCase().includes(q) ||
        (v.notes && v.notes.toLowerCase().includes(q));
      const matchType = visitationTypeFilter === 'ALL' || v.visitation_type === visitationTypeFilter;
      const matchStatus = visitationStatusFilter === 'ALL' || v.status === visitationStatusFilter;
      return matchSearch && matchType && matchStatus;
    });
  }, [pastoralVisitations, visitationSearch, visitationTypeFilter, visitationStatusFilter]);

  // Filtered Counseling Sessions
  const filteredCounseling = useMemo(() => {
    const q = (counselingSearch || '').toLowerCase();
    return counselingSessions.filter((c) => {
      const matchSearch =
        !q ||
        (c.member_name || '').toLowerCase().includes(q) ||
        (c.counselor_name || '').toLowerCase().includes(q) ||
        (c.key_discussion || '').toLowerCase().includes(q);
      const matchType = counselingTypeFilter === 'ALL' || c.session_type === counselingTypeFilter;
      return matchSearch && matchType;
    });
  }, [counselingSessions, counselingSearch, counselingTypeFilter]);

  // Filtered Prayer Petitions
  const filteredPrayers = useMemo(() => {
    const q = (prayerSearch || '').toLowerCase();
    return prayerRequests.filter((p) => {
      const matchSearch =
        !q ||
        (p.requester_name || '').toLowerCase().includes(q) ||
        (p.request || '').toLowerCase().includes(q) ||
        (p.testimony && p.testimony.toLowerCase().includes(q));
      const matchCategory = prayerCategoryFilter === 'ALL' || p.category === prayerCategoryFilter;
      const matchStatus = prayerStatusFilter === 'ALL' || p.status === prayerStatusFilter;
      return matchSearch && matchCategory && matchStatus;
    });
  }, [prayerRequests, prayerSearch, prayerCategoryFilter, prayerStatusFilter]);

  // Radar Metrics & Urgent Watchlist
  const urgentVisitations = useMemo(() => {
    return pastoralVisitations.filter(
      (v) =>
        v.status === 'urgent_followup' ||
        v.spiritual_condition === 'critical' ||
        v.visitation_type === 'hospital_visit' ||
        v.visitation_type === 'bereavement'
    );
  }, [pastoralVisitations]);

  const ongoingCounseling = useMemo(() => {
    return counselingSessions.filter((c) => c.status === 'in_progress' || c.status === 'scheduled');
  }, [counselingSessions]);

  const answeredPrayersCount = useMemo(() => {
    return prayerRequests.filter((p) => p.status === 'answered').length;
  }, [prayerRequests]);

  const prayingPrayersCount = useMemo(() => {
    return prayerRequests.filter((p) => p.status === 'praying' || p.status === 'new').length;
  }, [prayerRequests]);

  // Handlers
  const handleOpenAddVisitation = () => {
    setEditingVisitation(null);
    setIsLogVisitationOpen(true);
  };

  const handleOpenEditVisitation = (v: PastoralVisitationRecord) => {
    setEditingVisitation(v);
    setIsLogVisitationOpen(true);
  };

  const handleSaveVisitation = (recordData: Omit<PastoralVisitationRecord, 'id' | 'created_at'>) => {
    if (editingVisitation) {
      updatePastoralVisitation(editingVisitation.id, recordData);
      success('Visitation Updated', `Record for ${recordData.member_name} updated successfully.`);
    } else {
      addPastoralVisitation(recordData);
      success('Visitation Logged', `Pastoral visit with ${recordData.member_name} saved.`);
    }
  };

  const handleDeleteVisitation = (id: string, name: string) => {
    if (confirm(`Remove pastoral visitation log for ${name}?`)) {
      deletePastoralVisitation(id);
      info('Record Removed', 'Visitation log deleted.');
    }
  };

  const handleOpenAddCounseling = () => {
    setEditingCounseling(null);
    setIsScheduleCounselingOpen(true);
  };

  const handleOpenEditCounseling = (session: PastoralCounselingSession) => {
    setEditingCounseling(session);
    setIsScheduleCounselingOpen(true);
  };

  const handleSaveCounseling = (sessionData: Omit<PastoralCounselingSession, 'id' | 'created_at'>) => {
    if (editingCounseling) {
      updateCounselingSession(editingCounseling.id, sessionData);
      success('Counseling Updated', `Session #${sessionData.session_number} updated.`);
    } else {
      addCounselingSession(sessionData);
      success('Counseling Recorded', `Counseling with ${sessionData.member_name} logged.`);
    }
  };

  const handleDeleteCounseling = (id: string, name: string) => {
    if (confirm(`Delete counseling record for ${name}?`)) {
      deleteCounselingSession(id);
      info('Record Deleted', 'Counseling session removed.');
    }
  };

  const handleNewPrayerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prayerForm.requester_name.trim() || !prayerForm.request.trim()) return;

    addPrayerRequest({
      requester_name: prayerForm.requester_name.trim(),
      requester_phone: prayerForm.requester_phone.trim() || undefined,
      member_id: prayerForm.member_id || undefined,
      category: prayerForm.category,
      request: prayerForm.request.trim(),
      status: 'new',
      date_submitted: new Date().toISOString().split('T')[0],
      is_confidential: prayerForm.is_confidential,
      assigned_leader: defaultPastorName,
    });

    setIsPrayerModalOpen(false);
    setPrayerForm({
      requester_name: '',
      requester_phone: '',
      member_id: '',
      category: 'Healing & Deliverance',
      request: '',
      is_confidential: false,
    });
    success('Prayer Petition Added', 'Petition has been placed on the pastoral intercessory altar.');
  };

  const handleConfirmAnsweredPrayer = (prayerId: string, testimony: string) => {
    updatePrayerStatus(prayerId, 'answered', testimony);
    success('Praise Report Logged', 'God has answered! Praise report has been recorded.');
  };

  const sendWhatsAppPastoralBlessing = (phone?: string, name?: string) => {
    if (!phone) {
      warning('No Phone Number', 'This member does not have a primary contact phone number.');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.startsWith('0') ? `233${cleanPhone.substring(1)}` : cleanPhone;
    const msg = `Shalom Beloved ${name || ''},\n\nProphet Elisha K. Richard and the pastoral council of Greater Works City Church (GWCC) are covering you and your family in intercessory prayer this week.\n\n"The Lord bless thee, and keep thee: The Lord make his face shine upon thee, and be gracious unto thee!" (Numbers 6:24-25)\n\nLet us know how we can continue to stand with you. Blessings!`;
    window.open(`https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <HeartHandshake className="w-7 h-7 text-emerald-800" />
            <span>Pastoral Care & Shepherding Ecosystem</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Ministerial visitations, confidential counseling, intercessory altar, and flock shepherding for {settings.church_name}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={() => setIsPrintReportOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
            title="Generate and print official pastoral shepherding dossier for council meetings"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Print Shepherding Report</span>
          </button>

          <button
            onClick={handleOpenAddVisitation}
            className="px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-950 text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
            title="Log home, hospital, bereavement, or newborn pastoral visitation"
          >
            <MapPin className="w-4 h-4 text-emerald-700" />
            <span>Log Visitation</span>
          </button>

          <button
            onClick={handleOpenAddCounseling}
            className="px-3.5 py-2 rounded-xl border border-teal-300 bg-teal-50 hover:bg-teal-100/80 text-teal-950 text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
            title="Record spiritual, marital, or deliverance counseling session"
          >
            <Lock className="w-4 h-4 text-teal-700" />
            <span>Schedule Counseling</span>
          </button>

          <button
            onClick={() => setIsPrayerModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-emerald-800/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Prayer Petition</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2 sm:gap-6 text-xs sm:text-sm font-semibold overflow-x-auto pb-0.5">
        <button
          onClick={() => setActiveTab('visitations')}
          className={`pb-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'visitations'
              ? 'border-emerald-800 text-emerald-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MapPin className="w-4 h-4 text-emerald-700" />
          <span>Home & Hospital Visitations</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900">
            {pastoralVisitations.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('counseling')}
          className={`pb-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'counseling'
              ? 'border-emerald-800 text-emerald-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Lock className="w-4 h-4 text-teal-700" />
          <span>Pastoral Counseling</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-teal-100 text-teal-900">
            {counselingSessions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('prayers')}
          className={`pb-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'prayers'
              ? 'border-emerald-800 text-emerald-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Heart className="w-4 h-4 text-rose-600" />
          <span>Prayer Requests & Praises</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900">
            {prayerRequests.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('intercession')}
          className={`pb-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'intercession'
              ? 'border-emerald-800 text-emerald-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Flame className="w-4 h-4 text-amber-600" />
          <span>Altar Prayer Watches</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
            {intercessorySlots.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('radar')}
          className={`pb-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'radar'
              ? 'border-emerald-800 text-emerald-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Radio className="w-4 h-4 text-indigo-600" />
          <span>Shepherding Crisis Radar</span>
          {urgentVisitations.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-rose-600 text-white animate-pulse">
              {urgentVisitations.length} Action
            </span>
          )}
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: HOME & HOSPITAL VISITATIONS REGISTER              */}
      {/* ======================================================== */}
      {activeTab === 'visitations' && (
        <div className="space-y-4">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Visitations</span>
              <span className="text-xl font-black text-slate-900">{pastoralVisitations.length}</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Recorded home & hospital visits</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Hospital & Sick Visits</span>
              <span className="text-xl font-black text-emerald-950">
                {pastoralVisitations.filter((v) => v.visitation_type === 'hospital_visit').length}
              </span>
              <span className="text-[10px] text-emerald-800 block mt-0.5">Anointed with prayer</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-teal-50/60 border border-teal-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-teal-700 block">Home Altars Dedicated</span>
              <span className="text-xl font-black text-teal-950">
                {pastoralVisitations.filter((v) => v.visitation_type === 'home_visit').length}
              </span>
              <span className="text-[10px] text-teal-800 block mt-0.5">Family communion visits</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-amber-700 block">Urgent Follow-Ups</span>
              <span className="text-xl font-black text-amber-950">
                {pastoralVisitations.filter((v) => v.status === 'urgent_followup').length}
              </span>
              <span className="text-[10px] text-amber-800 block mt-0.5">Scheduled pastoral visits</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-2.5 items-center justify-between text-xs">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search member, ward, address, or pastor..."
                value={visitationSearch}
                onChange={(e) => setVisitationSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-600 bg-slate-50 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              <select
                value={visitationTypeFilter}
                onChange={(e) => setVisitationTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-700 text-xs"
              >
                <option value="ALL">All Categories ({pastoralVisitations.length})</option>
                <option value="home_visit">Home Visit</option>
                <option value="hospital_visit">Hospital Visit</option>
                <option value="bereavement">Bereavement & Condolence</option>
                <option value="new_born">New Child Blessing</option>
                <option value="elderly_care">Elderly & Shut-in</option>
                <option value="crisis_outreach">Crisis Outreach</option>
              </select>

              <select
                value={visitationStatusFilter}
                onChange={(e) => setVisitationStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-700 text-xs"
              >
                <option value="ALL">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="scheduled">Scheduled</option>
                <option value="urgent_followup">Urgent Follow-Up</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Visitations Grid Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredVisitations.map((v) => (
              <div
                key={v.id}
                className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-md transition flex flex-col justify-between space-y-3.5 group"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm tracking-tight">{v.member_name}</h3>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800">
                          {v.visitation_type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 font-medium">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{v.location}</span>
                      </p>
                    </div>

                    <span
                      className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                        v.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : v.status === 'urgent_followup'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200 animate-pulse'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {v.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Date, Time & Lead Pastor */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="flex items-center gap-1 font-semibold text-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {v.date} ({v.time})
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="flex items-center gap-1 text-slate-700">
                      <User className="w-3.5 h-3.5 text-emerald-700" />
                      <strong className="text-slate-800">{v.pastor_in_charge}</strong>
                    </span>
                  </div>

                  {/* Accompanying Ministers Delegation Chips */}
                  {v.visitation_team && v.visitation_team.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 text-[11px]">
                      <span className="text-slate-400 font-semibold mr-1">Delegation:</span>
                      {v.visitation_team.map((minister, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[10px]"
                        >
                          {minister}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Spiritual Condition Badge & Scripture */}
                  {v.spiritual_condition && (
                    <div className="p-2 rounded-xl bg-emerald-50/50 border border-emerald-100 text-xs flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-950 capitalize flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        Status: {v.spiritual_condition.replace('_', ' ')}
                      </span>
                      {v.scripture_shared && (
                        <span className="text-[10px] text-emerald-800 font-semibold italic truncate max-w-[200px]">
                          {v.scripture_shared}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Pastoral Notes & Decrees */}
                  <p className="text-xs text-slate-700 leading-relaxed italic bg-slate-50/40 p-2.5 rounded-xl border border-slate-100">
                    &ldquo;{v.notes}&rdquo;
                  </p>

                  {v.prayer_points && (
                    <div className="text-[11px] text-slate-600">
                      <strong className="text-slate-700">Prayer Points:</strong> {v.prayer_points}
                    </div>
                  )}

                  {v.follow_up_date && (
                    <div className="text-[11px] text-amber-800 font-semibold flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                      <Clock className="w-3 h-3 text-amber-600" />
                      <span>Next Pastoral Follow-Up Due: {v.follow_up_date}</span>
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    {v.member_phone && (
                      <button
                        onClick={() => sendWhatsAppPastoralBlessing(v.member_phone, v.member_name)}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg font-bold text-[11px] border border-emerald-200 flex items-center gap-1 transition cursor-pointer"
                        title="Send encouraging scripture on WhatsApp"
                      >
                        <MessageCircle className="w-3 h-3 text-emerald-600" />
                        <span>WhatsApp Blessing</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditVisitation(v)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                      title="Edit record"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteVisitation(v.id, v.member_name)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title="Delete record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredVisitations.length === 0 && (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
              <MapPin className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700 text-sm">No Pastoral Visitations Found</p>
              <p className="text-xs text-slate-400">Log a new home or hospital visitation to begin tracking.</p>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: PASTORAL COUNSELING & SPIRITUAL OVERSIGHT         */}
      {/* ======================================================== */}
      {activeTab === 'counseling' && (
        <div className="space-y-4">
          {/* Confidentiality Lock Banner */}
          <div className="p-4 rounded-2xl bg-linear-to-r from-teal-900 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-xs border border-white/20">
                <ShieldCheck className="w-5 h-5 text-teal-300" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Privileged Ministerial Counseling Register</h3>
                <p className="text-[11px] text-teal-200">
                  Protected under spiritual confidentiality by Senior Pastor Prophet Elisha K. Richard
                </p>
              </div>
            </div>

            <button
              onClick={() => setCounselingConfidentialUnlocked(!counselingConfidentialUnlocked)}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer"
            >
              {counselingConfidentialUnlocked ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-amber-300" />
                  <span>Mask Confidential Details</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Reveal Confidential Notes</span>
                </>
              )}
            </button>
          </div>

          {/* Search & Category Filter */}
          <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-2.5 items-center justify-between text-xs">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search counselee or counselor name..."
                value={counselingSearch}
                onChange={(e) => setCounselingSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-600 bg-slate-50 text-xs"
              />
            </div>

            <select
              value={counselingTypeFilter}
              onChange={(e) => setCounselingTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-700 text-xs w-full sm:w-auto"
            >
              <option value="ALL">All Categories ({counselingSessions.length})</option>
              <option value="pre_marital">Pre-Marital (Courtship)</option>
              <option value="marital">Marriage & Family</option>
              <option value="spiritual_deliverance">Spiritual Deliverance</option>
              <option value="bereavement_grief">Bereavement & Grief</option>
              <option value="financial_vocational">Career & Business</option>
              <option value="youth_guidance">Youth & Academic</option>
              <option value="confidential_pastoral">Pastoral Privilege</option>
            </select>
          </div>

          {/* Counseling Sessions List */}
          <div className="space-y-3">
            {filteredCounseling.map((session) => (
              <div
                key={session.id}
                className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-md transition space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-bold text-slate-900 text-sm">{session.member_name}</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-100 text-teal-900 capitalize">
                      {session.session_type.replace('_', ' ')}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-700">
                      Session #{session.session_number}
                    </span>
                    {session.is_confidential && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> Confidential
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                        session.status === 'concluded'
                          ? 'bg-emerald-100 text-emerald-800'
                          : session.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {session.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">{session.date}</span>
                  </div>
                </div>

                {/* Counselor Info */}
                <div className="text-xs text-slate-600 flex items-center gap-2">
                  <span className="text-slate-400">Counselor:</span>
                  <span className="font-bold text-slate-800">{session.counselor_name}</span>
                </div>

                {/* Discussion Notes (masked if confidential and not unlocked) */}
                <div className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <strong className="block text-slate-800 mb-1">Key Discussion & Guidance:</strong>
                  {session.is_confidential && !counselingConfidentialUnlocked ? (
                    <span className="text-slate-400 italic">
                      [Confidential discussion notes protected by pastoral privilege. Click &ldquo;Reveal Confidential Notes&rdquo; above to view.]
                    </span>
                  ) : (
                    <p>{session.key_discussion}</p>
                  )}
                </div>

                {/* Action Plan */}
                {session.action_plan && (
                  <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 space-y-0.5">
                    <span className="font-bold flex items-center gap-1 text-[11px]">
                      <BookOpen className="w-3.5 h-3.5 text-emerald-700" /> Counselee Spiritual Action Plan:
                    </span>
                    <p className="text-[11px]">{session.action_plan}</p>
                  </div>
                )}

                {/* Footer Next Session & Controls */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    {session.next_session_date ? (
                      <span className="text-[11px] font-semibold text-teal-800 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Next Scheduled Appointment: <strong>{session.next_session_date}</strong>
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">No further sessions scheduled</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditCounseling(session)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                      title="Edit counseling record"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCounseling(session.id, session.member_name)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title="Delete counseling record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredCounseling.length === 0 && (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
              <Lock className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700 text-sm">No Counseling Sessions Found</p>
              <p className="text-xs text-slate-400">Click &ldquo;Schedule Counseling&rdquo; to log a new appointment.</p>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: PRAYER REQUESTS & ANSWERED PRAISE REPORTS WALL   */}
      {/* ======================================================== */}
      {activeTab === 'prayers' && (
        <div className="space-y-4">
          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Petitions</span>
              <span className="text-xl font-black text-slate-900">{prayerRequests.length}</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Brought before God</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-blue-700 block">Active Intercession</span>
              <span className="text-xl font-black text-blue-950">{prayingPrayersCount}</span>
              <span className="text-[10px] text-blue-800 block mt-0.5">On the prayer altar</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Answered Testimonies</span>
              <span className="text-xl font-black text-emerald-950">{answeredPrayersCount}</span>
              <span className="text-[10px] text-emerald-800 block mt-0.5">To the glory of God</span>
            </div>
          </div>

          {/* Search & Category Filter */}
          <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-2.5 items-center justify-between text-xs">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search requester, petition, or praise report..."
                value={prayerSearch}
                onChange={(e) => setPrayerSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-600 bg-slate-50 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              <select
                value={prayerStatusFilter}
                onChange={(e) => setPrayerStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-700 text-xs"
              >
                <option value="ALL">All Statuses</option>
                <option value="new">New Petitions</option>
                <option value="praying">Interceding / Praying</option>
                <option value="answered">Answered (Praise Reports)</option>
              </select>

              <select
                value={prayerCategoryFilter}
                onChange={(e) => setPrayerCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-700 text-xs"
              >
                <option value="ALL">All Categories</option>
                <option value="Healing & Deliverance">Healing & Deliverance</option>
                <option value="Healing & Health">Healing & Health</option>
                <option value="Business & Finance">Business & Finance</option>
                <option value="Financial & Business Breakthrough">Financial Breakthrough</option>
                <option value="Family & Marital Peace">Family & Marital</option>
                <option value="Fruit of the Womb (Childbearing)">Fruit of the Womb</option>
                <option value="Academic & Career Favor">Academic & Career</option>
                <option value="Spiritual Growth & Ministry">Spiritual Growth</option>
              </select>
            </div>
          </div>

          {/* Prayer Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPrayers.map((req) => (
              <div
                key={req.id}
                className={`p-5 rounded-2xl border transition shadow-2xs flex flex-col justify-between space-y-3 ${
                  req.status === 'answered'
                    ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-500/10'
                    : req.is_confidential
                    ? 'bg-amber-50/25 border-amber-200'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm">{req.requester_name}</h3>
                        {req.is_confidential && (
                          <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> Confidential
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-slate-500">{req.category}</span>
                    </div>

                    <span
                      className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                        req.status === 'answered'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : req.status === 'praying'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed italic bg-white/70 p-2.5 rounded-xl border border-slate-100">
                    &ldquo;{req.request}&rdquo;
                  </p>

                  {/* Answered Praise Report Banner */}
                  {req.testimony && (
                    <div className="p-3 bg-emerald-100/70 rounded-xl border border-emerald-300 text-xs text-emerald-950 space-y-1">
                      <span className="font-bold flex items-center gap-1.5 text-emerald-900">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-700" /> Praise Report & Answered Testimony:
                      </span>
                      <p className="italic text-[11px] leading-relaxed">{req.testimony}</p>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[11px]">
                    Leader: <strong>{req.assigned_leader || 'Prophet Elisha K. Richard'}</strong>
                  </span>

                  <div className="flex items-center gap-1.5">
                    {req.status !== 'answered' && (
                      <button
                        onClick={() => setAnsweredPrayerTarget(req)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 transition shadow-2xs cursor-pointer"
                        title="Record praise report testimony and mark answered"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark Answered
                      </button>
                    )}

                    {req.status === 'new' && (
                      <button
                        onClick={() => updatePrayerStatus(req.id, 'praying')}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg font-semibold text-xs border border-blue-200 cursor-pointer"
                      >
                        Start Praying
                      </button>
                    )}

                    <button
                      onClick={() => {
                        if (confirm(`Delete prayer petition from ${req.requester_name}?`)) {
                          deletePrayerRequest(req.id);
                        }
                      }}
                      className="p-1 text-slate-300 hover:text-rose-600 transition"
                      title="Remove petition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredPrayers.length === 0 && (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
              <Heart className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700 text-sm">No Prayer Requests Found</p>
              <p className="text-xs text-slate-400">Click &ldquo;Add Prayer Petition&rdquo; to place a request on the altar.</p>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: ALTAR INTERCESSORY PRAYER WATCH & VIGILS         */}
      {/* ======================================================== */}
      {activeTab === 'intercession' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-linear-to-r from-amber-950 via-slate-900 to-emerald-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center backdrop-blur-xs border border-amber-400/30">
                <Flame className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Altar of Perpetual Fire (Leviticus 6:13)</h3>
                <p className="text-[11px] text-amber-200">
                  Continuous 24-Hour Spiritual Warfare & Territorial Intercession for Greater Works City Church
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-lg text-xs font-bold border border-amber-500/30 self-start sm:self-auto">
              Fire on the Altar Shall Never Go Out
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {intercessorySlots.map((slot) => (
              <div
                key={slot.id}
                className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-md transition space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {slot.day_of_week} Watch
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm mt-1">{slot.watch_name}</h3>
                  </div>

                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Active Altar
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-bold text-slate-800">{slot.intercessor_name}</span>
                    {slot.intercessor_phone && (
                      <span className="text-[10px] text-slate-500">({slot.intercessor_phone})</span>
                    )}
                  </div>
                </div>

                <div className="text-xs space-y-1">
                  <div className="text-emerald-900 font-semibold italic text-[11px]">
                    {slot.focus_scripture}
                  </div>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    <strong>Mandate:</strong> {slot.prayer_focus}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[10px]">Ministry: Voice of Altar Intercessors</span>
                  {slot.intercessor_phone && (
                    <button
                      onClick={() => sendWhatsAppPastoralBlessing(slot.intercessor_phone, slot.intercessor_name)}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-[11px] font-bold border border-emerald-200 flex items-center gap-1 transition"
                    >
                      <MessageCircle className="w-3 h-3 text-emerald-600" />
                      <span>Contact Warrior</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: SHEPHERDING & CRISIS RADAR (FLOCK VULNERABILITY) */}
      {/* ======================================================== */}
      {activeTab === 'radar' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs leading-relaxed">
              <h3 className="font-bold text-rose-900 text-sm">Pastoral Shepherding & Critical Watchlist</h3>
              <p className="text-[11px] text-rose-800">
                This radar automatically aggregates members in critical health conditions, recently bereaved households, newborns, and members flagged for immediate pastoral visitation by Prophet Elisha K. Richard and the Pastoral Council.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Immediate Shepherding Attention Queue ({urgentVisitations.length} Active Records)
              </h3>
              <span className="text-xs font-semibold text-slate-500">
                Updated in real-time
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {urgentVisitations.map((item) => (
                <div key={item.id} className="p-4 hover:bg-slate-50/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{item.member_name}</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-rose-100 text-rose-900">
                        {item.visitation_type.replace('_', ' ')}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-900">
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>

                    <p className="text-slate-600 flex items-center gap-1 text-[11px]">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{item.location}</span>
                      <span className="text-slate-300">•</span>
                      <span>Lead Pastor: <strong>{item.pastor_in_charge}</strong></span>
                    </p>

                    <p className="text-slate-500 italic text-[11px]">
                      &ldquo;{item.notes}&rdquo;
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {item.member_phone && (
                      <button
                        onClick={() => sendWhatsAppPastoralBlessing(item.member_phone, item.member_name)}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-bold text-xs border border-emerald-200 flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>WhatsApp Blessing</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenEditVisitation(item)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition cursor-pointer"
                    >
                      Update Care Log
                    </button>
                  </div>
                </div>
              ))}

              {urgentVisitations.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No urgent pastoral crises flagged at this moment. The flock is well-shepherded!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODALS RENDERED HERE                                     */}
      {/* ======================================================== */}

      {/* 1. Log Visitation Modal */}
      <LogVisitationModal
        isOpen={isLogVisitationOpen}
        onClose={() => setIsLogVisitationOpen(false)}
        onSave={handleSaveVisitation}
        members={members}
        settings={settings}
        editingVisitation={editingVisitation}
      />

      {/* 2. Schedule Counseling Modal */}
      <ScheduleCounselingModal
        isOpen={isScheduleCounselingOpen}
        onClose={() => setIsScheduleCounselingOpen(false)}
        onSave={handleSaveCounseling}
        members={members}
        settings={settings}
        editingSession={editingCounseling}
      />

      {/* 3. Answered Prayer Testimony Modal */}
      <AnsweredPrayerModal
        isOpen={Boolean(answeredPrayerTarget)}
        onClose={() => setAnsweredPrayerTarget(null)}
        prayer={answeredPrayerTarget}
        onConfirm={handleConfirmAnsweredPrayer}
        settings={settings}
      />

      {/* 4. Print Pastoral Shepherding Report Modal */}
      <PrintPastoralReportModal
        isOpen={isPrintReportOpen}
        onClose={() => setIsPrintReportOpen(false)}
        visitations={pastoralVisitations}
        counselingSessions={counselingSessions}
        prayerRequests={prayerRequests}
        settings={settings}
      />

      {/* 5. Add Prayer Request Modal */}
      {isPrayerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-emerald-900 text-white flex items-center justify-between">
              <h3 className="text-base font-bold">New Prayer Request & Petition</h3>
              <button onClick={() => setIsPrayerModalOpen(false)} className="p-1 text-white/80 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleNewPrayerSubmit} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Requester Name *</label>
                <input
                  type="text"
                  required
                  value={prayerForm.requester_name}
                  onChange={(e) => setPrayerForm({ ...prayerForm, requester_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  placeholder="e.g. Sister Beatrice Mensah"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Requester Phone (Optional)</label>
                <input
                  type="text"
                  value={prayerForm.requester_phone}
                  onChange={(e) => setPrayerForm({ ...prayerForm, requester_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  placeholder="+233 24 000 0000"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={prayerForm.category}
                  onChange={(e) => setPrayerForm({ ...prayerForm, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="Healing & Deliverance">Healing & Deliverance</option>
                  <option value="Financial & Business Breakthrough">Financial & Business Breakthrough</option>
                  <option value="Family & Marital Peace">Family & Marital Peace</option>
                  <option value="Fruit of the Womb (Childbearing)">Fruit of the Womb</option>
                  <option value="Academic & Career Favor">Academic & Career Favor</option>
                  <option value="Spiritual Growth & Ministry">Spiritual Growth</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Specific Prayer Need *</label>
                <textarea
                  rows={3}
                  required
                  value={prayerForm.request}
                  onChange={(e) => setPrayerForm({ ...prayerForm, request: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  placeholder="Describe the petition for the intercessory altar..."
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="conf"
                  checked={prayerForm.is_confidential}
                  onChange={(e) => setPrayerForm({ ...prayerForm, is_confidential: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="conf" className="font-semibold text-slate-700 cursor-pointer">
                  Confidential (Pastoral team only)
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrayerModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Heart className="w-4 h-4" />
                  <span>Submit to Altar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
