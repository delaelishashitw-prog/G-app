import React, { useState } from 'react';
import { X, Ban, AlertTriangle } from 'lucide-react';
import { ChurchFinanceRecord } from '../../types/database.types';
import { formatGHS } from '../../lib/currencyUtils';

interface VoidChurchFinanceModalProps {
  record: ChurchFinanceRecord;
  onVoid: (reason: string) => Promise<void>;
  onClose: () => void;
}

export const VoidChurchFinanceModal: React.FC<VoidChurchFinanceModalProps> = ({
  record,
  onVoid,
  onClose,
}) => {
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isInc = record.transaction_type === 'income' || record.transaction_type === 'grant';

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg('A valid reason for voiding this transaction is required for council audit.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onVoid(reason.trim());
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to void transaction.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 animate-in fade-in duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <span className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60">
              <Ban className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Void Financial Record</h3>
              <p className="text-xs text-slate-500">Audit-preserving cancellation & balance reversal</p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSubmitting} onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transaction Summary Card */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs mb-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Transaction:</span>
            <span className="font-bold text-slate-900 dark:text-white">{record.title}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Amount:</span>
            <span className={`font-mono font-bold ${isInc ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isInc ? '+' : '-'} {formatGHS(record.amount)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Holding Account:</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium">{record.account_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Ref / Voucher #:</span>
            <span className="font-mono text-slate-600 dark:text-slate-400">{record.reference_no || '—'}</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <p className="leading-relaxed">
            Voiding will preserve this entry in the ledger with a <strong className="font-bold">VOIDED</strong> watermark and automatically reverse {formatGHS(record.amount)} on <strong className="font-bold">{record.account_name}</strong> for audit compliance.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-3 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleConfirm} className="space-y-4"><fieldset disabled={isSubmitting} className="contents">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Reason for Voiding *
            </label>
            <textarea
              rows={3}
              required
              placeholder="e.g. Duplicate entry recorded in error, Cheque dishonored by bank, Vendor invoice cancelled by council..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <Ban className="w-4 h-4" />
              <span>{isSubmitting ? 'Voiding...' : 'Confirm Void'}</span>
            </button>
          </div>
        </fieldset></form>
      </div>
    </div>
  );
};
