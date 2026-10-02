import React, { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Users,
  Sparkles,
  BookOpen,
  DollarSign,
  Download,
  Share2,
  Printer,
  Edit,
  Trash2,
  CheckCircle,
  CheckCircle2,
  UserPlus,
  Copy,
  Check,
  AlertCircle,
  Phone,
  Mail,
  UserCheck,
} from 'lucide-react';
import { ChurchEvent } from '../../types/database.types';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { downloadEventIcs, generateWhatsAppAnnouncement } from './eventCalendarExport';
import { PrintEventFlyerModal } from './PrintEventFlyerModal';
import { RegisterAttendeeModal } from './RegisterAttendeeModal';

interface EventDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: ChurchEvent | null;
  onEdit: (event: ChurchEvent) => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  isOpen,
  onClose,
  event,
  onEdit,
}) => {
  const { deleteEvent, updateEvent, toggleAttendeeCheckIn, removeEventAttendee, settings } = useChurchData();
  const [activeTab, setActiveTab] = useState<'overview' | 'attendees' | 'share'>('overview');
  const [copiedAnnouncement, setCopiedAnnouncement] = useState(false);
  const [copiedGps, setCopiedGps] = useState(false);
  const [isPrintFlyerOpen, setIsPrintFlyerOpen] = useState(false);
  const [isRegisterAttendeeOpen, setIsRegisterAttendeeOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!isOpen || !event) return null;

  const handleCopyAnnouncement = () => {
    const text = generateWhatsAppAnnouncement(event, settings.church_name || 'Greater Works City Church, Joma');
    navigator.clipboard.writeText(text);
    setCopiedAnnouncement(true);
    setTimeout(() => setCopiedAnnouncement(false), 2500);
  };

  const handleCopyGps = () => {
    navigator.clipboard.writeText('GA-184-2900');
    setCopiedGps(true);
    setTimeout(() => setCopiedGps(false), 2000);
  };

  const handleDownloadIcs = () => {
    downloadEventIcs(event, settings.church_name);
  };

  const handleDelete = () => {
    deleteEvent(event.id);
    onClose();
  };

  const handleStatusChange = (newStatus: ChurchEvent['status']) => {
    updateEvent(event.id, { status: newStatus });
  };

  const isMultiDay = event.start_date !== event.end_date;
  const attendeesList = event.attendees || [];
  const checkedInCount = attendeesList.filter((a) => a.checked_in).length;

  // Format date readable
  const formatDateReadable = (dStr: string) => {
    try {
      return new Date(dStr).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dStr;
    }
  };

  // Status visual badge styling
  const statusColors: Record<ChurchEvent['status'], { bg: string; text: string; label: string }> = {
    upcoming: { bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', text: 'Upcoming', label: 'Upcoming' },
    ongoing: { bg: 'bg-rose-50 text-rose-800 border-rose-200', text: 'Ongoing Now', label: 'Ongoing Now' },
    completed: { bg: 'bg-slate-100 text-slate-700 border-slate-200', text: 'Completed', label: 'Completed' },
    draft: { bg: 'bg-amber-50 text-amber-800 border-amber-200', text: 'Draft Planning', label: 'Draft' },
    cancelled: { bg: 'bg-red-50 text-red-800 border-red-200', text: 'Cancelled', label: 'Cancelled' },
  };

  const curStatus = statusColors[event.status] || statusColors.upcoming;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-rose-950 via-rose-900 to-slate-900 text-white p-5 sm:p-6 shrink-0 relative">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2 text-xs">
              <span className="font-semibold uppercase tracking-wider text-rose-300">
                {event.event_type.replace('_', ' ')}
              </span>
              <span className="text-white/40">·</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold border border-white/20 bg-white/10 text-white">
                {curStatus.label}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug pr-8">
              {event.title}
            </h2>

            {event.theme && (
              <p className="mt-2 text-xs text-rose-200 font-serif italic">
                Theme: "{event.theme}" {event.theme_scripture ? `(${event.theme_scripture})` : ''}
              </p>
            )}
          </div>

          {/* Sub-nav Tabs */}
          <div className="flex items-center justify-between px-6 border-b border-slate-200 bg-slate-50/60 shrink-0">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`py-3 px-3 text-xs font-semibold border-b-2 transition ${
                  activeTab === 'overview'
                    ? 'border-rose-800 text-rose-900 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Overview & Details
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('attendees')}
                className={`py-3 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === 'attendees'
                    ? 'border-rose-800 text-rose-900 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <span>Volunteers & RSVPs</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-900 font-mono font-bold">
                  {attendeesList.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('share')}
                className={`py-3 px-3 text-xs font-semibold border-b-2 transition ${
                  activeTab === 'share'
                    ? 'border-rose-800 text-rose-900 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Share & Promotion
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1.5 py-2">
              <button
                onClick={handleDownloadIcs}
                title="Add to Google / Apple Calendar (.ics)"
                className="p-1.5 text-slate-600 hover:text-rose-800 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">iCal (.ics)</span>
              </button>
              <button
                onClick={() => setIsPrintFlyerOpen(true)}
                title="Print Official Program Bulletin"
                className="p-1.5 text-slate-600 hover:text-rose-800 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Flyer</span>
              </button>
            </div>
          </div>

          {/* TAB CONTENT BODY */}
          <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 flex-1">
            {activeTab === 'overview' && (
              <div className="space-y-5">
                {/* Time & Venue Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-rose-700" />
                      Date & Schedule
                    </span>
                    <p className="font-semibold text-slate-900 text-xs">
                      {isMultiDay
                        ? `${formatDateReadable(event.start_date)} - ${formatDateReadable(event.end_date)}`
                        : formatDateReadable(event.start_date)}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {event.start_time} - {event.end_time} GMT
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-700" />
                      Venue & Location
                    </span>
                    <p className="font-semibold text-slate-900 text-xs">{event.venue}</p>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="text-[11px] text-slate-500 font-mono">GPS: GA-184-2900</span>
                      <button
                        onClick={handleCopyGps}
                        className="text-[10px] text-rose-700 hover:text-rose-900 font-semibold underline"
                      >
                        {copiedGps ? 'Copied!' : 'Copy GPS'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Speaker & Host Ministry */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Keynote Minister / Speaker
                    </span>
                    <p className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      {event.speaker || 'Pastoral Ministerial Board'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Host Ministry / Department
                    </span>
                    <p className="font-semibold text-slate-900 text-xs">
                      {event.ministry_name || event.organizer || 'Greater Works City Church'}
                    </p>
                  </div>
                </div>

                {/* Attendance & Budget Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 block">Expected Attendance</span>
                    <span className="text-base font-extrabold text-slate-900 font-mono">
                      {event.expected_attendance || 'Open'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 block">Confirmed RSVPs</span>
                    <span className="text-base font-extrabold text-rose-900 font-mono">
                      {attendeesList.length || event.registration_count || 0}
                    </span>
                  </div>
                  {event.budget !== undefined && event.budget > 0 && (
                    <div>
                      <span className="text-[10px] font-semibold text-slate-500 block">Approved Budget</span>
                      <span className="text-base font-extrabold text-slate-900 font-mono">
                        GH₵ {event.budget.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Description & Order of Program */}
                {event.description && (
                  <div className="space-y-1.5">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                      Program Information & Objectives
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line p-3.5 bg-slate-50/50 rounded-xl border border-slate-200">
                      {event.description}
                    </p>
                  </div>
                )}

                {/* Status Switcher & Management */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-600">Change Status:</span>
                    <select
                      value={event.status}
                      onChange={(e) => handleStatusChange(e.target.value as any)}
                      className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                      <option value="draft">Draft</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEdit(event)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-300 flex items-center gap-1 transition"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit Program</span>
                    </button>
                    {!confirmDelete ? (
                      <button
                        onClick={() => setConfirmDelete(true)}
                        className="px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Delete event"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 bg-red-50 p-1 rounded-lg border border-red-200">
                        <span className="text-[10px] text-red-700 font-bold">Delete?</span>
                        <button
                          onClick={handleDelete}
                          className="px-2 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold hover:bg-red-700"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDelete(false)}
                          className="px-1.5 py-0.5 text-slate-600 text-[10px] hover:text-slate-900"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'attendees' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Volunteers, Duty Roster & Registered Attendees
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {checkedInCount} of {attendeesList.length} checked in for this program
                    </p>
                  </div>
                  <button
                    onClick={() => setIsRegisterAttendeeOpen(true)}
                    className="px-3 py-1.5 bg-rose-800 hover:bg-rose-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition self-start sm:self-auto"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Assign Volunteer / RSVP</span>
                  </button>
                </div>

                {attendeesList.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl space-y-2">
                    <Users className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-semibold text-slate-700">No attendees or duty roster assigned yet</p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      Assign ushers, protocol, media workers, and register church members expecting to attend.
                    </p>
                    <button
                      onClick={() => setIsRegisterAttendeeOpen(true)}
                      className="mt-2 px-3 py-1.5 bg-rose-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add First Person</span>
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                    {attendeesList.map((att) => (
                      <div
                        key={att.id}
                        className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            onClick={() => toggleAttendeeCheckIn(event.id, att.id)}
                            className={`p-1.5 rounded-lg border transition ${
                              att.checked_in
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600'
                            }`}
                            title={att.checked_in ? 'Checked in! Click to uncheck' : 'Click to check in'}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 truncate">{att.name}</span>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                {att.role || 'Attendee'}
                              </span>
                              {att.checked_in && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                                  Present
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 truncate">
                              {att.phone && (
                                <span className="flex items-center gap-1 font-mono">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  {att.phone}
                                </span>
                              )}
                              {att.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  {att.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => removeEventAttendee(event.id, att.id)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                          title="Remove from roster"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'share' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Congregation Announcement & Social Broadcast
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    One-click formatted WhatsApp announcement text for broadcast lists, church groups, and cell chats.
                  </p>
                </div>

                <div className="relative">
                  <pre className="p-4 bg-slate-900 text-rose-100 rounded-xl text-[11px] leading-relaxed overflow-x-auto font-mono whitespace-pre-wrap max-h-64 border border-slate-800">
                    {generateWhatsAppAnnouncement(event, settings.church_name || 'Greater Works City Church, Joma')}
                  </pre>
                  <button
                    onClick={handleCopyAnnouncement}
                    className="absolute top-3 right-3 px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md transition"
                  >
                    {copiedAnnouncement ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedAnnouncement ? 'Copied to Clipboard!' : 'Copy Announcement'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={handleDownloadIcs}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-rose-300 hover:bg-rose-50/30 text-left transition flex items-start gap-3"
                  >
                    <Download className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-900 block text-xs">Download iCalendar (.ics)</span>
                      <span className="text-[11px] text-slate-500">Sync program to Google Calendar, Apple iCal, or Outlook</span>
                    </div>
                  </button>

                  <button
                    onClick={() => setIsPrintFlyerOpen(true)}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-rose-300 hover:bg-rose-50/30 text-left transition flex items-start gap-3"
                  >
                    <Printer className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-900 block text-xs">Print Official Flyer & Bulletin</span>
                      <span className="text-[11px] text-slate-500">Generate printable program flyer with church insignia</span>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SUB-MODALS */}
      {isPrintFlyerOpen && (
        <PrintEventFlyerModal
          isOpen={isPrintFlyerOpen}
          onClose={() => setIsPrintFlyerOpen(false)}
          event={event}
        />
      )}

      {isRegisterAttendeeOpen && (
        <RegisterAttendeeModal
          isOpen={isRegisterAttendeeOpen}
          onClose={() => setIsRegisterAttendeeOpen(false)}
          eventId={event.id}
          eventTitle={event.title}
        />
      )}
    </>
  );
};
