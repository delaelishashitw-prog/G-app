import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  Clock,
  Download,
  Calendar,
  Sparkles,
  X,
  ExternalLink,
  ChevronRight,
  Shield,
  Radio,
  Zap,
} from 'lucide-react';
import { RosterNotification, ConnectionStatus } from '../../hooks/useRealtimeRosterNotifications';

interface RosterNotificationCenterProps {
  notifications: RosterNotification[];
  unreadCount: number;
  status: ConnectionStatus;
  latestAlert: RosterNotification | null;
  onClearLatestAlert: () => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onViewDuty: (dutyId?: string) => void;
  onDownloadDutyPdf: (dutyId?: string) => void;
  onSimulateTestAlert: () => void;
}

export const RosterNotificationCenter: React.FC<RosterNotificationCenterProps> = ({
  notifications,
  unreadCount,
  status,
  latestAlert,
  onClearLatestAlert,
  onMarkAsRead,
  onMarkAllAsRead,
  onViewDuty,
  onDownloadDutyPdf,
  onSimulateTestAlert,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Floating Real-Time Slide-down Alert Banner when latestAlert is triggered */}
      {latestAlert && (
        <div className="fixed top-4 right-4 z-50 max-w-md w-full p-4 bg-linear-to-r from-emerald-950 via-teal-900 to-slate-900 text-white rounded-3xl shadow-2xl border-2 border-emerald-400/40 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-emerald-500/20 text-emerald-300 rounded-2xl border border-emerald-400/30 shrink-0 animate-bounce">
                <Bell className="w-5 h-5 text-amber-300" />
              </span>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
                    Live Duty Alert
                  </span>
                  <span className="text-[11px] text-emerald-200">Just now</span>
                </div>
                <h4 className="font-extrabold text-white text-sm mt-0.5">
                  {latestAlert.roleTitle}
                </h4>
              </div>
            </div>

            <button
              type="button"
              onClick={onClearLatestAlert}
              className="p-1.5 text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
              aria-label="Dismiss alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-teal-100/90 mt-2 leading-relaxed">
            {latestAlert.message}
          </p>

          <div className="mt-2.5 p-2.5 bg-black/30 rounded-2xl border border-white/10 text-xs flex items-center justify-between text-teal-200">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-300" />
              <strong className="text-white">{latestAlert.date}</strong>
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-emerald-300" />
              Report: <strong className="text-amber-300">{latestAlert.reportTime}</strong>
            </span>
          </div>

          <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                onDownloadDutyPdf(latestAlert.dutyId);
                onClearLatestAlert();
              }}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-white/20 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-300" />
              <span>Download Slip (PDF)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onViewDuty(latestAlert.dutyId);
                onClearLatestAlert();
              }}
              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1 cursor-pointer shadow-xs"
            >
              <span>View in Schedule</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Bell Action Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition flex items-center justify-center cursor-pointer shadow-2xs group"
        title="Live Duty Roster Notifications"
        aria-label="Duty Roster Notifications"
      >
        <Bell className="w-5 h-5 text-emerald-100 group-hover:text-white transition" />

        {/* Live WebSocket Connection Indicator Dot */}
        <span
          className={`absolute top-2 right-2 w-2 h-2 rounded-full border border-slate-900 ${
            status === 'connected'
              ? 'bg-emerald-400 animate-pulse'
              : status === 'connecting'
              ? 'bg-amber-400'
              : 'bg-rose-400'
          }`}
          title={`WebSocket Status: ${status}`}
        />

        {/* Unread Counter Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-black shadow-xs animate-bounce">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-3xl bg-white shadow-2xl border border-slate-200 z-50 overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-5 py-4 bg-linear-to-r from-emerald-950 to-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-700/50 rounded-xl text-emerald-200">
                <Bell className="w-4 h-4" />
              </span>
              <div>
                <h4 className="font-extrabold text-sm text-white">Duty Roster Alerts</h4>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-300">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      status === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  />
                  <span>{status === 'connected' ? 'Live WebSocket Active' : 'Connecting...'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllAsRead}
                  className="text-[11px] text-teal-200 hover:text-white underline font-semibold transition cursor-pointer"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 mx-auto flex items-center justify-center">
                  <Sparkles className="w-6 h-6" />
                </div>
                <p className="font-bold text-slate-800 text-xs">No Duty Alerts Yet</p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  You will receive real-time alerts here when the pastoral team assigns or updates your service roster.
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => onMarkAsRead(n.id)}
                  className={`p-4 transition cursor-pointer text-xs space-y-2 hover:bg-slate-50 ${
                    !n.read ? 'bg-emerald-50/60 font-semibold' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          !n.read ? 'bg-emerald-600' : 'bg-transparent'
                        }`}
                      />
                      <span className="font-bold text-slate-900 text-xs">{n.roleTitle}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {n.date}
                    </span>
                  </div>

                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    {n.message}
                  </p>

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-emerald-800 font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3 text-emerald-600" />
                      Report: {n.reportTime}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownloadDutyPdf(n.dutyId);
                        }}
                        className="text-teal-700 hover:text-teal-900 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>PDF</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewDuty(n.dutyId);
                          setIsOpen(false);
                        }}
                        className="text-slate-700 hover:text-slate-900 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <span>View</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer with Simulator Test Button */}
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 text-xs">
            <span className="text-[10px] text-slate-500 flex items-center gap-1">
              <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
              Real-time push enabled
            </span>

            <button
              type="button"
              onClick={onSimulateTestAlert}
              className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg font-bold text-[10px] flex items-center gap-1 transition cursor-pointer border border-amber-300"
              title="Test real-time WebSocket push alert immediately"
            >
              <Zap className="w-3 h-3 text-amber-700" />
              <span>Send Test Duty Alert</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
