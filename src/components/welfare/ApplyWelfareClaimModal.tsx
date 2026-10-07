import React, { useState } from 'react';
import { X, HeartHandshake, Check, AlertCircle, FileText, User } from 'lucide-react';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { useToast } from '../../contexts/ToastContext';
import { WelfareClaimCategory } from '../../types/database.types';

interface ApplyWelfareClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedMemberId?: string;
}

export const ApplyWelfareClaimModal: React.FC<ApplyWelfareClaimModalProps> = ({
  isOpen,
  onClose,
  preselectedMemberId,
}) => {
  const { members, submitWelfareClaim, settings } = useChurchData();
  const { success, error: toastError } = useToast();

  const activeMembers = members.filter((m) => !m.is_archived);
  const defaultMember = preselectedMemberId
    ? activeMembers.find((m) => m.id === preselectedMemberId)
    : activeMembers[0];

  const [memberId, setMemberId] = useState(defaultMember?.id || '');
  const [category, setCategory] = useState<WelfareClaimCategory>('bereavement');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amountRequested, setAmountRequested] = useState('');
  const [emergencyLevel, setEmergencyLevel] = useState<'normal' | 'urgent' | 'critical'>('normal');
  const [supportingDocs, setSupportingDocs] = useState('');

  if (!isOpen) return null;

  const categoryPresets: Record<WelfareClaimCategory, { defaultTitle: string; suggestedAmount: string; hint: string }> = {
    bereavement: {
      defaultTitle: 'Bereavement Assistance - Family Loss',
      suggestedAmount: '2000.00',
      hint: 'Standard GWCC Category A bereavement benefit for loss of nuclear family member.',
    },
    hospital_medical: {
      defaultTitle: 'Hospitalization & Emergency Medical Aid',
      suggestedAmount: '1200.00',
      hint: 'Medical treatment relief, prescription medication, or surgical copay.',
    },
    childbirth_naming: {
      defaultTitle: 'Maternity Benevolence & Baby Blessing',
      suggestedAmount: '500.00',
      hint: 'Celebratory benevolent gift from GWCC for new birth and naming ceremony.',
    },
    wedding_marriage: {
      defaultTitle: 'Holy Matrimony Nuptial Benevolence',
      suggestedAmount: '800.00',
      hint: 'Church wedding blessing gift for members in good financial standing.',
    },
    education_welfare: {
      defaultTitle: 'Educational Subsidy & School Supplies Support',
      suggestedAmount: '600.00',
      hint: 'Term school fees or educational hardship subsidy for church youths.',
    },
    emergency_relief: {
      defaultTitle: 'Emergency Disaster / Fire / Accommodation Relief',
      suggestedAmount: '1000.00',
      hint: 'Disaster, sudden displacement, or unforeseen crisis assistance.',
    },
  };

  const handleCategoryChange = (newCat: WelfareClaimCategory) => {
    setCategory(newCat);
    if (!title || Object.values(categoryPresets).some((p) => p.defaultTitle === title)) {
      setTitle(categoryPresets[newCat].defaultTitle);
    }
    if (!amountRequested || Object.values(categoryPresets).some((p) => p.suggestedAmount === amountRequested)) {
      setAmountRequested(categoryPresets[newCat].suggestedAmount);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mem = members.find((m) => m.id === memberId);
    if (!mem) {
      toastError('Validation Error', 'Please select a church member');
      return;
    }

    const numAmount = parseFloat(amountRequested);
    if (isNaN(numAmount) || numAmount <= 0) {
      toastError('Validation Error', 'Please provide a valid requested amount');
      return;
    }

    if (!title.trim() || !description.trim()) {
      toastError('Validation Error', 'Please complete the title and description');
      return;
    }

    submitWelfareClaim({
      member_id: mem.id,
      member_name: `${mem.first_name} ${mem.last_name}`,
      member_phone: mem.phone,
      category,
      title: title.trim(),
      description: description.trim(),
      amount_requested: numAmount,
      status: 'pending',
      emergency_level: emergencyLevel,
      date_submitted: new Date().toISOString().split('T')[0],
      supporting_documents: supportingDocs.trim() || undefined,
    });

    success(
      'Benevolence Claim Submitted',
      `Application logged for ${mem.first_name} ${mem.last_name} (GH₵ ${numAmount.toFixed(2)})`
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 rounded-xl">
              <HeartHandshake className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Apply for Benevolence Aid</h2>
              <p className="text-xs text-slate-400">Greater Works City Church Welfare Board</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Member Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Applicant Member <span className="text-rose-500">*</span>
            </label>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              required
              className="w-full text-sm rounded-xl border border-slate-300 py-2.5 px-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
            >
              <option value="">-- Choose Member --</option>
              {activeMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.first_name} {m.last_name} {m.tithe_number ? `(${m.tithe_number})` : ''} — {m.phone}
                </option>
              ))}
            </select>
          </div>

          {/* Category & Urgency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Assistance Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as WelfareClaimCategory)}
                className="w-full text-sm rounded-xl border border-slate-300 py-2.5 px-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
              >
                <option value="bereavement">Bereavement & Funeral Aid</option>
                <option value="hospital_medical">Medical & Hospital Treatment</option>
                <option value="childbirth_naming">Childbirth & Naming Blessing</option>
                <option value="wedding_marriage">Holy Matrimony Support</option>
                <option value="education_welfare">Educational Subsidy / Fees</option>
                <option value="emergency_relief">Emergency Disaster Relief</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Urgency Level
              </label>
              <select
                value={emergencyLevel}
                onChange={(e) => setEmergencyLevel(e.target.value as any)}
                className="w-full text-sm rounded-xl border border-slate-300 py-2.5 px-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
              >
                <option value="normal">Normal (Next Welfare Meeting)</option>
                <option value="urgent">Urgent (Within 48 Hours)</option>
                <option value="critical">Critical Emergency (Immediate)</option>
              </select>
            </div>
          </div>

          {/* Policy Guideline Hint */}
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">GWCC Policy Benchmark:</span> {categoryPresets[category].hint}
            </div>
          </div>

          {/* Claim Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Claim Subject / Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Bereavement Assistance - Loss of Mother"
              required
              className="w-full text-sm rounded-xl border border-slate-300 py-2.5 px-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {/* Amount Requested */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Amount Requested ({settings.currency_symbol}) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">GH₵</span>
              <input
                type="number"
                step="0.01"
                min="1"
                value={amountRequested}
                onChange={(e) => setAmountRequested(e.target.value)}
                required
                className="w-full text-sm rounded-xl border border-slate-300 py-2.5 pl-12 pr-3 bg-white text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Description & Circumstances */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Circumstances & Detailed Justification <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide background context (e.g. hospital facility, date of occurrence, specific medical or funeral logistics needed)..."
              required
              className="w-full text-sm rounded-xl border border-slate-300 p-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {/* Supporting Documents / Evidence Reference */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Supporting Verification / Documents
            </label>
            <input
              type="text"
              value={supportingDocs}
              onChange={(e) => setSupportingDocs(e.target.value)}
              placeholder="e.g. Hospital admission card, Mortuary receipt, Funeral announcement poster"
              className="w-full text-sm rounded-xl border border-slate-300 py-2.5 px-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-xs"
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
              className="px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition shadow-sm flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Submit Application
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
