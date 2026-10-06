import React from 'react';
import { Printer, X, Download, ShieldCheck, CheckCircle2, Users } from 'lucide-react';
import { ChurchSettings, ChurchService, AttendanceRecord, HeadcountRecord } from '../../types/database.types';
import { formatServiceDayString } from '../../lib/attendanceDateUtils';

interface PrintAttendanceRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  service?: ChurchService;
  date: string;
  settings: ChurchSettings;
  records: AttendanceRecord[];
  headcount?: HeadcountRecord;
}

export const PrintAttendanceRegisterModal: React.FC<PrintAttendanceRegisterModalProps> = ({
  isOpen,
  onClose,
  service,
  date,
  settings,
  records,
  headcount,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const membersList = records.filter((r) => r.person_type === 'member');
  const visitorsList = records.filter((r) => r.person_type === 'visitor');

  const formattedDate = formatServiceDayString(date);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 my-auto">
        {/* Modal Toolbar (hidden when printing) */}
        <div className="no-print p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-teal-400" />
            <span className="font-bold text-sm">Official Attendance Register & Report</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition shadow-md"
            >
              <Printer className="w-4 h-4" />
              <span>Print Register / Save as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Register Sheet */}
        <div className="p-8 sm:p-12 overflow-y-auto flex-1 font-sans text-slate-900 bg-white" id="printable-register">
          {/* Header */}
          <div className="text-center border-b-2 border-slate-900 pb-6 mb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-teal-800 text-white font-black text-xl flex items-center justify-center shadow-md overflow-hidden">
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  settings.short_name?.slice(0, 2) || 'GW'
                )}
              </div>
              <div className="text-left">
                <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 leading-none">
                  {settings.church_name}
                </h1>
                <p className="text-xs font-semibold text-slate-600 mt-0.5">
                  {settings.branch_name ? `${settings.branch_name} • ` : ''}{settings.location}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Address: {settings.address} • GPS: {settings.gps_address} • Tel: {settings.phone}
            </p>
            <div className="mt-4 inline-block bg-slate-100 px-4 py-1.5 rounded-full border border-slate-300">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Official Congregation Attendance Register
              </h2>
            </div>
          </div>

          {/* Service & Date Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs mb-6">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">Service</span>
              <p className="font-bold text-slate-900 mt-0.5">{service?.name || 'Worship Service'}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">Date</span>
              <p className="font-bold text-slate-900 mt-0.5">{formattedDate}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">Time</span>
              <p className="font-bold text-slate-900 mt-0.5">
                {service ? `${service.start_time} - ${service.end_time}` : 'Morning Service'}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">Venue</span>
              <p className="font-bold text-slate-900 mt-0.5">
                {service?.venue || settings.location || 'Church Auditorium'}
              </p>
            </div>
          </div>

          {/* Headcount Summary Table */}
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Auditorium Headcount Summary
            </h3>
            <table className="w-full border-collapse border border-slate-300 text-xs text-center">
              <thead>
                <tr className="bg-slate-100 font-bold text-slate-800">
                  <th className="border border-slate-300 p-2">Men</th>
                  <th className="border border-slate-300 p-2">Women</th>
                  <th className="border border-slate-300 p-2">Youth</th>
                  <th className="border border-slate-300 p-2">Children</th>
                  <th className="border border-slate-300 p-2">Visitors</th>
                  <th className="border border-slate-300 p-2">Ushers/Protocol</th>
                  <th className="border border-slate-300 p-2">Online Stream</th>
                  <th className="border border-slate-300 p-2 bg-teal-50 text-teal-900 font-extrabold">
                    Auditorium Total
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="font-bold text-slate-800 font-mono text-sm">
                  <td className="border border-slate-300 p-2">{headcount?.men || 0}</td>
                  <td className="border border-slate-300 p-2">{headcount?.women || 0}</td>
                  <td className="border border-slate-300 p-2">{headcount?.youth || 0}</td>
                  <td className="border border-slate-300 p-2">{headcount?.children || 0}</td>
                  <td className="border border-slate-300 p-2 text-blue-700">{headcount?.visitors || visitorsList.length}</td>
                  <td className="border border-slate-300 p-2">{headcount?.ushers_protocol || 0}</td>
                  <td className="border border-slate-300 p-2 text-slate-500">{headcount?.online_viewers || 0}</td>
                  <td className="border border-slate-300 p-2 bg-teal-50 text-teal-800 text-base font-black">
                    {headcount?.total_auditorium ||
                      (headcount ? headcount.men + headcount.women + headcount.children + headcount.visitors : records.length)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Detailed Attendees Roster */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Logged Attendees Roster ({records.length} Recorded)
              </h3>
              <span className="text-[11px] text-slate-500">
                {membersList.length} Members • {visitorsList.length} Visitors
              </span>
            </div>

            <table className="w-full border-collapse border border-slate-300 text-xs">
              <thead>
                <tr className="bg-slate-100 font-bold text-slate-800 text-left">
                  <th className="border border-slate-300 p-2 w-10 text-center">#</th>
                  <th className="border border-slate-300 p-2">Full Name</th>
                  <th className="border border-slate-300 p-2 w-28">Type</th>
                  <th className="border border-slate-300 p-2 w-32">Check-In Method</th>
                  <th className="border border-slate-300 p-2 w-28 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {records.length > 0 ? (
                  records.map((rec, index) => (
                    <tr key={rec.id} className="hover:bg-slate-50">
                      <td className="border border-slate-300 p-2 text-center text-slate-400 font-mono">
                        {index + 1}
                      </td>
                      <td className="border border-slate-300 p-2 font-bold text-slate-900">
                        {rec.person_name || rec.member_name || rec.visitor_name || 'Attendee'}
                      </td>
                      <td className="border border-slate-300 p-2 capitalize">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rec.person_type === 'visitor'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {rec.person_type || 'member'}
                        </span>
                      </td>
                      <td className="border border-slate-300 p-2 text-slate-600 capitalize">
                        {rec.check_in_method || 'manual'}
                      </td>
                      <td className="border border-slate-300 p-2 text-right font-mono text-slate-500">
                        {rec.check_in_time ? new Date(rec.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="border border-slate-300 p-4 text-center text-slate-400">
                      No individual check-ins recorded for this session.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Signatures & Certification */}
          <div className="pt-8 border-t-2 border-slate-200 grid grid-cols-3 gap-6 text-xs text-slate-700">
            <div>
              <p className="font-bold text-slate-900">Head Usher / Protocol Lead</p>
              <div className="border-b border-dashed border-slate-400 h-10 mt-2 mb-1"></div>
              <p className="text-[11px] text-slate-500">
                Name: {headcount?.counted_by || 'Usher / Protocol Lead'}
              </p>
              <p className="text-[10px] text-slate-400">Sign & Date</p>
            </div>

            <div>
              <p className="font-bold text-slate-900">General Secretary</p>
              <div className="border-b border-dashed border-slate-400 h-10 mt-2 mb-1 flex items-end justify-start pb-0.5">
                <span className="font-serif italic text-xs text-slate-700">{settings.general_secretary || ''}</span>
              </div>
              <p className="text-[11px] text-slate-600 font-semibold">{settings.general_secretary || 'General Secretary'}</p>
              <p className="text-[10px] text-slate-400">Sign & Date</p>
            </div>

            <div>
              <p className="font-bold text-slate-900">Resident Pastor Endorsement</p>
              <div className="border-b border-dashed border-slate-400 h-10 mt-2 mb-1 flex items-end justify-start pb-0.5">
                <span className="font-serif italic text-xs text-slate-700">{settings.senior_pastor || ''}</span>
              </div>
              <p className="text-[11px] text-emerald-800 font-semibold">{settings.senior_pastor || 'Senior Pastor'}</p>
              <p className="text-[10px] text-slate-400">Sign & Stamp</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
