import React, { useState, useMemo } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
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
  CalendarDays,
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
  GraduationCap,
  UserCheck,
  Check,
  RotateCcw,
  HelpCircle,
  DownloadCloud,
} from 'lucide-react';
import { useAuth, isElishaRichard } from '../contexts/AuthContext';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useToast } from '../contexts/ToastContext';
import {
  Member,
  GivingRecord,
  PledgeRecord,
  AttendanceRecord,
  PrayerRequest,
  PaymentMethod,
  WelfareClaimCategory,
  RosterAssignment,
  FoundationStudent,
  FoundationCohort,
} from '../types/database.types';
import { cleanGhanaPhone } from '../lib/currencyUtils';
import { ApplyWelfareClaimModal } from '../components/welfare/ApplyWelfareClaimModal';
import { MemberCertificateModal } from '../components/portal/MemberCertificateModal';
import { RequestSubstituteModal } from '../components/portal/RequestSubstituteModal';
import { DownloadMyDutyModal } from '../components/portal/DownloadMyDutyModal';
import { downloadMyDutyRosterPdf } from '../lib/myDutyPdfGenerator';
import { useRealtimeRosterNotifications } from '../hooks/useRealtimeRosterNotifications';
import { RosterNotificationCenter } from '../components/portal/RosterNotificationCenter';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';

type PortalTab =
  | 'overview'
  | 'discipleship'
  | 'roster'
  | 'giving'
  | 'welfare'
  | 'pledges'
  | 'attendance'
  | 'ministry'
  | 'prayers'
  | 'events'
  | 'profile';

const MEMBER_PIN_STORAGE_KEY = 'gwcc_member_passwords_v2';
const LEGACY_MEMBER_PIN_STORAGE_KEY = 'gwcc_member_passwords';

async function hashMemberPin(pin: string): Promise<string> {
  const normalized = (pin || '').trim();
  if (!normalized) return '';

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  return normalized;
}

function readMemberPinMap(): Record<string, string> {
  try {
    const sessionValue = sessionStorage.getItem(MEMBER_PIN_STORAGE_KEY);
    if (sessionValue) {
      const parsed = JSON.parse(sessionValue);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, string>;
      }
    }
  } catch {}

  try {
    const legacyValue = localStorage.getItem(LEGACY_MEMBER_PIN_STORAGE_KEY);
    if (legacyValue) {
      const parsed = JSON.parse(legacyValue);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, string>;
      }
    }
  } catch {}

  return {};
}

function persistMemberPinMap(map: Record<string, string>): void {
  try {
    sessionStorage.setItem(MEMBER_PIN_STORAGE_KEY, JSON.stringify(map));
  } catch {}

  try {
    localStorage.removeItem(LEGACY_MEMBER_PIN_STORAGE_KEY);
  } catch {}
}

const FOUNDATION_CURRICULUM = [
  {
    moduleNumber: 1,
    title: 'New Creation Realities & Salvation',
    subtitle: 'Regeneration & Eternal Life',
    scriptures: '2 Corinthians 5:17 • Romans 10:9-10 • Ephesians 2:8-9',
    description: 'The spiritual significance of the new birth, redemption in Christ Jesus, assurance of salvation, and freedom from condemnation.',
    coreTopics: ['Nature of the Fall & Redemption', 'Assurance of Eternal Life', 'Our Identity in Christ Jesus', 'Overcoming Guilt & the Past'],
  },
  {
    moduleNumber: 2,
    title: 'The Holy Spirit & Divine Fellowship',
    subtitle: 'The Infilling & Spiritual Gifts',
    scriptures: 'Acts 1:8 • 1 Corinthians 12:4-11 • Jude 1:20',
    description: 'The Person and ministry of the Holy Spirit, baptism with evidence of speaking in unknown tongues, and spiritual discernment.',
    coreTopics: ['Who is the Holy Spirit?', 'Speaking in Tongues as a Weapon', 'The 9 Spiritual Gifts', 'Daily Communion with the Spirit'],
  },
  {
    moduleNumber: 3,
    title: 'Christian Stewardship & Kingdom Finances',
    subtitle: 'Tithes, Offerings & Favour',
    scriptures: 'Malachi 3:10 • 2 Corinthians 9:6-8 • Luke 6:38',
    description: 'Biblical stewardship of financial resources, holy tithes, kingdom investments, and unlocking supernatural provision.',
    coreTopics: ['The Law of the Tithe', 'Seedtime and Harvest Principles', 'Stewardship of Talents & Time', 'Financial Integrity in Ministry'],
  },
  {
    moduleNumber: 4,
    title: 'Christian Character & Sound Doctrine',
    subtitle: 'Discipline, Warfare & Holiness',
    scriptures: 'Ephesians 6:10-18 • 2 Timothy 3:16-17 • Galatians 5:22-23',
    description: 'Developing spiritual stamina, personal prayer altars, fasting, fruit of the Spirit, and triumph in spiritual warfare.',
    coreTopics: ['Whole Armor of God', 'Personal Prayer Altar & Fasting', 'Sound Biblical Doctrine', 'Christian Character & Fruit of Spirit'],
  },
  {
    moduleNumber: 5,
    title: 'Water Baptism & The Great Commission',
    subtitle: 'Immersion & Soul Winning',
    scriptures: 'Matthew 28:19-20 • Romans 6:3-4 • Mark 16:15-18',
    description: 'Immersion water baptism, burial of the old man, public dedication, personal evangelism, and placement in church ministry.',
    coreTopics: ['Significance of Water Immersion', 'Personal Soul Winning Skills', 'Connecting in Cell / Small Groups', 'Active Ministry Deployment'],
  },
];

function normalizeToISODate(dateStr: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (trimmed.includes('T')) return trimmed.split('T')[0];

  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch {}
  return trimmed;
}

function parseReportTime(timeStr: string): { hours: number; minutes: number } {
  if (!timeStr) return { hours: 8, minutes: 0 };
  const match = timeStr.match(/(\d{1,2}):(\d{2})(?:\s*([AP]M))?/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3] ? match[3].toUpperCase() : null;

    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return { hours, minutes };
  }
  return { hours: 8, minutes: 0 };
}

