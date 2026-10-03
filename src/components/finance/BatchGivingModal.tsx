import React, { useState } from 'react';
import { X, Plus, Trash2, CheckCircle2, Layers, AlertCircle, Hash, User, Tag } from 'lucide-react';
import { Member, GivingCategory, PaymentMethod } from '../../types/database.types';
import { formatGHS } from '../../lib/currencyUtils';
import { useToast } from '../../contexts/ToastContext';

interface BatchRow {
  id: string;
  mode: 'tithe_number' | 'name';
  tithe_number: string;
  member_id: string;
  donor_name: string;
  category: GivingCategory;
  amount: string;
  payment_method: PaymentMethod;
  payment_channel: string;
  reference_number: string;
  notes: string;
}

interface BatchGivingModalProps {
  members: Member[];
  onSaveBatch: (records: Array<{
    member_id?: string;
    member_name?: string;
    tithe_number?: string;
    donor_name?: string;
    category: GivingCategory;
    amount: number;
    currency: string;
    date: string;
    payment_method: PaymentMethod;
    payment_channel?: string;
    reference_number?: string;
    service_name?: string;
    notes?: string;
  }>) => void;
  onClose: () => void;
}

export const BatchGivingModal: React.FC<BatchGivingModalProps> = ({
  members,
  onSaveBatch,
  onClose,
}) => {
  const { error } = useToast();

  const [serviceName, setServiceName] = useState('Sunday 2nd Service (Celebration Service)');
  const [batchDate, setBatchDate] = useState(new Date().toISOString().split('T')[0]);

  const [rows, setRows] = useState<BatchRow[]>([
    {
      id: 'row-1',
      mode: 'tithe_number',
      tithe_number: '',
      member_id: '',
      donor_name: '',
      category: 'Tithe',
      amount: '',
      payment_method: 'cash',
      payment_channel: 'Cash Bowl Collection',
      reference_number: '',
      notes: '',
    },
    {
      id: 'row-2',
      mode: 'name',
      tithe_number: '',
      member_id: '',
      donor_name: '',
      category: 'Offering',
      amount: '',
      payment_method: 'cash',
      payment_channel: 'Cash Bowl Collection',
      reference_number: '',
      notes: '',
    },
    {
      id: 'row-3',
      mode: 'name',
      tithe_number: '',
      member_id: '',
      donor_name: '',
      category: 'Building Fund',
      amount: '',
      payment_method: 'mobile_money',
      payment_channel: 'MTN MoMo',
      reference_number: '',
      notes: '',
    },
  ]);

  const handleAddRow = (preferredMode: 'tithe_number' | 'name' = 'name') => {
    setRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        mode: preferredMode,
        tithe_number: '',
        member_id: '',
        donor_name: '',
        category: preferredMode === 'tithe_number' ? 'Tithe' : 'Offering',
        amount: '',
        payment_method: 'cash',
        payment_channel: 'Cash Bowl Collection',
        reference_number: '',
        notes: '',
      },
    ]);
  };

  const handleSetAllMode = (newMode: 'tithe_number' | 'name') => {
    setRows((prev) =>
      prev.map((r) => {
        let updatedTithe = r.tithe_number;
        let updatedMemId = r.member_id;
        if (newMode === 'tithe_number' && !updatedTithe && updatedMemId) {
          const m = members.find((x) => x.id === updatedMemId);
          if (m?.tithe_number) updatedTithe = m.tithe_number;
        }
        return {
          ...r,
          mode: newMode,
          tithe_number: updatedTithe,
          category: newMode === 'tithe_number' ? 'Tithe' : r.category,
        };
      })
    );
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleRowChange = (id: string, field: keyof BatchRow, val: any) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const updated = { ...r, [field]: val };
          // If payment method changed to mobile_money, default channel
          if (field === 'payment_method') {
            if (val === 'mobile_money' && updated.payment_channel === 'Cash Bowl Collection') {
              updated.payment_channel = 'MTN MoMo';
            } else if (val === 'cash' && updated.payment_channel === 'MTN MoMo') {
              updated.payment_channel = 'Cash Bowl Collection';
            }
          }
          return updated;
        }
        return r;
      })
    );
  };

  // Valid rows have a positive numeric amount
  const validRows = rows.filter((r) => {
    const amt = parseFloat(r.amount);
    return !isNaN(amt) && amt > 0;
  });

  const batchTotal = validRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validRows.length === 0) {
      error('No valid entries', 'Please enter an amount for at least one row.');
      return;
    }

    const payload = validRows.map((r, index) => {
      let memberName = '';
      let titheNum = r.tithe_number ? r.tithe_number.trim() : '';
      let memberId = r.member_id;

      if (memberId) {
        const mem = members.find((m) => m.id === memberId);
        memberName = mem ? `${mem.first_name} ${mem.last_name}` : '';
        if (!titheNum && mem?.tithe_number) {
          titheNum = mem.tithe_number;
        }
      } else if (titheNum) {
        const mem = members.find(
          (m) =>
            m.tithe_number?.trim().toLowerCase() === titheNum.toLowerCase() ||
            (m.tithe_number && titheNum.replace(/\D/g, '') && m.tithe_number.replace(/\D/g, '') === titheNum.replace(/\D/g, ''))
        );
        if (mem) {
          memberId = mem.id;
          memberName = `${mem.first_name} ${mem.last_name}`;
          titheNum = mem.tithe_number || titheNum;
        }
      }

      const refNo =
        r.reference_number ||
        `${r.payment_method === 'mobile_money' ? 'MM' : 'CSH'}-${Date.now().toString().slice(-6)}-${index + 1}`;

      return {
        member_id: memberId || undefined,
        member_name: memberName || undefined,
        tithe_number: titheNum || undefined,
        donor_name: memberName ? undefined : r.donor_name || (titheNum ? `Tithe Envelope #${titheNum}` : 'Anonymous Giver'),
        category: r.category,
        amount: parseFloat(r.amount),
        currency: 'GHS',
        date: batchDate,
        payment_method: r.payment_method,
        payment_channel: r.payment_channel || undefined,
        reference_number: refNo,
        service_name: serviceName,
        notes: r.notes || undefined,
      };
    });

    onSaveBatch(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-[#064e3b] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-emerald-700/60 rounded-xl">
              <Layers className="w-5 h-5 text-emerald-200" />
            </span>
            <div>
              <h3 className="text-base font-bold">Fast Sunday Batch Giving Entry</h3>
              <p className="text-xs text-emerald-200">
                Rapid multi-envelope / tithe slip recorder for Ushers & Treasury stewards
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-emerald-200 hover:text-white rounded-lg transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Batch Controls */}
        <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs shrink-0">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Service Attended</label>
            <input
              type="text"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Collection Date</label>
            <input
              type="date"
              value={batchDate}
              onChange={(e) => setBatchDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-mono"
            />
          </div>

          <div className="flex items-center justify-between bg-white px-3.5 py-2 rounded-xl border border-emerald-200">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Batch Total</span>
              <span className="text-base font-extrabold text-emerald-900 font-mono">
                {formatGHS(batchTotal)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Valid Items</span>
              <span className="text-sm font-bold text-slate-800 font-mono">
                {validRows.length} of {rows.length}
              </span>
            </div>
          </div>
        </div>

        {/* Rapid Mode Quick Presets */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 font-semibold text-[11px]">Tithe / Member Mode:</span>
            <button
              type="button"
              onClick={() => handleSetAllMode('tithe_number')}
              className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-[11px] border border-amber-300 flex items-center gap-1 transition cursor-pointer"
              title="Set all batch rows to Tithe Number entry for rapid envelope logging"
            >
              <Hash className="w-3 h-3 text-amber-700" />
              <span>Switch All to Tithe # Mode</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetAllMode('name')}
              className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[11px] border border-slate-300 flex items-center gap-1 transition cursor-pointer"
            >
              <User className="w-3 h-3 text-slate-600" />
              <span>Switch All to Name Mode</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleAddRow('tithe_number')}
              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-[11px] border border-emerald-300 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3 text-emerald-600" />
              <span>+ Add Tithe # Row</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddRow('name')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] border border-slate-300 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3 text-slate-500" />
              <span>+ Add Name Row</span>
            </button>
          </div>
        </div>

        {/* Multi-Row Table */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                <tr>
                  <th className="py-2.5 px-3 w-8">#</th>
                  <th className="py-2.5 px-3 min-w-[240px]">Tither / Member (By Name or Tithe #)</th>
                  <th className="py-2.5 px-3 w-36">Category</th>
                  <th className="py-2.5 px-3 w-28">Amount (GH₵) *</th>
                  <th className="py-2.5 px-3 w-32">Payment Method</th>
                  <th className="py-2.5 px-3 w-36">Channel / Telco</th>
                  <th className="py-2.5 px-3 w-32">Reference #</th>
                  <th className="py-2.5 px-3 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-2 px-3 font-mono text-slate-400 text-center">{idx + 1}</td>

                    {/* Member or Tithe # */}
                    <td className="py-2 px-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const newMode = r.mode === 'tithe_number' ? 'name' : 'tithe_number';
                              handleRowChange(r.id, 'mode', newMode);
                              if (newMode === 'tithe_number') {
                                handleRowChange(r.id, 'category', 'Tithe');
                              }
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer shrink-0 flex items-center gap-1 ${
                              r.mode === 'tithe_number'
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                            title="Click to toggle between Tithe Number and Member Name"
                          >
                            {r.mode === 'tithe_number' ? (
                              <>
                                <Hash className="w-2.5 h-2.5 text-amber-700" />
                                <span>Tithe No.</span>
                              </>
                            ) : (
                              <>
                                <User className="w-2.5 h-2.5 text-slate-600" />
                                <span>By Name</span>
                              </>
                            )}
                          </button>

                          {/* Quick Resolved Badge */}
                          {r.member_id && (
                            (() => {
                              const m = members.find((x) => x.id === r.member_id);
                              if (!m) return null;
                              return (
                                <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 truncate">
                                  {m.first_name} {m.last_name} {m.tithe_number ? `(#${m.tithe_number})` : ''}
                                </span>
                              );
                            })()
                          )}
                        </div>

                        {r.mode === 'tithe_number' ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              list="batch-tithe-list"
                              placeholder="Type tithe # (e.g. T-1001)..."
                              value={r.tithe_number}
                              onChange={(e) => {
                                const val = e.target.value;
                                const cleanedVal = val.trim();
                                const matched = members.find(
                                  (m) =>
                                    m.tithe_number?.toLowerCase() === cleanedVal.toLowerCase() ||
                                    (cleanedVal.length >= 2 &&
                                      m.tithe_number &&
                                      cleanedVal.replace(/\D/g, '') &&
                                      m.tithe_number.replace(/\D/g, '') === cleanedVal.replace(/\D/g, ''))
                                );
                                setRows((prev) =>
                                  prev.map((row) =>
                                    row.id === r.id
                                      ? {
                                          ...row,
                                          tithe_number: val,
                                          member_id: matched ? matched.id : '',
                                          donor_name: matched ? '' : row.donor_name,
                                          category: 'Tithe',
                                        }
                                      : row
                                  )
                                );
                              }}
                              className="w-full px-2 py-1 text-xs border border-amber-300 rounded font-mono font-bold bg-amber-50/40 focus:bg-white"
                            />
                            {!r.member_id && r.tithe_number && (
                              <input
                                type="text"
                                placeholder="Giver name (if known, optional)"
                                value={r.donor_name}
                                onChange={(e) => handleRowChange(r.id, 'donor_name', e.target.value)}
                                className="w-full px-2 py-0.5 text-[10px] border border-amber-200 rounded bg-white"
                              />
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <select
                              value={r.member_id}
                              onChange={(e) => {
                                const memId = e.target.value;
                                const selected = members.find((m) => m.id === memId);
                                setRows((prev) =>
                                  prev.map((row) =>
                                    row.id === r.id
                                      ? {
                                          ...row,
                                          member_id: memId,
                                          tithe_number: selected?.tithe_number || '',
                                          donor_name: selected ? '' : row.donor_name,
                                        }
                                      : row
                                  )
                                );
                              }}
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                            >
                              <option value="">-- Guest / Non-Member --</option>
                              {members
                                .filter((m) => !m.is_archived)
                                .map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.first_name} {m.last_name} ({m.member_id}{m.tithe_number ? ` • ${m.tithe_number}` : ''})
                                  </option>
                                ))}
                            </select>
                            {!r.member_id && (
                              <input
                                type="text"
                                placeholder="Guest Name (e.g. Visitor Kofi)"
                                value={r.donor_name}
                                onChange={(e) => handleRowChange(r.id, 'donor_name', e.target.value)}
                                className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded bg-slate-50 focus:bg-white"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-2 px-3">
                      <select
                        value={r.category}
                        onChange={(e) => handleRowChange(r.id, 'category', e.target.value as any)}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-semibold text-slate-800 bg-white"
                      >
                        <option value="Tithe">Tithe</option>
                        <option value="Offering">Offering</option>
                        <option value="Thanksgiving">Thanksgiving</option>
                        <option value="Building Fund">Building Fund</option>
                        <option value="Seed">Sacrificial Seed</option>
                        <option value="First Fruit">First Fruit</option>
                        <option value="Missions">Missions</option>
                        <option value="Special Offering">Special Offering</option>
                        <option value="Donation">Special Donation</option>
                        <option value="Other">Other</option>
                      </select>
                    </td>

                    {/* Amount */}
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={r.amount}
                        onChange={(e) => handleRowChange(r.id, 'amount', e.target.value)}
                        className={`w-full px-2 py-1 text-xs font-mono font-bold border rounded ${
                          parseFloat(r.amount) > 0
                            ? 'border-emerald-400 bg-emerald-50/40 text-emerald-900'
                            : 'border-slate-200'
                        }`}
                      />
                    </td>

                    {/* Method */}
                    <td className="py-2 px-3">
                      <select
                        value={r.payment_method}
                        onChange={(e) => handleRowChange(r.id, 'payment_method', e.target.value as any)}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white capitalize"
                      >
                        <option value="cash">Cash</option>
                        <option value="mobile_money">Mobile Money</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="card">Card / POS</option>
                        <option value="cheque">Cheque</option>
                        <option value="other">Other</option>
                      </select>
                    </td>

                    {/* Channel */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        placeholder={r.payment_method === 'mobile_money' ? 'MTN MoMo' : 'Cash Bowl'}
                        value={r.payment_channel}
                        onChange={(e) => handleRowChange(r.id, 'payment_channel', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                      />
                    </td>

                    {/* Reference */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        placeholder="e.g. MM-1234 or env #42"
                        value={r.reference_number}
                        onChange={(e) => handleRowChange(r.id, 'reference_number', e.target.value)}
                        className="w-full px-2 py-1 text-xs font-mono border border-slate-200 rounded bg-white text-[11px]"
                      />
                    </td>

                    {/* Action */}
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(r.id)}
                        disabled={rows.length <= 1}
                        className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 transition cursor-pointer"
                        title="Remove row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => handleAddRow('name')}
              className="px-3 py-1.5 rounded-lg border border-dashed border-emerald-600 text-emerald-800 hover:bg-emerald-50 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Another Entry (+1)</span>
            </button>

            <span className="text-[11px] text-slate-500">
              Only rows with valid amounts will be committed.
            </span>
          </div>

          {/* Action Bar Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-600 font-medium">
                Ready to commit: <strong>{validRows.length} gifts</strong> ({formatGHS(batchTotal)})
              </span>
              <button
                type="submit"
                disabled={validRows.length === 0}
                className="px-5 py-2.5 bg-[#064e3b] hover:bg-[#047857] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Commit & Record Batch to Treasury</span>
              </button>
            </div>
          </div>
        </form>

        {/* Global Tithe Autocomplete Datalist */}
        <datalist id="batch-tithe-list">
          {members
            .filter((m) => !m.is_archived && m.tithe_number)
            .map((m) => (
              <option key={m.id} value={m.tithe_number}>
                {m.first_name} {m.last_name} ({m.member_id})
              </option>
            ))}
        </datalist>
      </div>
    </div>
  );
};
