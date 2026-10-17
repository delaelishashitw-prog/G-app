import React, { useMemo, useRef, useState, useEffect } from 'react';
import type { CommunicationRecord, Member, Visitor } from '../types/database.types';
import {
  FileText,
  MessageSquare,
  Save,
  ExternalLink,
  Plus,
  Copy,
  Archive,
  RotateCcw,
  Sparkles,
  Cake,
  Heart,
  Video,
  Phone,
  Users,
  Smartphone,
  BookOpen,
  Send,
  Calendar,
  CheckCircle2,
  Clock,
  ChevronRight,
  Info
} from 'lucide-react';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useToast } from '../contexts/ToastContext';
import { communicationPhone, communicationRecipients, RECIPIENT_TYPES, type RecipientType } from '../lib/communicationUtils';
import { SmsConnectionPanel } from '../components/communication/SmsConnectionPanel';
import { BlessingGeneratorModal } from '../components/communication/BlessingGeneratorModal';
import { FirstTimerWelcomeModal } from '../components/communication/FirstTimerWelcomeModal';
import { PastorWelcomeVideoModal } from '../components/communication/PastorWelcomeVideoModal';
import { useAuth } from '../contexts/AuthContext';
import { smsSegments } from '../lib/smsSegments.js';

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

interface PastoralTemplate {
  id: string;
  category: 'Service' | 'Pastoral' | 'Evangelism' | 'Announcement' | 'Financial';
  title: string;
  channel: CommunicationRecord['channel'];
  recipientType: RecipientType;
  message: string;
  description: string;
}

