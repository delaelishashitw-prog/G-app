import React, { useState, useEffect } from 'react';
import { X, Building2, CheckCircle2, Trash2 } from 'lucide-react';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { PledgeCampaign } from '../../types/database.types';
import { formatGHS, numberToCedisWords } from '../../lib/currencyUtils';

interface CampaignManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignToEdit?: PledgeCampaign | null;
}

export const CampaignManagerModal: React.FC<CampaignManagerModalProps> = ({
  isOpen,
  onClose,
  campaignToEdit,
}) => {
  const { addCampaign, updateCampaign, deleteCampaign, pledges } = useChurchData();

  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-12-31');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (campaignToEdit) {
      setName(campaignToEdit.name);
      setTargetAmount(campaignToEdit.target_amount.toString());
      setStartDate(campaignToEdit.start_date);
      setEndDate(campaignToEdit.end_date);
      setDescription(campaignToEdit.description || '');
      setIsActive(campaignToEdit.is_active);
    } else {
      setName('');
      setTargetAmount('');
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate('2026-12-31');
      setDescription('');
      setIsActive(true);
    }
  }, [campaignToEdit, isOpen]);

  if (!isOpen) return null;

  const numericTarget = parseFloat(targetAmount) || 0;

  // If editing, compute existing pledges count
  const campaignPledges = campaignToEdit
    ? pledges.filter((p) => p.campaign_id === campaignToEdit.id || p.campaign_name === campaignToEdit.name)
    : [];
  const totalCommitted = campaignPledges.reduce((s, p) => s + p.amount_pledged, 0);
  const totalCollected = campaignPledges.reduce((s, p) => s + p.amount_paid, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || numericTarget <= 0) return;

    if (campaignToEdit) {
      updateCampaign(campaignToEdit.id, {
        name: name.trim(),
        target_amount: numericTarget,
        start_date: startDate,
        end_date: endDate,
        description: description.trim() || undefined,
        is_active: isActive,
      });
    } else {
      addCampaign({
        name: name.trim(),
        target_amount: numericTarget,
        start_date: startDate,
        end_date: endDate,
        description: description.trim() || undefined,
        is_active: isActive,
      });
    }

    onClose();
  };

  const handleDelete = () => {
    if (!campaignToEdit) return;
    if (
      window.confirm(
        `Are you sure you want to delete campaign "${campaignToEdit.name}"? Existing pledge records will remain preserved.`
      )
    ) {
      deleteCampaign(campaignToEdit.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-amber-300" />
            <div>
              <h3 className="text-base font-bold">
                {campaignToEdit ? 'Edit Capital Campaign' : 'Create New Capital Campaign'}
              </h3>
              <p className="text-xs text-purple-200">
                Church project covenants & developmental targets
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {campaignToEdit && (
            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-[10px] text-purple-900 font-semibold">Pledges Count</span>
                <div className="font-mono font-bold text-slate-800 text-sm">
                  {campaignPledges.length}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-purple-900 font-semibold">Committed</span>
                <div className="font-mono font-bold text-slate-800 text-sm">
                  {formatGHS(totalCommitted)}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-purple-900 font-semibold">Collected</span>
                <div className="font-mono font-bold text-emerald-700 text-sm">
                  {formatGHS(totalCollected)}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              Campaign Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 2026 Cathedral Sanctuary Expansion & Roofing"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:border-purple-600 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              Fundraising Target (GH₵) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold font-mono">
                GH₵
              </div>
              <input
                type="number"
                step="1"
                min="100"
                required
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="250000"
                className="w-full pl-13 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold text-purple-950 focus:border-purple-600 focus:outline-hidden"
              />
            </div>
            {numericTarget > 0 && (
              <p className="text-[10px] text-purple-800 italic mt-1">
                {numberToCedisWords(numericTarget)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:border-purple-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Target End Date</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:border-purple-600 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Campaign Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the kingdom objective, capacity improvements, or acquisition details..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:border-purple-600 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <div className="font-semibold text-slate-800">Campaign Active Status</div>
              <p className="text-[11px] text-slate-500">
                Active campaigns accept new commitments and are featured prominently
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-700" />
            </label>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            {campaignToEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-2 text-rose-700 hover:bg-rose-50 rounded-xl font-semibold flex items-center gap-1 transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            ) : (
              <div />
            )}

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
                <span>{campaignToEdit ? 'Save Changes' : 'Launch Campaign'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
