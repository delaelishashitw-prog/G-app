import React, { useState, useMemo } from 'react';
import {
  MessageSquare,
  Send,
  Users,
  Smartphone,
  CheckCircle,
  MessageCircle,
  Sparkles,
  History,
  FileText,
  Clock,
  Calendar,
  AlertCircle,
  Layers,
  PhoneCall,
  Search,
  CheckCheck,
  RefreshCw,
  Zap,
  Filter,
  Eye,
  X,
  CreditCard,
  Copy,
  Check,
  ShieldCheck,
  Tag,
  Radio,
  Share2,
  Cake,
  Heart,
  Video,
  Play,
  CheckCircle2,
  ExternalLink,
  BellRing,
  Gift,
  Timer,
  CalendarCheck,
  ArrowRight
} from 'lucide-react';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useToast } from '../contexts/ToastContext';
import { formatGHS } from '../lib/currencyUtils';
import { Member, Visitor } from '../types/database.types';
import { BlessingGeneratorModal } from '../components/communication/BlessingGeneratorModal';
import { PastorWelcomeVideoModal } from '../components/communication/PastorWelcomeVideoModal';
import { FirstTimerWelcomeModal } from '../components/communication/FirstTimerWelcomeModal';

interface BroadcastLog {
  id: string;
  date: string;
  recipient_group: string;
  recipient_count: number;
  sender_id: string;
  message: string;
  channel: 'SMS' | 'WhatsApp';
  cost_ghs: number;
  status: 'Delivered' | 'Scheduled' | 'Processing';
  recipients_sample: string[];
}

export interface CelebrantItem {
  id: string;
  member: Member;
  type: 'birthday' | 'anniversary';
  dateStr: string;
  daysUntil: number;
  isToday: boolean;
  yearsCount: number;
  milestoneTitle: string;
  spouseName?: string;
  suggestedScripture: string;
  personalizedBlessing: string;
  smsMessage: string;
}

function getDaysUntil(dateString?: string, baseDate: Date = new Date()): { daysUntil: number; isToday: boolean; yearsCount: number } | null {
  if (!dateString) return null;
  const parts = dateString.split('-');
  if (parts.length < 3) return null;

  const eventYear = parseInt(parts[0], 10);
  const eventMonth = parseInt(parts[1], 10);
  const eventDay = parseInt(parts[2], 10);
  if (isNaN(eventMonth) || isNaN(eventDay)) return null;

  const currentYear = baseDate.getFullYear();
  const currentMonth = baseDate.getMonth() + 1;
  const currentDay = baseDate.getDate();

  if (eventMonth === currentMonth && eventDay === currentDay) {
    return {
      daysUntil: 0,
      isToday: true,
      yearsCount: Math.max(1, currentYear - eventYear),
    };
  }

  const todayMidnight = new Date(currentYear, currentMonth - 1, currentDay).getTime();
  let targetTime = new Date(currentYear, eventMonth - 1, eventDay).getTime();
  let diffDays = Math.round((targetTime - todayMidnight) / (1000 * 60 * 60 * 24));
  let yearsCount = currentYear - eventYear;

  if (diffDays < 0) {
    targetTime = new Date(currentYear + 1, eventMonth - 1, eventDay).getTime();
    diffDays = Math.round((targetTime - todayMidnight) / (1000 * 60 * 60 * 24));
    yearsCount = currentYear + 1 - eventYear;
  }

  return {
    daysUntil: diffDays,
    isToday: false,
    yearsCount: Math.max(1, yearsCount),
  };
}

function generateBirthdayBlessing(member: Member, yearsCount: number) {
  const firstName = member.first_name;
  return `Shalom ${firstName}! 🎉🎂 Prophet Elisha K. Richard, the ministerial council, and the entire Greater Works City Church (GWCC) family joyfully celebrate you on your ${yearsCount}th birthday today!\n\nAs Psalm 20:1-4 declares:\n"The Lord hear thee in the day of trouble; the name of the God of Jacob defend thee; Send thee help from the sanctuary, and strengthen thee out of Zion..."\n\nMay this new year usher in supernatural favor, long life, divine health, open heavens, and continuous kingdom elevation for you and your household! Have a glorious birthday celebration!\n\nWith pastoral blessings,\nProphet Elisha K. Richard • Greater Works City Church, Joma, Accra`;
}

function generateAnniversaryBlessing(member: Member, yearsCount: number) {
  const firstName = member.first_name;
  const spouse = member.spouse_name || 'your beloved spouse';
  return `Shalom ${firstName} & ${spouse}! 💍✨ Prophet Elisha K. Richard and the entire Greater Works City Church (GWCC) family rejoice with you on your ${yearsCount}th Wedding Anniversary today!\n\n"Therefore shall a man leave his father and his mother, and shall cleave unto his wife: and they shall be one flesh." — Genesis 2:24\n\nMay the God of peace continually preserve your home, renew your marital joy, guard your family against every trial, and multiply your generational blessings exceedingly abundantly!\n\nProphet Elisha K. Richard & GWCC Ministerial Council • Joma, Accra`;
}

function generateBirthdaySms(member: Member, yearsCount: number) {
  return `Happy ${yearsCount}th Birthday ${member.first_name}! GWCC speaks Psalm 20:1-4 blessings over your new age: divine favor, sound health & elevation. Prophet Elisha & GWCC Family.`;
}

function generateAnniversarySms(member: Member, yearsCount: number) {
  const spouse = member.spouse_name ? ` & ${member.spouse_name}` : '';
  return `Happy ${yearsCount}th Wedding Anniversary ${member.first_name}${spouse}! GWCC speaks divine peace & increasing joy over your holy union. Prophet Elisha & GWCC Council.`;
}

function generateFirstTimerWelcome(visitor: Visitor, videoLink: string) {
  const firstName = visitor.full_name.split(' ')[0];
  const prayerPart = visitor.prayer_request ? ` concerning your prayer request: "${visitor.prayer_request}"` : '';
  return `Shalom ${firstName}! 🕊️✨ Thank you for worshipping with Greater Works City Church (GWCC), Joma this Sunday! Prophet Elisha K. Richard and our entire church family were truly honored by your fellowship.\n\nPlease watch Prophet Elisha's personal welcome message and sanctuary orientation video for you here:\n👉 ${videoLink}\n\nOur pastoral intercessors are praying in faith with you${prayerPart}. You are warmly welcome to our Midweek Miracle Service this Wednesday at 6:30 PM!\n\nPastoral Care Secretariat • Greater Works City Church, Joma New Site, Accra`;
}

function generateFirstTimerSms(visitor: Visitor, videoLink: string) {
  const firstName = visitor.full_name.split(' ')[0];
  return `Shalom ${firstName}! Thank you for worshipping with GWCC Joma. Watch Prophet Elisha's welcome video for you: ${videoLink}. We are praying with you!`;
}

