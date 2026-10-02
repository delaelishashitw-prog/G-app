import React, { useState } from 'react';
import { X, Heart, Check, Calendar, UserCheck } from 'lucide-react';
import { Member, PastoralCareType } from '../../types/database.types';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { useToast } from '../../contexts/ToastContext';

interface AddPastoralNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member;
}

export const AddPastoralNoteModal: React.FC<AddPastoralNoteModalProps> = ({
  isOpen,
  onClose,
  member,
}) => {
  const { addPastoralCare } = useChurchData();
  const { success, error } = useToast();

  const [careType, setCareType] = useState<PastoralCareType>('home_visit');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [pastorName, setPastorName] = useState<string>('Senior Pastor / Resident Minister');
  const [notes, setNotes] = useState<string>('');
  const [followUpDate, setFollowUpDate] = useState<string>('');
  const [actionItems, setActionItems] = useState<string>('');
  const [isConfidential, setIsConfidential] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      error('Please write pastoral notes or observations.');
      return;
    }

    setIsSubmitting(true);
    try {
      addPastoralCare({
        member_id: member.id,
        member_name: `${member.first_name} ${member.last_name}`,
        member_phone: member.phone,
        date,
        care_type: careType,
        pastor_name: pastorName,
        assigned_pastor: pastorName,
        notes: notes.trim(),
        action_items: actionItems.trim() || undefined,
        follow_up_date: followUpDate || undefined,
        is_confidential: isConfidential,
        status: 'completed',
      });

      success(`Pastoral care record logged for ${member.first_name}!`);
      onClose();
    } catch (err) {
      console.error(err);
      error('Failed to log pastoral care record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-800 to-indigo-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Heart className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <h3 className="font-bold text-base">Add Pastoral Care Log</h3>
              <p className="text-xs text-purple-200">
                For {member.first_name} {member.last_name} ({member.member_id})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-purple-200 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Care / Visit Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={careType}
                onChange={(e) => setCareType(e.target.value as PastoralCareType)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-purple-600 font-bold text-slate-800"
              >
                <option value="home_visit">Home Visitation</option>
                <option value="hospital_visit">Hospital Visitation</option>
                <option value="spiritual_counseling">Spiritual Counseling</option>
                <option value="marriage">Premarital / Marriage Guidance</option>
                <option value="bereavement">Bereavement & Condolence</option>
                <option value="welfare">Welfare & Benevolence</option>
                <option value="general_follow_up">General Follow-Up Call</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date Conducted</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-purple-600 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Minister / Pastor In Charge
            </label>
            <input
              type="text"
              value={pastorName}
              onChange={(e) => setPastorName(e.target.value)}
              placeholder="e.g. Senior Pastor / Lady Pastor Mercy"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-purple-600 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Pastoral Remarks & Spiritual Summary <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              placeholder="Details of the interaction, prayer needs, family well-being, or counseling advice given..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-purple-600 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Action Items / Next Step
              </label>
              <input
                type="text"
                placeholder="e.g. Follow-up call next week"
                value={actionItems}
                onChange={(e) => setActionItems(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-purple-600 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Next Follow-Up Date (Optional)
              </label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-purple-600 font-medium"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_confidential"
              checked={isConfidential}
              onChange={(e) => setIsConfidential(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded-sm focus:ring-purple-500"
            />
            <label htmlFor="is_confidential" className="text-xs font-bold text-slate-700 cursor-pointer">
              Mark as Confidential (Pastoral Council Eyes Only)
            </label>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md shadow-purple-700/20 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Logging...' : 'Save Pastoral Record'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
