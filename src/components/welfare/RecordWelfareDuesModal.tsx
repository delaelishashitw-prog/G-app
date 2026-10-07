import React, { useState } from 'react';
import { X, HeartHandshake, Check, CreditCard, User, Calendar, Receipt } from 'lucide-react';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { useToast } from '../../contexts/ToastContext';
import { PaymentMethod } from '../../types/database.types';

interface RecordWelfareDuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedMemberId?: string;
}

export const RecordWelfareDuesModal: React.FC<RecordWelfareDuesModalProps> = ({
  isOpen,
  onClose,
  preselectedMemberId,
}) => {
  const { members, recordWelfareContribution, settings } = useChurchData();
  const { success, error: toastError } = useToast();

  const activeMembers = members.filter((m) => !m.is_archived);
  const defaultMember = preselectedMemberId
    ? activeMembers.find((m) => m.id === preselectedMemberId)
    : activeMembers[0];

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentDateStr = now.toISOString().split('T')[0];

  const [memberId, setMemberId] = useState(defaultMember?.id || '');
  const [amount, setAmount] = useState('50.00');
  const [month, setMonth] = useState(currentMonthStr);
  const [date, setDate] = useState(currentDateStr);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mobile_money');
  const [paymentChannel, setPaymentChannel] = useState('MTN Mobile Money');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedMem = members.find((m) => m.id === memberId);
    if (!selectedMem) {
      toastError('Validation Error', 'Please select a church member');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toastError('Validation Error', 'Please enter a valid contribution amount');
      return;
    }

    const ref = referenceNo.trim() || `WLF-${month.replace('-', '')}-${Math.floor(100 + Math.random() * 900)}`;

    recordWelfareContribution({
      member_id: selectedMem.id,
      member_name: `${selectedMem.first_name} ${selectedMem.last_name}`,
      tithe_number: selectedMem.tithe_number,
      date,
      month,
      amount: numAmount,
      payment_method: paymentMethod,
      payment_channel: paymentChannel,
      reference_no: ref,
      notes: notes.trim() || `Monthly welfare contribution for ${month}`,
      recorded_by: 'Welfare Desk Officer',
    });

    success(
      'Welfare Contribution Logged',
      `Recorded GH₵ ${numAmount.toFixed(2)} for ${selectedMem.first_name} ${selectedMem.last_name}`
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-emerald-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-700/80 rounded-xl">
              <HeartHandshake className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Record Welfare Dues</h2>
              <p className="text-xs text-emerald-200">GWCC Benevolence & Welfare Mutual Fund</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-700/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Member Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Church Member <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                required
                className="w-full text-sm rounded-xl border border-slate-300 py-2.5 px-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent font-medium"
              >
                <option value="">-- Choose Member --</option>
                {activeMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.first_name} {m.last_name} {m.tithe_number ? `(${m.tithe_number})` : ''} — {m.phone}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount & Month */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Amount ({settings.currency_symbol}) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">GH₵</span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-full text-sm rounded-xl border border-slate-300 py-2.5 pl-12 pr-3 bg-white text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div className="flex gap-2 mt-1.5">
                {['20.00', '50.00', '100.00'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(preset)}
                    className={`text-[11px] px-2 py-0.5 rounded-lg border font-semibold transition ${
                      amount === preset
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    GH₵ {preset}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Contribution Month <span className="text-rose-500">*</span>
              </label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                required
                className="w-full text-sm rounded-xl border border-slate-300 py-2.5 px-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Date & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Payment Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-sm rounded-xl border border-slate-300 py-2.5 px-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  const val = e.target.value as PaymentMethod;
                  setPaymentMethod(val);
                  if (val === 'mobile_money') setPaymentChannel('MTN Mobile Money');
                  else if (val === 'cash') setPaymentChannel('Cash at Desk');
                  else if (val === 'bank_transfer') setPaymentChannel('GCB Bank Transfer');
                }}
                className="w-full text-sm rounded-xl border border-slate-300 py-2.5 px-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="mobile_money">Mobile Money (MoMo)</option>
                <option value="cash">Cash Desk</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
          </div>

          {/* Channel & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Channel / Network
              </label>
              <select
                value={paymentChannel}
                onChange={(e) => setPaymentChannel(e.target.value)}
                className="w-full text-sm rounded-xl border border-slate-300 py-2.5 px-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {paymentMethod === 'mobile_money' ? (
                  <>
                    <option value="MTN Mobile Money">MTN Mobile Money</option>
                    <option value="Telecel Cash">Telecel Cash</option>
                    <option value="AT Money">AT Money (AirtelTigo)</option>
                  </>
                ) : paymentMethod === 'cash' ? (
                  <>
                    <option value="Cash at Desk">Cash Desk (Sanctuary)</option>
                    <option value="Cell Leader Collection">Cell Leader Collection</option>
                  </>
                ) : (
                  <>
                    <option value="GCB Bank Transfer">GCB Bank Transfer</option>
                    <option value="Ecobank Ghana">Ecobank Ghana</option>
                    <option value="Fidelity Bank">Fidelity Bank</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Reference / Txn ID
              </label>
              <input
                type="text"
                placeholder="e.g. 29381736192 or Auto"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                className="w-full text-sm rounded-xl border border-slate-300 py-2.5 px-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 placeholder:text-slate-400 font-mono text-xs"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Remarks / Memo
            </label>
            <input
              type="text"
              placeholder="e.g. Cleared 2 months backlog (Aug + Sep dues)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-sm rounded-xl border border-slate-300 py-2.5 px-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 transition rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl transition shadow-sm flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Save Contribution
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
