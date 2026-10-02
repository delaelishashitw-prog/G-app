import React, { useState } from 'react';
import { X, Check, Users, MessageCircle, Mic, Music, Shield, Radio, Sparkles } from 'lucide-react';
import { ChurchService, Member } from '../../types/database.types';
import { cleanGhanaPhone } from '../../lib/currencyUtils';
import { useToast } from '../../contexts/ToastContext';

interface DutyRosterModalProps {
  service: ChurchService;
  members: Member[];
  onSave: (serviceId: string, updates: Partial<ChurchService>) => void;
  onClose: () => void;
}

export const DutyRosterModal: React.FC<DutyRosterModalProps> = ({
  service,
  members,
  onSave,
  onClose,
}) => {
  const { success } = useToast();

  const [preacher, setPreacher] = useState(service.preacher || 'Prophet Elisha K. Richard');
  const [serviceLeader, setServiceLeader] = useState(service.service_leader || 'Pastor David Osei-Tutu');
  const [worshipLeader, setWorshipLeader] = useState(service.worship_leader || 'Voice of Dominion (Choir)');
  const [headUsher, setHeadUsher] = useState('Deacon Stephen Antwi');
  const [soundMedia, setSoundMedia] = useState('Brother Samuel Darko (Media Lead)');

  const handleSave = () => {
    onSave(service.id, {
      preacher,
      service_leader: serviceLeader,
      worship_leader: worshipLeader,
    });
    success('Duty Roster Updated', `Ministers on duty for "${service.name}" saved.`);
    onClose();
  };

  const createWhatsAppLink = (ministerName: string, role: string) => {
    // Find member phone if matches
    const matched = members.find(
      (m) => `${m.first_name} ${m.last_name}`.toLowerCase() === ministerName.toLowerCase() ||
             ministerName.toLowerCase().includes(m.first_name.toLowerCase())
    );
    const phone = matched?.phone ? cleanGhanaPhone(matched.phone) : '233240000000';
    const message = `Calvary greetings from Greater Works City Church! This is a reminder that you are scheduled on duty as [${role}] for ${service.name} this ${service.day_of_week} (${service.start_time} - ${service.end_time} GMT) at the Main Sanctuary. Please arrive 30 minutes prior for pre-service prayer. God bless you!`;
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
          <p className="text-slate-500">
            Assign and notify the key ministerial leaders and technical stewards on duty for this service.
          </p>

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
            <input
              type="text"
              value={preacher}
              onChange={(e) => setPreacher(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-semibold text-slate-900"
            />
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
            <input
              type="text"
              value={serviceLeader}
              onChange={(e) => setServiceLeader(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-semibold text-slate-900"
            />
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
            <input
              type="text"
              value={worshipLeader}
              onChange={(e) => setWorshipLeader(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-semibold text-slate-900"
            />
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
            <input
              type="text"
              value={headUsher}
              onChange={(e) => setHeadUsher(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-semibold text-slate-900"
            />
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
            <input
              type="text"
              value={soundMedia}
              onChange={(e) => setSoundMedia(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-semibold text-slate-900"
            />
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
            <span>Save Roster</span>
          </button>
        </div>
      </div>
    </div>
  );
};
