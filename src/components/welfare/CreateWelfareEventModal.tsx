import { MIN_WELFARE_APPEAL_LEVY } from '../../features/welfare/welfareAppealPolicy';
import React, { useState, useEffect } from 'react';
import {
  X,
  HeartHandshake,
  Calendar,
  DollarSign,
  User,
  Users,
  AlertCircle,
  FileText,
  Lock,
  Tag,
  Check,
} from 'lucide-react';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  WelfareEvent,
  WelfareEventCategory,
  WelfareEventStatus,
} from '../../types/database.types';

interface CreateWelfareEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventToEdit?: WelfareEvent | null;
}

const CATEGORY_OPTIONS: Array<{
  value: WelfareEventCategory;
  label: string;
  description: string;
  badgeColor: string;
}> = [
  {
    value: 'death_member',
    label: 'Death of a Member',
    description: 'Bereavement solidarity for a departed church member and their nuclear family',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
  },
  {
    value: 'death_parent',
    label: 'Death of Parent / Parents',
    description: 'Bereavement solidarity for a member who has lost a mother or father',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
  {
    value: 'death_spouse',
    label: 'Death of a Spouse',
    description: 'Bereavement support for a widowed brother or sister in the congregation',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  {
    value: 'sickness_hospitalization',
    label: 'Sickness or Hospitalisation',
    description: 'Medical support for specialized surgery, prolonged admission, or emergency treatment',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  {
    value: 'emergency_assistance',
    label: 'Emergency Assistance',
    description: 'Urgent compassionate relief for accidental fire, flooding, or crisis displacement',
    badgeColor: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  {
    value: 'other',
    label: 'Other Welfare Needs (Custom)',
    description: 'Any other compassionate relief drive authorized by pastoral leadership',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
  },
];

export const CreateWelfareEventModal: React.FC<CreateWelfareEventModalProps> = ({
  isOpen,
  onClose,
  eventToEdit,
}) => {
  const { members, createWelfareEvent, updateWelfareEvent } = useChurchData();
  const { currentUser } = useAuth();
  const { success, error: toastError } = useToast();

  const activeMembers = members.filter((m) => !m.is_archived);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<WelfareEventCategory>('death_member');
  const [categoryCustom, setCategoryCustom] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [customMemberName, setCustomMemberName] = useState('');
  const [isManualMemberName, setIsManualMemberName] = useState(false);
  const [beneficiaryFamilyName, setBeneficiaryFamilyName] = useState('');
  const [description, setDescription] = useState('');
  const [pastoralNotes, setPastoralNotes] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [minimumContribution, setMinimumContribution] = useState(MIN_WELFARE_APPEAL_LEVY.toFixed(2));
  const [status, setStatus] = useState<WelfareEventStatus>('open');

  // Member search input
  const [memberSearchTerm, setMemberSearchTerm] = useState('');

  // Initialise / reset form
  useEffect(() => {
    if (!isOpen) return;

    const today = new Date().toISOString().split('T')[0];
    const defaultEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (eventToEdit) {
      setTitle(eventToEdit.title);
      setCategory(eventToEdit.category);
      setCategoryCustom(eventToEdit.category_custom || '');
      setSelectedMemberId(eventToEdit.member_id || '');
      setCustomMemberName(eventToEdit.member_name || '');
      setBeneficiaryFamilyName(eventToEdit.beneficiary_family_name || '');
      setDescription(eventToEdit.description);
      setPastoralNotes(eventToEdit.pastoral_notes || '');
      setStartDate(eventToEdit.start_date);
      setEndDate(eventToEdit.end_date);
      setTargetAmount(eventToEdit.target_amount ? String(eventToEdit.target_amount) : '');
      setMinimumContribution(String(eventToEdit.minimum_contribution || MIN_WELFARE_APPEAL_LEVY));
      setStatus(eventToEdit.status);

      const memMatch = members.find((m) => m.id === eventToEdit.member_id);
      setIsManualMemberName(!memMatch && Boolean(eventToEdit.member_name));
      setMemberSearchTerm(memMatch ? `${memMatch.first_name} ${memMatch.last_name}` : eventToEdit.member_name);
    } else {
      setTitle('');
      setCategory('death_member');
      setCategoryCustom('');
      setSelectedMemberId(activeMembers[0]?.id || '');
      setCustomMemberName('');
      setIsManualMemberName(false);
      setBeneficiaryFamilyName('');
      setDescription('');
      setPastoralNotes('');
      setStartDate(today);
      setEndDate(defaultEnd);
      setTargetAmount('');
      setMinimumContribution(MIN_WELFARE_APPEAL_LEVY.toFixed(2));
      setStatus('open');
      setMemberSearchTerm('');
    }
  }, [isOpen, eventToEdit, members]);

  // Auto-generate suggested title & description when category or member changes (new event only)
  const handleAutoSuggestDetails = () => {
    const mem = members.find((m) => m.id === selectedMemberId);
    const memName = isManualMemberName ? customMemberName.trim() : mem ? `${mem.first_name} ${mem.last_name}` : 'Church Member';

    let suggestedTitle = '';
    let suggestedDesc = '';
    let suggestedBeneficiary = '';

    switch (category) {
      case 'death_member':
        suggestedTitle = `Late ${memName} - Funeral Benevolence Fund`;
        suggestedBeneficiary = `The ${memName.split(' ').pop()} Family & Surviving Relatives`;
        suggestedDesc = `GWCC church appeal to stand in financial fellowship and compassionate support with the nuclear family of our dearly departed ${memName}. All congregational contributions will assist with burial logistics and family upkeep.`;
        break;
      case 'death_parent':
        suggestedTitle = `Bereavement Solidarity: Demise of Parent of ${memName}`;
        suggestedBeneficiary = `${memName} & Siblings`;
        suggestedDesc = `Congregational condolence appeal to comfort our member ${memName} and family following the home-call of their beloved parent. Let us support them in love and benevolence.`;
        break;
      case 'death_spouse':
        suggestedTitle = `Condolence & Bereavement Appeal: Late Spouse of ${memName}`;
        suggestedBeneficiary = `${memName} & Children`;
        suggestedDesc = `GWCC compassionate fellowship appeal to minister love, financial comfort, and prayerful solidarity to ${memName} and their household after the loss of their beloved spouse.`;
        break;
      case 'sickness_hospitalization':
        suggestedTitle = `Emergency Medical Aid Appeal: ${memName}`;
        suggestedBeneficiary = `${memName} Hospital Medical Account`;
        suggestedDesc = `Compassionate fund mobilised to assist ${memName} with specialized surgical procedures, in-patient hospital care, and critical prescription medication.`;
        break;
      case 'emergency_assistance':
        suggestedTitle = `Emergency Disaster Relief Appeal: ${memName}`;
        suggestedBeneficiary = `The ${memName.split(' ').pop()} Household`;
        suggestedDesc = `Urgent compassionate assistance drive to help ${memName} recover from an unforeseen emergency and crisis situation.`;
        break;
      case 'other':
        suggestedTitle = `${categoryCustom.trim() || 'Welfare Support'}: ${memName}`;
        suggestedBeneficiary = `${memName}`;
        suggestedDesc = `Welfare and benevolence support drive initiated for ${memName}.`;
        break;
    }

    if (!title) setTitle(suggestedTitle);
    if (!description) setDescription(suggestedDesc);
    if (!beneficiaryFamilyName) setBeneficiaryFamilyName(suggestedBeneficiary);
  };

  if (!isOpen) return null;

  const filteredMembers = activeMembers.filter((m) => {
    const q = memberSearchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
      (m.tithe_number && m.tithe_number.toLowerCase().includes(q)) ||
      (m.phone && m.phone.includes(q))
    );
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      toastError('Validation Error', 'Please enter an event title.');
      return;
    }

    let resolvedMemberId = selectedMemberId;
    let resolvedMemberName = '';

    if (isManualMemberName) {
      resolvedMemberName = customMemberName.trim();
      if (!resolvedMemberName) {
        toastError('Validation Error', 'Please provide the name of the affected member.');
        return;
      }
      resolvedMemberId = `ext-mem-${Date.now()}`;
    } else {
      const selectedMem = members.find((m) => m.id === selectedMemberId);
      if (!selectedMem) {
        toastError('Validation Error', 'Please select an affected church member.');
        return;
      }
      resolvedMemberName = `${selectedMem.first_name} ${selectedMem.last_name}`;
    }

    if (category === 'other' && !categoryCustom.trim()) {
      toastError('Validation Error', 'Please specify the custom category description.');
      return;
    }

    if (!description.trim()) {
      toastError('Validation Error', 'Please enter a description suitable for sharing with members.');
      return;
    }

    if (!startDate || !endDate) {
      toastError('Validation Error', 'Please specify both opening date and contribution deadline.');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      toastError('Validation Error', 'Contribution deadline cannot be before the opening date.');
      return;
    }

    const minContribNum = Number(minimumContribution);
    if (!Number.isFinite(minContribNum) || minContribNum < MIN_WELFARE_APPEAL_LEVY) {
      toastError(
        'Validation Error',
        `Minimum contribution cannot be less than GH₵ ${MIN_WELFARE_APPEAL_LEVY.toFixed(2)} per church welfare policy.`
      );
      return;
    }

    const numTarget = targetAmount.trim() ? parseFloat(targetAmount) : undefined;
    if (numTarget !== undefined && (isNaN(numTarget) || numTarget <= 0)) {
      toastError('Validation Error', 'Fundraising target must be a positive number if provided.');
      return;
    }

    const creatorName = currentUser
      ? `${currentUser.first_name} ${currentUser.last_name}`.trim()
      : 'Church Administrator';

    if (eventToEdit) {
      updateWelfareEvent(eventToEdit.id, {
        title: cleanTitle,
        category,
        category_custom: category === 'other' ? categoryCustom.trim() : undefined,
        member_id: resolvedMemberId,
        member_name: resolvedMemberName,
        beneficiary_family_name: beneficiaryFamilyName.trim() || undefined,
        description: description.trim(),
        pastoral_notes: pastoralNotes.trim() || undefined,
        start_date: startDate,
        end_date: endDate,
        target_amount: numTarget,
        minimum_contribution: minContribNum,
        status,
      });

      success('Welfare Event Updated', `Updated "${cleanTitle}" successfully.`);
    } else {
      createWelfareEvent({
        title: cleanTitle,
        category,
        category_custom: category === 'other' ? categoryCustom.trim() : undefined,
        member_id: resolvedMemberId,
        member_name: resolvedMemberName,
        beneficiary_family_name: beneficiaryFamilyName.trim() || undefined,
        description: description.trim(),
        pastoral_notes: pastoralNotes.trim() || undefined,
        start_date: startDate,
        end_date: endDate,
        target_amount: numTarget,
        minimum_contribution: minContribNum,
        status,
        created_by: creatorName,
      });

      success('Welfare Event Created', `Created "${cleanTitle}" with GH¢ ${minContribNum.toFixed(2)} minimum contribution.`);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-emerald-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-800/80 rounded-xl">
              <HeartHandshake className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">
                {eventToEdit ? 'Edit Welfare Event Appeal' : 'Create Welfare Event Appeal'}
              </h3>
              <p className="text-xs text-emerald-200/80">
                Mobilise congregational solidarity & compassionate benevolence
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800/80 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {/* Minimum Contribution Notice Banner */}
          <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                Standard Minimum Contribution: <strong className="font-bold">GH₵ {MIN_WELFARE_APPEAL_LEVY.toFixed(2)}</strong> per contributor
              </span>
            </div>
            <span className="px-2 py-0.5 bg-emerald-200 text-emerald-950 font-black rounded-md text-[11px]">
              Mandatory Minimum
            </span>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Event Category <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CATEGORY_OPTIONS.map((cat) => (
                <button
                  type="button"
                  key={cat.value}
                  onClick={() => {
                    setCategory(cat.value);
                  }}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    category === cat.value
                      ? 'border-emerald-700 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-600'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">{cat.label}</span>
                    {category === cat.value && (
                      <span className="w-2 h-2 rounded-full bg-emerald-700"></span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 line-clamp-2">{cat.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom category description when "other" is selected */}
          {category === 'other' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Custom Category Description <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={categoryCustom}
                onChange={(e) => setCategoryCustom(e.target.value)}
                placeholder="e.g. Orphan Academic Trust, Fire Relief, Child Special Care"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-hidden"
                required
              />
            </div>
          )}

          {/* Affected Church Member */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4 text-emerald-800" />
                Affected Church Member <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsManualMemberName(!isManualMemberName)}
                className="text-xs text-emerald-800 hover:underline font-semibold"
              >
                {isManualMemberName ? 'Select from membership register' : '+ Type non-registered name'}
              </button>
            </div>

            {isManualMemberName ? (
              <input
                type="text"
                value={customMemberName}
                onChange={(e) => setCustomMemberName(e.target.value)}
                placeholder="Enter member's full name"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-700 focus:outline-hidden"
                required
              />
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={memberSearchTerm}
                  onChange={(e) => setMemberSearchTerm(e.target.value)}
                  placeholder="Filter member by name, tithe #, or phone..."
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-700"
                />
                <select
                  value={selectedMemberId}
                  onChange={(e) => {
                    setSelectedMemberId(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-700 focus:outline-hidden font-medium"
                  required
                >
                  <option value="" disabled>-- Select church member --</option>
                  {filteredMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name} {m.tithe_number ? `(${m.tithe_number})` : ''} - {m.status || 'Member'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Beneficiary / Receiving Family */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  Beneficiary or Receiving Family
                </span>
                <span className="text-[11px] text-slate-600 font-normal">
                  {category === 'death_member' ? '(Recommended for bereavement)' : '(Optional)'}
                </span>
              </label>
              <input
                type="text"
                value={beneficiaryFamilyName}
                onChange={(e) => setBeneficiaryFamilyName(e.target.value)}
                placeholder={
                  category === 'death_member'
                    ? 'e.g. The Ofori Nuclear Family & Surviving Children'
                    : 'e.g. Surviving spouse and children, Family trust'
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-700 focus:outline-hidden"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAutoSuggestDetails}
                className="text-xs text-emerald-800 hover:text-emerald-950 font-bold underline"
              >
                ✨ Auto-suggest Title & Public Description
              </button>
            </div>
          </div>

          {/* Event Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Event Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Late Deacon Solomon Ofori - Funeral Benevolence Fund"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-hidden font-semibold text-slate-900"
              required
            />
          </div>

          {/* Description suitable for sharing with members */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                Public Description (Shared with Members) <span className="text-rose-500">*</span>
              </span>
              <span className="text-[11px] text-emerald-700 font-medium">Visible on Member Portal</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide a clear, respectful summary for the congregation detailing the need, burial plans, or recovery aid..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-hidden"
              required
            />
          </div>

          {/* Confidential Pastoral Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-amber-900">
                <Lock className="w-3.5 h-3.5 text-amber-700" />
                Confidential Pastoral / Welfare Notes
              </span>
              <span className="text-[11px] text-amber-800 font-semibold bg-amber-100 px-2 py-0.5 rounded-sm">
                Staff Only · Never Shared With Members
              </span>
            </label>
            <textarea
              rows={2}
              value={pastoralNotes}
              onChange={(e) => setPastoralNotes(e.target.value)}
              placeholder="Internal welfare committee decisions, statutory grant voucher references, pastoral visitation details..."
              className="w-full px-3 py-2 text-xs border border-amber-200 rounded-xl bg-amber-50/40 focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-slate-800"
            />
          </div>

          {/* Dates & Financials Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Opening Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Opening Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-hidden"
                required
              />
            </div>

            {/* Contribution Deadline */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Contribution Deadline <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-hidden"
                required
              />
            </div>

            {/* Optional Fundraising Target */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                  Fundraising Target (GHS)
                </span>
                <span className="text-[11px] text-slate-600 font-normal">Optional</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">GH₵</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="e.g. 5000.00"
                  className="w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Minimum Contribution */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-700" />
                  Minimum Contribution (GHS) <span className="text-rose-500">*</span>
                </span>
                <span className="text-[11px] text-emerald-800 font-bold">Min GH₵ {MIN_WELFARE_APPEAL_LEVY.toFixed(2)}</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-emerald-700">GH₵</span>
                <input
                  type="number"
                  step="0.01"
                  min={MIN_WELFARE_APPEAL_LEVY}
                  aria-label="Minimum appeal levy (GHS)"
                  value={minimumContribution}
                  onChange={(e) => setMinimumContribution(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-sm font-bold text-slate-900 border border-emerald-300 bg-emerald-50/30 rounded-xl focus:ring-2 focus:ring-emerald-700 focus:outline-hidden"
                  required
                />
              </div>
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Event Status
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['draft', 'open', 'closed', 'cancelled'] as WelfareEventStatus[]).map((st) => (
                <button
                  type="button"
                  key={st}
                  onClick={() => setStatus(st)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold uppercase transition text-center ${
                    status === st
                      ? st === 'open'
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                        : st === 'closed'
                        ? 'bg-slate-800 text-white border-slate-800'
                        : st === 'cancelled'
                        ? 'bg-rose-700 text-white border-rose-700'
                        : 'bg-amber-600 text-white border-amber-600'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5"
            >
              <HeartHandshake className="w-4 h-4" />
              {eventToEdit ? 'Save Changes' : 'Create & Publish Appeal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
