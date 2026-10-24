import test from "node:test";
import assert from "node:assert/strict";
import {
  memberEventsFromResponse,
  memberHasRsvp,
  memberCanRsvp,
  memberEventGroups,
  memberEventSchedule,
  nextMemberEventUpdate,
} from "../src/features/events/memberEvents.ts";
const member = { id: "own-member", member_id: "GWCC-OWN" };
const event = {
  id: "upcoming",
  title: "Synthetic event",
  event_type: "conference",
  start_date: "2026-10-24",
  end_date: "2026-10-24",
  start_time: "09:00",
  end_time: "12:00",
  status: "upcoming",
  venue: "Synthetic venue",
  requires_registration: true,
  attendees: [],
};
const instant = (time) => Date.parse(`2026-10-24T${time}:00Z`);
test("member events separate current programs from ended and cancelled history at Ghana schedule boundaries", () => {
  const rows = [
    { ...event, id: "later", start_time: "13:00", end_time: "14:00" },
    { ...event, id: "cancelled", status: "cancelled" },
    { ...event, id: "past", start_date: "2026-10-23", end_date: "2026-10-23" },
    { ...event, id: "draft", status: "draft" },
    { ...event, id: "pending", _sync_status: "pending" },
    event,
  ];
  const groups = memberEventGroups(rows, instant("10:00"));
  assert.deepEqual(
    groups.upcoming.map((e) => e.id),
    ["upcoming", "later"],
  );
  assert.deepEqual(
    groups.history.map((e) => e.id),
    ["cancelled", "past"],
  );
  assert.equal(memberCanRsvp(event, instant("11:59")), true);
  assert.equal(memberCanRsvp(event, instant("12:00")), false);
  assert.deepEqual(memberEventGroups([event], instant("12:00")).upcoming, []);
  assert.equal(nextMemberEventUpdate([event], instant("11:59") + 59000), 1025);
});
test("member projection retains only exact own identity and published metadata, and refreshed removals clear confirmation", () => {
  const payload = {
    ...event,
    budget: 1000,
    organizer: "Private organizer note",
    attendees: [
      {
        id: "own",
        member_id: "GWCC-OWN",
        registered_at: "2026-10-01",
        checked_in: false,
        name: "Own Name",
        phone: "0240000000",
      },
      {
        id: "other",
        member_id: "someone-else",
        name: "Own Name",
        phone: "0240000001",
        email: "private@example.test",
      },
    ],
  };
  const [safe] = memberEventsFromResponse([payload], member);
  assert.equal(memberHasRsvp(safe, member), true);
  assert.equal(safe.attendees.length, 1);
  assert.doesNotMatch(
    JSON.stringify(safe),
    /budget|organizer|phone|email|someone-else|Own Name/,
  );
  const [refreshed] = memberEventsFromResponse(
    [{ ...payload, attendees: [] }],
    member,
  );
  assert.equal(memberHasRsvp(refreshed, member), false);
  assert.deepEqual(
    memberEventsFromResponse(
      [
        { ...payload, status: "draft" },
        { ...payload, _sync_status: "pending" },
      ],
      member,
    ),
    [],
  );
  assert.throws(() => memberEventsFromResponse(null, member));
  assert.throws(() => memberEventsFromResponse([payload, payload], member));
  assert.equal(
    memberHasRsvp(
      { ...event, attendees: [{ member_id: "" }] },
      { id: "own", member_id: "" },
    ),
    false,
  );
});
test("member schedules include full overnight and multi-day ranges in Ghana time without inventing missing details", () => {
  const schedule = memberEventSchedule({
    ...event,
    start_date: "2026-12-31",
    end_date: "2027-01-01",
    start_time: "20:30",
    end_time: "02:30",
  });
  assert.equal(
    schedule,
    "31 Dec 2026, 20:30 – 01 Jan 2027, 02:30 (Ghana time · GMT)",
  );
  assert.equal(
    memberEventSchedule(event),
    "24 Oct 2026 · 09:00–12:00 (Ghana time · GMT)",
  );
  const missing = {
    ...event,
    start_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
  };
  assert.match(memberEventSchedule(missing), /Date to be announced/);
  assert.doesNotMatch(memberEventSchedule(missing), /18:30|Cathedral/);
  assert.equal(memberCanRsvp(missing, instant("10:00")), false);
  for (const changes of [
    { start_date: "2026-02-30" },
    { end_time: "08:00" },
    { start_time: "25:00" },
    { requires_registration: false },
    { status: "cancelled" },
  ])
    assert.equal(
      memberCanRsvp({ ...event, ...changes }, instant("10:00")),
      false,
    );
});