const PASTORAL_TEMPLATES: PastoralTemplate[] = [
  {
    id: 'sunday-service-call',
    category: 'Service',
    title: 'Sunday Prophetic Service Reminder',
    channel: 'sms',
    recipientType: 'all_members',
    message: 'Shalom Beloved GWCC Family! Join us this Sunday at 8:30 AM for our Prophetic Breakthrough Service at the City of Refuge, Joma. Come expectant for open heavens and divine encounters! Prophet Elisha K. Richard & Ministerial Council.',
    description: 'Weekly reminder of service time, prophetic atmosphere, and sanctuary location.',
  },
  {
    id: 'midweek-miracle',
    category: 'Service',
    title: 'Midweek Miracle & Communion Service',
    channel: 'sms',
    recipientType: 'all_members',
    message: 'Grace and peace! Remember our Midweek Miracle & Communion Service this Wednesday at 6:30 PM. Come with your prayer requests as we break bread and experience God\'s supernatural power. See you in Zion!',
    description: 'Wednesday evening prayer, teaching, and communion reminder.',
  },
  {
    id: 'first-timer-welcome',
    category: 'Evangelism',
    title: 'First-Timer Post-Service Welcome',
    channel: 'sms',
    recipientType: 'visitors',
    message: 'Shalom! Thank you for worshipping with Greater Works City Church (GWCC), Joma this Sunday. Prophet Elisha K. Richard and our entire church family were truly honored to host you. We pray for open doors and divine favor in your life!',
    description: 'Warm appreciation message sent to first-time worshippers within 2 hours.',
  },
  {
    id: 'all-night-vigil',
    category: 'Service',
    title: 'All-Night Prophetic Vigil Announcement',
    channel: 'sms',
    recipientType: 'all_members',
    message: 'GWCC All-Night Prophetic Vigil holds this Friday from 10:00 PM to 4:00 AM! Theme: Prevailing Faith & Supernatural Restoration. Bring your prayer mantles and come fasting. Don\'t come alone! Prophet Elisha K. Richard.',
    description: 'Corporate monthly/quarterly prophetic all-night vigil notice.',
  },
  {
    id: 'fasting-prayer-week',
    category: 'Pastoral',
    title: 'Week of Fasting & Consecration Notice',
    channel: 'announcement',
    recipientType: 'all_members',
    message: 'Beloved Saints, our corporate 7-Day Fasting and Prayer begins this Monday. Fasting daily 6:00 AM to 6:00 PM with evening prayer meetings at 6:30 PM at the Joma Sanctuary. Prepare your heart for supernatural consecration!',
    description: 'Direction on corporate fasting, prayer hours, and evening altar gatherings.',
  },
  {
    id: 'tithe-thanksgiving',
    category: 'Financial',
    title: 'Tithe & Kingdom Giving Appreciation',
    channel: 'sms',
    recipientType: 'all_members',
    message: 'The pastoral leadership of GWCC sincerely appreciates your faithfulness in tithes and kingdom giving. As you honor the Lord, may He rebuke the devourer and open the windows of heaven for you (Malachi 3:10)!',
    description: 'Pastoral thank you and covenant blessing for tithers and givers.',
  },
  {
    id: 'choir-ministry-briefing',
    category: 'Announcement',
    title: 'Ministry Department Emergency Rehearsal',
    channel: 'sms',
    recipientType: 'ministry',
    message: 'Grace to you! All departmental workers and choir ministers are requested to attend our special preparation meeting and prayer rehearsal this Saturday at 4:00 PM sharp. Punctuality is essential!',
    description: 'Departmental assembly notice for choir, ushers, media, and protocols.',
  },
  {
    id: 'pastoral-welfare-care',
    category: 'Pastoral',
    title: 'Pastoral Care & Welfare Check-In',
    channel: 'whatsapp',
    recipientType: 'all_members',
    message: 'Shalom Beloved, greetings from Prophet Elisha K. Richard and the pastoral care team at GWCC. We are standing with you in prayer this week. If you have any pastoral, hospital, or family prayer need, reply directly to this message.',
    description: 'Pastoral outreach checking in on members\' spiritual and family welfare.',
  },
];

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function computeCelebrants(members: Member[]): CelebrantItem[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const todayStart = new Date(currentYear, now.getMonth(), now.getDate()).getTime();
  const results: CelebrantItem[] = [];

  for (const m of members) {
    if (m.is_archived || m.status === 'deceased') continue;

    // Birthday
    if (m.date_of_birth) {
      const parts = m.date_of_birth.split('-');
      if (parts.length === 3) {
        const birthYear = parseInt(parts[0], 10);
        const birthMonth = parseInt(parts[1], 10) - 1;
        const birthDay = parseInt(parts[2], 10);

        let nextDate = new Date(currentYear, birthMonth, birthDay);
        if (nextDate.getTime() < todayStart) {
          nextDate = new Date(currentYear + 1, birthMonth, birthDay);
        }

        const turningAge = nextDate.getFullYear() - birthYear;
        const diffTime = nextDate.getTime() - todayStart;
        const daysUntil = Math.round(diffTime / (1000 * 60 * 60 * 24));
        const isToday = daysUntil === 0;

        results.push({
          id: `bday-${m.id}`,
          member: m,
          type: 'birthday',
          dateStr: nextDate.toISOString().slice(0, 10),
          daysUntil,
          isToday,
          yearsCount: turningAge > 0 ? turningAge : 1,
          milestoneTitle: `${turningAge > 0 ? turningAge : ''}${getOrdinal(turningAge > 0 ? turningAge : 1)} Birthday`,
          suggestedScripture: 'Psalm 20:1-4',
          personalizedBlessing: `Shalom ${m.first_name}! Prophet Elisha K. Richard, the ministerial council, and the entire Greater Works City Church (GWCC) family joyfully celebrate you on your ${turningAge}th birthday today! As Psalm 20:1-4 declares: "The Lord hear thee in the day of trouble; the name of the God of Jacob defend thee; Send thee help from the sanctuary, and strengthen thee out of Zion..." May this new year usher in supernatural favor, divine health, and kingdom elevation for you!`,
          smsMessage: `Happy ${turningAge}th Birthday ${m.first_name}! 🎉 GWCC speaks Psalm 20:1-4 blessings over your new age: divine favor, sound health, long life & kingdom elevation. Prophet Elisha K. Richard & GWCC Family.`,
        });
      }
    }

    // Wedding Anniversary
    if (m.wedding_anniversary && m.marital_status === 'married') {
      const parts = m.wedding_anniversary.split('-');
      if (parts.length === 3) {
        const weddingYear = parseInt(parts[0], 10);
        const weddingMonth = parseInt(parts[1], 10) - 1;
        const weddingDay = parseInt(parts[2], 10);

        let nextDate = new Date(currentYear, weddingMonth, weddingDay);
        if (nextDate.getTime() < todayStart) {
          nextDate = new Date(currentYear + 1, weddingMonth, weddingDay);
        }

        const yearsMarried = nextDate.getFullYear() - weddingYear;
        const diffTime = nextDate.getTime() - todayStart;
        const daysUntil = Math.round(diffTime / (1000 * 60 * 60 * 24));
        const isToday = daysUntil === 0;

        results.push({
          id: `anniv-${m.id}`,
          member: m,
          type: 'anniversary',
          dateStr: nextDate.toISOString().slice(0, 10),
          daysUntil,
          isToday,
          yearsCount: yearsMarried > 0 ? yearsMarried : 1,
          milestoneTitle: `${yearsMarried > 0 ? yearsMarried : ''}${getOrdinal(yearsMarried > 0 ? yearsMarried : 1)} Wedding Anniversary`,
          spouseName: m.spouse_name || 'Spouse',
          suggestedScripture: 'Genesis 2:24',
          personalizedBlessing: `Shalom ${m.first_name} & ${m.spouse_name || 'beloved spouse'}! Prophet Elisha K. Richard and GWCC rejoice with you on your ${yearsMarried}th Wedding Anniversary! "Therefore shall a man leave his father and his mother, and shall cleave unto his wife: and they shall be one flesh." — Genesis 2:24. May God continually preserve your marriage with divine peace and fruitfulness!`,
          smsMessage: `Happy ${yearsMarried}th Wedding Anniversary ${m.first_name} & ${m.spouse_name || 'Spouse'}! 💍✨ GWCC speaks divine peace, marital joy and fruitfulness over your union. Prophet Elisha & GWCC.`,
        });
      }
    }
  }

  return results.sort((a, b) => a.daysUntil - b.daysUntil);
}

const blankForm = () => ({
  title: 'Church announcement',
  message: '',
  sender: 'GWCC',
  type: 'all_members',
  groupId: '',
  channel: 'sms' as CommunicationRecord['channel'],
});