export const CommunicationPage: React.FC = () => {
  const { members, visitors, ministries, smallGroups, updateVisitor, logAction } = useChurchData();
  const { error: toastError, info: toastInfo, warning: toastWarning, success: toastSuccess } = useToast();

  // Navigation & Channels
  const [activeTab, setActiveTab] = useState<'radar' | 'sms' | 'whatsapp' | 'automations' | 'history'>('radar');

  // Automated Radar & Touchpoints States
  const [radarDateStr, setRadarDateStr] = useState<string>('2026-10-07');
  const [celebrantsView, setCelebrantsView] = useState<'today' | 'upcoming' | 'all'>('today');
  const [selectedCelebrantForBlessing, setSelectedCelebrantForBlessing] = useState<CelebrantItem | null>(null);
  const [customBlessingText, setCustomBlessingText] = useState('');
  const [pastorWelcomeVideoLink, setPastorWelcomeVideoLink] = useState('https://greaterworkscitychurch.org/welcome-video');
  const [isTwoHourTriggerArmed, setIsTwoHourTriggerArmed] = useState(true);
  const [selectedVisitorForWelcome, setSelectedVisitorForWelcome] = useState<Visitor | null>(null);
  const [customVisitorWelcomeText, setCustomVisitorWelcomeText] = useState('');
  const [isVideoPreviewOpen, setIsVideoPreviewOpen] = useState(false);
  const [visitorFilter, setVisitorFilter] = useState<'pending' | 'all'>('pending');

  // SMS Form State
  const [targetGroup, setTargetGroup] = useState<
    'all_members' | 'all_visitors' | 'ministry' | 'small_group' | 'leaders' | 'missing_sunday'
  >('all_members');
  const [selectedMinistryId, setSelectedMinistryId] = useState(ministries[0]?.id || '');
  const [selectedGroupId, setSelectedGroupId] = useState(smallGroups[0]?.id || '');

  const [senderId, setSenderId] = useState('GWCC');
  const [messageText, setMessageText] = useState(
    'Shalom {FirstName}! Join us this Sunday at Greater Works City Church (GWCC), Joma for our Prophetic Celebration Service at 8:30 AM. Come expecting breakthrough!'
  );
  const [scheduleType, setScheduleType] = useState<'now' | 'schedule'>('now');
  const [scheduledDateTime, setScheduledDateTime] = useState('');

  // Modals & UI helpers
  const [isPreviewRecipientsOpen, setIsPreviewRecipientsOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [copiedTemplateIdx, setCopiedTemplateIdx] = useState<number | null>(null);
  const [smsCredits, setSmsCredits] = useState(2450); // Ghana gateway balance (Hubtel/mNotify/Arkesel)

  // WhatsApp Tab State
  const [waRecipientType, setWaRecipientType] = useState<'individual' | 'broadcast'>('individual');
  const [selectedMemberForWa, setSelectedMemberForWa] = useState('');
  const [waCustomPhone, setWaCustomPhone] = useState('');
  const [waMessage, setWaMessage] = useState(
    'Shalom Beloved, greetings from Greater Works City Church, Joma. We are reaching out with love and prayer. Let us know how we can pray with you this week.'
  );

  // Broadcast History state
  const [sentBroadcasts, setSentBroadcasts] = useState<BroadcastLog[]>([
    {
      id: 'log-1',
      date: '2026-09-24 16:30',
      recipient_group: 'All Members',
      recipient_count: 8,
      sender_id: 'GWCC',
      channel: 'SMS',
      cost_ghs: 0.36,
      message: 'Beloved, remember our Midweek Teaching & Deliverance Service tonight at 6:30 PM. Come with a friend!',
      status: 'Delivered',
      recipients_sample: ['Emmanuel Mensah', 'Mary Owusu', 'Daniel Osei', 'Abigail Addo'],
    },
    {
      id: 'log-2',
      date: '2026-09-22 10:15',
      recipient_group: 'First-Time Visitors',
      recipient_count: 5,
      sender_id: 'GWCC',
      channel: 'SMS',
      cost_ghs: 0.22,
      message: 'Thank you for worshipping with Greater Works City Church. Our pastoral team is praying with you this week.',
      status: 'Delivered',
      recipients_sample: ['Kwabena Frimpong', 'Sarah Kwarteng', 'Michael Mensah'],
    },
    {
      id: 'log-3',
      date: '2026-09-19 14:00',
      recipient_group: 'Cell Leaders',
      recipient_count: 6,
      sender_id: 'GWCC',
      channel: 'WhatsApp',
      cost_ghs: 0.00,
      message: 'Dear Cell Leaders, please submit this week\'s small group attendance and offering reports by Friday noon.',
      status: 'Delivered',
      recipients_sample: ['Emmanuel Mensah', 'Daniel Osei', 'Abigail Addo'],
    },
  ]);

  // Compute targeted recipient list
  const targetedRecipients = useMemo(() => {
    if (targetGroup === 'all_members') {
      return members;
    }
    if (targetGroup === 'all_visitors') {
      return visitors.map((v) => ({
        id: v.id,
        first_name: v.full_name?.split(' ')[0] || v.full_name,
        last_name: v.full_name?.split(' ').slice(1).join(' ') || '',
        phone: v.phone,
        status: 'Visitor',
      }));
    }
    if (targetGroup === 'ministry') {
      return members.filter((m) => m.ministry_id === selectedMinistryId);
    }
    if (targetGroup === 'small_group') {
      return members.filter((m) => m.small_group_id === selectedGroupId || m.small_group_name === selectedGroupId);
    }
    if (targetGroup === 'leaders') {
      return members.filter((m) => {
        const roleStr = ((m as any).role || (m as any).title || (m as any).leadership_role || '').toLowerCase();
        return (
          roleStr.includes('leader') ||
          roleStr.includes('pastor') ||
          roleStr.includes('elder') ||
          roleStr.includes('deacon')
        );
      });
    }
    if (targetGroup === 'missing_sunday') {
      // Members without recent attendance
      return members.slice(0, Math.max(2, Math.floor(members.length / 3)));
    }
    return members;
  }, [targetGroup, members, visitors, selectedMinistryId, selectedGroupId]);

  // Phone validation breakdown
  const phoneStats = useMemo(() => {
    const valid = targetedRecipients.filter((r) => r.phone && r.phone.replace(/[^0-9]/g, '').length >= 9);
    const missing = targetedRecipients.filter((r) => !r.phone || r.phone.replace(/[^0-9]/g, '').length < 9);
    return {
      validCount: valid.length,
      missingCount: missing.length,
      validList: valid,
      missingList: missing,
    };
  }, [targetedRecipients]);

  // Character and SMS pages calculation
  const charLength = messageText.length;
  // Standard GSM SMS page: 160 characters (or 153 chars for multipart)
  const smsPages = charLength <= 160 ? 1 : Math.ceil(charLength / 153);
  const costPerSms = 0.045; // 4.5 Ghana Pesewas per SMS page in Ghana
  const estimatedCostGHS = (phoneStats.validCount * smsPages * costPerSms);

  // Ghanaian Church SMS Templates
  const templates = [
    {
      title: 'Sunday Prophetic Service',
      category: 'Services',
      text: 'Shalom {FirstName}! Join us this Sunday at Greater Works City Church (GWCC), Joma for our Prophetic Celebration Service at 8:30 AM. Come expecting breakthrough!',
    },
    {
      title: 'Midweek Teaching & Deliverance',
      category: 'Services',
      text: 'Beloved {FirstName}, join us this Wednesday at 6:30 PM for our Midweek Miracle & Teaching Service at the GWCC Auditorium, Joma. Your situation will not defeat you!',
    },
    {
      title: 'First-Time Visitor Follow-up',
      category: 'Visitors',
      text: 'Shalom {FirstName}! Thank you for worshiping with us at Greater Works City Church, Joma. We were blessed by your presence. Our pastoral prayer team is standing with you.',
    },
    {
      title: 'Friday All-Night Vigil Alert',
      category: 'Services',
      text: 'Prophetic All-Night Alert: Join Prophet & the GWCC saints tonight from 10:00 PM at GWCC Joma. Come with your prayer points for divine intervention!',
    },
    {
      title: 'Pastoral "We Missed You" Alert',
      category: 'Pastoral',
      text: 'Beloved {FirstName}, the pastoral team and family at GWCC missed you in church recently. We pray you are well. Call us or reply if you need any prayer support!',
    },
    {
      title: 'Birthday & Anniversary Blessings',
      category: 'Celebration',
      text: 'Happy Birthday {FirstName}! The leadership and congregation of Greater Works City Church celebrate you today. May God increase your grace and honor this year!',
    },
    {
      title: 'Cell Fellowship Reminder',
      category: 'Small Groups',
      text: 'Beloved, our community cell fellowship meets tonight at 7:00 PM. Let us gather in Christian love, Bible study, and prayer. See you there!',
    },
  ];

  // Merge Tag Inserter
  const handleInsertTag = (tag: string) => {
    setMessageText((prev) => prev + ` ${tag}`);
  };

  // Dispatch Broadcast Handler
  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    if (phoneStats.validCount === 0) {
      toastWarning('Broadcast Target', 'There are no valid phone numbers in the selected target group.');
      return;
    }

    if (smsCredits < phoneStats.validCount * smsPages) {
      toastError('Ghana SMS Gateway', 'Insufficient Ghana SMS Gateway credits. Please top up your gateway units.');
      return;
    }

    let groupName = 'All Members';
    if (targetGroup === 'all_visitors') groupName = 'First-Time Visitors';
    if (targetGroup === 'ministry') {
      const min = ministries.find((m) => m.id === selectedMinistryId);
      groupName = min ? min.name : 'Ministry Department';
    }
    if (targetGroup === 'small_group') {
      const grp = smallGroups.find((g) => g.id === selectedGroupId);
      groupName = grp ? grp.name : 'Cell Group';
    }
    if (targetGroup === 'leaders') groupName = 'Church Leaders & Workers';
    if (targetGroup === 'missing_sunday') groupName = 'Recent Absentee Members';

    const newLog: BroadcastLog = {
      id: `log-${Date.now()}`,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      recipient_group: groupName,
      recipient_count: phoneStats.validCount,
      sender_id: senderId,
      channel: 'SMS',
      cost_ghs: Number(estimatedCostGHS.toFixed(2)),
      message: messageText,
      status: scheduleType === 'schedule' ? 'Scheduled' : 'Delivered',
      recipients_sample: phoneStats.validList.slice(0, 4).map((r) => `${r.first_name} ${r.last_name || ''}`.trim()),
    };

    setSentBroadcasts([newLog, ...sentBroadcasts]);
    setSmsCredits((prev) => Math.max(0, prev - phoneStats.validCount * smsPages));

    const statusMsg = scheduleType === 'schedule'
      ? `Broadcast scheduled for ${scheduledDateTime || 'selected time'} to ${phoneStats.validCount} recipients!`
      : `Dispatched Bulk SMS via Ghana Gateway to ${phoneStats.validCount} numbers! (Total: ${smsPages} pages/recipient)`;

    setNotification(statusMsg);
    setTimeout(() => setNotification(null), 5000);
  };

  // Launch Direct WhatsApp
  const handleLaunchWhatsApp = (phone: string, text: string) => {
    if (!phone) {
      toastWarning('WhatsApp Notice', 'No valid phone number provided.');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const fullPhone = cleanPhone.startsWith('0')
      ? '233' + cleanPhone.substring(1)
      : cleanPhone.startsWith('233')
      ? cleanPhone
      : '233' + cleanPhone;

    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`;
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  const baseDate = useMemo(() => {
    if (!radarDateStr) return new Date();
    const parts = radarDateStr.split('-');
    if (parts.length < 3) return new Date();
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
  }, [radarDateStr]);

  // Automated Celebrant Radar Computation
  const celebrants = useMemo<CelebrantItem[]>(() => {
    const list: CelebrantItem[] = [];

    members.forEach((m) => {
      // 1. Birthday
      if (m.date_of_birth) {
        const res = getDaysUntil(m.date_of_birth, baseDate);
        if (res && res.daysUntil <= 7) {
          list.push({
            id: `bday-${m.id}`,
            member: m,
            type: 'birthday',
            dateStr: m.date_of_birth,
            daysUntil: res.daysUntil,
            isToday: res.isToday,
            yearsCount: res.yearsCount,
            milestoneTitle: `Turning ${res.yearsCount} Years`,
            suggestedScripture: 'Psalm 20:1-4 & Numbers 6:24-26',
            personalizedBlessing: generateBirthdayBlessing(m, res.yearsCount),
            smsMessage: generateBirthdaySms(m, res.yearsCount),
          });
        }
      }

      // 2. Wedding Anniversary
      if (m.wedding_anniversary) {
        const res = getDaysUntil(m.wedding_anniversary, baseDate);
        if (res && res.daysUntil <= 7) {
          const spouse = m.spouse_name ? ` (with ${m.spouse_name})` : '';
          list.push({
            id: `anniv-${m.id}`,
            member: m,
            type: 'anniversary',
            dateStr: m.wedding_anniversary,
            daysUntil: res.daysUntil,
            isToday: res.isToday,
            yearsCount: res.yearsCount,
            milestoneTitle: `${res.yearsCount}th Wedding Anniversary${spouse}`,
            spouseName: m.spouse_name,
            suggestedScripture: 'Genesis 2:24 & Ephesians 5:31-33',
            personalizedBlessing: generateAnniversaryBlessing(m, res.yearsCount),
            smsMessage: generateAnniversarySms(m, res.yearsCount),
          });
        }
      }
    });

    return list.sort((a, b) => a.daysUntil - b.daysUntil);
  }, [members, baseDate]);

  const todayCelebrants = useMemo(() => celebrants.filter((c) => c.isToday), [celebrants]);
  const upcomingCelebrants = useMemo(() => celebrants.filter((c) => !c.isToday), [celebrants]);

  // Post-Service First-Timer Queue
  const pendingFirstTimers = useMemo(() => {
    return visitors.filter((v) => v.follow_up_status === 'new' || v.visit_date >= '2026-10-01');
  }, [visitors]);

  // Actions for Birthday & Anniversary Engine
  const handleOpenBlessingModal = (c: CelebrantItem) => {
    setSelectedCelebrantForBlessing(c);
    setCustomBlessingText(c.personalizedBlessing);
  };

  const handleSendCelebrantSms = (c: CelebrantItem, customText?: string) => {
    const textToSend = customText || c.smsMessage;
    const charCount = textToSend.length;
    const pages = charCount <= 160 ? 1 : Math.ceil(charCount / 153);
    if (smsCredits < pages) {
      toastError('Insufficient Credits', `Requires ${pages} SMS credits.`);
      return;
    }
    setSmsCredits((prev) => Math.max(0, prev - pages));
    const newLog: BroadcastLog = {
      id: `log-${Date.now()}`,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      recipient_group: c.type === 'birthday' ? 'Birthday Celebrant' : 'Anniversary Celebrant',
      recipient_count: 1,
      sender_id: senderId,
      channel: 'SMS',
      cost_ghs: Number((pages * 0.045).toFixed(3)),
      message: textToSend,
      status: 'Delivered',
      recipients_sample: [`${c.member.first_name} ${c.member.last_name}`],
    };
    setSentBroadcasts((prev) => [newLog, ...prev]);
    logAction(
      'CELEBRANT_SMS_DISPATCH',
      'Communication',
      `Sent ${c.type} blessing SMS to ${c.member.first_name} ${c.member.last_name} (${c.member.phone})`,
      c.member.id
    );
    toastSuccess('SMS Blessing Dispatched', `Sent scheduled ${c.type} blessing to ${c.member.first_name} ${c.member.last_name}!`);
  };

  const handleBroadcastAllTodayCelebrants = () => {
    if (todayCelebrants.length === 0) {
      toastWarning('No Celebrants', 'There are no active celebrants identified for today.');
      return;
    }
    if (smsCredits < todayCelebrants.length) {
      toastError('Insufficient Credits', `Requires ${todayCelebrants.length} SMS units.`);
      return;
    }
    setSmsCredits((prev) => Math.max(0, prev - todayCelebrants.length));
    const newLog: BroadcastLog = {
      id: `log-${Date.now()}`,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      recipient_group: "Today's Daily Celebrants Radar",
      recipient_count: todayCelebrants.length,
      sender_id: senderId,
      channel: 'SMS',
      cost_ghs: Number((todayCelebrants.length * 0.045).toFixed(2)),
      message: 'Automated morning radar birthday & wedding anniversary blessings broadcast.',
      status: 'Delivered',
      recipients_sample: todayCelebrants.map((c) => `${c.member.first_name} ${c.member.last_name}`),
    };
    setSentBroadcasts((prev) => [newLog, ...prev]);
    logAction(
      'MORNING_RADAR_BROADCAST',
      'Communication',
      `Dispatched morning radar broadcast to ${todayCelebrants.length} daily celebrants`
    );
    toastSuccess('Morning Radar Broadcast Executed', `Delivered personalized blessing SMS to all ${todayCelebrants.length} today's celebrants!`);
  };

  // Actions for Post-Service First-Timer Trigger
  const handleOpenVisitorWelcomeModal = (v: Visitor) => {
    setSelectedVisitorForWelcome(v);
    setCustomVisitorWelcomeText(generateFirstTimerWelcome(v, pastorWelcomeVideoLink));
  };

  const handleExecuteFirstTimerTrigger = () => {
    if (pendingFirstTimers.length === 0) {
      toastInfo('No Pending First-Timers', 'All first-timers have already received their post-service welcome.');
      return;
    }
    if (smsCredits < pendingFirstTimers.length) {
      toastError('Insufficient Credits', `Requires ${pendingFirstTimers.length} SMS credits.`);
      return;
    }
    setSmsCredits((prev) => Math.max(0, prev - pendingFirstTimers.length));

    // Update visitor follow_up_status
    pendingFirstTimers.forEach((v) => {
      updateVisitor(v.id, {
        follow_up_status: 'contacted',
        notes: `${v.notes ? v.notes + ' • ' : ''}Automated post-service thank-you with welcome video link dispatched`,
      });
    });

    const newLog: BroadcastLog = {
      id: `log-${Date.now()}`,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      recipient_group: 'Post-Service First-Timers (2-Hour Window)',
      recipient_count: pendingFirstTimers.length,
      sender_id: senderId,
      channel: 'SMS',
      cost_ghs: Number((pendingFirstTimers.length * 0.045).toFixed(2)),
      message: `Shalom! Thank you for worshipping with GWCC Joma. Watch Prophet Elisha's welcome video: ${pastorWelcomeVideoLink}. We are praying with you!`,
      status: 'Delivered',
      recipients_sample: pendingFirstTimers.map((v) => v.full_name),
    };
    setSentBroadcasts((prev) => [newLog, ...prev]);
    logAction(
      'POST_SERVICE_TRIGGER_EXECUTE',
      'Communication',
      `Executed 2-hour post-service dispatch with welcome video link to ${pendingFirstTimers.length} first-timers`
    );
    toastSuccess(
      'Post-Service Trigger Executed',
      `Dispatched automated thank-you messages with Prophet Elisha's welcome video link to ${pendingFirstTimers.length} first-timers!`
    );
  };

  const handleSendSingleFirstTimerSms = (v: Visitor, customText?: string) => {
    const textToSend = customText || generateFirstTimerSms(v, pastorWelcomeVideoLink);
    const charCount = textToSend.length;
    const pages = charCount <= 160 ? 1 : Math.ceil(charCount / 153);
    if (smsCredits < pages) {
      toastError('Insufficient Credits', `Requires ${pages} SMS credits.`);
      return;
    }
    setSmsCredits((prev) => Math.max(0, prev - pages));
    updateVisitor(v.id, {
      follow_up_status: 'contacted',
      notes: `${v.notes ? v.notes + ' • ' : ''}Post-service welcome video SMS sent`,
    });
    const newLog: BroadcastLog = {
      id: `log-${Date.now()}`,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      recipient_group: 'First-Timer Post-Service Welcome',
      recipient_count: 1,
      sender_id: senderId,
      channel: 'SMS',
      cost_ghs: Number((pages * 0.045).toFixed(3)),
      message: textToSend,
      status: 'Delivered',
      recipients_sample: [v.full_name],
    };
    setSentBroadcasts((prev) => [newLog, ...prev]);
    logAction('FIRST_TIMER_SMS', 'Communication', `Sent welcome video SMS to ${v.full_name}`, v.id);
    toastSuccess('First-Timer Welcome Sent', `Sent thank-you SMS with video link to ${v.full_name}!`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-950 via-[#064e3b] to-emerald-900 p-6 rounded-3xl text-white shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-emerald-700/60 rounded-xl">
              <MessageSquare className="w-5 h-5 text-emerald-200" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Congregational Outreach & Messaging
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Communication & Ghana Bulk SMS Gateway
          </h1>
          <p className="text-xs text-emerald-100/90 mt-1 max-w-xl">
            NCA-approved Sender ID (<span className="font-mono font-bold text-emerald-200">GWCC</span>),
            direct SMS broadcasts, WhatsApp ministerial chats, and automated follow-ups across Accra.
          </p>
        </div>

        {/* Gateway Balance Card */}
        <div className="flex items-center gap-3 bg-white/10 border border-white/20 p-3.5 rounded-2xl backdrop-blur-xs">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-200">
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>Gateway SMS Balance</span>
            </div>
            <p className="text-xl font-extrabold text-white mt-0.5 font-mono">{smsCredits.toLocaleString()} Units</p>
            <p className="text-[10px] text-emerald-300">≈ {formatGHS((smsCredits * costPerSms))}</p>
          </div>
          <button
            onClick={() => {
              setSmsCredits((prev) => prev + 1000);
              setNotification('Added 1,000 SMS top-up units to your Ghana Gateway balance!');
              setTimeout(() => setNotification(null), 4000);
            }}
            className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition shadow-xs"
            title="Top up SMS credits"
          >
            + Top Up
          </button>
        </div>
      </div>

      {notification && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-700 hover:text-emerald-900">
            ✕
          </button>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-4 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('radar')}
          className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 transition shrink-0 ${
            activeTab === 'radar'
              ? 'border-[#064e3b] text-[#064e3b]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
          <span>Automated Broadcast Radar</span>
          {todayCelebrants.length > 0 && (
            <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-extrabold rounded-full">
              {todayCelebrants.length} Today
            </span>
          )}
          {pendingFirstTimers.length > 0 && (
            <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-extrabold rounded-full">
              {pendingFirstTimers.length} New
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('sms')}
          className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 transition shrink-0 ${
            activeTab === 'sms'
              ? 'border-[#064e3b] text-[#064e3b]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Ghana Bulk SMS Gateway</span>
        </button>

        <button
          onClick={() => setActiveTab('whatsapp')}
          className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 transition shrink-0 ${
            activeTab === 'whatsapp'
              ? 'border-[#064e3b] text-[#064e3b]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <MessageCircle className="w-4 h-4 text-emerald-600" />
          <span>WhatsApp Pastoral Direct</span>
        </button>

        <button
          onClick={() => setActiveTab('automations')}
          className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 transition shrink-0 ${
            activeTab === 'automations'
              ? 'border-[#064e3b] text-[#064e3b]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-600" />
          <span>Smart Ministerial Triggers</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 transition shrink-0 ${
            activeTab === 'history'
              ? 'border-[#064e3b] text-[#064e3b]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Dispatch History & Logs ({sentBroadcasts.length})</span>
        </button>
      </div>

      {/* TAB 0: AUTOMATED BROADCAST RADAR & PASTORAL TOUCHPOINTS */}
      {activeTab === 'radar' && (
        <div className="space-y-6">
          {/* Top Live Touchpoints Control Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Radar Card 1: Morning Celebrants Radar */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-rose-50 text-rose-600 rounded-2xl">
                      <Radio className="w-4 h-4 animate-pulse" />
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Morning Celebrants Radar
                    </span>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                    Active (06:00 GMT)
                  </span>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-black text-slate-900 tracking-tight">
                    {todayCelebrants.length}{' '}
                    <span className="text-sm font-semibold text-slate-500">Today</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {todayCelebrants.filter((c) => c.type === 'birthday').length} Birthdays •{' '}
                    {todayCelebrants.filter((c) => c.type === 'anniversary').length} Wedding Anniversaries
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">1-click automated SMS/WhatsApp</span>
                <button
                  type="button"
                  disabled={todayCelebrants.length === 0}
                  onClick={handleBroadcastAllTodayCelebrants}
                  className="px-3 py-1.5 bg-[#064e3b] hover:bg-[#047857] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Broadcast All ({todayCelebrants.length})</span>
                </button>
              </div>
            </div>

            {/* Radar Card 2: Post-Service First-Timer Trigger */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-amber-50 text-amber-600 rounded-2xl">
                      <Timer className="w-4 h-4" />
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Post-Service 2-Hour Trigger
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTwoHourTriggerArmed(!isTwoHourTriggerArmed)}
                    className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full transition flex items-center gap-1 ${
                      isTwoHourTriggerArmed
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isTwoHourTriggerArmed ? 'bg-emerald-600 animate-pulse' : 'bg-slate-400'}`} />
                    {isTwoHourTriggerArmed ? 'Armed' : 'Standby'}
                  </button>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-black text-slate-900 tracking-tight">
                    {pendingFirstTimers.length}{' '}
                    <span className="text-sm font-semibold text-slate-500">First-Timers</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sunday Prophetic Service dismissal • 2-hour window active
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsVideoPreviewOpen(true)}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 hover:underline"
                >
                  <Video className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Welcome Video Link</span>
                </button>
                <button
                  type="button"
                  disabled={pendingFirstTimers.length === 0}
                  onClick={handleExecuteFirstTimerTrigger}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Execute Dispatch</span>
                </button>
              </div>
            </div>

            {/* Radar Card 3: Live Radar Engine Date Simulator */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-blue-50 text-blue-600 rounded-2xl">
                      <Calendar className="w-4 h-4" />
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Radar Schedule & Test Date
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    Ghana GMT
                  </span>
                </div>
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={radarDateStr}
                      onChange={(e) => setRadarDateStr(e.target.value)}
                      className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setRadarDateStr('2026-10-07')}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition"
                      title="Set to today (Oct 7, 2026)"
                    >
                      Today
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Allows simulating morning radar scans across any church date.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Total GWCC Members: <strong className="font-bold text-slate-800">{members.length}</strong></span>
                <span>Gateway Units: <strong className="font-mono text-emerald-800 font-bold">{smsCredits}</strong></span>
              </div>
            </div>
          </div>

          {/* SECTION 1: CONGREGATIONAL BIRTHDAY & ANNIVERSARY ENGINE */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-amber-50 text-amber-600 rounded-xl">
                    <Cake className="w-4 h-4" />
                  </span>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    Congregational Birthday & Anniversary Engine
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automated morning radar scans identify celebrants with 1-click personalized WhatsApp blessings & scheduled SMS broadcast.
                </p>
              </div>

              {/* View filters & Action */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex bg-slate-100 p-1 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setCelebrantsView('today')}
                    className={`px-3 py-1 rounded-lg font-bold transition ${
                      celebrantsView === 'today'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Today's Celebrants ({todayCelebrants.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCelebrantsView('upcoming')}
                    className={`px-3 py-1 rounded-lg font-bold transition ${
                      celebrantsView === 'upcoming'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Upcoming 7 Days ({upcomingCelebrants.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCelebrantsView('all')}
                    className={`px-3 py-1 rounded-lg font-bold transition ${
                      celebrantsView === 'all'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    All Window ({celebrants.length})
                  </button>
                </div>

                <button
                  type="button"
                  disabled={todayCelebrants.length === 0}
                  onClick={handleBroadcastAllTodayCelebrants}
                  className="px-3.5 py-2 bg-[#064e3b] hover:bg-[#047857] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Broadcast Today's Celebrants ({todayCelebrants.length})</span>
                </button>
              </div>
            </div>

            {/* Celebrants Grid */}
            {celebrantsView === 'today' && todayCelebrants.length === 0 ? (
              <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <Sparkles className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm font-bold text-slate-700">No Celebrants Identified for Today ({radarDateStr})</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Click "Upcoming 7 Days" to review the week's celebrants, or switch the date above to test other calendar dates.
                </p>
                <button
                  type="button"
                  onClick={() => setCelebrantsView('upcoming')}
                  className="mt-2 px-3.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-xl text-xs font-bold"
                >
                  View Upcoming 7 Days ({upcomingCelebrants.length})
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(celebrantsView === 'today' ? todayCelebrants : celebrantsView === 'upcoming' ? upcomingCelebrants : celebrants).map((c) => {
                  const isBirthday = c.type === 'birthday';
                  return (
                    <div
                      key={c.id}
                      className={`p-5 rounded-2xl border transition shadow-xs space-y-3 ${
                        c.isToday
                          ? isBirthday
                            ? 'border-amber-200 bg-amber-50/20'
                            : 'border-emerald-200 bg-emerald-50/20'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {/* Celebrant Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                            isBirthday ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {isBirthday ? <Cake className="w-5 h-5" /> : <Heart className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-slate-900">
                                {c.member.first_name} {c.member.last_name}
                              </h4>
                              <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                                c.isToday
                                  ? 'bg-rose-500 text-white animate-pulse'
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                {c.isToday ? 'Today!' : `In ${c.daysUntil} days`}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-slate-600 mt-0.5">
                              {c.milestoneTitle}
                            </p>
                          </div>
                        </div>

                        <span className="text-[11px] font-mono text-slate-400">
                          {c.dateStr}
                        </span>
                      </div>

                      {/* Ministry, Cell & Scripture Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        {c.member.phone && (
                          <span className="px-2 py-0.5 bg-slate-100 font-mono text-slate-700 rounded-lg">
                            {c.member.phone}
                          </span>
                        )}
                        {c.member.ministry_name && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-100">
                            {c.member.ministry_name}
                          </span>
                        )}
                        {c.member.small_group_name && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded-lg border border-blue-100">
                            {c.member.small_group_name}
                          </span>
                        )}
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-800 rounded-lg border border-purple-100 font-medium">
                          📖 {c.suggestedScripture}
                        </span>
                      </div>

                      {/* Blessing Text Snippet */}
                      <div className="p-3 bg-white/80 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed font-sans line-clamp-3">
                        {c.personalizedBlessing}
                      </div>

                      {/* Actions */}
                      <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenBlessingModal(c)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>WhatsApp Blessing Studio</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          {c.member.phone && (
                            <button
                              type="button"
                              onClick={() => handleLaunchWhatsApp(c.member.phone, c.personalizedBlessing)}
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1"
                              title="Direct WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span>WhatsApp</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleSendCelebrantSms(c)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
                            title="Send scheduled Ghana SMS"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>SMS</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 2: POST-SERVICE FIRST-TIMER TRIGGER (2-HOUR WINDOW) */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-xl">
                    <Users className="w-4 h-4" />
                  </span>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    Post-Service First-Timer Trigger (2-Hour Window)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automated thank-you messages and personal orientation videos dispatched to first-timers within 2 hours of Sunday service dismissal.
                </p>
              </div>

              {/* Action */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsVideoPreviewOpen(true)}
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Video className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Preview Welcome Video</span>
                </button>

                <button
                  type="button"
                  disabled={pendingFirstTimers.length === 0}
                  onClick={handleExecuteFirstTimerTrigger}
                  className="px-3.5 py-2 bg-[#064e3b] hover:bg-[#047857] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Execute 2-Hour Dispatch ({pendingFirstTimers.length})</span>
                </button>
              </div>
            </div>

            {/* Video Link & Trigger Bar */}
            <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-emerald-950">Active Welcome Video Link:</span>
                  <span className="font-mono text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200 font-semibold truncate max-w-xs">
                    {pastorWelcomeVideoLink}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Prophet Elisha K. Richard welcome orientation & sanctuary tour link is automatically embedded into all touchpoints.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsVideoPreviewOpen(true)}
                  className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1"
                >
                  <Play className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Test Video Link</span>
                </button>
              </div>
            </div>

            {/* First Timers List */}
            {pendingFirstTimers.length === 0 ? (
              <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="text-sm font-bold text-slate-700">All First-Timers Have Received Welcome Messages</p>
                <p className="text-xs text-slate-400">
                  No pending first-time visitors in the 2-hour post-service dispatch queue.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingFirstTimers.map((v) => {
                  const welcomeMsg = generateFirstTimerWelcome(v, pastorWelcomeVideoLink);
                  return (
                    <div
                      key={v.id}
                      className="p-4 rounded-2xl border border-slate-200 hover:border-emerald-300 bg-white transition space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                            {v.full_name.split(' ').map((n) => n[0]).join('').substring(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-slate-900">{v.full_name}</h4>
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">
                                2-Hour Window Pending
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">
                              Attended {v.service_attended || 'Sunday Service'} • Visited {v.visit_date}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
                          <span>{v.phone || 'No phone'}</span>
                        </div>
                      </div>

                      {v.prayer_request && (
                        <div className="p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900">
                          <strong>Personal Prayer Request:</strong> "{v.prayer_request}"
                        </div>
                      )}

                      {/* Message Preview */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed font-sans line-clamp-2">
                        {welcomeMsg}
                      </div>

                      {/* Actions */}
                      <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenVisitorWelcomeModal(v)}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Customize & Review Message</span>
                        </button>

                        <div className="flex items-center gap-2">
                          {v.phone && (
                            <button
                              type="button"
                              onClick={() => handleLaunchWhatsApp(v.phone, welcomeMsg)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>WhatsApp Welcome</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleSendSingleFirstTimerSms(v)}
                            className="px-3 py-1.5 bg-[#064e3b] hover:bg-[#047857] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Send Ghana SMS</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: BULK SMS GATEWAY */}
      {activeTab === 'sms' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: SMS Compose Form */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-700" />
                  Compose Ghana Bulk SMS Broadcast
                </h3>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> NCA Registered Alphanumeric
                </span>
              </div>

              <form onSubmit={handleSendBroadcast} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Approved Sender ID</label>
                    <input
                      type="text"
                      maxLength={11}
                      value={senderId}
                      onChange={(e) => setSenderId(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold tracking-wider text-slate-800"
                    />
                    <span className="text-[10px] text-slate-400">Max 11 alphanumeric characters</span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Target Congregation Audience</label>
                    <select
                      value={targetGroup}
                      onChange={(e) => setTargetGroup(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                    >
                      <option value="all_members">All Registered Members ({members.length})</option>
                      <option value="all_visitors">All First-Time Visitors ({visitors.length})</option>
                      <option value="leaders">Church Leaders & Elders Only</option>
                      <option value="missing_sunday">Members Absent Recently</option>
                      <option value="ministry">Specific Ministry Department</option>
                      <option value="small_group">Specific Cell / Small Group</option>
                    </select>
                  </div>
                </div>

                {targetGroup === 'ministry' && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Select Ministry Department</label>
                    <select
                      value={selectedMinistryId}
                      onChange={(e) => setSelectedMinistryId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    >
                      {ministries.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {targetGroup === 'small_group' && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Select Cell Group</label>
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    >
                      {smallGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.zone})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Recipient breakdown bar */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-700">
                      Recipients: <strong className="text-emerald-800">{phoneStats.validCount} valid Ghana phones</strong>
                    </span>
                    {phoneStats.missingCount > 0 && (
                      <span className="text-[11px] text-amber-700 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        {phoneStats.missingCount} lack valid phone numbers
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPreviewRecipientsOpen(true)}
                    className="text-xs font-bold text-emerald-800 hover:text-emerald-900 flex items-center gap-1 hover:underline"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview Recipients</span>
                  </button>
                </div>

                {/* Merge Tags Shortcuts */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-semibold text-slate-700">Personalization Tags</label>
                    <span className="text-[10px] text-slate-400">Click to insert tag into message</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleInsertTag('{FirstName}')}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg text-slate-700 font-mono text-[11px] border border-slate-200 transition"
                    >
                      + {'{FirstName}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertTag('{FullName}')}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg text-slate-700 font-mono text-[11px] border border-slate-200 transition"
                    >
                      + {'{FullName}'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertTag('Greater Works City Church')}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg text-slate-700 text-[11px] border border-slate-200 transition"
                    >
                      + Church Name
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertTag('Sunday 8:30 AM')}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg text-slate-700 text-[11px] border border-slate-200 transition"
                    >
                      + Service Time
                    </button>
                  </div>
                </div>

                {/* Message Body */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700">SMS Message Body *</label>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                        charLength > 160 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {charLength} chars • {smsPages} {smsPages === 1 ? 'page' : 'pages'}
                      </span>
                    </div>
                  </div>
                  <textarea
                    rows={4}
                    required
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-emerald-600 focus:ring-1 focus:ring-emerald-600"
                    placeholder="Type church broadcast message..."
                  />
                </div>

                {/* Dispatch Scheduling Options */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                      <input
                        type="radio"
                        name="schedule"
                        checked={scheduleType === 'now'}
                        onChange={() => setScheduleType('now')}
                        className="text-emerald-700"
                      />
                      <span>Send Immediately</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                      <input
                        type="radio"
                        name="schedule"
                        checked={scheduleType === 'schedule'}
                        onChange={() => setScheduleType('schedule')}
                        className="text-emerald-700"
                      />
                      <span>Schedule for Later</span>
                    </label>
                  </div>

                  {scheduleType === 'schedule' && (
                    <div className="pt-2">
                      <input
                        type="datetime-local"
                        value={scheduledDateTime}
                        onChange={(e) => setScheduledDateTime(e.target.value)}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                      <span className="text-[10px] text-slate-500 ml-2">Ghana Time (GMT)</span>
                    </div>
                  )}
                </div>

                {/* Summary & Dispatch Action */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
                  <div className="text-xs text-slate-600 space-y-0.5">
                    <div>
                      Cost Estimate:{' '}
                      <strong className="text-emerald-800 font-mono font-bold">
                        {formatGHS(estimatedCostGHS)}
                      </strong>{' '}
                      ({phoneStats.validCount * smsPages} units)
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Remaining balance after dispatch:{' '}
                      <strong className="font-mono text-slate-600">
                        {Math.max(0, smsCredits - phoneStats.validCount * smsPages)} units
                      </strong>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={phoneStats.validCount === 0}
                    className="px-6 py-2.5 bg-[#064e3b] hover:bg-[#047857] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2 transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{scheduleType === 'schedule' ? 'Schedule Broadcast' : 'Send Broadcast Now'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Quick SMS Preview Card */}
            <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Recipient Handset Preview
              </span>
              <div className="max-w-md mx-auto p-4 bg-white rounded-2xl shadow-sm border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between border-b pb-1.5 text-[11px] text-slate-400">
                  <span className="font-bold text-slate-800 font-mono">From: {senderId}</span>
                  <span>Now</span>
                </div>
                <p className="text-slate-800 leading-relaxed">
                  {messageText.replace('{FirstName}', 'Kwame').replace('{FullName}', 'Kwame Mensah')}
                </p>
                <div className="text-right text-[10px] text-slate-400 font-mono">
                  {charLength} chars
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: Instant Ghanaian Templates & WhatsApp Tip */}
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Church SMS Templates
                </h3>
                <span className="text-[10px] text-slate-400">1-click insert</span>
              </div>
              <p className="text-xs text-slate-500">
                Standardized Ghanaian ministerial copy tailored for Greater Works City Church:
              </p>

              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {templates.map((tpl, i) => (
                  <div
                    key={i}
                    onClick={() => setMessageText(tpl.text)}
                    className="p-3 border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50/40 rounded-xl cursor-pointer transition space-y-1 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 group-hover:text-emerald-900">
                        {tpl.title}
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        {tpl.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-2">{tpl.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Direct WhatsApp Callout */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs space-y-2 text-emerald-950">
              <span className="font-bold flex items-center gap-1.5 text-emerald-900">
                <Smartphone className="w-4 h-4 text-emerald-700" /> WhatsApp Integration
              </span>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Need to reach members without incurring SMS costs? Switch to the <strong>WhatsApp Pastoral Direct</strong> tab above for pre-formatted WhatsApp chat dispatch.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WHATSAPP DIRECT MESSAGING */}
      {activeTab === 'whatsapp' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                WhatsApp Direct Pastoral Outreach
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Send personal greetings, devotionals, or pastoral follow-ups directly to individual Ghanaian numbers via WhatsApp.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select Church Member</label>
                  <select
                    value={selectedMemberForWa}
                    onChange={(e) => {
                      setSelectedMemberForWa(e.target.value);
                      const m = members.find((mem) => mem.id === e.target.value);
                      if (m && m.phone) {
                        setWaCustomPhone(m.phone);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="">-- Choose from Member directory --</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.first_name} {m.last_name} ({m.phone || 'No phone'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number (Ghana)</label>
                  <input
                    type="tel"
                    value={waCustomPhone}
                    onChange={(e) => setWaCustomPhone(e.target.value)}
                    placeholder="+233 24 000 0000 or 0240000000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">WhatsApp Message Body</label>
                <textarea
                  rows={4}
                  value={waMessage}
                  onChange={(e) => setWaMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <span className="text-slate-400 text-[11px]">Free messaging via official WhatsApp Web / Mobile app</span>
                <button
                  type="button"
                  onClick={() => handleLaunchWhatsApp(waCustomPhone, waMessage)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Launch WhatsApp Chat</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Col: Quick Visitor Follow-up WhatsApp list */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-700" />
              Quick WhatsApp First-Timers
            </h4>
            <p className="text-[11px] text-slate-500">
              One-click follow-up chats with recent church visitors:
            </p>

            <div className="divide-y divide-slate-100 text-xs">
              {visitors.slice(0, 5).map((v) => (
                <div key={v.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-800">{v.full_name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{v.phone || 'No phone'}</p>
                  </div>
                  {v.phone && (
                    <button
                      onClick={() =>
                        handleLaunchWhatsApp(
                          v.phone,
                          `Shalom ${v.full_name.split(' ')[0]}! Thank you for worshiping with us at Greater Works City Church (GWCC), Joma. Our prayer team is with you. How can we pray for you?`
                        )
                      }
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Chat</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUTOMATIONS & MINISTERIAL TRIGGERS */}
      {activeTab === 'automations' && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-2xl border border-slate-200">
            <h3 className="font-bold text-sm text-slate-900">Configured Automated Ministerial Workflows</h3>
            <p className="text-xs text-slate-500">
              Automated notifications sent through Ghana Bulk SMS gateway based on system events.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">Member Birthday Blessings</h4>
                    <p className="text-[11px] text-slate-400">Triggers on member date of birth at 07:00 AM</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                  Active
                </span>
              </div>
              <p className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-100 font-mono">
                "Happy Birthday {'{FirstName}'}! On this special day, Greater Works City Church speaks divine increase and divine favor into your year ahead!"
              </p>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">Visitor Day 1 Welcome</h4>
                    <p className="text-[11px] text-slate-400">Triggers Monday 09:00 AM after first visit</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                  Active
                </span>
              </div>
              <p className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-100 font-mono">
                "Beloved {'{FirstName}'}, thank you for worshipping with GWCC Joma. We pray the word of God ministered into your life. You are always welcome!"
              </p>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">Tithe & Offering Gratitude</h4>
                    <p className="text-[11px] text-slate-400">Triggers immediately upon finance entry</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                  Active
                </span>
              </div>
              <p className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-100 font-mono">
                "Dear {'{FirstName}'}, GWCC acknowledges your faithful tithe of {'{Amount}'}. May Malachi 3:10 open heaven's windows over your household!"
              </p>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">Midweek Service Reminder</h4>
                    <p className="text-[11px] text-slate-400">Triggers Wednesdays at 12:00 PM</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                  Active
                </span>
              </div>
              <p className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-100 font-mono">
                "Shalom! Reminder: Midweek Miracle Service starts tonight at 6:30 PM at GWCC Auditorium. Prepare your heart for divine encounters!"
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DISPATCH HISTORY & LOGS */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-500" />
              Recent Broadcast Dispatches & Delivery Logs
            </h4>
            <span className="text-xs text-slate-500 font-medium">Total: {sentBroadcasts.length} broadcasts</span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {sentBroadcasts.map((log) => (
              <div key={log.id} className="p-4 space-y-2 hover:bg-slate-50/70 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{log.recipient_group}</span>
                    <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold">
                      {log.recipient_count} recipients
                    </span>
                    <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                      {log.channel}
                    </span>
                  </div>
                  <span className="font-mono text-slate-400 text-[11px]">{log.date}</span>
                </div>

                <p className="text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  {log.message}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1">
                  <div className="flex items-center gap-3">
                    <span>Sender: <strong className="font-mono text-slate-700">{log.sender_id}</strong></span>
                    {log.cost_ghs > 0 && (
                      <span>Cost: <strong className="font-mono text-emerald-800">{formatGHS(log.cost_ghs)}</strong></span>
                    )}
                    {log.recipients_sample && (
                      <span className="text-slate-400">
                        Samples: {log.recipients_sample.join(', ')}
                      </span>
                    )}
                  </div>

                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> {log.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RECIPIENTS PREVIEW MODAL */}
      {isPreviewRecipientsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 bg-[#064e3b] text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Targeted Recipients Preview</h3>
                <p className="text-[11px] text-emerald-200">
                  {phoneStats.validCount} valid phone numbers • {phoneStats.missingCount} invalid/missing
                </p>
              </div>
              <button
                onClick={() => setIsPreviewRecipientsOpen(false)}
                className="p-1 text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {targetedRecipients.map((rec) => {
                  const hasPhone = rec.phone && rec.phone.replace(/[^0-9]/g, '').length >= 9;
                  return (
                    <div key={rec.id} className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-800">
                          {rec.first_name} {rec.last_name}
                        </p>
                        <p className="text-[11px] font-mono text-slate-500">
                          {rec.phone || 'No phone number'}
                        </p>
                      </div>
                      <div>
                        {hasPhone ? (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded">
                            Valid
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-bold rounded">
                            Missing Phone
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => setIsPreviewRecipientsOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Blessing Generator Modal */}
      <BlessingGeneratorModal
        isOpen={Boolean(selectedCelebrantForBlessing)}
        onClose={() => setSelectedCelebrantForBlessing(null)}
        celebrant={selectedCelebrantForBlessing}
        onSendSms={(c, customText) => handleSendCelebrantSms(c, customText)}
        onLaunchWhatsApp={(phone, text) => handleLaunchWhatsApp(phone, text)}
        smsCredits={smsCredits}
      />

      {/* Pastor Welcome Video Preview Modal */}
      <PastorWelcomeVideoModal
        isOpen={isVideoPreviewOpen}
        onClose={() => setIsVideoPreviewOpen(false)}
        videoLink={pastorWelcomeVideoLink}
        onUpdateVideoLink={(newLink) => setPastorWelcomeVideoLink(newLink)}
      />

      {/* First-Timer Welcome Customizer Modal */}
      <FirstTimerWelcomeModal
        isOpen={Boolean(selectedVisitorForWelcome)}
        onClose={() => setSelectedVisitorForWelcome(null)}
        visitor={selectedVisitorForWelcome}
        videoLink={pastorWelcomeVideoLink}
        onSendSms={(v, customText) => handleSendSingleFirstTimerSms(v, customText)}
        onLaunchWhatsApp={(phone, text) => handleLaunchWhatsApp(phone, text)}
        onOpenVideoPreview={() => setIsVideoPreviewOpen(true)}
        smsCredits={smsCredits}
      />
    </div>
  );
};
