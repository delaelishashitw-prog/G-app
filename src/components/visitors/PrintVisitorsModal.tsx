import React, { useRef } from 'react';
import { X, Printer, Download, UserCheck, Calendar } from 'lucide-react';
import { Visitor } from '../../types/database.types';

interface PrintVisitorsModalProps {
  visitors: Visitor[];
  isOpen: boolean;
  onClose: () => void;
}

export const PrintVisitorsModal: React.FC<PrintVisitorsModalProps> = ({
  visitors,
  isOpen,
  onClose,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = [
      'Visitor Name',
      'Gender',
      'Phone Number',
      'Email',
      'Residential Address',
      'GhanaPost GPS',
      'First Visit Date',
      'Service Attended',
      'Invited By',
      'How Heard',
      'Prayer Request',
      'Follow-Up Status',
      'Assigned Minister',
      'Notes',
    ];

    const rows = visitors.map((v) => [
      `"${v.full_name || ''}"`,
      `"${v.gender || ''}"`,
      `"${v.phone || ''}"`,
      `"${v.email || ''}"`,
      `"${(v.address || '').replace(/"/g, '""')}"`,
      `"${v.gps_address || ''}"`,
      `"${v.visit_date || ''}"`,
      `"${(v.service_attended || '').replace(/"/g, '""')}"`,
      `"${(v.invited_by || '').replace(/"/g, '""')}"`,
      `"${(v.how_heard || '').replace(/"/g, '""')}"`,
      `"${(v.prayer_request || '').replace(/"/g, '""')}"`,
      `"${v.follow_up_status || ''}"`,
      `"${(v.assigned_to_name || '').replace(/"/g, '""')}"`,
      `"${(v.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `GWCC_Visitors_Register_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Controls Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between no-print">
          <div>
            <h3 className="text-base font-bold text-slate-900">Print / Export Visitors Register</h3>
            <p className="text-xs text-slate-500">
              Formatted pastoral follow-up tracking register for Sunday evangelism & assimilation team
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Sheet</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Print preview content */}
        <div ref={printAreaRef} className="p-8 overflow-y-auto print-container space-y-6 text-xs text-slate-800">
          {/* Document Header */}
          <div className="text-center pb-4 border-b-2 border-slate-900 space-y-1">
            <h1 className="text-xl font-bold uppercase tracking-wider text-slate-900">
              Greater Works City Church (GWCC)
            </h1>
            <p className="text-xs font-semibold text-slate-600">
              P.O. Box JM 102, Joma - Ablekuma, Greater Accra, Ghana | Contact: +233 24 000 0000
            </p>
            <h2 className="text-sm font-bold text-blue-900 uppercase pt-1">
              Visitors Assimilation & Pastoral Care Follow-Up Register
            </h2>
            <p className="text-[11px] text-slate-500 font-mono">
              Generated: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} · Total Records: {visitors.length}
            </p>
          </div>

          {/* Table */}
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b-2 border-slate-800 text-slate-900 font-bold bg-slate-50">
                <th className="py-2 px-2 w-8">#</th>
                <th className="py-2 px-2">Visitor Name & Phone</th>
                <th className="py-2 px-2">Location & GPS</th>
                <th className="py-2 px-2">Visit Date & Service</th>
                <th className="py-2 px-2">Invited By / Source</th>
                <th className="py-2 px-2">Prayer Need</th>
                <th className="py-2 px-2">Assigned Minister</th>
                <th className="py-2 px-2 w-24 text-center">Status</th>
                <th className="py-2 px-2 w-20 text-center">Call / Visit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visitors.map((v, index) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="py-2 px-2 font-mono text-slate-400">{index + 1}</td>
                  <td className="py-2 px-2">
                    <span className="font-bold text-slate-900 block">{v.full_name}</span>
                    <span className="font-mono text-slate-600 text-[11px]">{v.phone}</span>
                  </td>
                  <td className="py-2 px-2 text-[11px]">
                    <span className="block text-slate-800">{v.address || 'Joma area'}</span>
                    {v.gps_address && <span className="font-mono text-slate-500">{v.gps_address}</span>}
                  </td>
                  <td className="py-2 px-2 text-[11px]">
                    <span className="font-mono block">{v.visit_date}</span>
                    <span className="text-slate-500 truncate max-w-[140px] block">{v.service_attended}</span>
                  </td>
                  <td className="py-2 px-2 text-[11px] text-slate-600">
                    {v.invited_by || v.how_heard || 'Walk-in'}
                  </td>
                  <td className="py-2 px-2 text-[11px] text-slate-700 italic max-w-[180px]">
                    {v.prayer_request || '—'}
                  </td>
                  <td className="py-2 px-2 text-[11px] font-medium text-slate-800">
                    {v.assigned_to_name || 'Pastoral Team'}
                  </td>
                  <td className="py-2 px-2 text-[10px] text-center font-semibold capitalize text-slate-700">
                    {v.follow_up_status.replace(/_/g, ' ')}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <div className="w-5 h-5 mx-auto border border-slate-400 rounded-sm"></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer Sign-off */}
          <div className="pt-8 border-t border-slate-300 grid grid-cols-2 gap-8 text-xs text-slate-600">
            <div>
              <p className="font-bold text-slate-800 mb-6">Head of Evangelism & Visitation Department:</p>
              <div className="border-b border-slate-400 w-48 mb-1"></div>
              <p className="text-[11px]">Signature & Date</p>
            </div>
            <div>
              <p className="font-bold text-slate-800 mb-6">Pastoral Oversight Minister:</p>
              <div className="border-b border-slate-400 w-48 mb-1"></div>
              <p className="text-[11px]">Pastor David Osei-Tutu / Lady Pastor Mercy</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
