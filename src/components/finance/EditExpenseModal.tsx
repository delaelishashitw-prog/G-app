import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { ExpenseRecord, PaymentMethod } from '../../types/database.types';
import { useToast } from '../../contexts/ToastContext';

interface EditExpenseModalProps {
  record: ExpenseRecord;
  onSave: (id: string, updates: Partial<ExpenseRecord>) => void;
  onClose: () => void;
}

export const EditExpenseModal: React.FC<EditExpenseModalProps> = ({
  record,
  onSave,
  onClose,
}) => {
  const { error } = useToast();

  const [form, setForm] = useState({
    title: record.title || record.description || '',
    category: record.category || 'Utilities',
    amount: record.amount.toString(),
    date: record.date || new Date().toISOString().split('T')[0],
    payment_method: record.payment_method as PaymentMethod,
    account: record.account || '',
    recipient: record.recipient || '',
    approved_by: (!record.approved_by || record.approved_by === 'Rev. Emmanuel Appiah' || record.approved_by.includes('Agyemang-Prempeh') || record.approved_by.includes('Emmanuel Agyemang') || record.approved_by.includes('Emmanuel Appiah'))
      ? 'Prophet Elisha K. Richard'
      : record.approved_by,
    reference_number: record.reference_number || '',
    notes: record.notes || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) {
      error('Invalid Amount', 'Please provide a valid expense amount.');
      return;
    }

    onSave(record.id, {
      title: form.title,
      description: form.title,
      category: form.category,
      amount: amt,
      date: form.date,
      payment_method: form.payment_method,
      account: form.account || undefined,
      recipient: form.recipient || undefined,
      approved_by: form.approved_by || undefined,
      reference_number: form.reference_number || undefined,
      notes: form.notes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4">
        {/* Header */}
        <div className="px-6 py-4 bg-rose-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">Edit Expense Voucher</h3>
            <p className="text-xs text-rose-200">Updating voucher ID: {record.id}</p>
          </div>
          <button onClick={onClose} className="p-1 text-white/80 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Expense Item Title *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              placeholder="e.g. ECG Power Prepaid for Sanctuary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category / Vote</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              >
                <option value="Utilities">Utilities & Power (ECG / Water)</option>
                <option value="Media & Production">Media, Sound & Broadcasting</option>
                <option value="Salaries/Allowances">Salaries & Staff Welfare</option>
                <option value="Building Maintenance">Building Maintenance & Repairs</option>
                <option value="Evangelism & Outreach">Evangelism & Outreach</option>
                <option value="Guest Minister Honorarium">Guest Minister Honorarium</option>
                <option value="Youth & Children">Youth & Sunday School</option>
                <option value="Administration & Office">Administration & Office</option>
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
                placeholder="250.00"
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
                <option value="bank_transfer">Bank Wire</option>
                <option value="cash">Petty Cash</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Recipient / Vendor</label>
              <input
                type="text"
                value={form.recipient}
                onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                placeholder="e.g. ECG Ablekuma District"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Approved By</label>
              <input
                type="text"
                value={form.approved_by}
                onChange={(e) => setForm({ ...form, approved_by: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                placeholder="e.g. Prophet Elisha K. Richard"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Account / Source</label>
              <input
                type="text"
                value={form.account}
                onChange={(e) => setForm({ ...form, account: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                placeholder="e.g. Mobile Money Account or Zenith Bank"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Voucher Reference #</label>
              <input
                type="text"
                value={form.reference_number}
                onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                placeholder="e.g. VCH-00123"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Notes / Description</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              placeholder="e.g. Power for all-night vigil service"
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
              className="px-5 py-2 bg-rose-800 hover:bg-rose-900 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Update Voucher</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
