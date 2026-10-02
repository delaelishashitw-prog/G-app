import React, { useState } from 'react';
import { X, CreditCard, CheckCircle, Smartphone, Building2, Banknote, FileCheck } from 'lucide-react';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { PledgeRecord, PaymentMethod } from '../../types/database.types';
import { formatGHS, numberToCedisWords } from '../../lib/currencyUtils';

interface RecordPledgePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  pledge: PledgeRecord | null;
}

export const RecordPledgePaymentModal: React.FC<RecordPledgePaymentModalProps> = ({
  isOpen,
  onClose,
  pledge,
}) => {
  const { recordPledgePayment } = useChurchData();

  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mobile_money');
  const [paymentChannel, setPaymentChannel] = useState('MTN MoMo');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [syncWithGiving, setSyncWithGiving] = useState(true);
  const [notes, setNotes] = useState('');

  if (!isOpen || !pledge) return null;

  const numericAmount = parseFloat(amount) || 0;
  const newProjectedBalance = Math.max(0, pledge.balance - numericAmount);

  const handleQuickPercent = (pct: number) => {
    const val = (pledge.balance * pct).toFixed(2);
    setAmount(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numericAmount <= 0) return;

    recordPledgePayment(pledge.id, numericAmount, {
      method: paymentMethod,
      channel: paymentChannel,
      reference: referenceNumber.trim() || undefined,
      syncWithGiving,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-900 to-indigo-950 text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-amber-300" />
              <h3 className="text-base font-bold">Record Pledge Redemption Payment</h3>
            </div>
            <p className="text-xs text-purple-200 mt-0.5">{pledge.campaign_name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-purple-200 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Member & Covenant Summary Banner */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Covenant Partner
                </span>
                <div className="font-bold text-slate-900 text-sm">{pledge.member_name}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Target Due Date
                </span>
                <div className="font-mono text-slate-700 font-semibold">{pledge.due_date || 'Open'}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/80 text-center">
              <div className="bg-white p-2 rounded-lg border border-slate-100">
                <div className="text-[10px] font-semibold text-slate-500">Pledged</div>
                <div className="font-mono font-bold text-slate-800 text-xs">
                  {formatGHS(pledge.amount_pledged)}
                </div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-100">
                <div className="text-[10px] font-semibold text-slate-500">Already Paid</div>
                <div className="font-mono font-bold text-emerald-700 text-xs">
                  {formatGHS(pledge.amount_paid)}
                </div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-purple-100 bg-purple-50/40">
                <div className="text-[10px] font-semibold text-purple-900">Current Balance</div>
                <div className="font-mono font-bold text-purple-900 text-xs">
                  {formatGHS(pledge.balance)}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Payment Preset Buttons */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-slate-800">
                Payment Amount (GH₵) <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickPercent(0.25)}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-purple-100 hover:text-purple-900 text-[11px] font-semibold text-slate-600 transition"
                >
                  25%
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPercent(0.5)}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-purple-100 hover:text-purple-900 text-[11px] font-semibold text-slate-600 transition"
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPercent(1.0)}
                  className="px-2 py-0.5 rounded bg-purple-100 hover:bg-purple-200 text-purple-900 text-[11px] font-bold transition"
                >
                  Full Balance
                </button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold font-mono">
                GH₵
              </div>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={pledge.balance}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-13 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold text-purple-950 focus:border-purple-600 focus:outline-hidden"
              />
            </div>
            {numericAmount > 0 && (
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="text-purple-800 italic">{numberToCedisWords(numericAmount)}</span>
                <span className="font-mono text-slate-500">
                  New Bal: <strong className="text-slate-800">{formatGHS(newProjectedBalance)}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Payment Method & Channel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  const m = e.target.value as PaymentMethod;
                  setPaymentMethod(m);
                  if (m === 'mobile_money') setPaymentChannel('MTN MoMo');
                  else if (m === 'cash') setPaymentChannel('Cash Counter');
                  else if (m === 'bank_transfer') setPaymentChannel('GCB Bank Deposit');
                  else setPaymentChannel('Cheque');
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:border-purple-600 focus:outline-hidden"
              >
                <option value="mobile_money">Mobile Money (MTN / Telecel / AT)</option>
                <option value="cash">Cash in Hand</option>
                <option value="bank_transfer">Direct Bank Transfer</option>
                <option value="cheque">Bank Cheque</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Channel / Telco</label>
              <input
                type="text"
                value={paymentChannel}
                onChange={(e) => setPaymentChannel(e.target.value)}
                placeholder="e.g. MTN MoMo, Telecel Cash"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:border-purple-600 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Transaction Ref & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Receipt / Transaction Ref
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. MM-8910283 or CHQ-0021"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:border-purple-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Notes / Remarks</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. 3rd installment payment"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:border-purple-600 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Auto Sync with Giving Ledger */}
          <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="syncWithGivingLedger"
                checked={syncWithGiving}
                onChange={(e) => setSyncWithGiving(e.target.checked)}
                className="w-4 h-4 text-purple-700 rounded border-purple-300 focus:ring-purple-500"
              />
              <div>
                <label htmlFor="syncWithGivingLedger" className="font-semibold text-purple-950 cursor-pointer">
                  Sync with Church Giving & Tithe Ledger
                </label>
                <p className="text-[10px] text-purple-700">
                  Adds record under "Building Fund" category so it appears in Sunday receipts & statements
                </p>
              </div>
            </div>
            <FileCheck className="w-5 h-5 text-purple-600 opacity-60" />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white rounded-xl font-bold shadow-md flex items-center gap-1.5 transition"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Confirm & Issue Receipt</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
