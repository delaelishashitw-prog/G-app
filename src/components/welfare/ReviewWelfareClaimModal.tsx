import React, { useState } from 'react';
import { X, CheckCircle2, XCircle, AlertCircle, HeartHandshake, FileText, ArrowRight, Printer } from 'lucide-react';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { useToast } from '../../contexts/ToastContext';
import { WelfareClaim, WelfareClaimStatus } from '../../types/database.types';

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
  const { updateWelfareClaim, welfareContributions, settings } = useChurchData();
  const { success, error: toastError } = useToast();

  if (!isOpen || !claim) return null;

  // Member's historical contributions
  const memberContributions = welfareContributions.filter((c) => c.member_id === claim.member_id);
  const totalDuesPaid = memberContributions.reduce((sum, c) => sum + c.amount, 0);

  const [status, setStatus] = useState<WelfareClaimStatus>(claim.status);
  const [amountApproved, setAmountApproved] = useState(
    claim.amount_approved ? String(claim.amount_approved) : String(claim.amount_requested)
  );
  const [pastoralNotes, setPastoralNotes] = useState(claim.pastoral_notes || '');

  const handleSaveReview = (e: React.FormEvent) => {
    e.preventDefault();
    const approvedVal = parseFloat(amountApproved);

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
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
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
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Applicant</p>
                <p className="text-sm font-bold text-slate-900">{claim.member_name}</p>
                <p className="text-xs text-slate-500">{claim.member_phone || 'No phone provided'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Welfare Standing</p>
                <p className="text-sm font-bold text-emerald-700">GH₵ {totalDuesPaid.toFixed(2)}</p>
                <p className="text-[11px] text-slate-500">{memberContributions.length} monthly contributions</p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500">Requested: </span>
                <span className="font-bold text-slate-900">GH₵ {claim.amount_requested.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500">Date Logged: </span>
                <span className="font-medium text-slate-700">{claim.date_submitted}</span>
              </div>
            </div>
          </div>

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

          {/* Review Decision: Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Evaluation Decision <span className="text-rose-500">*</span>
              </label>
              <select
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
                  type="number"
                  step="0.01"
                  min="0"
                  value={amountApproved}
                  onChange={(e) => setAmountApproved(e.target.value)}
                  disabled={status === 'declined'}
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
            {claim.status === 'approved' || status === 'approved' ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDisburseModal({
                    ...claim,
                    amount_approved: parseFloat(amountApproved) || claim.amount_requested,
                    pastoral_notes: pastoralNotes,
                  });
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
