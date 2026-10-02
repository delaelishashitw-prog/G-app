import React, { useState, useEffect } from 'react';
import { X, Save, UserCheck, Trash2 } from 'lucide-react';
import { Visitor, VisitorStatus, GenderType } from '../../types/database.types';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { useToast } from '../../contexts/ToastContext';

interface EditVisitorModalProps {
  visitor: Visitor | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleteRequest?: (visitor: Visitor) => void;
}

export const EditVisitorModal: React.FC<EditVisitorModalProps> = ({
  visitor,
  isOpen,
  onClose,
  onDeleteRequest,
}) => {
  const { updateVisitor } = useChurchData();
  const { success, error } = useToast();

  const [formData, setFormData] = useState({
    full_name: '',
    gender: 'female' as GenderType,
    phone: '',
    email: '',
    address: '',
    gps_address: '',
    service_attended: '',
    visit_date: '',
    invited_by: '',
    how_heard: '',
    prayer_request: '',
    follow_up_status: 'new' as VisitorStatus,
    assigned_to_name: '',
    notes: '',
  });

  useEffect(() => {
    if (visitor) {
      setFormData({
        full_name: visitor.full_name || '',
        gender: visitor.gender || 'female',
        phone: visitor.phone || '',
        email: visitor.email || '',
        address: visitor.address || '',
        gps_address: visitor.gps_address || '',
        service_attended: visitor.service_attended || 'Sunday 2nd Service (Celebration Service)',
        visit_date: visitor.visit_date || new Date().toISOString().split('T')[0],
        invited_by: visitor.invited_by || '',
        how_heard: visitor.how_heard || 'Friend / Family',
        prayer_request: visitor.prayer_request || '',
        follow_up_status: visitor.follow_up_status || 'new',
        assigned_to_name: visitor.assigned_to_name || 'Pastor David Osei-Tutu',
        notes: visitor.notes || '',
      });
    }
  }, [visitor]);

  if (!isOpen || !visitor) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name.trim() || !formData.phone.trim()) {
      error('Full Name and Phone Number are required.');
      return;
    }

    try {
      updateVisitor(visitor.id, {
        full_name: formData.full_name.trim(),
        gender: formData.gender,
        phone: formData.phone.trim(),
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
        gps_address: formData.gps_address.trim() || undefined,
        service_attended: formData.service_attended,
        visit_date: formData.visit_date,
        invited_by: formData.invited_by.trim() || undefined,
        how_heard: formData.how_heard,
        prayer_request: formData.prayer_request.trim() || undefined,
        follow_up_status: formData.follow_up_status,
        assigned_to_name: formData.assigned_to_name.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      });

      success(`Updated visitor record for ${formData.full_name}`);
      onClose();
    } catch (err) {
      console.error(err);
      error('Failed to update visitor details.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Edit Visitor Information</h3>
            <p className="text-xs text-slate-500">Update record for {visitor.full_name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone Number (+233) *</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs font-medium focus:outline-blue-600"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as GenderType })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-blue-600"
              >
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email (Optional)</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-blue-600"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Visit Date</label>
              <input
                type="date"
                value={formData.visit_date}
                onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-medium focus:outline-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Residential Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-blue-600"
                placeholder="e.g. Ablekuma Fanmilk"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">GhanaPost GPS Address</label>
              <input
                type="text"
                value={formData.gps_address}
                onChange={(e) => setFormData({ ...formData, gps_address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs uppercase font-medium focus:outline-blue-600"
                placeholder="GA-183-4921"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Service Attended</label>
              <select
                value={formData.service_attended}
                onChange={(e) => setFormData({ ...formData, service_attended: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-blue-600"
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-blue-600"
                placeholder="e.g. Kwame Mensah"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Follow-Up Status</label>
              <select
                value={formData.follow_up_status}
                onChange={(e) => setFormData({ ...formData, follow_up_status: e.target.value as VisitorStatus })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-blue-600"
              >
                <option value="new">New (Uncontacted)</option>
                <option value="follow_up_required">Follow-Up Required</option>
                <option value="contacted">Contacted (In Progress)</option>
                <option value="returning_visitor">Returning Visitor</option>
                <option value="converted_to_member">Converted to Member</option>
                <option value="closed">Closed / Inactive</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Assigned Pastor / Minister</label>
              <input
                type="text"
                value={formData.assigned_to_name}
                onChange={(e) => setFormData({ ...formData, assigned_to_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-blue-600"
                placeholder="e.g. Pastor David Osei-Tutu"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Prayer Request</label>
            <textarea
              rows={2}
              value={formData.prayer_request}
              onChange={(e) => setFormData({ ...formData, prayer_request: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-blue-600"
              placeholder="Prayer needs or spiritual counseling notes..."
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Pastoral Notes & Assimilation History</label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-blue-600"
              placeholder="Record follow-up calls, home visits, or personal updates..."
            />
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            {onDeleteRequest && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDeleteRequest(visitor);
                }}
                className="text-rose-600 hover:text-rose-800 font-semibold text-xs flex items-center gap-1 p-1.5 rounded-lg hover:bg-rose-50 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Record</span>
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
