import { authorizeRequest, HttpError, requirePost, sendError } from './security.js';

const ATTENDANCE_ROLES = ['super_admin', 'senior_pastor', 'administrator', 'pastor', 'attendance_officer'];
const DAY_MS = 86400000;
const PAGE_SIZE = 500;
const MAX_ROWS = 5000;
const MAX_DAYS = 31;

export async function authorizeAttendance(req, dependencies = {}, bucket = 'ai') {
  const access = await (dependencies.authorizeRequest || authorizeRequest)(req, { roles: ATTENDANCE_ROLES, bucket });
  if (!ATTENDANCE_ROLES.includes(access.profile?.role)) throw new HttpError(403, 'Not authorised for attendance insights.');
  return access;
}

function parseChurchDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(value + 'T00:00:00.000Z');
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return null;
  return timestamp;
}

export function validateAttendancePeriod(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !['startDate', 'endDate'].includes(key))) {
    throw new HttpError(400, 'Only startDate and endDate are allowed.');
  }
  const start = parseChurchDate(body.startDate);
  const end = parseChurchDate(body.endDate);
  if (start === null || end === null || end < start || end - start >= MAX_DAYS * DAY_MS) {
    throw new HttpError(400, 'Select valid dates in a range of no more than 31 days.');
  }
  // Ghana local time is UTC. This endpoint must not report future sessions as recorded attendance.
  const today = new Date().toISOString().slice(0, 10);
  if (body.endDate > today) throw new HttpError(400, 'End date cannot be in the future.');
  return { startDate: body.startDate, endDate: body.endDate };
}

/** Calculate recorded check-ins, not total auditorium headcount or unique people over several services. */
export function buildAttendanceSummary(rows, period) {
  const seen = new Set();
  const services = new Map();
  const days = new Map();
  let memberCheckins = 0;
  let visitorCheckins = 0;
  let excludedRecords = 0;
  for (const row of rows) {
    if (row?.status !== 'present') { excludedRecords++; continue; }
    const type = row?.member_id && !row?.visitor_id ? 'member' :
      row?.visitor_id && !row?.member_id ? 'visitor' : null;
    if (!type || !row.service_id || parseChurchDate(row.date) === null || row.date < period.startDate || row.date > period.endDate) { excludedRecords++; continue; }
    const personId = type === 'member' ? row.member_id : row.visitor_id;
    const fingerprint = JSON.stringify([row.service_id, row.date, type, personId]);
    if (seen.has(fingerprint)) { excludedRecords++; continue; }
    seen.add(fingerprint);
    if (type === 'member') memberCheckins++;
    else visitorCheckins++;
    const name = (typeof row.service_name === 'string' && row.service_name.trim()
      ? row.service_name.trim().slice(0, 100) : 'Unlabelled service');
    const serviceKey = row.service_id;
    const service = services.get(serviceKey) || { serviceId: serviceKey, serviceName: name, checkins: 0, memberCheckins: 0, visitorCheckins: 0 };
    service.checkins++;
    if (type === 'member') service.memberCheckins++;
    else service.visitorCheckins++;
    services.set(serviceKey, service);
    days.set(row.date, (days.get(row.date) || 0) + 1);
  }
  return {
    period,
    totalCheckins: memberCheckins + visitorCheckins,
    memberCheckins,
    visitorCheckins,
    excludedRecords,
    sourceRecords: rows.length,
    byService: [...services.values()].sort((a, b) => b.checkins - a.checkins || a.serviceName.localeCompare(b.serviceName)),
    byDay: [...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, checkins]) => ({ date, checkins })),
    metric: 'Verified present check-in entries, deduplicated per person, service, and day. Not total auditorium attendance.',
    generatedAt: new Date().toISOString(),
  };
}

export async function readAttendanceSummary(client, period) {
  const records = [], ids = new Set();
  let expectedCount;
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const { data, error, count } = await client.from('attendance')
      .select('id,service_id,service_name,date,status,member_id,visitor_id', { count: 'exact' })
      .gte('date', period.startDate).lte('date', period.endDate)
      .order('id', { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (error || !Array.isArray(data) || !Number.isInteger(count) || count < 0) throw new HttpError(503, 'Attendance records could not be read securely.');
    if (count > MAX_ROWS) throw new HttpError(422, 'Too many records. Select a shorter period.');
    if (expectedCount !== undefined && expectedCount !== count) throw new HttpError(409, 'Attendance changed while loading. Refresh the summary.');
    expectedCount = count;
    for (const row of data) {
      if (!row.id || ids.has(row.id)) throw new HttpError(409, 'Attendance changed while loading. Refresh the summary.');
      ids.add(row.id);
    }
    records.push(...data);
    if (records.length > count) throw new HttpError(409, 'Attendance changed while loading. Refresh the summary.');
    if (data.length < PAGE_SIZE || records.length === count) break;
  }
  if (records.length !== expectedCount) throw new HttpError(503, 'A complete attendance summary could not be loaded. Select a shorter period and try again.');
  return buildAttendanceSummary(records, period);
}

/** Only approved staff can retrieve aggregate summaries. No raw identities or telephone numbers are returned. */
export async function attendanceInsightsHandler(req, res, dependencies = {}) {
  if (!requirePost(req, res)) return;
  try {
    const { client } = await authorizeAttendance(req, dependencies);
    const period = validateAttendancePeriod(req.body);
    const summary = await readAttendanceSummary(client, period);
    await authorizeAttendance(req, dependencies, null);
    res.status(200).json(summary);
  } catch (error) {
    sendError(res, error);
  }
}
