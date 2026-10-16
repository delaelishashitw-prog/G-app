import type { AttendanceRecord, ChurchService, GivingRecord, HeadcountRecord, Member } from '../../types/database.types';
import { sumActive } from '../../lib/ledgerUtils';
import { cleanGhanaPhone } from '../../lib/currencyUtils';

type ServiceLink = { service_id?: string; service_name?: string };
const normalize = (name?: string) => (name || '').trim().replace(/\s+/g, ' ').toLowerCase();

/** IDs take priority. Only ID-less legacy rows can use an unambiguous exact name. */
export function resolveServiceId(row: ServiceLink, services: readonly Pick<ChurchService, 'id' | 'name'>[]): string | null {
  if (row.service_id) return services.some(s => s.id === row.service_id) ? row.service_id : null;
  const matches = services.filter(s => normalize(s.name) === normalize(row.service_name));
  return normalize(row.service_name) && matches.length === 1 ? matches[0].id : null;
}

export function countCheckins(rows: readonly AttendanceRecord[]): number {
  return new Set(rows.filter(row => row.status === 'present').map(row =>
    `${row.service_id || normalize(row.service_name)}:${row.date}:${row.member_id ? `member:${row.member_id}` : row.visitor_id ? `visitor:${row.visitor_id}` : `row:${row.id}`}`)).size;
}

export function buildServiceInsights(services: readonly ChurchService[], attendance: readonly AttendanceRecord[], headcounts: readonly HeadcountRecord[], giving: readonly GivingRecord[], today: string) {
  const map = new Map(services.map(service => {
    const checkins = attendance.filter(row => resolveServiceId(row, services) === service.id).map(row => ({ ...row, service_id: service.id }));
    const tallies = headcounts.filter(row => resolveServiceId(row, services) === service.id);
    const gifts = giving.filter(row => resolveServiceId(row, services) === service.id);
    const latestDate = [...checkins.map(row => row.date), ...tallies.map(row => row.date)].filter(date => date && date <= today).sort().at(-1) || '';
    const checkinsByDate = Object.fromEntries([...new Set(checkins.map(row => row.date))].map(date => [date, countCheckins(checkins.filter(row => row.date === date))]));
    const latestTally = tallies.filter(row => row.date === latestDate).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];
    return [service.id, {
      checkinCount: countCheckins(checkins), todayCheckinCount: checkinsByDate[today] || 0,
      latestCheckinCount: checkinsByDate[latestDate] || 0, checkinsByDate,
      headcountCount: latestTally?.total_auditorium || 0,
      givingTotal: sumActive(gifts), lastDate: latestDate,
    }] as const;
  }));
  return {
    map,
    connectedGiving: sumActive(giving.filter(row => resolveServiceId(row, services) !== null)),
    unlinkedAttendance: attendance.filter(row => resolveServiceId(row, services) === null).length,
    unlinkedHeadcounts: headcounts.filter(row => resolveServiceId(row, services) === null).length,
    unlinkedGiving: giving.filter(row => resolveServiceId(row, services) === null).length,
  };
}

export function resolveRosterMember(value: string, members: readonly Member[]): Member | undefined {
  const active = members.filter(member => !member.is_archived);
  const idMatches = active.filter(member => member.id === value.trim() || member.member_id?.toLowerCase() === value.trim().toLowerCase());
  if (idMatches.length === 1) return idMatches[0];
  const phone = cleanGhanaPhone(value);
  if (/^233\d{9}$/.test(phone)) {
    const matches = active.filter(member => cleanGhanaPhone(member.phone) === phone);
    return matches.length === 1 ? matches[0] : undefined;
  }
  const cleanName = (name: string) => normalize(name).replace(/\b(prophet|pastor|elder|deacon|deaconess|brother|sister|bro|sis|minister|rev|reverend|dr|mrs|mr|ms|evangelist)\.?\b/g, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  const name = cleanName(value);
  if (!name) return undefined;
  const matches = active.filter(member => [
    `${member.first_name} ${member.last_name}`, `${member.last_name} ${member.first_name}`,
    `${member.first_name} ${member.middle_name || ''} ${member.last_name}`,
  ].some(candidate => cleanName(candidate) === name));
  return matches.length === 1 ? matches[0] : undefined;
}
