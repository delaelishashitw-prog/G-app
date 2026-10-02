import React, { useState, useMemo } from 'react';
import {
  CalendarCheck,
  Calendar as CalendarIcon,
  CalendarDays,
  Clock,
  MapPin,
  Users,
  Sparkles,
  Plus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Download,
  Share2,
  Printer,
  CheckCircle2,
  Grid,
  List,
  Eye,
  BookOpen,
  ArrowRight,
  Radio,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { useChurchData } from '../contexts/ChurchDataContext';
import { ChurchEvent } from '../types/database.types';
import { EventDetailModal } from '../components/events/EventDetailModal';
import { ScheduleEventModal } from '../components/events/ScheduleEventModal';
import { PrintEventFlyerModal } from '../components/events/PrintEventFlyerModal';
import { downloadEventIcs, generateWhatsAppAnnouncement } from '../components/events/eventCalendarExport';

type ViewMode = 'calendar' | 'agenda' | 'cards';

const CATEGORY_TABS: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'All Programs' },
  { id: 'conference', label: 'Conferences' },
  { id: 'all_night', label: 'All-Night Vigils' },
  { id: 'youth', label: 'Youth' },
  { id: 'outreach', label: 'Outreach & Missions' },
  { id: 'leadership', label: 'Leadership & Summits' },
  { id: 'fasting', label: 'Consecration & Fasting' },
  { id: 'revival', label: 'Revival & Crusades' },
];

