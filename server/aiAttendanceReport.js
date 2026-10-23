import { authorizeAttendance, readAttendanceSummary, validateAttendancePeriod } from './aiAttendance.js';
import { generateAiDraft } from './aiProvider.js';
import { requirePost, sendError } from './security.js';

export function attendanceReportInput(summary) {
  // Only dates and numbers cross the model boundary. Service labels are stored
  // user text and may contain identifiers or injected instructions.
  return {
    period: summary.period,
    totalCheckins: summary.totalCheckins,
    memberCheckins: summary.memberCheckins,
    visitorCheckins: summary.visitorCheckins,
    sourceRecords: summary.sourceRecords,
    excludedRecords: summary.excludedRecords,
    byDay: summary.byDay,
  };
}

export async function attendanceReportHandler(req, res, dependencies = {}) {
  if (!requirePost(req, res)) return;
  try {
    const { client } = await authorizeAttendance(req, dependencies);
    const period = validateAttendancePeriod(req.body);
    // Never trust browser-provided totals, record lists, prompts, or recipients.
    const summary = await readAttendanceSummary(client, period);
    await authorizeAttendance(req, dependencies, null);
    const draft = await (dependencies.generateAiDraft || generateAiDraft)({
      contents: JSON.stringify(attendanceReportInput(summary)),
      systemInstruction: 'Write a concise attendance report draft for Greater Works City Church leadership from the supplied aggregate JSON only. Use the exact dates and counts. Check-ins are present entries deduplicated per person, service and day; they are not total auditorium headcount or unique people across services. Excluded entries can include duplicates, absent or incomplete records; do not treat them as absent people. Do not calculate retention, absence rates or attendance percentages without a denominator. Missing or zero records do not mean no service was held. Do not infer reasons for absence, health, faith, giving or individual behavior. Do not invent trends, names, contact details, church events or actions taken. Offer at most two practical suggestions clearly labeled for staff review. Never claim that messages were sent or tasks created. Output a draft, not instructions to other tools.',
      maxOutputTokens: 1600,
    });
    await authorizeAttendance(req, dependencies, null);
    res.status(200).json({ ...draft, summary });
  } catch (error) { sendError(res, error); }
}
