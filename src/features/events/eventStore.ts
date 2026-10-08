import type { Dispatch, SetStateAction } from 'react';
import type { ChurchEvent } from '../../types/database.types';

export function createEvent(
  data: Omit<ChurchEvent, 'id'>,
  setEvents: Dispatch<SetStateAction<ChurchEvent[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
): ChurchEvent {
  const now = new Date().toISOString();
  const newEvent: ChurchEvent = {
    ...data,
    id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    created_at: data.created_at || now,
    updated_at: data.updated_at || now,
  };

  setEvents((prev) => [newEvent, ...prev]);
  logAction('CREATE_EVENT', 'Events', `Scheduled event "${newEvent.title}"`, newEvent.id);
  dbSyncUpsert('events', newEvent);
  return newEvent;
}

export function updateEvent(
  id: string,
  updates: Partial<ChurchEvent>,
  setEvents: Dispatch<SetStateAction<ChurchEvent[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  const now = new Date().toISOString();
  setEvents((prev) =>
    prev.map((event) => {
      if (event.id === id) {
        const updated = {
          ...event,
          ...updates,
          created_at: event.created_at || now,
          updated_at: now,
        };
        logAction('UPDATE_EVENT', 'Events', `Updated event details for ${updated.title}`, id);
        dbSyncUpsert('events', updated);
        return updated;
      }
      return event;
    })
  );
}

export function deleteEvent(
  id: string,
  events: ChurchEvent[],
  setEvents: Dispatch<SetStateAction<ChurchEvent[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncDelete: (table: string, id: string) => void
) {
  const toDelete = events.find((event) => event.id === id);
  const title = toDelete ? toDelete.title : id;
  setEvents((prev) => prev.filter((event) => event.id !== id));
  logAction('DELETE_EVENT', 'Events', `Deleted event "${title}"`, id);
  dbSyncDelete('events', id);
}

export function addEventAttendee(
  eventId: string,
  attendee: { name: string; phone?: string; email?: string; member_id?: string; role?: string },
  setEvents: Dispatch<SetStateAction<ChurchEvent[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  setEvents((prev) =>
    prev.map((event) => {
      if (event.id !== eventId) return event;

      const newAttendee = {
        id: `att-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        ...attendee,
        registered_at: new Date().toISOString(),
        checked_in: false,
      };
      const attendees = [...(event.attendees || []), newAttendee];
      const updated = {
        ...event,
        attendees,
        registration_count: attendees.length,
      };

      logAction('REGISTER_EVENT_ATTENDEE', 'Events', `Registered ${attendee.name} for ${event.title}`, eventId);
      dbSyncUpsert('events', updated);
      return updated;
    })
  );
}

export function removeEventAttendee(
  eventId: string,
  attendeeId: string,
  setEvents: Dispatch<SetStateAction<ChurchEvent[]>>,
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  setEvents((prev) =>
    prev.map((event) => {
      if (event.id !== eventId) return event;

      const attendees = (event.attendees || []).filter((attendee) => attendee.id !== attendeeId);
      const updated = {
        ...event,
        attendees,
        registration_count: attendees.length,
      };
      dbSyncUpsert('events', updated);
      return updated;
    })
  );
}

export function toggleAttendeeCheckIn(
  eventId: string,
  attendeeId: string,
  setEvents: Dispatch<SetStateAction<ChurchEvent[]>>,
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  setEvents((prev) =>
    prev.map((event) => {
      if (event.id !== eventId) return event;

      const attendees = (event.attendees || []).map((attendee) =>
        attendee.id === attendeeId ? { ...attendee, checked_in: !attendee.checked_in } : attendee
      );
      const updated = { ...event, attendees };
      dbSyncUpsert('events', updated);
      return updated;
    })
  );
}
