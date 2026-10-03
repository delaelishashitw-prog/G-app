import React, { useState } from 'react';
import { X, Coins, Check, AlertCircle } from 'lucide-react';
import { Member, GivingCategory, PaymentMethod } from '../../types/database.types';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { useToast } from '../../contexts/ToastContext';
import { formatGHS } from '../../lib/currencyUtils';

interface RecordMemberGivingModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member;
}

export const RecordMemberGivingModal: React.FC<RecordMemberGivingModalProps> = ({
  isOpen,
  onClose,
  member,
}) => {
  const { recordGiving, services } = useChurchData();
  const { success, error } = useToast();

  const [category, setCategory] = useState<GivingCategory>('Tithe');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mobile_money');
  const [paymentChannel, setPaymentChannel] = useState<string>('MTN MoMo');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [serviceId, setServiceId] = useState<string>(services[0]?.id || '');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      error('Please enter a valid contribution amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedSrv = services.find((s) => s.id === serviceId);

      recordGiving({
        member_id: member.id,
        member_name: `${member.first_name} ${member.last_name}`,
        tithe_number: member.tithe_number || undefined,
        donor_name: `${member.first_name} ${member.last_name}`,
        category,
        amount: parsedAmount,
        currency: 'GHS',
        date,
        payment_method: paymentMethod,
        payment_channel: paymentChannel,
        reference_number: referenceNumber.trim() || undefined,
        service_id: serviceId || undefined,
        service_name: selectedSrv ? selectedSrv.name : undefined,
        notes: notes.trim() || undefined,
      });

      success(`Successfully recorded ${formatGHS(parsedAmount)} ${category} for ${member.first_name}${member.tithe_number ? ` (Tithe #${member.tithe_number})` : ''}!`);
      onClose();
    } catch (err) {
      console.error(err);
      error('Failed to record contribution.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-800 to-emerald-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Coins className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <h3 className="font-bold text-base">Record Giving / Tithe</h3>
              <p className="text-xs text-teal-100">
                For {member.first_name} {member.last_name} ({member.member_id}{member.tithe_number ? ` • Tithe #${member.tithe_number}` : ''})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-teal-200 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Giving Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as GivingCategory)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-teal-600 font-bold text-slate-800"
              >
                <option value="Tithe">Tithe (Tithe #{member.tithe_number || 'N/A'})</option>
                <option value="Offering">Sunday Offering</option>
                <option value="Building Fund">Church Building Project</option>
                <option value="Thanksgiving">Thanksgiving Offering</option>
                <option value="Seed">Sacrificial Seed</option>
                <option value="Missions">Evangelism & Missions</option>
                <option value="Donation">Welfare Donation</option>
                <option value="Other">Other Contribution</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Amount (GH₵) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.5"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-teal-600 font-black text-slate-900 font-mono"
                autoFocus
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Contribution Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-teal-600 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Service Session</label>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-teal-600 font-medium"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  const m = e.target.value as PaymentMethod;
                  setPaymentMethod(m);
                  if (m === 'mobile_money') setPaymentChannel('MTN MoMo');
                  else if (m === 'bank_transfer') setPaymentChannel('GCB Bank Transfer');
                  else setPaymentChannel('Cash Bowl');
                }}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-teal-600 font-medium"
              >
                <option value="mobile_money">Mobile Money (MoMo)</option>
                <option value="cash">Cash In Hand / Envelope</option>
                <option value="bank_transfer">Bank Transfer / Cheque</option>
                <option value="pos">POS / Card</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Channel / Network</label>
              <input
                type="text"
                placeholder="e.g. MTN MoMo, Telecel Cash, GCB Bank"
                value={paymentChannel}
                onChange={(e) => setPaymentChannel(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-teal-600 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              MoMo Reference / Tx ID (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. MM-2026-99324 or Envelope #12"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-teal-600 font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Remarks / Note</label>
            <input
              type="text"
              placeholder="e.g. September Tithe, Thanksgiving blessing for new job"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-teal-600 font-medium"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md shadow-teal-700/20 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Recording...' : 'Record Giving'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
