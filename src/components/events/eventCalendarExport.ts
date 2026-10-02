import { ChurchEvent } from '../../types/database.types';

/**
 * Generates and downloads a standard .ics (iCalendar) file for any church event
 */
export function downloadEventIcs(event: ChurchEvent, churchName: string = 'Greater Works City Church') {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  // Format date-time for iCalendar: YYYYMMDDTHHMMSS
  const formatIcsDateTime = (dateStr: string, timeStr: string): string => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hours, minutes] = (timeStr || '09:00').split(':').map(Number);
      return `${year}${pad(month)}${pad(day)}T${pad(hours)}${pad(minutes)}00`;
    } catch {
      return `${dateStr.replace(/-/g, '')}T090000`;
    }
  };

  const dtStart = formatIcsDateTime(event.start_date, event.start_time);
  const dtEnd = formatIcsDateTime(event.end_date || event.start_date, event.end_time || event.start_time);
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const cleanDescription = (
    `${event.theme ? `THEME: "${event.theme}" (${event.theme_scripture || ''})\n\n` : ''}` +
    `${event.description || ''}\n\n` +
    `${event.speaker ? `Keynote Speaker: ${event.speaker}\n` : ''}` +
    `Host: ${event.ministry_name || event.organizer || churchName}\n` +
    `Location: ${event.venue}\n` +
    `Expected Attendance: ${event.expected_attendance || 'All are welcome'}`
  ).replace(/\n/g, '\\n');

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Greater Works City Church//Ecclesiastical Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@gwcc-joma.gh`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${event.title.replace(/,/g, '\\,')}`,
    `DESCRIPTION:${cleanDescription}`,
    `LOCATION:${event.venue.replace(/,/g, '\\,')}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const icsData = icsLines.join('\r\n');
  const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = `${event.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.ics`;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates formatted WhatsApp announcement copy ready to broadcast to church members
 */
export function generateWhatsAppAnnouncement(event: ChurchEvent, churchName: string = 'Greater Works City Church, Joma'): string {
  const dateFormatted = event.start_date === event.end_date
    ? new Date(event.start_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : `${new Date(event.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${new Date(event.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const lines = [
    `🕊️ *${churchName.toUpperCase()}*`,
    `📢 *ANNOUNCEMENT: ${event.title.toUpperCase()}*`,
    `--------------------------------------`,
  ];

  if (event.theme) {
    lines.push(`🔥 *Theme:* "${event.theme}"`);
    if (event.theme_scripture) {
      lines.push(`📖 *Scripture Anchor:* ${event.theme_scripture}`);
    }
    lines.push(``);
  }

  lines.push(`📅 *Date:* ${dateFormatted}`);
  lines.push(`⏰ *Time:* ${event.start_time} - ${event.end_time}`);
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

  lines.push(`Come with your family, neighbors, and friends. Your breakthrough awaits you!`);
  lines.push(`--------------------------------------`);
  lines.push(`Jesus Christ the same yesterday, and to day, and for ever. (Hebrews 13:8)`);

  return lines.join('\n');
}
