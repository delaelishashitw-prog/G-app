import {useModalFocus} from '../../hooks/useModalFocus';
import React, { useState } from 'react';
import {
  X,
  UserCheck,
  AlertCircle,
  MessageCircle,
  Clock,
  Calendar,
  Send,
  HelpCircle,
} from 'lucide-react';
import { RosterAssignment, ChurchSettings } from '../../types/database.types';

interface RequestSubstituteModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: RosterAssignment | null;
  onConfirmSubstitute: (assignmentId: string, reason: string, note: string, suggestion: string, requestId: string) => Promise<void>;
  settings: ChurchSettings;
}

const REASONS = [
  'Work Commitment / Official Duty',
  'Illness / Medical Appointment',
  'Travel / Out of Town',
  'Family Emergency / Bereavement',
  'Academic Exams / School Schedule',
  'Other Personal Commitment',
];

export const RequestSubstituteModal: React.FC<RequestSubstituteModalProps> = ({
  isOpen,
  onClose,
  assignment,
  onConfirmSubstitute,
  settings,
}) => {
  const [selectedReason, setSelectedReason] = useState(REASONS[0]);
  const [note, setNote] = useState('');
  const [suggestedReplacement, setSuggestedReplacement] = useState('');

  const [requestId,setRequestId]=useState(()=>crypto.randomUUID());
  const [isSubmitting,setIsSubmitting]=useState(false);
  const [saveError,setSaveError]=useState('');
  const close=()=>{if(!isSubmitting)onClose();};
  const panel=useModalFocus(isOpen,close);
  const changed=()=>{setRequestId(crypto.randomUUID());setSaveError('');};
  if (!isOpen || !assignment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();if(isSubmitting)return;
    setIsSubmitting(true);setSaveError('');
    try {
      await onConfirmSubstitute(assignment.id,selectedReason,note.trim(),suggestedReplacement.trim(),requestId);
      onClose();
    } catch(error) {setSaveError((error as Error).message||'The request was not confirmed. Try again.');}
    finally {setIsSubmitting(false);}
  };

  const whatsAppText = `Shalom Leader, I am writing regarding my service roster assignment for *${assignment.service_name}* on *${assignment.date}* (${assignment.department.replace('_', ' ')} - ${assignment.role_title}).\n\nI need to respectfully request a substitute due to: *${selectedReason}*.\nNote: ${note || 'Unable to attend duty as scheduled'}.\n\nThank you for understanding and God bless you!`;
  const whatsAppUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsAppText)}`;

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div ref={panel} role="dialog" aria-modal="true" aria-label="Request Service Substitute" className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-linear-to-r from-amber-700 via-amber-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <UserCheck className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Request Service Substitute
              </h2>
              <p className="text-[11px] text-amber-200">
                Department Duty Roster & Attendance Adjustment
              </p>
            </div>
          </div>
          <button
            onClick={close} disabled={isSubmitting}
            aria-label="Close substitute request"
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {saveError && <p role="alert" className="text-red-700 font-semibold">{saveError}</p>}
          <fieldset disabled={isSubmitting} className="space-y-4">
          {/* Assignment Summary Banner */}
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-slate-800 space-y-1">
            <div className="flex items-center justify-between font-bold">
              <span>{assignment.service_name}</span>
              <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                {assignment.department.replace('_', ' ')}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 flex items-center gap-1 font-medium">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{assignment.date} • Report: <strong>{assignment.report_time}</strong> • Role: <strong>{assignment.role_title}</strong></span>
            </p>
          </div>

          <div>
            <label htmlFor="substitute-reason" className="block font-bold text-slate-700 mb-1">
              Reason for Requesting Substitute <span className="text-rose-500">*</span>
            </label>
            <select id="substitute-reason"
              value={selectedReason}
              onChange={(e) => {setSelectedReason(e.target.value);changed();}}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-amber-500 outline-hidden"
              required
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="substitute-suggestion" className="block font-bold text-slate-700 mb-1">
              Suggested Replacement Volunteer (Optional)
            </label>
            <input id="substitute-suggestion" maxLength={200}
              type="text"
              value={suggestedReplacement}
              onChange={(e) => {setSuggestedReplacement(e.target.value);changed();}}
              placeholder="e.g. Spoke with Bro. Isaac who agreed to swap shifts"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500 outline-hidden text-xs"
            />
          </div>

          <div>
            <label htmlFor="substitute-notes" className="block font-bold text-slate-700 mb-1">
              Additional Notes for Department Head
            </label>
            <textarea id="substitute-notes" maxLength={2000}
              rows={2}
              value={note}
              onChange={(e) => {setNote(e.target.value);changed();}}
              placeholder="Provide any details to help your coordinator find a substitute quickly..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500 outline-hidden text-xs"
            ></textarea>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p>
              Your saved request will appear in Services → Duty Roster for coordinator review. Your duty remains assigned until a coordinator approves a replacement.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 border border-emerald-200 cursor-pointer"
              title="Open an optional WhatsApp message for manual sharing"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>Open WhatsApp Draft</span>
            </a>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={close} disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>{isSubmitting?'Saving Request...':'Submit Request'}</span>
              </button>
            </div>
          </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
};
