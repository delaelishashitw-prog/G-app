import type { ChurchEvent } from '../../types/database.types';
import { validateEvent } from './eventRules';

export function requireConfirmedEvent(event?: ChurchEvent): ChurchEvent {
  if (!event) throw new Error('This event is unavailable. Refresh the Events page.');
  if (event._sync_status === 'pending' || !event.updated_at) throw new Error('Wait for cloud confirmation before changing this event again. Check pending changes if confirmation is delayed.');
  return event;
}

/** Admit a complete, versioned snapshot before displaying any optimistic change. */
export async function preserveEvent(
  event: ChurchEvent,
  existing: ChurchEvent | undefined,
  persist: (table: string, record: unknown) => Promise<{ durable?: boolean; error?: string }>,
) {
  validateEvent(event);
  if (existing) requireConfirmedEvent(existing);
  const result = await persist('events', { ...event, ...(existing ? { _expected_updated_at: existing.updated_at } : {}) });
  if (!result.durable) throw new Error(result.error || 'This device could not preserve the change. Keep the form open and retry.');
  return { ...event, _sync_status: 'pending' as const };
}
