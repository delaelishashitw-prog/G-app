import React, { useState } from 'react';
import {
  X,
  MapPin,
  Calendar,
  Clock,
  User,
  Users,
  BookOpen,
  Heart,
  Save,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import {
  PastoralVisitationRecord,
  PastoralVisitationType,
  PastoralVisitationStatus,
  Member,
  ChurchSettings,
} from '../../types/database.types';

interface LogVisitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: Omit<PastoralVisitationRecord, 'id' | 'created_at'>) => void;
  members: Member[];
  settings: ChurchSettings;
  editingVisitation?: PastoralVisitationRecord | null;
}

const VISITATION_TYPES: { type: PastoralVisitationType; label: string; icon: string; description: string }[] = [
  { type: 'home_visit', label: 'Home Visitation', icon: '🏡', description: 'Pastoral family visit & house dedication' },
  { type: 'hospital_visit', label: 'Hospital Visitation', icon: '🏥', description: 'Visiting the sick in hospital or clinic' },
  { type: 'bereavement', label: 'Bereavement & Condolence', icon: '🕊️', description: 'Comforting families grieving a loss' },
  { type: 'new_born', label: 'New Child Blessing', icon: '👶', description: 'Praying for newborn & nursing mother' },
  { type: 'elderly_care', label: 'Elderly & Shut-in Care', icon: '👵', description: 'Communion & prayer for homebound saints' },
  { type: 'crisis_outreach', label: 'Crisis & Urgent Care', icon: '🚨', description: 'Immediate emergency spiritual intervention' },
];

const AVAILABLE_MINISTERS = [
  'Prophet Elisha K. Richard (Senior Pastor)',
  'Pastor Emmanuel Osei (Associate Pastor)',
  'Mama Serwaa (Women Fellowship Leader)',
  'Elder Kwesi Boateng (Presiding Elder)',
  'Deaconess Faustina Mensah (Welfare & Intercession)',
  'Minister Isaac Donkor (Youth Pastor)',
];

