import React, { useRef } from 'react';
import { X, Printer, Package, Download } from 'lucide-react';
import { ChurchAsset, ChurchSettings } from '../../types/database.types';
import { formatGHS } from '../../lib/currencyUtils';

interface PrintAssetRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: ChurchAsset[];
  settings: ChurchSettings;
}

export const PrintAssetRegisterModal: React.FC<PrintAssetRegisterModalProps> = ({
  isOpen,
  onClose,
  assets,
  settings,
}) => {
  if (!isOpen) return null;

  const totalValuation = assets.reduce((sum, a) => sum + a.purchase_cost, 0);
  const workingCount = assets.filter((a) => a.current_condition === 'working').length;
  const maintenanceCount = assets.filter((a) => a.current_condition === 'under_maintenance').length;
  const faultyCount = assets.filter((a) => a.current_condition === 'faulty').length;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[94vh] flex flex-col">
        {/* Modal Top Bar */}
        <div className="px-6 py-4 bg-[#064e3b] text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-emerald-700/60 rounded-xl">
              <Printer className="w-5 h-5 text-emerald-200" />
            </span>
            <div>
              <h3 className="text-base font-bold">Print Church Asset & Equipment Register</h3>
              <p className="text-xs text-emerald-200">
                Official physical audit manifest for council and trustee records
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Print Register</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white rounded-lg transition hover:bg-emerald-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Paper */}
        <div className="p-8 text-slate-900 overflow-y-auto flex-1 font-sans bg-white print:p-0">
          {/* Church Letterhead */}
          <div className="border-b-2 border-emerald-900 pb-4 mb-6 text-center">
            <h1 className="text-xl font-black uppercase tracking-wider text-emerald-950">
              {settings.church_name}
            </h1>
            <p className="text-xs font-semibold text-slate-600 tracking-wide mt-0.5">
              {settings.branch_name || 'Joma Assembly'} • {settings.location}
            </p>
            <p className="text-[11px] text-slate-500">
              GPS Address: {settings.gps_address} • Tel: {settings.phone} • Email: {settings.email}
            </p>
            <div className="inline-block mt-3 px-4 py-1 bg-emerald-900 text-white text-xs font-bold tracking-widest uppercase rounded">
              OFFICIAL CHURCH ASSET & EQUIPMENT AUDIT REGISTER
            </div>
          </div>

          {/* Audit Metadata Summary */}
          <div className="grid grid-cols-4 gap-3 mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Date of Audit</span>
              <span className="font-bold text-slate-800">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Registered Assets</span>
              <span className="font-bold text-slate-800">{assets.length} items</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Replacement Value</span>
              <span className="font-black text-emerald-900">{formatGHS(totalValuation)}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Operational Status</span>
              <span className="font-bold text-slate-800">
                {workingCount} OK • {maintenanceCount} Maint • {faultyCount} Faulty
              </span>
            </div>
          </div>

          {/* Asset Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200">
              <thead>
                <tr className="bg-emerald-950 text-white uppercase text-[10px] tracking-wider font-bold">
                  <th className="p-2 border border-emerald-900">Tag ID</th>
                  <th className="p-2 border border-emerald-900">Equipment Description</th>
                  <th className="p-2 border border-emerald-900">Brand / Serial No</th>
                  <th className="p-2 border border-emerald-900">Department & Location</th>
                  <th className="p-2 border border-emerald-900 text-right">Value (GH₵)</th>
                  <th className="p-2 border border-emerald-900">Condition</th>
                  <th className="p-2 border border-emerald-900">Custodian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {assets.map((a, idx) => (
                  <tr key={a.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="p-2 font-mono font-bold text-slate-900 border border-slate-200">
                      {a.asset_tag}
                    </td>
                    <td className="p-2 font-semibold text-slate-900 border border-slate-200">
                      {a.name}
                    </td>
                    <td className="p-2 text-slate-700 border border-slate-200">
                      <div>{a.brand || '—'} {a.model || ''}</div>
                      <div className="font-mono text-[10px] text-slate-500">{a.serial_number || 'No S/N'}</div>
                    </td>
                    <td className="p-2 text-slate-700 border border-slate-200">
                      <div className="font-semibold">{a.department}</div>
                      <div className="text-[10px] text-slate-500">{a.location}</div>
                    </td>
                    <td className="p-2 text-right font-mono font-bold text-slate-900 border border-slate-200">
                      {a.purchase_cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-slate-200 capitalize font-medium text-slate-800">
                      {a.current_condition.replace('_', ' ')}
                    </td>
                    <td className="p-2 text-slate-700 border border-slate-200 font-medium">
                      {a.custodian_name}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-black text-slate-900">
                  <td colSpan={4} className="p-2.5 text-right uppercase border border-slate-200">
                    Grand Total Inventory Valuation:
                  </td>
                  <td className="p-2.5 text-right font-mono text-emerald-900 border border-slate-200">
                    {formatGHS(totalValuation)}
                  </td>
                  <td colSpan={2} className="border border-slate-200"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Audit Verification Signatures */}
          <div className="mt-12 pt-6 border-t-2 border-slate-200 grid grid-cols-3 gap-8 text-center text-xs">
            <div className="space-y-8">
              <div className="border-b border-slate-400 pb-1"></div>
              <div>
                <p className="font-bold text-slate-800">Brother Kwame Mensah</p>
                <p className="text-[10px] text-slate-500 uppercase">Head of Audio & Technical Logistics</p>
              </div>
            </div>

            <div className="space-y-8">
              <div className="border-b border-slate-400 pb-1"></div>
              <div>
                <p className="font-bold text-slate-800">Elder Kofi Addo</p>
                <p className="text-[10px] text-slate-500 uppercase">Chairman, Facilities & Property Board</p>
              </div>
            </div>

            <div className="space-y-8">
              <div className="border-b border-slate-400 pb-1"></div>
              <div>
                <p className="font-bold text-slate-800">Prophet Elisha K. Richard</p>
                <p className="text-[10px] text-slate-500 uppercase">Senior Pastor & General Overseer</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
