import React, { useState } from 'react';
import {
  X,
  Download,
  Printer,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Shield,
  FileText,
  User,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { ChurchSettings, Member, RosterAssignment } from '../../types/database.types';
import { downloadMyDutyRosterPdf, generateMyDutyRosterPdf } from '../../lib/myDutyPdfGenerator';
import { useToast } from '../../contexts/ToastContext';

interface DownloadMyDutyModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignments: RosterAssignment[];
  member: Member;
  settings: ChurchSettings;
  initialSelectedAssignmentId?: string;
}

export const DownloadMyDutyModal: React.FC<DownloadMyDutyModalProps> = ({
  isOpen,
  onClose,
  assignments,
  member,
  settings,
  initialSelectedAssignmentId,
}) => {
  const { success: toastSuccess, error: toastError } = useToast();

  const [scope, setScope] = useState<'upcoming' | 'all' | 'single'>(() => {
    if (initialSelectedAssignmentId) return 'single';
    return 'upcoming';
  });

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(() => {
    return initialSelectedAssignmentId || (assignments[0]?.id ?? '');
  });

  const [includeGuidelines, setIncludeGuidelines] = useState(true);
  const [includeSignatures, setIncludeSignatures] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingDuties = assignments.filter((a) => a.date >= todayStr);
  const targetCount =
    scope === 'single'
      ? 1
      : scope === 'upcoming'
      ? upcomingDuties.length || assignments.length
      : assignments.length;

  const selectedSingleAssignment = assignments.find((a) => a.id === selectedAssignmentId) || assignments[0];

  const handleDownload = () => {
    try {
      setIsGenerating(true);
      downloadMyDutyRosterPdf({
        member,
        assignments,
        settings,
        scope,
        selectedAssignmentId: scope === 'single' ? selectedAssignmentId : undefined,
        includeGuidelines,
        includeSignatures,
      });

      toastSuccess(
        'Duty Roster Downloaded',
        `Official printable PDF generated for ${member.first_name} ${member.last_name}.`
      );
      setTimeout(() => {
        setIsGenerating(false);
        onClose();
      }, 500);
    } catch (err: any) {
      setIsGenerating(false);
      toastError('Download Error', err?.message || 'Failed to generate PDF duty roster.');
    }
  };

  const handlePrint = () => {
    try {
      setIsGenerating(true);
      const doc = generateMyDutyRosterPdf({
        member,
        assignments,
        settings,
        scope,
        selectedAssignmentId: scope === 'single' ? selectedAssignmentId : undefined,
        includeGuidelines,
        includeSignatures,
      });

      const blobUrl = doc.output('bloburl');
      const printWindow = window.open(blobUrl);
      if (printWindow) {
        printWindow.focus();
      } else {
        // Fallback: download directly if pop-up is blocked
        doc.save(`GWCC_Duty_Roster_${member.first_name}_${member.last_name}.pdf`);
      }
      setIsGenerating(false);
      onClose();
    } catch (err: any) {
      setIsGenerating(false);
      toastError('Print Error', err?.message || 'Could not launch print preview.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div className="px-6 py-5 bg-linear-to-r from-emerald-950 via-teal-900 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-emerald-600/40 rounded-2xl border border-emerald-400/30 text-emerald-300">
              <Download className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                  PDF Export
                </span>
                <span className="text-xs text-teal-200 font-semibold">
                  Member Portal
                </span>
              </div>
              <h3 className="text-lg font-black text-white">Download My Duty Roster</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 text-sm">
          {/* Member Summary Strip */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                {member.first_name[0]}
                {member.last_name[0]}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  {member.first_name} {member.last_name}
                </h4>
                <p className="text-xs text-slate-500">
                  ID: <span className="font-mono font-bold text-emerald-800">{member.member_id}</span> • {member.ministry_name || 'Church Steward'}
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-xl bg-white border border-emerald-200 text-emerald-900 font-bold text-xs shadow-2xs">
              {targetCount} Duty Shift{targetCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Scope Selector */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              Select Roster Scope
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setScope('upcoming')}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between gap-1 cursor-pointer ${
                  scope === 'upcoming'
                    ? 'border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-600/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">Upcoming Duties</span>
                  {scope === 'upcoming' && <CheckCircle2 className="w-4 h-4 text-emerald-700" />}
                </div>
                <p className="text-[11px] text-slate-500">
                  Future scheduled shifts ({upcomingDuties.length || assignments.length})
                </p>
              </button>

              <button
                type="button"
                onClick={() => setScope('all')}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between gap-1 cursor-pointer ${
                  scope === 'all'
                    ? 'border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-600/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">All Duties</span>
                  {scope === 'all' && <CheckCircle2 className="w-4 h-4 text-emerald-700" />}
                </div>
                <p className="text-[11px] text-slate-500">
                  Full duty history & schedule ({assignments.length})
                </p>
              </button>

              <button
                type="button"
                onClick={() => setScope('single')}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between gap-1 cursor-pointer ${
                  scope === 'single'
                    ? 'border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-600/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">Single Duty Slip</span>
                  {scope === 'single' && <CheckCircle2 className="w-4 h-4 text-emerald-700" />}
                </div>
                <p className="text-[11px] text-slate-500">
                  Individual shift pass voucher
                </p>
              </button>
            </div>
          </div>

          {/* Single Shift Dropdown (if 'single' is chosen) */}
          {scope === 'single' && (
            <div className="space-y-1.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-700">
                Choose Specific Duty Assignment:
              </label>
              <div className="relative">
                <select
                  value={selectedAssignmentId}
                  onChange={(e) => setSelectedAssignmentId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500 appearance-none pr-8 cursor-pointer"
                >
                  {assignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.date} • {a.service_name} — {a.role_title} ({a.report_time})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
              {selectedSingleAssignment && (
                <div className="pt-2 text-xs text-slate-600 flex items-center justify-between">
                  <span>Role: <strong>{selectedSingleAssignment.role_title}</strong></span>
                  <span>Report Time: <strong className="text-emerald-800">{selectedSingleAssignment.report_time}</strong></span>
                </div>
              )}
            </div>
          )}

          {/* Document Content Options */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              Document Inclusions
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-teal-700" />
                  <span className="font-semibold text-slate-800">Ministerial Protocol</span>
                </div>
                <input
                  type="checkbox"
                  checked={includeGuidelines}
                  onChange={(e) => setIncludeGuidelines(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-700 accent-emerald-700 focus:ring-emerald-500"
                />
              </label>

              <label className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-600" />
                  <span className="font-semibold text-slate-800">Official Signatures</span>
                </div>
                <input
                  type="checkbox"
                  checked={includeSignatures}
                  onChange={(e) => setIncludeSignatures(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-700 accent-emerald-700 focus:ring-emerald-500"
                />
              </label>
            </div>
          </div>

          {/* Document Preview Box */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-bold text-emerald-400 uppercase text-[10px] tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                Printable PDF Summary
              </span>
              <span>Standard A4 Portrait</span>
            </div>
            <div className="border-t border-slate-800 pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <p className="font-bold text-white text-sm">
                  {settings.church_name || 'Greater Works City Church'}
                </p>
                <p className="text-slate-400 text-[11px]">
                  Official Personal Duty Roster • Steward: {member.first_name} {member.last_name}
                </p>
              </div>
              <div className="text-right sm:self-auto self-start">
                <span className="text-[11px] font-mono text-emerald-300 block font-bold">
                  {targetCount} Shift{targetCount !== 1 ? 's' : ''} Included
                </span>
                <span className="text-[10px] text-slate-400">
                  Ready for noticeboard or personal wallet
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isGenerating || assignments.length === 0}
              className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-white text-slate-700 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Print Directly</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={isGenerating || assignments.length === 0}
              className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black transition flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isGenerating ? 'Generating PDF...' : 'Download My Duty (PDF)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
