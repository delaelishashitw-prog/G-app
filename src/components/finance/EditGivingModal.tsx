import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { GivingRecord, GivingCategory, PaymentMethod, Member } from '../../types/database.types';
import { useToast } from '../../contexts/ToastContext';

interface EditGivingModalProps {
  record: GivingRecord;
  members: Member[];
  onSave: (id: string, updates: Partial<GivingRecord>) => void;
  onClose: () => void;
}

export const EditGivingModal: React.FC<EditGivingModalProps> = ({
  record,
  members,
  onSave,
  onClose,
}) => {
  const { error } = useToast();

  const [form, setForm] = useState({
    member_id: record.member_id || '',
    donor_name: record.donor_name || '',
    category: record.category as GivingCategory,
    amount: record.amount.toString(),
    date: record.date || new Date().toISOString().split('T')[0],
    payment_method: record.payment_method as PaymentMethod,
    payment_channel: record.payment_channel || '',
    reference_number: record.reference_number || '',
    service_name: record.service_name || '',
    notes: record.notes || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) {
      error('Invalid Amount', 'Please provide a valid positive amount.');
      return;
    }

    let memberName = '';
    if (form.member_id) {
      const m = members.find((x) => x.id === form.member_id);
      memberName = m ? `${m.first_name} ${m.last_name}` : '';
    }

    onSave(record.id, {
      member_id: form.member_id || undefined,
      member_name: memberName || undefined,
      donor_name: memberName ? undefined : form.donor_name || 'Anonymous Giver',
      category: form.category,
      amount: amt,
      date: form.date,
      payment_method: form.payment_method,
      payment_channel: form.payment_channel || undefined,
      reference_number: form.reference_number || undefined,
      service_name: form.service_name || undefined,
      notes: form.notes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4">
        {/* Header */}
        <div className="px-6 py-4 bg-[#064e3b] text-white flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">Edit Giving Record</h3>
            <p className="text-xs text-emerald-200">Updating transaction ID: {record.id}</p>
          </div>
          <button onClick={onClose} className="p-1 text-white/80 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Select Member (or choose Guest/Anonymous)
            </label>
            <select
              value={form.member_id}
              onChange={(e) => setForm({ ...form, member_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            >
              <option value="">-- General Anonymous / Non-Member --</option>
              {members
                .filter((m) => !m.is_archived || m.id === form.member_id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.first_name} {m.last_name} ({m.member_id} {m.tithe_number ? `• Tithe #${m.tithe_number}` : ''})
                  </option>
                ))}
            </select>
          </div>

          {!form.member_id && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Donor Name / Source (Guest)</label>
              <input
                type="text"
                value={form.donor_name}
                onChange={(e) => setForm({ ...form, donor_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                placeholder="e.g. Visitor Kwabena"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Giving Category *</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
              >
                <option value="Tithe">Tithe (10%)</option>
                <option value="Offering">Offering</option>
                <option value="Thanksgiving">Thanksgiving</option>
                <option value="Building Fund">Building Fund</option>
                <option value="First Fruit">First Fruit</option>
                <option value="Missions">Missions</option>
                <option value="Special Offering">Special Offering</option>
                <option value="Seed">Sacrificial Seed</option>
                <option value="Donation">Special Donation</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Amount (GH₵) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                placeholder="100.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
              <select
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs capitalize"
              >
                <option value="mobile_money">Mobile Money (MoMo)</option>
                <option value="cash">Cash Collection</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Channel / Telco</label>
              <input
                type="text"
                value={form.payment_channel}
                onChange={(e) => setForm({ ...form, payment_channel: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                placeholder="MTN MoMo / Telecel / GCB"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Transaction Ref #</label>
              <input
                type="text"
                value={form.reference_number}
                onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                placeholder="e.g. MM-20260924-001"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Service Attended</label>
            <input
              type="text"
              value={form.service_name}
              onChange={(e) => setForm({ ...form, service_name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              placeholder="Sunday 2nd Service (Celebration)"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Notes / Purpose (Optional)</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              placeholder="e.g. September Tithe"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#064e3b] hover:bg-[#047857] text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Update Record</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
