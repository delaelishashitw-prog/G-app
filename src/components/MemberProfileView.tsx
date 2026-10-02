import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Shield,
  ShieldCheck,
  Coins,
  CheckCircle2,
  Clock,
  Heart,
  Edit2,
  Archive,
  MessageCircle,
  Copy,
  Check,
  Printer,
  Crown,
  Sparkles,
  Users,
  ChevronRight,
  TrendingUp,
  FileText,
  AlertCircle,
  Award,
  ExternalLink,
  Plus,
  QrCode,
  UserCheck,
  CalendarCheck,
  Share2,
} from 'lucide-react';
import { Member, Ministry, SmallGroup } from '../types/database.types';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useToast } from '../contexts/ToastContext';
import { formatGHS } from '../lib/currencyUtils';

// Modals
import { MemberIdCardModal } from './members/MemberIdCardModal';
import { RecordMemberGivingModal } from './members/RecordMemberGivingModal';
import { AddPastoralNoteModal } from './members/AddPastoralNoteModal';
import { MemberDossierModal } from './members/MemberDossierModal';
import { MemberGivingStatementModal } from './finance/MemberGivingStatementModal';

export interface MemberProfileViewProps {
  member: Member;
  onBack: () => void;
  onEdit: (member: Member) => void;
  renderStatusBadge: (member: Member, size?: 'sm' | 'md') => React.ReactNode;
}

