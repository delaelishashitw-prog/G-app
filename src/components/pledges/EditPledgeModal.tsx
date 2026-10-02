import React, { useState, useEffect } from 'react';
import { X, Coins, CheckCircle2, Trash2, Calendar, FileText } from 'lucide-react';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { PledgeRecord } from '../../types/database.types';
import { formatGHS, numberToCedisWords } from '../../lib/currencyUtils';

interface EditPledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  pledge: PledgeRecord | null;
}

export const EditPledgeModal: React.FC<EditPledgeModalProps> = ({
  isOpen,
  onClose,
  pledge,
}) => {
  const { campaigns, updatePledge, deletePledge } = useChurchData();

  const [campaignName, setCampaignName] = useState('');
  const [amountPledged, setAmountPledged] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (pledge) {
      setCampaignName(pledge.campaign_name);
      setAmountPledged(pledge.amount_pledged.toString());
      setDueDate(pledge.due_date || '');
      setNotes(pledge.notes || '');
    }
  }, [pledge, isOpen]);

  if (!isOpen || !pledge) return null;

  const numericPledged = parseFloat(amountPledged) || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numericPledged <= 0) return;

    updatePledge(pledge.id, {
      campaign_name: campaignName.trim(),
      amount_pledged: numericPledged,
      due_date: dueDate,
      notes: notes.trim() || undefined,
    });

    onClose();
  };

  const handleDelete = () => {
    if (
      window.confirm(
        `Are you sure you want to delete the pledge commitment for ${pledge.member_name}?`
      )
    ) {
      deletePledge(pledge.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Coins className="w-5 h-5 text-amber-300" />
            <div>
              <h3 className="text-base font-bold">Edit Pledge Commitment</h3>
              <p className="text-xs text-purple-200">{pledge.member_name}</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Member Banner */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase">Member</span>
              <div className="font-bold text-slate-900">{pledge.member_name}</div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Already Paid</span>
              <div className="font-mono font-bold text-emerald-700">{formatGHS(pledge.amount_paid)}</div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1">Campaign Project</label>
            <input
              type="text"
              required
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:border-purple-600 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              Pledged Amount (GH₵) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold font-mono">
                GH₵
              </div>
              <input
                type="number"
                step="0.01"
                min={pledge.amount_paid} // cannot pledge less than already paid
                required
                value={amountPledged}
                onChange={(e) => setAmountPledged(e.target.value)}
                className="w-full pl-13 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold text-purple-950 focus:border-purple-600 focus:outline-hidden"
              />
            </div>
            {numericPledged > 0 && (
              <p className="text-[10px] text-purple-800 italic mt-1">
                {numberToCedisWords(numericPledged)}
              </p>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1">Target Due Date</label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:border-purple-600 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1">Commitment Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:border-purple-600 focus:outline-hidden"
            />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={handleDelete}
              className="px-3 py-2 text-rose-700 hover:bg-rose-50 rounded-xl font-semibold flex items-center gap-1 transition"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>

            <div className="flex items-center gap-2">
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
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
