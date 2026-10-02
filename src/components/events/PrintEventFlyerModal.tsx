import React from 'react';
import { X, Printer, Calendar, Clock, MapPin, Sparkles, User, HeartHandshake, BookOpen } from 'lucide-react';
import { ChurchEvent } from '../../types/database.types';
import { useChurchData } from '../../contexts/ChurchDataContext';

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

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const isMultiDay = event.start_date !== event.end_date;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
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
              onClick={handlePrint}
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
        <div className="p-6 sm:p-10 overflow-y-auto print:p-0 print:m-0 space-y-6 text-slate-800 bg-white">
          {/* Church Crest & Header */}
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
              {settings.address || 'Joma, Ga South Municipal, Greater Accra'} · GPS: GA-184-2900 · Tel: {settings.phone || '+233 24 400 0000'}
            </p>
          </div>

          {/* Program Notice Pill / Header */}
          <div className="text-center space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 inline-block">
              Official Program Announcement · {event.event_type.replace('_', ' ').toUpperCase()}
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
                <span className="text-slate-600">{event.speaker || 'Pastoral Ministerial Team'}</span>
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
              <span className="font-bold text-slate-800">{event.ministry_name || event.organizer || 'Pastoral Board'}</span>
            </div>
            <div className="text-right">
              <span className="font-semibold text-slate-500 block text-[10px] uppercase">General Overseer / Presiding Minister</span>
              <span className="font-bold text-slate-800">Prophet Elisha K. Richard</span>
            </div>
          </div>

          {/* Footer Callout */}
          <div className="p-3 bg-rose-950 text-rose-100 rounded-lg text-center text-xs space-y-0.5">
            <p className="font-bold">All church members, families, cell fellowships, and the entire Joma municipality are cordially invited.</p>
            <p className="text-[11px] text-rose-300">Admission is Free · Free Transportation available at designated cell stations</p>
          </div>
        </div>
      </div>
    </div>
  );
};
