import React, { useState, useMemo } from 'react';
import {
  X,
  Send,
  Users,
  Calendar,
  CheckCircle2,
  Copy,
  Check,
  Phone,
  MessageSquare,
  Clock,
  Sparkles,
} from 'lucide-react';
import { RosterAssignment, ChurchSettings } from '../../types/database.types';
import { cleanGhanaPhone } from '../../lib/currencyUtils';
import { useToast } from '../../contexts/ToastContext';

interface BroadcastRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignments: RosterAssignment[];
  settings: ChurchSettings;
  targetDate?: string;
  onUpdateStatus?: (assignmentId: string, status: any) => void;
  onBatchConfirm?: (assignmentIds: string[]) => void;
}

export const BroadcastRosterModal: React.FC<BroadcastRosterModalProps> = ({
  isOpen,
  onClose,
  assignments,
  settings,
  targetDate,
  onUpdateStatus,
  onBatchConfirm,
}) => {
  const { success, info } = useToast();
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Available dates in assignments
  const dates = useMemo(() => {
    return Array.from(new Set(assignments.map((a) => a.date))).sort().reverse();
  }, [assignments]);

  const [selectedDate, setSelectedDate] = useState<string>(targetDate && targetDate !== 'ALL' ? targetDate : (dates[0] || ''));

  const dateAssignments = useMemo(() => {
    if (!selectedDate) return assignments;
    return assignments.filter((a) => a.date === selectedDate);
  }, [assignments, selectedDate]);

  const pendingCount = dateAssignments.filter((a) => a.status === 'pending').length;
  const confirmedCount = dateAssignments.filter((a) => a.status === 'confirmed').length;

  // Generate complete group broadcast message
  const groupSummaryText = useMemo(() => {
    const churchName = settings.church_name || 'GREATER WORKS CITY CHURCH';
    const lines = [
      `🕊️ *${churchName.toUpperCase()} — DUTY ROSTER NOTICE*`,
      `📅 *Date:* ${selectedDate || 'Upcoming Service'}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Calvary greetings beloved ministers and stewards! Below is the roster of assigned workers on duty:`,
      '',
    ];

    // Group by department
    const depts = Array.from(new Set(dateAssignments.map((a) => a.department)));
    depts.forEach((dept) => {
      const items = dateAssignments.filter((a) => a.department === dept);
      lines.push(`🏛️ *${dept.toUpperCase().replace('_', ' ')}:*`);
      items.forEach((item) => {
        let entry = `• *${item.member_name}* — ${item.role_title} (Call Time: ${item.report_time}) [${item.status.toUpperCase()}]`;
        if (item.announcement) {
          entry += `\n  📢 *Notice:* ${item.announcement}`;
        }
        lines.push(entry);
      });
      lines.push('');
    });

    // Check for distinct announcements across assignments
    const distinctAnnouncements = Array.from(
      new Set(dateAssignments.map((a) => a.announcement).filter(Boolean))
    ) as string[];

    if (distinctAnnouncements.length > 0) {
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`📢 *OFFICIAL SERVICE ANNOUNCEMENTS & NOTICES:*`);
      distinctAnnouncements.forEach((ann) => {
        lines.push(`• ${ann}`);
      });
      lines.push('');
    }

    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`⚠️ *Reminder:* Pre-service prayer and setup begins promptly. Please be in place at your designated call time.`);
    lines.push(`God bless your diligent service in His kingdom!`);

    return lines.join('\n');
  }, [dateAssignments, selectedDate, settings]);

  const handleCopySummary = () => {
    navigator.clipboard.writeText(groupSummaryText);
    setCopiedSummary(true);
    success('Roster Summary Copied', 'Group announcement copied for WhatsApp.');
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  const handleConfirmAllPending = () => {
    const pendingIds = dateAssignments.filter((a) => a.status === 'pending').map((a) => a.id);
    if (pendingIds.length === 0) {
      info('No Pending Stewards', 'All assignments for this date are already confirmed.');
      return;
    }
    if (onBatchConfirm) {
      onBatchConfirm(pendingIds);
    } else if (onUpdateStatus) {
      pendingIds.forEach((id) => onUpdateStatus(id, 'confirmed'));
    }
    success('Assignments Confirmed', `Marked ${pendingIds.length} volunteer assignments as confirmed.`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white dark:bg-[#0e1726] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-4 max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-[#064e3b] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-emerald-700/60 rounded-xl">
              <MessageSquare className="w-5 h-5 text-emerald-200" />
            </span>
            <div>
              <h3 className="text-base font-bold">Duty Roster WhatsApp Broadcast Hub</h3>
              <p className="text-xs text-emerald-200">
                Send personal reminders or broadcast the full schedule to church groups
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

        {/* Date Selector & Top Metrics */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Service Date:</span>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold"
            >
              {dates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
              {confirmedCount} Confirmed
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
              {pendingCount} Pending
            </span>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="p-4 bg-white dark:bg-[#0e1726] border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
          <button
            onClick={handleCopySummary}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            <span>{copiedSummary ? 'Copied Group Notice' : 'Copy Group Roster Message'}</span>
          </button>

          {pendingCount > 0 && (
            <button
              onClick={handleConfirmAllPending}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Confirm All ({pendingCount}) Pending</span>
            </button>
          )}
        </div>

        {/* Stewards List with 1-click personal WhatsApp */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Individual Volunteer Reminder Links ({dateAssignments.length} Stewards)
          </h4>

          {dateAssignments.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No volunteers assigned for this date.
            </div>
          ) : (
            dateAssignments.map((asgn) => {
              const waPhone = cleanGhanaPhone(asgn.member_phone);
              const waMessage = `Calvary greetings ${asgn.member_name}! You are scheduled on ministerial duty at Greater Works City Church as [${asgn.role_title}] for ${asgn.service_name} on ${asgn.date}. Call time is ${asgn.report_time}. Pre-service prayer begins promptly. Please reply to confirm availability. God bless you!`;
              const waLink = `https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}`;

              return (
                <div
                  key={asgn.id}
                  className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {asgn.member_name}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-0.2 rounded-full">
                        {asgn.department.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold">
                      {asgn.role_title} • Call Time: <strong className="font-mono">{asgn.report_time}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        asgn.status === 'confirmed'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                      }`}
                    >
                      {asgn.status}
                    </span>

                    {waPhone ? (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[10px] flex items-center gap-1 transition shadow-xs"
                      >
                        <Send className="w-3 h-3" />
                        <span>Send Reminder</span>
                      </a>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">No Phone</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
