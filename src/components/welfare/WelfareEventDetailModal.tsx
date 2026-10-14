import React, { useState, useMemo } from 'react';
import {
  X,
  HeartHandshake,
  Calendar,
  DollarSign,
  User,
  Users,
  CreditCard,
  Printer,
  Plus,
  Lock,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Tag,
  Download,
  Trash2,
  Edit,
  ShieldCheck,
  Check,
  ArrowRight,
} from 'lucide-react';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  WelfareEvent,
  WelfareEventContribution,
} from '../../types/database.types';

interface WelfareEventDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: WelfareEvent;
  onRecordContribution: (event: WelfareEvent) => void;
  onEditContribution?: (contribution: WelfareEventContribution) => void;
  onPrintReport: (event: WelfareEvent) => void;
  onEditEvent?: (event: WelfareEvent) => void;
}

export const WelfareEventDetailModal: React.FC<WelfareEventDetailModalProps> = ({
  isOpen,
  onClose,
  event,
  onRecordContribution,
  onEditContribution,
  onPrintReport,
  onEditEvent,
}) => {
  const {
    welfareEventContributions,
    closeWelfareEvent,
    updateWelfareEvent,
    deleteEventContribution,
    deleteWelfareEvent,
  } = useChurchData();
  const { currentUser } = useAuth();
  const { success, warning, error: toastError } = useToast();

  const [historySearch, setHistorySearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isConfirmingClose, setIsConfirmingClose] = useState(false);
  const [isConfirmingDeleteEvent, setIsConfirmingDeleteEvent] = useState(false);
  const [contributionToDelete, setContributionToDelete] = useState<WelfareEventContribution | null>(null);

  // Role permissions
  const isSuperAdminOrPastor =
    currentUser?.role === 'super_admin' ||
    currentUser?.role === 'senior_pastor' ||
    currentUser?.role === 'administrator';

  const canManageStaff =
    isSuperAdminOrPastor ||
    currentUser?.role === 'pastor' ||
    currentUser?.role === 'finance_officer';

  // Get contributions for this event
  const eventContributions = useMemo(() => {
    return welfareEventContributions.filter((c) => c.event_id === event.id);
  }, [welfareEventContributions, event.id]);

  // Financial aggregates
  const confirmedContributions = useMemo(() => {
    return eventContributions.filter((c) => c.payment_status === 'confirmed');
  }, [eventContributions]);

  const totalConfirmedAmount = useMemo(() => {
    return confirmedContributions.reduce((sum, c) => sum + c.amount, 0);
  }, [confirmedContributions]);

  const pendingContributions = useMemo(() => {
    return eventContributions.filter((c) => c.payment_status === 'pending');
  }, [eventContributions]);

  const totalPendingAmount = useMemo(() => {
    return pendingContributions.reduce((sum, c) => sum + c.amount, 0);
  }, [pendingContributions]);

  const uniqueContributorsCount = useMemo(() => {
    return new Set(eventContributions.map((c) => c.member_id || c.contributor_name)).size;
  }, [eventContributions]);

  // Target calculations
  const target = event.target_amount || 0;
  const progressPercent = target > 0 ? Math.min(100, (totalConfirmedAmount / target) * 100) : 0;
  const balanceRemaining = target > 0 ? Math.max(0, target - totalConfirmedAmount) : 0;

  // Deadline calculation
  const deadlineDate = new Date(event.end_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPastDeadline = deadlineDate < today;
  const daysRemaining = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Filtered contributions
  const filteredContributions = useMemo(() => {
    return eventContributions.filter((c) => {
      const q = historySearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.contributor_name.toLowerCase().includes(q) ||
        (c.reference_no && c.reference_no.toLowerCase().includes(q)) ||
        (c.tithe_number && c.tithe_number.toLowerCase().includes(q));

      const matchMethod = methodFilter === 'ALL' || c.payment_method === methodFilter;
      const matchStatus = statusFilter === 'ALL' || c.payment_status === statusFilter;

      return matchSearch && matchMethod && matchStatus;
    });
  }, [eventContributions, historySearch, methodFilter, statusFilter]);

  if (!isOpen) return null;

  const handleCloseEvent = () => {
    const staffName = currentUser
      ? `${currentUser.first_name} ${currentUser.last_name}`
      : 'Church Administrator';
    closeWelfareEvent(event.id);
    setIsConfirmingClose(false);
    success(
      'Event Closed',
      `Event "${event.title}" has been closed. All historical contribution records remain safely preserved.`
    );
  };

  const handleReopenEvent = () => {
    updateWelfareEvent(event.id, { status: 'open' });
    success('Event Reopened', `Event "${event.title}" is now open for contributions.`);
  };

  const handleDeleteContribution = () => {
    if (!contributionToDelete) return;
    deleteEventContribution(contributionToDelete.id);
    success(
      'Contribution Removed',
      `Removed GH¢ ${contributionToDelete.amount.toFixed(2)} contribution from ${contributionToDelete.contributor_name}.`
    );
    setContributionToDelete(null);
  };

  const exportCSV = () => {
    if (eventContributions.length === 0) {
      warning('Export Notice', 'No contributions recorded for this event yet.');
      return;
    }

    const headers = [
      'Event Title',
      'Date',
      'Contributor Name',
      'Tithe Number',
      'Phone',
      'Amount (GHS)',
      'Payment Method',
      'Channel',
      'Reference No',
      'Status',
      'Recorded By',
      'Notes',
    ];

    const rows = eventContributions.map((c) => [
      `"${event.title.replace(/"/g, '""')}"`,
      c.payment_date,
      `"${c.contributor_name.replace(/"/g, '""')}"`,
      c.tithe_number || '',
      c.contributor_phone || '',
      c.amount.toFixed(2),
      c.payment_method,
      c.payment_channel || '',
      c.reference_no || '',
      c.payment_status,
      c.recorded_by,
      `"${(c.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `welfare_event_${event.id}_contributions_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    success('Export Successful', `Exported ${eventContributions.length} contribution records.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] my-auto">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-700/80 rounded-xl">
              <HeartHandshake className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight text-white">{event.title}</h3>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                    event.status === 'open'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : event.status === 'closed'
                      ? 'bg-slate-700 text-slate-300'
                      : event.status === 'draft'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {event.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Affected Member: <span className="text-slate-200 font-semibold">{event.member_name}</span>
                {event.beneficiary_family_name && (
                  <> · Beneficiary: <span className="text-slate-200 font-semibold">{event.beneficiary_family_name}</span></>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPrintReport(event)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition flex items-center gap-1.5"
              title="Print official report"
            >
              <Printer className="w-3.5 h-3.5" />
              Report
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Confirmed Collected */}
            <div className="bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-200">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                Confirmed Funds
              </span>
              <div className="text-xl font-black text-emerald-950">
                GH₵ {totalConfirmedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-emerald-700 mt-0.5">
                {confirmedContributions.length} confirmed receipt(s)
              </div>
            </div>

            {/* Target & Balance */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Fundraising Target
              </span>
              <div className="text-xl font-black text-slate-900">
                {target > 0
                  ? `GH₵ ${target.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : 'Open Appeal'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {target > 0
                  ? balanceRemaining > 0
                    ? `GH₵ ${balanceRemaining.toFixed(2)} to goal`
                    : 'Goal reached!'
                  : 'No ceiling set'}
              </div>
            </div>

            {/* Contributors */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Contributors
              </span>
              <div className="text-xl font-black text-slate-900">{uniqueContributorsCount}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {eventContributions.length} total transaction(s)
              </div>
            </div>

            {/* Minimum & Deadline */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Minimum & Deadline
              </span>
              <div className="text-base font-black text-slate-900">
                Min: GH₵ {event.minimum_contribution.toFixed(2)}
              </div>
              <div
                className={`text-[11px] font-semibold mt-0.5 ${
                  event.status === 'closed'
                    ? 'text-slate-500'
                    : isPastDeadline
                    ? 'text-rose-600'
                    : 'text-emerald-700'
                }`}
              >
                {event.status === 'closed'
                  ? 'Closed'
                  : isPastDeadline
                  ? 'Deadline passed'
                  : `${daysRemaining} day(s) left`}
              </div>
            </div>
          </div>

          {/* Target Progress Bar (if target exists) */}
          {target > 0 && (
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Fundraising Progress: {progressPercent.toFixed(1)}%</span>
                <span>
                  GH₵ {totalConfirmedAmount.toFixed(2)} of GH₵ {target.toFixed(2)}
                </span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Public Description */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              Public Description (Shared with Members)
            </span>
            <p className="text-sm text-slate-700 leading-relaxed">{event.description}</p>
          </div>

          {/* Confidential Pastoral Notes (Staff Only) */}
          {canManageStaff && event.pastoral_notes && (
            <div className="p-4 bg-amber-50/80 rounded-xl border border-amber-200 text-xs text-amber-950 space-y-1">
              <span className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-amber-900">
                <Lock className="w-3.5 h-3.5 text-amber-700" />
                Confidential Pastoral & Welfare Committee Notes (Staff Only)
              </span>
              <p className="text-amber-900/90 leading-relaxed">{event.pastoral_notes}</p>
            </div>
          )}

          {/* Action Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
            <div className="flex items-center gap-2">
              {event.status === 'open' ? (
                <button
                  onClick={() => onRecordContribution(event)}
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Record Contribution
                </button>
              ) : (
                <div className="px-3.5 py-2 bg-slate-100 text-slate-500 text-xs font-bold rounded-xl border border-slate-200 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Event is {event.status.toUpperCase()} (Contributions disabled)
                </div>
              )}

              {onEditEvent && isSuperAdminOrPastor && (
                <button
                  onClick={() => onEditEvent(event)}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 shadow-2xs transition flex items-center gap-1.5"
                >
                  <Edit className="w-3.5 h-3.5 text-slate-500" />
                  Edit Event
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={exportCSV}
                className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 shadow-2xs transition flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                Export CSV
              </button>

              {isSuperAdminOrPastor && event.status === 'open' && (
                <button
                  onClick={() => setIsConfirmingClose(true)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition"
                >
                  Close Event
                </button>
              )}

              {isSuperAdminOrPastor && event.status === 'closed' && (
                <button
                  onClick={handleReopenEvent}
                  className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition"
                >
                  Reopen Event
                </button>
              )}

              {isSuperAdminOrPastor && (
                <button
                  onClick={() => setIsConfirmingDeleteEvent(true)}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition flex items-center gap-1.5"
                  title="Delete event appeal"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Event
                </button>
              )}
            </div>
          </div>

          {/* Delete Event Confirmation Box */}
          {isConfirmingDeleteEvent && (
            <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 text-rose-950 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-rose-900">Are you sure you want to delete this event appeal?</p>
                  <p className="text-rose-800">
                    This will permanently delete "{event.title}" and any associated contribution records so you can start fresh.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsConfirmingDeleteEvent(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const res = deleteWelfareEvent(event.id, true);
                    if (res.success) {
                      success('Event Deleted', res.message);
                      onClose();
                    } else {
                      warning('Deletion Notice', res.message);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Confirm Delete
                </button>
              </div>
            </div>
          )}

          {/* Close Event Confirmation Modal */}
          {isConfirmingClose && (
            <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 text-rose-950 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-rose-900">Are you sure you want to close this event?</p>
                  <p className="text-rose-800">
                    Closing the event will disable further contributions while safely preserving all {eventContributions.length} historical contribution records (Total GH¢ {totalConfirmedAmount.toFixed(2)}).
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsConfirmingClose(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Keep Open
                </button>
                <button
                  onClick={handleCloseEvent}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg shadow-2xs"
                >
                  Confirm & Close Event
                </button>
              </div>
            </div>
          )}

          {/* Contribution History Section */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-800" />
                Contribution Ledger ({eventContributions.length})
              </h4>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Search contributor..."
                    className="pl-8 pr-3 py-1 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-700 w-44"
                  />
                </div>
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-hidden bg-white text-slate-700"
                >
                  <option value="ALL">All Methods</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-hidden bg-white text-slate-700"
                >
                  <option value="ALL">All Status</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            {/* Contributions Table */}
            {filteredContributions.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                No contribution records found matching your filters.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Contributor</th>
                      <th className="px-3 py-2.5">Method & Reference</th>
                      <th className="px-3 py-2.5 text-right">Amount (GHS)</th>
                      <th className="px-3 py-2.5 text-center">Status</th>
                      <th className="px-3 py-2.5">Recorded By</th>
                      {canManageStaff && <th className="px-3 py-2.5 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredContributions.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-3 py-2.5 font-medium text-slate-600 whitespace-nowrap">
                          {c.payment_date}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-slate-900">
                          <div>{c.contributor_name}</div>
                          {c.tithe_number && (
                            <div className="text-[10px] text-slate-400 font-normal">
                              Tithe: {c.tithe_number}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">
                          <span className="capitalize font-semibold">
                            {c.payment_method.replace('_', ' ')}
                          </span>
                          {c.reference_no && (
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {c.reference_no}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-black text-slate-900 whitespace-nowrap">
                          GH₵ {c.amount.toFixed(2)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              c.payment_status === 'confirmed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : c.payment_status === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {c.payment_status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap text-[11px]">
                          {c.recorded_by}
                          {c.corrected_by && (
                            <span className="block text-[10px] text-slate-400">
                              (rev: {c.corrected_by})
                            </span>
                          )}
                        </td>
                        {canManageStaff && (
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {onEditContribution && (
                                <button
                                  onClick={() => onEditContribution(c)}
                                  className="p-1 text-slate-400 hover:text-emerald-700 rounded-md transition"
                                  title="Edit / Correct contribution"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => setContributionToDelete(c)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition"
                                title="Delete contribution"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                    <tr>
                      <td colSpan={3} className="px-3 py-2.5 text-slate-700">
                        Total Confirmed Funds ({confirmedContributions.length} payments):
                      </td>
                      <td className="px-3 py-2.5 text-right text-emerald-900 text-sm font-black">
                        GH₵ {totalConfirmedAmount.toFixed(2)}
                      </td>
                      <td colSpan={canManageStaff ? 3 : 2} className="px-3 py-2.5 text-[11px] text-slate-500">
                        {totalPendingAmount > 0 && `(Pending: GH₵ ${totalPendingAmount.toFixed(2)})`}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Delete Contribution Confirmation Modal */}
        {contributionToDelete && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs">
            <div className="bg-white rounded-xl max-w-sm w-full p-5 border border-slate-200 shadow-xl space-y-3">
              <h4 className="text-sm font-bold text-slate-900">Delete Contribution Record?</h4>
              <p className="text-xs text-slate-600">
                Are you sure you want to delete the contribution of{' '}
                <strong>GH₵ {contributionToDelete.amount.toFixed(2)}</strong> from{' '}
                <strong>{contributionToDelete.contributor_name}</strong>?
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setContributionToDelete(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteContribution}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-rose-700 rounded-lg hover:bg-rose-800"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Created on {new Date(event.created_at).toLocaleDateString()} by {event.created_by}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-300 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
