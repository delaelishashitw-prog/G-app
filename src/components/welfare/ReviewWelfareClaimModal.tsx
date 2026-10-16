import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, XCircle, AlertCircle, HeartHandshake, FileText, ArrowRight, Printer } from 'lucide-react';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { useToast } from '../../contexts/ToastContext';
import { WelfareClaim, WelfareClaimStatus } from '../../types/database.types';
import { assessWelfareStanding } from '../../features/welfare/welfareEligibility';
import { WelfareStandingNotice } from './WelfareStandingNotice';

interface ReviewWelfareClaimModalProps {
  claim: WelfareClaim | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenDisburseModal: (claim: WelfareClaim) => void;
}

export const ReviewWelfareClaimModal: React.FC<ReviewWelfareClaimModalProps> = ({
  claim,
  isOpen,
  onClose,
  onOpenDisburseModal,
}) => {
  const { updateWelfareClaim, welfareContributions, members, settings } = useChurchData();
  const { success, error: toastError } = useToast();
  const member = claim?.beneficiary_type !== 'external_community'
    ? members.find(m => m.id === claim?.member_id || m.member_id === claim?.member_id) : undefined;
  const standing = member ? assessWelfareStanding(member, welfareContributions) : null;
  const requiresPartialAmount = Boolean(standing?.isDefaulter);
  const initialApprovedAmount = claim?.amount_approved != null ? String(claim.amount_approved)
    : requiresPartialAmount ? '' : claim ? String(claim.amount_requested) : '';

  const [status, setStatus] = useState<WelfareClaimStatus>(claim?.status || 'pending');
  const [amountApproved, setAmountApproved] = useState<string>(initialApprovedAmount);
  const [pastoralNotes, setPastoralNotes] = useState<string>(claim?.pastoral_notes || '');

  // Synchronize state when claim prop changes
  useEffect(() => {
    if (claim) {
      setStatus(claim.status);
      setAmountApproved(initialApprovedAmount);
      setPastoralNotes(claim.pastoral_notes || '');
    }
  }, [claim, initialApprovedAmount]);

  // ALL HOOKS CALLED UNCONDITIONALLY ABOVE
  if (!isOpen || !claim) return null;

  // Member's historical contributions
  const memberContributions = welfareContributions.filter((c) => c.member_id === claim.member_id || (member && (c.member_id === member.id || c.member_id === member.member_id)));
  const totalDuesPaid = memberContributions.reduce((sum, c) => sum + c.amount, 0);

  const handleSaveReview = (e: React.FormEvent) => {
    e.preventDefault();
    const approvedVal = parseFloat(amountApproved);
    const amountDisbursed = claim.amount_disbursed ?? 0;
    if ((status === 'approved' || status === 'disbursed') && (!Number.isFinite(approvedVal) || approvedVal <= 0)) {
      toastError('Approved amount required', requiresPartialAmount
        ? 'Enter the partial benefit amount agreed by the Welfare Committee.'
        : 'Enter a valid approved amount greater than zero.');
      return;
    }
    if (amountApproved.trim() && (!Number.isFinite(approvedVal) || approvedVal < 0)) {
      toastError('Invalid approved amount', 'Enter a valid amount of zero or more.');
      return;
    }
    if (amountDisbursed > 0 && (!Number.isFinite(approvedVal) || approvedVal < amountDisbursed)) {
      toastError('Amount already paid', 'The approved amount cannot be less than the amount already disbursed.');
      return;
    }

    updateWelfareClaim(claim.id, {
      status,
      amount_approved: isNaN(approvedVal) ? undefined : approvedVal,
      pastoral_notes: pastoralNotes.trim() || undefined,
      date_reviewed: new Date().toISOString().split('T')[0],
      reviewed_by: settings.senior_pastor || 'Pastoral Oversight & Welfare Board',
    });

    success('Claim Review Updated', `Application ${claim.claim_number} marked as ${status.replace('_', ' ').toUpperCase()}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div role="dialog" aria-modal="true" aria-label="Review Benevolence Claim" className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 rounded-xl">
              <HeartHandshake className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">Review Benevolence Claim</h2>
                <span className="font-mono text-[11px] bg-slate-800 text-emerald-400 px-2 py-0.5 rounded">
                  {claim.claim_number}
                </span>
              </div>
              <p className="text-xs text-slate-400">Pastoral Council & Welfare Committee Evaluation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close welfare claim review"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSaveReview} className="p-6 space-y-4 overflow-y-auto">
          {/* Member & Dues Summary Card */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Beneficiary</p>
                  {claim.beneficiary_type === 'external_community' ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                      External Community
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Church Member
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-slate-900">{claim.member_name}</p>
                <p className="text-xs text-slate-500">
                  {claim.member_phone || 'No phone provided'}
                  {claim.beneficiary_community ? ` · ${claim.beneficiary_community}` : ''}
                </p>
              </div>
              <div className="text-right">
                {claim.beneficiary_type === 'external_community' ? (
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Assistance Model</p>
                    <p className="text-xs font-bold text-slate-700">Outreach Benevolence</p>
                    <p className="text-[10px] text-slate-400">Non-contributing</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Welfare Standing</p>
                    <p className="text-sm font-bold text-emerald-700">GH₵ {totalDuesPaid.toFixed(2)}</p>
                    <p className="text-[11px] text-slate-500">{standing ? `${standing.paidMonths.length} distinct months paid` : `${memberContributions.length} receipts`}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px]">Requested</span>
                <span className="font-bold text-slate-900">GH₵ {claim.amount_requested.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Approved</span>
                <span className="font-bold text-emerald-700">
                  GH₵ {(claim.amount_approved || 0).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Disbursed</span>
                <span className="font-bold text-blue-700">
                  GH₵ {(claim.amount_disbursed || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {claim.case_owner && (
              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
                <span>Case Assigned Owner:</span>
                <span className="font-semibold text-slate-800">{claim.case_owner}</span>
              </div>
            )}
          </div>

          {standing && <WelfareStandingNotice standing={standing} />}

          {/* Description & Justification */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Case Summary & Circumstances
            </h4>
            <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
              <p className="font-bold text-slate-900">{claim.title}</p>
              <p className="leading-relaxed whitespace-pre-wrap">{claim.description}</p>
              {claim.supporting_documents && (
                <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                  <span className="font-semibold text-slate-700">Verification:</span> {claim.supporting_documents}
                </p>
              )}
            </div>
          </div>

          {/* Confidential Pastoral Notes (Restricted display) */}
          {claim.confidential_pastoral_notes && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 uppercase tracking-wider text-[10px]">
                <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                Confidential Case Notes (Pastoral Council Only)
              </div>
              <p className="text-amber-950 whitespace-pre-wrap">{claim.confidential_pastoral_notes}</p>
            </div>
          )}

          {/* Review Decision: Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Evaluation Decision <span className="text-rose-500">*</span>
              </label>
              <select
                aria-label="Evaluation decision"
                value={status}
                onChange={(e) => setStatus(e.target.value as WelfareClaimStatus)}
                className="w-full text-sm rounded-xl border border-slate-300 py-2.5 px-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-semibold"
              >
                <option value="pending">Pending Board Review</option>
                <option value="under_review">Under Investigation / Review</option>
                <option value="approved">Approved for Disbursement</option>
                <option value="declined">Declined</option>
                <option value="disbursed">Already Disbursed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Approved Aid (GH₵)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">GH₵</span>
                <input
                  aria-label="Approved aid (GHS)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amountApproved}
                  onChange={(e) => setAmountApproved(e.target.value)}
                  disabled={status === 'declined'}
                  required={status === 'approved' || status === 'disbursed'}
                  placeholder={requiresPartialAmount ? 'Committee-approved partial amount' : ''}
                  className="w-full text-sm rounded-xl border border-slate-300 py-2.5 pl-12 pr-3 bg-white text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Pastoral Review Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Pastoral & Welfare Committee Recommendation
            </label>
            <textarea
              rows={3}
              value={pastoralNotes}
              onChange={(e) => setPastoralNotes(e.target.value)}
              placeholder="e.g. Approved standard Category A benefit. Welfare Chair to coordinate MoMo disbursement; Church visitation team assigned."
              className="w-full text-sm rounded-xl border border-slate-300 p-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
            {claim.status === 'approved' && status === claim.status && amountApproved === String(claim.amount_approved) ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDisburseModal(claim);
                }}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4 text-emerald-700" />
                Generate Payment Voucher
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition shadow-sm"
              >
                Save Review
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
