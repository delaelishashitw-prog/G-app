import React, { useState } from 'react';
import { X, Printer, Download, Filter, Building2, Coins, CheckCircle } from 'lucide-react';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { formatGHS } from '../../lib/currencyUtils';
import { PledgeRecord } from '../../types/database.types';

interface PrintPledgesModalProps {
  isOpen: boolean;
  onClose: () => void;
  pledgesList: PledgeRecord[];
}

export const PrintPledgesModal: React.FC<PrintPledgesModalProps> = ({
  isOpen,
  onClose,
  pledgesList,
}) => {
  const { settings, campaigns } = useChurchData();
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  if (!isOpen) return null;

  const filteredPledges = pledgesList.filter((p) => {
    if (selectedCampaign !== 'all' && p.campaign_name !== selectedCampaign && p.campaign_id !== selectedCampaign) {
      return false;
    }
    if (selectedStatus !== 'all' && p.status !== selectedStatus) {
      return false;
    }
    return true;
  });

  const totalPledged = filteredPledges.reduce((s, p) => s + p.amount_pledged, 0);
  const totalPaid = filteredPledges.reduce((s, p) => s + p.amount_paid, 0);
  const totalBalance = filteredPledges.reduce((s, p) => s + p.balance, 0);
  const realizationRate = totalPledged > 0 ? ((totalPaid / totalPledged) * 100).toFixed(1) : '0';

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    const headers = [
      'Member Name',
      'Phone',
      'Campaign',
      'Pledged (GHS)',
      'Paid (GHS)',
      'Balance (GHS)',
      'Start Date',
      'Due Date',
      'Status',
      'Notes',
    ];

    const rows = filteredPledges.map((p) => [
      `"${p.member_name.replace(/"/g, '""')}"`,
      `"${(p.member_phone || '').replace(/"/g, '""')}"`,
      `"${p.campaign_name.replace(/"/g, '""')}"`,
      p.amount_pledged.toFixed(2),
      p.amount_paid.toFixed(2),
      p.balance.toFixed(2),
      p.start_date || '',
      p.due_date || '',
      p.status,
      `"${(p.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GWCC_Pledges_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[95vh] flex flex-col">
        {/* Modal Controls (Hidden in Print) */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-900 to-indigo-950 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-2.5">
            <Printer className="w-5 h-5 text-amber-300" />
            <div>
              <h3 className="text-base font-bold">Pledges & Kingdom Commitments Registry</h3>
              <p className="text-xs text-purple-200">
                Official Printable Sheet & Audited Capital Campaign Report
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-purple-200 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Toolbar (Hidden in Print) */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 no-print text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-700 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-purple-700" />
              Filter by:
            </span>
            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-hidden"
            >
              <option value="all">All Campaigns ({campaigns.length})</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-hidden"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active (No Payment Yet)</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="completed">Completed / Redeemed</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-semibold flex items-center gap-1.5 transition shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-xs transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Sheet</span>
            </button>
          </div>
        </div>

        {/* Printable Paper Canvas */}
        <div className="p-8 overflow-y-auto flex-1 bg-white print:p-0 print:overflow-visible">
          {/* Official Letterhead */}
          <div className="text-center pb-6 border-b-2 border-purple-900">
            <h1 className="text-2xl font-black text-purple-950 uppercase tracking-tight">
              {settings.church_name || 'Greater Works City Church'}
            </h1>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              {settings.address || 'Joma, Ablekuma - Greater Accra Region, Ghana'}
            </p>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              Phone: {settings.phone || '+233 24 456 1234'} • Email: info@greaterworkscity.org
            </p>
            <div className="mt-3 inline-block bg-purple-900 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              Capital Project Pledges & Covenant Redemption Statement
            </div>
            <p className="text-[10px] text-slate-400 mt-1 font-mono">
              Generated on: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} at{' '}
              {new Date().toLocaleTimeString()}
            </p>
          </div>

          {/* Report Financial Metrics Banner */}
          <div className="grid grid-cols-4 gap-4 py-5 border-b border-slate-200 text-center font-mono">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-[10px] font-sans font-bold uppercase text-slate-500">
                Total Pledged
              </div>
              <div className="text-base font-extrabold text-slate-900 mt-0.5">
                {formatGHS(totalPledged)}
              </div>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <div className="text-[10px] font-sans font-bold uppercase text-emerald-700">
                Redeemed & Paid
              </div>
              <div className="text-base font-extrabold text-emerald-800 mt-0.5">
                {formatGHS(totalPaid)}
              </div>
            </div>
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
              <div className="text-[10px] font-sans font-bold uppercase text-purple-900">
                Outstanding Balance
              </div>
              <div className="text-base font-extrabold text-purple-900 mt-0.5">
                {formatGHS(totalBalance)}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-[10px] font-sans font-bold uppercase text-slate-500">
                Realization Rate
              </div>
              <div className="text-base font-extrabold text-purple-900 mt-0.5">
                {realizationRate}%
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="mt-5">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-300 bg-slate-100 text-[10px] uppercase font-bold text-slate-700">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Member Name</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3">Campaign Project</th>
                  <th className="py-2.5 px-3 text-right">Pledged (GH₵)</th>
                  <th className="py-2.5 px-3 text-right">Paid (GH₵)</th>
                  <th className="py-2.5 px-3 text-right">Balance (GH₵)</th>
                  <th className="py-2.5 px-3 text-center">Due Date</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-sans">
                {filteredPledges.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-2 px-3 font-bold text-slate-900">{p.member_name}</td>
                    <td className="py-2 px-3 font-mono text-slate-600 text-[11px]">
                      {p.member_phone || '—'}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-700">{p.campaign_name}</td>
                    <td className="py-2 px-3 font-mono font-bold text-slate-800 text-right">
                      {p.amount_pledged.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-emerald-700 text-right">
                      {p.amount_paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-purple-900 text-right">
                      {p.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-500 text-center text-[11px]">
                      {p.due_date || 'Open'}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          p.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.status === 'partially_paid'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {p.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Official Sign-off Blocks */}
          <div className="mt-12 pt-8 border-t border-slate-200 grid grid-cols-3 gap-6 text-center text-xs">
            <div className="space-y-10">
              <div className="border-b border-slate-400 w-3/4 mx-auto" />
              <div>
                <p className="font-bold text-slate-900">Church Finance Officer</p>
                <p className="text-[10px] text-slate-500">Greater Works City Church</p>
              </div>
            </div>

            <div className="space-y-10">
              <div className="border-b border-slate-400 w-3/4 mx-auto" />
              <div>
                <p className="font-bold text-slate-900">Building Committee Chairman</p>
                <p className="text-[10px] text-slate-500">Cathedral Development Board</p>
              </div>
            </div>

            <div className="space-y-10">
              <div className="border-b border-slate-400 w-3/4 mx-auto" />
              <div>
                <p className="font-bold text-slate-900">Senior / Resident Pastor</p>
                <p className="text-[10px] text-slate-500">Greater Works City Church</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
