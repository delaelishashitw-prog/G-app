import React from 'react';
import { History, Shield, Clock, Search, Filter } from 'lucide-react';
import { useChurchData } from '../contexts/ChurchDataContext';

export const AuditLogsPage: React.FC = () => {
  const { auditLogs } = useChurchData();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-slate-700" />
            Audit Trail & Security Logs
          </h1>
          <p className="text-xs text-slate-500">
            Immutable log of system modifications, financial records, and pastoral updates
          </p>
        </div>

        <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
          Total Recorded Actions: {auditLogs.length}
        </span>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Timestamp (GMT)</th>
                <th className="py-3 px-4">User / Actor</th>
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                    {log.created_at}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">{log.user_name}</td>
                  <td className="py-3 px-4">
                    <span className="font-semibold uppercase text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {log.module}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`font-semibold uppercase text-[10px] px-2 py-0.5 rounded ${
                        log.action.includes('ADD') || log.action.includes('RECORD') || log.action.includes('CONVERT')
                          ? 'bg-emerald-100 text-emerald-800'
                          : log.action.includes('ARCHIVE') || log.action.includes('DELETE')
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
