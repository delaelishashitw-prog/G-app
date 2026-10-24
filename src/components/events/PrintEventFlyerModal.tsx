import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { effectiveEventStatus, EVENT_SAVE_NOTICE } from '../../features/events/eventRules';
import { X, Printer, Calendar, Clock, MapPin, Sparkles, User, HeartHandshake, BookOpen } from 'lucide-react';
import { ChurchEvent } from '../../types/database.types';
import { useChurchData } from '../../contexts/ChurchDataContext';

import { useModalFocus } from '../../hooks/useModalFocus';

interface PrintEventFlyerModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: ChurchEvent;
}

export const PrintEventFlyerModal: React.FC<PrintEventFlyerModalProps> = ({
  isOpen,
  onClose,
  event,
}) => {
  const { settings } = useChurchData();

  const panel = useModalFocus(isOpen, onClose);
  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('event-print-open');
    return () => document.body.classList.remove('event-print-open');
  }, [isOpen]);
  if (!isOpen) return null;

  const handlePrint = () => {
    if (event._sync_status !== 'pending') window.print();
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        weekday: 'long', timeZone: 'Africa/Accra',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const status = effectiveEventStatus(event);
  const pending = event._sync_status === 'pending';
  const footer = pending ? 'Awaiting cloud confirmation. Do not circulate this bulletin yet.'
    : status === 'cancelled' ? 'This event has been cancelled. Check with the organizers for updates.'
    : status === 'completed' ? 'This event has ended. This bulletin is kept for reference.'
    : status === 'draft' ? 'Draft program. Details are subject to confirmation.'
    : 'Contact the organizers for admission, transport and other arrangements.';
  const isMultiDay = event.start_date !== event.end_date;

  return createPortal(
    <div data-event-print-root className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div ref={panel} role="dialog" aria-modal="true" aria-label="Event flyer" className="relative w-full min-w-0 max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Screen Header Bar */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-rose-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Program Bulletin & Event Flyer</h2>
              <p className="text-[11px] text-slate-300">Official church print layout ready for congregation & bulletin distribution</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={pending} onClick={handlePrint}
              className="px-3.5 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print Bulletin</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE CANVAS */}
        <div data-event-print-content className="p-6 sm:p-10 overflow-y-auto print:p-0 print:m-0 space-y-6 text-slate-800 bg-white">
          {/* Church Crest & Header */}
          {pending && <p role="status" className="text-center font-bold p-2">{EVENT_SAVE_NOTICE}</p>}
          {['draft','cancelled','completed'].includes(status) && <p className="text-center font-bold uppercase p-2">{status}</p>}
          <div className="text-center pb-5 border-b-2 border-rose-900/20 space-y-1">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-rose-950 text-white font-serif font-black text-xl shadow-md mb-2">
              GW
            </div>
            <h1 className="text-xl sm:text-2xl font-serif font-black tracking-tight text-slate-900 uppercase">
              {settings.church_name || 'Greater Works City Church'}
            </h1>
            <p className="text-xs uppercase tracking-widest font-semibold text-rose-800">
              {settings.tagline || 'Raising Generations of Impact, Dominion & Supernatural Exploits'}
            </p>
            <p className="text-[11px] text-slate-500">
              {settings.address}{settings.gps_address ? ` · Church office GPS: ${settings.gps_address}` : ''}{settings.phone ? ` · Tel: ${settings.phone}` : ''}
            </p>
          </div>

          {/* Program Notice Pill / Header */}
          <div className="text-center space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 inline-block">
              Official Program Announcement · {(event.event_type || 'special').replaceAll('_', ' ').toUpperCase()}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
              {event.title}
            </h2>
          </div>

          {/* Theme Box */}
          {event.theme && (
            <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-50 via-amber-50/60 to-rose-50 rounded-xl border border-rose-200/80 text-center space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-900 block">
                Spiritual Theme
              </span>
              <p className="text-lg sm:text-xl font-serif font-black italic text-rose-950">
                "{event.theme}"
              </p>
              {event.theme_scripture && (
                <p className="text-xs font-bold text-amber-900 flex items-center justify-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 inline text-amber-700" />
                  <span>Scripture Anchor: {event.theme_scripture}</span>
                </p>
              )}
            </div>
          )}

          {/* Key Event Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-start gap-2.5">
              <Calendar className="w-4 h-4 text-rose-700 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold text-slate-900 block">Date & Schedule</span>
                <span className="text-slate-600">
                  {isMultiDay
                    ? `${formatDate(event.start_date)} - ${formatDate(event.end_date)}`
                    : formatDate(event.start_date)}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-rose-700 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold text-slate-900 block">Time</span>
                <span className="text-slate-600 font-mono">
                  {event.start_time} - {event.end_time} GMT
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-rose-700 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold text-slate-900 block">Venue & Assembly</span>
                <span className="text-slate-600">{event.venue}</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <User className="w-4 h-4 text-rose-700 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold text-slate-900 block">Guest Minister / Speaker</span>
                <span className="text-slate-600">{event.speaker || 'To be confirmed'}</span>
              </div>
            </div>
          </div>

          {/* Program Synopsis */}
          {event.description && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Program Synopsis & Order
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line p-3 bg-white rounded-lg border border-slate-100">
                {event.description}
              </p>
            </div>
          )}

          {/* Hosting Ministry & Pastoral Endorsement */}
          <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-semibold text-slate-500 block text-[10px] uppercase">Organizing Ministry</span>
              <span className="font-bold text-slate-800">{event.ministry_name || event.organizer || 'To be confirmed'}</span>
            </div>
            <div className="text-right">
              <span className="font-semibold text-slate-500 block text-[10px] uppercase">Senior Pastor</span>
              <span className="font-bold text-slate-800">{settings.senior_pastor || 'To be confirmed'}</span>
            </div>
          </div>

          {/* Footer Callout */}
          <div className="p-3 bg-rose-950 text-rose-100 rounded-lg text-center text-xs space-y-0.5">
            <p className="font-bold">{footer}</p>
          </div>
        </div>
      </div>
    </div>, document.body
  );
};
