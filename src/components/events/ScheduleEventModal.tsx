import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Sparkles, BookOpen, Users, DollarSign, Plus, Check } from 'lucide-react';
import { ChurchEvent } from '../../types/database.types';
import { useChurchData } from '../../contexts/ChurchDataContext';

interface ScheduleEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventToEdit?: ChurchEvent | null;
  defaultDate?: string;
}

const VENUE_PRESETS = [
  'GWCC Main Sanctuary, Joma, Accra',
  'Joma Community School Park, Accra',
  'GWCC Youth Chapel & Annex',
  'GWCC Executive Conference Room',
  'Online Zoom & Facebook / YouTube Live',
];

export const ScheduleEventModal: React.FC<ScheduleEventModalProps> = ({
  isOpen,
  onClose,
  eventToEdit,
  defaultDate,
}) => {
  const { createEvent, updateEvent, ministries } = useChurchData();

  const todayStr = defaultDate || new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    title: '',
    event_type: 'conference' as ChurchEvent['event_type'],
    theme: '',
    theme_scripture: '',
    description: '',
    start_date: todayStr,
    end_date: todayStr,
    start_time: '18:00',
    end_time: '21:00',
    venue: VENUE_PRESETS[0],
    organizer: 'GWCC Pastoral Board',
    ministry_name: 'Pastoral & Ministerial Council',
    speaker: 'Prophet Elisha K. Richard',
    expected_attendance: '250',
    budget: '5000',
    status: 'upcoming' as ChurchEvent['status'],
    requires_registration: false,
    banner_color: 'rose',
  });

  useEffect(() => {
    if (eventToEdit) {
      setFormData({
        title: eventToEdit.title,
        event_type: eventToEdit.event_type,
        theme: eventToEdit.theme || '',
        theme_scripture: eventToEdit.theme_scripture || '',
        description: eventToEdit.description || '',
        start_date: eventToEdit.start_date,
        end_date: eventToEdit.end_date || eventToEdit.start_date,
        start_time: eventToEdit.start_time,
        end_time: eventToEdit.end_time,
        venue: eventToEdit.venue,
        organizer: eventToEdit.organizer || '',
        ministry_name: eventToEdit.ministry_name || '',
        speaker: eventToEdit.speaker || '',
        expected_attendance: eventToEdit.expected_attendance?.toString() || '250',
        budget: eventToEdit.budget?.toString() || '0',
        status: eventToEdit.status,
        requires_registration: eventToEdit.requires_registration || false,
        banner_color: eventToEdit.banner_color || 'rose',
      });
    } else {
      setFormData({
        title: '',
        event_type: 'conference',
        theme: '',
        theme_scripture: '',
        description: '',
        start_date: defaultDate || new Date().toISOString().split('T')[0],
        end_date: defaultDate || new Date().toISOString().split('T')[0],
        start_time: '18:00',
        end_time: '21:00',
        venue: VENUE_PRESETS[0],
        organizer: 'GWCC Pastoral Board',
        ministry_name: 'Pastoral & Ministerial Council',
        speaker: 'Prophet Elisha K. Richard',
        expected_attendance: '250',
        budget: '5000',
        status: 'upcoming',
        requires_registration: false,
        banner_color: 'rose',
      });
    }
  }, [eventToEdit, defaultDate, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    const payload = {
      title: formData.title.trim(),
      event_type: formData.event_type,
      theme: formData.theme.trim() || undefined,
      theme_scripture: formData.theme_scripture.trim() || undefined,
      description: formData.description.trim() || undefined,
      start_date: formData.start_date,
      end_date: formData.end_date || formData.start_date,
      start_time: formData.start_time,
      end_time: formData.end_time,
      venue: formData.venue.trim(),
      organizer: formData.organizer.trim() || undefined,
      ministry_name: formData.ministry_name.trim() || undefined,
      speaker: formData.speaker.trim() || undefined,
      expected_attendance: parseInt(formData.expected_attendance, 10) || 100,
      budget: parseFloat(formData.budget) || 0,
      status: formData.status,
      requires_registration: formData.requires_registration,
      banner_color: formData.banner_color,
    };

    if (eventToEdit) {
      updateEvent(eventToEdit.id, payload);
    } else {
      createEvent({
        ...payload,
        attendees: [],
        registration_count: 0,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-rose-950 via-rose-900 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-rose-300" />
            <div>
              <h3 className="text-base font-bold text-white">
                {eventToEdit ? 'Edit Church Program' : 'Schedule Church Program'}
              </h3>
              <p className="text-[11px] text-rose-200">
                Plan conventions, vigils, conferences, outreaches & summits
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/70 hover:text-white rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Program Title */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Program / Event Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Supernatural Breakthrough Convention 2026"
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
            />
          </div>

          {/* Event Category & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Event Category
              </label>
              <select
                value={formData.event_type}
                onChange={(e) => setFormData({ ...formData, event_type: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              >
                <option value="conference">Conference / Convention</option>
                <option value="revival">Revival & Crusade</option>
                <option value="all_night">All-Night Prayer Vigil</option>
                <option value="youth">Youth Gathering / Fellowship</option>
                <option value="outreach">Community Outreach & Medical</option>
                <option value="leadership">Leadership & Business Summit</option>
                <option value="fasting">Consecration & Fasting</option>
                <option value="banquet">Carol Service / Banquet</option>
                <option value="special">Special Worship Service</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Planning Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              >
                <option value="upcoming">Upcoming (Confirmed)</option>
                <option value="ongoing">Ongoing Now</option>
                <option value="draft">Draft / Planning Stage</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Theme & Scripture */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-rose-50/50 rounded-xl border border-rose-100">
            <div>
              <label className="block font-semibold text-rose-950 mb-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-rose-700" />
                Spiritual Theme
              </label>
              <input
                type="text"
                value={formData.theme}
                onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                placeholder="e.g. Possessing Your Possessions"
                className="w-full px-3 py-1.5 border border-rose-200 bg-white rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-rose-950 mb-1 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-rose-700" />
                Scripture Anchor
              </label>
              <input
                type="text"
                value={formData.theme_scripture}
                onChange={(e) => setFormData({ ...formData, theme_scripture: e.target.value })}
                placeholder="e.g. Obadiah 1:17 or Hebrews 1:7"
                className="w-full px-3 py-1.5 border border-rose-200 bg-white rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Date & Time Range */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Start Date *</label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => {
                  const newStart = e.target.value;
                  setFormData({
                    ...formData,
                    start_date: newStart,
                    end_date: formData.end_date < newStart ? newStart : formData.end_date,
                  });
                }}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">End Date *</label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Start Time</label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">End Time</label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Venue & Presets */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-semibold text-slate-700">Venue *</label>
              <div className="flex items-center gap-1.5 overflow-x-auto text-[10px] text-slate-500">
                <span className="shrink-0 font-medium">Presets:</span>
                {VENUE_PRESETS.slice(0, 3).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setFormData({ ...formData, venue: v })}
                    className="hover:text-rose-800 underline truncate max-w-[120px]"
                  >
                    {v.split(',')[0]}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              required
              value={formData.venue}
              onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
            />
          </div>

          {/* Speaker & Host Ministry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Guest Minister / Speaker
              </label>
              <input
                type="text"
                value={formData.speaker}
                onChange={(e) => setFormData({ ...formData, speaker: e.target.value })}
                placeholder="e.g. Prophet Elisha K. Richard"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Host Ministry / Department
              </label>
              <select
                value={formData.ministry_name}
                onChange={(e) => setFormData({ ...formData, ministry_name: e.target.value, organizer: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              >
                <option value="Pastoral & Ministerial Council">Pastoral & Ministerial Council</option>
                {ministries.map((min) => (
                  <option key={min.id} value={min.name}>
                    {min.name}
                  </option>
                ))}
                <option value="GWCC Executive Board">GWCC Executive Board</option>
                <option value="Joint Church Ministries">Joint Church Ministries</option>
              </select>
            </div>
          </div>

          {/* Expected Attendance & Budget */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Expected Attendance
              </label>
              <input
                type="number"
                value={formData.expected_attendance}
                onChange={(e) => setFormData({ ...formData, expected_attendance: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Allocated Budget (GH₵)
              </label>
              <input
                type="number"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Registration Required Toggle */}
          <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <input
              type="checkbox"
              id="requires_registration"
              checked={formData.requires_registration}
              onChange={(e) => setFormData({ ...formData, requires_registration: e.target.checked })}
              className="w-4 h-4 rounded text-rose-700 focus:ring-rose-500"
            />
            <label htmlFor="requires_registration" className="text-xs font-semibold text-slate-800 cursor-pointer">
              Enable Volunteer & Attendee Pre-Registration (RSVP)
            </label>
          </div>

          {/* Description */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Program Description & Objectives
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="State the objective, orders of service, special arrangements, or transportation details..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-rose-800 hover:bg-rose-900 text-white rounded-xl font-bold shadow-sm transition"
            >
              {eventToEdit ? 'Save Changes' : 'Schedule Program'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
