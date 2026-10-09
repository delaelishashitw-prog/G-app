import React, { useState, useMemo } from 'react';
import {
  History,
  Shield,
  Clock,
  Search,
  Filter,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  FileText,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useChurchData } from '../contexts/ChurchDataContext';

export const AuditLogsPage: React.FC = () => {
  const { auditLogs } = useChurchData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [actionCategory, setActionCategory] = useState<'ALL' | 'CREATE' | 'UPDATE' | 'DELETE'>('ALL');

  // Distinct modules present in logs
  const availableModules = useMemo(() => {
    const set = new Set<string>();
    auditLogs.forEach((l) => {
      if (l.module) set.add(l.module);
    });
    return Array.from(set).sort();
  }, [auditLogs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const term = (searchTerm || '').toLowerCase();
      const matchesSearch =
        !term ||
        (log.user_name || '').toLowerCase().includes(term) ||
        (log.module || '').toLowerCase().includes(term) ||
        (log.action || '').toLowerCase().includes(term) ||
        (log.details || '').toLowerCase().includes(term) ||
        (log.record_id && log.record_id.toLowerCase().includes(term));

      const matchesModule = selectedModule === 'ALL' || log.module?.toLowerCase() === selectedModule.toLowerCase();

      let matchesCategory = true;
      if (actionCategory === 'CREATE') {
        matchesCategory =
          log.action.includes('ADD') ||
          log.action.includes('RECORD') ||
          log.action.includes('CREATE') ||
          log.action.includes('CONVERT');
      } else if (actionCategory === 'UPDATE') {
        matchesCategory = log.action.includes('UPDATE') || log.action.includes('EDIT') || log.action.includes('RESET');
      } else if (actionCategory === 'DELETE') {
        matchesCategory = log.action.includes('DELETE') || log.action.includes('ARCHIVE') || log.action.includes('REMOVE');
      }

      return matchesSearch && matchesModule && matchesCategory;
    });
  }, [auditLogs, searchTerm, selectedModule, actionCategory]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-400">
              <History className="w-5 h-5" />
            </span>
            <span>Audit Trail & Security Event Logs</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Immutable log of service liturgies, financial contributions, pastoral logs, and system modifications
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
            {filteredLogs.length} of {auditLogs.length} Events
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#0e1726] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by actor, action, details, service name..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Module Filter */}
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="py-1.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-medium focus:outline-none"
          >
            <option value="ALL">All Modules ({availableModules.length})</option>
            {availableModules.map((mod) => (
              <option key={mod} value={mod}>
                {mod}
              </option>
            ))}
          </select>

          {/* Action Type Filter */}
          <select
            value={actionCategory}
            onChange={(e) => setActionCategory(e.target.value as any)}
            className="py-1.5 px-3 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-medium focus:outline-none"
          >
            <option value="ALL">All Action Types</option>
            <option value="CREATE">Created / Added</option>
            <option value="UPDATE">Updated / Modified</option>
            <option value="DELETE">Deleted / Archived</option>
          </select>

          {(searchTerm || selectedModule !== 'ALL' || actionCategory !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedModule('ALL');
                setActionCategory('ALL');
              }}
              className="py-1.5 px-2.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white dark:bg-[#0e1726] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Timestamp (GMT)</th>
                <th className="py-3 px-4">User / Actor</th>
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold">No audit logs matching selected filters</p>
                    <p className="text-[11px] mt-0.5">Try resetting search keywords or changing the module filter.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isCreate =
                    log.action.includes('ADD') ||
                    log.action.includes('RECORD') ||
                    log.action.includes('CREATE') ||
                    log.action.includes('CONVERT');
                  const isDelete =
                    log.action.includes('DELETE') || log.action.includes('ARCHIVE') || log.action.includes('REMOVE');

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition">
                      <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap text-[11px]">
                        {log.created_at}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {log.user_name}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold uppercase text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {log.module}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-semibold uppercase text-[10px] px-2 py-0.5 rounded border ${
                            isCreate
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : isDelete
                              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                              : 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                        {log.details}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
