import type {AttendanceRecord, ChurchFinanceRecord, ExpenseRecord, GivingRecord, HeadcountRecord, Member, Ministry, PledgeRecord, SmallGroup, Visitor} from '../types/database.types';
import {uniquePresentAttendance, headcountTotal} from '../features/attendance/attendanceInsights';
import {ghanaToday} from './financeViewUtils';
import {isActiveTransaction} from './ledgerUtils';
import {reportExpenses} from './reportData';

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  search?: string;
  category?: string;
  paymentMethod?: string;
  ministry?: string;
}
export interface ReportSources {
  members?: Member[];
  visitors?: Visitor[];
  attendance?: AttendanceRecord[];
  headcounts?: HeadcountRecord[];
  giving?: GivingRecord[];
  expenses?: ExpenseRecord[];
  churchFinances?: ChurchFinanceRecord[];
  pledges?: PledgeRecord[];
  smallGroups?: SmallGroup[];
  ministries?: Ministry[];
}
export interface ReportReceipt {
  id: string;
  record_id: string;
  source: 'giving' | 'church';
  date: string;
  category: string;
  member_name?: string;
  donor_name?: string;
  payment_method: string;
  reference_number?: string;
  amount: number;
  currency: string;
}
const confirmed = (row: unknown) => (row as {_sync_status?: string})._sync_status !== 'pending';
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export function reportDateError({startDate = '', endDate = ''}: ReportFilters): string {
  if ((startDate && !validDate(startDate)) || (endDate && !validDate(endDate))) return 'Enter valid reporting dates.';
  return startDate && endDate && startDate > endDate ? 'The reporting start date must be on or before the end date.' : '';
}
export function reportPeriodLabel({startDate = '', endDate = ''}: ReportFilters): string {
  return startDate && endDate ? `${startDate} to ${endDate}` : startDate ? `From ${startDate}` : endDate ? `Through ${endDate}` : 'All recorded dates';
}
export function reportFilterLabel(filters: ReportFilters): string {
  return [filters.search?.trim() && `Search: ${filters.search.trim()}`, filters.category && filters.category !== 'ALL' && `Category: ${filters.category}`,
    filters.paymentMethod && filters.paymentMethod !== 'ALL' && `Method: ${filters.paymentMethod}`, filters.ministry && filters.ministry !== 'ALL' && `Ministry: ${filters.ministry}`].filter(Boolean).join(' · ') || 'All matching records';
}
export function reportDatePreset(preset: string, today = ghanaToday()): {startDate: string; endDate: string} {
  const [year, month] = today.split('-').map(Number);
  const first = (m: number) => new Date(Date.UTC(year, m, 1)).toISOString().slice(0, 10);
  const last = (m: number) => new Date(Date.UTC(year, m + 1, 0)).toISOString().slice(0, 10);
  if (preset === 'all' || preset === 'all_time') return {startDate: '', endDate: ''};
  if (preset === 'this_month') return {startDate: first(month - 1), endDate: last(month - 1)};
  if (preset === 'last_month') return {startDate: first(month - 2), endDate: last(month - 2)};
  if (preset === 'this_quarter') {const m = Math.floor((month - 1) / 3) * 3; return {startDate: first(m), endDate: last(m + 2)};}
  if (preset === 'q3') return {startDate: `${year}-07-01`, endDate: `${year}-09-30`};
  return {startDate: `${year}-01-01`, endDate: preset === 'this_year' ? `${year}-12-31` : today};
}
export const reportSum = (rows: {amount: number}[]) => rows.reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0) / 100;
export function receiptClass(row: ReportReceipt): 'tithes' | 'offerings' | 'building' | 'other' | 'church' {
  if (row.source === 'church') return 'church';
  const category = row.category.toLowerCase();
  return category.includes('tithe') ? 'tithes' : category.includes('building') ? 'building' : category.includes('offering') ? 'offerings' : 'other';
}

