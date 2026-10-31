import { MIN_WELFARE_APPEAL_LEVY } from '../../features/welfare/welfareAppealPolicy';
import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CreditCard,
  DollarSign,
  User,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  HeartHandshake,
  Building,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  WelfareEvent,
  WelfareEventContribution,
  PaymentMethod,
} from '../../types/database.types';

interface RecordWelfareEventContributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedEventId?: string;
  preselectedMemberId?: string;
  contributionToEdit?: WelfareEventContribution | null;
}

const QUICK_AMOUNTS = [MIN_WELFARE_APPEAL_LEVY, 20, 50, 100, 200, 500, 1000];

export const RecordWelfareEventContributionModal: React.FC<
  RecordWelfareEventContributionModalProps
> = ({
  isOpen,
  onClose,
  preselectedEventId,
  preselectedMemberId,
  contributionToEdit,
}) => {
  const {
    welfareEvents,
    welfareEventContributions,
    members,
    churchAccounts,
    recordEventContribution,
    updateEventContribution,
  } = useChurchData();
  const { currentUser } = useAuth();
  const canPostToFinance = currentUser.role !== 'welfare_officer';
  const { success, warning, error: toastError } = useToast();

  const activeMembers = members.filter((m) => !m.is_archived);
  const openEvents = welfareEvents.filter(
    (e) => e.status === 'open' || e.id === preselectedEventId || e.id === contributionToEdit?.event_id
  );

  // Form State
  const [eventId, setEventId] = useState('');
  const [isExternalContributor, setIsExternalContributor] = useState(false);
  const [memberId, setMemberId] = useState('');
  const [contributorName, setContributorName] = useState('');
  const [contributorPhone, setContributorPhone] = useState('');
  const [amount, setAmount] = useState('50.00');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mobile_money');
  const [paymentChannel, setPaymentChannel] = useState('MTN Mobile Money');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'confirmed' | 'pending' | 'failed' | 'voided'>('confirmed');

  // Finance Integration State
  const [linkToChurchFinance, setLinkToChurchFinance] = useState(canPostToFinance);
  const [selectedAccountId, setSelectedAccountId] = useState('');

  // Duplicate Submission Confirmation State
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [confirmDuplicateProceed, setConfirmDuplicateProceed] = useState(false);
  const [duplicateWarningMsg, setDuplicateWarningMsg] = useState('');

  // Selected event details
  const selectedEvent = useMemo(() => {
    return welfareEvents.find((e) => e.id === eventId);
  }, [welfareEvents, eventId]);

  // Mandatory minimum contribution
  const minRequiredAmount = Math.max(MIN_WELFARE_APPEAL_LEVY, selectedEvent?.minimum_contribution || MIN_WELFARE_APPEAL_LEVY);

  // Initialize form
  useEffect(() => {
    if (!isOpen) return;

    const today = new Date().toISOString().split('T')[0];

    // Default account
    const defaultAcc = churchAccounts.find((a) => a.account_type === 'operating' || a.name.toLowerCase().includes('welfare')) || churchAccounts[0];
    if (defaultAcc) setSelectedAccountId(defaultAcc.id);

    if (contributionToEdit) {
      setEventId(contributionToEdit.event_id);
      const isExt = contributionToEdit.member_id.startsWith('EXT-') || contributionToEdit.member_id.startsWith('ext-');
      setIsExternalContributor(isExt);
      setMemberId(isExt ? '' : contributionToEdit.member_id);
      setContributorName(contributionToEdit.contributor_name);
      setContributorPhone(contributionToEdit.contributor_phone || '');
      setAmount(String(contributionToEdit.amount));
      setPaymentDate(contributionToEdit.payment_date);
      setPaymentMethod(contributionToEdit.payment_method);
      setPaymentChannel(contributionToEdit.payment_channel || 'MTN Mobile Money');
      setReferenceNo(contributionToEdit.reference_no || '');
      setNotes(contributionToEdit.notes || '');
      setPaymentStatus(contributionToEdit.payment_status);
      setLinkToChurchFinance(contributionToEdit.finance_linked || Boolean(contributionToEdit.finance_transaction_id));
      if(contributionToEdit.finance_account_id)setSelectedAccountId(contributionToEdit.finance_account_id);
      setShowDuplicateWarning(false);
      setConfirmDuplicateProceed(false);
    } else {
      const targetEventId = preselectedEventId || (openEvents[0]?.id ?? '');
      setEventId(targetEventId);

      const targetMemberId = preselectedMemberId || (activeMembers[0]?.id ?? '');
      const defaultMem = members.find((m) => m.id === targetMemberId);

      setIsExternalContributor(false);
      setMemberId(targetMemberId);
      setContributorName(defaultMem ? `${defaultMem.first_name} ${defaultMem.last_name}` : '');
      setContributorPhone(defaultMem?.phone || '');
      setAmount('50.00');
      setPaymentDate(today);
      setPaymentMethod('mobile_money');
      setPaymentChannel('MTN Mobile Money');
      setReferenceNo('');
      setNotes('');
      setPaymentStatus('confirmed');
      setLinkToChurchFinance(canPostToFinance);
      setShowDuplicateWarning(false);
      setConfirmDuplicateProceed(false);
    }
  }, [isOpen, contributionToEdit, preselectedEventId, preselectedMemberId, welfareEvents, members, churchAccounts, canPostToFinance]);

  // When selected member changes, update contributor name and phone
  const handleMemberSelect = (selectedId: string) => {
    setMemberId(selectedId);
    const mem = members.find((m) => m.id === selectedId);
    if (mem) {
      setContributorName(`${mem.first_name} ${mem.last_name}`);
      setContributorPhone(mem.phone || '');
    }
  };

  // Reset duplicate warning if inputs change
  useEffect(() => {
    setShowDuplicateWarning(false);
    setConfirmDuplicateProceed(false);
  }, [amount, paymentDate, memberId, contributorName, eventId]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEvent) {
      toastError('Validation Error', 'Please select an active welfare event.');
      return;
    }

    // Check if event is closed
    if (selectedEvent.status === 'closed' || selectedEvent.status === 'cancelled') {
      toastError(
        'Event Inactive',
        `Cannot record contributions for this event because it is ${selectedEvent.status.toUpperCase()}.`
      );
      return;
    }

    // Validate contributor
    let finalMemberId = memberId;
    let finalContributorName = contributorName.trim();
    let finalTitheNumber: string | undefined = undefined;

    if (isExternalContributor) {
      if (!finalContributorName) {
        toastError('Validation Error', 'Please enter the external contributor name.');
        return;
      }
      finalMemberId = `EXT-${Date.now()}`;
    } else {
      const mem = members.find((m) => m.id === memberId);
      if (!mem) {
        toastError('Validation Error', 'Please select a church member.');
        return;
      }
      finalContributorName = `${mem.first_name} ${mem.last_name}`;
      finalTitheNumber = mem.tithe_number;
    }

    // Validate amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) {
      toastError('Validation Error', 'Please enter a valid contribution amount.');
      return;
    }

    // Enforce this appeal’s levy and the minimum welfare appeal levy
    if (parsedAmount < minRequiredAmount) {
      toastError(
        'Below Minimum Amount',
        `Contribution of GH₵ ${parsedAmount.toFixed(2)} is below the minimum requirement of GH₵ ${minRequiredAmount.toFixed(2)}. Please adjust the amount.`
      );
      return;
    }

    // Staff user
    const recordedBy = currentUser
      ? `${currentUser.first_name} ${currentUser.last_name}`.trim()
      : 'Welfare Desk Officer';

    // Editing existing record
    if (contributionToEdit) {
      updateEventContribution(contributionToEdit.id, {
        event_id: eventId,
        member_id: finalMemberId,
        contributor_name: finalContributorName,
        contributor_phone: contributorPhone.trim() || undefined,
        tithe_number: finalTitheNumber,
        amount: parsedAmount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        payment_channel: paymentChannel.trim() || undefined,
        reference_no: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
        payment_status: paymentStatus,
        finance_linked:linkToChurchFinance,
        finance_account_id:selectedAccountId || undefined,
      });

      success(
        'Contribution Updated',
        `Updated GH₵ ${parsedAmount.toFixed(2)} contribution for ${finalContributorName}.`
      );
      onClose();
      return;
    }

    // Check for accidental duplicate submission unless explicitly confirmed
    if (!confirmDuplicateProceed) {
      const duplicate = welfareEventContributions.find(
        (c) =>
          c.event_id === eventId &&
          (c.member_id === finalMemberId ||
            c.contributor_name.trim().toLowerCase() === finalContributorName.toLowerCase()) &&
          Math.abs(c.amount - parsedAmount) < 0.01 &&
          c.payment_date === paymentDate
      );

      if (duplicate) {
        setShowDuplicateWarning(true);
        setDuplicateWarningMsg(
          `A contribution of GH₵ ${parsedAmount.toFixed(2)} from ${finalContributorName} on this event was already recorded for today (${paymentDate}).`
        );
        warning(
          'Duplicate Entry Detected',
          'Please confirm if this is a legitimate additional contribution.'
        );
        return;
      }
    }

    // Get selected finance account name
    const targetAccount = churchAccounts.find((a) => a.id === selectedAccountId);

    const result = recordEventContribution(
      {
        event_id: eventId,
        member_id: finalMemberId,
        contributor_name: finalContributorName,
        contributor_phone: contributorPhone.trim() || undefined,
        tithe_number: finalTitheNumber,
        amount: parsedAmount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        payment_channel: paymentChannel.trim() || undefined,
        reference_no: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
        payment_status: paymentStatus,
        finance_linked:linkToChurchFinance,
        finance_account_id:selectedAccountId || undefined,
        recorded_by: recordedBy,
      },
      {
        forceDuplicateConfirmation: confirmDuplicateProceed,
        linkToChurchFinance: linkToChurchFinance && paymentStatus === 'confirmed',
        financeAccountId: targetAccount?.id,
        financeAccountName: targetAccount?.name,
      }
    );

    if (!result.success) {
      if (result.isDuplicateWarning) {
        setShowDuplicateWarning(true);
        setDuplicateWarningMsg(result.error || 'Duplicate contribution detected.');
        warning('Confirmation Required', result.error);
      } else {
        toastError('Recording Failed', result.error || 'Failed to record contribution.');
      }
      return;
    }

    success(
      'Contribution Logged',
      `Recorded GH₵ ${parsedAmount.toFixed(2)} (${paymentStatus}) for ${selectedEvent.title} from ${finalContributorName}.`
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-emerald-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-800/80 rounded-xl">
              <CreditCard className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">
                {contributionToEdit ? 'Correct Event Contribution' : 'Record Welfare Contribution'}
              </h3>
              <p className="text-xs text-emerald-200/80">
                Welfare Event Appeal · Minimum GH₵ {minRequiredAmount.toFixed(2)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800/80 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {/* Duplicate Submission Warning Alert */}
          {showDuplicateWarning && (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-300 text-amber-950 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-amber-900">Possible Duplicate Contribution</p>
                  <p className="text-amber-800 leading-relaxed">{duplicateWarningMsg}</p>
                </div>
              </div>
              <div className="pt-2 border-t border-amber-200/80 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="confirmDuplicate"
                  checked={confirmDuplicateProceed}
                  onChange={(e) => setConfirmDuplicateProceed(e.target.checked)}
                  className="w-4 h-4 text-emerald-700 rounded border-amber-300 focus:ring-emerald-700"
                />
                <label
                  htmlFor="confirmDuplicate"
                  className="text-xs font-bold text-amber-950 cursor-pointer"
                >
                  I confirm this is an intentional additional contribution from this member
                </label>
              </div>
            </div>
          )}

          {/* Event Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>
                Welfare Appeal Event <span className="text-rose-500">*</span>
              </span>
              {selectedEvent && (
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Min: GH¢ {minRequiredAmount.toFixed(2)}
                </span>
              )}
            </label>
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              disabled={Boolean(preselectedEventId) || Boolean(contributionToEdit)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-hidden font-semibold text-slate-900 disabled:bg-slate-100"
              required
            >
              <option value="" disabled>-- Select Welfare Event --</option>
              {openEvents.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.title} ({evt.member_name} · Min GH¢ {evt.minimum_contribution.toFixed(2)})
                </option>
              ))}
            </select>
            {selectedEvent && (
              <p className="text-[11px] text-slate-500 mt-1">
                Beneficiary: <strong className="text-slate-700">{selectedEvent.beneficiary_family_name || selectedEvent.member_name}</strong> · Deadline: {selectedEvent.end_date}
              </p>
            )}
          </div>

          {/* Contributor Selection */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4 text-emerald-800" />
                Contributor <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsExternalContributor(!isExternalContributor)}
                className="text-xs text-emerald-800 hover:underline font-semibold"
              >
                {isExternalContributor ? 'Select church member' : '+ External supporter / Non-member'}
              </button>
            </div>

            {isExternalContributor ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={contributorName}
                  onChange={(e) => setContributorName(e.target.value)}
                  placeholder="Contributor Full Name"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-700 focus:outline-hidden"
                  required
                />
                <input
                  type="text"
                  value={contributorPhone}
                  onChange={(e) => setContributorPhone(e.target.value)}
                  placeholder="Phone Number (Optional)"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>
            ) : (
              <select
                value={memberId}
                onChange={(e) => handleMemberSelect(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-700 focus:outline-hidden font-medium"
                required
              >
                <option value="" disabled>-- Select Member Contributor --</option>
                {activeMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.first_name} {m.last_name} {m.tithe_number ? `(${m.tithe_number})` : ''} · {m.phone || 'No phone'}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Amount validated against the selected appeal minimum */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-700" />
                Contribution Amount (GHS) <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] font-bold text-emerald-800">
                Minimum: GH¢ {minRequiredAmount.toFixed(2)}
              </span>
            </div>

            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">GH₵</span>
              <input
                type="number"
                step="0.01"
                min={minRequiredAmount}
                aria-label="Appeal contribution amount (GHS)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={minRequiredAmount.toFixed(2)}
                className={`w-full pl-10 pr-3 py-2 text-base font-bold text-slate-900 border rounded-xl focus:ring-2 focus:outline-hidden ${
                  parseFloat(amount) < minRequiredAmount
                    ? 'border-rose-300 bg-rose-50/50 focus:ring-rose-500'
                    : 'border-slate-300 focus:ring-emerald-700'
                }`}
                required
              />
            </div>

            {/* Validation Message */}
            {parseFloat(amount) < minRequiredAmount && (
              <p className="text-xs font-semibold text-rose-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Amount cannot be less than the mandatory minimum of GH¢ {minRequiredAmount.toFixed(2)}.
              </p>
            )}

            {/* Quick Amount Buttons */}
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1">
              {QUICK_AMOUNTS.filter((q) => q >= minRequiredAmount).map((q) => (
                <button
                  type="button"
                  key={q}
                  onClick={() => setAmount(q.toFixed(2))}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition ${
                    parseFloat(amount) === q
                      ? 'bg-emerald-800 text-white border-emerald-800 shadow-2xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  GH¢ {q}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Date & Method Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Payment Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Payment Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-hidden"
                required
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                Payment Method <span className="text-rose-500">*</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  const m = e.target.value as PaymentMethod;
                  setPaymentMethod(m);
                  if (m === 'cash') setPaymentChannel('Physical Cash');
                  else if (m === 'mobile_money') setPaymentChannel('MTN Mobile Money');
                  else if (m === 'bank_transfer') setPaymentChannel('Ecobank Ghana');
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-hidden"
                required
              >
                <option value="mobile_money">Mobile Money (MoMo)</option>
                <option value="cash">Cash in Hand</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>

          {/* Payment Channel & Reference Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Channel / Provider
              </label>
              <input
                type="text"
                value={paymentChannel}
                onChange={(e) => setPaymentChannel(e.target.value)}
                placeholder="e.g. MTN MoMo, Telecel Cash, Stanbic"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Receipt className="w-3.5 h-3.5 text-slate-400" />
                Reference / Transaction ID
              </label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="e.g. MOMO-98213 or Cash Slip #22"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Payment Status */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Payment Status <span className="text-rose-500">*</span></span>
              <span className="text-[11px] text-slate-500">Only confirmed funds count toward total collected</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentStatus('confirmed')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold uppercase transition ${
                  paymentStatus === 'confirmed'
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Confirmed
              </button>
              <button
                type="button"
                onClick={() => setPaymentStatus('pending')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold uppercase transition ${
                  paymentStatus === 'pending'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => setPaymentStatus('failed')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold uppercase transition ${
                  paymentStatus === 'failed'
                    ? 'bg-rose-700 text-white border-rose-700 shadow-2xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Failed
              </button>
            </div>
          </div>

          {/* Optional Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Contribution Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Donation from Men's Fellowship, special offering..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-hidden"
            />
          </div>

          {/* Finance Integration Option */}
          {canPostToFinance && !contributionToEdit && paymentStatus === 'confirmed' && (
            <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-800" />
                  <span className="text-xs font-bold text-emerald-950">
                    Finance Module Integration
                  </span>
                </div>
                <input
                  type="checkbox"
                  id="linkFinance"
                  checked={linkToChurchFinance}
                  onChange={(e) => setLinkToChurchFinance(e.target.checked)}
                  className="w-4 h-4 text-emerald-700 rounded border-emerald-300 focus:ring-emerald-700"
                />
              </div>
              <p className="text-[11px] text-emerald-900 leading-relaxed">
                Automatically create an incoming transaction in church finances and credit the operating balance.
              </p>
              {linkToChurchFinance && (
                <div className="pt-1">
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-emerald-300 rounded-lg bg-white focus:outline-hidden font-medium text-emerald-950"
                  >
                    {churchAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        Deposit to: {acc.name} (GH₵ {acc.current_balance.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {!canPostToFinance && <p className="text-xs text-slate-600">This records the welfare contribution. Finance staff handle treasury posting.</p>}

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={parseFloat(amount) < minRequiredAmount}
              className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              {showDuplicateWarning && confirmDuplicateProceed
                ? 'Confirm & Record Additional Contribution'
                : contributionToEdit
                ? 'Save Correction'
                : 'Confirm & Post Contribution'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
