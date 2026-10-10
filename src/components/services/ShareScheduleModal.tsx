import React, { useState } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Calendar,
  Send,
  Download,
  Printer,
  Sparkles,
  MapPin,
  Clock,
  Phone,
} from 'lucide-react';
import { ChurchService, ChurchSettings } from '../../types/database.types';
import { useToast } from '../../contexts/ToastContext';
import { downloadServicesIcs } from './serviceCalendarExport';

interface ShareScheduleModalProps {
  services: ChurchService[];
  settings: ChurchSettings;
  onClose: () => void;
}

export const ShareScheduleModal: React.FC<ShareScheduleModalProps> = ({
  services,
  settings,
  onClose,
}) => {
  const { success } = useToast();
  const [copied, setCopied] = useState(false);

  const activeServices = services.filter((s) => s.is_active);

  const churchName = settings.church_name || 'GREATER WORKS CITY CHURCH';
  const branchName = settings.branch_name || 'Joma Assembly (City of Refuge)';
  const address = settings.address || 'Joma, near Ablekuma / Anyaa, Greater Accra';
  const churchPhone = settings.phone || '+233 24 000 0000';

  // Format WhatsApp broadcast message
  const broadcastText = `🕊️ *${churchName.toUpperCase()}*
📍 *${branchName}*
━━━━━━━━━━━━━━━━━━━━
*WEEKLY WORSHIP & MINISTRATION SCHEDULE*

${activeServices
  .map(
    (s, idx) =>
      `*${idx + 1}. ${s.name.toUpperCase()}*
🗓️ Every *${s.day_of_week}*
⏰ ${s.start_time} - ${s.end_time} GMT
🎙️ Ministering: ${s.preacher || 'Prophet Elisha K. Richard'}
🏛️ Venue: ${s.venue || 'Main Sanctuary, Joma'}
${s.description ? `_${s.description}_\n` : ''}`
  )
  .join('\n')}
━━━━━━━━━━━━━━━━━━━━
📍 *Sanctuary Location:* ${address}
📞 *Enquiries & Pastoral Care:* ${churchPhone}

_"I was glad when they said unto me, Let us go into the house of the LORD." — Psalm 122:1_
All are cordially welcome to fellowship with us in faith, signs and wonders!`;

  const handleCopy = () => {
    navigator.clipboard.writeText(broadcastText);
    setCopied(true);
    success('Schedule Copied', 'Formatted weekly worship schedule copied to clipboard.');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadCalendar = () => {
    downloadServicesIcs(activeServices, churchName);
    success('Calendar Exported', 'Worship schedule .ics file downloaded.');
  };

  const handlePrint = () => {
    window.print();
  };

  const waShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(broadcastText)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0e1726] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-4 max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-[#064e3b] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-emerald-700/60 rounded-xl">
              <Share2 className="w-5 h-5 text-emerald-200" />
            </span>
            <div>
              <h3 className="text-base font-bold">Share & Export Weekly Worship Schedule</h3>
              <p className="text-xs text-emerald-200">
                Generate announcements for WhatsApp or export to Google/Apple Calendar
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-lg transition hover:bg-emerald-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Buttons Bar */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopy}
              className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:border-emerald-300 dark:hover:border-emerald-700 text-slate-700 dark:text-slate-300 hover:text-emerald-900 dark:hover:text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy for WhatsApp'}</span>
            </button>

            <a
              href={waShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Share to WhatsApp</span>
            </a>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCalendar}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              title="Download iCal format for Google Calendar, Apple Calendar, Outlook"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Calendar (.ics)</span>
            </button>

            <button
              onClick={handlePrint}
              className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
              title="Print Timetable"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Preview of Formatted Message */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs font-mono">
          <div className="p-4 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 whitespace-pre-wrap text-slate-800 dark:text-slate-200 leading-relaxed shadow-inner select-all">
            {broadcastText}
          </div>
        </div>
      </div>
    </div>
  );
};
