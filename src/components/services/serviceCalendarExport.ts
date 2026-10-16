import type { ChurchService } from '../../types/database.types';
import { serviceOccurrence } from '../../features/services/serviceSchedule';

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const escapeText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
const timestamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const lines: string[] = [];
  let current = '', bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) { lines.push(current); current = ' '; bytes = 1; }
    current += character; bytes += size;
  }
  lines.push(current);
  return lines.join('\r\n');
}

export function generateServicesIcs(services: ChurchService[], churchName = 'Greater Works City Church', now = new Date()): string {
  const events = services.filter(service => service.is_active).flatMap(service => {
    const occurrence = serviceOccurrence(service, now);
    if (!occurrence) return [];
    const description = [service.description || '', 'Preacher: ' + (service.preacher || 'Senior Pastor'),
      'Service Leader: ' + (service.service_leader || 'Pastoral Board'),
      ...(service.order_of_service || []).map((item, index) => (index + 1) + '. ' + item.title + ' (' + (item.minister || 'Minister') + ')')].filter(Boolean).join('\n');
    return ['BEGIN:VEVENT', 'UID:gwcc-svc-' + encodeURIComponent(service.id) + '@gwcc-joma.gh', 'DTSTAMP:' + timestamp(now),
      'DTSTART:' + timestamp(occurrence.start), 'DTEND:' + timestamp(occurrence.end),
      'RRULE:FREQ=WEEKLY;BYDAY=' + DAYS[occurrence.start.getUTCDay()],
      'SUMMARY:' + escapeText(service.name), 'DESCRIPTION:' + escapeText(description),
      'LOCATION:' + escapeText(service.venue || 'Main Sanctuary, Joma, Accra'), 'STATUS:CONFIRMED', 'END:VEVENT'];
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Greater Works City Church//Worship Calendar//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + escapeText(churchName) + ' - Worship Schedule',
    'X-WR-TIMEZONE:Africa/Accra', ...events, 'END:VCALENDAR'].map(foldLine).join('\r\n') + '\r\n';
}

export function downloadServicesIcs(services: ChurchService[], churchName = 'Greater Works City Church') {
  const url = URL.createObjectURL(new Blob([generateServicesIcs(services, churchName)], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'GWCC_Worship_Schedule.ics';
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}
