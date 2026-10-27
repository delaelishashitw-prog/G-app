import React, { useCallback, useEffect, useRef, useState } from 'react';
import { authenticatedFetch } from '../lib/apiClient';
import { ClipboardList, RefreshCcw, ShieldCheck, UserRoundCheck, Users, AlertCircle } from 'lucide-react';

type Overview = {
  visitors: { total: number; awaitingFollowUp: number; contacted: number; returning: number; converted: number; closed: number; other: number };
  myTasks: { open: number; overdue: number; visitor: number; pastoral: number; general: number };
  asOf: string; generatedAt: string; scope: string; status: 'recorded';
};

export function PastoralIntelligencePanel() {
  const [report, setReport] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true); setError('');
    try {
      const response = await authenticatedFetch('/api/ai/pastoral-overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: controller.signal,
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Could not retrieve the overview.');
      if (json.status !== 'recorded' || !json.visitors || !json.myTasks) throw new Error('The overview could not be verified.');
      if (!controller.signal.aborted) setReport(json as Overview);
    } catch (cause) {
      if (!controller.signal.aborted) { setReport(null); setError(cause instanceof Error ? cause.message : 'Could not load pastoral overview.'); }
    } finally {
      if (pending.current === controller) pending.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => { pending.current?.abort(); pending.current = null; };
  }, [refresh]);

  const tiles = [
    { label: 'Visitors on record', count: report?.visitors.total, icon: Users },
    { label: 'Visitors awaiting follow-up', count: report?.visitors.awaitingFollowUp, icon: UserRoundCheck },
    { label: 'My open tasks', count: report?.myTasks.open, icon: ClipboardList },
    { label: 'My overdue tasks', count: report?.myTasks.overdue, icon: AlertCircle },
  ];

  return (
    <section aria-label="Pastoral intelligence overview" className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-white dark:bg-slate-900 p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Pastoral Intelligence</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">Verified record counts only. No names, contact details or confidential notes.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300 disabled:opacity-50">
          <RefreshCcw className="w-4 h-4" /> {loading ? 'Refreshing…' : 'Refresh overview'}
        </button>
      </div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 text-rose-800 p-3 text-sm">{error}</p>}
      <div aria-live="polite" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map(({label, count, icon: Icon}) => (
          <div key={label} className="rounded-xl bg-emerald-50 dark:bg-slate-800 p-4">
            <Icon className="h-5 w-5 text-emerald-700 dark:text-emerald-300 mb-2" />
            <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{loading && !report ? '…' : count ?? '—'}</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{label}</p>
          </div>
        ))}
      </div>
      {report && <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <ShieldCheck className="w-4 h-4" /> As of {report.asOf} (Ghana time). This overview does not send messages, modify records or make pastoral decisions.
      </p>}
    </section>
  );
}
