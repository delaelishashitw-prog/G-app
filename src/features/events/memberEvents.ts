import type { ChurchEvent, Member } from "../../types/database.types";
import {
  canMemberRsvp,
  effectiveEventStatus,
  eventInstant,
} from "./eventRules";

export type EventMember = Pick<Member, "id" | "member_id">;
function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
const publishedStatuses = new Set([
  "upcoming",
  "ongoing",
  "completed",
  "cancelled",
]);
const eventFields = [
  "id",
  "title",
  "description",
  "theme",
  "theme_scripture",
  "event_type",
  "start_date",
  "end_date",
  "start_time",
  "end_time",
  "venue",
  "speaker",
  "status",
  "created_at",
  "updated_at",
] as const;

/** Keep only published event information and this member's own registration. */
export function memberEventsFromResponse(
  data: unknown,
  member: EventMember,
): ChurchEvent[] {
  if (!Array.isArray(data))
    throw new Error("The event response could not be verified.");
  const ids = new Set<string>();
  return data.flatMap((value: unknown) => {
    if (
      !isObject(value) ||
      typeof value.id !== "string" ||
      typeof value.title !== "string"
    )
      throw new Error("The event response could not be verified.");
    if (
      !publishedStatuses.has(String(value.status)) ||
      value._sync_status === "pending"
    )
      return [];
    if (ids.has(value.id))
      throw new Error("The event response could not be verified.");
    ids.add(value.id);
    const projected: Record<string, unknown> = {};
    for (const field of eventFields)
      if (typeof value[field] === "string") projected[field] = value[field];
    const attendees: unknown[] = Array.isArray(value.attendees)
      ? value.attendees
      : [];
    return [
      {
        ...projected,
        requires_registration: value.requires_registration === true,
        attendees: attendees
          .filter(
            (person): person is Record<string, unknown> =>
              isObject(person) &&
              (person.member_id === member.id ||
                (Boolean(member.member_id) &&
                  person.member_id === member.member_id)),
          )
          .map((person) => ({
            id: typeof person.id === "string" ? person.id : "",
            member_id: person.member_id,
            name: "",
            registered_at:
              typeof person.registered_at === "string"
                ? person.registered_at
                : "",
            checked_in: person.checked_in === true,
          })),
      } as unknown as ChurchEvent,
    ];
  });
}
export function memberHasRsvp(
  event: ChurchEvent,
  member: EventMember,
): boolean {
  return Boolean(
    event.attendees?.some(
      (person) =>
        person.member_id === member.id ||
        (Boolean(member.member_id) && person.member_id === member.member_id),
    ),
  );
}
function validDate(date: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date || "") &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date
  );
}
function validTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d(:00)?$/.test(time || "");
}
export function hasMemberEventSchedule(event: ChurchEvent): boolean {
  return (
    validDate(event.start_date) &&
    validDate(event.end_date) &&
    validTime(event.start_time) &&
    validTime(event.end_time) &&
    eventInstant(event.end_date, event.end_time) >
      eventInstant(event.start_date, event.start_time)
  );
}
export function memberCanRsvp(event: ChurchEvent, now = Date.now()): boolean {
  return hasMemberEventSchedule(event) && canMemberRsvp(event, now);
}
export function memberEventGroups(events: ChurchEvent[], now = Date.now()) {
  const published = events.filter(
    (event) =>
      publishedStatuses.has(event.status) && event._sync_status !== "pending",
  );
  const upcoming = published.filter((event) =>
    ["upcoming", "ongoing"].includes(effectiveEventStatus(event, now)),
  );
  const history = published.filter((event) =>
    ["completed", "cancelled"].includes(effectiveEventStatus(event, now)),
  );
  const starts = (event: ChurchEvent) =>
    eventInstant(event.start_date, event.start_time);
  upcoming.sort(
    (a, b) =>
      (Number.isFinite(starts(a)) ? starts(a) : Infinity) -
        (Number.isFinite(starts(b)) ? starts(b) : Infinity) ||
      a.id.localeCompare(b.id),
  );
  history.sort(
    (a, b) =>
      (Number.isFinite(starts(b)) ? starts(b) : 0) -
        (Number.isFinite(starts(a)) ? starts(a) : 0) ||
      a.id.localeCompare(b.id),
  );
  return { upcoming, history };
}
const ghanaDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Accra",
  day: "2-digit",
  month: "short",
  year: "numeric",
});
export function memberEventSchedule(event: ChurchEvent): string {
  const start = validDate(event.start_date)
    ? ghanaDate.format(new Date(event.start_date + "T00:00:00Z"))
    : "Date to be announced";
  const end = validDate(event.end_date)
    ? ghanaDate.format(new Date(event.end_date + "T00:00:00Z"))
    : "End date to be announced";
  const startTime = validTime(event.start_time)
    ? event.start_time.slice(0, 5)
    : "Start time to be announced";
  const endTime = validTime(event.end_time)
    ? event.end_time.slice(0, 5)
    : "End time to be announced";
  return event.start_date === event.end_date
    ? `${start} · ${startTime}–${endTime} (Ghana time · GMT)`
    : `${start}, ${startTime} – ${end}, ${endTime} (Ghana time · GMT)`;
}
/** Update at the next start/end boundary, including multi-day and overnight events. */
export function nextMemberEventUpdate(
  events: ChurchEvent[],
  now: number,
): number {
  const boundaries = events
    .flatMap((event) => [
      eventInstant(event.start_date, event.start_time),
      eventInstant(event.end_date, event.end_time),
    ])
    .filter((time) => Number.isFinite(time) && time > now);
  return Math.max(
    50,
    Math.min(30000, ...boundaries.map((time) => time - now + 25)),
  );
}