function getReportTimeCountdown(dateStr: string, timeStr: string) {
  try {
    const isoDate = normalizeToISODate(dateStr);
    const { hours, minutes } = parseReportTime(timeStr);
    const targetDate = new Date(`${isoDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
    const diffMs = targetDate.getTime() - Date.now();
    if (diffMs < 0) {
      return { isPast: true, text: 'Service Concluded' };
    }
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    const remHours = diffHours % 24;

    if (diffDays > 0) {
      return { isPast: false, text: `In ${diffDays}d ${remHours}h` };
    }
    if (diffHours > 0) {
      return { isPast: false, text: `In ${diffHours} hour${diffHours > 1 ? 's' : ''}` };
    }
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return { isPast: false, text: `In ${Math.max(1, diffMinutes)} mins (Today)` };
  } catch {
    return { isPast: false, text: 'Upcoming Service' };
  }
}

function getRosterDeptBadge(department: string) {
  const d = (department || '').toLowerCase();
  if (d.includes('choir') || d.includes('praise') || d.includes('dominion')) {
    return { label: 'Voice of Dominion Choir', bg: 'bg-amber-100 text-amber-900 border-amber-200', dot: 'bg-amber-500' };
  }
  if (d.includes('media') || d.includes('sound')) {
    return { label: 'Sound & Media Technical', bg: 'bg-sky-100 text-sky-900 border-sky-200', dot: 'bg-sky-500' };
  }
  if (d.includes('usher') || d.includes('protocol')) {
    return { label: 'Ushers & Protocol', bg: 'bg-emerald-100 text-emerald-900 border-emerald-200', dot: 'bg-emerald-500' };
  }
  if (d.includes('intercessor') || d.includes('prayer')) {
    return { label: 'Altar Intercessors', bg: 'bg-purple-100 text-purple-900 border-purple-200', dot: 'bg-purple-500' };
  }
  if (d.includes('child')) {
    return { label: "Children's Ministry", bg: 'bg-pink-100 text-pink-900 border-pink-200', dot: 'bg-pink-500' };
  }
  if (d.includes('car') || d.includes('security')) {
    return { label: 'Car Park & Security', bg: 'bg-blue-100 text-blue-900 border-blue-200', dot: 'bg-blue-500' };
  }
  return { label: 'Sanctuary Protocol', bg: 'bg-slate-100 text-slate-800 border-slate-200', dot: 'bg-slate-500' };
}

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
    foundationCohorts,
    foundationStudents,
    rosterAssignments,
    updateRosterAssignment,
    updateFoundationStudent,
    enrollMemberInFoundationSchool,
  } = useChurchData();

  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requiresCloudMemberAuth = import.meta.env.PROD && isSupabaseConfigured();

  // Active Tab
  const [activeTab, setActiveTab] = useState<PortalTab>(() => {
    const validTabs: PortalTab[] = [
      'overview',
      'discipleship',
      'roster',
      'giving',
      'welfare',
      'pledges',
      'attendance',
      'ministry',
      'prayers',
      'events',
      'profile',
    ];
    const requested = searchParams.get('tab') as PortalTab;
    return validTabs.includes(requested) ? requested : 'overview';
  });

  React.useEffect(() => {
    const requested = searchParams.get('tab') as PortalTab;
    const validTabs: PortalTab[] = [
      'overview',
      'discipleship',
      'roster',
      'giving',
      'welfare',
      'pledges',
      'attendance',
      'ministry',
      'prayers',
      'events',
      'profile',
    ];
    if (requested && validTabs.includes(requested)) {
      setActiveTab(requested);
    }
  }, [searchParams]);

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
    if (previewMemberId) {
      const found = members.find((m) => m.id === previewMemberId || m.member_id === previewMemberId);
      if (found) return found;
    }

    if (currentMember) {
      return currentMember;
    }

    // Staff and other authenticated users must explicitly choose a member to inspect.
    // Autolinking to a real member record from staff identity is a privacy risk and is disabled.
    return null;
  }, [currentMember, previewMemberId, members]);

  const [cloudRosterAssignments, setCloudRosterAssignments] = useState<RosterAssignment[] | null>(null);
  const usesPrivateCloudRoster =
    requiresCloudMemberAuth && currentUser.role === 'member';
  const memberRosterSource = usesPrivateCloudRoster
    ? cloudRosterAssignments || []
    : rosterAssignments;

  React.useEffect(() => {
    if (!usesPrivateCloudRoster || !activeMember) {
      setCloudRosterAssignments(null);
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setCloudRosterAssignments([]);
      toastError('Roster unavailable', 'Secure Supabase roster access is not configured on this device.');
      return;
    }

    let isCurrent = true;
    setCloudRosterAssignments([]);

    const loadMemberRoster = async () => {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      const sessionEmail = sessionData.session?.user.email?.trim().toLowerCase();
      const memberEmail = activeMember.email?.trim().toLowerCase();
      if (!sessionEmail || !memberEmail || sessionEmail !== memberEmail) {
        throw new Error('The signed-in Supabase account does not match this member record.');
      }

      const memberIds = [...new Set([activeMember.id, activeMember.member_id].filter(Boolean))];
      const { data, error } = await client
        .from('roster_assignments')
        .select('*')
        .in('member_id', memberIds)
        .order('date', { ascending: true });
      if (error) throw error;
      if (isCurrent) setCloudRosterAssignments((data || []) as RosterAssignment[]);
    };

    void loadMemberRoster().catch((error: unknown) => {
      if (!isCurrent) return;
      setCloudRosterAssignments([]);
      console.error('Failed to load member roster from Supabase:', error);
      toastError(
        'Could not load service roster',
        error instanceof Error ? error.message : 'Please try again later.'
      );
    });

    const channel = client
      .channel(`member-roster-${activeMember.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'roster_assignments' },
        () => {
          void loadMemberRoster().catch((error: unknown) => {
            if (isCurrent) {
              console.error('Failed to refresh member roster from Supabase:', error);
            }
          });
        }
      )
      .subscribe();

    return () => {
      isCurrent = false;
      void client.removeChannel(channel);
    };
  }, [activeMember, toastError, usesPrivateCloudRoster]);

  // Member's Giving Data
  const memberGiving = useMemo(() => {
    if (!activeMember) return [];
    return giving
      .filter(
        (g) =>
          g.member_id === activeMember.id ||
          g.member_id === activeMember.member_id ||
          (g.donor_name &&
            activeMember.last_name &&
            activeMember.first_name &&
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
      .filter((g) => (g.category || '').toLowerCase() === 'tithe')
      .reduce((sum, g) => sum + (Number(g.amount) || 0), 0);
  }, [memberGiving]);

  // Member's Pledges Data
  const memberPledges = useMemo(() => {
    if (!activeMember) return [];
    return pledges.filter(
      (p) =>
        p.member_id === activeMember.id ||
        p.member_id === activeMember.member_id ||
        (p.member_name && activeMember.last_name && p.member_name.toLowerCase().includes(activeMember.last_name.toLowerCase()))
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
          (a.member_name && activeMember.last_name && a.member_name.toLowerCase().includes(activeMember.last_name.toLowerCase()))
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
          (p.requester_name && activeMember.last_name && p.requester_name.toLowerCase().includes(activeMember.last_name.toLowerCase()))
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

  // Member's Foundation School Record
  const memberFoundationStudent: FoundationStudent | null = useMemo(() => {
    if (!activeMember) return null;
    return (
      foundationStudents.find(
        (s) =>
          s.member_id === activeMember.id ||
          s.member_id === activeMember.member_id ||
          (s.member_name &&
            activeMember.last_name &&
            activeMember.first_name &&
            s.member_name.toLowerCase().includes(activeMember.last_name.toLowerCase()) &&
            s.member_name.toLowerCase().includes(activeMember.first_name.toLowerCase()))
      ) || null
    );
  }, [activeMember, foundationStudents]);

  // Member's Service Duty Roster Assignments
  const memberRosterAssignments: RosterAssignment[] = useMemo(() => {
    if (!activeMember) return [];

    // Helper to match activeMember with an assigned duty entry
    const isMemberAssigned = (assignedId?: string, assignedName?: string, assignedPhone?: string): boolean => {
      if (!activeMember) return false;

      // 1. Exact ID / member_id match
      if (assignedId && assignedId.trim()) {
        const aId = assignedId.trim();
        if (aId === activeMember.id || aId === activeMember.member_id) return true;

        // Check if assignedId matches any member record in system that matches activeMember
        const matchedMem = members.find((m) => m.id === aId || m.member_id.toLowerCase() === aId.toLowerCase());
        if (matchedMem && (matchedMem.id === activeMember.id || matchedMem.member_id === activeMember.member_id)) {
          return true;
        }

        const normAssigned = aId.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normMemberId = (activeMember.member_id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const normId = (activeMember.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normAssigned && (normAssigned === normMemberId || normAssigned === normId)) {
          return true;
        }

        // Only compare numeric digit suffix if the ID is a known member identifier format
        if (normAssigned.startsWith('gwcc') || normAssigned.startsWith('mem')) {
          const numAssigned = aId.replace(/[^0-9]/g, '');
          const numMember = (activeMember.member_id || '').replace(/[^0-9]/g, '');
          if (numAssigned && numMember && parseInt(numAssigned, 10) === parseInt(numMember, 10)) {
            return true;
          }
        }
      }

      // 2. Phone match
      if (assignedPhone && activeMember.phone) {
        const p1 = cleanGhanaPhone(assignedPhone);
        const p2 = cleanGhanaPhone(activeMember.phone);
        if (p1 && p2 && p1 === p2) return true;
        const d1 = assignedPhone.replace(/[^0-9]/g, '').slice(-9);
        const d2 = activeMember.phone.replace(/[^0-9]/g, '').slice(-9);
        if (d1.length >= 8 && d2.length >= 8 && d1 === d2) return true;
      }

      // 3. Name match with titles, initials, and parentheticals stripped
      if (assignedName && assignedName.trim()) {
        const cleanAssigned = assignedName
          .toLowerCase()
          .replace(/\b(prophet|pastor|elder|deacon|deaconess|brother|sister|bro|sis|minister|rev|reverend|dr|mrs|mr|ms|evangelist)\b/gi, '')
          .replace(/\([^)]*\)/g, '')
          .replace(/[^a-z0-9\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const f = (activeMember.first_name || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
        const l = (activeMember.last_name || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
        const full = `${f} ${l}`.trim();
        const reverseFull = `${l} ${f}`.trim();

        if (f && l && cleanAssigned.includes(f) && cleanAssigned.includes(l)) return true;
        if (full && (cleanAssigned === full || cleanAssigned.includes(full) || full.includes(cleanAssigned))) return true;
        if (reverseFull && (cleanAssigned === reverseFull || cleanAssigned.includes(reverseFull))) return true;
      }

      return false;
    };

    // 1. Direct explicit assignments in rosterAssignments
    const directAssignments = memberRosterSource.filter((r) =>
      isMemberAssigned(r.member_id, r.member_name, r.member_phone)
    );

    // 2. Derive recurring service duties for active services over the upcoming 4 weeks
    const getUpcomingDayDate = (dayOfWeek: string, offsetWeeks = 0): string => {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDay = days.indexOf((dayOfWeek || 'Sunday').toLowerCase().trim());
      const now = new Date();
      const currentDay = now.getDay();
      let diff = (targetDay === -1 ? 0 : targetDay) - currentDay;
      if (diff < 0) diff += 7;
      diff += offsetWeeks * 7;
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
      const year = target.getFullYear();
      const month = String(target.getMonth() + 1).padStart(2, '0');
      const day = String(target.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const serviceDerivedAssignments: RosterAssignment[] = [];
    const activeServicesList = usesPrivateCloudRoster
      ? []
      : services.filter((s) => s.is_active !== false);

    activeServicesList.forEach((s) => {
      [0, 1, 2, 3].forEach((weekOffset) => {
        const sDate = getUpcomingDayDate(s.day_of_week, weekOffset);

        const checkAndAdd = (
          fieldVal: string | undefined,
          role_title: string,
          department: RosterAssignment['department'],
          report_time: string,
          notes: string
        ) => {
          if (!fieldVal || !fieldVal.trim()) return;
          if (isMemberAssigned(undefined, fieldVal)) {
            const alreadyExists = directAssignments.some(
              (a) => a.service_id === s.id && a.date === sDate
            );
            if (!alreadyExists) {
              serviceDerivedAssignments.push({
                id: `srv-duty-${s.id}-${sDate}-${role_title.slice(0, 4)}`,
                service_id: s.id,
                service_name: s.name,
                date: sDate,
                member_id: activeMember.id,
                member_name: `${activeMember.first_name} ${activeMember.last_name}`,
                member_phone: activeMember.phone,
                department,
                role_title,
                report_time,
                status: 'confirmed',
                notes,
                created_at: new Date().toISOString(),
              });
            }
          }
        };

        checkAndAdd(
          s.preacher,
          'Preacher / Exhorter of the Word',
          'intercessors',
          s.start_time ? `30 mins prior (${s.start_time})` : '08:00 AM',
          'Preaching and ministration of the Word. Pre-service prayer 30 mins prior.'
        );
        checkAndAdd(
          s.service_leader,
          'Service Moderator / Leader (MC)',
          'ushers_protocol',
          s.start_time ? `30 mins prior (${s.start_time})` : '08:00 AM',
          'Coordinate order of service liturgy and church announcements.'
        );
        checkAndAdd(
          s.worship_leader,
          'Worship Team / Music Director',
          'praise_team',
          s.start_time ? `45 mins prior (${s.start_time})` : '07:45 AM',
          'Band sound check and congregational worship ministration.'
        );
        checkAndAdd(
          s.head_usher,
          'Head Usher & Protocol Captain',
          'ushers_protocol',
          s.start_time ? `45 mins prior (${s.start_time})` : '07:45 AM',
          'Sanctuary seating, tithes collection, and dignitary reception.'
        );
        checkAndAdd(
          s.sound_media,
          'Sound Engineer & Livestream Lead',
          'sound_media',
          s.start_time ? `45 mins prior (${s.start_time})` : '07:45 AM',
          'Sound console mixing, microphone checks, and social livestream.'
        );

        if (s.order_of_service && Array.isArray(s.order_of_service)) {
          s.order_of_service.forEach((item) => {
            if (item.minister && isMemberAssigned(undefined, item.minister)) {
              const alreadyExists = directAssignments.some(
                (a) => a.service_id === s.id && a.date === sDate
              );
              if (!alreadyExists) {
                serviceDerivedAssignments.push({
                  id: `srv-liturgy-${s.id}-${sDate}-${item.id || item.order}`,
                  service_id: s.id,
                  service_name: s.name,
                  date: sDate,
                  member_id: activeMember.id,
                  member_name: `${activeMember.first_name} ${activeMember.last_name}`,
                  member_phone: activeMember.phone,
                  department: 'ushers_protocol',
                  role_title: item.title,
                  report_time: item.time || s.start_time || '08:30 AM',
                  status: 'confirmed',
                  notes: item.notes || `Order of Service segment: ${item.title}`,
                  created_at: new Date().toISOString(),
                });
              }
            }
          });
        }
      });
    });

    const combined = [...directAssignments, ...serviceDerivedAssignments];

    // Deduplicate by service_id + date + role_title
    const seen = new Set<string>();
    const uniqueList: RosterAssignment[] = [];
    combined.forEach((a) => {
      const key = `${a.service_id}_${a.date}_${a.role_title}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueList.push(a);
      }
    });

    return uniqueList.sort((a, b) => {
      const dateA = normalizeToISODate(a.date);
      const dateB = normalizeToISODate(b.date);
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return (a.report_time || '').localeCompare(b.report_time || '');
    });
  }, [activeMember, memberRosterSource, services, usesPrivateCloudRoster]);

  const upcomingRosterDuties = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return memberRosterAssignments.filter((r) => normalizeToISODate(r.date) >= todayStr);
  }, [memberRosterAssignments]);

  const pastRosterDuties = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return memberRosterAssignments.filter((r) => normalizeToISODate(r.date) < todayStr);
  }, [memberRosterAssignments]);

  const nextUpcomingDuty = useMemo(() => {
    return upcomingRosterDuties[0] || memberRosterAssignments[0] || null;
  }, [upcomingRosterDuties, memberRosterAssignments]);

  // Discipleship & Roster Modals & States
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [isDownloadDutyModalOpen, setIsDownloadDutyModalOpen] = useState(false);
  const [dutyModalInitialAssignmentId, setDutyModalInitialAssignmentId] = useState<string | undefined>(undefined);
  const [selectedSubstituteAssignment, setSelectedSubstituteAssignment] = useState<RosterAssignment | null>(null);
  const [rosterViewFilter, setRosterViewFilter] = useState<'upcoming' | 'all' | 'past'>('upcoming');

  // Real-time Service Duty Roster WebSocket Notifications
  const {
    status: wsStatus,
    notifications: rosterAlerts,
    unreadCount: unreadRosterAlertCount,
    latestAlert: latestRosterAlert,
    clearLatestAlert,
    markAsRead: markRosterAlertAsRead,
    markAllAsRead: markAllRosterAlertsAsRead,
    simulateDutyAlert,
  } = useRealtimeRosterNotifications({
    memberId: activeMember?.member_id || activeMember?.id,
    memberName: activeMember ? `${activeMember.first_name} ${activeMember.last_name}` : undefined,
    enabled: Boolean(activeMember) && !usesPrivateCloudRoster,
    onNotificationReceived: (notif) => {
      toastSuccess('Duty Roster Alert', notif.message);
    },
  });

  const handleOpenDownloadDutyModal = (assignmentId?: string) => {
    setDutyModalInitialAssignmentId(assignmentId);
    setIsDownloadDutyModalOpen(true);
  };

  // Displayed Duties based on selected filter (ensures duties are immediately visible)
  const displayedDuties = useMemo(() => {
    if (rosterViewFilter === 'upcoming') {
      return upcomingRosterDuties.length > 0 ? upcomingRosterDuties : memberRosterAssignments;
    }
    if (rosterViewFilter === 'past') {
      return pastRosterDuties;
    }
    return memberRosterAssignments;
  }, [rosterViewFilter, upcomingRosterDuties, pastRosterDuties, memberRosterAssignments]);

  // If member has past duties but none upcoming, default filter to all so duty is immediately visible
  React.useEffect(() => {
    if (upcomingRosterDuties.length === 0 && memberRosterAssignments.length > 0 && rosterViewFilter === 'upcoming') {
      setRosterViewFilter('all');
    }
  }, [upcomingRosterDuties.length, memberRosterAssignments.length]);

  const handleConfirmRosterAttendance = (assignmentId: string, fallback?: RosterAssignment) => {
    updateRosterAssignment(assignmentId, { status: 'confirmed' }, fallback);
    toastSuccess('Attendance Confirmed', 'You have confirmed your attendance for this service duty assignment!');
  };

  const handleConfirmSubstitute = (assignmentId: string, reason: string, note: string) => {
    updateRosterAssignment(
      assignmentId,
      { status: 'substituted', notes: note },
      selectedSubstituteAssignment || undefined
    );
    toastSuccess('Substitute Requested', 'Your substitute request has been logged. The department coordinator has been notified.');
  };

  const handleOpenSubstituteModal = (assignment: RosterAssignment) => {
    setSelectedSubstituteAssignment(assignment);
  };

  const handleSelfEnrollFoundation = () => {
    if (!activeMember) return;
    const activeCohort = foundationCohorts.find((c) => c.status === 'active') || foundationCohorts[0];
    if (activeCohort) {
      enrollMemberInFoundationSchool({
        cohort_id: activeCohort.id,
        cohort_name: activeCohort.name,
        member_id: activeMember.id,
        member_name: `${activeMember.first_name} ${activeMember.last_name}`,
        member_phone: activeMember.phone || undefined,
        enrollment_date: new Date().toISOString().split('T')[0],
        completed_modules: [],
        water_baptism_status: Boolean(activeMember.baptism_status),
        status: 'in_progress',
      });
      toastSuccess('Enrolled in Foundation School', `You have been enrolled into ${activeCohort.name}!`);
    } else {
      toastInfo('Enrollment Notice', 'Foundation School enrollment request submitted to the secretariat.');
    }
  };

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
      setLoginError(requiresCloudMemberAuth
        ? 'Please enter your verified Supabase account password.'
        : 'Please enter your 4-digit PIN or password.');
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
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMember) return;

    if (newPortalPin && newPortalPin !== confirmPortalPin) {
      toastError('PIN Mismatch', 'New portal PIN and confirmation PIN do not match.');
      return;
    }
    if (usesPrivateCloudRoster && newPortalPin.length < 6) {
      toastError('Password Too Short', 'Supabase member account passwords must be at least 6 characters.');
      return;
    }
    if (
      usesPrivateCloudRoster &&
      editEmail.trim().toLowerCase() !== (activeMember.email || '').trim().toLowerCase()
    ) {
      toastError('Email Update Required', 'Contact the church office to change the verified email on your secure member account.');
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
        if (usesPrivateCloudRoster) {
          const client = getSupabaseClient();
          if (!client) throw new Error('Secure member sign-in is unavailable.');
          const { error } = await client.auth.updateUser({ password: newPortalPin.trim() });
          if (error) throw error;
          toastSuccess('Account Password Updated', 'Your Supabase member account password has been changed.');
        } else {
          const pinsMap = readMemberPinMap();
          const hashedValue = await hashMemberPin(newPortalPin.trim());
          pinsMap[activeMember.id] = hashedValue;
          pinsMap[activeMember.member_id] = hashedValue;
          persistMemberPinMap(pinsMap);
          toastSuccess('Portal PIN Updated', 'Your Member Portal PIN has been securely saved.');
        }
        setNewPortalPin('');
        setConfirmPortalPin('');
      }

      toastSuccess('Profile Updated', 'Your church membership records have been updated.');
    } catch (err: any) {
      toastError('Error', err?.message || 'Could not update profile or account password.');
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
              {requiresCloudMemberAuth
                ? 'Sign in with your Member ID, phone number, or email and your verified Supabase account password.'
                : 'Sign in with your Member ID, registered phone number, or email and your 4-digit PIN.'}
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
                  {requiresCloudMemberAuth ? 'Supabase Account Password' : 'Password or 4-Digit PIN'} <span className="text-red-400">*</span>
                </label>
                <span className="text-[10px] text-emerald-400 font-medium">
                  {requiresCloudMemberAuth ? 'Use your verified member account' : 'Default: Phone last 4 digits'}
                </span>
              </div>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  required
                  placeholder={requiresCloudMemberAuth ? 'Enter your account password' : 'Enter 4-digit PIN (e.g. 5432)'}
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
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {members.slice(0, 6).map((m) => {
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
      {currentRole !== 'member' && (
        <div className="bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 text-white px-4 py-2.5 text-xs flex flex-col sm:flex-row items-center justify-between gap-2 shadow-sm border-b border-amber-600/50">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 shrink-0 text-amber-200" />
            <span>
              <strong>Staff Pastoral Inspection:</strong> Auditing Member Portal as{' '}
              <strong className="underline decoration-amber-300 font-bold">{activeMember.first_name} {activeMember.last_name} ({activeMember.member_id})</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label htmlFor="staff-preview-select" className="text-[11px] text-amber-200 font-semibold hidden md:inline">
              Switch Member:
            </label>
            <select
              id="staff-preview-select"
              value={activeMember.id}
              onChange={(e) => {
                const target = members.find((m) => m.id === e.target.value);
                if (target) {
                  setPreviewMemberId(target.id);
                  setPortalMember(target);
                }
              }}
              className="bg-amber-950 text-white text-[11px] font-semibold rounded-lg px-2.5 py-1.5 border border-amber-500 focus:outline-none focus:ring-1 focus:ring-white cursor-pointer"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.member_id} — {m.first_name} {m.last_name} ({m.leadership_position || m.ministry_name || 'Member'})
                </option>
              ))}
            </select>

            <button
              onClick={() => navigate('/services')}
              className="px-2.5 py-1.5 bg-amber-900 hover:bg-amber-950 text-white border border-amber-500 rounded-lg text-[11px] font-bold transition shadow-xs cursor-pointer flex items-center gap-1"
              title="Go to Services Duty Roster schedule"
            >
              <CalendarDays className="w-3.5 h-3.5 text-amber-300" />
              <span>Services Roster</span>
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-2.5 py-1.5 bg-white text-amber-950 rounded-lg text-[11px] font-bold hover:bg-amber-50 transition shadow-xs cursor-pointer"
            >
              Dashboard
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

            {/* Member Profile Badge & Notifications & Sign Out */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              {/* Real-time Duty Roster Notification Center */}
              <RosterNotificationCenter
                notifications={rosterAlerts}
                unreadCount={unreadRosterAlertCount}
                status={wsStatus}
                latestAlert={latestRosterAlert}
                onClearLatestAlert={clearLatestAlert}
                onMarkAsRead={markRosterAlertAsRead}
                onMarkAllAsRead={markAllRosterAlertsAsRead}
                onViewDuty={(_dutyId) => setActiveTab('roster')}
                onDownloadDutyPdf={(dutyId) => handleOpenDownloadDutyModal(dutyId)}
                onSimulateTestAlert={simulateDutyAlert}
              />

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
                {
                  id: 'discipleship',
                  label: 'Foundation School',
                  icon: GraduationCap,
                  badge: memberFoundationStudent?.status === 'graduated' ? 'Certified 🎓' : `${memberFoundationStudent?.completed_modules?.length || 0}/5`,
                  badgeColor: memberFoundationStudent?.status === 'graduated' ? 'bg-amber-400 text-slate-950 font-bold' : 'bg-emerald-700 text-emerald-100',
                },
                {
                  id: 'roster',
                  label: 'My Duty Roster',
                  icon: UserCheck,
                  badge: unreadRosterAlertCount > 0
                    ? `${unreadRosterAlertCount} New`
                    : upcomingRosterDuties.length > 0
                    ? `${upcomingRosterDuties.length}`
                    : undefined,
                  badgeColor: unreadRosterAlertCount > 0
                    ? 'bg-amber-400 text-slate-950 font-black animate-pulse'
                    : 'bg-emerald-400 text-slate-950 font-bold',
                },
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
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition cursor-pointer ${
                      isActive
                        ? 'bg-white text-emerald-950 font-bold shadow-xs'
                        : 'text-emerald-100 hover:bg-emerald-800/60 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{tab.label}</span>
                    {tab.badge && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${tab.badgeColor}`}>
                        {tab.badge}
                      </span>
                    )}
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

            {/* SPOTLIGHT SECTION: DISCIPLESHIP & UPCOMING DUTY ROSTER */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Foundation School Spotlight */}
              <div className="p-6 rounded-3xl bg-linear-to-br from-emerald-900 via-teal-900 to-slate-900 text-white shadow-md relative overflow-hidden border border-emerald-700/50 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-emerald-300" />
                      Discipleship Progress
                    </span>
                    {memberFoundationStudent?.status === 'graduated' ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 uppercase shadow-2xs">
                        Certified Graduate 🎓
                      </span>
                    ) : (
                      <span className="text-xs font-mono font-bold text-emerald-300">
                        {memberFoundationStudent?.completed_modules?.length || 0}/5 Modules
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-black text-white tracking-tight">
                    Believers Foundation School
                  </h3>
                  <p className="text-xs text-emerald-100/90 leading-relaxed">
                    {memberFoundationStudent?.cohort_name || 'Class of Dominion & Grace (Cohort 2026)'}
                  </p>

                  {/* Real-time 5-Module Progress Bar */}
                  <div className="pt-2 space-y-1.5">
                    <div className="w-full bg-black/40 rounded-full h-2.5 overflow-hidden p-0.5 border border-white/10">
                      <div
                        className="bg-linear-to-r from-emerald-400 via-teal-300 to-amber-300 h-full rounded-full transition-all duration-500 shadow-sm"
                        style={{
                          width: `${Math.min(
                            100,
                            ((memberFoundationStudent?.completed_modules?.length || 0) / 5) * 100
                          )}%`,
                        }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-emerald-200">
                      <span>
                        {memberFoundationStudent?.status === 'graduated'
                          ? '100% Curriculum Completed'
                          : `${((memberFoundationStudent?.completed_modules?.length || 0) / 5) * 100}% Completed`}
                      </span>
                      <span>
                        {memberFoundationStudent?.water_baptism_status
                          ? '💧 Water Baptism Confirmed'
                          : '💧 Water Baptism Pending'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-700/50 flex flex-wrap items-center justify-between gap-2">
                  {memberFoundationStudent?.status === 'graduated' ? (
                    <button
                      type="button"
                      onClick={() => setIsCertificateModalOpen(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>View Official Certificate</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveTab('discipleship')}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                    >
                      <span>Track 5 Modules</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveTab('discipleship')}
                    className="text-xs text-emerald-200 hover:text-white font-semibold underline underline-offset-2 transition"
                  >
                    Curriculum Details
                  </button>
                </div>
              </div>

              {/* Service Duty Roster Spotlight */}
              <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-md flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-teal-50 text-teal-800 border border-teal-200 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-teal-700" />
                      My Service Duty Roster
                    </span>
                    {nextUpcomingDuty ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 animate-pulse">
                        Next Assignment
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-semibold">
                        No upcoming duty
                      </span>
                    )}
                  </div>

                  {nextUpcomingDuty ? (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">
                            {nextUpcomingDuty.service_name}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {nextUpcomingDuty.date} • Report at <strong>{nextUpcomingDuty.report_time}</strong>
                          </p>
                        </div>
                        <span className="px-2.5 py-1 rounded-xl text-xs font-bold uppercase bg-slate-100 text-slate-800 shrink-0">
                          {nextUpcomingDuty.department.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Assigned Role</span>
                          <span className="font-bold text-slate-900">{nextUpcomingDuty.role_title}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Status</span>
                          <span
                            className={`text-[11px] font-extrabold capitalize ${
                              nextUpcomingDuty.status === 'confirmed'
                                ? 'text-emerald-700'
                                : nextUpcomingDuty.status === 'substituted'
                                ? 'text-purple-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {nextUpcomingDuty.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 text-center text-xs text-slate-500 space-y-1">
                      <UserCheck className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="font-semibold text-slate-700">No duty shifts scheduled this week</p>
                      <p className="text-[11px] text-slate-400">Check your ministry schedule or view full roster history below.</p>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  {nextUpcomingDuty && nextUpcomingDuty.status !== 'confirmed' ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleConfirmRosterAttendance(nextUpcomingDuty.id, nextUpcomingDuty)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirm Attendance</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedSubstituteAssignment(nextUpcomingDuty)}
                        className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
                      >
                        Request Substitute
                      </button>
                    </div>
                  ) : null}

                  <div className="flex items-center gap-2 ml-auto">
                    {memberRosterAssignments.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleOpenDownloadDutyModal()}
                        className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold inline-flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                        title="Download your duty roster as a printable PDF"
                      >
                        <Download className="w-3.5 h-3.5 text-teal-700" />
                        <span>Download My Duty</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setActiveTab('roster')}
                      className="text-xs text-teal-700 hover:text-teal-900 font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>View My Duty Schedule</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
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

        {/* TAB 2: FOUNDATION SCHOOL & DISCIPLESHIP SELF-SERVICE */}
        {activeTab === 'discipleship' && (
          <div className="space-y-6">
            {/* Header + Progress Overview */}
            <div className="bg-linear-to-r from-emerald-950 via-teal-900 to-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-emerald-700/50 shadow-md relative overflow-hidden space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5" />
                      Discipleship Academy
                    </span>
                    {memberFoundationStudent?.status === 'graduated' ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-400 text-slate-950 shadow-2xs">
                        Certified Graduate 🎓
                      </span>
                    ) : memberFoundationStudent?.status === 'ready_for_baptism' ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-400 text-slate-950 shadow-2xs">
                        Curriculum Complete • Ready for Baptism
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/30 text-emerald-200">
                        In Progress
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    Believers Foundation School
                  </h2>
                  <p className="text-xs text-emerald-200/90 leading-relaxed max-w-2xl">
                    {memberFoundationStudent?.cohort_name || 'Class of Dominion & Grace (Cohort 2026-A)'} • Dean: <strong>Pastor Emmanuel Osei</strong>
                  </p>
                </div>

                {memberFoundationStudent?.status === 'graduated' ? (
                  <button
                    type="button"
                    onClick={() => setIsCertificateModalOpen(true)}
                    className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-md transition self-start sm:self-auto cursor-pointer"
                  >
                    <Award className="w-4 h-4" />
                    <span>View Official Certificate</span>
                  </button>
                ) : !memberFoundationStudent ? (
                  <button
                    type="button"
                    onClick={handleSelfEnrollFoundation}
                    className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-md transition self-start sm:self-auto cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Enroll in Foundation School</span>
                  </button>
                ) : null}
              </div>

              {/* 5-Module Progress Bar Meter */}
              <div className="pt-2 space-y-2 border-t border-emerald-700/50">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-emerald-200">Curriculum Milestone Completion:</span>
                  <span className="text-amber-300 font-mono font-bold">
                    {memberFoundationStudent?.completed_modules?.length || 0} of 5 Modules Completed (
                    {Math.round(((memberFoundationStudent?.completed_modules?.length || 0) / 5) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-black/40 rounded-full h-3 overflow-hidden p-0.5 border border-white/10">
                  <div
                    className="bg-linear-to-r from-emerald-400 via-teal-300 to-amber-300 h-full rounded-full transition-all duration-700 shadow-sm"
                    style={{
                      width: `${Math.min(
                        100,
                        ((memberFoundationStudent?.completed_modules?.length || 0) / 5) * 100
                      )}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Highlights: 3 Status Pillars */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Pillar 1: Modules Tracker */}
              <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Classroom Curriculum</span>
                <p className="text-xl font-black text-slate-900">
                  {memberFoundationStudent?.completed_modules?.length || 0} / 5 Modules
                </p>
                <p className="text-[11px] text-emerald-700 font-semibold">
                  {memberFoundationStudent?.completed_modules?.length === 5
                    ? 'All Modules Completed'
                    : `${5 - (memberFoundationStudent?.completed_modules?.length || 0)} Modules Remaining`}
                </p>
              </div>

              {/* Pillar 2: Immersion Water Baptism */}
              <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Water Immersion Baptism</span>
                <p className="text-xl font-black text-slate-900">
                  {memberFoundationStudent?.water_baptism_status ? 'Baptism Confirmed' : 'Immersion Pending'}
                </p>
                <p className="text-[11px] text-blue-700 font-semibold truncate">
                  {memberFoundationStudent?.water_baptism_date
                    ? `Immersed: ${memberFoundationStudent.water_baptism_date}`
                    : 'Scheduled at Sanctuary Baptistery'}
                </p>
              </div>

              {/* Pillar 3: Discipleship Certificate */}
              <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Discipleship Certificate</span>
                <p className="text-xl font-black text-slate-900">
                  {memberFoundationStudent?.status === 'graduated' ? 'Official Issued' : 'Locked Until Grad'}
                </p>
                <p className="text-[11px] text-amber-700 font-semibold truncate">
                  {memberFoundationStudent?.certificate_no
                    ? `Cert No: ${memberFoundationStudent.certificate_no}`
                    : 'Unlocks Upon 5/5 Modules'}
                </p>
              </div>
            </div>

            {/* Certificate of Discipleship Download Banner (When Graduated or Completed) */}
            {memberFoundationStudent && (memberFoundationStudent.status === 'graduated' || memberFoundationStudent.completed_modules?.length === 5) && (
              <div className="p-6 rounded-3xl bg-linear-to-r from-amber-500/15 via-emerald-500/10 to-amber-500/10 border-2 border-amber-300 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-sm font-bold">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-800">
                      Official Ministerial Credential
                    </span>
                    <h3 className="text-base font-black text-slate-900">
                      Official Certificate of Discipleship
                    </h3>
                    <p className="text-xs text-slate-600">
                      Serial: <strong className="text-emerald-900 font-mono">{memberFoundationStudent.certificate_no || 'GWCC-FND-2026-001'}</strong> • Graduation: <strong>{memberFoundationStudent.graduation_date || '2026-09-20'}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsCertificateModalOpen(true)}
                    className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                  >
                    <Award className="w-4 h-4 text-amber-400" />
                    <span>View Certificate</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCertificateModalOpen(true)}
                    className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-slate-600" />
                    <span>Download / Print</span>
                  </button>
                </div>
              </div>
            )}

            {/* THE 5 CURRICULUM MODULES MATRIX */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-emerald-800" />
                    <span>Foundation School 5-Module Curriculum</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Comprehensive systematic discipleship doctrine designed for every believer at Greater Works City Church
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {FOUNDATION_CURRICULUM.map((mod) => {
                  const isCompleted = memberFoundationStudent?.completed_modules?.includes(mod.moduleNumber);
                  const isCurrent =
                    !isCompleted &&
                    (mod.moduleNumber === 1 ||
                      memberFoundationStudent?.completed_modules?.includes(mod.moduleNumber - 1));

                  return (
                    <div
                      key={mod.moduleNumber}
                      className={`p-5 rounded-3xl border transition shadow-2xs flex flex-col justify-between space-y-3 ${
                        isCompleted
                          ? 'bg-white border-emerald-300 ring-1 ring-emerald-500/10'
                          : isCurrent
                          ? 'bg-amber-50/30 border-amber-300'
                          : 'bg-slate-50/70 border-slate-200 opacity-80'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                                isCompleted
                                  ? 'bg-emerald-700 text-white'
                                  : isCurrent
                                  ? 'bg-amber-500 text-slate-950 font-black'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {mod.moduleNumber}
                            </span>
                            <div>
                              <h4 className="font-bold text-slate-900 text-sm tracking-tight leading-snug">
                                {mod.title}
                              </h4>
                              <p className="text-[11px] font-semibold text-emerald-800">
                                {mod.subtitle}
                              </p>
                            </div>
                          </div>

                          {isCompleted ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 shrink-0">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Passed
                            </span>
                          ) : isCurrent ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-900 border border-amber-200 shrink-0">
                              Current Module
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium uppercase bg-slate-200 text-slate-600 shrink-0">
                              Upcoming
                            </span>
                          )}
                        </div>

                        {/* Scripture Reference */}
                        <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-600 font-medium italic">
                          📖 {mod.scriptures}
                        </div>

                        <p className="text-xs text-slate-700 leading-relaxed">
                          {mod.description}
                        </p>

                        {/* Core Topic Chips */}
                        <div className="pt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Learning Objectives:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {mod.coreTopics.map((topic, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-medium"
                              >
                                {topic}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                        <span>Curriculum Level {mod.moduleNumber} of 5</span>
                        {isCompleted && (
                          <span className="font-semibold text-emerald-700 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Requirement Satisfied
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* IMMERSION WATER BAPTISM SELF-SERVICE VERIFICATION CARD */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                    💧
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      Believer&apos;s Immersion Water Baptism
                    </h3>
                    <p className="text-xs text-slate-500">
                      Biblical ordinance of identification with Jesus Christ in death, burial, and resurrection
                    </p>
                  </div>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    memberFoundationStudent?.water_baptism_status
                      ? 'bg-blue-100 text-blue-900 border border-blue-200'
                      : 'bg-amber-100 text-amber-900 border border-amber-200'
                  }`}
                >
                  {memberFoundationStudent?.water_baptism_status ? 'Immersion Verified' : 'Awaiting Immersion Service'}
                </span>
              </div>

              <blockquote className="text-xs italic text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-200 leading-relaxed">
                &ldquo;Therefore we are buried with Him by baptism into death: that like as Christ was raised up from the dead by the glory of the Father, even so we also should walk in newness of life.&rdquo;
                <footer className="text-slate-900 font-bold not-italic mt-1">— Romans 6:4</footer>
              </blockquote>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Baptism Records</span>
                  <p className="font-bold text-slate-900">
                    {memberFoundationStudent?.water_baptism_status
                      ? `Conducted on ${memberFoundationStudent.water_baptism_date || activeMember.baptism_date || 'August 2026'}`
                      : 'Scheduled for Next Baptism Service'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Officiating Minister: <strong>{settings.senior_pastor || 'Prophet Elisha K. Richard'}</strong>
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Immersion Venue</span>
                  <p className="font-bold text-slate-900">
                    GWCC Sanctuary Baptistery & Riverfront
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Dress Code: White Baptismal Robe provided by church protocol
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MY SERVICE DUTY ROSTER & VOLUNTEER HUB */}
        {activeTab === 'roster' && (
          <div className="space-y-6">
            {/* Header + Overview Banner */}
            <div className="bg-linear-to-r from-teal-950 via-slate-900 to-emerald-950 text-white p-6 sm:p-8 rounded-3xl border border-teal-700/50 shadow-md relative overflow-hidden space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-teal-400/20 text-teal-300 border border-teal-400/30 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5" />
                      Volunteer & Duty Roster Hub
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-white/10 text-emerald-200">
                      {activeMember.ministry_name || 'Department Volunteer'}
                    </span>
                    <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-emerald-200 border border-white/15">
                      <span className={`w-1.5 h-1.5 rounded-full ${usesPrivateCloudRoster || wsStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                      <span>{usesPrivateCloudRoster ? 'Secure Supabase Live Sync' : wsStatus === 'connected' ? 'Live Duty Sync Active' : 'Syncing...'}</span>
                      {!usesPrivateCloudRoster && (
                        <button
                          type="button"
                          onClick={() => simulateDutyAlert()}
                          className="ml-1 text-[9px] text-amber-300 hover:text-amber-200 underline font-bold cursor-pointer"
                          title="Simulate incoming duty assignment alert via WebSocket"
                        >
                          (Test Alert)
                        </button>
                      )}
                    </div>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    My Service Duty Roster
                  </h2>
                  <p className="text-xs text-teal-200/90 leading-relaxed max-w-2xl">
                    &ldquo;Serve the Lord with gladness: come before His presence with singing.&rdquo; (Psalm 100:2) • Track report times, confirm duty, and manage service substitutions.
                  </p>
                </div>

                <div className="flex flex-col sm:items-end gap-2 sm:self-auto self-start">
                  <div className="text-right sm:block hidden">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-teal-300 block">
                      Upcoming Assignments
                    </span>
                    <span className="text-3xl font-black text-white">
                      {upcomingRosterDuties.length}
                    </span>
                    <span className="text-[10px] text-slate-300 block">Scheduled shifts</span>
                  </div>

                  {memberRosterAssignments.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenDownloadDutyModal()}
                      className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 transition shadow-md cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                      title="Download printable PDF of your duty roster"
                    >
                      <Download className="w-4 h-4 text-slate-950" />
                      <span>Download My Duty</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Next Upcoming Service Spotlight Countdown */}
              {nextUpcomingDuty && (
                <div className="pt-3 border-t border-teal-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-black/25 p-4 rounded-2xl border border-white/10">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-amber-400 text-slate-950">
                        {getReportTimeCountdown(nextUpcomingDuty.date, nextUpcomingDuty.report_time).text}
                      </span>
                      <strong className="text-white text-sm">{nextUpcomingDuty.service_name}</strong>
                    </div>
                    <p className="text-teal-200 text-xs">
                      Date: <strong>{nextUpcomingDuty.date}</strong> • Report Time: <strong className="text-amber-300">{nextUpcomingDuty.report_time}</strong> • Role: <strong>{nextUpcomingDuty.role_title}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {nextUpcomingDuty.status !== 'confirmed' && (
                      <button
                        type="button"
                        onClick={() => handleConfirmRosterAttendance(nextUpcomingDuty.id, nextUpcomingDuty)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirm Attendance</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedSubstituteAssignment(nextUpcomingDuty)}
                      className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold border border-white/20 transition cursor-pointer"
                    >
                      Request Substitute
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDownloadDutyModal(nextUpcomingDuty.id)}
                      className="px-3.5 py-1.5 bg-teal-800/80 hover:bg-teal-700 text-teal-100 rounded-xl text-xs font-bold border border-teal-400/40 transition cursor-pointer flex items-center gap-1.5"
                      title="Download PDF slip for this upcoming service"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Slip</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Filter Navigation Pills */}
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-2xl border border-slate-300">
                <button
                  type="button"
                  onClick={() => setRosterViewFilter('upcoming')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                    rosterViewFilter === 'upcoming'
                      ? 'bg-white text-emerald-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Upcoming Shifts ({upcomingRosterDuties.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRosterViewFilter('all')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                    rosterViewFilter === 'all'
                      ? 'bg-white text-emerald-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Duties ({memberRosterAssignments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRosterViewFilter('past')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                    rosterViewFilter === 'past'
                      ? 'bg-white text-emerald-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Past History ({pastRosterDuties.length})
                </button>
              </div>

              <div className="flex items-center gap-2">
                {memberRosterAssignments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleOpenDownloadDutyModal()}
                    className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-950 border border-emerald-300 text-xs font-bold inline-flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                    title="Download personal duty roster as printable PDF"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-800" />
                    <span>Download My Duty</span>
                  </button>
                )}
                <p className="text-[11px] text-slate-500 hidden sm:block">
                  Greater Works City Church Roster Protocol
                </p>
              </div>
            </div>

            {/* Filter Notice Banner if upcoming is empty but member has assignments */}
            {rosterViewFilter === 'upcoming' && upcomingRosterDuties.length === 0 && memberRosterAssignments.length > 0 && (
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Showing all your scheduled church duties ({memberRosterAssignments.length} record{memberRosterAssignments.length > 1 ? 's' : ''}).</span>
                </span>
                <button
                  type="button"
                  onClick={() => setRosterViewFilter('all')}
                  className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 rounded-lg font-bold text-[11px] transition cursor-pointer text-amber-950"
                >
                  View All Shifts
                </button>
              </div>
            )}

            {/* Duty Assignments Cards Grid */}
            <div className="space-y-3">
              {displayedDuties.map((assignment) => {
                const deptBadge = getRosterDeptBadge(assignment.department);
                const countdown = getReportTimeCountdown(assignment.date, assignment.report_time);

                return (
                  <div
                    key={assignment.id}
                    className="p-5 rounded-3xl bg-white border border-slate-200 shadow-2xs hover:shadow-md transition space-y-3.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-slate-900 text-sm">
                            {assignment.service_name}
                          </h4>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${deptBadge.bg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${deptBadge.dot}`}></span>
                            {deptBadge.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-2">
                          <span className="font-semibold text-slate-700 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {assignment.date}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-bold text-emerald-900">
                            <Clock className="w-3.5 h-3.5 text-emerald-700" />
                            Report at: {assignment.report_time}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold capitalize ${
                            assignment.status === 'confirmed'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : assignment.status === 'substituted'
                              ? 'bg-purple-100 text-purple-900 border border-purple-300'
                              : assignment.status === 'declined'
                              ? 'bg-rose-100 text-rose-900 border border-rose-300'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                        >
                          {assignment.status === 'confirmed' ? '✓ Confirmed' : assignment.status}
                        </span>

                        <span className="px-2.5 py-1 rounded-xl text-[11px] font-mono font-semibold bg-slate-100 text-slate-700">
                          {countdown.text}
                        </span>
                      </div>
                    </div>

                    {/* Role & Specific Notes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-0.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Assigned Function / Station</span>
                        <p className="font-bold text-slate-900 text-xs">{assignment.role_title}</p>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-0.5">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Shift Instructions / Attire</span>
                        <p className="text-slate-600 text-xs">
                          {assignment.notes || 'Arrive 20 mins prior to pre-service prayer in the sanctuary.'}
                        </p>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="text-[11px] text-slate-400">
                        Roster ID: <span className="font-mono">{assignment.id}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenDownloadDutyModal(assignment.id)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition flex items-center gap-1 cursor-pointer text-xs"
                          title="Download printable PDF slip for this shift"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-500" />
                          <span>Download Slip</span>
                        </button>

                        {assignment.status !== 'confirmed' && (
                          <button
                            type="button"
                            onClick={() => handleConfirmRosterAttendance(assignment.id, assignment)}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition flex items-center gap-1 shadow-2xs cursor-pointer text-xs"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Confirm Attendance</span>
                          </button>
                        )}

                        {assignment.status !== 'substituted' && (
                          <button
                            type="button"
                            onClick={() => handleOpenSubstituteModal(assignment)}
                            className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition cursor-pointer text-xs"
                          >
                            Request Substitute
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {displayedDuties.length === 0 && (
                <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-800 mx-auto flex items-center justify-center">
                    <UserCheck className="w-6 h-6 text-emerald-700" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-slate-800 text-sm">
                      {rosterViewFilter === 'past' ? 'No Past Service Duties' : 'No Duty Assignments Found'}
                    </p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      {rosterViewFilter === 'past'
                        ? 'You have no past completed duty records.'
                        : memberRosterAssignments.length > 0
                        ? `You have ${memberRosterAssignments.length} total scheduled duty record(s).`
                        : `No service duties are currently scheduled for ${activeMember.first_name} ${activeMember.last_name}. Please connect with your department head or church secretariat.`}
                    </p>
                  </div>
                  {memberRosterAssignments.length > 0 && rosterViewFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setRosterViewFilter('all')}
                      className="px-4 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>View All Duties ({memberRosterAssignments.length})</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Department Protocol & Coordinator Card */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-800" />
                Department Service Guidelines & Meeting Schedule
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600">
                <div className="space-y-1">
                  <strong className="text-slate-800 block">General Sanctuary Protocol:</strong>
                  <p className="text-[11px] leading-relaxed">
                    Volunteers on duty are expected to report at least 30 minutes before service start time to join the pre-service intercession altar in the inner vestry.
                  </p>
                </div>
                <div className="space-y-1">
                  <strong className="text-slate-800 block">Emergency Absences:</strong>
                  <p className="text-[11px] leading-relaxed">
                    If an unforeseen emergency arises within 12 hours of service, please click &ldquo;Request Substitute&rdquo; and immediately alert your department head via WhatsApp.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: GIVING & TITHES */}
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
                    (a.name && activeMember.last_name && a.name.toLowerCase().includes(activeMember.last_name.toLowerCase()))
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
                My Profile & Member Portal Security Settings
              </h2>
              <p className="text-xs text-slate-500">
                Keep your church contact details and member account security settings updated.
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
                  {usesPrivateCloudRoster ? 'Member Account Password' : 'Member Portal Security PIN / Password'}
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                  {usesPrivateCloudRoster
                    ? 'Update the password for your verified Supabase member account.'
                    : 'Set a private 4 to 6-digit PIN or password for your Member Portal login.'}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {usesPrivateCloudRoster ? 'New Account Password' : 'New Portal PIN / Password'}
                    </label>
                    <input
                      type="password"
                      placeholder={usesPrivateCloudRoster ? 'Enter a new password (6+ characters)' : 'Enter new 4-digit PIN'}
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
                  onChange={(e) => setGiveCategory(e.target.value as typeof giveCategory)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="Tithe">Tithe (Malachi 3:10)</option>
                  <option value="Offering">Sunday Worship Offering</option>
                  <option value="Building Fund">Cathedral Building Fund Pledge</option>
                  <option value="Seed">Sacrificial Revival Seed</option>
                  <option value="Thanksgiving">Thanksgiving / Birthday Seed</option>
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

      {/* Member Foundation School Certificate Modal */}
      {isCertificateModalOpen && activeMember && memberFoundationStudent && (
        <MemberCertificateModal
          isOpen={isCertificateModalOpen}
          onClose={() => setIsCertificateModalOpen(false)}
          member={activeMember}
          student={memberFoundationStudent}
          settings={settings}
        />
      )}

      {/* Roster Substitute Request Modal */}
      {selectedSubstituteAssignment && (
        <RequestSubstituteModal
          isOpen={Boolean(selectedSubstituteAssignment)}
          onClose={() => setSelectedSubstituteAssignment(null)}
          assignment={selectedSubstituteAssignment}
          onConfirmSubstitute={handleConfirmSubstitute}
          settings={settings}
        />
      )}

      {/* Download My Duty PDF Modal */}
      {isDownloadDutyModalOpen && activeMember && (
        <DownloadMyDutyModal
          isOpen={isDownloadDutyModalOpen}
          onClose={() => setIsDownloadDutyModalOpen(false)}
          assignments={memberRosterAssignments}
          member={activeMember}
          settings={settings}
          initialSelectedAssignmentId={dutyModalInitialAssignmentId}
        />
      )}
    </div>
  );
};
