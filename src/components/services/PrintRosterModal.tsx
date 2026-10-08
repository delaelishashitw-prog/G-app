import React from 'react';
import { X, Printer, Users } from 'lucide-react';
import { RosterAssignment, ChurchSettings } from '../../types/database.types';

interface PrintRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignments: RosterAssignment[];
  settings: ChurchSettings;
  selectedDate: string;
  selectedServiceName?: string;
}

const DEPT_TITLES: Record<string, string> = {
  sound_media: 'Sound & Media Engineering',
  praise_team: 'Voice of Dominion (Choir & Band)',
  ushers_protocol: 'Ushers & Protocol Board',
  intercessors: 'Altar & Intercessory Board',
  children_ministry: "Children's Ministry Teachers",
  car_park_security: 'Car Park & Compound Security',
  sanctuary_cleaning: 'Sanctuary Care & Preparation',
};

export const PrintRosterModal: React.FC<PrintRosterModalProps> = ({
  isOpen,
  onClose,
  assignments,
  settings,
  selectedDate,
  selectedServiceName,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  // Filter assignments by selected date and service
  const filteredAssignments = React.useMemo(() => {
    return assignments.filter((a) => {
      const matchDate =
        !selectedDate || selectedDate === 'ALL' || a.date === selectedDate;
      const matchService =
        !selectedServiceName ||
        selectedServiceName === 'ALL' ||
        (a.service_name && a.service_name.toLowerCase() === selectedServiceName.toLowerCase());
      return matchDate && matchService;
    });
  }, [assignments, selectedDate, selectedServiceName]);

  // Group filtered assignments by department
  const groupedByDept = React.useMemo(() => {
    return filteredAssignments.reduce((acc, curr) => {
      const list = acc[curr.department] || [];
      list.push(curr);
      acc[curr.department] = list;
      return acc;
    }, {} as Record<string, RosterAssignment[]>);
  }, [filteredAssignments]);

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
              <h3 className="text-base font-bold">Print Multi-Department Duty Roster</h3>
              <p className="text-xs text-emerald-200">
                Official ministerial steward roster for church noticeboards & sanctuary desks
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Print Roster</span>
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
              GPS: {settings.gps_address} • Tel: {settings.phone} • Senior Pastor: {settings.senior_pastor || 'Prophet Elisha K. Richard'}
            </p>
            <div className="inline-block mt-3 px-4 py-1 bg-emerald-900 text-white text-xs font-bold tracking-widest uppercase rounded">
              OFFICIAL MULTI-DEPARTMENT DUTY ROSTER & MINISTERIAL STEWARDS
            </div>
          </div>

          {/* Service Details Row */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mb-6 grid grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Service Date</span>
              <span className="font-bold text-slate-900">{selectedDate}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Church Service</span>
              <span className="font-bold text-slate-900">{selectedServiceName || 'All Scheduled Services'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Stewards On Duty</span>
              <span className="font-black text-emerald-900">{filteredAssignments.length} Ministers / Volunteers</span>
            </div>
          </div>

          {/* Duty Assignments Grouped by Department */}
          <div className="space-y-6">
            {filteredAssignments.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-700">No duty assignments scheduled</p>
                <p className="text-slate-500 mt-0.5">
                  No ministers or stewards are assigned for {selectedServiceName || 'all services'} on {selectedDate}.
                </p>
              </div>
            ) : (
              Object.entries(groupedByDept).map(([deptKey, deptAssignments]) => (
              <div key={deptKey} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-emerald-950 text-white px-4 py-2 flex items-center justify-between text-xs font-bold">
                  <span className="uppercase tracking-wider">
                    {DEPT_TITLES[deptKey] || deptKey.replace('_', ' ')}
                  </span>
                  <span className="text-emerald-200 text-[11px]">
                    {deptAssignments.length} Steward{deptAssignments.length > 1 ? 's' : ''}
                  </span>
                </div>

                <table className="w-full text-left text-xs divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
                    <tr>
                      <th className="p-2.5">Steward / Minister</th>
                      <th className="p-2.5">Assigned Role</th>
                      <th className="p-2.5">Report Call Time</th>
                      <th className="p-2.5">Phone Contact</th>
                      <th className="p-2.5">Duty Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deptAssignments.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/50">
                        <td className="p-2.5 font-bold text-slate-900">{a.member_name}</td>
                        <td className="p-2.5 font-semibold text-emerald-900">{a.role_title}</td>
                        <td className="p-2.5 font-mono text-slate-700">{a.report_time}</td>
                        <td className="p-2.5 font-mono text-slate-600">{a.member_phone || '—'}</td>
                        <td className="p-2.5 text-slate-600 text-[11px]">{a.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
          </div>

          {/* Ministerial Instructions */}
          <div className="mt-8 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
            <span className="font-bold text-slate-800 block">Stewardship Guidelines:</span>
            <p>1. All stewards are required to report at least 30 minutes prior to scheduled call time for pre-service corporate prayer.</p>
            <p>2. If unable to minister due to unforeseen emergency, inform your department head at least 24 hours in advance to arrange an authorized substitute.</p>
          </div>

          {/* Verification Signatures */}
          <div className="mt-10 pt-6 border-t-2 border-slate-200 grid grid-cols-2 gap-8 text-center text-xs">
            <div className="space-y-6">
              <div className="border-b border-slate-400 pb-1"></div>
              <div>
                <p className="font-bold text-slate-800">Pastor Emmanuel Osei</p>
                <p className="text-[10px] text-slate-500 uppercase">Head of Ministerial Coordination & Stewards</p>
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
