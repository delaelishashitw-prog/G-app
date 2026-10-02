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
  Share2
} from 'lucide-react';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useToast } from '../contexts/ToastContext';
import { formatGHS } from '../lib/currencyUtils';

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

export const CommunicationPage: React.FC = () => {
  const { members, visitors, ministries, smallGroups } = useChurchData();
  const { error: toastError, info: toastInfo, warning: toastWarning } = useToast();

  // Navigation & Channels
  const [activeTab, setActiveTab] = useState<'sms' | 'whatsapp' | 'automations' | 'history'>('sms');

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
    </div>
  );
};
