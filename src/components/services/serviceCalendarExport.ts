import { ChurchService } from '../../types/database.types';

const DAY_MAP: Record<string, string> = {
  sunday: 'SU',
  monday: 'MO',
  tuesday: 'TU',
  wednesday: 'WE',
  thursday: 'TH',
  friday: 'FR',
  saturday: 'SA',
};

function getNextDateForDay(dayName: string): Date {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDayIdx = days.indexOf(dayName.toLowerCase().trim());
  const now = new Date();
  const currentDayIdx = now.getDay();

  let diff = (targetDayIdx === -1 ? 0 : targetDayIdx) - currentDayIdx;
  if (diff < 0) diff += 7;

  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
  return target;
}

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

function formatIcsDateTime(date: Date, timeStr: string): string {
  const [hours, minutes] = (timeStr || '09:00').split(':').map(Number);
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const h = pad(isNaN(hours) ? 9 : hours);
  const m = pad(isNaN(minutes) ? 0 : minutes);
  return `${year}${month}${day}T${h}${m}00`;
}

/**
 * Generates an iCalendar (.ics) string for recurring weekly church services
 */
export function generateServicesIcs(
  services: ChurchService[],
  churchName: string = 'Greater Works City Church'
): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const vEvents = services
    .filter((s) => s.is_active)
    .map((service) => {
      const nextDate = getNextDateForDay(service.day_of_week || 'Sunday');
      const dtStart = formatIcsDateTime(nextDate, service.start_time);
      const dtEnd = formatIcsDateTime(nextDate, service.end_time || service.start_time);
      const byDay = DAY_MAP[(service.day_of_week || 'sunday').toLowerCase().trim()] || 'SU';

      const programSummary = (service.order_of_service || [])
        .map((p, idx) => `${idx + 1}. [${p.time || p.duration || ''}] ${p.title} (${p.minister || 'Min.'})`)
        .join('\\n');

      const description = [
        service.description || '',
        `Preacher: ${service.preacher || 'Senior Pastor'}`,
        `Service Leader: ${service.service_leader || 'Pastoral Board'}`,
        `Venue: ${service.venue || 'Main Sanctuary, Joma, Accra'}`,
        `Expected Attendance: ${service.expected_attendance || 200}`,
        programSummary ? `\\nLITURGY / ORDER OF SERVICE:\\n${programSummary}` : '',
        `\\nGreater Works City Church — Joma Assembly, Accra, Ghana`,
      ]
        .filter(Boolean)
        .join('\\n');

      return [
        'BEGIN:VEVENT',
        `UID:gwcc-svc-${service.id}@gwcc-joma.gh`,
        `DTSTAMP:${now}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${byDay}`,
        `SUMMARY:${(service.name || 'Worship Service').replace(/,/g, '\\,')}`,
        `DESCRIPTION:${description}`,
        `LOCATION:${(service.venue || 'Main Cathedral Sanctuary, Joma, Accra').replace(/,/g, '\\,')}`,
        'STATUS:CONFIRMED',
        'END:VEVENT',
      ].join('\r\n');
    });

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Greater Works City Church//Worship Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${churchName} - Worship Schedule`,
    'X-WR-TIMEZONE:Africa/Accra',
    ...vEvents,
    'END:VCALENDAR',
  ];

  return icsLines.join('\r\n');
}

/**
 * Downloads the services schedule as an .ics calendar file
 */
export function downloadServicesIcs(
  services: ChurchService[],
  churchName: string = 'Greater Works City Church'
) {
  const icsData = generateServicesIcs(services, churchName);
  const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'GWCC_Worship_Schedule.ics');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
