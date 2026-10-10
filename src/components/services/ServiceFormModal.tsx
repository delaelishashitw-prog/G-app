import React, { useState } from 'react';
import { X, Check, CalendarDays, Clock, MapPin, User, Users } from 'lucide-react';
import { ChurchService } from '../../types/database.types';
import { useToast } from '../../contexts/ToastContext';

interface ServiceFormModalProps {
  initialService?: ChurchService | null;
  onSave: (data: Omit<ChurchService, 'id'>) => void;
  onClose: () => void;
}

export const ServiceFormModal: React.FC<ServiceFormModalProps> = ({
  initialService,
  onSave,
  onClose,
}) => {
  const { error } = useToast();

  const [formData, setFormData] = useState({
    name: initialService?.name || '',
    type: initialService?.type || ('sunday' as ChurchService['type']),
    day_of_week: initialService?.day_of_week || 'Sunday',
    start_time: initialService?.start_time || '08:00',
    end_time: initialService?.end_time || '10:30',
    venue: initialService?.venue || 'Main Worship Hall',
    service_leader: initialService?.service_leader || '',
    preacher: initialService?.preacher || '',
    worship_leader: initialService?.worship_leader || '',
    expected_attendance: initialService?.expected_attendance ? initialService.expected_attendance.toString() : '',
    description: initialService?.description || '',
    is_active: initialService !== undefined && initialService !== null ? initialService.is_active : true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      error('Missing Name', 'Please provide a name for this church service.');
      return;
    }

    onSave({
      name: formData.name.trim(),
      type: formData.type,
      day_of_week: formData.day_of_week,
      start_time: formData.start_time,
      end_time: formData.end_time,
      venue: formData.venue.trim() || 'Main Worship Hall',
      service_leader: formData.service_leader.trim() || undefined,
      preacher: formData.preacher.trim() || undefined,
      worship_leader: formData.worship_leader.trim() || undefined,
      expected_attendance: parseInt(formData.expected_attendance, 10) || undefined,
      description: formData.description.trim() || undefined,
      is_active: formData.is_active,
      order_of_service: initialService?.order_of_service,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white dark:bg-[#0e1726] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-4 max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-[#064e3b] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-700/60 rounded-lg">
              <CalendarDays className="w-5 h-5 text-emerald-200" />
            </span>
            <div>
              <h3 className="text-base font-bold">
                {initialService ? 'Edit Church Service' : 'Schedule New Church Service'}
              </h3>
              <p className="text-xs text-emerald-200">
                Church Management System
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/80 hover:text-white rounded-lg transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Service Name / Title *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Sunday 1st Service (Prophetic Encounter)"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Day of Week</label>
              <select
                value={formData.day_of_week}
                onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="Sunday">Sunday</option>
                <option value="Wednesday">Wednesday</option>
                <option value="Friday">Friday</option>
                <option value="Saturday">Saturday</option>
                <option value="Tuesday">Tuesday</option>
                <option value="Thursday">Thursday</option>
                <option value="Monday">Monday</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Service Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="sunday">Sunday Service</option>
                <option value="midweek">Midweek Teaching</option>
                <option value="prayer">Prayer / All-Night Vigil</option>
                <option value="youth">Youth & Young Adults</option>
                <option value="conference">Special Convention</option>
                <option value="special">Special Communion / Healing</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Start Time (GMT)</label>
              <input
                type="time"
                required
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">End Time (GMT)</label>
              <input
                type="time"
                required
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Sanctuary / Venue</label>
              <input
                type="text"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                placeholder="Main Cathedral Sanctuary, Joma"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Expected Attendance</label>
              <input
                type="number"
                value={formData.expected_attendance}
                onChange={(e) => setFormData({ ...formData, expected_attendance: e.target.value })}
                placeholder="250"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Preacher / Minister</label>
              <input
                type="text"
                value={formData.preacher}
                onChange={(e) => setFormData({ ...formData, preacher: e.target.value })}
                placeholder="Prophet Elisha K. Richard"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Service Leader / MC</label>
              <input
                type="text"
                value={formData.service_leader}
                onChange={(e) => setFormData({ ...formData, service_leader: e.target.value })}
                placeholder="Pastor David Osei-Tutu"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Worship Team / Lead</label>
              <input
                type="text"
                value={formData.worship_leader}
                onChange={(e) => setFormData({ ...formData, worship_leader: e.target.value })}
                placeholder="Voice of Dominion"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Service Purpose & Description</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Spiritual focus and purpose of this service meeting..."
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="rounded text-emerald-700 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="is_active" className="font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
              Active Regular Service (Appears on weekly bulletin and attendance rosters)
            </label>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#064e3b] hover:bg-[#047857] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{initialService ? 'Update Service' : 'Schedule Service'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
