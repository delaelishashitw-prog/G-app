import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  User,
  Phone,
  Church,
  Briefcase,
  ShieldAlert,
  Calendar,
  CheckCircle2,
  MapPin,
  Sparkles,
  Info,
  Clock,
  Heart,
  Crown,
  BookOpen,
  Flame,
  Award,
  ChevronRight,
  ChevronLeft,
  IdCard,
  Compass,
  MessageCircle,
  ExternalLink,
} from 'lucide-react';
import { Member, GenderType, MembershipStatus } from '../../types/database.types';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { ProfilePhotoUpload } from '../ProfilePhotoUpload';

export interface AddEditMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (memberData: Partial<Member>) => void;
  editingMember?: Member | null;
}

const GHANA_REGIONS = [
  'Greater Accra',
  'Ashanti',
  'Eastern',
  'Central',
  'Western',
  'Western North',
  'Volta',
  'Oti',
  'Northern',
  'Savannah',
  'North East',
  'Upper East',
  'Upper West',
  'Bono',
  'Bono East',
  'Ahafo',
];

const SPIRITUAL_GIFTS_OPTIONS = [
  'Teaching & Preaching',
  'Prophecy & Discernment',
  'Pastoral Care & Shepherding',
  'Intercession & Prayer',
  'Evangelism & Soul Winning',
  'Praise & Worship / Music',
  'Administration & Organisation',
  'Giving & Philanthropy',
  'Hospitality & Ushering',
  'Helps & Welfare',
  'Healing & Faith',
];

const TALENTS_OPTIONS = [
  'Singing (Vocalist)',
  'Keyboard / Piano',
  'Drums / Percussion',
  'Bass / Lead Guitar',
  'Sound / Audio Engineering',
  'Livestream / Camera Operation',
  'Graphic Design & Media',
  'Photography & Video Editing',
  'Event Decor & Logistics',
  'Cooking & Catering',
  'Protocol & VIP Coordination',
  'Children Ministry & Puppetry',
  'Driving / Transportation',
  'Building & Maintenance / Electrician',
];

