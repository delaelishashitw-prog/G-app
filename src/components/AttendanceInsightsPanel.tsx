import React, { useEffect, useRef, useState } from 'react';
import { authenticatedFetch } from '../lib/apiClient';

type Summary = {
  period: { startDate: string; endDate: string };
  totalCheckins: number; memberCheckins: number; visitorCheckins: number;
  sourceRecords: number; excludedRecords: number; generatedAt: string; metric: string;
  byService: { serviceId: string; serviceName: string; checkins: number }[];
};
type Report = { text: string; model: string; status: 'draft'; summary: Summary };

export function AttendanceInsightsPanel() {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(() => new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(today);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [draft, setDraft] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'summary' | 'draft' | null>(null);
  const [copied, setCopied] = useState(false);
  const request = useRef<{ id: number; controller?: AbortController }>({ id: 0 });
  useEffect(() => () => { request.current.id++; request.current.controller?.abort(); }, []);

  function changePeriod(which: 'start' | 'end', value: string) {
    request.current.id++; request.current.controller?.abort();
    request.current.controller = undefined;
    (which === 'start' ? setStartDate : setEndDate)(value);
    setSummary(null); setDraft(null); setError(''); setBusy(null); setCopied(false);
  }
  async function load(kind: 'summary' | 'draft') {
    if (request.current.controller) return;
    const id = ++request.current.id, controller = new AbortController();
    request.current.controller = controller;
    setBusy(kind); setError(''); setDraft(null); setCopied(false);
    if (kind === 'summary') setSummary(null);
    try {
      const response = await authenticatedFetch(`/api/ai/${kind === 'summary' ? 'attendance-insights' : 'attendance-report'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate }), signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The attendance request failed.');
      if (id !== request.current.id) return;
      if (kind === 'summary') setSummary(result as Summary);
      else { setDraft(result as Report); setSummary((result as Report).summary); }
    } catch (cause) {
      if (id !== request.current.id || controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'Unable to load attendance insights.');
      if (kind === 'summary') setSummary(null);
    } finally {
      if (id === request.current.id) { request.current.controller = undefined; setBusy(null); }
    }
  }
  const copyDraft = async () => {
    if (!draft) return;
    try { await navigator.clipboard.writeText(`DRAFT — review before sharing\n${draft.text}`); setCopied(true); }
    catch { setError('Copy was unavailable. Select and copy the draft text manually.'); }
  };

  return <section aria-label="Attendance Intelligence" className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
    <div>
      <h2 className="text-lg font-semibold text-slate-900">Attendance Intelligence</h2>
      <p className="text-sm text-slate-600">View recorded check-ins for up to 31 days. AI report drafts receive dates and totals only.</p>
    </div>
    <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); void load('summary'); }}>
      <label className="text-sm text-slate-700">Start date
        <input type="date" aria-label="Attendance start date" required max={endDate || today} value={startDate} onChange={e => changePeriod('start', e.target.value)} className="block rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <label className="text-sm text-slate-700">End date
        <input type="date" aria-label="Attendance end date" required min={startDate} max={today} value={endDate} onChange={e => changePeriod('end', e.target.value)} className="block rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <button type="submit" disabled={!!busy || !startDate || !endDate} className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === 'summary' ? 'Loading...' : 'View attendance summary'}</button>
    </form>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {summary && <div aria-live="polite" className="space-y-3 text-sm text-slate-700">
      <p className="font-semibold">{summary.totalCheckins} recorded check-ins ({summary.memberCheckins} member; {summary.visitorCheckins} visitor)</p>
      <p>Period: {summary.period.startDate} to {summary.period.endDate}. Source entries: {summary.sourceRecords}. Excluded duplicate, absent or incomplete entries: {summary.excludedRecords}.</p>
      <p className="text-xs text-slate-500">{summary.metric}</p>
      <p className="text-xs text-slate-500">Updated: {new Date(summary.generatedAt).toLocaleString('en-GH', { timeZone: 'Africa/Accra' })} (Ghana time). Refresh after new check-ins sync.</p>
      <ul className="divide-y divide-slate-100">{summary.byService.map(service => <li className="flex justify-between gap-3 py-2" key={service.serviceId}><span className="break-words min-w-0">{service.serviceName}</span><strong>{service.checkins}</strong></li>)}</ul>
      {summary.totalCheckins === 0 && <p>No present check-ins found in the selected period. This does not confirm that no service took place.</p>}
      <button type="button" disabled={!!busy} onClick={() => void load('draft')} className="rounded-lg border border-emerald-800 px-4 py-2 text-sm font-semibold text-emerald-900 disabled:opacity-50">{busy === 'draft' ? 'Drafting...' : 'Draft attendance report'}</button>
      <p className="text-xs text-slate-500">The report rechecks current records. It does not send messages or create follow-up tasks.</p>
    </div>}
    {draft && <article aria-label="Attendance report draft" className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <p className="font-semibold text-sm text-amber-900">Draft — review before sharing</p>
      <p className="text-xs text-slate-600">Model: {draft.model}. Verify the wording against the source totals above.</p>
      <div className="whitespace-pre-wrap break-words text-sm text-slate-800">{draft.text}</div>
      <button type="button" onClick={() => void copyDraft()} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">{copied ? 'Copied' : 'Copy report draft'}</button>
    </article>}
  </section>;
}
