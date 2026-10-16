import { getSupabaseClient } from '../../lib/supabase';
import React, { useState, useEffect } from 'react';
import { X, HeartHandshake, Check, AlertCircle, FileText, User, Users, Globe, Phone, MapPin } from 'lucide-react';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { WelfareClaimCategory, BeneficiaryType } from '../../types/database.types';
import { assessWelfareStanding } from '../../features/welfare/welfareEligibility';
import { WelfareStandingNotice } from './WelfareStandingNotice';

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
  const { members, welfareContributions, submitWelfareClaim, settings, refreshData } = useChurchData();
  const { currentUser,currentMember } = useAuth();
  const [busy,setBusy]=useState(false);
  const { success, error: toastError } = useToast();

  const activeMembers = members.filter((m) => !m.is_archived);
  const defaultMember = preselectedMemberId
    ? activeMembers.find((m) => m.id === preselectedMemberId)
    : activeMembers[0];

  const [beneficiaryType, setBeneficiaryType] = useState<BeneficiaryType>('member');
  const [memberId, setMemberId] = useState(defaultMember?.id || '');
  const [externalName, setExternalName] = useState('');
  const [externalPhone, setExternalPhone] = useState('');
  const [externalCommunity, setExternalCommunity] = useState('');
  const [category, setCategory] = useState<WelfareClaimCategory>('bereavement');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amountRequested, setAmountRequested] = useState('');
  const [emergencyLevel, setEmergencyLevel] = useState<'normal' | 'urgent' | 'critical'>('normal');
  const [supportingDocs, setSupportingDocs] = useState('');
  const [confidentialNotes, setConfidentialNotes] = useState('');

  const defaultMemberId = defaultMember?.id || '';
  useEffect(() => {
    if (isOpen) setMemberId(preselectedMemberId || defaultMemberId);
  }, [isOpen, preselectedMemberId, defaultMemberId]);

  if (!isOpen) return null;

  const selectedMember = members.find(m => m.id === memberId);
  const standing = beneficiaryType === 'member' && selectedMember
    ? assessWelfareStanding(selectedMember, welfareContributions) : null;

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
    food_nutrition: {
      defaultTitle: 'Food Basket & Nutritional Sustenance Relief',
      suggestedAmount: '450.00',
      hint: 'Essential dry food staples, rice, oil, or nutritional package for households facing hardship.',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let beneficiaryId = '';
    let beneficiaryName = '';
    let beneficiaryPhone = '';

    if (beneficiaryType === 'member') {
      const mem = members.find((m) => m.id === memberId);
      if (!mem) {
        toastError('Validation Error', 'Please select a church member');
        return;
      }
      beneficiaryId = mem.id;
      beneficiaryName = `${mem.first_name} ${mem.last_name}`;
      beneficiaryPhone = mem.phone || '';
    } else {
      if (!externalName.trim()) {
        toastError('Validation Error', 'Please enter the beneficiary full name');
        return;
      }
      beneficiaryId = `ext-${Date.now()}`;
      beneficiaryName = externalName.trim();
      beneficiaryPhone = externalPhone.trim();
    }

    const numAmount = parseFloat(amountRequested);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      toastError('Validation Error', 'Please provide a valid requested amount greater than GH₵ 0.00');
      return;
    }

    if (!title.trim() || !description.trim()) {
      toastError('Validation Error', 'Please complete the title and description');
      return;
    }

    const request={
      beneficiary_type: beneficiaryType,
      member_id: beneficiaryId,
      member_name: beneficiaryName,
      member_phone: beneficiaryPhone || undefined,
      beneficiary_community: beneficiaryType === 'external_community' ? (externalCommunity.trim() || 'Local Community') : undefined,
      category,
      title: title.trim(),
      description: description.trim(),
      amount_requested: numAmount,
      status: 'pending',
      emergency_level: emergencyLevel,
      case_owner: currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Welfare Committee',
      confidential_pastoral_notes: confidentialNotes.trim() || undefined,
      date_submitted: new Date().toISOString().split('T')[0],
      supporting_documents: supportingDocs.trim() || undefined,
    };
    setBusy(true);
    try {
      if(currentUser.role==='member'){
        if(!currentMember || beneficiaryType!=='member' || beneficiaryId!==currentMember.id)throw new Error('Member applications must be for your own account.');
        const client=getSupabaseClient();if(!client)throw new Error('Secure sign-in is unavailable.');
        const {error}=await client.rpc('gwcc_member_action',{p_action:'welfare',p_id:currentMember.id,p_data:request});
        if(error)throw error;
        await refreshData();
      }else {submitWelfareClaim(request as any);}


    success(
      'Benevolence Case Submitted',
      `Application logged for ${beneficiaryName} (GH₵ ${numAmount.toFixed(2)})`
    );
    onClose();
    }catch(error){toastError('Application not saved',(error as Error).message);}finally{setBusy(false);}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div role="dialog" aria-modal="true" aria-label="Apply for Benevolence Aid" className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
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
            aria-label="Close welfare application"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Beneficiary Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Beneficiary Type
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setBeneficiaryType('member')}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  beneficiaryType === 'member'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                Church Member
              </button>
              <button
                type="button"
                onClick={() => setBeneficiaryType('external_community')}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  beneficiaryType === 'external_community'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                External / Community
              </button>
            </div>
          </div>

          {/* Member Selection OR External Inputs */}
          {beneficiaryType === 'member' ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Applicant Member <span className="text-rose-500">*</span>
              </label>
              <select
                aria-label="Applicant member"
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
          ) : (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <Globe className="w-4 h-4 text-emerald-600" />
                External Beneficiary Details
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Beneficiary Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={externalName}
                    onChange={(e) => setExternalName(e.target.value)}
                    placeholder="e.g. Ama Darkoa (Widow)"
                    required={beneficiaryType === 'external_community'}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 text-slate-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Contact Phone Number
                  </label>
                  <input
                    type="text"
                    value={externalPhone}
                    onChange={(e) => setExternalPhone(e.target.value)}
                    placeholder="e.g. +233 24 123 4567"
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 text-slate-900 bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Community / Locality / Suburb
                </label>
                <input
                  type="text"
                  value={externalCommunity}
                  onChange={(e) => setExternalCommunity(e.target.value)}
                  placeholder="e.g. Joma Village / Weija Junction"
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 text-slate-900 bg-white"
                />
              </div>
            </div>
          )}

          {standing && <WelfareStandingNotice standing={standing} />}

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
                <option value="food_nutrition">Food Basket & Nutritional Sustenance</option>
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

          {/* Confidential Pastoral Notes */}
          <div>
            <label className="block text-xs font-bold text-amber-800 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Confidential Pastoral & Case Notes</span>
              <span className="text-[10px] text-amber-600 font-normal lowercase">(restricted to pastors & administrators)</span>
            </label>
            <textarea
              rows={2}
              value={confidentialNotes}
              onChange={(e) => setConfidentialNotes(e.target.value)}
              placeholder="Discreet personal or family background details not disclosed in public reports..."
              className="w-full text-xs rounded-xl border border-amber-200 bg-amber-50/40 p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
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
              type="submit" disabled={busy}
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
