import React, { useState, useMemo } from 'react';
import { X, Check, Users, MessageCircle, Mic, Music, Shield, Radio, Calendar, CheckSquare, Clock, Megaphone } from 'lucide-react';
import { ChurchService, Member, RosterAssignment } from '../../types/database.types';
import { cleanGhanaPhone } from '../../lib/currencyUtils';
import { useToast } from '../../contexts/ToastContext';

interface DutyRosterModalProps {
  service: ChurchService;
  members: Member[];
  existingAssignments?: RosterAssignment[];
  onSave: (
    serviceId: string,
    updates: Partial<ChurchService>,
    newAssignments?: Omit<RosterAssignment, 'id' | 'created_at'>[]
  ) => void;
  onClose: () => void;
}

function getNextServiceDate(dayOfWeek: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDay = days.findIndex((d) => d.toLowerCase() === (dayOfWeek || 'Sunday').toLowerCase());
  const now = new Date();
  const currentDay = now.getDay();
  let diff = (targetDay === -1 ? 0 : targetDay) - currentDay;
  if (diff < 0) diff += 7;
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const day = String(target.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function computePriorTime(startTime: string | undefined, priorMins: number): string {
  if (!startTime) return priorMins === 45 ? '07:45 AM' : '08:00 AM';
  const match = startTime.match(/(\d{1,2}):(\d{2})/);
  if (!match) return startTime;
  let totalMinutes = parseInt(match[1], 10) * 60 + parseInt(match[2], 10) - priorMins;
  if (totalMinutes < 0) totalMinutes += 24 * 60;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

export const DutyRosterModal: React.FC<DutyRosterModalProps> = ({
  service,
  members,
  existingAssignments = [],
  onSave,
  onClose,
}) => {
  const { success } = useToast();

  const defaultDate = useMemo(() => getNextServiceDate(service.day_of_week), [service.day_of_week]);
  const [targetDate, setTargetDate] = useState(defaultDate);

  // Check if assignments already exist for this service and date
  const assignmentsForDate = useMemo(() => {
    return existingAssignments.filter((a) => a.service_id === service.id && a.date === targetDate);
  }, [existingAssignments, service.id, targetDate]);

  const existingPreacher = assignmentsForDate.find(
    (a) => a.role_title.toLowerCase().includes('preach') || a.role_title.toLowerCase().includes('exhort')
  )?.member_name;
  const existingModerator = assignmentsForDate.find(
    (a) => a.role_title.toLowerCase().includes('moderator') || a.role_title.toLowerCase().includes('leader') || a.role_title.toLowerCase().includes('mc')
  )?.member_name;
  const existingWorship = assignmentsForDate.find(
    (a) => a.role_title.toLowerCase().includes('worship') || a.role_title.toLowerCase().includes('choir') || a.role_title.toLowerCase().includes('music')
  )?.member_name;
  const existingUsher = assignmentsForDate.find(
    (a) => a.role_title.toLowerCase().includes('usher') || a.role_title.toLowerCase().includes('protocol')
  )?.member_name;
  const existingSound = assignmentsForDate.find(
    (a) => a.role_title.toLowerCase().includes('sound') || a.role_title.toLowerCase().includes('media') || a.role_title.toLowerCase().includes('livestream')
  )?.member_name;
  const existingAnnouncementsSteward = assignmentsForDate.find(
    (a) => a.role_title.toLowerCase().includes('announcement') || a.role_title.toLowerCase().includes('notice') || a.role_title.toLowerCase().includes('secretariat')
  )?.member_name;
  const existingAnnouncementText = assignmentsForDate.find((a) => a.announcement)?.announcement || service.announcements || '';

  const [preacher, setPreacher] = useState(existingPreacher || service.preacher || 'Prophet Elisha K. Richard');
  const [serviceLeader, setServiceLeader] = useState(existingModerator || service.service_leader || 'Pastor Emmanuel Osei');
  const [worshipLeader, setWorshipLeader] = useState(existingWorship || service.worship_leader || 'Sister Abena Serwaa');
  const [headUsher, setHeadUsher] = useState(existingUsher || service.head_usher || 'Kwame Mensah');
  const [soundMedia, setSoundMedia] = useState(existingSound || service.sound_media || 'Benjamin Antwi');
  const [announcementsLeader, setAnnouncementsLeader] = useState(
    existingAnnouncementsSteward || service.announcements_minister || 'Clara Gaewornu'
  );
  const [announcementText, setAnnouncementText] = useState(existingAnnouncementText);
  const [syncToMemberPortal, setSyncToMemberPortal] = useState(true);

  // Synchronize field defaults if existing assignments are loaded for the target date
  React.useEffect(() => {
    if (existingPreacher) setPreacher(existingPreacher);
    if (existingModerator) setServiceLeader(existingModerator);
    if (existingWorship) setWorshipLeader(existingWorship);
    if (existingUsher) setHeadUsher(existingUsher);
    if (existingSound) setSoundMedia(existingSound);
    if (existingAnnouncementsSteward) setAnnouncementsLeader(existingAnnouncementsSteward);
    if (existingAnnouncementText) setAnnouncementText(existingAnnouncementText);
  }, [targetDate, existingPreacher, existingModerator, existingWorship, existingUsher, existingSound, existingAnnouncementsSteward, existingAnnouncementText]);

  // Find matching member from string with robust title stripping and ID fallback
  const findMemberByName = (nameStr: string): Member | undefined => {
    if (!nameStr || !nameStr.trim()) return undefined;
    const trimmed = nameStr.trim();
    const byId = members.find((m) => m.id === trimmed || m.member_id.toLowerCase() === trimmed.toLowerCase());
    if (byId) return byId;

    const byPhone = members.find((m) => m.phone && cleanGhanaPhone(m.phone) === cleanGhanaPhone(trimmed));
    if (byPhone) return byPhone;

    const clean = trimmed
      .toLowerCase()
      .replace(/\b(prophet|pastor|elder|deacon|deaconess|brother|sister|bro|sis|minister|rev|reverend|dr|mrs|mr|ms|evangelist)\b/gi, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return members.find((m) => {
      const f = (m.first_name || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
      const l = (m.last_name || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
      const full = `${f} ${l}`.trim();
      const reverseFull = `${l} ${f}`.trim();
      return (
        clean === full ||
        clean === reverseFull ||
        clean.includes(full) ||
        full.includes(clean) ||
        (f && l && clean.includes(f) && clean.includes(l))
      );
    });
  };

  const handleSave = () => {
    const serviceUpdates: Partial<ChurchService> = {
      preacher: preacher.trim(),
      service_leader: serviceLeader.trim(),
      worship_leader: worshipLeader.trim(),
      head_usher: headUsher.trim(),
      sound_media: soundMedia.trim(),
      announcements_minister: announcementsLeader.trim(),
      announcements: announcementText.trim(),
    };

    const newAssignments: Omit<RosterAssignment, 'id' | 'created_at'>[] = [];

    if (syncToMemberPortal) {
      const roleConfigs = [
        {
          name: preacher.trim(),
          role_title: 'Preacher / Exhorter of the Word',
          department: 'intercessors' as const,
          report_time: computePriorTime(service.start_time, 30),
          notes: 'Pre-service prayer in inner vestry 30 mins prior to start of service.',
        },
        {
          name: serviceLeader.trim(),
          role_title: 'Service Moderator / Leader (MC)',
          department: 'ushers_protocol' as const,
          report_time: computePriorTime(service.start_time, 30),
          notes: 'Coordinate liturgy order and announcements with the secretariat.',
        },
        {
          name: announcementsLeader.trim(),
          role_title: 'Church Announcements & Secretariat Notices',
          department: 'ushers_protocol' as const,
          report_time: computePriorTime(service.start_time, 30),
          notes: 'Deliver church announcements, visitor welcome notices, and weekly ministry reminders.',
        },
        {
          name: worshipLeader.trim(),
          role_title: 'Worship Team / Music Director',
          department: 'praise_team' as const,
          report_time: computePriorTime(service.start_time, 45),
          notes: 'Sound check and band vocal tuning prior to prayer briefing.',
        },
        {
          name: headUsher.trim(),
          role_title: 'Head Usher & Protocol Captain',
          department: 'ushers_protocol' as const,
          report_time: computePriorTime(service.start_time, 45),
          notes: 'Oversee usher stations, tithe envelopes, and sanctuary seating.',
        },
        {
          name: soundMedia.trim(),
          role_title: 'Sound Engineer & Livestream Lead',
          department: 'sound_media' as const,
          report_time: computePriorTime(service.start_time, 45),
          notes: 'Setup PA system, microphones, PTZ cameras, and social media stream.',
        },
      ];

      roleConfigs.forEach((cfg) => {
        if (!cfg.name) return;
        const matchedMember = findMemberByName(cfg.name);
        newAssignments.push({
          service_id: service.id,
          service_name: service.name,
          date: targetDate,
          member_id: matchedMember ? matchedMember.id : `ext-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          member_name: matchedMember ? `${matchedMember.first_name} ${matchedMember.last_name}` : cfg.name,
          member_phone: matchedMember?.phone,
          department: cfg.department,
          role_title: cfg.role_title,
          report_time: cfg.report_time,
          status: 'confirmed',
          notes: cfg.notes,
          announcement: announcementText.trim() || undefined,
        });
      });
    }

    onSave(service.id, serviceUpdates, newAssignments);
    success(
      'Duty Roster Updated & Synchronized',
      `Ministers on duty for "${service.name}" (${targetDate}) saved and linked to Member Self-Service Portal.`
    );
    onClose();
  };

  const createWhatsAppLink = (ministerName: string, role: string) => {
    const matched = findMemberByName(ministerName);
    const phone = matched?.phone ? cleanGhanaPhone(matched.phone) : '233240000000';
    const message = `Calvary greetings from Greater Works City Church! This is a reminder that you are scheduled on duty as [${role}] for ${service.name} on ${targetDate} (${service.day_of_week}, ${service.start_time} - ${service.end_time} GMT) at the Main Sanctuary. Please arrive 30 minutes prior for pre-service prayer. You can also view and confirm this on your Member Portal. God bless you!`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-[#064e3b] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-700/60 rounded-lg">
              <Users className="w-5 h-5 text-emerald-200" />
            </span>
            <div>
              <h3 className="text-base font-bold">Service Duty Roster & Stewards</h3>
              <p className="text-xs text-emerald-200">{service.name} • {service.day_of_week}s</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/80 hover:text-white rounded-lg transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {/* Target Service Date Selector */}
          <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="font-bold text-emerald-950 flex items-center gap-1.5 text-xs">
                <Calendar className="w-4 h-4 text-emerald-700" />
                Target Service Date
              </span>
              <p className="text-[11px] text-emerald-800">
                Scheduled shift will appear on the assigned ministers' Member Portal for this service date.
              </p>
            </div>
            <input
              type="date"
              required
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="px-3 py-1.5 border border-emerald-300 rounded-lg bg-white text-xs font-bold text-slate-900 focus:outline-emerald-700"
            />
          </div>

          <datalist id="gwcc-members-datalist">
            {members.map((m) => (
              <option key={m.id} value={`${m.first_name} ${m.last_name}`}>
                {m.member_id} • {m.ministry_name || 'Member'} • {m.phone}
              </option>
            ))}
          </datalist>

          {/* Preacher */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 flex items-center gap-1.5">
                <Mic className="w-4 h-4 text-emerald-700" />
                Preacher / Exhorter of the Word
              </label>
              <a
                href={createWhatsAppLink(preacher, 'Preacher')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold"
                title="Send WhatsApp notification"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Notify</span>
              </a>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                list="gwcc-members-datalist"
                value={preacher}
                onChange={(e) => setPreacher(e.target.value)}
                placeholder="e.g. Prophet Elisha K. Richard"
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-semibold text-slate-900"
              />
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) setPreacher(e.target.value);
                }}
                className="px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-[11px] font-medium text-slate-700 sm:w-44"
              >
                <option value="">Choose Member...</option>
                {members.map((m) => (
                  <option key={m.id} value={`${m.first_name} ${m.last_name}`}>
                    {m.first_name} {m.last_name} ({m.member_id})
                  </option>
                ))}
              </select>
            </div>
            {(() => {
              const matched = findMemberByName(preacher);
              return matched ? (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 bg-emerald-50/90 px-2 py-1 rounded-md border border-emerald-200">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Linked to Member: <strong>{matched.first_name} {matched.last_name}</strong> ({matched.member_id}) • Will show on their Member Portal</span>
                </div>
              ) : preacher.trim() ? (
                <div className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  External / Visiting Minister: <strong>{preacher}</strong>
                </div>
              ) : null;
            })()}
          </div>

          {/* Service Leader / MC */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-700" />
                Service Moderator / Leader (MC)
              </label>
              <a
                href={createWhatsAppLink(serviceLeader, 'Service Leader')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Notify</span>
              </a>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                list="gwcc-members-datalist"
                value={serviceLeader}
                onChange={(e) => setServiceLeader(e.target.value)}
                placeholder="e.g. Pastor Emmanuel Osei"
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-semibold text-slate-900"
              />
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) setServiceLeader(e.target.value);
                }}
                className="px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-[11px] font-medium text-slate-700 sm:w-44"
              >
                <option value="">Choose Member...</option>
                {members.map((m) => (
                  <option key={m.id} value={`${m.first_name} ${m.last_name}`}>
                    {m.first_name} {m.last_name} ({m.member_id})
                  </option>
                ))}
              </select>
            </div>
            {(() => {
              const matched = findMemberByName(serviceLeader);
              return matched ? (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 bg-emerald-50/90 px-2 py-1 rounded-md border border-emerald-200">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Linked to Member: <strong>{matched.first_name} {matched.last_name}</strong> ({matched.member_id}) • Will show on their Member Portal</span>
                </div>
              ) : serviceLeader.trim() ? (
                <div className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  External / Visiting Minister: <strong>{serviceLeader}</strong>
                </div>
              ) : null;
            })()}
          </div>

          {/* Praise & Worship */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 flex items-center gap-1.5">
                <Music className="w-4 h-4 text-purple-700" />
                Worship Team / Music Director
              </label>
              <a
                href={createWhatsAppLink(worshipLeader, 'Worship Lead')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Notify</span>
              </a>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                list="gwcc-members-datalist"
                value={worshipLeader}
                onChange={(e) => setWorshipLeader(e.target.value)}
                placeholder="e.g. Sister Abena Serwaa or Pastor Emmanuel Osei"
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-semibold text-slate-900"
              />
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) setWorshipLeader(e.target.value);
                }}
                className="px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-[11px] font-medium text-slate-700 sm:w-44"
              >
                <option value="">Choose Member...</option>
                {members.map((m) => (
                  <option key={m.id} value={`${m.first_name} ${m.last_name}`}>
                    {m.first_name} {m.last_name} ({m.member_id})
                  </option>
                ))}
              </select>
            </div>
            {(() => {
              const matched = findMemberByName(worshipLeader);
              return matched ? (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 bg-emerald-50/90 px-2 py-1 rounded-md border border-emerald-200">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Linked to Member: <strong>{matched.first_name} {matched.last_name}</strong> ({matched.member_id}) • Will show on their Member Portal</span>
                </div>
              ) : worshipLeader.trim() ? (
                <div className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  Choir / Ministry Department: <strong>{worshipLeader}</strong>
                </div>
              ) : null;
            })()}
          </div>

          {/* Ushers & Protocol */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-amber-700" />
                Head Usher & Protocol Captain
              </label>
              <a
                href={createWhatsAppLink(headUsher, 'Head Usher')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Notify</span>
              </a>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                list="gwcc-members-datalist"
                value={headUsher}
                onChange={(e) => setHeadUsher(e.target.value)}
                placeholder="e.g. Kwame Mensah or Akosua Frimpong"
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-semibold text-slate-900"
              />
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) setHeadUsher(e.target.value);
                }}
                className="px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-[11px] font-medium text-slate-700 sm:w-44"
              >
                <option value="">Choose Member...</option>
                {members.map((m) => (
                  <option key={m.id} value={`${m.first_name} ${m.last_name}`}>
                    {m.first_name} {m.last_name} ({m.member_id})
                  </option>
                ))}
              </select>
            </div>
            {(() => {
              const matched = findMemberByName(headUsher);
              return matched ? (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 bg-emerald-50/90 px-2 py-1 rounded-md border border-emerald-200">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Linked to Member: <strong>{matched.first_name} {matched.last_name}</strong> ({matched.member_id}) • Will show on their Member Portal</span>
                </div>
              ) : headUsher.trim() ? (
                <div className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  External / Lead Officer: <strong>{headUsher}</strong>
                </div>
              ) : null;
            })()}
          </div>

          {/* Media & Livestream */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-rose-700" />
                Sound Engineer & Livestream Lead
              </label>
              <a
                href={createWhatsAppLink(soundMedia, 'Sound & Livestream Lead')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Notify</span>
              </a>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                list="gwcc-members-datalist"
                value={soundMedia}
                onChange={(e) => setSoundMedia(e.target.value)}
                placeholder="e.g. Benjamin Antwi or David Quaye"
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-semibold text-slate-900"
              />
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) setSoundMedia(e.target.value);
                }}
                className="px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-[11px] font-medium text-slate-700 sm:w-44"
              >
                <option value="">Choose Member...</option>
                {members.map((m) => (
                  <option key={m.id} value={`${m.first_name} ${m.last_name}`}>
                    {m.first_name} {m.last_name} ({m.member_id})
                  </option>
                ))}
              </select>
            </div>
            {(() => {
              const matched = findMemberByName(soundMedia);
              return matched ? (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 bg-emerald-50/90 px-2 py-1 rounded-md border border-emerald-200">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Linked to Member: <strong>{matched.first_name} {matched.last_name}</strong> ({matched.member_id}) • Will show on their Member Portal</span>
                </div>
              ) : soundMedia.trim() ? (
                <div className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  Media Volunteer / Specialist: <strong>{soundMedia}</strong>
                </div>
              ) : null;
            })()}
          </div>

          {/* Church Announcements & Notices Steward */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 flex items-center gap-1.5">
                <Megaphone className="w-4 h-4 text-amber-600" />
                Church Announcements & Secretariat Steward
              </label>
              <a
                href={createWhatsAppLink(announcementsLeader, 'Announcements Steward')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold"
                title="Send WhatsApp notification"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Notify</span>
              </a>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                list="gwcc-members-datalist"
                value={announcementsLeader}
                onChange={(e) => setAnnouncementsLeader(e.target.value)}
                placeholder="e.g. Clara Gaewornu or Secretariat Steward"
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-semibold text-slate-900"
              />
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) setAnnouncementsLeader(e.target.value);
                }}
                className="px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-[11px] font-medium text-slate-700 sm:w-44"
              >
                <option value="">Choose Member...</option>
                {members.map((m) => (
                  <option key={m.id} value={`${m.first_name} ${m.last_name}`}>
                    {m.first_name} {m.last_name} ({m.member_id})
                  </option>
                ))}
              </select>
            </div>
            {(() => {
              const matched = findMemberByName(announcementsLeader);
              return matched ? (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 bg-emerald-50/90 px-2 py-1 rounded-md border border-emerald-200">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Linked to Member: <strong>{matched.first_name} {matched.last_name}</strong> ({matched.member_id}) • Will show on their Member Portal</span>
                </div>
              ) : announcementsLeader.trim() ? (
                <div className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  Announcements Steward: <strong>{announcementsLeader}</strong>
                </div>
              ) : null;
            })()}
          </div>

          {/* Service Announcements & Ministerial Notices Field */}
          <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-amber-950 flex items-center gap-1.5">
                <Megaphone className="w-4 h-4 text-amber-700" />
                Service Announcements & Ministerial Notices
              </label>
              <span className="text-[10px] text-amber-800 font-semibold bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-200">
                Shared to all duty stewards & member portals
              </span>
            </div>
            <textarea
              rows={3}
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              placeholder="e.g. 1. Upcoming Friday All-Night Vigil (10 PM). 2. Foundation School graduation next Sunday. 3. New converts and first-time visitors reception in Galilee Hall immediately after benediction."
              className="w-full px-3 py-2 border border-amber-200 rounded-lg bg-white text-xs font-medium text-slate-900 focus:outline-emerald-600 resize-none shadow-2xs"
            />
            <p className="text-[11px] text-amber-800 leading-relaxed">
              These notices will be published alongside duty schedules and delivered directly to stewards on duty for this service.
            </p>
          </div>

          {/* Sync to Member Portal Checkbox */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2.5">
            <input
              type="checkbox"
              id="sync-portal"
              checked={syncToMemberPortal}
              onChange={(e) => setSyncToMemberPortal(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
            />
            <label htmlFor="sync-portal" className="text-xs text-slate-700 cursor-pointer">
              <span className="font-bold text-slate-900 block">Synchronize to Member Self-Service Portal & Master Roster</span>
              <span className="text-[11px] text-slate-500">
                Immediately reflects in the Member Portal for assigned volunteers under "My Service Duty Roster".
              </span>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-white text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-[#064e3b] hover:bg-[#047857] text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 cursor-pointer transition"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save & Publish Roster</span>
          </button>
        </div>
      </div>
    </div>
  );
};