export const LogVisitationModal: React.FC<LogVisitationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  members,
  settings,
  editingVisitation,
}) => {
  const defaultPastor = settings.senior_pastor || 'Prophet Elisha K. Richard';

  const [memberId, setMemberId] = useState(editingVisitation?.member_id || members[0]?.id || '');
  const [visitationType, setVisitationType] = useState<PastoralVisitationType>(
    editingVisitation?.visitation_type || 'home_visit'
  );
  const [date, setDate] = useState(
    editingVisitation?.date || new Date().toISOString().split('T')[0]
  );
  const [time, setTime] = useState(editingVisitation?.time || '15:00');
  const [location, setLocation] = useState(
    editingVisitation?.location || 'Joma New Site Residence'
  );
  const [pastorInCharge, setPastorInCharge] = useState(
    editingVisitation?.pastor_in_charge || defaultPastor
  );
  const [selectedTeam, setSelectedTeam] = useState<string[]>(
    editingVisitation?.visitation_team || [defaultPastor]
  );
  const [status, setStatus] = useState<PastoralVisitationStatus>(
    editingVisitation?.status || 'completed'
  );
  const [spiritualCondition, setSpiritualCondition] = useState<
    'strengthened' | 'healing_received' | 'critical' | 'needs_counseling' | 'peace_comfort'
  >(editingVisitation?.spiritual_condition || 'strengthened');
  const [scriptureShared, setScriptureShared] = useState(
    editingVisitation?.scripture_shared || 'Psalm 91:1-4'
  );
  const [prayerPoints, setPrayerPoints] = useState(
    editingVisitation?.prayer_points || 'Divine protection, healing in the body, and family peace.'
  );
  const [followUpDate, setFollowUpDate] = useState(editingVisitation?.follow_up_date || '');
  const [notes, setNotes] = useState(editingVisitation?.notes || '');

  if (!isOpen) return null;

  const handleMemberChange = (id: string) => {
    setMemberId(id);
    const m = members.find((x) => x.id === id);
    if (m?.residential_address) {
      setLocation(`${m.residential_address} (${m.city || 'Joma'})`);
    }
  };

  const toggleTeamMember = (name: string) => {
    if (selectedTeam.includes(name)) {
      if (selectedTeam.length > 1) {
        setSelectedTeam(selectedTeam.filter((n) => n !== name));
      }
    } else {
      setSelectedTeam([...selectedTeam, name]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mem = members.find((m) => m.id === memberId);
    const memberName = mem ? `${mem.first_name} ${mem.last_name}` : 'Church Member';
    const memberPhone = mem?.phone || undefined;

    onSave({
      member_id: memberId,
      member_name: memberName,
      member_phone: memberPhone,
      visitation_type: visitationType,
      date,
      time,
      location: location || 'Joma Sanctuary / Residence',
      pastor_in_charge: pastorInCharge,
      visitation_team: selectedTeam.length > 0 ? selectedTeam : [pastorInCharge],
      status,
      spiritual_condition: spiritualCondition,
      scripture_shared: scriptureShared || undefined,
      prayer_points: prayerPoints || undefined,
      follow_up_date: followUpDate || undefined,
      notes: notes || 'Pastoral visitation completed in faith and fellowship.',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-linear-to-r from-emerald-900 via-teal-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-xs border border-white/20">
              <MapPin className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {editingVisitation ? 'Edit Pastoral Visitation' : 'Log Home or Hospital Visitation'}
              </h2>
              <p className="text-[11px] text-emerald-200">
                Greater Works City Church • Shepherding the Flock of God
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Visitation Type Selector */}
          <div>
            <label className="block font-bold text-slate-800 mb-1.5">
              Select Visitation Type <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {VISITATION_TYPES.map((vt) => (
                <button
                  key={vt.type}
                  type="button"
                  onClick={() => setVisitationType(vt.type)}
                  className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                    visitationType === vt.type
                      ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 font-bold shadow-2xs ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <span className="text-base">{vt.icon}</span>
                  <span className="text-xs font-bold leading-tight">{vt.label}</span>
                  <span className="text-[10px] text-slate-500 leading-tight">{vt.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Member Selection & Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Target Member / Family <span className="text-rose-500">*</span>
              </label>
              <select
                value={memberId}
                onChange={(e) => handleMemberChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-emerald-500 outline-hidden"
                required
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.first_name} {m.last_name} ({m.status || 'Active'}) - {m.phone}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Visitation Status <span className="text-rose-500">*</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PastoralVisitationStatus)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-emerald-500 outline-hidden"
              >
                <option value="completed">Completed Successfully</option>
                <option value="scheduled">Scheduled (Upcoming)</option>
                <option value="urgent_followup">Urgent Follow-Up Required</option>
                <option value="cancelled">Cancelled / Postponed</option>
              </select>
            </div>
          </div>

          {/* Date, Time & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" /> Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" /> Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-500" /> Specific Location / Ward
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Korle Bu Ward 4, or Joma Residence"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                required
              />
            </div>
          </div>

          {/* Pastor in Charge & Visitation Team */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-500" /> Lead Minister / Pastor in Charge
                </label>
                <input
                  type="text"
                  value={pastorInCharge}
                  onChange={(e) => setPastorInCharge(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Spiritual Condition of Member
                </label>
                <select
                  value={spiritualCondition}
                  onChange={(e) => setSpiritualCondition(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                >
                  <option value="strengthened">Spiritual Strength Renewed (Encouraged)</option>
                  <option value="healing_received">Healing / Breakthrough Received</option>
                  <option value="peace_comfort">Comforted in Grief & Peace Imparted</option>
                  <option value="needs_counseling">Needs Follow-Up Pastoral Counseling</option>
                  <option value="critical">Critical (Requires Continued Daily Prayer)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-slate-500" /> Accompanying Ministers & Elders Delegation:
              </label>
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                {AVAILABLE_MINISTERS.map((minister) => {
                  const isSelected = selectedTeam.includes(minister);
                  return (
                    <button
                      key={minister}
                      type="button"
                      onClick={() => toggleTeamMember(minister)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-700 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {isSelected ? <CheckCircle2 className="w-3 h-3" /> : <User className="w-3 h-3 text-slate-400" />}
                      <span>{minister}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Scripture & Prayer Points */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-teal-600" /> Scripture Read / Imparted
              </label>
              <input
                type="text"
                value={scriptureShared}
                onChange={(e) => setScriptureShared(e.target.value)}
                placeholder="e.g. Isaiah 53:5, Psalm 23"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-600" /> Next Follow-Up Date (Optional)
              </label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Prayer Points Raised & Spiritual Decrees
            </label>
            <input
              type="text"
              value={prayerPoints}
              onChange={(e) => setPrayerPoints(e.target.value)}
              placeholder="e.g. Decreed quick healing, rebuke of death spirit, financial supply..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Minister's Pastoral Summary & Observations
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record details of the family visit, physical health condition, welfare needs, or special observations..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden text-xs"
            ></textarea>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{editingVisitation ? 'Update Visitation Record' : 'Save Visitation Log'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