export const MemberProfileView: React.FC<MemberProfileViewProps> = ({
  member,
  onBack,
  onEdit,
  renderStatusBadge,
}) => {
  const {
    members,
    ministries,
    smallGroups,
    giving,
    attendance,
    pledges,
    archiveMember,
    updateMember,
    recordAttendance,
    services,
    settings,
    pastoralCare,
  } = useChurchData();
  const { success, info, error } = useToast();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'attendance' | 'giving' | 'pledges' | 'ministries' | 'pastoral'
  >('overview');
  const [copiedId, setCopiedId] = useState(false);
  const [whatsappMenuOpen, setWhatsappMenuOpen] = useState(false);

  // Modals state
  const [isIdCardOpen, setIsIdCardOpen] = useState(false);
  const [isGivingModalOpen, setIsGivingModalOpen] = useState(false);
  const [isPastoralModalOpen, setIsPastoralModalOpen] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [isGivingStatementOpen, setIsGivingStatementOpen] = useState(false);

  // Filter church data for this specific member
  const memberAttendance = useMemo(() => {
    return attendance
      .filter((a) => a.member_id === member.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [attendance, member.id]);

  const memberGiving = useMemo(() => {
    return giving
      .filter((g) => g.member_id === member.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [giving, member.id]);

  const memberPledges = useMemo(() => {
    return pledges.filter((p) => p.member_id === member.id);
  }, [pledges, member.id]);

  const memberPastoral = useMemo(() => {
    return pastoralCare
      .filter((p) => p.member_id === member.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [pastoralCare, member.id]);

  // Giving category sums
  const givingByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    memberGiving.forEach((g) => {
      map[g.category] = (map[g.category] || 0) + g.amount;
    });
    return map;
  }, [memberGiving]);

  const totalMemberGiving = useMemo(
    () => memberGiving.reduce((acc, curr) => acc + curr.amount, 0),
    [memberGiving]
  );
  const totalPledged = useMemo(
    () => memberPledges.reduce((acc, curr) => acc + curr.amount_pledged, 0),
    [memberPledges]
  );
  const totalPledgePaid = useMemo(
    () => memberPledges.reduce((acc, curr) => acc + curr.amount_paid, 0),
    [memberPledges]
  );
  const totalPledgeBalance = useMemo(
    () => memberPledges.reduce((acc, curr) => acc + curr.balance, 0),
    [memberPledges]
  );

  // Family and household connection (matching last name, emergency contact, or address)
  const familyMembers = useMemo(() => {
    return members.filter(
      (m) =>
        m.id !== member.id &&
        !m.is_archived &&
        (m.last_name.toLowerCase() === member.last_name.toLowerCase() ||
          (m.emergency_phone && m.emergency_phone === member.phone) ||
          (member.emergency_phone && member.emergency_phone === m.phone) ||
          (m.residential_address && member.residential_address && m.residential_address === member.residential_address))
    );
  }, [members, member]);

  // Clean Ghana phone number
  const cleanPhone = member.phone ? member.phone.replace(/[^0-9]/g, '') : '';
  const ghanaPhone = cleanPhone.startsWith('0') ? '233' + cleanPhone.slice(1) : cleanPhone;

  // Pre-formatted pastoral message templates
  const whatsappMessages = {
    general: `Praise the Lord ${member.first_name}, greetings from Greater Works City Church (GWCC)! We pray God's grace and peace over you and your family this week.`,
    sunday: `Hello ${member.first_name}! Looking forward to fellowshipping with you at Greater Works City Church this Sunday. May your heart be blessed!`,
    birthday: `Glorious Birthday to you, ${member.first_name}! Greater Works City Church celebrates the grace of God upon your life. May the Lord expand your territory!`,
    tithe: `Dear ${member.first_name}, thank you for your faithful financial stewardship and tithes at Greater Works City Church. May the Lord open the windows of heaven upon you!`,
  };

  const ministry = ministries.find((m) => m.id === member.ministry_id);
  const smallGroup = smallGroups.find((g) => g.id === member.small_group_id);

  const handleCopyId = () => {
    navigator.clipboard.writeText(member.member_id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleArchive = () => {
    if (
      confirm(
        `Are you sure you want to archive ${member.first_name} ${member.last_name}? They will no longer appear in the active member registry.`
      )
    ) {
      archiveMember(member.id);
      success(`${member.first_name} archived.`);
      onBack();
    }
  };

  // 1-Click Check-In for today
  const handleQuickCheckInToday = () => {
    const today = new Date().toISOString().split('T')[0];
    const targetService = services[0];
    if (!targetService) return;

    const res = recordAttendance(targetService.id, 'member', member.id, 'search', today);
    if (res.success) {
      success(`Checked in ${member.first_name} for ${targetService.name}!`);
    } else {
      info(res.message);
    }
  };

  // Toggle spiritual journey milestones
  const handleToggleMilestone = (field: 'salvation_status' | 'baptism_status' | 'membership_class_completed') => {
    const nextVal = !member[field];
    updateMember(member.id, { [field]: nextVal });
    success(`Updated ${field.replace('_', ' ')} for ${member.first_name}.`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Navigation & Breadcrumbs Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold transition shadow-2xs group"
          >
            <ArrowLeft className="w-4 h-4 text-teal-700 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Members</span>
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-slate-500 font-medium">Directory</span>
          <span className="text-slate-300">/</span>
          <span className="font-bold text-slate-800 truncate max-w-[200px] sm:max-w-xs">
            {member.first_name} {member.last_name}
          </span>
        </div>

        {/* Quick Top Actions Toolbar */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Quick Record Giving Button */}
          <button
            type="button"
            onClick={() => setIsGivingModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Record Tithe/Giving</span>
          </button>

          {/* Quick Check In Today */}
          <button
            type="button"
            onClick={handleQuickCheckInToday}
            className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
            title="Check in for today's service"
          >
            <CalendarCheck className="w-3.5 h-3.5 text-teal-700" />
            <span>Check In Today</span>
          </button>

          {/* Member ID Card */}
          <button
            type="button"
            onClick={() => setIsIdCardOpen(true)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
            title="View & Print Official Membership Card"
          >
            <QrCode className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Member ID Card</span>
          </button>

          {/* Print Dossier */}
          <button
            type="button"
            onClick={() => setIsDossierOpen(true)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
            title="Print complete official member file record"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden md:inline">Print Dossier</span>
          </button>

          {/* WhatsApp Direct / Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setWhatsappMenuOpen(!whatsappMenuOpen)}
              className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            {whatsappMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 z-30 text-xs space-y-1 animate-in fade-in zoom-in-95">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 block">
                  Select Pastoral Template
                </span>
                <a
                  href={`https://wa.me/${ghanaPhone}?text=${encodeURIComponent(whatsappMessages.general)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setWhatsappMenuOpen(false)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 flex items-center gap-2 text-slate-700 font-medium"
                >
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  <span>General Church Greeting</span>
                </a>
                <a
                  href={`https://wa.me/${ghanaPhone}?text=${encodeURIComponent(whatsappMessages.sunday)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setWhatsappMenuOpen(false)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 flex items-center gap-2 text-slate-700 font-medium"
                >
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>Sunday Service Reminder</span>
                </a>
                <a
                  href={`https://wa.me/${ghanaPhone}?text=${encodeURIComponent(whatsappMessages.birthday)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setWhatsappMenuOpen(false)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 flex items-center gap-2 text-slate-700 font-medium"
                >
                  <Heart className="w-3.5 h-3.5 text-rose-500" />
                  <span>Birthday Blessing Greeting</span>
                </a>
                <a
                  href={`https://wa.me/${ghanaPhone}?text=${encodeURIComponent(whatsappMessages.tithe)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setWhatsappMenuOpen(false)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 flex items-center gap-2 text-slate-700 font-medium"
                >
                  <Coins className="w-3.5 h-3.5 text-amber-500" />
                  <span>Tithe Appreciation Note</span>
                </a>
              </div>
            )}
          </div>

          {/* Edit Member */}
          <button
            type="button"
            onClick={() => onEdit(member)}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Member</span>
          </button>

          {/* Archive Member */}
          <button
            type="button"
            onClick={handleArchive}
            className="px-2.5 py-1.5 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-xl transition"
            title="Archive member"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Hero Profile Banner Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-950 via-teal-900 to-slate-950 p-6 sm:p-8 text-white shadow-xl border border-teal-800/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            {/* Avatar */}
            <div
              onClick={() => onEdit(member)}
              className="relative shrink-0 group cursor-pointer"
              title="Click to edit profile photo"
            >
              {member.profile_photo_url ? (
                <img
                  src={member.profile_photo_url}
                  alt={`${member.first_name} ${member.last_name}`}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-3 border-white/90 shadow-xl group-hover:brightness-90 transition"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/20 text-white font-black text-2xl sm:text-3xl flex items-center justify-center border-3 border-white/50 shadow-xl backdrop-blur-xs group-hover:bg-white/30 transition">
                  {member.first_name[0]}
                  {member.last_name[0]}
                </div>
              )}
              <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                <Edit2 className="w-5 h-5 drop-shadow" />
              </div>
              <span
                className={`absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full border-2 border-white text-[10px] font-bold uppercase shadow-xs ${
                  member.gender === 'male' ? 'bg-sky-600 text-white' : 'bg-pink-500 text-white'
                }`}
              >
                {member.gender}
              </span>
            </div>

            {/* Main Info */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  {member.first_name} {member.middle_name ? `${member.middle_name} ` : ''}{member.last_name}
                </h1>
                {renderStatusBadge(member, 'md')}
              </div>

              <div className="flex items-center gap-2 flex-wrap text-xs text-teal-100">
                {/* Member ID Pill with copy */}
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded-md bg-white/15 hover:bg-white/25 text-white border border-white/20 transition"
                  title="Click to copy Member ID"
                >
                  <span>{member.member_id}</span>
                  {copiedId ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3 text-white/70" />}
                </button>

                {member.tithe_number && (
                  <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 shadow-xs">
                    Tithe #{member.tithe_number}
                  </span>
                )}

                {member.leadership_position && (
                  <span className="font-semibold px-2 py-0.5 rounded-md bg-purple-500/30 text-purple-100 border border-purple-300/40">
                    {member.leadership_position}
                  </span>
                )}

                <span className="text-teal-200/80">•</span>
                <span className="capitalize">{member.marital_status || 'Single'}</span>
                <span className="text-teal-200/80">•</span>
                <span>{member.occupation || 'Congregant'}</span>
              </div>

              {/* Contact Tags */}
              <div className="flex items-center gap-4 flex-wrap text-xs text-teal-200 pt-1">
                <a
                  href={`tel:${member.phone}`}
                  className="flex items-center gap-1.5 font-mono hover:text-white transition"
                >
                  <Phone className="w-3.5 h-3.5 text-teal-300" />
                  <span>{member.phone}</span>
                </a>

                {member.gps_address && (
                  <a
                    href={`https://ghanapostgps.com/map/#${member.gps_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 font-mono hover:text-amber-200 transition text-amber-300"
                    title="Open in GhanaPost GPS Map"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{member.gps_address}</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                  </a>
                )}

                {member.email && (
                  <a
                    href={`mailto:${member.email}`}
                    className="flex items-center gap-1.5 hover:text-white transition"
                  >
                    <Mail className="w-3.5 h-3.5 text-teal-300" />
                    <span className="truncate max-w-[200px]">{member.email}</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Quick Right Side Congregation Placement */}
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-xs space-y-1.5 self-start md:self-auto min-w-[220px]">
            <span className="text-[10px] uppercase tracking-wider text-teal-300 font-bold block">
              Assembly Placement
            </span>
            <div className="font-bold text-sm text-white">
              {member.ministry_name || ministry?.name || 'General Assembly'}
            </div>
            <div className="text-teal-100 text-xs">
              Cell: <strong>{member.small_group_name || smallGroup?.name || 'No Cell Group'}</strong>
            </div>
            <div className="text-[11px] text-teal-200 pt-1 border-t border-white/10">
              Joined GWCC: {member.membership_date || 'Foundation Member'}
            </div>
          </div>
        </div>

        {/* Decorative background element */}
        <div className="absolute right-0 top-0 bottom-0 opacity-5 pointer-events-none flex items-center justify-end pr-10">
          <Sparkles className="w-72 h-72 text-white" />
        </div>
      </div>

      {/* Discipleship Journey & Spiritual Milestones Tracker */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-700" />
              Spiritual Life & Discipleship Journey
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Faith milestones certified at Greater Works City Church
            </p>
          </div>
          <span className="text-[11px] font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
            Interactive Checklist
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 pt-1">
          {/* Milestone 1: Salvation */}
          <button
            type="button"
            onClick={() => handleToggleMilestone('salvation_status')}
            className={`p-3 rounded-xl border text-left transition flex items-center justify-between gap-2 ${
              member.salvation_status
                ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
            }`}
          >
            <div>
              <span className="text-[10px] font-bold uppercase block text-slate-400">Step 1</span>
              <p className="font-bold text-xs">Salvation Decision</p>
              <span className="text-[10px] font-medium opacity-80">
                {member.salvation_status ? 'Born Again' : 'Pending'}
              </span>
            </div>
            {member.salvation_status ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
            )}
          </button>

          {/* Milestone 2: Water Baptism */}
          <button
            type="button"
            onClick={() => handleToggleMilestone('baptism_status')}
            className={`p-3 rounded-xl border text-left transition flex items-center justify-between gap-2 ${
              member.baptism_status
                ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
            }`}
          >
            <div>
              <span className="text-[10px] font-bold uppercase block text-slate-400">Step 2</span>
              <p className="font-bold text-xs">Water Baptism</p>
              <span className="text-[10px] font-medium opacity-80">
                {member.baptism_status ? 'Immersion Certified' : 'Awaiting Baptism'}
              </span>
            </div>
            {member.baptism_status ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
            )}
          </button>

          {/* Milestone 3: Holy Ghost Baptism */}
          <button
            type="button"
            onClick={() => handleToggleMilestone('holy_spirit_baptism' as any)}
            className={`p-3 rounded-xl border text-left transition flex items-center justify-between gap-2 ${
              member.holy_spirit_baptism
                ? 'bg-orange-50/70 border-orange-300 text-orange-950'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
            }`}
          >
            <div>
              <span className="text-[10px] font-bold uppercase block text-slate-400">Step 3</span>
              <p className="font-bold text-xs flex items-center gap-1">
                <span>Holy Spirit</span>
              </p>
              <span className="text-[10px] font-medium opacity-80">
                {member.holy_spirit_baptism ? 'Speaks in Tongues' : 'Awaiting Infilling'}
              </span>
            </div>
            {member.holy_spirit_baptism ? (
              <Sparkles className="w-5 h-5 text-orange-500 shrink-0" />
            ) : (
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
            )}
          </button>

          {/* Milestone 4: Foundation Class */}
          <button
            type="button"
            onClick={() => handleToggleMilestone('membership_class_completed')}
            className={`p-3 rounded-xl border text-left transition flex items-center justify-between gap-2 ${
              member.membership_class_completed
                ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
            }`}
          >
            <div>
              <span className="text-[10px] font-bold uppercase block text-slate-400">Step 4</span>
              <p className="font-bold text-xs">Believers Class</p>
              <span className="text-[10px] font-medium opacity-80">
                {member.membership_class_completed ? 'Class Certified' : 'In Training'}
              </span>
            </div>
            {member.membership_class_completed ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
            )}
          </button>

          {/* Milestone 5: Ministry Assignment */}
          <div
            className={`p-3 rounded-xl border text-left flex items-center justify-between gap-2 ${
              member.ministry_name
                ? 'bg-teal-50/70 border-teal-300 text-teal-950'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
          >
            <div>
              <span className="text-[10px] font-bold uppercase block text-slate-400">Step 5</span>
              <p className="font-bold text-xs">Ministry Service</p>
              <span className="text-[10px] font-medium opacity-80 truncate block max-w-[120px]">
                {member.ministry_name ? member.ministry_name.split('(')[0] : 'Unassigned'}
              </span>
            </div>
            {member.ministry_name ? (
              <Users className="w-5 h-5 text-teal-700 shrink-0" />
            ) : (
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
            )}
          </div>

          {/* Milestone 6: Leadership Office */}
          <div
            className={`p-3 rounded-xl border text-left flex items-center justify-between gap-2 ${
              member.leadership_position
                ? 'bg-purple-50/70 border-purple-300 text-purple-950'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
          >
            <div>
              <span className="text-[10px] font-bold uppercase block text-slate-400">Step 6</span>
              <p className="font-bold text-xs">Leadership Role</p>
              <span className="text-[10px] font-medium opacity-80 truncate block max-w-[120px]">
                {member.leadership_position || 'Active Congregant'}
              </span>
            </div>
            {member.leadership_position ? (
              <Crown className="w-5 h-5 text-purple-600 shrink-0" />
            ) : (
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
            )}
          </div>
        </div>
      </div>

      {/* 4 Key Metric Cards for this Member */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Cumulative Giving</span>
            <Coins className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            {formatGHS(totalMemberGiving)}
          </div>
          <p className="text-[11px] text-slate-400">
            {memberGiving.length} recorded contributions
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Service Attendance</span>
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-xl font-black text-slate-900">
            {memberAttendance.length} <span className="text-xs font-normal text-slate-400">Services</span>
          </div>
          <p className="text-[11px] text-teal-700 font-semibold">
            {memberAttendance[0] ? `Last: ${memberAttendance[0].date}` : 'No check-ins yet'}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Pledges Committed</span>
            <Award className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            {formatGHS(totalPledged)}
          </div>
          <p className="text-[11px] text-slate-500">
            Paid: <span className="text-emerald-700 font-bold">{formatGHS(totalPledgePaid)}</span>
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Pastoral Follow-Up</span>
            <Heart className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-black text-slate-900">
            {memberPastoral.length} <span className="text-xs font-normal text-slate-400">Care Logs</span>
          </div>
          <p className="text-[11px] text-slate-400">
            {memberPastoral[0] ? `Last: ${memberPastoral[0].care_type.replace(/_/g, ' ')}` : 'No pastoral care logs'}
          </p>
        </div>
      </div>

      {/* Tabbed Details Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Tab Headers */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-6 overflow-x-auto text-xs font-semibold text-slate-600 gap-6">
          {[
            { id: 'overview', label: 'Overview & Family' },
            { id: 'attendance', label: `Attendance History (${memberAttendance.length})` },
            { id: 'giving', label: `Financial Giving (${memberGiving.length})` },
            { id: 'pledges', label: `Pledges & Projects (${memberPledges.length})` },
            { id: 'ministries', label: 'Ministries & Fellowship' },
            { id: 'pastoral', label: `Pastoral Care & Remarks (${memberPastoral.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3.5 border-b-2 transition whitespace-nowrap text-xs ${
                activeTab === tab.id
                  ? 'border-teal-700 text-teal-800 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div className="p-6">
          {/* TAB 1: OVERVIEW & FAMILY */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Information */}
              <div className="space-y-4 bg-slate-50/60 p-5 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-teal-700" />
                    Personal & Demographic Data
                  </h3>
                  <span className="text-[11px] font-semibold text-slate-400 font-mono">
                    ID: {member.member_id}
                  </span>
                </div>

                <div className="text-xs space-y-2.5">
                  <div className="flex justify-between py-1 border-b border-slate-100 bg-amber-50/60 px-2 rounded-lg">
                    <span className="font-bold text-amber-900 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      Date Joined GWCC
                    </span>
                    <span className="font-extrabold text-amber-950 font-mono">
                      {member.membership_date || member.date_joined || 'Foundation Member'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Full Legal Name</span>
                    <span className="font-semibold text-slate-900">
                      {member.first_name} {member.middle_name || ''} {member.last_name}
                    </span>
                  </div>
                  {member.national_id && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Ghana Card (National ID)</span>
                      <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        {member.national_id}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Gender</span>
                    <span className="capitalize font-semibold text-slate-900">{member.gender}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Date of Birth</span>
                    <span className="font-semibold text-slate-900">{member.date_of_birth || 'Not recorded'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Marital Status</span>
                    <span className="capitalize font-semibold text-slate-900">
                      {member.marital_status || 'Single'}
                      {member.spouse_name && ` (Spouse: ${member.spouse_name})`}
                    </span>
                  </div>
                  {member.wedding_anniversary && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Wedding Anniversary</span>
                      <span className="font-semibold text-slate-900">{member.wedding_anniversary}</span>
                    </div>
                  )}
                  {member.number_of_children !== undefined && member.number_of_children > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Number of Children</span>
                      <span className="font-semibold text-slate-900">{member.number_of_children}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Nationality & Origin</span>
                    <span className="font-semibold text-slate-900">
                      {member.nationality || 'Ghanaian'}
                      {member.hometown ? ` (${member.hometown}${member.region_of_origin ? `, ${member.region_of_origin}` : ''})` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Occupation</span>
                    <span className="font-semibold text-slate-900">{member.occupation || 'Congregant'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Employer / Business</span>
                    <span className="font-semibold text-slate-900">{member.employer || 'Self-Employed / Not Provided'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Primary Phone</span>
                    <span className="font-mono font-semibold text-slate-900">{member.phone}</span>
                  </div>
                  {member.alternative_phone && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Alternative Phone</span>
                      <span className="font-mono font-semibold text-slate-700">{member.alternative_phone}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Email Address</span>
                    <span className="font-semibold text-slate-900">{member.email || 'None on file'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Residential Address</span>
                    <span className="font-semibold text-slate-900 text-right">{member.residential_address || member.city || 'Accra'}</span>
                  </div>
                  {member.landmark && (
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Nearest Landmark</span>
                      <span className="font-semibold text-slate-800 text-right">{member.landmark}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">GhanaPost GPS Digital Address</span>
                    {member.gps_address ? (
                      <a
                        href={`https://ghanapostgps.com/map/#${member.gps_address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded border border-teal-200 hover:bg-teal-100 transition flex items-center gap-1"
                      >
                        <span>{member.gps_address}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-slate-400">Not Provided</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Emergency Contact & Spiritual Gifts / Talents */}
              <div className="space-y-4">
                {/* Spiritual Gifts & Talents Card */}
                {(member.spiritual_gifts || member.talents_skills || member.previous_church) && (
                  <div className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Ministry Gifts & Talents
                    </h4>
                    <div className="text-xs space-y-2.5">
                      {member.spiritual_gifts && (
                        <div>
                          <span className="text-slate-500 block text-[11px] mb-1 font-semibold">Spiritual Gifts</span>
                          <div className="flex flex-wrap gap-1">
                            {member.spiritual_gifts.split(',').map((g, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-bold">
                                {g.trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {member.talents_skills && (
                        <div>
                          <span className="text-slate-500 block text-[11px] mb-1 font-semibold">Talents & Skills</span>
                          <div className="flex flex-wrap gap-1">
                            {member.talents_skills.split(',').map((t, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-900 text-[10px] font-bold">
                                {t.trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {member.previous_church && (
                        <div className="pt-1 border-t border-slate-200 text-slate-600">
                          <span className="text-slate-400 block text-[10px]">Previous Church Background:</span>
                          <span className="font-semibold text-slate-800">{member.previous_church}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Emergency Contact */}
                <div className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-rose-600" />
                    Emergency Contact Details
                  </h4>
                  <div className="text-xs space-y-2">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Contact Person</span>
                      <span className="font-semibold text-slate-900">{member.emergency_name || 'Not Provided'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Relationship</span>
                      <span className="font-semibold text-slate-900">{member.emergency_relationship || 'Next of Kin'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Emergency Phone</span>
                      {member.emergency_phone ? (
                        <a
                          href={`tel:${member.emergency_phone}`}
                          className="font-mono font-bold text-teal-700 hover:underline"
                        >
                          {member.emergency_phone}
                        </a>
                      ) : (
                        <span className="text-slate-400">Not recorded</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Connected Family Members in Church */}
                <div className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-teal-700" />
                      Family & Household Links ({familyMembers.length})
                    </h4>
                    <span className="text-[10px] text-slate-400">Same Household / Surname</span>
                  </div>

                  {familyMembers.length > 0 ? (
                    <div className="space-y-2">
                      {familyMembers.map((fam) => (
                        <div
                          key={fam.id}
                          className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-xs">
                              {fam.first_name[0]}
                              {fam.last_name[0]}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{fam.first_name} {fam.last_name}</p>
                              <p className="text-[10px] text-slate-500 font-mono">{fam.member_id} • {fam.phone}</p>
                            </div>
                          </div>

                          <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 capitalize">
                            {fam.gender === member.gender ? 'Relative' : fam.gender === 'female' ? 'Spouse / Sister' : 'Spouse / Brother'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      No other family members detected with matching surname or phone in the registry.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ATTENDANCE HISTORY */}
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <h4 className="font-bold text-slate-900">Service Attendance Records</h4>
                  <p className="text-slate-500 text-[11px]">
                    Verified attendance logs for Sunday encounters and midweek services
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleQuickCheckInToday}
                    className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-xs transition flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Check In Today</span>
                  </button>
                  <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200">
                    {memberAttendance.length} Total Check-Ins
                  </span>
                </div>
              </div>

              {memberAttendance.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase">
                      <tr>
                        <th className="p-3">Service Name</th>
                        <th className="p-3">Service Date</th>
                        <th className="p-3">Check-in Method</th>
                        <th className="p-3">Check-in Time</th>
                        <th className="p-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {memberAttendance.map((att) => (
                        <tr key={att.id} className="hover:bg-slate-50/50 transition">
                          <td className="p-3 font-semibold text-slate-900">{att.service_name}</td>
                          <td className="p-3 font-mono text-slate-700">{att.date}</td>
                          <td className="p-3 capitalize text-slate-600">{att.check_in_method}</td>
                          <td className="p-3 font-mono text-slate-500">
                            {att.check_in_time ? new Date(att.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="p-3 text-right">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase">
                              {att.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center p-8 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-600">No attendance check-in records found</p>
                  <p className="text-[11px] text-slate-400">
                    You can check them in right away using the &quot;Check In Today&quot; button above.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FINANCIAL GIVING */}
          {activeTab === 'giving' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <h4 className="font-bold text-slate-900">Giving & Tithe Contributions Ledger</h4>
                  <p className="text-slate-500 text-[11px]">
                    Detailed transaction history of tithes, general offerings, and seeds
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsGivingStatementOpen(true)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold transition flex items-center gap-1.5 shadow-2xs"
                  >
                    <FileText className="w-3.5 h-3.5 text-teal-700" />
                    <span>Annual Giving Statement</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsGivingModalOpen(true)}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Record Contribution</span>
                  </button>
                </div>
              </div>

              {/* Category Breakdown Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Tithes Total</span>
                  <span className="text-base font-black text-emerald-950 font-mono mt-0.5 block">
                    {formatGHS(givingByCategory['Tithe'] || 0)}
                  </span>
                </div>
                <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-teal-800 block">Offerings Total</span>
                  <span className="text-base font-black text-teal-950 font-mono mt-0.5 block">
                    {formatGHS(givingByCategory['Offering'] || 0)}
                  </span>
                </div>
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-amber-800 block">Building Seeds</span>
                  <span className="text-base font-black text-amber-950 font-mono mt-0.5 block">
                    {formatGHS(givingByCategory['Building Fund'] || 0)}
                  </span>
                </div>
                <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-600 block">All Contributions</span>
                  <span className="text-base font-black text-slate-900 font-mono mt-0.5 block">
                    {formatGHS(totalMemberGiving)}
                  </span>
                </div>
              </div>

              {memberGiving.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Channel / Method</th>
                        <th className="p-3">Reference / Tx ID</th>
                        <th className="p-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {memberGiving.map((giv) => (
                        <tr key={giv.id} className="hover:bg-slate-50/50 transition">
                          <td className="p-3 font-mono font-medium text-slate-800">{giv.date}</td>
                          <td className="p-3 font-bold text-slate-900">{giv.category}</td>
                          <td className="p-3 font-bold font-mono text-emerald-700">
                            {formatGHS(giv.amount)}
                          </td>
                          <td className="p-3 capitalize text-slate-600">
                            {giv.payment_channel || giv.payment_method.replace('_', ' ')}
                          </td>
                          <td className="p-3 font-mono text-slate-400 text-[11px]">
                            {giv.reference_number || '—'}
                          </td>
                          <td className="p-3 text-slate-500 max-w-xs truncate">
                            {giv.notes || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center p-8 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <Coins className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-600">No giving records found for this member</p>
                  <p className="text-[11px] text-slate-400">
                    Click &quot;Record Contribution&quot; above to log their first tithe or offering.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PLEDGES */}
          {activeTab === 'pledges' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <h4 className="font-bold text-slate-900">Church Project Pledges & Commitments</h4>
                  <p className="text-slate-500 text-[11px]">
                    Special building fund pledges, church bus commitments, and crusade seeds
                  </p>
                </div>
                <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                  {memberPledges.length} Pledges
                </span>
              </div>

              {memberPledges.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {memberPledges.map((plg) => {
                    const percentFulfilled = plg.amount_pledged > 0
                      ? Math.min(100, Math.round((plg.amount_paid / plg.amount_pledged) * 100))
                      : 0;

                    return (
                      <div
                        key={plg.id}
                        className="p-4 border border-slate-200 rounded-2xl bg-slate-50/60 text-xs space-y-3 shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-sm">{plg.campaign_name}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full uppercase font-bold text-[10px] ${
                              plg.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {plg.status.replace('_', ' ')}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-500">Fulfillment Progress</span>
                            <span className="font-bold text-emerald-800">{percentFulfilled}%</span>
                          </div>
                          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                              style={{ width: `${percentFulfilled}%` }}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-1 border-t border-slate-200">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Pledged</span>
                            <span className="font-bold text-slate-800">{formatGHS(plg.amount_pledged)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Paid</span>
                            <span className="font-bold text-emerald-700">{formatGHS(plg.amount_paid)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Balance</span>
                            <span className="font-bold text-rose-700">{formatGHS(plg.balance)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center p-8 bg-slate-50 rounded-2xl border border-slate-200">
                  <Award className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600">No active pledges on record</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: MINISTRIES & SMALL GROUPS */}
          {activeTab === 'ministries' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="p-5 bg-teal-50/70 rounded-2xl border border-teal-200/80 space-y-3">
                <div className="flex items-center gap-2 text-teal-950 font-bold text-sm">
                  <Users className="w-4 h-4 text-teal-700" />
                  <span>Ministry Fellowship</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Assigned Department:</span>
                    <span className="font-bold text-teal-950 text-sm">
                      {member.ministry_name || ministry?.name || 'General Congregation (Unassigned)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Leadership Role:</span>
                    <span className="font-semibold text-teal-800">
                      {member.leadership_position || 'Active Ministry Member'}
                    </span>
                  </div>
                  {ministry && (
                    <div className="pt-2 border-t border-teal-200/60 text-slate-600">
                      <p>Meeting Times: {ministry.meeting_day || 'Saturdays'} at {ministry.meeting_time || '5:00 PM'}</p>
                      <p className="mt-1">Head of Department: {ministry.leader_name || 'Pastoral Board'}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Heart className="w-4 h-4 text-teal-700" />
                  <span>Cell Fellowship (Small Group)</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Assigned Cell Group:</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {member.small_group_name || smallGroup?.name || 'No Small Group Assigned'}
                    </span>
                  </div>
                  {smallGroup && (
                    <div className="pt-2 border-t border-slate-200 text-slate-600 space-y-1">
                      <p>Cell Leader: <strong>{smallGroup.leader_name}</strong></p>
                      <p>Meeting Day: {smallGroup.meeting_day} at {smallGroup.meeting_time || '6:30 PM'}</p>
                      <p>Location: {smallGroup.meeting_location || smallGroup.meeting_address || 'Church Campus'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: PASTORAL CARE & REMARKS */}
          {activeTab === 'pastoral' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <h4 className="font-bold text-slate-900">Pastoral Care Logs & Administrative Remarks</h4>
                  <p className="text-slate-500 text-[11px]">
                    Home visitations, hospital visits, spiritual counseling, and welfare interventions
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPastoralModalOpen(true)}
                  className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Log Care Visit</span>
                </button>
              </div>

              {/* Bio & Remarks box */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400">Pastoral Notes on Record</span>
                <p className="text-slate-700 leading-relaxed font-sans">
                  {member.notes || 'No administrative notes on record yet.'}
                </p>
              </div>

              {/* Pastoral Care Interactions List */}
              {memberPastoral.length > 0 ? (
                <div className="space-y-3">
                  <h5 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                    Pastoral Care Timeline ({memberPastoral.length})
                  </h5>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white text-xs">
                    {memberPastoral.map((care) => (
                      <div key={care.id} className="p-4 hover:bg-slate-50 transition space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 capitalize text-sm">
                              {care.care_type.replace(/_/g, ' ')}
                            </span>
                            {care.is_confidential && (
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                Confidential
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-slate-500 text-[11px]">{care.date}</span>
                        </div>

                        <p className="text-slate-700 leading-relaxed">{care.notes}</p>

                        <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                          <span>Minister: <strong>{care.pastor_name || care.assigned_pastor}</strong></span>
                          {care.action_items && (
                            <span>• Action: <strong>{care.action_items}</strong></span>
                          )}
                          {care.follow_up_date && (
                            <span>• Next Follow-up: <strong>{care.follow_up_date}</strong></span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center p-8 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <Heart className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-slate-600">No pastoral care visits recorded yet</p>
                  <p className="text-[11px] text-slate-400">
                    Click &quot;+ Log Care Visit&quot; above to log home visitations or spiritual counseling.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Member Modals */}
      <MemberIdCardModal
        isOpen={isIdCardOpen}
        onClose={() => setIsIdCardOpen(false)}
        member={member}
        settings={settings}
      />

      <RecordMemberGivingModal
        isOpen={isGivingModalOpen}
        onClose={() => setIsGivingModalOpen(false)}
        member={member}
      />

      <AddPastoralNoteModal
        isOpen={isPastoralModalOpen}
        onClose={() => setIsPastoralModalOpen(false)}
        member={member}
      />

      <MemberDossierModal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        member={member}
        settings={settings}
        givingRecords={giving}
        attendanceRecords={attendance}
        pledgeRecords={pledges}
      />

      {isGivingStatementOpen && (
        <MemberGivingStatementModal
          member={member}
          givingRecords={giving}
          settings={settings}
          onClose={() => setIsGivingStatementOpen(false)}
        />
      )}
    </div>
  );
};
