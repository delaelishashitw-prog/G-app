import React, { useState, useMemo } from 'react';
import {
  X,
  Printer,
  HeartHandshake,
  Calendar,
  Building,
  CheckCircle2,
  Users,
  Shield,
  MapPin,
  Sparkles,
} from 'lucide-react';
import {
  PastoralVisitationRecord,
  PastoralCounselingSession,
  PrayerRequest,
  ChurchSettings,
} from '../../types/database.types';

interface PrintPastoralReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  visitations: PastoralVisitationRecord[];
  counselingSessions: PastoralCounselingSession[];
  prayerRequests: PrayerRequest[];
  settings: ChurchSettings;
}

export const PrintPastoralReportModal: React.FC<PrintPastoralReportModalProps> = ({
  isOpen,
  onClose,
  visitations,
  counselingSessions,
  prayerRequests,
  settings,
}) => {
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'this_month' | 'last_30_days'>('all');

  const filteredVisitations = useMemo(() => {
    if (filterPeriod === 'all') return visitations;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    return visitations.filter((v) => new Date(v.date) >= thirtyDaysAgo);
  }, [visitations, filterPeriod]);

  const filteredCounseling = useMemo(() => {
    if (filterPeriod === 'all') return counselingSessions;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    return counselingSessions.filter((c) => new Date(c.date) >= thirtyDaysAgo);
  }, [counselingSessions, filterPeriod]);

  const answeredPrayers = useMemo(() => {
    return prayerRequests.filter((p) => p.status === 'answered');
  }, [prayerRequests]);

  const activePrayers = useMemo(() => {
    return prayerRequests.filter((p) => p.status === 'praying' || p.status === 'new');
  }, [prayerRequests]);

  const urgentWatchlist = useMemo(() => {
    return visitations.filter(
      (v) =>
        v.status === 'urgent_followup' ||
        v.spiritual_condition === 'critical' ||
        v.visitation_type === 'hospital_visit' ||
        v.visitation_type === 'bereavement'
    );
  }, [visitations]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Controls (Hidden in Print) */}
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <HeartHandshake className="w-5 h-5 text-emerald-800" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Pastoral Shepherding & Ministerial Report Dossier
              </h3>
              <p className="text-[11px] text-slate-500">
                Official Ministerial Summary for Senior Pastor & Elders Council
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value as any)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-700"
            >
              <option value="all">All Historical Records</option>
              <option value="this_month">This Month</option>
              <option value="last_30_days">Past 30 Days</option>
            </select>

            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Dossier</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper Canvas */}
        <div className="flex-1 overflow-y-auto p-8 text-slate-900 bg-white print:p-0 print:overflow-visible">
          {/* Header */}
          <div className="border-b-2 border-emerald-900 pb-4 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-extrabold tracking-widest text-emerald-800 uppercase">
                  Official Secretariat & Pastoral Care Records
                </span>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                  {settings.church_name || 'Greater Works City Church'}
                </h1>
                <p className="text-xs font-semibold text-slate-600">
                  {settings.branch_name || 'City of Refuge - Joma Central'} • {settings.location}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  General Overseer: <strong className="text-slate-800">{settings.senior_pastor || 'Prophet Elisha K. Richard'}</strong>
                  {settings.gps_address ? ` • GPS: ${settings.gps_address}` : ''}
                </p>
              </div>

              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-900 rounded-lg text-xs font-black uppercase tracking-wider border border-emerald-200">
                  Pastoral Care Dossier
                </span>
                <p className="text-[11px] text-slate-500 mt-1">
                  Report Date: <strong>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Visitations</span>
              <span className="text-xl font-black text-emerald-900">{filteredVisitations.length}</span>
              <span className="text-[10px] text-slate-500 block">Home / Hospital visits</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Counseling Sessions</span>
              <span className="text-xl font-black text-teal-900">{filteredCounseling.length}</span>
              <span className="text-[10px] text-slate-500 block">Conducted sessions</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Active Prayers</span>
              <span className="text-xl font-black text-blue-900">{activePrayers.length}</span>
              <span className="text-[10px] text-slate-500 block">Petitions at altar</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Praise Reports</span>
              <span className="text-xl font-black text-amber-700">{answeredPrayers.length}</span>
              <span className="text-[10px] text-slate-500 block">Answered testimonies</span>
            </div>
          </div>

          {/* SECTION 1: PASTORAL VISITATIONS REGISTER */}
          <div className="mb-6">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2 flex items-center justify-between">
              <span>1. Pastoral Home & Hospital Visitations Register ({filteredVisitations.length})</span>
              <span className="text-[10px] font-normal text-slate-500">Shepherding flock</span>
            </h3>
            <table className="w-full text-[11px] text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-slate-600 bg-slate-100 font-bold">
                  <th className="py-1.5 px-2">Date & Time</th>
                  <th className="py-1.5 px-2">Member / Family</th>
                  <th className="py-1.5 px-2">Category</th>
                  <th className="py-1.5 px-2">Location / Ward</th>
                  <th className="py-1.5 px-2">Lead Pastor & Team</th>
                  <th className="py-1.5 px-2">Spiritual Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredVisitations.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="py-2 px-2 font-medium whitespace-nowrap">
                      {v.date} <span className="text-[10px] text-slate-500">({v.time})</span>
                    </td>
                    <td className="py-2 px-2 font-bold text-slate-900">
                      {v.member_name}
                      {v.member_phone && <span className="block text-[10px] text-slate-500 font-normal">{v.member_phone}</span>}
                    </td>
                    <td className="py-2 px-2 capitalize font-semibold text-slate-700">
                      {v.visitation_type.replace('_', ' ')}
                    </td>
                    <td className="py-2 px-2 text-slate-600">{v.location}</td>
                    <td className="py-2 px-2 text-slate-700">
                      <span className="font-bold">{v.pastor_in_charge}</span>
                      {v.visitation_team?.length > 1 && (
                        <span className="block text-[10px] text-slate-500">
                          + {v.visitation_team.filter((t) => t !== v.pastor_in_charge).join(', ')}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800">
                        {v.spiritual_condition?.replace('_', ' ') || v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* SECTION 2: PASTORAL COUNSELING LOG */}
          <div className="mb-6">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
              2. Pastoral Counseling & Spiritual Oversight Sessions ({filteredCounseling.length})
            </h3>
            <table className="w-full text-[11px] text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-slate-600 bg-slate-100 font-bold">
                  <th className="py-1.5 px-2">Date</th>
                  <th className="py-1.5 px-2">Member</th>
                  <th className="py-1.5 px-2">Category</th>
                  <th className="py-1.5 px-2">Counselor</th>
                  <th className="py-1.5 px-2">Session #</th>
                  <th className="py-1.5 px-2">Status</th>
                  <th className="py-1.5 px-2">Next Session</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredCounseling.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 px-2 font-medium">{c.date}</td>
                    <td className="py-2 px-2 font-bold text-slate-900">{c.member_name}</td>
                    <td className="py-2 px-2 capitalize text-slate-700 font-medium">
                      {c.session_type.replace('_', ' ')}
                    </td>
                    <td className="py-2 px-2 text-slate-800 font-semibold">{c.counselor_name}</td>
                    <td className="py-2 px-2 font-bold text-center">#{c.session_number}</td>
                    <td className="py-2 px-2 capitalize font-semibold text-slate-700">{c.status.replace('_', ' ')}</td>
                    <td className="py-2 px-2 text-slate-600 font-medium">
                      {c.next_session_date || 'Concluded / None'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* SECTION 3: ANSWERED PRAISE REPORTS & TESTIMONIES */}
          <div className="mb-6">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>3. Answered Prayer Petitions & Altar Testimonies ({answeredPrayers.length})</span>
            </h3>
            <div className="space-y-2">
              {answeredPrayers.map((p) => (
                <div key={p.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-900 mb-1">
                    <span>{p.requester_name} ({p.category})</span>
                    <span className="text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded font-bold uppercase">Answered</span>
                  </div>
                  <p className="text-slate-600 italic text-[11px] mb-1">
                    Petition: &ldquo;{p.request}&rdquo;
                  </p>
                  {p.testimony && (
                    <p className="text-emerald-950 font-semibold text-[11px] bg-emerald-50/70 p-2 rounded-lg border border-emerald-200">
                      Praise Report: {p.testimony}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Signatures & Certification */}
          <div className="pt-8 border-t border-slate-300 grid grid-cols-2 gap-12 text-center text-xs">
            <div className="space-y-8">
              <div className="border-b border-slate-400 pb-1"></div>
              <div>
                <p className="font-bold text-slate-900">{settings.senior_pastor || 'Prophet Elisha K. Richard'}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Senior Pastor & General Overseer
                </p>
              </div>
            </div>

            <div className="space-y-8">
              <div className="border-b border-slate-400 pb-1"></div>
              <div>
                <p className="font-bold text-slate-900">Pastor Emmanuel Osei / Presiding Elder</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Pastoral Council & Ministerial Oversight
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
