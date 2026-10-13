import React, { useMemo } from 'react';
import {
  X,
  Printer,
  HeartHandshake,
  Download,
  Calendar,
  DollarSign,
  User,
  Users,
  CheckCircle2,
  Building,
} from 'lucide-react';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { WelfareEvent } from '../../types/database.types';

interface PrintWelfareEventReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: WelfareEvent;
}

export const PrintWelfareEventReportModal: React.FC<PrintWelfareEventReportModalProps> = ({
  isOpen,
  onClose,
  event,
}) => {
  const { settings, welfareEventContributions } = useChurchData();

  const eventContributions = useMemo(() => {
    return welfareEventContributions.filter((c) => c.event_id === event.id);
  }, [welfareEventContributions, event.id]);

  const confirmedContributions = useMemo(() => {
    return eventContributions.filter((c) => c.payment_status === 'confirmed');
  }, [eventContributions]);

  const totalConfirmed = useMemo(() => {
    return confirmedContributions.reduce((sum, c) => sum + c.amount, 0);
  }, [confirmedContributions]);

  const totalPending = useMemo(() => {
    return eventContributions
      .filter((c) => c.payment_status === 'pending')
      .reduce((sum, c) => sum + c.amount, 0);
  }, [eventContributions]);

  const uniqueContributors = useMemo(() => {
    return new Set(eventContributions.map((c) => c.member_id || c.contributor_name)).size;
  }, [eventContributions]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] my-auto">
        {/* Modal Controls Header (Hidden during print) */}
        <div className="no-print px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold tracking-tight">
              Official Welfare Contribution Audit Statement
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Area */}
        <div className="p-8 overflow-y-auto space-y-6 text-slate-800 print:p-0 print:m-0">
          {/* Church Letterhead */}
          <div className="text-center border-b-2 border-emerald-900 pb-5 space-y-1">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-emerald-900 text-white flex items-center justify-center font-black text-xl shadow-xs">
                GWCC
              </div>
              <div className="text-left">
                <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                  {settings.church_name || 'Greater Works City Church'}
                </h1>
                <p className="text-xs text-slate-500 font-semibold tracking-wider uppercase">
                  {settings.branch_name || 'Headquarters'} · Welfare & Benevolence Department
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              {settings.location || 'Ga South Municipal, Accra, Ghana'} · GPS: {settings.gps_address || 'GA-183-4921'}
            </p>
            <p className="text-xs text-slate-500">
              Tel: {settings.phone || '+233 24 456 7890'} · Email: {settings.email || 'admin@greaterworkscitychurch.org'}
            </p>
          </div>

          {/* Statement Title */}
          <div className="text-center space-y-1">
            <span className="text-[11px] font-black uppercase tracking-widest text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Official Welfare Contribution Register
            </span>
            <h2 className="text-lg font-black text-slate-900 mt-2">{event.title}</h2>
            <p className="text-xs text-slate-500">
              Generated on {currentDate} · Status: <strong className="uppercase text-slate-800">{event.status}</strong>
            </p>
          </div>

          {/* Event Metadata Card */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Affected Member</span>
                <span className="font-bold text-slate-900">{event.member_name}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Beneficiary Family</span>
                <span className="font-bold text-slate-900">{event.beneficiary_family_name || 'Nuclear Family'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Opening Date</span>
                <span className="font-semibold text-slate-800">{event.start_date}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Contribution Deadline</span>
                <span className="font-semibold text-slate-800">{event.end_date}</span>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-200">
              <span className="text-slate-400 font-bold block text-[10px] uppercase">Public Appeal Purpose</span>
              <p className="text-slate-700 leading-relaxed mt-0.5">{event.description}</p>
            </div>
          </div>

          {/* Financial Summary KPI Grid */}
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-[10px] font-bold text-emerald-800 uppercase block">Confirmed Collected</span>
              <span className="text-lg font-black text-emerald-950">
                GH₵ {totalConfirmed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-600 uppercase block">Fundraising Target</span>
              <span className="text-lg font-black text-slate-900">
                {event.target_amount ? `GH₵ ${event.target_amount.toFixed(2)}` : 'Open Goal'}
              </span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-600 uppercase block">Total Contributors</span>
              <span className="text-lg font-black text-slate-900">{uniqueContributors}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-600 uppercase block">Min per Donation</span>
              <span className="text-lg font-black text-slate-900">
                GH₵ {event.minimum_contribution.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Itemized Contributions Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Itemized Member Contributions ({eventContributions.length} records)
            </h4>
            <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="px-3 py-2 text-center w-8">#</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Contributor</th>
                  <th className="px-3 py-2">Tithe No / Contact</th>
                  <th className="px-3 py-2">Method & Reference</th>
                  <th className="px-3 py-2 text-right">Amount (GHS)</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2">Received By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {eventContributions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                      No contributions have been logged for this event.
                    </td>
                  </tr>
                ) : (
                  eventContributions.map((c, idx) => (
                    <tr key={c.id} className="odd:bg-white even:bg-slate-50/50">
                      <td className="px-3 py-2 text-center font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{c.payment_date}</td>
                      <td className="px-3 py-2 font-bold text-slate-900">{c.contributor_name}</td>
                      <td className="px-3 py-2 text-slate-500 font-mono text-[11px]">
                        {c.tithe_number || c.contributor_phone || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span className="capitalize">{c.payment_method.replace('_', ' ')}</span>
                        {c.reference_no && (
                          <span className="block text-[10px] text-slate-400 font-mono">
                            {c.reference_no}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-black text-slate-900">
                        GH₵ {c.amount.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${
                            c.payment_status === 'confirmed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {c.payment_status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-500 text-[11px]">{c.recorded_by}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-100 font-bold border-t border-slate-300 text-slate-900">
                <tr>
                  <td colSpan={5} className="px-3 py-2 text-right">
                    Total Confirmed Funds Handed to Welfare Account:
                  </td>
                  <td className="px-3 py-2 text-right text-emerald-950 font-black text-sm">
                    GH₵ {totalConfirmed.toFixed(2)}
                  </td>
                  <td colSpan={2} className="px-3 py-2 text-[10px] text-slate-500">
                    {totalPending > 0 && `(Pending: GH₵ ${totalPending.toFixed(2)})`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Official Signatures Section */}
          <div className="pt-8 border-t border-slate-200 grid grid-cols-3 gap-6 text-center text-xs">
            <div className="space-y-12">
              <div className="border-b border-slate-400 pb-1 h-12 flex items-end justify-center">
                <span className="text-[11px] text-slate-400 italic">Signature</span>
              </div>
              <div>
                <p className="font-bold text-slate-900">Welfare Committee Head</p>
                <p className="text-[10px] text-slate-500">GWCC Benevolence Board</p>
              </div>
            </div>

            <div className="space-y-12">
              <div className="border-b border-slate-400 pb-1 h-12 flex items-end justify-center">
                <span className="text-xs font-serif italic text-slate-700">
                  {settings.general_secretary || 'Tamekloe Clara Gaewornu'}
                </span>
              </div>
              <div>
                <p className="font-bold text-slate-900">
                  {settings.general_secretary || 'Tamekloe Clara Gaewornu'}
                </p>
                <p className="text-[10px] text-slate-500">General Secretary</p>
              </div>
            </div>

            <div className="space-y-12">
              <div className="border-b border-slate-400 pb-1 h-12 flex items-end justify-center">
                <span className="text-xs font-serif italic text-emerald-900 font-bold">
                  {settings.senior_pastor || 'Prophet Elisha K. Richard'}
                </span>
              </div>
              <div>
                <p className="font-bold text-slate-900">
                  {settings.senior_pastor || 'Prophet Elisha K. Richard'}
                </p>
                <p className="text-[10px] text-slate-500">Senior Pastor & Overseer</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
