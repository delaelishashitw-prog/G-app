import React, { useState } from 'react';
import { X, Coins, User, Calendar, FileText, CheckCircle2, Phone, CreditCard } from 'lucide-react';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { formatGHS, numberToCedisWords } from '../../lib/currencyUtils';
import { PaymentMethod } from '../../types/database.types';

interface AddPledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedCampaignId?: string;
  preselectedMemberId?: string;
}

export const AddPledgeModal: React.FC<AddPledgeModalProps> = ({
  isOpen,
  onClose,
  preselectedCampaignId,
  preselectedMemberId,
}) => {
  const { members, campaigns, createPledge, recordPledgePayment } = useChurchData();

  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState(
    preselectedMemberId || (members[0]?.id ?? '')
  );
  const [campaignId, setCampaignId] = useState(
    preselectedCampaignId || campaigns[0]?.id || 'custom'
  );
  const [customCampaignName, setCustomCampaignName] = useState('');
  const [amountPledged, setAmountPledged] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('2026-12-31');
  const [notes, setNotes] = useState('');

  // Initial deposit option
  const [hasInitialDeposit, setHasInitialDeposit] = useState(false);
  const [initialAmount, setInitialAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mobile_money');
  const [paymentChannel, setPaymentChannel] = useState('MTN MoMo');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [syncWithGiving, setSyncWithGiving] = useState(true);

  if (!isOpen) return null;

  const selectedMember = members.find((m) => m.id === selectedMemberId);
  const activeCampaigns = campaigns.filter((c) => c.is_active);

  const filteredMembers = members.filter((m) => {
    if (!memberSearch) return true;
    const term = (memberSearch || '').toLowerCase();
    return (
      (m.first_name || '').toLowerCase().includes(term) ||
      (m.last_name || '').toLowerCase().includes(term) ||
      (m.member_id || '').toLowerCase().includes(term) ||
      (m.phone && m.phone.includes(term))
    );
  });

  const numericPledged = parseFloat(amountPledged) || 0;
  const numericInitial = parseFloat(initialAmount) || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    if (numericPledged <= 0) return;

    let targetCampaignName = '';
    if (campaignId === 'custom') {
      targetCampaignName = customCampaignName.trim() || 'General Kingdom Building Fund';
    } else {
      const cmp = campaigns.find((c) => c.id === campaignId);
      targetCampaignName = cmp ? cmp.name : 'Capital Project Campaign';
    }

    const memberFullName = `${selectedMember.first_name} ${selectedMember.last_name}`.trim();

    const created = createPledge({
      campaign_id: campaignId !== 'custom' ? campaignId : undefined,
      campaign_name: targetCampaignName,
      member_id: selectedMember.id,
      member_name: memberFullName,
      member_phone: selectedMember.phone,
      amount_pledged: numericPledged,
      amount_paid: 0,
      start_date: startDate,
      due_date: dueDate,
      notes: notes.trim() || undefined,
    });

    // If an initial deposit was made right upon pledging
    if (hasInitialDeposit && numericInitial > 0 && created) {
      recordPledgePayment(created.id, numericInitial, {
        method: paymentMethod,
        channel: paymentChannel,
        reference: referenceNumber.trim() || undefined,
        syncWithGiving,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-900 to-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-700/50 flex items-center justify-center border border-purple-400/30">
              <Coins className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Record Kingdom Pledge Commitment</h2>
              <p className="text-xs text-purple-200">
                Faith covenant for sanctuary expansion & capital projects
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-purple-200 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {/* Member Selection */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-800">
              Church Member <span className="text-rose-500">*</span>
            </label>
            <div className="relative mb-1.5">
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search member by name, phone or ID (e.g. Kwame, 024...)"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-purple-600 focus:outline-hidden"
              />
            </div>
            <select
              required
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:border-purple-600 focus:outline-hidden"
            >
              {filteredMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.first_name} {m.last_name} ({m.member_id}) {m.phone ? `— ${m.phone}` : ''}
                </option>
              ))}
            </select>
            {selectedMember && (
              <div className="p-2.5 bg-purple-50/70 border border-purple-100 rounded-lg flex items-center justify-between text-[11px] text-purple-900">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-purple-700" />
                  <span className="font-semibold">
                    {selectedMember.first_name} {selectedMember.last_name}
                  </span>
                  <span className="text-purple-600">({selectedMember.member_id})</span>
                </div>
                {selectedMember.phone && (
                  <div className="flex items-center gap-1 text-slate-600">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{selectedMember.phone}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Campaign Selection */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-800">
              Capital Project Campaign <span className="text-rose-500">*</span>
            </label>
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:border-purple-600 focus:outline-hidden"
            >
              {activeCampaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (Target: {formatGHS(c.target_amount)})
                </option>
              ))}
              <option value="custom">+ Custom / New Special Project</option>
            </select>

            {campaignId === 'custom' && (
              <div className="pt-1.5">
                <input
                  type="text"
                  required
                  value={customCampaignName}
                  onChange={(e) => setCustomCampaignName(e.target.value)}
                  placeholder="Enter custom project name (e.g. Choir Robes & Sound Board)"
                  className="w-full px-3 py-2 bg-white border border-purple-300 rounded-lg text-xs font-semibold text-purple-950 focus:border-purple-600 focus:outline-hidden"
                />
              </div>
            )}
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-800">
                Pledged Amount (GH₵) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold font-mono">
                  GH₵
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={amountPledged}
                  onChange={(e) => setAmountPledged(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-13 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-900 focus:border-purple-600 focus:outline-hidden"
                />
              </div>
              {numericPledged > 0 && (
                <p className="text-[10px] text-purple-800 italic leading-tight">
                  {numberToCedisWords(numericPledged)}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-800">
                Target Due Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:border-purple-600 focus:outline-hidden font-mono"
                />
              </div>
            </div>
          </div>

          {/* Start Date & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-800">Commitment Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:border-purple-600 focus:outline-hidden font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-800">Sacrificial Arrangement / Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. GH₵ 500 monthly installment until December"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:border-purple-600 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Optional: Immediate Initial Deposit */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasInitialDeposit"
                  checked={hasInitialDeposit}
                  onChange={(e) => setHasInitialDeposit(e.target.checked)}
                  className="w-4 h-4 text-purple-700 rounded border-slate-300 focus:ring-purple-500"
                />
                <label htmlFor="hasInitialDeposit" className="font-semibold text-slate-800 cursor-pointer">
                  Member is making an initial payment right now
                </label>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Optional
              </span>
            </div>

            {hasInitialDeposit && (
              <div className="mt-3 p-3.5 bg-purple-50/50 rounded-xl border border-purple-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-purple-950 mb-1">
                      Initial Deposit Amount (GH₵)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      max={numericPledged > 0 ? numericPledged : undefined}
                      value={initialAmount}
                      onChange={(e) => setInitialAmount(e.target.value)}
                      placeholder="e.g. 500.00"
                      className="w-full px-3 py-1.5 bg-white border border-purple-300 rounded-lg text-xs font-mono font-bold text-purple-900 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-purple-950 mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => {
                        const m = e.target.value as PaymentMethod;
                        setPaymentMethod(m);
                        if (m === 'mobile_money') setPaymentChannel('MTN MoMo');
                        else if (m === 'cash') setPaymentChannel('Cash at Counter');
                        else if (m === 'bank_transfer') setPaymentChannel('GCB Bank Deposit');
                        else setPaymentChannel('Cheque');
                      }}
                      className="w-full px-3 py-1.5 bg-white border border-purple-300 rounded-lg text-xs text-slate-900"
                    >
                      <option value="mobile_money">Mobile Money (MoMo)</option>
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank Transfer / Deposit</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-purple-950 mb-1">Channel / Telco</label>
                    <input
                      type="text"
                      value={paymentChannel}
                      onChange={(e) => setPaymentChannel(e.target.value)}
                      placeholder="e.g. MTN MoMo, Telecel Cash"
                      className="w-full px-3 py-1.5 bg-white border border-purple-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-purple-950 mb-1">Tx Reference / MoMo ID</label>
                    <input
                      type="text"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      placeholder="e.g. MM-4820129"
                      className="w-full px-3 py-1.5 bg-white border border-purple-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 text-[11px] text-purple-900">
                  <input
                    type="checkbox"
                    id="syncWithGiving"
                    checked={syncWithGiving}
                    onChange={(e) => setSyncWithGiving(e.target.checked)}
                    className="w-3.5 h-3.5 text-purple-700 rounded border-purple-300"
                  />
                  <label htmlFor="syncWithGiving" className="cursor-pointer">
                    Automatically record this deposit in the Church Giving & Offerings ledger
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
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
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm & Register Pledge</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
