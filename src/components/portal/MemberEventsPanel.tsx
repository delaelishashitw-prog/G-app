import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCw,
} from "lucide-react";
import type { ChurchEvent, UserRole } from "../../types/database.types";
import { useMemberEvents } from "../../hooks/useMemberEvents";
import { useToast } from "../../contexts/ToastContext";
import { effectiveEventStatus } from "../../features/events/eventRules";
import {
  hasMemberEventSchedule,
  memberCanRsvp,
  memberEventGroups,
  memberEventSchedule,
  memberEventsFromResponse,
  memberHasRsvp,
  nextMemberEventUpdate,
  type EventMember,
} from "../../features/events/memberEvents";

export function MemberEventsPanel({
  member,
  role,
  churchName,
  previewEvents,
}: {
  member: EventMember;
  role: UserRole;
  churchName: string;
  previewEvents: ChurchEvent[];
}) {
  const isMember = role === "member",
    cloud = useMemberEvents(member, isMember),
    { success } = useToast();
  const [view, setView] = useState<"upcoming" | "history">("upcoming"),
    [now, setNow] = useState(Date.now);
  const preview = useMemo(
    () => (isMember ? [] : memberEventsFromResponse(previewEvents, member)),
    [isMember, previewEvents, member.id, member.member_id],
  );
  const rows = isMember ? cloud.events : preview,
    loaded = !isMember || cloud.loaded,
    loading = isMember && cloud.loading,
    error = isMember ? cloud.error : "",
    busy = Boolean(cloud.savingId),
    stale = Boolean(error) || !cloud.online;
  const groups = useMemo(() => memberEventGroups(rows, now), [rows, now]),
    shown = groups[view];
  useEffect(() => {
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      nextMemberEventUpdate(rows, now),
    );
    return () => window.clearTimeout(timer);
  }, [rows, now]);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    window.addEventListener("focus", tick);
    return () => window.removeEventListener("focus", tick);
  }, []);
  const refresh = () => void cloud.refresh();
  const register = async (id: string) => {
    const saved = await cloud.register(id);
    if (saved)
      success(
        "RSVP Confirmed",
        effectiveEventStatus(saved) === "cancelled"
          ? "This event has been cancelled. Your saved registration remains in history."
          : effectiveEventStatus(saved) === "completed"
            ? "Your registration is recorded in event history."
            : "Your event registration has been saved.",
      );
  };
  return (
    <section aria-labelledby="member-events-heading" className="space-y-5">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="member-events-heading"
              className="flex items-center gap-2 text-xl font-extrabold text-slate-900"
            >
              <Calendar className="h-5 w-5 text-indigo-700" />
              Church Events
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Published programs from {churchName || "your church"}. All
              schedules use Ghana time (GMT).
            </p>
          </div>
          {isMember && (
            <button
              type="button"
              onClick={refresh}
              disabled={loading || busy}
              className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh events
            </button>
          )}
        </div>
        {!isMember && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Staff preview. Member sign-in is required to register.
          </p>
        )}
      </header>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
        >
          <p>{error}</p>
          {loaded && (
            <p className="mt-1">
              Showing the last successfully loaded events. Registration status
              may have changed.
            </p>
          )}
          <button
            type="button"
            disabled={loading || busy}
            onClick={refresh}
            className="mt-2 font-bold underline disabled:opacity-50"
          >
            Retry loading events
          </button>
        </div>
      )}
      {loading && (
        <p role="status" className="text-sm text-slate-600">
          {loaded ? "Refreshing events…" : "Loading events…"}
        </p>
      )}
      {loaded && (
        <>
          <div
            role="group"
            aria-label="Event views"
            className="flex flex-wrap gap-2"
          >
            {(
              [
                { id: "upcoming", label: "Upcoming & ongoing" },
                { id: "history", label: "Past & cancelled" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={view === tab.id}
                onClick={() => setView(tab.id)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${view === tab.id ? "bg-indigo-800 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
              >
                {tab.label} ({groups[tab.id].length})
              </button>
            ))}
          </div>
          {!shown.length ? (
            <div
              role="status"
              className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600"
            >
              {view === "upcoming"
                ? "No upcoming or ongoing events are published right now."
                : "No past or cancelled events are published."}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {shown.map((event) => {
                const lifecycle = effectiveEventStatus(event, now),
                  registered = memberHasRsvp(event, member),
                  scheduled = hasMemberEventSchedule(event),
                  closed = ["completed", "cancelled"].includes(lifecycle),
                  canRegister = memberCanRsvp(event, now);
                const status =
                  lifecycle === "cancelled"
                    ? "Cancelled"
                    : lifecycle === "completed"
                      ? "Ended"
                      : !scheduled
                        ? "Schedule to be confirmed"
                        : lifecycle === "ongoing"
                          ? "Ongoing"
                          : "Upcoming";
                return (
                  <article
                    key={event.id}
                    aria-label={event.title}
                    className="min-w-0 space-y-3 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold capitalize text-indigo-800">
                        {(event.event_type || "special").replaceAll("_", " ")}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${lifecycle === "cancelled" ? "bg-red-100 text-red-800" : lifecycle === "completed" ? "bg-slate-100 text-slate-700" : lifecycle === "ongoing" ? "bg-emerald-100 text-emerald-800" : "bg-indigo-50 text-indigo-800"}`}
                      >
                        {status}
                      </span>
                    </div>
                    <h3 className="break-words text-base font-extrabold text-slate-900">
                      {event.title}
                    </h3>
                    {event.description && (
                      <p className="whitespace-pre-wrap break-words text-sm text-slate-600">
                        {event.description}
                      </p>
                    )}
                    <div className="space-y-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
                      <p className="flex items-start gap-2">
                        <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{memberEventSchedule(event)}</span>
                      </p>
                      <p className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                        <span className="break-words">
                          {event.venue || "Venue to be announced"}
                        </span>
                      </p>
                    </div>
                    {cloud.rsvpErrors[event.id] && (
                      <p role="alert" className="text-sm text-red-700">
                        {cloud.rsvpErrors[event.id]}
                      </p>
                    )}
                    {registered ? (
                      <p
                        className={`flex items-start gap-2 rounded-xl border p-3 text-sm font-semibold ${lifecycle === "cancelled" ? "border-red-200 bg-red-50 text-red-800" : stale && isMember ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                          {lifecycle === "cancelled"
                            ? "Event cancelled — registration kept for reference"
                            : lifecycle === "completed"
                              ? "Registration recorded — event ended"
                              : stale && isMember
                                ? "Registration previously recorded — refresh to confirm its current status"
                                : "RSVP Confirmed (See You There!)"}
                        </span>
                      </p>
                    ) : (
                      <button
                        type="button"
                        disabled={
                          !isMember || loading || busy || stale || !canRegister
                        }
                        onClick={() => void register(event.id)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-800 px-3 py-2.5 text-sm font-bold text-white enabled:hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-500"
                      >
                        <CalendarCheck className="h-4 w-4 shrink-0" />
                        {cloud.savingId === event.id
                          ? "Saving registration…"
                          : !isMember
                            ? "Member sign-in required to register"
                            : closed
                              ? lifecycle === "cancelled"
                                ? "Event cancelled"
                                : "Registration closed"
                              : !scheduled
                                ? "Schedule to be confirmed"
                                : !event.requires_registration
                                  ? "RSVP not enabled"
                                  : "1-Click RSVP for Event"}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
