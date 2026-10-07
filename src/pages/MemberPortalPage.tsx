import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Church,
  User,
  Wallet,
  Coins,
  CalendarCheck,
  HeartHandshake,
  MessageSquare,
  Shield,
  LogOut,
  QrCode,
  Download,
  Printer,
  Plus,
  CheckCircle2,
  Clock,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  Calendar,
  AlertCircle,
  ChevronRight,
  ExternalLink,
  Edit3,
  Save,
  Lock,
  Eye,
  EyeOff,
  Send,
  Building,
  CreditCard,
  Smartphone,
  Info,
  Users,
  Award,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useToast } from '../contexts/ToastContext';
import { Member, GivingRecord, PledgeRecord, AttendanceRecord, PrayerRequest, PaymentMethod, WelfareClaimCategory } from '../types/database.types';
import { ApplyWelfareClaimModal } from '../components/welfare/ApplyWelfareClaimModal';

type PortalTab =
  | 'overview'
  | 'giving'
  | 'welfare'
  | 'pledges'
  | 'attendance'
  | 'ministry'
  | 'prayers'
  | 'events'
  | 'profile';

export const MemberPortalPage: React.FC = () => {
  const {
    currentMember,
    currentUser,
    currentRole,
    isAuthenticated,
    loginAsMember,
    setPortalMember,
    logout,
  } = useAuth();

  const {
    members,
    giving,
    pledges,
    attendance,
    services,
    ministries,
    smallGroups,
    events,
    prayerRequests,
    pastoralCare,
    welfareContributions,
    welfareClaims,
    recordGiving,
    recordPledgePayment,
    addPrayerRequest,
    addPastoralCare,
    addEventAttendee,
    updateMember,
    settings,
  } = useChurchData();

  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();
  const navigate = useNavigate();

  // Active Tab
  const [activeTab, setActiveTab] = useState<PortalTab>('overview');
  const [isMemberClaimModalOpen, setIsMemberClaimModalOpen] = useState(false);

  // Sign-in Form States (when not yet logged in as a member)
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Staff Preview Mode toggle (only active when staff deliberately opts in)
  const [isStaffPreviewing, setIsStaffPreviewing] = useState(false);
  const [previewMemberId, setPreviewMemberId] = useState<string>('');

  // Selected Member Resolution
  const activeMember: Member | null = useMemo(() => {
    // 1. If explicitly authenticated as a church member
    if (currentMember && currentRole === 'member') {
      return currentMember;
    }
    // 2. If staff is authenticated AND explicitly activated preview mode
    if (isAuthenticated && currentRole !== 'member' && isStaffPreviewing) {
      if (previewMemberId) {
        return members.find((m) => m.id === previewMemberId || m.member_id === previewMemberId) || members[0] || null;
      }
      return members.find((m) => m.member_id === 'GWCC-000002') || members[0] || null;
    }
    // Default: Must sign in with Member ID and PIN
    return null;
  }, [currentMember, currentRole, isAuthenticated, isStaffPreviewing, previewMemberId, members]);

  // Member's Giving Data
  const memberGiving = useMemo(() => {
    if (!activeMember) return [];
    return giving
      .filter(
        (g) =>
          g.member_id === activeMember.id ||
          g.member_id === activeMember.member_id ||
          (g.donor_name &&
            g.donor_name.toLowerCase().includes(activeMember.last_name.toLowerCase()) &&
            g.donor_name.toLowerCase().includes(activeMember.first_name.toLowerCase()))
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeMember, giving]);

  const totalGiven = useMemo(() => {
    return memberGiving.reduce((sum, g) => sum + (Number(g.amount) || 0), 0);
  }, [memberGiving]);

  const titheGiven = useMemo(() => {
    return memberGiving
      .filter((g) => g.category.toLowerCase() === 'tithe')
      .reduce((sum, g) => sum + (Number(g.amount) || 0), 0);
  }, [memberGiving]);

  // Member's Pledges Data
  const memberPledges = useMemo(() => {
    if (!activeMember) return [];
    return pledges.filter(
      (p) =>
        p.member_id === activeMember.id ||
        p.member_id === activeMember.member_id ||
        (p.member_name && p.member_name.toLowerCase().includes(activeMember.last_name.toLowerCase()))
    );
  }, [activeMember, pledges]);

  // Member's Attendance Data
  const memberAttendance = useMemo(() => {
    if (!activeMember) return [];
    return attendance
      .filter(
        (a) =>
          a.member_id === activeMember.id ||
          a.member_id === activeMember.member_id ||
          (a.member_name && a.member_name.toLowerCase().includes(activeMember.last_name.toLowerCase()))
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeMember, attendance]);

  // Member's Prayers
  const memberPrayers = useMemo(() => {
    if (!activeMember) return [];
    return prayerRequests
      .filter(
        (p) =>
          p.member_id === activeMember.id ||
          p.member_id === activeMember.member_id ||
          (p.requester_name && p.requester_name.toLowerCase().includes(activeMember.last_name.toLowerCase()))
      )
      .sort((a, b) => new Date(b.created_at || b.date_submitted).getTime() - new Date(a.created_at || a.date_submitted).getTime());
  }, [activeMember, prayerRequests]);

  // Member's Welfare Data
  const memberWelfareDues = useMemo(() => {
    if (!activeMember) return [];
    return welfareContributions
      .filter((c) => c.member_id === activeMember.id || c.member_id === activeMember.member_id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activeMember, welfareContributions]);

  const totalWelfareContributed = useMemo(() => {
    return memberWelfareDues.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  }, [memberWelfareDues]);

  const memberWelfareClaims = useMemo(() => {
    if (!activeMember) return [];
    return welfareClaims
      .filter((c) => c.member_id === activeMember.id || c.member_id === activeMember.member_id)
      .sort((a, b) => new Date(b.date_submitted).getTime() - new Date(a.date_submitted).getTime());
  }, [activeMember, welfareClaims]);

  // Member's Ministry & Group
  const memberMinistry = useMemo(() => {
    if (!activeMember?.ministry_id) return null;
    return (
      ministries.find(
        (m) => m.id === activeMember.ministry_id || m.name === activeMember.ministry_name
      ) || null
    );
  }, [activeMember, ministries]);

  const memberSmallGroup = useMemo(() => {
    if (!activeMember?.small_group_id) return null;
    return (
      smallGroups.find(
        (g) => g.id === activeMember.small_group_id || g.name === activeMember.small_group_name
      ) || null
    );
  }, [activeMember, smallGroups]);

  // Modal / Action States
  const [giveModalOpen, setGiveModalOpen] = useState(false);
  const [giveCategory, setGiveCategory] = useState<'Tithe' | 'Offering' | 'Building Fund' | 'Thanksgiving' | 'Seed'>('Tithe');
  const [giveAmount, setGiveAmount] = useState('');
  const [giveMethod, setGiveMethod] = useState<PaymentMethod>('mobile_money');
  const [giveChannel, setGiveChannel] = useState('MTN MoMo');
  const [giveReference, setGiveReference] = useState('');
  const [isSubmittingGiving, setIsSubmittingGiving] = useState(false);

  // Prayer Submission Form
  const [prayerTitle, setPrayerTitle] = useState('');
  const [prayerCategory, setPrayerCategory] = useState<'healing' | 'deliverance' | 'family' | 'career' | 'thanksgiving' | 'general'>('healing');
  const [prayerPetition, setPrayerPetition] = useState('');
  const [isSubmittingPrayer, setIsSubmittingPrayer] = useState(false);

  // Counseling Request Form
  const [counselingTopic, setCounselingTopic] = useState('');
  const [counselingDate, setCounselingDate] = useState('');
  const [counselingChannel, setCounselingChannel] = useState<'In-Person (Joma)' | 'Phone Call' | 'WhatsApp Call'>('In-Person (Joma)');
  const [isSubmittingCounseling, setIsSubmittingCounseling] = useState(false);

  // Profile Edit States
  const [editPhone, setEditPhone] = useState(activeMember?.phone || '');
  const [editEmail, setEditEmail] = useState(activeMember?.email || '');
  const [editAddress, setEditAddress] = useState(activeMember?.residential_address || '');
  const [editGps, setEditGps] = useState(activeMember?.gps_address || '');
  const [editEmergencyName, setEditEmergencyName] = useState(activeMember?.emergency_name || '');
  const [editEmergencyPhone, setEditEmergencyPhone] = useState(activeMember?.emergency_phone || '');
  const [newPortalPin, setNewPortalPin] = useState('');
  const [confirmPortalPin, setConfirmPortalPin] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Handle Member Sign-In
  const handleMemberSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!identifier.trim()) {
      setLoginError('Please enter your Member ID, Phone Number, or Email.');
      return;
    }
    if (!pin.trim()) {
      setLoginError('Please enter your 4-digit PIN or password.');
      return;
    }
    setIsSigningIn(true);
    try {
      const res = await loginAsMember(identifier, pin);
      if (res.success) {
        toastSuccess('Member Portal Opened', res.message);
        setActiveTab('overview');
      } else {
        setLoginError(res.message);
      }
    } catch (err: any) {
      setLoginError(err?.message || 'Failed to sign in to Member Portal.');
    } finally {
      setIsSigningIn(false);
    }
  };

  // Demo autofill helper (fills inputs with sample credentials for transparent testing)
  const handleSelectDemoMember = (memberToTest: Member) => {
    const phoneDigits = (memberToTest.phone || '').replace(/[^0-9]/g, '');
    const defaultPin = phoneDigits.slice(-4) || '1234';
    setIdentifier(memberToTest.member_id);
    setPin(defaultPin);
    setLoginError(null);
    toastInfo('Demo Credentials Populated', `Member ID: ${memberToTest.member_id} | Default PIN: ${defaultPin}. Click "Sign In to Member Portal" below.`);
  };

  // Submit Online Tithe/Offering
  const handleRecordGiving = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMember) return;
    const amountVal = parseFloat(giveAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      toastError('Invalid Amount', 'Please specify a valid contribution amount.');
      return;
    }

    setIsSubmittingGiving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const receiptNo = `RCP-${Date.now().toString().slice(-6)}`;

      recordGiving({
        date: today,
        category: giveCategory,
        amount: amountVal,
        payment_method: giveMethod,
        payment_channel: giveChannel,
        reference_number: giveReference || receiptNo,
        member_id: activeMember.id,
        member_name: `${activeMember.first_name} ${activeMember.last_name}`,
        donor_name: `${activeMember.first_name} ${activeMember.last_name}`,
        service_id: 'srv-002', // Sunday Celebration Service
        currency: 'GHS',
        notes: `Submitted via Member Self-Service Portal by ${activeMember.first_name}`,
      });

      toastSuccess(
        'Contribution Recorded',
        `Thank you, ${activeMember.first_name}! GH₵ ${amountVal.toFixed(2)} (${giveCategory.toUpperCase()}) recorded. God richly bless you!`
      );
      setGiveAmount('');
      setGiveReference('');
      setGiveModalOpen(false);
    } catch (err: any) {
      toastError('Error', err?.message || 'Could not record giving.');
    } finally {
      setIsSubmittingGiving(false);
    }
  };

  // Submit Confidential Prayer Request
  const handleSubmitPrayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMember) return;
    if (!prayerTitle.trim() || !prayerPetition.trim()) {
      toastError('Incomplete Request', 'Please enter a title and description for your prayer request.');
      return;
    }

    setIsSubmittingPrayer(true);
    try {
      addPrayerRequest({
        category: prayerCategory,
        request: `${prayerTitle.trim()}: ${prayerPetition.trim()}`,
        requester_name: `${activeMember.first_name} ${activeMember.last_name}`,
        requester_phone: activeMember.phone,
        member_id: activeMember.id,
        status: 'new',
        is_confidential: true,
        assigned_leader: 'Prophet Elisha K. Richard & Pastoral Intercessory Team',
        date_submitted: new Date().toISOString().split('T')[0],
      });

      toastSuccess(
        'Prayer Request Received',
        'Your petition has been submitted directly to Prophet Elisha K. Richard and the ministerial council. We stand in agreement with you in faith!'
      );
      setPrayerTitle('');
      setPrayerPetition('');
    } catch (err: any) {
      toastError('Error', err?.message || 'Failed to submit prayer request.');
    } finally {
      setIsSubmittingPrayer(false);
    }
  };

  // Request Pastoral Counseling
  const handleRequestCounseling = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMember) return;
    if (!counselingTopic.trim()) {
      toastError('Incomplete Request', 'Please describe the counseling or pastoral visitation request.');
      return;
    }

    setIsSubmittingCounseling(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      addPastoralCare({
        date: counselingDate || today,
        care_type: 'counseling',
        member_id: activeMember.id,
        member_name: `${activeMember.first_name} ${activeMember.last_name}`,
        member_phone: activeMember.phone,
        pastor_name: 'Prophet Elisha K. Richard / Pastoral Care Team',
        notes: `Member Request: ${counselingTopic.trim()} (Preferred Channel: ${counselingChannel})`,
        follow_up_date: counselingDate || today,
        is_confidential: true,
      });

      toastSuccess(
        'Pastoral Request Dispatched',
        'Your pastoral counseling request has been logged. The pastoral secretariat will reach out to you shortly.'
      );
      setCounselingTopic('');
      setCounselingDate('');
    } catch (err: any) {
      toastError('Error', err?.message || 'Failed to request counseling.');
    } finally {
      setIsSubmittingCounseling(false);
    }
  };

  // Save Member Profile Changes
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMember) return;

    if (newPortalPin && newPortalPin !== confirmPortalPin) {
      toastError('PIN Mismatch', 'New portal PIN and confirmation PIN do not match.');
      return;
    }

    setIsSavingProfile(true);
    try {
      updateMember(activeMember.id, {
        phone: editPhone.trim() || activeMember.phone,
        email: editEmail.trim() || activeMember.email,
        residential_address: editAddress.trim() || activeMember.residential_address,
        gps_address: editGps.trim() || activeMember.gps_address,
        emergency_name: editEmergencyName.trim() || activeMember.emergency_name,
        emergency_phone: editEmergencyPhone.trim() || activeMember.emergency_phone,
      });

      if (newPortalPin) {
        try {
          const savedPins = localStorage.getItem('gwcc_member_passwords');
          const pinsMap: Record<string, string> = savedPins ? JSON.parse(savedPins) : {};
          pinsMap[activeMember.id] = newPortalPin.trim();
          pinsMap[activeMember.member_id] = newPortalPin.trim();
          localStorage.setItem('gwcc_member_passwords', JSON.stringify(pinsMap));
          toastSuccess('Portal PIN Updated', 'Your Member Portal PIN has been securely saved.');
          setNewPortalPin('');
          setConfirmPortalPin('');
        } catch (e) {
          console.warn('PIN save notice:', e);
        }
      }

      toastSuccess('Profile Updated', 'Your church membership records have been updated.');
    } catch (err: any) {
      toastError('Error', err?.message || 'Could not update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Print Statement Function
  const handlePrintStatement = () => {
    window.print();
  };

  // IF NOT AUTHENTICATED AS A MEMBER AND NO ACTIVE MEMBER (e.g. Guest on Portal URL)
  if (!activeMember) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
        <div className="max-w-md w-full bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          {/* Logo & Header */}
          <div className="text-center space-y-2 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-white p-2 mx-auto flex items-center justify-center shadow-lg border border-emerald-500/40">
              <img
                src={settings.logo_url || '/assets/logo.png'}
                alt="GWCC Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">
              {settings.church_name}
            </h1>
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Member Self-Service Portal
            </p>
            <p className="text-[11px] text-slate-400">
              Sign in with your Member ID, registered phone number, or email and your 4-digit PIN.
            </p>
          </div>

          {/* If a staff/admin user is browsing this page */}
          {isAuthenticated && currentRole !== 'member' && (
            <div className="mb-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <p className="font-bold text-amber-300">Staff Account Active</p>
                    <p className="text-[10px] text-amber-200/80">
                      Logged in as {currentUser.first_name} ({currentUser.role.replace('_', ' ')}).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsStaffPreviewing(true);
                    setPreviewMemberId(members[0]?.id || '');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold text-[11px] transition shrink-0 shadow-xs"
                >
                  Open Staff Preview
                </button>
              </div>
            </div>
          )}

          {loginError && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{loginError}</span>
            </div>
          )}

          {/* Member Sign-in Form */}
          <form onSubmit={handleMemberSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Member ID, Phone, or Email <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. GWCC-000002 or 0208765432"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-300">
                  Password or 4-Digit PIN <span className="text-red-400">*</span>
                </label>
                <span className="text-[10px] text-emerald-400 font-medium">Default: Phone last 4 digits</span>
              </div>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  required
                  placeholder="Enter 4-digit PIN (e.g. 5432)"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-200"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-[11px] text-slate-300 flex items-start gap-2">
              <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>First-time PIN:</strong> Your default PIN is the <strong>last 4 digits of your registered phone number</strong>. You can change your PIN at any time inside your portal profile.
              </span>
            </div>

            <button
              type="submit"
              disabled={isSigningIn}
              className="w-full py-3 bg-[#064e3b] hover:bg-[#047857] text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 disabled:opacity-50"
            >
              <Church className="w-4 h-4" />
              <span>{isSigningIn ? 'Verifying Member...' : 'Sign In to Member Portal'}</span>
            </button>
          </form>

          {/* Quick Member Accounts for Testing */}
          <div className="mt-6 pt-5 border-t border-slate-700/80">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Demo Accounts (Click to Fill ID & PIN)
              </p>
              <span className="text-[10px] text-slate-500">Includes default PIN</span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {members.slice(0, 4).map((m) => {
                const phoneDigits = (m.phone || '').replace(/[^0-9]/g, '');
                const defaultPin = phoneDigits.slice(-4) || '1234';
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectDemoMember(m)}
                    className="w-full p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-700/60 border border-slate-700/50 flex items-center justify-between text-left text-xs transition group"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-7 h-7 rounded-full bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 flex items-center justify-center font-bold text-[11px] shrink-0">
                        {m.first_name[0]}
                      </div>
                      <div className="truncate">
                        <p className="font-bold text-slate-200 truncate">
                          {m.first_name} {m.last_name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          ID: <span className="text-emerald-400">{m.member_id}</span> • PIN: <span className="text-amber-400">{defaultPin}</span>
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-semibold group-hover:underline shrink-0">
                      Use & Test
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Navigation */}
          <div className="mt-6 pt-4 border-t border-slate-700/80 text-center text-xs">
            <Link
              to="/login"
              className="text-slate-400 hover:text-emerald-400 transition inline-flex items-center gap-1"
            >
              <span>Are you Church Staff or Pastor? Go to Staff Login</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // AUTHENTICATED MEMBER PORTAL VIEW
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 antialiased">
      {/* Top Banner: Staff Preview Mode (If logged in as administrator/pastor) */}
      {currentRole !== 'member' && isStaffPreviewing && (
        <div className="bg-amber-600 text-white px-4 py-2 text-xs flex flex-col sm:flex-row items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 shrink-0" />
            <span>
              <strong>Staff Administration Preview:</strong> Auditing Member Portal as{' '}
              <strong>{activeMember.first_name} {activeMember.last_name} ({activeMember.member_id})</strong>.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={activeMember.id}
              onChange={(e) => {
                const target = members.find((m) => m.id === e.target.value);
                if (target) {
                  setPreviewMemberId(target.id);
                  setPortalMember(target);
                }
              }}
              className="bg-amber-700 text-white text-[11px] font-semibold rounded-lg px-2 py-1 border border-amber-500 focus:outline-none"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.member_id} — {m.first_name} {m.last_name}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                setIsStaffPreviewing(false);
                setPreviewMemberId('');
              }}
              className="px-2.5 py-1 bg-amber-800 text-white border border-amber-400 rounded-lg text-[11px] font-bold hover:bg-amber-900 transition shadow-2xs"
            >
              Exit Preview
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-2.5 py-1 bg-white text-amber-900 rounded-lg text-[11px] font-bold hover:bg-amber-50 transition shadow-2xs"
            >
              Back to Admin Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Main Navigation Header */}
      <header className="sticky top-0 z-30 bg-[#064e3b] text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand Logo & Name */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 shadow-md">
                <img
                  src={settings.logo_url || '/assets/logo.png'}
                  alt="GWCC"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm sm:text-base tracking-wide text-white">
                    {settings.short_name}
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-700/80 text-emerald-200 border border-emerald-500/40">
                    Member Portal
                  </span>
                </div>
                <p className="text-[10px] text-emerald-200/90 hidden sm:block">
                  {settings.branch_name} • Senior Pastor: {settings.senior_pastor}
                </p>
              </div>
            </div>

            {/* Member Profile Badge & Sign Out */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-emerald-900/60 border border-emerald-700/60 rounded-full py-1 px-3">
                {activeMember.profile_photo_url ? (
                  <img
                    src={activeMember.profile_photo_url}
                    alt={activeMember.first_name}
                    className="w-7 h-7 rounded-full object-cover border border-emerald-400"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-emerald-800 text-white font-bold text-xs flex items-center justify-center">
                    {activeMember.first_name[0]}
                  </div>
                )}
                <div className="text-left hidden sm:block">
                  <p className="font-bold text-xs leading-none text-white">
                    {activeMember.first_name} {activeMember.last_name}
                  </p>
                  <p className="text-[10px] text-emerald-300 font-mono mt-0.5">
                    {activeMember.member_id}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  setIsStaffPreviewing(false);
                  setPreviewMemberId('');
                  await logout();
                  toastSuccess('Signed Out', 'You have been signed out of your Member Portal.');
                  navigate('/portal');
                }}
                className="p-2 rounded-xl bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 hover:text-white transition"
                title="Sign Out of Member Portal"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="bg-[#053d2e] border-t border-emerald-800/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-1 overflow-x-auto py-2 scrollbar-none text-xs font-semibold">
              {[
                { id: 'overview', label: 'My Dashboard', icon: Church },
                { id: 'giving', label: 'Tithes & Giving', icon: Wallet },
                { id: 'welfare', label: 'Welfare & Relief', icon: HeartHandshake },
                { id: 'pledges', label: 'My Pledges', icon: Coins },
                { id: 'attendance', label: 'Attendance & Pass', icon: CalendarCheck },
                { id: 'ministry', label: 'Ministry & Cell', icon: Users },
                { id: 'prayers', label: 'Prayers & Pastoral', icon: HeartHandshake },
                { id: 'events', label: 'Church Events', icon: Calendar },
                { id: 'profile', label: 'My Profile & PIN', icon: User },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as PortalTab)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                      isActive
                        ? 'bg-white text-emerald-950 font-bold shadow-xs'
                        : 'text-emerald-100 hover:bg-emerald-800/60 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* TAB 1: OVERVIEW & DASHBOARD */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Welcome Exhortation & Theme */}
            <div className="bg-gradient-to-r from-emerald-900 via-[#064e3b] to-teal-900 text-white rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden border border-emerald-700/40">
              <div className="relative z-10 max-w-3xl space-y-2">
                <span className="px-3 py-1 rounded-full bg-emerald-800/80 text-emerald-200 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/30 inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  Greater Works City Church • Theme of the Season
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Welcome, Beloved {activeMember.first_name}!
                </h2>
                <blockquote className="text-sm italic text-emerald-100 border-l-2 border-amber-400 pl-3 leading-relaxed mt-2">
                  "Very truly I tell you, whoever believes in me will do the works I have been doing, and they will do even greater things than these, because I am going to the Father."
                </blockquote>
                <p className="text-xs text-amber-300 font-bold pl-3">
                  — John 14:12 • Prophet Elisha K. Richard, Senior Pastor
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-emerald-700/50 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-300" />
                  <span>Next Gathering: <strong>Sunday First Service (07:00 AM)</strong> & <strong>Celebration Service (10:00 AM)</strong></span>
                </div>
                <button
                  type="button"
                  onClick={() => setGiveModalOpen(true)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm"
                >
                  <Wallet className="w-4 h-4" />
                  <span>Give Online / Tithe (GH₵)</span>
                </button>
              </div>
            </div>

            {/* Quick Stat Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Total Giving (YTD)</span>
                  <Wallet className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-extrabold text-slate-900">
                  GH₵ {totalGiven.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-emerald-700 font-semibold">
                  Tithes: GH₵ {titheGiven.toFixed(2)}
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Services Attended</span>
                  <CalendarCheck className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-2xl font-extrabold text-slate-900">
                  {memberAttendance.length}
                </p>
                <p className="text-[11px] text-blue-700 font-semibold">
                  Consistent Attendance Streak
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Assigned Ministry</span>
                  <Users className="w-4 h-4 text-purple-600" />
                </div>
                <p className="text-sm font-bold text-slate-900 truncate" title={activeMember.ministry_name || 'Congregant'}>
                  {activeMember.ministry_name?.split('(')[0] || 'General Assembly'}
                </p>
                <p className="text-[11px] text-purple-700 font-semibold truncate">
                  {activeMember.leadership_position || 'Active Department Member'}
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Pledges Committed</span>
                  <Coins className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-2xl font-extrabold text-slate-900">
                  {memberPledges.length}
                </p>
                <p className="text-[11px] text-amber-700 font-semibold">
                  Building & Mission Campaigns
                </p>
              </div>
            </div>

            {/* Digital Membership ID Card + Spiritual Milestones */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Digital Membership Card */}
              <div className="lg:col-span-1">
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white p-6 rounded-3xl shadow-xl border border-emerald-500/30 space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-white p-1 flex items-center justify-center">
                        <img
                          src={settings.logo_url || '/assets/logo.png'}
                          alt="GWCC"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div>
                        <p className="font-extrabold text-xs tracking-wider text-emerald-400 uppercase">GWCC Joma</p>
                        <p className="text-[10px] text-slate-300">Official Membership ID</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      ACTIVE
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    {activeMember.profile_photo_url ? (
                      <img
                        src={activeMember.profile_photo_url}
                        alt={activeMember.first_name}
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-400 shadow-md"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-emerald-800 border-2 border-emerald-400 flex items-center justify-center font-bold text-xl text-white">
                        {activeMember.first_name[0]}
                      </div>
                    )}
                    <div>
                      <h3 className="font-extrabold text-base text-white">
                        {activeMember.first_name} {activeMember.last_name}
                      </h3>
                      <p className="text-xs text-amber-300 font-mono font-bold">
                        {activeMember.member_id}
                      </p>
                      {activeMember.tithe_number && (
                        <p className="text-[11px] text-slate-300">
                          Tithe No: <strong className="text-white">{activeMember.tithe_number}</strong>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="bg-black/30 p-3 rounded-2xl border border-white/10 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Self-Check-In Pass</p>
                      <p className="text-xs text-emerald-300 font-bold">Scan at Church Kiosk</p>
                    </div>
                    {/* QR Code Graphic */}
                    <div className="w-14 h-14 bg-white p-1 rounded-xl shrink-0 flex items-center justify-center">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(
                          activeMember.member_id
                        )}`}
                        alt="QR Code Pass"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-700/60">
                    <span>Joined: {activeMember.membership_date || 'Jan 2022'}</span>
                    <span>Accra, Ghana</span>
                  </div>
                </div>
              </div>

              {/* Spiritual Milestones & Church Affiliations */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Award className="w-4 h-4 text-emerald-700" />
                    Spiritual Journey & Milestones
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">Water Baptism</span>
                        <CheckCircle2 className={`w-4 h-4 ${activeMember.baptism_status ? 'text-emerald-600' : 'text-slate-300'}`} />
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {activeMember.baptism_status
                          ? `Baptized in water (${activeMember.baptism_date || 'Completed'})`
                          : 'Pending Water Baptism Class'}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">Salvation Milestone</span>
                        <CheckCircle2 className={`w-4 h-4 ${activeMember.salvation_status ? 'text-emerald-600' : 'text-slate-300'}`} />
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {activeMember.salvation_status ? 'Born Again Believer in Christ' : 'Inquirer / Seeker'}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">Membership Class</span>
                        <CheckCircle2 className={`w-4 h-4 ${activeMember.membership_class_completed ? 'text-emerald-600' : 'text-slate-300'}`} />
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {activeMember.membership_class_completed ? 'Class Completed & Certified' : 'In Progress'}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">Holy Spirit Baptism</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </div>
                      <p className="text-[11px] text-slate-500">Spirit-Filled with Evidence</p>
                    </div>
                  </div>
                </div>

                {/* Assigned Fellowship & Ministry Details */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-700" />
                    My Church Life & Fellowship
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-1.5">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                        My Ministry Department
                      </span>
                      <p className="font-bold text-slate-900 text-sm">
                        {activeMember.ministry_name || 'Voice of Dominion (Choir)'}
                      </p>
                      <p className="text-slate-600 text-[11px]">
                        Leader: <strong>{memberMinistry?.leader_name || 'Minister Kwadwo Boateng'}</strong>
                      </p>
                      <p className="text-slate-500 text-[11px]">
                        Meeting Schedule: <strong>Saturdays 4:00 PM (Sanctuary)</strong>
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-1.5">
                      <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">
                        My Small Group / Cell Hub
                      </span>
                      <p className="font-bold text-slate-900 text-sm">
                        {activeMember.small_group_name || 'Ablekuma Central Cell'}
                      </p>
                      <p className="text-slate-600 text-[11px]">
                        Cell Leader: <strong>{memberSmallGroup?.leader_name || 'Elder Kenneth Asare'}</strong>
                      </p>
                      <p className="text-slate-500 text-[11px]">
                        Meeting Schedule: <strong>Tuesdays 6:30 PM</strong>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GIVING & TITHES */}
        {activeTab === 'giving' && (
          <div className="space-y-6">
            {/* Header + Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-700" />
                  My Tithes & Giving Records
                </h2>
                <p className="text-xs text-slate-500">
                  Your personal, confidential giving ledger for Greater Works City Church.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintStatement}
                  className="px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Print Statement</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGiveModalOpen(true)}
                  className="px-4 py-2 bg-[#064e3b] hover:bg-[#047857] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Give Online / Tithe</span>
                </button>
              </div>
            </div>

            {/* Giving Breakdown Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500">Total Giving (All Time)</span>
                <p className="text-2xl font-black text-emerald-800 mt-1">
                  GH₵ {totalGiven.toFixed(2)}
                </p>
                <span className="text-[10px] text-slate-400">{memberGiving.length} Total Contributions</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500">Tithes (Malachi 3:10)</span>
                <p className="text-2xl font-black text-indigo-800 mt-1">
                  GH₵ {titheGiven.toFixed(2)}
                </p>
                <span className="text-[10px] text-slate-400">Faithful Covenant Stewardship</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500">Official Tithe Number</span>
                <p className="text-2xl font-mono font-black text-slate-900 mt-1">
                  {activeMember.tithe_number || 'T-PENDING'}
                </p>
                <span className="text-[10px] text-slate-400">Registered to {activeMember.first_name} {activeMember.last_name}</span>
              </div>
            </div>

            {/* Giving History Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900">Personal Contribution Ledger</h3>
                <span className="text-xs text-slate-500 font-mono">Currency: Ghana Cedi (GH₵)</span>
              </div>

              {memberGiving.length === 0 ? (
                <div className="p-12 text-center text-slate-500 space-y-2">
                  <Wallet className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700">No giving records found yet</p>
                  <p className="text-xs">Click "Give Online / Tithe" to record your tithe or offering.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-[10px] font-bold">
                      <tr>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Channel / Method</th>
                        <th className="py-3 px-4">Reference No.</th>
                        <th className="py-3 px-4 text-right">Amount (GH₵)</th>
                        <th className="py-3 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {memberGiving.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 font-mono text-slate-700">{rec.date}</td>
                          <td className="py-3 px-4">
                            <span className="capitalize font-semibold text-slate-800 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px]">
                              {rec.category.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {rec.payment_channel || rec.payment_method?.replace('_', ' ')}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                            {rec.reference_number || '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-800">
                            GH₵ {Number(rec.amount).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Recorded
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Official Church Giving Channels Info */}
            <div className="bg-gradient-to-r from-slate-900 to-emerald-950 text-white p-6 rounded-3xl border border-emerald-500/30 space-y-4">
              <h3 className="font-extrabold text-sm text-emerald-300 flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Greater Works City Church Official Mobile Money Giving Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-white/10 p-3.5 rounded-2xl border border-white/10">
                  <p className="text-[10px] text-amber-300 uppercase font-bold">MTN Mobile Money</p>
                  <p className="text-base font-black text-white mt-1">024 456 7890</p>
                  <p className="text-[11px] text-slate-300">Name: Greater Works City Church</p>
                  <p className="text-[10px] text-slate-400 mt-1">Ref: {activeMember.member_id} (Tithe/Offering)</p>
                </div>
                <div className="bg-white/10 p-3.5 rounded-2xl border border-white/10">
                  <p className="text-[10px] text-red-300 uppercase font-bold">Telecel Cash</p>
                  <p className="text-base font-black text-white mt-1">020 876 5432</p>
                  <p className="text-[11px] text-slate-300">Name: Greater Works City Church</p>
                  <p className="text-[10px] text-slate-400 mt-1">Ref: {activeMember.member_id}</p>
                </div>
                <div className="bg-white/10 p-3.5 rounded-2xl border border-white/10">
                  <p className="text-[10px] text-blue-300 uppercase font-bold">GCB Bank Cathedral Account</p>
                  <p className="text-base font-black text-white mt-1">1041130009821</p>
                  <p className="text-[11px] text-slate-300">Branch: Ablekuma/Joma</p>
                  <p className="text-[10px] text-slate-400 mt-1">Swift: GCBGHAC</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: WELFARE & BENEVOLENCE */}
        {activeTab === 'welfare' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <HeartHandshake className="w-5 h-5 text-emerald-700" />
                  My Welfare Dues & Benevolence Care
                </h2>
                <p className="text-xs text-slate-500">
                  Track your monthly welfare contributions and manage your pastoral relief requests.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsMemberClaimModalOpen(true)}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Request Benevolence Assistance</span>
              </button>
            </div>

            {/* Welfare Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Total Welfare Dues Paid
                </span>
                <div className="text-2xl font-black text-emerald-800 mt-1">
                  GH₵ {totalWelfareContributed.toFixed(2)}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {memberWelfareDues.length} recorded monthly receipts
                </p>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Mutual Fund Standing
                </span>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {memberWelfareDues.length >= 2 ? (
                    <span className="text-emerald-700">Good Standing</span>
                  ) : (
                    <span className="text-amber-700">Pending Dues</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Standard dues: GH₵ 50 / month</p>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  My Benevolence Applications
                </span>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {memberWelfareClaims.length}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Submitted pastoral claims</p>
              </div>
            </div>

            {/* Benevolence Claims Section */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900">My Benevolence Aid Applications</h3>
                <span className="text-[11px] text-slate-500">Confidential pastoral review</span>
              </div>

              {memberWelfareClaims.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  You have not submitted any benevolence assistance claims.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Claim Ref</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Title / Purpose</th>
                        <th className="py-3 px-4 text-right">Requested</th>
                        <th className="py-3 px-4 text-right">Approved</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {memberWelfareClaims.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">{c.claim_number}</td>
                          <td className="py-3 px-4 capitalize text-slate-700">{c.category.replace('_', ' ')}</td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{c.title}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                            GH₵ {c.amount_requested.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800">
                            {c.amount_approved ? `GH₵ ${c.amount_approved.toFixed(2)}` : '—'}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`font-semibold text-[10px] uppercase px-2 py-0.5 rounded-lg border ${
                                c.status === 'disbursed'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : c.status === 'approved'
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : c.status === 'declined'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              {c.status.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Dues History Section */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900">My Welfare Dues Receipts</h3>
                <span className="text-[11px] text-slate-500">Official church records</span>
              </div>

              {memberWelfareDues.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No welfare dues contributions recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Month Applicable</th>
                        <th className="py-3 px-4">Receipt Ref</th>
                        <th className="py-3 px-4">Payment Method</th>
                        <th className="py-3 px-4 text-right">Amount (GH₵)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {memberWelfareDues.map((due) => (
                        <tr key={due.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 text-slate-600">{due.date}</td>
                          <td className="py-3 px-4 font-bold text-slate-800">{due.month}</td>
                          <td className="py-3 px-4 font-mono text-slate-500">{due.reference_no || '—'}</td>
                          <td className="py-3 px-4 text-slate-700">{due.payment_channel || due.payment_method}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800">
                            GH₵ {due.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: PLEDGES */}
        {activeTab === 'pledges' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-700" />
                  My Pledge Commitments & Campaigns
                </h2>
                <p className="text-xs text-slate-500">
                  Track your voluntary covenants for cathedral building and church development projects.
                </p>
              </div>
            </div>

            {memberPledges.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-xs text-center text-slate-500 space-y-3">
                <Coins className="w-12 h-12 mx-auto text-slate-300" />
                <h3 className="font-bold text-slate-800 text-base">No Active Pledges Found</h3>
                <p className="text-xs max-w-md mx-auto">
                  You do not currently have any outstanding building or harvest pledge records under your member profile.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {memberPledges.map((pl) => {
                  const pledged = Number(pl.amount_pledged) || 0;
                  const paid = Number(pl.amount_paid) || 0;
                  const balance = Math.max(0, pledged - paid);
                  const percent = pledged > 0 ? Math.min(100, Math.round((paid / pledged) * 100)) : 0;
                  return (
                    <div key={pl.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200">
                          {pl.campaign_name || 'Cathedral Building Fund'}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            balance <= 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {balance <= 0 ? 'Completed' : 'Active'}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-baseline justify-between">
                          <span className="text-2xl font-black text-slate-900">
                            GH₵ {paid.toFixed(2)}
                          </span>
                          <span className="text-xs text-slate-500 font-semibold">
                            Pledged: GH₵ {pledged.toFixed(2)}
                          </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-600 to-teal-600 rounded-full transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                          <span>{percent}% Redeemed</span>
                          <span className="font-bold text-slate-800">
                            Remaining: GH₵ {balance.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {balance > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setGiveCategory('Building Fund');
                            setGiveAmount(balance.toString());
                            setGiveReference(`PLEDGE-${pl.id}`);
                            setGiveModalOpen(true);
                          }}
                          className="w-full py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <Coins className="w-3.5 h-3.5" />
                          <span>Pay Toward This Pledge (GH₵)</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ATTENDANCE & PASS */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-blue-700" />
                  My Church Attendance & Self-Check-in Pass
                </h2>
                <p className="text-xs text-slate-500">
                  Your personal attendance record across Sunday, Midweek, and All-Night gatherings.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-800 text-xs font-bold border border-blue-200">
                  {memberAttendance.length} Recorded Services
                </span>
              </div>
            </div>

            {/* Attendance QR Pass Card */}
            <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white p-6 sm:p-8 rounded-3xl border border-blue-500/30 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-md">
              <div className="space-y-2 text-center sm:text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 px-2 py-0.5 rounded bg-blue-900/60 border border-blue-500/30 inline-block">
                  Sunday Morning Check-In Pass
                </span>
                <h3 className="text-xl font-extrabold text-white">
                  Quick Attendance Scanner
                </h3>
                <p className="text-xs text-slate-300 max-w-md">
                  Present this digital QR pass to the church attendance kiosk or ushers at the sanctuary entrance for instant check-in.
                </p>
                <p className="text-xs font-mono font-bold text-amber-300 pt-1">
                  ID: {activeMember.member_id} • {activeMember.first_name} {activeMember.last_name}
                </p>
              </div>

              <div className="w-32 h-32 bg-white p-2 rounded-2xl shrink-0 flex items-center justify-center shadow-xl">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                    activeMember.member_id
                  )}`}
                  alt="Attendance Pass"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Attendance History */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200">
                <h3 className="font-bold text-sm text-slate-900">Attendance Log History</h3>
              </div>

              {memberAttendance.length === 0 ? (
                <div className="p-10 text-center text-slate-500 text-xs">
                  No attendance records logged yet for this member.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-[10px] font-bold">
                      <tr>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Service</th>
                        <th className="py-3 px-4">Method</th>
                        <th className="py-3 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {memberAttendance.map((att) => {
                        const srv = services.find((s) => s.id === att.service_id);
                        return (
                          <tr key={att.id} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-4 font-mono text-slate-700">{att.date}</td>
                            <td className="py-3 px-4 font-semibold text-slate-900">
                              {srv?.name || 'Sunday Celebration Worship Service'}
                            </td>
                            <td className="py-3 px-4 text-slate-600 capitalize">
                              {att.check_in_method?.replace('_', ' ') || 'Kiosk Scanner'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Present
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: MINISTRY & CELL GROUP */}
        {activeTab === 'ministry' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-700" />
                My Ministry & Small Group Cell Fellowship
              </h2>
              <p className="text-xs text-slate-500">
                Department schedules, fellowship hubs, and ministerial leadership information.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Ministry Department Card */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900 bg-purple-50 px-3 py-1 rounded-xl border border-purple-200">
                    Ministry Department
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">Active Member</span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-extrabold text-slate-900">
                    {activeMember.ministry_name || 'Voice of Dominion (Choir & Worship)'}
                  </h3>
                  <p className="text-xs text-purple-800 font-semibold">
                    Role: {activeMember.leadership_position || 'Department Member'}
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                  <p>
                    <strong>Leader:</strong> {memberMinistry?.leader_name || 'Minister Kwadwo Boateng'}
                  </p>
                  <p>
                    <strong>Assistant:</strong> {memberMinistry?.assistant_leader_name || 'Sister Gifty Annan'}
                  </p>
                  <p>
                    <strong>Rehearsal / Meeting:</strong> Saturdays 4:00 PM – 6:30 PM (Sanctuary)
                  </p>
                  <p>
                    <strong>Description:</strong> {memberMinistry?.description || 'Leads the congregation in Spirit-filled praise, adoration, and classical choral anthems.'}
                  </p>
                </div>
              </div>

              {/* Small Group Fellowship Hub Card */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 bg-blue-50 px-3 py-1 rounded-xl border border-blue-200">
                    Home Cell Fellowship Hub
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">Weekly Fellowship</span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-extrabold text-slate-900">
                    {activeMember.small_group_name || 'Ablekuma Central Cell'}
                  </h3>
                  <p className="text-xs text-blue-800 font-semibold">
                    Zone: Joma & Surrounding Enclaves
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                  <p>
                    <strong>Cell Leader:</strong> {memberSmallGroup?.leader_name || 'Elder Kenneth Asare'}
                  </p>
                  <p>
                    <strong>Meeting Day:</strong> Tuesdays 6:30 PM – 8:00 PM
                  </p>
                  <p>
                    <strong>Location:</strong> {memberSmallGroup?.meeting_location || 'Ablekuma Central, Near Police Post'}
                  </p>
                  <p>
                    <strong>Focus:</strong> Biblical fellowship, prayer for families, evangelism, and community care.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: PRAYERS & PASTORAL CARE */}
        {activeTab === 'prayers' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <HeartHandshake className="w-5 h-5 text-emerald-700" />
                Prayer Petitions & Pastoral Counseling
              </h2>
              <p className="text-xs text-slate-500">
                Submit confidential prayer requests directly to Prophet Elisha K. Richard and the church intercessory council.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Prayer Petition Submission Form */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-600" />
                  Submit Confidential Prayer Request
                </h3>

                <form onSubmit={handleSubmitPrayer} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Prayer Petition Title
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Breakthrough in Career, Divine Healing, Family Deliverance"
                      value={prayerTitle}
                      onChange={(e) => setPrayerTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Category
                    </label>
                    <select
                      value={prayerCategory}
                      onChange={(e) => setPrayerCategory(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      <option value="healing">Divine Healing & Health</option>
                      <option value="deliverance">Spiritual Warfare & Deliverance</option>
                      <option value="family">Family, Marriage & Children</option>
                      <option value="career">Career, Business & Financial Breakthrough</option>
                      <option value="thanksgiving">Praise Testimony & Thanksgiving</option>
                      <option value="general">General Intercession</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Describe Your Prayer Request
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Share your prayer petition in confidence. Prophet Elisha and the ministerial prayer band will pray over your request."
                      value={prayerPetition}
                      onChange={(e) => setPrayerPetition(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Your request is kept strictly confidential between you and the senior pastoral council.</span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingPrayer}
                    className="w-full py-2.5 bg-[#064e3b] hover:bg-[#047857] text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmittingPrayer ? 'Submitting...' : 'Submit Prayer Request to Prophet Elisha'}</span>
                  </button>
                </form>
              </div>

              {/* Pastoral Counseling Request Form */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Request Pastoral Counseling / Appointment
                </h3>

                <form onSubmit={handleRequestCounseling} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Topic / Reason for Counseling
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Marital guidance, Spiritual direction, Welfare consultation"
                      value={counselingTopic}
                      onChange={(e) => setCounselingTopic(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Preferred Date
                    </label>
                    <input
                      type="date"
                      value={counselingDate}
                      onChange={(e) => setCounselingDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Preferred Channel
                    </label>
                    <select
                      value={counselingChannel}
                      onChange={(e) => setCounselingChannel(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="In-Person (Joma)">In-Person at Cathedral Office (Joma)</option>
                      <option value="Phone Call">Direct Phone Call</option>
                      <option value="WhatsApp Call">WhatsApp Voice/Video Call</option>
                    </select>
                  </div>

                  <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px] flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-700 shrink-0" />
                    <span>The pastoral secretariat will contact you at {activeMember.phone} to confirm the appointment.</span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingCounseling}
                    className="w-full py-2.5 bg-blue-800 hover:bg-blue-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{isSubmittingCounseling ? 'Dispatching...' : 'Request Pastoral Appointment'}</span>
                  </button>
                </form>
              </div>
            </div>

            {/* My Past Prayer Petitions History */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200">
                <h3 className="font-bold text-sm text-slate-900">My Prayer Requests History</h3>
              </div>

              {memberPrayers.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  You have not submitted any prayer requests yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {memberPrayers.map((pr) => (
                    <div key={pr.id} className="p-4 sm:p-5 hover:bg-slate-50 transition space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                          {pr.category} Petition
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            pr.status === 'answered'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {pr.status === 'answered' ? 'Answered Testimony' : 'In Pastoral Prayer'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{pr.request}</p>
                      <p className="text-[10px] text-slate-400 font-mono pt-1">
                        Submitted: {pr.date_submitted || (pr.created_at ? new Date(pr.created_at).toLocaleDateString() : 'Recent')} • Assigned: {pr.assigned_leader || 'Prophet Elisha K. Richard'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 7: CHURCH EVENTS */}
        {activeTab === 'events' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-700" />
                Upcoming Greater Works Church Events
              </h2>
              <p className="text-xs text-slate-500">
                Special conventions, youth revivals, all-night vigils, and church celebrations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map((ev) => {
                const isRsvp = ev.attendees?.some(
                  (a) =>
                    a.member_id === activeMember.id ||
                    a.member_id === activeMember.member_id ||
                    a.name.toLowerCase().includes(activeMember.last_name.toLowerCase())
                );

                return (
                  <div key={ev.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
                        {ev.event_type.replace('_', ' ') || 'Special Gathering'}
                      </span>
                      <span className="text-xs text-slate-500 font-mono font-semibold">
                        {ev.start_date}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-base text-slate-900">
                      {ev.title}
                    </h3>
                    <p className="text-xs text-slate-600">{ev.description}</p>

                    <div className="space-y-1 text-xs text-slate-500 pt-2 border-t border-slate-100">
                      <p>
                        <strong>Time:</strong> {ev.start_time || '18:30 GMT'}
                      </p>
                      <p>
                        <strong>Venue:</strong> {ev.venue || 'Main Cathedral Sanctuary, Joma'}
                      </p>
                    </div>

                    <div className="pt-2">
                      {isRsvp ? (
                        <div className="w-full py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>RSVP Confirmed (See You There!)</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            addEventAttendee(ev.id, {
                              name: `${activeMember.first_name} ${activeMember.last_name}`,
                              phone: activeMember.phone,
                              email: activeMember.email,
                              member_id: activeMember.id,
                              role: 'Member',
                            });
                            toastSuccess('RSVP Confirmed', `You are registered for ${ev.title}!`);
                          }}
                          className="w-full py-2 bg-indigo-800 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5"
                        >
                          <CalendarCheck className="w-4 h-4" />
                          <span>1-Click RSVP for Event</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 8: PROFILE & PIN SETTINGS */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-700" />
                My Profile & Member Portal PIN Settings
              </h2>
              <p className="text-xs text-slate-500">
                Keep your church contact details updated and configure your private portal PIN.
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
              {/* Personal Details */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-emerald-700" />
                  Contact & Residential Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Phone Number (WhatsApp)
                    </label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Residential Address
                    </label>
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Ghana Post GPS Digital Address
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. GA-183-4921"
                      value={editGps}
                      onChange={(e) => setEditGps(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="pt-4 border-t border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-700" />
                  Emergency Contact
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Emergency Contact Name
                    </label>
                    <input
                      type="text"
                      value={editEmergencyName}
                      onChange={(e) => setEditEmergencyName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Emergency Contact Phone
                    </label>
                    <input
                      type="text"
                      value={editEmergencyPhone}
                      onChange={(e) => setEditEmergencyPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Portal PIN Security */}
              <div className="pt-4 border-t border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-700" />
                  Member Portal Security PIN / Password
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  Set a private 4 to 6-digit PIN or password for your Member Portal login.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      New Portal PIN / Password
                    </label>
                    <input
                      type="password"
                      placeholder="Enter new 4-digit PIN"
                      value={newPortalPin}
                      onChange={(e) => setNewPortalPin(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Confirm New PIN
                    </label>
                    <input
                      type="password"
                      placeholder="Repeat PIN to confirm"
                      value={confirmPortalPin}
                      onChange={(e) => setConfirmPortalPin(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-6 py-2.5 bg-[#064e3b] hover:bg-[#047857] text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingProfile ? 'Saving Changes...' : 'Save Profile Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* MODAL: GIVE ONLINE / RECORD TITHE */}
      {giveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-800 text-white flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Online Giving & Tithe Submission
                  </h3>
                  <p className="text-xs text-slate-500">
                    Greater Works City Church • Joma Assembly
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGiveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordGiving} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Giving Category</label>
                <select
                  value={giveCategory}
                  onChange={(e) => setGiveCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="tithe">Tithe (Malachi 3:10)</option>
                  <option value="offering">Sunday Worship Offering</option>
                  <option value="pledge">Cathedral Building Fund Pledge</option>
                  <option value="special_seed">Sacrificial Revival Seed</option>
                  <option value="thanksgiving">Thanksgiving / Birthday Seed</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Amount (GH₵)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 font-bold text-slate-500">GH₵</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={giveAmount}
                    onChange={(e) => setGiveAmount(e.target.value)}
                    className="w-full pl-12 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold text-base"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={giveMethod}
                    onChange={(e) => {
                      const m = e.target.value as PaymentMethod;
                      setGiveMethod(m);
                      if (m === 'mobile_money') setGiveChannel('MTN MoMo');
                      else if (m === 'bank_transfer') setGiveChannel('GCB Bank');
                      else setGiveChannel('Sanctuary Offering');
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="mobile_money">Mobile Money (MoMo)</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash">Cash at Cathedral</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Channel / Network</label>
                  <select
                    value={giveChannel}
                    onChange={(e) => setGiveChannel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="MTN MoMo">MTN MoMo (024 456 7890)</option>
                    <option value="Telecel Cash">Telecel Cash (020 876 5432)</option>
                    <option value="GCB Bank">GCB Bank Transfer</option>
                    <option value="Sanctuary Envelope">Sanctuary Envelope</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Transaction / MoMo Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 192830182 or MoMo Approval Code"
                  value={giveReference}
                  onChange={(e) => setGiveReference(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-amber-700" />
                  Church Merchant Details:
                </p>
                <p>MTN Mobile Money: <strong>024 456 7890</strong> (Greater Works City Church)</p>
                <p>Reference: <strong>{activeMember.member_id}</strong></p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGiveModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingGiving}
                  className="px-5 py-2 bg-[#064e3b] hover:bg-[#047857] text-white rounded-xl font-bold flex items-center gap-2 shadow-xs disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmittingGiving ? 'Recording...' : 'Confirm & Record Giving'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Benevolence Application Modal */}
      {activeMember && (
        <ApplyWelfareClaimModal
          isOpen={isMemberClaimModalOpen}
          onClose={() => setIsMemberClaimModalOpen(false)}
          preselectedMemberId={activeMember.id}
        />
      )}
    </div>
  );
};
