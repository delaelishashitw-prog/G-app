import React, { useState } from 'react';
import { X, UserPlus, Sparkles, MapPin, Phone, User, HeartHandshake, Check } from 'lucide-react';
import { GenderType, VisitorStatus } from '../../types/database.types';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { useToast } from '../../contexts/ToastContext';

interface QuickAddVisitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceId: string;
  serviceName: string;
  date: string;
  onVisitorAddedAndCheckedIn?: (visitorId: string) => void;
}

export const QuickAddVisitorModal: React.FC<QuickAddVisitorModalProps> = ({
  isOpen,
  onClose,
  serviceId,
  serviceName,
  date,
  onVisitorAddedAndCheckedIn,
}) => {
  const { addVisitor, recordAttendance } = useChurchData();
  const { success, error } = useToast();

  const [formData, setFormData] = useState({
    full_name: '',
    gender: 'male' as GenderType,
    phone: '',
    address: '',
    gps_address: '',
    invited_by: '',
    prayer_request: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name.trim() || !formData.phone.trim()) {
      error('Full Name and Phone Number are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Add Visitor to Church database
      const newVisitor = addVisitor({
        full_name: formData.full_name.trim(),
        gender: formData.gender,
        phone: formData.phone.trim(),
        address: formData.address.trim() || undefined,
        gps_address: formData.gps_address.trim() || undefined,
        visit_date: date,
        service_attended: serviceName,
        invited_by: formData.invited_by.trim() || undefined,
        prayer_request: formData.prayer_request.trim() || undefined,
        follow_up_status: 'new' as VisitorStatus,
        notes: `Registered via Attendance Terminal for ${serviceName} on ${date}`,
      });

      // 2. Check into service attendance immediately
      const attRes = recordAttendance(serviceId, 'visitor', newVisitor.id, 'manual', date);

      success(`Welcome ${newVisitor.full_name}! Registered and checked in successfully.`);
      setFormData({
        full_name: '',
        gender: 'male',
        phone: '',
        address: '',
        gps_address: '',
        invited_by: '',
        prayer_request: '',
      });
      if (onVisitorAddedAndCheckedIn) {
        onVisitorAddedAndCheckedIn(newVisitor.id);
      }
      onClose();
    } catch (err) {
      console.error(err);
      error('Failed to register visitor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 to-emerald-800 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h3 className="font-bold text-base">Quick Register Visitor</h3>
              <p className="text-xs text-teal-100">
                Register & check in for {serviceName} ({date})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-teal-200 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Sister Mercy Afriyie"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-teal-600 font-medium"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Phone Number (Ghana) <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. 024 123 4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-teal-600 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as GenderType })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-teal-600 font-medium"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Residential Area / Town
              </label>
              <input
                type="text"
                placeholder="e.g. Joma Old Town, Weija, Ablekuma"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-teal-600 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                GhanaPost GPS (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. GA-183-4921"
                value={formData.gps_address}
                onChange={(e) => setFormData({ ...formData, gps_address: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-teal-600 font-medium font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Who Invited You / How Heard?
            </label>
            <input
              type="text"
              placeholder="e.g. Sister Abena Osei / Joma Roadside Banner"
              value={formData.invited_by}
              onChange={(e) => setFormData({ ...formData, invited_by: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-teal-600 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Prayer Request / Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Any prayer needs or comments for our pastoral team..."
              value={formData.prayer_request}
              onChange={(e) => setFormData({ ...formData, prayer_request: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-teal-600 font-medium"
            />
          </div>

          {/* Action buttons */}
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
              className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md shadow-teal-700/20 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Registering...' : 'Register & Check In'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
