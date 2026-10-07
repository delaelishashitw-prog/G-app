import React, { useState } from 'react';
import {
  X,
  Lock,
  Calendar,
  User,
  Heart,
  Save,
  ShieldCheck,
  BookOpen,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import {
  PastoralCounselingSession,
  CounselingSessionType,
  Member,
  ChurchSettings,
} from '../../types/database.types';

interface ScheduleCounselingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (session: Omit<PastoralCounselingSession, 'id' | 'created_at'>) => void;
  members: Member[];
  settings: ChurchSettings;
  editingSession?: PastoralCounselingSession | null;
}

const COUNSELING_TYPES: { type: CounselingSessionType; label: string; icon: string }[] = [
  { type: 'pre_marital', label: 'Pre-Marital Counseling (Courtship)', icon: '💍' },
  { type: 'marital', label: 'Marriage & Family Reconciliation', icon: '🏡' },
  { type: 'spiritual_deliverance', label: 'Spiritual Warfare & Deliverance', icon: '⚔️' },
  { type: 'bereavement_grief', label: 'Bereavement & Grief Healing', icon: '🕊️' },
  { type: 'financial_vocational', label: 'Career, Business & Stewardship', icon: '💼' },
  { type: 'youth_guidance', label: 'Youth & Academic Guidance', icon: '🎓' },
  { type: 'confidential_pastoral', label: 'Confidential Pastoral Ministry', icon: '🔒' },
];

export const ScheduleCounselingModal: React.FC<ScheduleCounselingModalProps> = ({
  isOpen,
  onClose,
  onSave,
  members,
  settings,
  editingSession,
}) => {
  const defaultCounselor = settings.senior_pastor || 'Prophet Elisha K. Richard';

  const [memberId, setMemberId] = useState(editingSession?.member_id || members[0]?.id || '');
  const [sessionType, setSessionType] = useState<CounselingSessionType>(
    editingSession?.session_type || 'spiritual_deliverance'
  );
  const [counselorName, setCounselorName] = useState(
    editingSession?.counselor_name || defaultCounselor
  );
  const [date, setDate] = useState(
    editingSession?.date || new Date().toISOString().split('T')[0]
  );
  const [sessionNumber, setSessionNumber] = useState(editingSession?.session_number || 1);
  const [status, setStatus] = useState<'scheduled' | 'in_progress' | 'concluded' | 'referred'>(
    editingSession?.status || 'in_progress'
  );
  const [keyDiscussion, setKeyDiscussion] = useState(
    editingSession?.key_discussion || ''
  );
  const [actionPlan, setActionPlan] = useState(
    editingSession?.action_plan || ''
  );
  const [nextSessionDate, setNextSessionDate] = useState(
    editingSession?.next_session_date || ''
  );
  const [isConfidential, setIsConfidential] = useState(
    editingSession?.is_confidential !== undefined ? editingSession.is_confidential : true
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mem = members.find((m) => m.id === memberId);
    const memberName = mem ? `${mem.first_name} ${mem.last_name}` : 'Church Member';
    const memberPhone = mem?.phone || undefined;

    onSave({
      member_id: memberId,
      member_name: memberName,
      member_phone: memberPhone,
      counselor_name: counselorName,
      session_type: sessionType,
      date,
      session_number: Number(sessionNumber) || 1,
      status,
      key_discussion: keyDiscussion || 'Pastoral counseling conducted under the guidance of the Holy Spirit.',
      action_plan: actionPlan || undefined,
      next_session_date: nextSessionDate || undefined,
      is_confidential: isConfidential,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-linear-to-r from-emerald-950 via-teal-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-xs border border-white/20">
              <Lock className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {editingSession ? 'Edit Pastoral Counseling Session' : 'Record Pastoral Counseling Session'}
              </h2>
              <p className="text-[11px] text-emerald-200">
                Greater Works City Church • Pastoral Oversight & Spiritual Guidance
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
          {/* Confidential Notice */}
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-bold">Ministerial Confidentiality Protocol:</span> Counseling records are protected under pastoral privilege and accessible exclusively to Prophet Elisha K. Richard and authorized counseling pastors.
            </div>
          </div>

          {/* Member & Counselor Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Select Member (Counselee) <span className="text-rose-500">*</span>
              </label>
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
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
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-500" /> Lead Counselor / Pastor
              </label>
              <input
                type="text"
                value={counselorName}
                onChange={(e) => setCounselorName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
                required
              />
            </div>
          </div>

          {/* Session Type & Session Number */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                Counseling Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value as CounselingSessionType)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-emerald-500 outline-hidden"
              >
                {COUNSELING_TYPES.map((ct) => (
                  <option key={ct.type} value={ct.type}>
                    {ct.icon} {ct.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Session Number
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={sessionNumber}
                onChange={(e) => setSessionNumber(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden font-bold"
              />
            </div>
          </div>

          {/* Date, Status & Next Appointment */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" /> Date of Session
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
              <label className="block font-bold text-slate-700 mb-1">
                Session Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-emerald-500 outline-hidden"
              >
                <option value="in_progress">In Progress (Ongoing)</option>
                <option value="scheduled">Scheduled (Upcoming)</option>
                <option value="concluded">Concluded (Resolved)</option>
                <option value="referred">Referred to Specialist / General Overseer</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Next Session (Optional)
              </label>
              <input
                type="date"
                value={nextSessionDate}
                onChange={(e) => setNextSessionDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden"
              />
            </div>
          </div>

          {/* Discussion Notes */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Key Discussion Points & Pastoral Guidance
            </label>
            <textarea
              rows={3}
              value={keyDiscussion}
              onChange={(e) => setKeyDiscussion(e.target.value)}
              placeholder="Outline spiritual issues addressed, scriptural counseling provided, prayers made..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden text-xs"
              required
            ></textarea>
          </div>

          {/* Action Plan & Homework */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-teal-600" /> Action Plan & Spiritual Assignment for Counselee
            </label>
            <textarea
              rows={2}
              value={actionPlan}
              onChange={(e) => setActionPlan(e.target.value)}
              placeholder="e.g. Read 1 Corinthians 13 daily, complete fast on Wednesday, attend Friday All-Night, write joint apology letter..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500 outline-hidden text-xs"
            ></textarea>
          </div>

          {/* Confidentiality Checkbox */}
          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <input
              type="checkbox"
              id="confidentialCheck"
              checked={isConfidential}
              onChange={(e) => setIsConfidential(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-500"
            />
            <label htmlFor="confidentialCheck" className="text-xs font-semibold text-slate-800 cursor-pointer">
              Mark this counseling record as <span className="text-rose-600 font-bold">Strictly Confidential</span> (hidden from non-pastoral users)
            </label>
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
              <span>{editingSession ? 'Update Session Log' : 'Save Counseling Session'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
