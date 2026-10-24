import { effectiveEventStatus, requireEventPublication } from '../../features/events/eventRules';
import { ChurchEvent } from '../../types/database.types';

/** Escape iCalendar TEXT and fold by UTF-8 octets, without splitting a code point. */
const escapeText = (text: string) => text.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
function foldLine(line: string) {
  const lines: string[] = []; let part = '', bytes = 0;
  for (const character of line) {
    const size = new TextEncoder().encode(character).length;
    if (bytes + size > 75) { lines.push(part); part = ' '; bytes = 1; }
    part += character; bytes += size;
  }
  lines.push(part); return lines.join('\r\n');
}
export function buildEventIcs(event: ChurchEvent, churchName = 'Greater Works City Church', now = new Date()) {
  requireEventPublication(event);
  const instant = (date: string, time: string) => `${date.replaceAll('-', '')}T${time.slice(0, 5).replace(':', '')}00Z`;
  const description = [event.theme, event.theme_scripture, event.description, event.speaker ? `Speaker: ${event.speaker}` : '', `Host: ${event.ministry_name || event.organizer || churchName}`].filter(Boolean).join('\n');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GWCC//Church Events//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${escapeText(event.id)}@gwcc-joma.gh`, `DTSTAMP:${now.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `DTSTART:${instant(event.start_date, event.start_time)}`, `DTEND:${instant(event.end_date || event.start_date, event.end_time)}`,
    `SUMMARY:${escapeText(event.title)}`, `DESCRIPTION:${escapeText(description)}`, `LOCATION:${escapeText(event.venue || '')}`,
    `STATUS:${event.status === 'cancelled' ? 'CANCELLED' : event.status === 'draft' ? 'TENTATIVE' : 'CONFIRMED'}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].map(foldLine).join('\r\n') + '\r\n';
}
export function downloadEventIcs(event: ChurchEvent, churchName = 'Greater Works City Church') {
  const url = URL.createObjectURL(new Blob([buildEventIcs(event, churchName)], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url;
  link.download = `${(event.title || 'church_event').toLowerCase().replace(/[^a-z0-9]/g, '_')}.ics`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Generates formatted WhatsApp announcement copy ready to broadcast to church members
 */
export function generateWhatsAppAnnouncement(event: ChurchEvent, churchName: string = 'Greater Works City Church, Joma', now = Date.now()): string {
  requireEventPublication(event);
  const status = effectiveEventStatus(event, now);
  const dateFormatted = event.start_date === event.end_date
    ? new Date(event.start_date).toLocaleDateString('en-GB', { timeZone: 'Africa/Accra', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : `${new Date(event.start_date).toLocaleDateString('en-GB', { timeZone: 'Africa/Accra', day: 'numeric', month: 'short' })} - ${new Date(event.end_date).toLocaleDateString('en-GB', { timeZone: 'Africa/Accra', day: 'numeric', month: 'short', year: 'numeric' })}`;

  const lines = [
    `🕊️ *${churchName.toUpperCase()}*`,
    `📢 *ANNOUNCEMENT: ${event.title.toUpperCase()}*`,
    `--------------------------------------`,
  ];

  if (['draft', 'cancelled', 'completed'].includes(status)) lines.push(`*Status: ${status.toUpperCase()}*`);
  if (event.theme) {
    lines.push(`🔥 *Theme:* "${event.theme}"`);
    if (event.theme_scripture) {
      lines.push(`📖 *Scripture Anchor:* ${event.theme_scripture}`);
    }
    lines.push(``);
  }

  lines.push(`📅 *Date:* ${dateFormatted}`);
  lines.push(`⏰ *Time:* ${event.start_time} - ${event.end_time} GMT`);
  lines.push(`📍 *Venue:* ${event.venue}`);

  if (event.speaker) {
    lines.push(`🎙️ *Ministering:* ${event.speaker}`);
  }

  if (event.organizer || event.ministry_name) {
    lines.push(`👥 *Host:* ${event.ministry_name || event.organizer}`);
  }

  lines.push(``);
  if (event.description) {
    lines.push(`_${event.description}_`);
    lines.push(``);
  }

  if (['upcoming','ongoing'].includes(status)) lines.push('You are warmly invited.');
  lines.push(`--------------------------------------`);
  lines.push(`Jesus Christ the same yesterday, and to day, and for ever. (Hebrews 13:8)`);

  return lines.join('\n');
}