/** A headcount replaces individual check-ins only for that same service and date. */
export function reportAttendanceWeeks(attendance: AttendanceRecord[], headcounts: HeadcountRecord[]) {
  const sessions = new Map<string, {date: string; name: string; members: number; visitors: number; total: number}>();
  for (const row of uniquePresentAttendance(attendance)) {
    const key = `${row.service_id || row.service_name}:${row.date}`;
    const session = sessions.get(key) || {date: row.date, name: row.service_name, members: 0, visitors: 0, total: 0};
    if (row.visitor_id) session.visitors++; else session.members++;
    session.total++; sessions.set(key, session);
  }
  for (const row of headcounts) {
    const total = headcountTotal(row), visitors = row.visitors || 0;
    sessions.set(`${row.service_id || row.service_name}:${row.date}`, {date: row.date, name: row.service_name, members: total - visitors, visitors, total});
  }
  const weeks = new Map<string, {key: string; weekLabel: string; weekShort: string; year: number; members: number; visitors: number; totalHeadcount: number; sunday1st: number; sunday2nd: number; midweek: number; visitorRatio: number}>();
  for (const session of sessions.values()) {
    if (!validDate(session.date)) continue;
    const monday = new Date(session.date + 'T12:00:00Z'); monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
    const key = monday.toISOString().slice(0, 10);
    const week = weeks.get(key) || {key, weekLabel: monday.toLocaleDateString('en-GB', {timeZone: 'Africa/Accra', day: '2-digit', month: 'short', year: 'numeric'}),
      weekShort: monday.toLocaleDateString('en-GB', {timeZone: 'Africa/Accra', day: '2-digit', month: 'short'}), year: monday.getUTCFullYear(), members: 0, visitors: 0, totalHeadcount: 0, sunday1st: 0, sunday2nd: 0, midweek: 0, visitorRatio: 0};
    week.members += session.members; week.visitors += session.visitors; week.totalHeadcount += session.total;
    const name = (session.name || '').toLowerCase();
    if (name.includes('midweek') || name.includes('vigil')) week.midweek += session.total;
    else if (name.includes('2nd') || name.includes('second')) week.sunday2nd += session.total;
    else week.sunday1st += session.total;
    week.visitorRatio = Math.round(week.visitors / (week.totalHeadcount || 1) * 100); weeks.set(key, week);
  }
  return [...weeks.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** A read-only snapshot shared by on-screen reports and every export path. Money is GHS, without inferred exchange rates. */
export function buildReportSnapshot(source: ReportSources, filters: ReportFilters = {}) {
  const error = reportDateError(filters), query = filters.search?.trim().toLowerCase() || '';
  const text = (...values: unknown[]) => !query || values.some(value => String(value ?? '').toLowerCase().includes(query));
  const date = (value: string) => !error && validDate(value?.slice(0, 10) || '') && (!filters.startDate || value.slice(0, 10) >= filters.startDate) && (!filters.endDate || value.slice(0, 10) <= filters.endDate);
  const money = (row: {amount: number; currency?: string; status?: string}) => confirmed(row) && isActiveTransaction(row) && Number.isFinite(Number(row.amount)) && (!row.currency || row.currency === 'GHS');
  const financial = (row: {category: string; payment_method?: string}) => (!filters.category || filters.category === 'ALL' || filters.category === row.category) && (!filters.paymentMethod || filters.paymentMethod === 'ALL' || filters.paymentMethod === row.payment_method);
  const giving = (source.giving || []).filter(row => money(row) && date(row.date) && financial(row) && text(row.member_name, row.donor_name, row.category, row.reference_number));
  const churchIncome = (source.churchFinances || []).map(row => ({...row, amount: Math.max(0, Math.round((Number(row.amount) - Number(row.giving_deposit_amount || 0)) * 100) / 100)})).filter(row => row.amount > 0).filter(row => ['income', 'grant'].includes(row.transaction_type) && money(row) && date(row.date) && financial(row) && text(row.title, row.recipient_or_vendor, row.category, row.reference_no));
  const receipts: ReportReceipt[] = [
    ...giving.map(row => ({...row, id: `giving:${row.id}`, record_id: row.id, source: 'giving' as const})),
    ...churchIncome.map(row => ({id: `church:${row.id}`, record_id: row.id, source: 'church' as const, date: row.date, category: row.category,
      donor_name: row.recipient_or_vendor || row.title, payment_method: row.payment_method || 'other', reference_number: row.reference_no, amount: row.amount, currency: row.currency})),
  ].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const postedLedger = (source.churchFinances || []).filter(row => confirmed(row) && (!row.approval_state || !['expense', 'disbursement'].includes(row.transaction_type) || row.approval_state === 'paid' || row.approval_state === 'voided'));
  // Keep pending ledger IDs in the de-duplication set so a stale legacy copy cannot reappear.
  const ledgerIds = new Set((source.churchFinances || []).map(row => row.id));
  const legacy = (source.expenses || []).filter(row => !ledgerIds.has(row.id) && confirmed(row));
  const expenses = reportExpenses(legacy, postedLedger).filter(row => money(row) && date(row.date) && financial(row) && text(row.title, row.recipient, row.category, row.description, row.reference_number));
  const members = (source.members || []).filter(row => confirmed(row) && !row.is_archived && (!filters.ministry || filters.ministry === 'ALL' || row.ministry_name === filters.ministry) && text(row.first_name + ' ' + (row.middle_name || '') + ' ' + row.last_name, row.first_name + ' ' + row.last_name, row.member_id, row.phone, row.ministry_name));
  const attendance = uniquePresentAttendance((source.attendance || []).filter(row => confirmed(row) && date(row.date) && text(row.person_name, row.member_name, row.visitor_name, row.service_name)));
  const headcounts = (source.headcounts || []).filter(row => confirmed(row) && date(row.date) && text(row.service_name));
  const visitors = (source.visitors || []).filter(row => confirmed(row) && date(row.visit_date) && text(row.full_name, row.phone, row.prayer_request));
  const pledges = (source.pledges || []).filter(row => confirmed(row) && !['cancelled', 'voided'].includes(row.status) && date(row.start_date || row.created_at?.slice(0, 10)) && text(row.member_name, row.campaign_name, row.status));
  const smallGroups = (source.smallGroups || []).filter(row => confirmed(row) && text(row.name, row.zone, row.leader_name, row.leader_phone, row.meeting_address));
  const income = reportSum(receipts), expenditure = reportSum(expenses);
  const classified = (category: ReturnType<typeof receiptClass>) => reportSum(receipts.filter(row => receiptClass(row) === category));
  const weeks = reportAttendanceWeeks(attendance, headcounts).map(week => week.totalHeadcount);
  const financialRows = [...(source.giving || []), ...(source.expenses || []), ...(source.churchFinances || []).filter(row => ['income', 'grant', 'expense', 'disbursement'].includes(row.transaction_type))];
  return {error, giving, churchIncome, receipts, expenses, members, attendance, headcounts, visitors, pledges, smallGroups,
    excludedCurrencyCount: financialRows.filter(row => row.currency && row.currency !== 'GHS').length,
    totals: {income, expenditure, surplus: (Math.round(income * 100) - Math.round(expenditure * 100)) / 100,
      memberGiving: reportSum(giving), churchIncome: reportSum(churchIncome), tithes: classified('tithes'), offerings: classified('offerings'), building: classified('building'), otherGiving: classified('other'),
      averageWeeklyAttendance: weeks.length ? Math.round(weeks.reduce((sum, n) => sum + n, 0) / weeks.length) : 0,
      peakWeeklyAttendance: weeks.length ? Math.max(...weeks) : 0}};
}