const audienceNames: Record<string, string> = {
  all_members: 'Current members',
  visitors: 'Visitors',
  leaders: 'Active leaders',
  ministry: 'Ministry',
  small_group: 'Small group',
  custom: 'Unrecorded audience',
};

const field = 'mt-1 block w-full min-w-0 border border-slate-300 rounded-lg p-2 text-sm focus:outline-emerald-700 focus:ring-1 focus:ring-emerald-700 bg-white';

export const CommunicationPage: React.FC = () => {
  const { members, visitors, ministries, smallGroups, communications, saveCommunicationDraft, archiveCommunicationDraft } = useChurchData();
  const { info, success, error: toastError } = useToast();
  const { currentRole, isSimulating } = useAuth();
  const canSendSms = ['super_admin', 'senior_pastor', 'administrator'].includes(currentRole) && !isSimulating;

  // Active view tab
  const [activeTab, setActiveTab] = useState<'studio' | 'templates' | 'celebrants' | 'visitors'>('studio');

  // Modals state
  const [selectedCelebrant, setSelectedCelebrant] = useState<CelebrantItem | null>(null);
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [videoLink, setVideoLink] = useState(() => {
    return localStorage.getItem('gwcc_pastor_video_url') || 'https://youtube.com/watch?v=gwcc-welcome-elisha';
  });

  const [smsDraftId, setSmsDraftId] = useState<string | null>(null);
  const [smsReviewRequest, setSmsReviewRequest] = useState(0);
  const [form, setForm] = useState(blankForm);
  const [phone, setPhone] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const editorId = useRef<string>(crypto.randomUUID());
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [limit, setLimit] = useState(20);
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null);
  const [legacy, setLegacy] = useState(false);

  // Template category filter in Templates tab
  const [templateCategory, setTemplateCategory] = useState<string>('all');
  // Celebrants filter
  const [celebrantFilter, setCelebrantFilter] = useState<'all' | 'week' | 'month'>('all');

  const audience = useMemo(() => communicationRecipients(form.type, form.groupId, members, visitors), [form.type, form.groupId, members, visitors]);
  const groups = form.type === 'ministry' ? ministries : smallGroups;
  const groupName = groups.find(row => row.id === form.groupId)?.name;
  const savedEditor = communications.find(row => row.id === editingId);
  const recipientChanges = savedEditor?.recipient_ids && JSON.stringify([...savedEditor.recipient_ids].sort()) !== JSON.stringify(audience.selected.map(row => row.id).sort());

  const visible = useMemo(
    () =>
      communications
        .filter(row => Boolean(row.archived_at) === showArchived && `${row.title} ${row.message} ${row.recipient_group_name || ''}`.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => (b.updated_at || b.created_at || b.sent_at || '').localeCompare(a.updated_at || a.created_at || a.sent_at || '')),
    [communications, showArchived, search]
  );

  const celebrants = useMemo(() => computeCelebrants(members), [members]);

  const filteredCelebrants = useMemo(() => {
    if (celebrantFilter === 'week') return celebrants.filter(c => c.daysUntil <= 7);
    if (celebrantFilter === 'month') return celebrants.filter(c => c.daysUntil <= 30);
    return celebrants;
  }, [celebrants, celebrantFilter]);

  const filteredTemplates = useMemo(() => {
    if (templateCategory === 'all') return PASTORAL_TEMPLATES;
    return PASTORAL_TEMPLATES.filter(t => t.category.toLowerCase() === templateCategory.toLowerCase());
  }, [templateCategory]);

  // Live GSM-7 / Unicode segment analysis
  const segmentInfo = useMemo(() => smsSegments(form.message), [form.message]);

  const change = (key: keyof typeof form, value: string) => setForm(previous => ({ ...previous, [key]: value }));

  const newDraft = () => {
    editorId.current = crypto.randomUUID();
    setEditingId(null);
    setForm(blankForm());
    setLegacy(false);
    setPhone('');
    setActiveTab('studio');
  };

  const openDraft = (row: CommunicationRecord, copy = false) => {
    editorId.current = copy ? crypto.randomUUID() : row.id;
    setEditingId(copy ? null : row.id);
    setForm({
      title: row.title,
      message: row.message,
      sender: row.sender_id || 'GWCC',
      type: RECIPIENT_TYPES.includes(row.recipient_type as RecipientType) ? row.recipient_type : '',
      groupId: row.recipient_group_id || '',
      channel: row.channel,
    });
    setLegacy(!row.recipient_ids);
    setActiveTab('studio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const applyTemplate = (t: PastoralTemplate) => {
    setForm(prev => ({
      ...prev,
      title: t.title,
      channel: t.channel,
      type: t.recipientType,
      message: t.message,
    }));
    setActiveTab('studio');
    success('Template loaded', `Applied "${t.title}" into the message editor.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const insertVariable = (variable: string) => {
    setForm(prev => ({
      ...prev,
      message: prev.message ? `${prev.message} ${variable}` : variable,
    }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy.current) return;
    if (['ministry', 'small_group'].includes(form.type) && !groupName) {
      toastError('Choose recipients', 'Choose an available ministry or small group.');
      return;
    }
    busy.current = true;
    setSaving(true);
    try {
      const record = await saveCommunicationDraft({
        id: editorId.current,
        title: form.title,
        channel: form.channel,
        recipient_type: form.type as RecipientType,
        recipient_group_id: ['ministry', 'small_group'].includes(form.type) ? form.groupId : null,
        recipient_group_name: ['ministry', 'small_group'].includes(form.type) ? groupName : null,
        recipient_ids: audience.selected.map(row => row.id),
        recipient_count: audience.selected.length,
        message: form.message,
        sender_id: form.sender,
        status: 'draft',
      });
      setEditingId(record.id);
      setLegacy(false);
      info('Draft saved on this device', 'Awaiting cloud confirmation. No message has been sent or scheduled.');
    } catch (cause) {
      toastError('Draft not saved', (cause as Error).message);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const archive = async (row: CommunicationRecord, archived: boolean) => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      await archiveCommunicationDraft(row.id, archived);
      setConfirmArchive(null);
      if (archived && editingId === row.id) newDraft();
      info(archived ? 'Draft archive awaiting confirmation' : 'Draft restore awaiting confirmation', 'Follow the sync status for cloud confirmation.');
    } catch (cause) {
      toastError('Draft not updated', (cause as Error).message);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const copyMessage = async (message: string) => {
    try {
      await navigator.clipboard.writeText(message);
      success('Message copied', 'Review the message before sharing it.');
    } catch {
      toastError('Could not copy', 'Select and copy the message text manually.');
    }
  };

  const openWhatsApp = () => {
    const digits = communicationPhone(phone);
    if (!digits || !form.message.trim() || form.message.trim().length > 5000) {
      toastError('WhatsApp draft incomplete', 'Enter a complete phone number and a message of up to 5,000 characters.');
      return;
    }
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(form.message.trim())}`, '_blank', 'noopener,noreferrer');
  };

  const handleLaunchWhatsAppDirect = (targetPhone: string, text: string) => {
    const digits = communicationPhone(targetPhone);
    if (!digits) {
      toastError('Invalid Phone', 'This contact does not have a complete valid mobile phone number.');
      return;
    }
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const handleSendCelebrantSms = (c: CelebrantItem, customText: string) => {
    setForm({
      title: `${c.type === 'birthday' ? 'Birthday Blessing' : 'Anniversary Blessing'}: ${c.member.first_name} ${c.member.last_name}`,
      message: customText,
      sender: 'GWCC',
      type: 'all_members',
      groupId: '',
      channel: 'sms',
    });
    setActiveTab('studio');
    success('Blessing loaded into editor', 'Review the recipient selection and click Save Draft or Review SMS.');
  };

  const handleSendVisitorSms = (v: Visitor, customText: string) => {
    setForm({
      title: `First-Timer Welcome: ${v.full_name}`,
      message: customText,
      sender: 'GWCC',
      type: 'visitors',
      groupId: '',
      channel: 'sms',
    });
    setActiveTab('studio');
    success('Visitor welcome loaded', 'Review the recipient and click Save Draft or Review SMS.');
  };

  const handleUpdateVideoLink = (newLink: string) => {
    setVideoLink(newLink);
    localStorage.setItem('gwcc_pastor_video_url', newLink);
  };

  return (
    <div className="space-y-6 min-w-0 max-w-full">
      {/* Header with Title and Primary Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Communication</h1>
          <p className="text-sm text-slate-600 mt-1">Prepare, review, and dispatch pastoral messages, SMS broadcasts, WhatsApp conversations, and celebrations.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={newDraft}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-emerald-800 text-white hover:bg-emerald-700 px-4 py-2 text-sm font-semibold shadow-xs disabled:opacity-50 transition"
          >
            <Plus className="w-4 h-4" />
            <span>New draft</span>
          </button>
        </div>
      </div>

      {/* Domain Operational Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5">
          <p className="text-xs text-slate-500 font-medium">Message Drafts</p>
          <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-0.5">{communications.length}</p>
          <span className="text-[11px] text-slate-500 mt-0.5 block">{communications.filter(c => !c.archived_at).length} active · {communications.filter(c => c.archived_at).length} archived</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5">
          <p className="text-xs text-slate-500 font-medium">Reachable Members</p>
          <p className="text-xl font-bold font-mono tabular-nums text-emerald-800 mt-0.5">{members.filter(m => !m.is_archived && communicationPhone(m.phone)).length}</p>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Verified Ghana mobile contacts</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5">
          <p className="text-xs text-slate-500 font-medium">Upcoming Celebrants</p>
          <p className="text-xl font-bold font-mono tabular-nums text-amber-700 mt-0.5">{celebrants.filter(c => c.daysUntil <= 30).length}</p>
          <span className="text-[11px] text-slate-500 mt-0.5 block">{celebrants.filter(c => c.isToday).length} celebrating today</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5">
          <p className="text-xs text-slate-500 font-medium">First-Timers</p>
          <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-0.5">{visitors.length}</p>
          <span className="text-[11px] text-slate-500 mt-0.5 block">2-hour welcome follow-ups</span>
        </div>
      </div>

      {/* Interactive Segmented Tab Controls */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto max-w-full">
        <button
          type="button"
          onClick={() => setActiveTab('studio')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap shrink-0 ${
            activeTab === 'studio' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4 text-emerald-700" />
          <span>Message Studio & SMS Gateway</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap shrink-0 ${
            activeTab === 'templates' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4 text-emerald-700" />
          <span>Pastoral Templates ({PASTORAL_TEMPLATES.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('celebrants')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap shrink-0 ${
            activeTab === 'celebrants' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Cake className="w-4 h-4 text-amber-600" />
          <span>Celebrant Blessings ({celebrants.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('visitors')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap shrink-0 ${
            activeTab === 'visitors' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4 text-emerald-700" />
          <span>First-Timer Follow-up ({visitors.length})</span>
        </button>
      </div>

      {/* Safety Notice Banner (Mandatory compliance & audit transparency) */}
      <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Saving a draft does not send, schedule or publish it. Use the SMS connection panel to check Arkesel and review a saved SMS before sending. Scheduling is not enabled. WhatsApp conversations are reviewed and sent manually in WhatsApp.
      </div>

      {/* TAB 1: MESSAGE STUDIO & SMS GATEWAY (Default View - preserves exact test elements) */}
      <div className={activeTab === 'studio' ? 'block' : 'hidden'}>
        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          {/* Main Draft Composer Form */}
          <form onSubmit={save} className="min-w-0 space-y-4 bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold flex items-center gap-2 text-slate-900">
                <FileText className="w-5 h-5 text-emerald-700" />
                {editingId ? 'Edit message draft' : 'Message draft'}
              </h2>
              {editingId && (
                <span className="text-xs font-mono text-slate-500">
                  Editing: {editingId.slice(0, 8)}…
                </span>
              )}
            </div>

            {legacy && (
              <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                This older draft has no saved recipient list. Review the audience and phone numbers before saving.
              </p>
            )}
            {recipientChanges && (
              <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                The directory has changed since this draft was saved. Saving will update its recipient list to the preview below.
              </p>
            )}

            <div>
              <label htmlFor="communication-title" className="block text-sm font-medium text-slate-700">
                Title
              </label>
              <input
                id="communication-title"
                required
                maxLength={200}
                value={form.title}
                onChange={e => change('title', e.target.value)}
                className={field}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="communication-channel" className="block text-sm font-medium text-slate-700">
                  Draft channel
                </label>
                <select
                  id="communication-channel"
                  value={form.channel}
                  onChange={e => change('channel', e.target.value as CommunicationRecord['channel'])}
                  className={field}
                >
                  <option value="sms">SMS draft</option>
                  <option value="whatsapp">WhatsApp draft</option>
                  <option value="announcement">Announcement draft</option>
                </select>
              </div>

              <div>
                <label htmlFor="communication-sender" className="block text-sm font-medium text-slate-700">
                  Sender ID
                </label>
                <input
                  id="communication-sender"
                  required
                  maxLength={11}
                  pattern="[A-Za-z0-9 \-]{1,11}"
                  value={form.sender}
                  onChange={e => change('sender', e.target.value)}
                  className={field}
                />
              </div>
            </div>

            <div>
              <label htmlFor="communication-recipients" className="block text-sm font-medium text-slate-700">
                Recipients
              </label>
              <select
                id="communication-recipients"
                required
                value={form.type}
                onChange={e => setForm(previous => ({ ...previous, type: e.target.value, groupId: '' }))}
                className={field}
              >
                <option value="">Choose recipients</option>
                {RECIPIENT_TYPES.map(type => (
                  <option key={type} value={type}>
                    {audienceNames[type]}
                  </option>
                ))}
              </select>
            </div>

            {['ministry', 'small_group'].includes(form.type) && (
              <div>
                <label htmlFor="communication-group" className="block text-sm font-medium text-slate-700">
                  Choose group
                </label>
                <select
                  id="communication-group"
                  required
                  value={form.groupId}
                  onChange={e => change('groupId', e.target.value)}
                  className={field}
                >
                  <option value="">Choose…</option>
                  {form.groupId && !groupName && (
                    <option value={form.groupId}>Group no longer available — choose another</option>
                  )}
                  {groups.map(row => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2 text-sm bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="font-medium text-slate-800">
                {audience.selected.length} unique valid phone numbers · {audience.issues.length} excluded records.
              </p>
              {audience.selected.length === 0 && (
                <p className="text-amber-800 text-xs">
                  No valid recipient numbers in this audience. You can save the message for later.
                </p>
              )}
              <details className="rounded-lg border border-slate-200 bg-white p-3">
                <summary className="cursor-pointer font-semibold text-xs text-slate-700">
                  Review recipients and exclusions
                </summary>
                <div className="mt-3 max-h-56 overflow-y-auto space-y-1.5 text-xs">
                  {audience.selected.slice(0, 100).map(row => (
                    <p key={row.id} className="break-words font-mono text-[11px] text-slate-700">
                      {row.name} · +{row.phone}
                    </p>
                  ))}
                  {audience.issues.slice(0, 100).map(row => (
                    <p key={row.id} className="break-words text-amber-900 text-[11px]">
                      {row.name} — {row.reason}
                    </p>
                  ))}
                  {audience.selected.length > 100 || audience.issues.length > 100 ? (
                    <p className="text-slate-400 text-[10px]">Showing the first 100 entries in each list.</p>
                  ) : null}
                </div>
                <a href="/members" className="mt-2 inline-block text-xs text-emerald-800 underline">
                  Review directory contacts
                </a>
              </details>
            </div>

            {/* Quick Template Inserter & Personalization Tags */}
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-700">Quick Insert Tags:</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => insertVariable('[First Name]')}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px]"
                  >
                    + [First Name]
                  </button>
                  <button
                    type="button"
                    onClick={() => insertVariable('Prophet Elisha K. Richard')}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px]"
                  >
                    + Prophet Elisha
                  </button>
                  <button
                    type="button"
                    onClick={() => insertVariable('GWCC Joma')}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px]"
                  >
                    + GWCC Joma
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="communication-message" className="block text-sm font-medium text-slate-700">
                  Message
                </label>
                <textarea
                  id="communication-message"
                  required
                  rows={6}
                  maxLength={5000}
                  value={form.message}
                  onChange={e => change('message', e.target.value)}
                  className={field}
                  placeholder="Enter message text for broadcast or announcement..."
                />
              </div>

              {/* Real-time SMS Segment & Character Telemetry */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 text-slate-700">
                  <span className="font-medium">
                    Encoding: <strong className="font-mono text-slate-900">{segmentInfo.encoding}</strong>
                  </span>
                  <span className="font-mono tabular-nums text-slate-600">
                    {segmentInfo.segments} {segmentInfo.segments === 1 ? 'segment' : 'segments'} ({segmentInfo.units} units)
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span>Audience Units: <strong className="font-mono tabular-nums text-slate-700">{segmentInfo.segments * audience.selected.length} credits</strong> total</span>
                  <span>{form.message.length}/5,000 characters · {form.title.length}/200 title characters</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('templates')}
                className="text-xs text-emerald-800 hover:underline font-medium"
              >
                Browse pastoral template library →
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex gap-2 items-center bg-emerald-800 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg font-semibold text-sm disabled:opacity-50 transition shadow-xs"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save draft'}
              </button>
            </div>
          </form>

          {/* Right Column: Handset Preview, SMS Connection Panel, WhatsApp Direct, Saved Messages */}
          <div className="min-w-0 space-y-6">
            {/* Live Handset Visual Preview */}
            <div className="bg-slate-900 rounded-2xl p-4 text-white space-y-3 shadow-md">
              <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span className="font-medium text-slate-200">Live Handset Preview</span>
                </div>
                <span className="font-mono text-[11px] text-slate-400">Sender: {form.sender || 'GWCC'}</span>
              </div>
              <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 min-h-24">
                <p className="text-xs text-slate-100 whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed">
                  {form.message || <span className="text-slate-500 italic">Composed message copy will render here as it appears on recipient mobile devices...</span>}
                </p>
                <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-slate-500 font-mono">
                  <span>{new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Accra' })}</span>
                  <span>· Accra</span>
                </div>
              </div>
            </div>

            {/* Arkesel SMS Connection Panel (Fully integrated) */}
            <SmsConnectionPanel
              draft={communications.find(row => row.id === smsDraftId) || null}
              reviewRequest={smsReviewRequest}
              onClose={() => setSmsDraftId(null)}
            />

            {/* WhatsApp Single Conversation Panel */}
            <section className="min-w-0 space-y-3 bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="font-bold flex gap-2 items-center text-slate-900">
                <MessageSquare className="w-5 h-5 text-emerald-700" />
                WhatsApp
              </h2>
              <p className="text-sm text-slate-600">
                Use the current message draft to open one conversation. Review and send it in WhatsApp.
              </p>
              <label htmlFor="communication-phone" className="block text-sm font-medium text-slate-700">
                Phone number
              </label>
              <input
                id="communication-phone"
                type="tel"
                value={phone}
                placeholder="024… or +233… or 00233…"
                onChange={e => setPhone(e.target.value)}
                className={field}
              />
              <button
                type="button"
                onClick={openWhatsApp}
                className="flex gap-2 items-center border border-emerald-700 text-emerald-800 hover:bg-emerald-50 rounded-lg px-4 py-2 text-sm font-semibold transition"
              >
                <ExternalLink className="w-4 h-4" />
                Open WhatsApp draft
              </button>
            </section>

            {/* Saved Messages Section */}
            <section aria-label="Saved messages" className="min-w-0 space-y-3 bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-900">Saved messages</h2>
                <span className="text-xs font-mono text-slate-500">{visible.length} drafts</span>
              </div>
              <label htmlFor="communication-search" className="sr-only">
                Search saved messages
              </label>
              <input
                id="communication-search"
                value={search}
                placeholder="Search saved messages"
                onChange={e => {
                  setSearch(e.target.value);
                  setLimit(20);
                }}
                className={field}
              />
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={e => {
                    setShowArchived(e.target.checked);
                    setLimit(20);
                  }}
                  className="rounded border-slate-300 text-emerald-800 focus:ring-emerald-700"
                />
                Show archived drafts
              </label>
              {visible.length === 0 && (
                <p className="text-sm text-slate-500 py-3">No saved messages match this view.</p>
              )}
              {visible.slice(0, limit).map(row => (
                <article
                  key={row.id}
                  aria-label={`Saved message: ${row.title}`}
                  className="min-w-0 border-t border-slate-200 pt-3 text-sm space-y-2"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong className="min-w-0 break-all text-slate-900 font-semibold">{row.title}</strong>
                    <span className="text-xs text-slate-500 shrink-0 font-mono">
                      {row._sync_status === 'pending'
                        ? 'Awaiting cloud confirmation'
                        : row.status === 'draft'
                        ? row.archived_at
                          ? 'Archived draft'
                          : 'Draft · cloud confirmed'
                        : 'Imported record — delivery unverified'}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-slate-700 text-xs leading-relaxed">
                    {row.message}
                  </p>
                  <p className="text-xs text-slate-500 break-words">
                    {row.recipient_group_name || audienceNames[row.recipient_type] || 'Audience needs review'} · {row.recipient_count}{' '}
                    {row.recipient_ids ? 'saved recipients' : 'intended recipients — list unrecorded'}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">
                    Recorded:{' '}
                    {row.created_at || row.sent_at
                      ? new Date(row.created_at || row.sent_at).toLocaleString('en-GB', { timeZone: 'Africa/Accra' })
                      : 'Date unavailable'}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs pt-1">
                    {row.status === 'draft' && !row.archived_at && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => openDraft(row)}
                        className="border border-slate-300 hover:bg-slate-50 rounded-lg px-3 py-1.5 transition font-medium"
                      >
                        Edit draft
                      </button>
                    )}
                    {canSendSms && row.status === 'draft' && row.channel === 'sms' && !row.archived_at && (
                      <button
                        type="button"
                        disabled={saving || row._sync_status === 'pending' || !row.updated_at || !row.recipient_ids}
                        onClick={() => {
                          setSmsDraftId(row.id);
                          setSmsReviewRequest(previous => previous + 1);
                        }}
                        className="border border-emerald-700 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 rounded-lg px-3 py-1.5 font-semibold transition"
                      >
                        Review SMS send
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => openDraft(row, true)}
                      className="border border-slate-300 hover:bg-slate-50 rounded-lg px-3 py-1.5 transition font-medium"
                    >
                      Copy as new draft
                    </button>
                    <button
                      type="button"
                      onClick={() => copyMessage(row.message)}
                      className="flex items-center gap-1 border border-slate-300 hover:bg-slate-50 rounded-lg px-3 py-1.5 transition font-medium"
                    >
                      <Copy className="w-3 h-3 text-slate-600" />
                      Copy message
                    </button>
                    {row.status === 'draft' &&
                      (row.archived_at ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => archive(row, false)}
                          className="flex items-center gap-1 border border-slate-300 hover:bg-slate-50 rounded-lg px-3 py-1.5 transition font-medium"
                        >
                          <RotateCcw className="w-3 h-3 text-slate-600" />
                          Restore draft
                        </button>
                      ) : confirmArchive === row.id ? (
                        <>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => archive(row, true)}
                            className="border border-rose-300 bg-rose-50 rounded-lg px-3 py-1.5 text-rose-800 font-semibold"
                          >
                            Confirm archive
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmArchive(null)}
                            className="text-slate-600 px-2 py-1.5 hover:underline"
                          >
                            Cancel archive
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => setConfirmArchive(row.id)}
                          className="flex items-center gap-1 border border-slate-300 hover:bg-slate-50 rounded-lg px-3 py-1.5 transition font-medium"
                        >
                          <Archive className="w-3 h-3 text-slate-600" />
                          Archive draft
                        </button>
                      ))}
                  </div>
                </article>
              ))}
              {visible.length > limit && (
                <button
                  type="button"
                  onClick={() => setLimit(previous => previous + 20)}
                  className="text-sm underline text-emerald-800 font-medium pt-2 block"
                >
                  Show more messages
                </button>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* TAB 2: PASTORAL TEMPLATES LIBRARY */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Pastoral Message Templates</h2>
              <p className="text-xs text-slate-600">Biblically authentic copy curated for Greater Works City Church operations.</p>
            </div>
            {/* Category Filter */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
              {['all', 'Service', 'Pastoral', 'Evangelism', 'Financial', 'Announcement'].map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setTemplateCategory(cat)}
                  className={`px-3 py-1.5 rounded-md font-medium transition ${
                    templateCategory.toLowerCase() === cat.toLowerCase()
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat === 'all' ? 'All Templates' : cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTemplates.map(t => {
              const est = smsSegments(t.message);
              return (
                <div key={t.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">{t.category}</span>
                      <span className="text-xs font-mono text-slate-500">
                        {est.segments} segment(s) · {t.message.length} chars
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm">{t.title}</h3>
                    <p className="text-xs text-slate-500">{t.description}</p>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                      {t.message}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-[11px] text-slate-500">
                      Channel: <strong className="uppercase">{t.channel}</strong> · Audience: {audienceNames[t.recipientType]}
                    </span>
                    <button
                      type="button"
                      onClick={() => applyTemplate(t)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
                    >
                      <span>Use in Message Studio</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: CELEBRANT BLESSINGS STUDIO */}
      {activeTab === 'celebrants' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Celebrant Blessings Studio</h2>
              <p className="text-xs text-slate-600">Upcoming birthdays and wedding anniversaries calculated for active GWCC members.</p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setCelebrantFilter('all')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${celebrantFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
              >
                All Celebrants ({celebrants.length})
              </button>
              <button
                type="button"
                onClick={() => setCelebrantFilter('week')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${celebrantFilter === 'week' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
              >
                Next 7 Days ({celebrants.filter(c => c.daysUntil <= 7).length})
              </button>
              <button
                type="button"
                onClick={() => setCelebrantFilter('month')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${celebrantFilter === 'month' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
              >
                This Month ({celebrants.filter(c => c.daysUntil <= 30).length})
              </button>
            </div>
          </div>

          {filteredCelebrants.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-2">
              <Cake className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="font-semibold text-slate-800 text-sm">No celebrants in this timeframe</p>
              <p className="text-xs text-slate-500">Ensure members have dates of birth or wedding anniversaries entered on their member profile.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCelebrants.map(c => (
                <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {c.type === 'birthday' ? (
                          <span className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
                            <Cake className="w-4 h-4" />
                          </span>
                        ) : (
                          <span className="p-1.5 bg-rose-50 text-rose-700 rounded-lg">
                            <Heart className="w-4 h-4" />
                          </span>
                        )}
                        <span className="text-xs font-semibold text-slate-700">{c.milestoneTitle}</span>
                      </div>
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${c.isToday ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'}`}>
                        {c.isToday ? 'Today!' : `In ${c.daysUntil} days`}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{c.member.first_name} {c.member.last_name}</h3>
                      {c.type === 'anniversary' && c.spouseName && (
                        <p className="text-xs text-slate-500">& {c.spouseName}</p>
                      )}
                      <p className="text-xs font-mono text-slate-500 mt-0.5">
                        {c.member.phone ? `Ghana: ${c.member.phone}` : 'No phone on record'}
                      </p>
                    </div>

                    <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100 line-clamp-3 leading-relaxed">
                      "{c.smsMessage}"
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={!c.member.phone}
                      onClick={() => handleLaunchWhatsAppDirect(c.member.phone, c.personalizedBlessing)}
                      className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-emerald-800 disabled:opacity-40 transition"
                      title="Launch WhatsApp with pastoral blessing"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCelebrant(c)}
                      className="flex-1 py-1.5 px-3 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition text-center"
                    >
                      Open Blessing Studio
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: FIRST-TIMER WELCOME STATION */}
      {activeTab === 'visitors' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">First-Timer Post-Service Follow-Up Station</h2>
              <p className="text-xs text-slate-600">Engage worshippers who visited GWCC with Prophet Elisha's welcome and orientation.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsVideoModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 border border-emerald-700 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 rounded-xl text-xs font-bold transition"
            >
              <Video className="w-4 h-4 text-emerald-700" />
              <span>Watch / Configure Pastor's Welcome Video</span>
            </button>
          </div>

          {visitors.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-2">
              <Sparkles className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="font-semibold text-slate-800 text-sm">No recorded first-time visitors</p>
              <p className="text-xs text-slate-500">Record new Sunday worshippers in the Visitors module to activate 2-hour welcome follow-ups.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visitors.map(v => (
                <div key={v.id} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">
                        {v.service_attended || 'Sunday Service'}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        {v.visit_date ? new Date(v.visit_date).toLocaleDateString('en-GB') : 'Recent'}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{v.full_name}</h3>
                      <p className="text-xs font-mono text-slate-500 mt-0.5">{v.phone || 'No phone recorded'}</p>
                    </div>

                    {v.prayer_request ? (
                      <p className="text-xs text-amber-900 bg-amber-50 p-2.5 rounded-xl border border-amber-200/80 leading-relaxed">
                        <strong>Prayer Request:</strong> "{v.prayer_request}"
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        First-time guest at the City of Refuge sanctuary.
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={!v.phone}
                      onClick={() => handleLaunchWhatsAppDirect(v.phone, `Shalom ${v.full_name.split(' ')[0]}! Thank you for worshipping with Greater Works City Church, Joma. Watch Prophet Elisha's welcome video here: ${videoLink}`)}
                      className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-emerald-800 disabled:opacity-40 transition"
                      title="Launch WhatsApp directly"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedVisitor(v)}
                      className="flex-1 py-1.5 px-3 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition text-center"
                    >
                      Open Welcome Studio
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Blessing Generator Modal */}
      <BlessingGeneratorModal
        isOpen={Boolean(selectedCelebrant)}
        onClose={() => setSelectedCelebrant(null)}
        celebrant={selectedCelebrant}
        onSendSms={handleSendCelebrantSms}
        onLaunchWhatsApp={handleLaunchWhatsAppDirect}
        smsCredits={100}
      />

      {/* First-Timer Welcome Studio Modal */}
      <FirstTimerWelcomeModal
        isOpen={Boolean(selectedVisitor)}
        onClose={() => setSelectedVisitor(null)}
        visitor={selectedVisitor}
        videoLink={videoLink}
        onSendSms={handleSendVisitorSms}
        onLaunchWhatsApp={handleLaunchWhatsAppDirect}
        onOpenVideoPreview={() => setIsVideoModalOpen(true)}
        smsCredits={100}
      />

      {/* Pastor Welcome Video Modal */}
      <PastorWelcomeVideoModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        videoLink={videoLink}
        onUpdateVideoLink={handleUpdateVideoLink}
      />
    </div>
  );
};
