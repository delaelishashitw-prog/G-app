import { useCallback, useEffect, useRef, useState } from "react";
import type { ChurchEvent } from "../types/database.types";
import { getSupabaseClient } from "../lib/supabase";
import {
  memberEventsFromResponse,
  memberHasRsvp,
  memberCanRsvp,
  type EventMember,
} from "../features/events/memberEvents";

const offlineMessage =
  "You’re offline. Connect to refresh events and confirm registration status.";
const loadMessage =
  "Events could not be refreshed. Check your connection and try again.";
export function useMemberEvents(member: EventMember, enabled: boolean) {
  const [events, setEvents] = useState<ChurchEvent[]>([]),
    [loaded, setLoaded] = useState(false),
    [loading, setLoading] = useState(enabled),
    [error, setError] = useState("");
  const [online, setOnline] = useState(() => navigator.onLine),
    [savingId, setSavingId] = useState<string | null>(null),
    [rsvpErrors, setRsvpErrors] = useState<Record<string, string>>({});
  const alive = useRef(false),
    reading = useRef<Promise<boolean> | null>(null),
    readSequence = useRef(0),
    saving = useRef(false),
    controllers = useRef(new Set<AbortController>()),
    latest = useRef(events);
  latest.current = events;
  const refresh = useCallback(async (): Promise<boolean> => {
    if (!enabled || !alive.current || saving.current) return false;
    if (reading.current) return reading.current;
    if (!navigator.onLine) {
      setOnline(false);
      setError(offlineMessage);
      setLoading(false);
      return false;
    }
    const ticket = ++readSequence.current;
    setOnline(true);
    setLoading(true);
    const controller = new AbortController();
    controllers.current.add(controller);
    const timer = setTimeout(() => controller.abort(), 15000);
    const task = (async () => {
      try {
        const client = getSupabaseClient();
        if (!client) throw new Error("Member sign-in is unavailable.");
        const { data, error } = await client
          .rpc("gwcc_member_events")
          .abortSignal(controller.signal);
        if (error) throw error;
        const rows = memberEventsFromResponse(data, member);
        if (!alive.current || ticket !== readSequence.current) return false;
        latest.current = rows;
        setEvents(rows);
        setLoaded(true);
        setOnline(navigator.onLine);
        setError(navigator.onLine ? "" : offlineMessage);
        setRsvpErrors((previous) =>
          Object.fromEntries(
            Object.entries(previous).filter(
              ([id]) =>
                !rows.some(
                  (row) => row.id === id && memberHasRsvp(row, member),
                ),
            ),
          ),
        );
        return true;
      } catch {
        if (alive.current && ticket === readSequence.current)
          setError(navigator.onLine ? loadMessage : offlineMessage);
        return false;
      } finally {
        clearTimeout(timer);
        controllers.current.delete(controller);
        if (alive.current && ticket === readSequence.current) setLoading(false);
      }
    })();
    reading.current = task;
    try {
      return await task;
    } finally {
      if (reading.current === task) reading.current = null;
    }
  }, [enabled, member.id, member.member_id]);
  useEffect(() => {
    alive.current = true;
    if (!enabled)
      return () => {
        alive.current = false;
      };
    void refresh();
    const reload = () => {
      if (document.visibilityState !== "hidden") void refresh();
    };
    const offline = () => {
      setOnline(false);
      setError(offlineMessage);
    };
    window.addEventListener("focus", reload);
    window.addEventListener("online", reload);
    window.addEventListener("offline", offline);
    window.addEventListener("gwcc-reload-cloud", reload);
    document.addEventListener("visibilitychange", reload);
    const timer = window.setInterval(reload, 60000);
    return () => {
      alive.current = false;
      ++readSequence.current;
      reading.current = null;
      window.clearInterval(timer);
      for (const controller of controllers.current) controller.abort();
      controllers.current.clear();
      window.removeEventListener("focus", reload);
      window.removeEventListener("online", reload);
      window.removeEventListener("offline", offline);
      window.removeEventListener("gwcc-reload-cloud", reload);
      document.removeEventListener("visibilitychange", reload);
    };
  }, [enabled, refresh]);
  const register = useCallback(
    async (eventId: string): Promise<ChurchEvent | null> => {
      if (!enabled || !alive.current || saving.current || reading.current)
        return null;
      const event = latest.current.find((row) => row.id === eventId);
      if (!event || !navigator.onLine || !memberCanRsvp(event)) return null;
      saving.current = true;
      setSavingId(eventId);
      setRsvpErrors((previous) => ({ ...previous, [eventId]: "" }));
      const controller = new AbortController();
      controllers.current.add(controller);
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const client = getSupabaseClient();
        if (!client) throw new Error("Member sign-in is unavailable.");
        const { data, error } = await client
          .rpc("gwcc_member_rsvp", { p_event_id: eventId })
          .abortSignal(controller.signal);
        if (error) throw error;
        const [saved] = memberEventsFromResponse([data], member);
        if (!saved || saved.id !== eventId || !memberHasRsvp(saved, member))
          throw new Error("Registration was not confirmed.");
        if (!alive.current) return null;
        const rows = [
          saved,
          ...latest.current.filter((row) => row.id !== eventId),
        ];
        latest.current = rows;
        setEvents(rows);
        return saved;
      } catch {
        if (alive.current)
          setRsvpErrors((previous) => ({
            ...previous,
            [eventId]:
              "Registration could not be confirmed. Try again to check its status; retries do not create a duplicate.",
          }));
        return null;
      } finally {
        clearTimeout(timer);
        controllers.current.delete(controller);
        saving.current = false;
        if (alive.current) setSavingId(null);
      }
    },
    [enabled, member.id, member.member_id],
  );
  return {
    events,
    loaded,
    loading,
    error,
    online,
    savingId,
    rsvpErrors,
    refresh,
    register,
  };
}