export const EventsPage: React.FC = () => {
  const { events, services, settings } = useChurchData();

  // Navigation & View State
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'ongoing' | 'completed' | 'draft'>('all');
  const [showWeeklyServices, setShowWeeklyServices] = useState(false);

  // Calendar Date State (defaults to current month: September 2026)
  const [currentDate, setCurrentDate] = useState(() => new Date('2026-09-25T00:00:00'));

  // Modals state
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<ChurchEvent | null>(null);
  const [eventToEdit, setEventToEdit] = useState<ChurchEvent | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleDefaultDate, setScheduleDefaultDate] = useState<string | undefined>(undefined);
  const [selectedEventForFlyer, setSelectedEventForFlyer] = useState<ChurchEvent | null>(null);

  // Day inspection drawer/modal
  const [inspectedDate, setInspectedDate] = useState<string | null>(null);

  // Notification / toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Calendar Navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const jumpToToday = () => {
    setCurrentDate(new Date('2026-09-25T00:00:00'));
  };

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      // Search query
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        evt.title.toLowerCase().includes(q) ||
        (evt.theme && evt.theme.toLowerCase().includes(q)) ||
        (evt.speaker && evt.speaker.toLowerCase().includes(q)) ||
        evt.venue.toLowerCase().includes(q) ||
        (evt.description && evt.description.toLowerCase().includes(q));

      // Category
      const matchesCategory = selectedCategory === 'all' || evt.event_type === selectedCategory;

      // Status
      const matchesStatus = statusFilter === 'all' || evt.status === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [events, searchQuery, selectedCategory, statusFilter]);

  // Spotlight Next Event
  const spotlightEvent = useMemo(() => {
    const upcoming = events
      .filter((e) => e.status === 'upcoming' || e.status === 'ongoing')
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
    return upcoming[0] || events[0];
  }, [events]);

  // Calendar Grid Computations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Map events to date strings
  const eventsByDate = useMemo(() => {
    const map: Record<string, ChurchEvent[]> = {};
    events.forEach((evt) => {
      // If multi-day, populate across range
      const start = new Date(evt.start_date);
      const end = new Date(evt.end_date || evt.start_date);

      // Loop days
      const cur = new Date(start);
      while (cur <= end) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        const dKey = `${y}-${m}-${d}`;
        if (!map[dKey]) map[dKey] = [];
        if (!map[dKey].some((x) => x.id === evt.id)) {
          map[dKey].push(evt);
        }
        cur.setDate(cur.getDate() + 1);
      }
    });
    return map;
  }, [events]);

  // Recurring weekly services mapping
  const regularServicesByDayOfWeek = useMemo(() => {
    // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
    return {
      0: [
        { name: 'Sunday 1st Service', time: '07:00 - 09:00', venue: 'GWCC Sanctuary' },
        { name: 'Sunday 2nd Service', time: '09:30 - 12:30', venue: 'GWCC Sanctuary' },
      ],
      3: [{ name: 'Midweek Teaching & Communion', time: '18:30 - 20:30', venue: 'GWCC Sanctuary' }],
      5: [{ name: 'Friday Breakthrough & Deliverance', time: '19:00 - 21:00', venue: 'GWCC Sanctuary' }],
    } as Record<number, Array<{ name: string; time: string; venue: string }>>;
  }, []);

  // Compute countdown for spotlight
  const getCountdownText = (startDateStr: string) => {
    const today = new Date('2026-09-25T00:00:00').getTime();
    const target = new Date(startDateStr).getTime();
    const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Happening Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays > 1) return `In ${diffDays} days`;
    if (diffDays === -1) return 'Yesterday';
    return `${Math.abs(diffDays)} days ago`;
  };

  // Quick stats
  const totalUpcoming = events.filter((e) => e.status === 'upcoming' || e.status === 'ongoing').length;
  const totalRsvps = events.reduce((sum, e) => sum + (e.attendees?.length || e.registration_count || 0), 0);
  const totalExpected = events.reduce((sum, e) => sum + (e.expected_attendance || 0), 0);

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2 animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-rose-800" />
            Events & Ecclesiastical Calendar
          </h1>
          <p className="text-xs text-slate-500">
            Greater Works City Church annual conferences, crusades, vigils, outreaches, and weekly worship
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEventToEdit(null);
              setScheduleDefaultDate(undefined);
              setIsScheduleModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-rose-800 hover:bg-rose-900 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Program</span>
          </button>
        </div>
      </div>

      {/* SPOTLIGHT BANNER: NEXT MAJOR UPCOMING EVENT */}
      {spotlightEvent && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-950 via-rose-900 to-slate-950 text-white p-5 sm:p-6 shadow-md border border-rose-900/40">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono font-bold text-rose-300 uppercase tracking-widest text-[10px]">
                  FEATURED PROGRAM
                </span>
                <span className="text-white/40">·</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-950 shadow-xs">
                  {getCountdownText(spotlightEvent.start_date)}
                </span>
                <span className="text-white/40">·</span>
                <span className="text-rose-200 capitalize font-medium">
                  {spotlightEvent.event_type.replace('_', ' ')}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                {spotlightEvent.title}
              </h2>

              {spotlightEvent.theme && (
                <p className="text-xs text-rose-200 font-serif italic">
                  Theme: "{spotlightEvent.theme}" {spotlightEvent.theme_scripture ? `(${spotlightEvent.theme_scripture})` : ''}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-xs text-rose-100/90 pt-1 font-medium">
                <span className="flex items-center gap-1">
                  <CalendarIcon className="w-3.5 h-3.5 text-rose-400" />
                  {spotlightEvent.start_date}
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <Clock className="w-3.5 h-3.5 text-rose-400" />
                  {spotlightEvent.start_time} - {spotlightEvent.end_time} GMT
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  {spotlightEvent.venue}
                </span>
                {spotlightEvent.speaker && (
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    {spotlightEvent.speaker}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 lg:flex-col lg:items-end shrink-0">
              <button
                onClick={() => setSelectedEventForDetail(spotlightEvent)}
                className="px-4 py-2 bg-white text-rose-950 hover:bg-rose-50 text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Details & Roster</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const text = generateWhatsAppAnnouncement(spotlightEvent, settings.church_name);
                    navigator.clipboard.writeText(text);
                    showToast('WhatsApp announcement copied to clipboard!');
                  }}
                  className="px-3 py-1.5 bg-rose-800/80 hover:bg-rose-800 text-white text-xs font-medium rounded-lg border border-rose-700/60 transition flex items-center gap-1.5"
                  title="Share WhatsApp announcement"
                >
                  <Share2 className="w-3.5 h-3.5 text-rose-300" />
                  <span>WhatsApp Copy</span>
                </button>

                <button
                  onClick={() => downloadEventIcs(spotlightEvent, settings.church_name)}
                  className="px-3 py-1.5 bg-rose-800/80 hover:bg-rose-800 text-white text-xs font-medium rounded-lg border border-rose-700/60 transition flex items-center gap-1.5"
                  title="Download iCalendar file (.ics)"
                >
                  <Download className="w-3.5 h-3.5 text-rose-300" />
                  <span>iCal</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUMMARY STATS BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-0.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Upcoming Programs
          </span>
          <p className="text-xl font-extrabold text-slate-900 font-mono">{totalUpcoming}</p>
          <span className="text-[11px] text-slate-400">Scheduled on calendar</span>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-0.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Expected Attendance
          </span>
          <p className="text-xl font-extrabold text-slate-900 font-mono">
            {totalExpected.toLocaleString()}
          </p>
          <span className="text-[11px] text-slate-400">Target sanctuary count</span>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-0.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Volunteers & RSVPs
          </span>
          <p className="text-xl font-extrabold text-rose-800 font-mono">{totalRsvps}</p>
          <span className="text-[11px] text-slate-400">Assigned duty workers</span>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-0.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Current Calendar
          </span>
          <p className="text-base font-extrabold text-slate-900 truncate">{monthName}</p>
          <span className="text-[11px] text-slate-400">Ecclesiastical cycle</span>
        </div>
      </div>

      {/* CONTROLS & FILTER BAR */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search programs, speakers, themes, venues..."
              className="w-full pl-9 pr-3.5 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
            />
          </div>

          {/* View Mode & Toggles */}
          <div className="flex items-center gap-2 overflow-x-auto">
            {/* Weekly Services Toggle */}
            <button
              onClick={() => setShowWeeklyServices(!showWeeklyServices)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                showWeeklyServices
                  ? 'bg-rose-50 text-rose-900 border border-rose-200'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
              title="Show Sunday and Midweek services on calendar"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Weekly Services</span>
            </button>

            {/* View Switcher */}
            <div className="p-1 bg-slate-100 rounded-lg flex items-center border border-slate-200 text-xs">
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition ${
                  viewMode === 'calendar'
                    ? 'bg-white text-rose-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Month Grid</span>
              </button>
              <button
                onClick={() => setViewMode('agenda')}
                className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition ${
                  viewMode === 'agenda'
                    ? 'bg-white text-rose-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Agenda</span>
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition ${
                  viewMode === 'cards'
                    ? 'bg-white text-rose-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
            </div>
          </div>
        </div>

        {/* Category Segmented Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 no-scrollbar border-t border-slate-100">
          {CATEGORY_TABS.map((tab) => {
            const isActive = selectedCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  isActive
                    ? 'bg-rose-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* VIEW 1: MONTHLY CALENDAR GRID */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          {/* Calendar Month Header */}
          <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                {monthName}
              </h2>
              <button
                onClick={jumpToToday}
                className="px-2.5 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition"
              >
                Today
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 text-center py-2">
            <span>SUN</span>
            <span>MON</span>
            <span>TUE</span>
            <span>WED</span>
            <span>THU</span>
            <span>FRI</span>
            <span>SAT</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 bg-slate-100/30">
            {/* Blank cells for prev month offset */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => {
              const dayNum = daysInPrevMonth - firstDayOfMonth + i + 1;
              return (
                <div
                  key={`prev-${i}`}
                  className="min-h-[100px] sm:min-h-[115px] p-1.5 sm:p-2 bg-slate-50/50 text-slate-300 text-xs"
                >
                  <span className="font-mono">{dayNum}</span>
                </div>
              );
            })}

            {/* Days of current month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayOfWeek = new Date(year, month, dayNum).getDay();
              const isToday = dateStr === '2026-09-25'; // Current system context date
              const dayEvents = eventsByDate[dateStr] || [];
              const weeklyServicesForDay = showWeeklyServices ? regularServicesByDayOfWeek[dayOfWeek] || [] : [];

              return (
                <div
                  key={`day-${dayNum}`}
                  onClick={() => setInspectedDate(dateStr)}
                  className={`min-h-[100px] sm:min-h-[115px] p-1.5 sm:p-2 bg-white transition hover:bg-rose-50/30 cursor-pointer flex flex-col justify-between group ${
                    isToday ? 'bg-rose-50/40 ring-2 ring-rose-600/20 inset-0' : ''
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-mono font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                          isToday
                            ? 'bg-rose-800 text-white font-black'
                            : 'text-slate-700 group-hover:text-rose-800'
                        }`}
                      >
                        {dayNum}
                      </span>

                      {/* Small plus button on hover */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEventToEdit(null);
                          setScheduleDefaultDate(dateStr);
                          setIsScheduleModalOpen(true);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-800 hover:bg-slate-100 rounded transition"
                        title={`Schedule on ${dateStr}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Events list in cell */}
                    <div className="space-y-1 overflow-hidden">
                      {dayEvents.map((evt) => (
                        <div
                          key={evt.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEventForDetail(evt);
                          }}
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold truncate transition border border-rose-200/80 bg-rose-50 text-rose-900 hover:bg-rose-100 cursor-pointer"
                          title={`${evt.title} (${evt.start_time})`}
                        >
                          <span className="font-mono text-[9px] opacity-75 mr-1">
                            {evt.start_time}
                          </span>
                          <span>{evt.title}</span>
                        </div>
                      ))}

                      {/* Regular weekly church service pills if toggled */}
                      {weeklyServicesForDay.map((srv, idx) => (
                        <div
                          key={`ws-${idx}`}
                          className="px-1.5 py-0.5 rounded text-[9px] font-medium truncate border border-slate-200 bg-slate-50 text-slate-600"
                          title={`Weekly: ${srv.name} (${srv.time})`}
                        >
                          <span className="opacity-75 mr-1 font-mono">{srv.time.split(' ')[0]}</span>
                          <span>{srv.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Day count indicator */}
                  {dayEvents.length > 2 && (
                    <span className="text-[9px] text-slate-400 font-semibold self-end">
                      +{dayEvents.length - 2} more
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: AGENDA CHRONOLOGICAL TIMELINE */}
      {viewMode === 'agenda' && (
        <div className="space-y-4">
          {filteredEvents.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
              <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700">No events found matching your criteria</p>
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="text-xs text-rose-800 font-bold hover:underline"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEvents
                .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
                .map((evt) => {
                  const isMultiDay = evt.start_date !== evt.end_date;
                  return (
                    <div
                      key={evt.id}
                      onClick={() => setSelectedEventForDetail(evt)}
                      className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 hover:border-rose-300 hover:shadow-xs transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      {/* Left: Date Badge & Details */}
                      <div className="flex items-start gap-4">
                        {/* Big Date Badge */}
                        <div className="w-16 h-16 rounded-xl bg-slate-900 text-white flex flex-col items-center justify-center shrink-0">
                          <span className="text-[10px] uppercase font-bold text-rose-300">
                            {new Date(evt.start_date).toLocaleDateString('en-GB', { month: 'short' })}
                          </span>
                          <span className="text-xl font-black font-mono leading-none">
                            {new Date(evt.start_date).getDate()}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            {new Date(evt.start_date).toLocaleDateString('en-GB', { weekday: 'short' })}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800">
                              {evt.event_type.replace('_', ' ')}
                            </span>
                            <span className="text-slate-300">·</span>
                            <span className="text-[10px] font-bold uppercase px-2 py-0.2 rounded bg-slate-100 text-slate-700">
                              {evt.status}
                            </span>
                            {evt.start_date === '2026-09-25' && (
                              <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-400 text-slate-950">
                                TODAY
                              </span>
                            )}
                          </div>

                          <h3 className="text-base font-bold text-slate-900">{evt.title}</h3>

                          {evt.theme && (
                            <p className="text-xs text-rose-800 font-serif italic">
                              "{evt.theme}" {evt.theme_scripture ? `(${evt.theme_scripture})` : ''}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                            <span className="flex items-center gap-1 font-mono">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              {evt.start_time} - {evt.end_time}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              {evt.venue}
                            </span>
                            {evt.speaker && (
                              <span className="flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                {evt.speaker}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                        <span className="text-xs font-mono font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                          {evt.attendees?.length || evt.registration_count || 0} RSVPs
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEventForDetail(evt);
                          }}
                          className="px-3.5 py-1.5 bg-rose-50 text-rose-900 hover:bg-rose-100 rounded-xl text-xs font-bold transition flex items-center gap-1"
                        >
                          <span>Manage</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: CARDS GRID */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((evt) => {
            return (
              <div
                key={evt.id}
                onClick={() => setSelectedEventForDetail(evt)}
                className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-rose-300 hover:shadow-xs transition space-y-3 cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                      {evt.event_type.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {evt.status}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 leading-snug">{evt.title}</h3>

                  {evt.theme && (
                    <p className="text-xs text-rose-900 font-serif italic">
                      "{evt.theme}" {evt.theme_scripture ? `(${evt.theme_scripture})` : ''}
                    </p>
                  )}

                  <p className="text-xs text-slate-600 line-clamp-2">
                    {evt.description || 'Special ecclesiastical program at Greater Works City Church.'}
                  </p>

                  {evt.speaker && (
                    <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 pt-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="truncate">Minister: {evt.speaker}</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-500">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {evt.start_date} ({evt.start_time})
                    </span>
                    <span className="font-mono text-slate-700 font-semibold">
                      {evt.attendees?.length || 0} RSVPs
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="flex items-center gap-1 truncate text-[11px]">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{evt.venue.split(',')[0]}</span>
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEventForDetail(evt);
                      }}
                      className="text-xs font-bold text-rose-800 hover:text-rose-900"
                    >
                      Details →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DATE INSPECTION MODAL (When clicking a day in the monthly calendar) */}
      {inspectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-rose-300">Day Schedule</span>
                <h3 className="text-base font-bold text-white">
                  {new Date(inspectedDate).toLocaleDateString('en-GB', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </h3>
              </div>
              <button
                onClick={() => setInspectedDate(null)}
                className="p-1 text-white/70 hover:text-white rounded-lg transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {(!eventsByDate[inspectedDate] || eventsByDate[inspectedDate].length === 0) ? (
                <div className="text-center py-6 text-slate-400 space-y-2">
                  <CalendarIcon className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs text-slate-600">No special programs scheduled on this date.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {eventsByDate[inspectedDate].map((evt) => (
                    <div
                      key={evt.id}
                      onClick={() => {
                        setInspectedDate(null);
                        setSelectedEventForDetail(evt);
                      }}
                      className="p-3.5 rounded-xl border border-slate-200 bg-rose-50/40 hover:bg-rose-50 hover:border-rose-300 transition cursor-pointer space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-rose-800">
                          {evt.event_type.replace('_', ' ')}
                        </span>
                        <span className="text-xs font-mono font-semibold text-slate-600">
                          {evt.start_time} - {evt.end_time}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">{evt.title}</h4>
                      {evt.speaker && (
                        <p className="text-xs text-slate-600">Minister: {evt.speaker}</p>
                      )}
                      <p className="text-[11px] text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {evt.venue}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Schedule on this date button */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setInspectedDate(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const d = inspectedDate;
                    setInspectedDate(null);
                    setEventToEdit(null);
                    setScheduleDefaultDate(d);
                    setIsScheduleModalOpen(true);
                  }}
                  className="px-4 py-2 bg-rose-800 hover:bg-rose-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Schedule on This Day</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EVENT DETAIL MODAL */}
      {selectedEventForDetail && (
        <EventDetailModal
          isOpen={!!selectedEventForDetail}
          onClose={() => setSelectedEventForDetail(null)}
          event={selectedEventForDetail}
          onEdit={(evt) => {
            setSelectedEventForDetail(null);
            setEventToEdit(evt);
            setIsScheduleModalOpen(true);
          }}
        />
      )}

      {/* SCHEDULE / EDIT PROGRAM MODAL */}
      {isScheduleModalOpen && (
        <ScheduleEventModal
          isOpen={isScheduleModalOpen}
          onClose={() => {
            setIsScheduleModalOpen(false);
            setEventToEdit(null);
            setScheduleDefaultDate(undefined);
          }}
          eventToEdit={eventToEdit}
          defaultDate={scheduleDefaultDate}
        />
      )}
    </div>
  );
};