export const AddEditMemberModal: React.FC<AddEditMemberModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingMember,
}) => {
  const { ministries, smallGroups } = useChurchData();

  // Tab Navigation: 'personal' | 'contact' | 'church' | 'spiritual' | 'vocation'
  const [activeTab, setActiveTab] = useState<'personal' | 'contact' | 'church' | 'spiritual' | 'vocation'>('personal');

  // Form State with comprehensive fields
  const [formData, setFormData] = useState<Partial<Member>>({
    first_name: '',
    middle_name: '',
    last_name: '',
    gender: 'male',
    date_of_birth: '',
    marital_status: 'single',
    nationality: 'Ghanaian',
    national_id: '',
    hometown: '',
    region_of_origin: 'Greater Accra',
    spouse_name: '',
    spouse_is_member: false,
    wedding_anniversary: '',
    number_of_children: 0,
    phone: '+233 ',
    alternative_phone: '',
    preferred_communication: 'whatsapp',
    email: '',
    residential_address: '',
    landmark: '',
    city: 'Accra',
    region: 'Greater Accra',
    gps_address: 'GA-',
    profile_photo_url: '',

    // Church Life & Date Joined
    membership_date: new Date().toISOString().split('T')[0],
    date_joined: new Date().toISOString().split('T')[0],
    first_visit_date: '',
    status: 'active',
    tithe_number: '',
    ministry_id: '',
    small_group_id: '',
    leadership_position: '',
    right_hand_of_fellowship_date: '',
    previous_church: '',

    // Spiritual Milestones
    salvation_status: true,
    salvation_date: '',
    baptism_status: false,
    baptism_date: '',
    baptized_by: '',
    holy_spirit_baptism: false,
    holy_spirit_baptism_date: '',
    membership_class_completed: false,
    spiritual_gifts: '',
    talents_skills: '',

    // Vocation & Education
    occupation: '',
    employer: '',
    education: '',

    // Emergency & Pastoral Notes
    emergency_name: '',
    emergency_relationship: 'Spouse',
    emergency_phone: '',
    emergency_alt_phone: '',
    notes: '',
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (editingMember) {
      setFormData({
        ...editingMember,
        membership_date: editingMember.membership_date || editingMember.date_joined || new Date().toISOString().split('T')[0],
        date_joined: editingMember.date_joined || editingMember.membership_date || new Date().toISOString().split('T')[0],
      });
    } else {
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        first_name: '',
        middle_name: '',
        last_name: '',
        gender: 'male',
        date_of_birth: '',
        marital_status: 'single',
        nationality: 'Ghanaian',
        national_id: '',
        hometown: '',
        region_of_origin: 'Greater Accra',
        spouse_name: '',
        spouse_is_member: false,
        wedding_anniversary: '',
        number_of_children: 0,
        phone: '+233 ',
        alternative_phone: '',
        preferred_communication: 'whatsapp',
        email: '',
        residential_address: '',
        landmark: '',
        city: 'Accra',
        region: 'Greater Accra',
        gps_address: 'GA-',
        profile_photo_url: '',
        membership_date: today,
        date_joined: today,
        first_visit_date: '',
        status: 'active',
        tithe_number: '',
        ministry_id: ministries[0]?.id || '',
        small_group_id: smallGroups[0]?.id || '',
        leadership_position: '',
        right_hand_of_fellowship_date: '',
        previous_church: '',
        salvation_status: true,
        salvation_date: '',
        baptism_status: false,
        baptism_date: '',
        baptized_by: '',
        holy_spirit_baptism: false,
        holy_spirit_baptism_date: '',
        membership_class_completed: false,
        spiritual_gifts: '',
        talents_skills: '',
        occupation: '',
        employer: '',
        education: '',
        emergency_name: '',
        emergency_relationship: 'Spouse',
        emergency_phone: '',
        emergency_alt_phone: '',
        notes: '',
      });
    }
    setActiveTab('personal');
    setFormErrors({});
  }, [editingMember, isOpen, ministries, smallGroups]);

  // Calculate age & demographic bracket helper
  const calculateAge = (dobString?: string): { age: number | null; bracket: string | null } => {
    if (!dobString) return { age: null, bracket: null };
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return { age: null, bracket: null };
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    let bracket = 'Adult';
    if (age <= 12) bracket = 'Children Ministry (0-12)';
    else if (age <= 19) bracket = 'Youth & Teens (13-19)';
    else if (age <= 35) bracket = 'Young Adults (20-35)';
    else if (age <= 59) bracket = 'Adult Fellowship (36-59)';
    else bracket = 'Senior Citizens / Elders (60+)';

    return { age, bracket };
  };

  const { age: calculatedAge, bracket: ageBracket } = calculateAge(formData.date_of_birth);

  // Tenure calculation from date joined (must be called unconditionally before any early return)
  const tenureText = useMemo(() => {
    const joined = formData.membership_date || formData.date_joined;
    if (!joined) return null;
    const joinDate = new Date(joined);
    if (isNaN(joinDate.getTime())) return null;
    const now = new Date();
    const months = (now.getFullYear() - joinDate.getFullYear()) * 12 + (now.getMonth() - joinDate.getMonth());
    if (months < 1) return 'New Member (< 1 month)';
    if (months < 12) return `${months} month${months > 1 ? 's' : ''} in fellowship`;
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    return `${years} yr${years > 1 ? 's' : ''}${remMonths > 0 ? ` ${remMonths} mo` : ''} in fellowship`;
  }, [formData.membership_date, formData.date_joined]);

  if (!isOpen) return null;

  // Validation
  const validate = (): boolean => {
    const errors: { [key: string]: string } = {};
    if (!formData.first_name?.trim()) errors.first_name = 'First name is required.';
    if (!formData.last_name?.trim()) errors.last_name = 'Last name / surname is required.';
    if (!formData.phone?.trim() || formData.phone.trim() === '+233') {
      errors.phone = 'Valid phone number is required (+233...).';
    }
    const dateJoined = formData.membership_date || formData.date_joined;
    if (!dateJoined?.trim()) {
      errors.membership_date = 'Date joined church is required.';
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      if (errors.first_name || errors.last_name) {
        setActiveTab('personal');
      } else if (errors.phone) {
        setActiveTab('contact');
      } else if (errors.membership_date) {
        setActiveTab('church');
      }
      return false;
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const cleanOptionalDate = (val?: string) => {
      if (!val || typeof val !== 'string') return undefined;
      const trimmed = val.trim();
      return trimmed === '' ? undefined : trimmed;
    };

    // Harmonize date joined
    const finalJoined = cleanOptionalDate(formData.membership_date) || cleanOptionalDate(formData.date_joined) || new Date().toISOString().split('T')[0];
    const payload: Partial<Member> = {
      ...formData,
      membership_date: finalJoined,
      date_joined: finalJoined,
      date_of_birth: cleanOptionalDate(formData.date_of_birth),
      first_visit_date: cleanOptionalDate(formData.first_visit_date),
      baptism_date: cleanOptionalDate(formData.baptism_date),
      salvation_date: cleanOptionalDate(formData.salvation_date),
      holy_spirit_baptism_date: cleanOptionalDate(formData.holy_spirit_baptism_date),
      right_hand_of_fellowship_date: cleanOptionalDate(formData.right_hand_of_fellowship_date),
      wedding_anniversary: cleanOptionalDate(formData.wedding_anniversary),
    };
    onSave(payload);
  };

  // Toggle helper for gift/talent chips
  const handleToggleChip = (
    field: 'spiritual_gifts' | 'talents_skills',
    item: string
  ) => {
    const current = (formData[field] || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const exists = current.includes(item);
    let updated: string[];
    if (exists) {
      updated = current.filter((x) => x !== item);
    } else {
      updated = [...current, item];
    }
    setFormData((prev) => ({
      ...prev,
      [field]: updated.join(', '),
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#064e3b] via-[#047857] to-[#064e3b] text-white flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
              <Church className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black tracking-tight">
                  {editingMember ? 'Edit Church Member Dossier' : 'Register New Church Member'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-400 text-slate-950 shadow-xs">
                  GWCC Joma
                </span>
                {editingMember?.member_id && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/20 text-white">
                    {editingMember.member_id}
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                {editingMember
                  ? `Editing official records for ${editingMember.first_name} ${editingMember.last_name}`
                  : 'Official Greater Works City Church membership covenant entry with biographical, spiritual, and contact data'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
            title="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Strip */}
        <div className="flex items-center gap-1 px-4 sm:px-6 py-2.5 bg-slate-100/90 border-b border-slate-200 overflow-x-auto text-xs shrink-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('personal')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'personal'
                ? 'bg-white text-emerald-950 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5 text-emerald-700" />
            <span>1. Bio & Biodata</span>
            {(formErrors.first_name || formErrors.last_name) && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('contact')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'contact'
                ? 'bg-white text-emerald-950 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Phone className="w-3.5 h-3.5 text-teal-700" />
            <span>2. Contact & Address</span>
            {formErrors.phone && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('church')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer relative ${
              activeTab === 'church'
                ? 'bg-white text-emerald-950 shadow-xs border border-slate-200 ring-1 ring-amber-400'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span>3. Church Life & Date Joined</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-100 text-amber-800 font-extrabold">
              Core
            </span>
            {formErrors.membership_date && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('spiritual')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'spiritual'
                ? 'bg-white text-emerald-950 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-orange-600" />
            <span>4. Discipleship & Gifts</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vocation')}
            className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'vocation'
                ? 'bg-white text-emerald-950 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5 text-purple-700" />
            <span>5. Vocation & Emergency</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          {/* ======================================================== */}
          {/* TAB 1: PERSONAL & BIODATA                                */}
          {/* ======================================================== */}
          {activeTab === 'personal' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <User className="w-4 h-4 text-emerald-700" />
                  Personal Information & Biographical Data
                </span>
                <span className="text-[11px] text-slate-400">* Required field</span>
              </div>

              {/* Profile Photo Upload */}
              <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <ProfilePhotoUpload
                  value={formData.profile_photo_url || ''}
                  onChange={(url) => setFormData((prev) => ({ ...prev, profile_photo_url: url }))}
                  memberName={`${formData.first_name || ''} ${formData.last_name || ''}`.trim() || 'New Member'}
                />
                <div className="text-xs text-slate-500 max-w-sm space-y-1">
                  <span className="font-bold text-slate-800 block flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Member Portrait Photo
                  </span>
                  <p className="text-[11px]">
                    Photo is printed on the official GWCC Membership ID Card, Sunday duty rosters, and ministerial archives.
                  </p>
                </div>
              </div>

              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.first_name || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, first_name: e.target.value });
                      if (formErrors.first_name) setFormErrors({ ...formErrors, first_name: '' });
                    }}
                    className={`w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 ${
                      formErrors.first_name ? 'border-rose-400 bg-rose-50/40' : 'border-slate-300'
                    }`}
                    placeholder="e.g. Kwame"
                  />
                  {formErrors.first_name && (
                    <span className="text-[10px] text-rose-600 block mt-0.5">{formErrors.first_name}</span>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Middle Name(s)</label>
                  <input
                    type="text"
                    value={formData.middle_name || ''}
                    onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. Owusu Addo"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Last Name / Surname <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.last_name || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, last_name: e.target.value });
                      if (formErrors.last_name) setFormErrors({ ...formErrors, last_name: '' });
                    }}
                    className={`w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 ${
                      formErrors.last_name ? 'border-rose-400 bg-rose-50/40' : 'border-slate-300'
                    }`}
                    placeholder="e.g. Mensah"
                  />
                  {formErrors.last_name && (
                    <span className="text-[10px] text-rose-600 block mt-0.5">{formErrors.last_name}</span>
                  )}
                </div>
              </div>

              {/* Gender, DOB, Age Bracket & Marital Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Gender <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.gender || 'male'}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as GenderType })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="male">Male (Men's Fellowship / Mighty Men)</option>
                    <option value="female">Female (Women's Fellowship / Virtuous Women)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700">Date of Birth</label>
                    {calculatedAge !== null && (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                        {calculatedAge} yrs old
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    value={formData.date_of_birth || ''}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                  {ageBracket && (
                    <span className="text-[10px] text-slate-500 block mt-1">
                      Bracket: <strong>{ageBracket}</strong>
                    </span>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Marital Status</label>
                  <select
                    value={formData.marital_status || 'single'}
                    onChange={(e) => setFormData({ ...formData, marital_status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="widowed">Widowed</option>
                    <option value="divorced">Divorced</option>
                  </select>
                </div>
              </div>

              {/* Conditional Marital Details */}
              {formData.marital_status === 'married' && (
                <div className="p-3.5 bg-rose-50/50 rounded-2xl border border-rose-200/80 space-y-3">
                  <span className="font-bold text-slate-800 text-[11px] block flex items-center gap-1.5 text-rose-900">
                    <Heart className="w-3.5 h-3.5 text-rose-600 fill-rose-600" />
                    Spouse & Marriage Ministry Records
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Spouse's Full Name</label>
                      <input
                        type="text"
                        value={formData.spouse_name || ''}
                        onChange={(e) => setFormData({ ...formData, spouse_name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                        placeholder="e.g. Grace Mensah"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Wedding Anniversary Date</label>
                      <input
                        type="date"
                        value={formData.wedding_anniversary || ''}
                        onChange={(e) => setFormData({ ...formData, wedding_anniversary: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Spouse is GWCC Member?</label>
                      <select
                        value={formData.spouse_is_member ? 'yes' : 'no'}
                        onChange={(e) =>
                          setFormData({ ...formData, spouse_is_member: e.target.value === 'yes' })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                      >
                        <option value="yes">Yes, Fellow GWCC Member</option>
                        <option value="no">No / Worships Elsewhere</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Number of Children, Nationality & Ghana Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Number of Children</label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={formData.number_of_children ?? 0}
                    onChange={(e) =>
                      setFormData({ ...formData, number_of_children: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nationality</label>
                  <input
                    type="text"
                    value={formData.nationality || 'Ghanaian'}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                    placeholder="Ghanaian"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <IdCard className="w-3.5 h-3.5 text-teal-700" />
                      Ghana Card Number / National ID
                    </span>
                  </label>
                  <input
                    type="text"
                    value={formData.national_id || ''}
                    onChange={(e) => setFormData({ ...formData, national_id: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs uppercase"
                    placeholder="GHA-712345678-9"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Official Ghanaian National ID card PIN
                  </span>
                </div>
              </div>

              {/* Hometown & Region of Origin */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Hometown</label>
                  <input
                    type="text"
                    value={formData.hometown || ''}
                    onChange={(e) => setFormData({ ...formData, hometown: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                    placeholder="e.g. Abetifi Kwahu, Anloga, Kumasi, Cape Coast"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Ancestral home for welfare & bereavement pastoral support
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Region of Origin</label>
                  <select
                    value={formData.region_of_origin || 'Greater Accra'}
                    onChange={(e) => setFormData({ ...formData, region_of_origin: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                  >
                    {GHANA_REGIONS.map((reg) => (
                      <option key={reg} value={reg}>
                        {reg} Region
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: CONTACT & ADDRESS                                 */}
          {/* ======================================================== */}
          {activeTab === 'contact' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-teal-700" />
                  Contact Information & Digital Residence (Ghana)
                </span>
                <span className="text-[11px] text-slate-400">Used for pastoral SMS broadcasts & WhatsApp</span>
              </div>

              {/* Phones & Communication Preference */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Primary Phone (+233) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, phone: e.target.value });
                      if (formErrors.phone) setFormErrors({ ...formErrors, phone: '' });
                    }}
                    className={`w-full px-3 py-2 border rounded-xl font-mono text-xs focus:ring-2 focus:ring-teal-500 ${
                      formErrors.phone ? 'border-rose-400 bg-rose-50/40' : 'border-slate-300'
                    }`}
                    placeholder="+233 24 123 4567"
                  />
                  {formErrors.phone && (
                    <span className="text-[10px] text-rose-600 block mt-0.5">{formErrors.phone}</span>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Alternative Phone / WhatsApp Line
                  </label>
                  <input
                    type="tel"
                    value={formData.alternative_phone || ''}
                    onChange={(e) => setFormData({ ...formData, alternative_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs"
                    placeholder="+233 20 987 6543"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Preferred Communication
                  </label>
                  <select
                    value={formData.preferred_communication || 'whatsapp'}
                    onChange={(e) =>
                      setFormData({ ...formData, preferred_communication: e.target.value as any })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                  >
                    <option value="whatsapp">WhatsApp Message</option>
                    <option value="sms">SMS Text Alert</option>
                    <option value="call">Phone Call</option>
                    <option value="email">Email Notice</option>
                  </select>
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  placeholder="kwame.mensah@gmail.com"
                />
              </div>

              {/* Residential & Landmark */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Residential Address / Town
                  </label>
                  <input
                    type="text"
                    value={formData.residential_address || ''}
                    onChange={(e) => setFormData({ ...formData, residential_address: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                    placeholder="e.g. Joma New Site, Ablekuma Central, Accra"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nearest Landmark / Directions
                  </label>
                  <input
                    type="text"
                    value={formData.landmark || ''}
                    onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                    placeholder="e.g. Behind Joma Chief's Palace, Opposite Top Pharmacy"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Essential for pastoral home visits and small group meetings
                  </span>
                </div>
              </div>

              {/* GhanaPost GPS & City & Region */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-teal-700" />
                      GhanaPost GPS Code
                    </label>
                    {formData.gps_address && formData.gps_address !== 'GA-' && (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(formData.gps_address)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-teal-700 hover:underline flex items-center gap-0.5 font-bold"
                      >
                        <ExternalLink className="w-2.5 h-2.5" /> Map
                      </a>
                    )}
                  </div>
                  <input
                    type="text"
                    value={formData.gps_address || ''}
                    onChange={(e) => setFormData({ ...formData, gps_address: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs uppercase"
                    placeholder="GA-183-4921"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City / Suburb</label>
                  <input
                    type="text"
                    value={formData.city || 'Accra'}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                    placeholder="Accra / Ablekuma"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Region of Residence</label>
                  <select
                    value={formData.region || 'Greater Accra'}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                  >
                    {GHANA_REGIONS.map((reg) => (
                      <option key={reg} value={reg}>
                        {reg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: CHURCH LIFE & DATE JOINED (ENHANCED!)            */}
          {/* ======================================================== */}
          {activeTab === 'church' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  Church Covenant, Date Joined & Ministerial Placement
                </span>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                  Ecclesiastical Records
                </span>
              </div>

              {/* DATE JOINED CALLOUT BANNER - Prominent & Highly Functional */}
              <div className="bg-gradient-to-br from-amber-50 via-emerald-50/50 to-teal-50/40 p-4 rounded-2xl border-2 border-amber-300/80 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center shadow-xs">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <label className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                        <span>Date Joined GWCC (Membership Inception) *</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <p className="text-[11px] text-slate-600">
                        Official date the member was admitted or made covenant commitment at Greater Works City Church.
                      </p>
                    </div>
                  </div>

                  {/* Shortcuts */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date().toISOString().split('T')[0];
                        setFormData((prev) => ({
                          ...prev,
                          membership_date: today,
                          date_joined: today,
                        }));
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 text-[11px] font-bold hover:bg-amber-100/70 transition shadow-2xs cursor-pointer"
                    >
                      Set Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        // First of current year
                        const firstOfYear = `${new Date().getFullYear()}-01-01`;
                        setFormData((prev) => ({
                          ...prev,
                          membership_date: firstOfYear,
                          date_joined: firstOfYear,
                        }));
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 text-[11px] font-medium hover:bg-slate-100 transition shadow-2xs cursor-pointer"
                    >
                      Start of {new Date().getFullYear()}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <input
                      type="date"
                      required
                      value={formData.membership_date || formData.date_joined || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          membership_date: val,
                          date_joined: val,
                        }));
                        if (formErrors.membership_date) setFormErrors({ ...formErrors, membership_date: '' });
                      }}
                      className={`w-full px-3.5 py-2.5 border-2 rounded-xl text-xs font-bold bg-white text-slate-900 shadow-xs focus:ring-2 focus:ring-amber-500 ${
                        formErrors.membership_date ? 'border-rose-500 bg-rose-50/40' : 'border-amber-400'
                      }`}
                    />
                    {formErrors.membership_date && (
                      <span className="text-[10px] text-rose-600 block mt-1 font-bold">
                        {formErrors.membership_date}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/80 border border-amber-200 text-xs">
                    <Award className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        Church Fellowship Tenure
                      </span>
                      <span className="font-extrabold text-slate-800">
                        {tenureText || 'Date not yet selected'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* First Visit & Formal Reception (Right Hand of Fellowship) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    First Visit Date (as Guest)
                  </label>
                  <input
                    type="date"
                    value={formData.first_visit_date || ''}
                    onChange={(e) => setFormData({ ...formData, first_visit_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    When the person first attended a GWCC service
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Right Hand of Fellowship Date (Induction)
                  </label>
                  <input
                    type="date"
                    value={formData.right_hand_of_fellowship_date || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, right_hand_of_fellowship_date: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Formal presentation & welcome before the altar / congregation
                  </span>
                </div>
              </div>

              {/* Membership Status & Tithe Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Membership Status</label>
                  <select
                    value={formData.status || 'active'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as MembershipStatus })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white"
                  >
                    <option value="active">Active Member (Regular Communicant)</option>
                    <option value="new_member">New Member (Under Assimilation)</option>
                    <option value="new_convert">New Convert (Recent Salvation Decision)</option>
                    <option value="leader">Church Leader / Pastoral Officer</option>
                    <option value="inactive">Inactive / On Travel / Irregular</option>
                    <option value="visitor">Visitor / Occasional Guest</option>
                    <option value="transferred">Transferred to Another Assembly</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tithe Number / Envelope Code
                  </label>
                  <input
                    type="text"
                    value={formData.tithe_number || ''}
                    onChange={(e) => setFormData({ ...formData, tithe_number: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs uppercase"
                    placeholder="Leave blank for auto-generation (e.g. T-1045)"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    If blank, GWCC system automatically issues the next sequential Tithe ID.
                  </span>
                </div>
              </div>

              {/* Ministry & Small Group (Cell) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ministry Fellowship</label>
                  <select
                    value={formData.ministry_id || ''}
                    onChange={(e) => setFormData({ ...formData, ministry_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                  >
                    <option value="">-- No Ministry Assigned --</option>
                    {ministries.map((min) => (
                      <option key={min.id} value={min.id}>
                        {min.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Small Group (Cell Fellowship)</label>
                  <select
                    value={formData.small_group_id || ''}
                    onChange={(e) => setFormData({ ...formData, small_group_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                  >
                    <option value="">-- No Cell Assigned --</option>
                    {smallGroups.map((grp) => (
                      <option key={grp.id} value={grp.id}>
                        {grp.name} ({grp.meeting_day})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Leadership Position & Previous Church Background */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Leadership Position / Office (if any)
                  </label>
                  <div className="relative">
                    <Crown className="w-4 h-4 text-purple-600 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={formData.leadership_position || ''}
                      onChange={(e) => setFormData({ ...formData, leadership_position: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs"
                      placeholder="e.g. Deacon, Protocol Head, Choir Secretary, Cell Leader"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Previous Church / Denominational Background
                  </label>
                  <input
                    type="text"
                    value={formData.previous_church || ''}
                    onChange={(e) => setFormData({ ...formData, previous_church: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                    placeholder="e.g. Church of Pentecost, ICGC, First-time Believer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: SPIRITUAL JOURNEY & GIFTS                         */}
          {/* ======================================================== */}
          {activeTab === 'spiritual' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-600" />
                  Spiritual Milestones, Holy Spirit & Ministry Talents
                </span>
                <span className="text-[11px] text-slate-400">Discipleship progress records</span>
              </div>

              {/* Core Faith Milestones */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                <span className="font-bold text-slate-800 text-xs block">
                  Foundational Christian Milestones
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Milestone 1: Salvation */}
                  <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-emerald-300 transition shadow-2xs">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.salvation_status)}
                      onChange={(e) => setFormData({ ...formData, salvation_status: e.target.checked })}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block text-xs">Salvation Decision</span>
                      <span className="text-[10px] text-slate-500">Born Again / Confessed Christ</span>
                    </div>
                  </label>

                  {/* Milestone 2: Water Baptism */}
                  <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-emerald-300 transition shadow-2xs">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.baptism_status)}
                      onChange={(e) => setFormData({ ...formData, baptism_status: e.target.checked })}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block text-xs">Water Baptism</span>
                      <span className="text-[10px] text-slate-500">Baptized by Immersion</span>
                    </div>
                  </label>

                  {/* Milestone 3: Holy Ghost Baptism */}
                  <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-emerald-300 transition shadow-2xs">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.holy_spirit_baptism)}
                      onChange={(e) => setFormData({ ...formData, holy_spirit_baptism: e.target.checked })}
                      className="mt-0.5 rounded text-orange-600 focus:ring-orange-500 w-4 h-4"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block text-xs flex items-center gap-1">
                        <span>Holy Spirit Baptism</span>
                        <Flame className="w-3 h-3 text-orange-500" />
                      </span>
                      <span className="text-[10px] text-slate-500">Speaks in Tongues</span>
                    </div>
                  </label>

                  {/* Milestone 4: Believers Class */}
                  <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-emerald-300 transition shadow-2xs">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.membership_class_completed)}
                      onChange={(e) =>
                        setFormData({ ...formData, membership_class_completed: e.target.checked })
                      }
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block text-xs">Foundation School</span>
                      <span className="text-[10px] text-slate-500">Completed Believers Class</span>
                    </div>
                  </label>
                </div>

                {/* Sub-dates for milestones */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Salvation Date (if known)
                    </label>
                    <input
                      type="date"
                      value={formData.salvation_date || ''}
                      onChange={(e) => setFormData({ ...formData, salvation_date: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Water Baptism Date & Officiator
                    </label>
                    <div className="space-y-1.5">
                      <input
                        type="date"
                        value={formData.baptism_date || ''}
                        onChange={(e) => setFormData({ ...formData, baptism_date: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                      />
                      <input
                        type="text"
                        value={formData.baptized_by || ''}
                        onChange={(e) => setFormData({ ...formData, baptized_by: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-[11px] bg-white"
                        placeholder="Baptized by (e.g. Pastor James)"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Holy Ghost Baptism Date
                    </label>
                    <input
                      type="date"
                      value={formData.holy_spirit_baptism_date || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, holy_spirit_baptism_date: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Spiritual Gifts Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Spiritual Gifts & Ministry Callings
                  </label>
                  <span className="text-[10px] text-slate-400">Click chips to select/deselect</span>
                </div>
                <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-amber-50/40 border border-amber-200/60">
                  {SPIRITUAL_GIFTS_OPTIONS.map((gift) => {
                    const selected = (formData.spiritual_gifts || '').includes(gift);
                    return (
                      <button
                        key={gift}
                        type="button"
                        onClick={() => handleToggleChip('spiritual_gifts', gift)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                          selected
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
                            : 'bg-white text-slate-700 border border-slate-200 hover:border-amber-300'
                        }`}
                      >
                        {selected ? '✓ ' : '+ '}
                        {gift}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Talents & Technical Skills */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <Award className="w-3.5 h-3.5 text-teal-600" />
                    Talents, Musical & Practical Skills
                  </label>
                  <span className="text-[10px] text-slate-400">Used for service team deployments</span>
                </div>
                <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-teal-50/40 border border-teal-200/60">
                  {TALENTS_OPTIONS.map((talent) => {
                    const selected = (formData.talents_skills || '').includes(talent);
                    return (
                      <button
                        key={talent}
                        type="button"
                        onClick={() => handleToggleChip('talents_skills', talent)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                          selected
                            ? 'bg-teal-700 text-white font-bold shadow-2xs'
                            : 'bg-white text-slate-700 border border-slate-200 hover:border-teal-300'
                        }`}
                      >
                        {selected ? '✓ ' : '+ '}
                        {talent}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 5: VOCATION, EDUCATION & EMERGENCY                   */}
          {/* ======================================================== */}
          {activeTab === 'vocation' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-purple-700" />
                  Profession, Education & Emergency Next-of-Kin
                </span>
                <span className="text-[11px] text-slate-400">Pastoral confidential records</span>
              </div>

              {/* Vocation & Education */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Occupation / Profession</label>
                  <input
                    type="text"
                    value={formData.occupation || ''}
                    onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                    placeholder="e.g. Civil Engineer, Nurse, Trader, Teacher"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Employer / Workplace</label>
                  <input
                    type="text"
                    value={formData.employer || ''}
                    onChange={(e) => setFormData({ ...formData, employer: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                    placeholder="e.g. Korle Bu Hospital / Self-Employed / GCB"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Educational Level</label>
                  <select
                    value={formData.education || ''}
                    onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                  >
                    <option value="">-- Select Highest Education --</option>
                    <option value="Basic / JHS">Basic School / BECE</option>
                    <option value="Secondary / WASSCE">Senior High / WASSCE</option>
                    <option value="Vocational / Technical">Vocational / TVET</option>
                    <option value="Diploma / HND">Diploma / HND</option>
                    <option value="Bachelor's Degree">Bachelor's Degree (BSc, BA)</option>
                    <option value="Master's Degree">Master's Degree (MSc, MBA)</option>
                    <option value="Doctorate (PhD / MD)">Doctorate (PhD / MD)</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Emergency Next of Kin */}
              <div className="p-4 bg-rose-50/60 rounded-2xl border border-rose-200/80 space-y-3">
                <span className="font-bold text-slate-900 text-xs block flex items-center gap-1.5 text-rose-900">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  Emergency Next-of-Kin Contact
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={formData.emergency_name || ''}
                      onChange={(e) => setFormData({ ...formData, emergency_name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                      placeholder="e.g. Grace Mensah"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Relationship</label>
                    <select
                      value={formData.emergency_relationship || 'Spouse'}
                      onChange={(e) => setFormData({ ...formData, emergency_relationship: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white"
                    >
                      <option value="Spouse">Spouse</option>
                      <option value="Parent">Parent (Mother / Father)</option>
                      <option value="Sibling">Sibling (Brother / Sister)</option>
                      <option value="Child">Child (Son / Daughter)</option>
                      <option value="Next of Kin">Next of Kin</option>
                      <option value="Friend">Friend / Neighbour</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Primary Emergency Phone</label>
                    <input
                      type="tel"
                      value={formData.emergency_phone || ''}
                      onChange={(e) => setFormData({ ...formData, emergency_phone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs bg-white"
                      placeholder="+233 24 000 0000"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Alternative Emergency Phone</label>
                    <input
                      type="tel"
                      value={formData.emergency_alt_phone || ''}
                      onChange={(e) => setFormData({ ...formData, emergency_alt_phone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs bg-white"
                      placeholder="+233 20 000 0000"
                    />
                  </div>
                </div>
              </div>

              {/* Pastoral Care, Health & Administrative Notes */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pastoral Notes, Family History & Special Prayer Needs
                </label>
                <textarea
                  rows={3}
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                  placeholder="Record spiritual background, prayer requests, health alerts, or pastoral visit history (strictly confidential)..."
                />
              </div>
            </div>
          )}

          {/* Form Actions Footer */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            {/* Step navigation helpers */}
            <div className="flex items-center gap-2">
              {activeTab !== 'personal' && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === 'contact') setActiveTab('personal');
                    else if (activeTab === 'church') setActiveTab('contact');
                    else if (activeTab === 'spiritual') setActiveTab('church');
                    else if (activeTab === 'vocation') setActiveTab('spiritual');
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
              )}

              {activeTab !== 'vocation' && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === 'personal') setActiveTab('contact');
                    else if (activeTab === 'contact') setActiveTab('church');
                    else if (activeTab === 'church') setActiveTab('spiritual');
                    else if (activeTab === 'spiritual') setActiveTab('vocation');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <span>Next Step</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition cursor-pointer flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>{editingMember ? 'Save Changes' : 'Register Church Member'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
