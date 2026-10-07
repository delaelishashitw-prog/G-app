import React from 'react';
import { X, Printer, Users, BookOpen } from 'lucide-react';
import { Member, ChurchSettings } from '../../types/database.types';

interface PrintDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  settings: ChurchSettings;
  filterLabel?: string;
}

export const PrintDirectoryModal: React.FC<PrintDirectoryModalProps> = ({
  isOpen,
  onClose,
  members,
  settings,
  filterLabel,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const activeCount = members.filter((m) => m.status === 'active').length;
  const leadersCount = members.filter((m) => m.status === 'leader' || Boolean(m.leadership_position)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[94vh] flex flex-col">
        {/* Top Control Bar */}
        <div className="px-6 py-4 bg-[#064e3b] text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-emerald-700/60 rounded-xl">
              <Printer className="w-5 h-5 text-emerald-200" />
            </span>
            <div>
              <h3 className="text-base font-bold">Print Congregational Membership Directory</h3>
              <p className="text-xs text-emerald-200">
                Official pastoral registry & contact book for ministerial leadership
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Print Directory</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white rounded-lg transition hover:bg-emerald-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper Document */}
        <div className="p-8 text-slate-900 overflow-y-auto flex-1 font-sans bg-white print:p-0">
          {/* Header */}
          <div className="border-b-2 border-emerald-900 pb-4 mb-6 text-center">
            <h1 className="text-xl font-black uppercase tracking-wider text-emerald-950">
              {settings.church_name}
            </h1>
            <p className="text-xs font-semibold text-slate-600 tracking-wide mt-0.5">
              {settings.branch_name || 'Joma Assembly'} • {settings.location}
            </p>
            <p className="text-[11px] text-slate-500">
              GPS Address: {settings.gps_address} • Phone: {settings.phone} • Senior Pastor: {settings.senior_pastor || 'Prophet Elisha K. Richard'}
            </p>
            <div className="inline-block mt-3 px-4 py-1 bg-emerald-900 text-white text-xs font-bold tracking-widest uppercase rounded">
              OFFICIAL CONGREGATIONAL MEMBERSHIP DIRECTORY & PASTORAL REGISTER
            </div>
          </div>

          {/* Directory Metadata Summary */}
          <div className="grid grid-cols-4 gap-3 mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Print Date</span>
              <span className="font-bold text-slate-800">
                {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Listed</span>
              <span className="font-bold text-slate-800">{members.length} Members</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Active & Leaders</span>
              <span className="font-black text-emerald-900">
                {activeCount} Active • {leadersCount} Leaders
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Filter Scope</span>
              <span className="font-bold text-slate-800 truncate block">
                {filterLabel || 'Full Congregation'}
              </span>
            </div>
          </div>

          {/* Members Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200">
              <thead>
                <tr className="bg-emerald-950 text-white uppercase text-[10px] tracking-wider font-bold">
                  <th className="p-2 border border-emerald-900">Member ID</th>
                  <th className="p-2 border border-emerald-900">Full Name</th>
                  <th className="p-2 border border-emerald-900">Phone Contact</th>
                  <th className="p-2 border border-emerald-900">Ministry & Cell Group</th>
                  <th className="p-2 border border-emerald-900">Status</th>
                  <th className="p-2 border border-emerald-900">Residential & GPS</th>
                  <th className="p-2 border border-emerald-900">Tithe #</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {members.map((m, idx) => (
                  <tr key={m.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="p-2 font-mono font-bold text-slate-900 border border-slate-200 whitespace-nowrap">
                      {m.member_id}
                    </td>
                    <td className="p-2 font-semibold text-slate-900 border border-slate-200 whitespace-nowrap">
                      {m.first_name} {m.middle_name ? `${m.middle_name} ` : ''}{m.last_name}
                      {m.leadership_position && (
                        <div className="text-[10px] text-purple-700 font-bold uppercase">
                          ★ {m.leadership_position}
                        </div>
                      )}
                    </td>
                    <td className="p-2 font-mono text-slate-700 border border-slate-200 whitespace-nowrap">
                      {m.phone}
                      {m.alternative_phone && <div className="text-[10px] text-slate-400">{m.alternative_phone}</div>}
                    </td>
                    <td className="p-2 text-slate-700 border border-slate-200">
                      <div className="font-semibold text-slate-800">{m.ministry_name || '—'}</div>
                      <div className="text-[10px] text-slate-500">{m.small_group_name || 'General Fellowship'}</div>
                    </td>
                    <td className="p-2 border border-slate-200 capitalize font-medium text-slate-800">
                      {m.status.replace('_', ' ')}
                    </td>
                    <td className="p-2 text-slate-600 border border-slate-200 text-[11px]">
                      <div>{m.residential_address || m.city || '—'}</div>
                      {m.gps_address && <div className="font-mono text-[10px] text-slate-400">{m.gps_address}</div>}
                    </td>
                    <td className="p-2 font-mono font-semibold text-slate-700 border border-slate-200 whitespace-nowrap">
                      {m.tithe_number || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pastoral Confidentiality Notice & Signatures */}
          <div className="mt-8 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
            <span className="font-bold text-slate-800 block">Pastoral Confidentiality Disclaimer:</span>
            <p>
              This membership directory contains confidential congregation contact and residence information for Greater Works City Church. It is issued strictly for authorized ministerial pastoring, visitation, and care. Unauthorized reproduction or commercial distribution is prohibited.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t-2 border-slate-200 grid grid-cols-2 gap-8 text-center text-xs">
            <div className="space-y-6">
              <div className="border-b border-slate-400 pb-1"></div>
              <div>
                <p className="font-bold text-slate-800">Deaconess Akosua Frimpong</p>
                <p className="text-[10px] text-slate-500 uppercase">Head of Church Secretariat & Membership Records</p>
              </div>
            </div>

            <div className="space-y-6">
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
