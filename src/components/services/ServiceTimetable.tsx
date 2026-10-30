import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { useAuth } from '../../contexts/AuthContext';
import { SERVICE_DAYS, serviceOccurrence, serviceScheduleLabel, upcomingService } from '../../features/services/serviceSchedule';

const dateFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Accra', weekday: 'long', day: 'numeric', month: 'short' });
const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Accra', hour: '2-digit', minute: '2-digit', hour12: false });

/** Both views use the same saved services as attendance, rosters and bulletins. */
export const ServiceTimetable: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { services, supabaseStatus, supabaseError, isRefreshing, refreshData } = useChurchData();
  const { canAccess } = useAuth();
  const [now, setNow] = useState(() => new Date());
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const reconnect = () => { setOnline(true); void refreshData(); };
    const offline = () => setOnline(false);
    const focus = () => {
      setNow(new Date());
      setOnline(navigator.onLine);
      if (compact && navigator.onLine) void refreshData();
    };
    const timer = compact ? setInterval(() => setNow(new Date()), 30000) : undefined;
    window.addEventListener('online', reconnect);
    window.addEventListener('offline', offline);
    window.addEventListener('focus', focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', reconnect);
      window.removeEventListener('offline', offline);
      window.removeEventListener('focus', focus);
    };
  }, [compact, refreshData]);

  const loading = isRefreshing || supabaseStatus === 'syncing';
  const unavailable = !online || supabaseStatus === 'disconnected' || /(?:^|;\s*)services:/.test(supabaseError || '');
  const activeServices = services.filter(service => service.is_active).sort((a, b) =>
    SERVICE_DAYS.indexOf(a.day_of_week) - SERVICE_DAYS.indexOf(b.day_of_week)
    || a.start_time.localeCompare(b.start_time) || a.id.localeCompare(b.id));
  const next = upcomingService(activeServices, now);
  const emptyMessage = loading ? 'Loading service timetable…' : unavailable
    ? 'Service timetable unavailable. Refresh or contact the church office.'
    : 'No active services are scheduled. Please contact the church office.';
  const notice = unavailable ? 'Saved timetable — refresh to confirm current times.'
    : loading ? 'Checking for timetable updates…' : '';
  const refreshButton = (
    <button type="button" onClick={() => void refreshData()} disabled={loading || !online}
      aria-label="Refresh service timetable"
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold disabled:opacity-50 ${compact ? 'text-emerald-100 hover:bg-white/10' : 'text-emerald-800 hover:bg-emerald-50'}`}>
      <RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 ${loading ? 'animate-spin' : ''}`} />
      Refresh timetable
    </button>
  );

  if (compact) return (
    <section aria-label="Next church gathering" className="min-w-0 space-y-1">
      <div role="status" aria-live="polite" aria-atomic="true" className="break-words">
        {next ? <>
          <span>{next.isLive ? 'Gathering in progress: ' : 'Next Gathering: '}</span>
          <strong>{next.service.name}</strong>
          <span className="block text-emerald-100">
            <time dateTime={next.start.toISOString()}>{dateFormat.format(next.start)} · {timeFormat.format(next.start)}</time>
            {' – '}
            <time dateTime={next.end.toISOString()}>{next.end.toISOString().slice(0, 10) !== next.occurrenceDate ? `${dateFormat.format(next.end)} · ` : ''}{timeFormat.format(next.end)}</time>
            {' GMT'}
          </span>
          {next.service.venue && <span className="block text-emerald-100">{next.service.venue}</span>}
          {notice && <span className="block text-amber-200">{notice}</span>}
        </> : emptyMessage}
      </div>
      {refreshButton}
    </section>
  );

  return (
    <section aria-label="Weekly service timetable" className="space-y-4 text-xs">
      <p className="text-slate-600">These are the shared service records used by the member portal, attendance, duty rosters and service bulletins. All times are in Ghana time (GMT).</p>
      <div role="status" aria-live="polite">
        {activeServices.length ? notice : emptyMessage}
      </div>
      <ul className="space-y-3">
        {activeServices.map(service => <li key={service.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1 break-words">
          <h3 className="font-bold text-slate-900">{service.name}</h3>
          <p className="font-semibold text-slate-700">{serviceOccurrence(service, now) ? serviceScheduleLabel(service) : 'Schedule needs review.'}</p>
          {service.venue && <p className="text-slate-500">{service.venue}</p>}
        </li>)}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        {canAccess('services') && <Link to="/services" className="rounded-xl bg-emerald-900 px-4 py-2.5 font-bold text-white hover:bg-emerald-800">Manage service timetable</Link>}
        {refreshButton}
      </div>
      <p className="border-t border-slate-100 pt-3 text-slate-600">
        Cell fellowship meeting times are managed for each group in{' '}
        {canAccess('small_groups') ? <Link to="/small-groups" className="font-semibold text-emerald-800 underline">Small Groups</Link> : 'Small Groups'}.
      </p>
    </section>
  );
};
