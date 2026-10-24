import React, { useState, useRef } from 'react';
import { X, UserPlus, Search, Check, Phone, ShieldCheck, HeartHandshake, AlertCircle } from 'lucide-react';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { useToast } from '../../contexts/ToastContext';

import { useModalFocus } from '../../hooks/useModalFocus';
import { EVENT_SAVE_NOTICE } from '../../features/events/eventRules';

interface RegisterAttendeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
}

const ROLES = [
  'Attendee',
  'Usher',
  'Protocol',
  'Sound/Media',
  'Praise Team',
  'Intercessor',
  'Welfare & Hospitality',
  'Security & Parking',
  'First Aid / Medical',
];

export const RegisterAttendeeModal: React.FC<RegisterAttendeeModalProps> = ({
  isOpen,
  onClose,
  eventId,
  eventTitle,
}) => {
  const { members, events, addEventAttendee } = useChurchData();
  const { success } = useToast();
  const [activeTab, setActiveTab] = useState<'member' | 'guest'>('member');
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedRole, setSelectedRole] = useState('Attendee');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Guest inputs
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const close = () => { if (!savingRef.current) onClose(); };
  const panel = useModalFocus(isOpen, close);
  if (!isOpen) return null;

  const currentEvent = events.find((e) => e.id === eventId);
  const existingAttendees = currentEvent?.attendees || [];

  const filteredMembers = members.filter((m) => {
    if (m.is_archived || ['deceased','transferred'].includes(m.status)) return false;
    const q = memberSearch.toLowerCase();
    const fullName = `${m.first_name} ${m.last_name}`.toLowerCase();
    const phone = m.phone || '';
    const memId = m.member_id || '';
    return fullName.includes(q) || phone.includes(q) || memId.toLowerCase().includes(q);
  }).slice(0, 10);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    setErrorMsg(null);
    savingRef.current = true; setSaving(true);
    try {

    if (activeTab === 'member') {
      if (!selectedMemberId) {
        setErrorMsg('Please select a member from the list.');
        return;
      }
      const selectedMember = members.find((m) => m.id === selectedMemberId);
      if (!selectedMember) return;

      const alreadyAdded = existingAttendees.some((a) => (a.member_id === selectedMember.id || a.member_id === selectedMember.member_id));
      if (alreadyAdded) {
        setErrorMsg(`${selectedMember.first_name} ${selectedMember.last_name} is already registered for this event.`);
        return;
      }

      await addEventAttendee(eventId, {
        name: `${selectedMember.first_name} ${selectedMember.last_name}`,
        phone: selectedMember.phone,
        email: selectedMember.email,
        member_id: selectedMember.id,
        role: selectedRole,
      });
      success('Registration Saved', EVENT_SAVE_NOTICE);
    } else {
      if (!guestName.trim()) {
        setErrorMsg('Please enter the guest full name.');
        return;
      }

      await addEventAttendee(eventId, {
        name: guestName.trim(),
        phone: guestPhone.trim() || undefined,
        email: guestEmail.trim() || undefined,
        role: selectedRole,
      });
      success('Registration Saved', EVENT_SAVE_NOTICE);
    }

    onClose();
    } catch (error) { setErrorMsg(error instanceof Error ? error.message : 'Unable to save this registration.'); }
    finally { savingRef.current = false; setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div ref={panel} role="dialog" aria-modal="true" aria-label="Register Attendee / Volunteer" className="relative w-full min-w-0 max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-rose-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-rose-300" />
            <div>
              <h3 className="text-sm font-bold text-white">Register Attendee / Volunteer</h3>
              <p className="text-[11px] text-rose-200 line-clamp-1">{eventTitle}</p>
            </div>
          </div>
          <button
            aria-label="Close form" onClick={close} disabled={saving}
            className="p-1 text-white/70 hover:text-white rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('member')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition ${
              activeTab === 'member'
                ? 'bg-white text-rose-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Church Member Roster
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('guest')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition ${
              activeTab === 'guest'
                ? 'bg-white text-rose-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            External Guest / Visitor
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <fieldset disabled={saving} className="contents">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Role Selection */}
          <div>
            <label htmlFor="attendee-role" className="block font-semibold text-slate-700 mb-1">
              Assignment / Participation Role
            </label>
            <select
              id="attendee-role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          {activeTab === 'member' ? (
            <div className="space-y-2">
              <label className="block font-semibold text-slate-700">
                Select Member
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search by name, ID (GWCC-000001), or phone..."
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-slate-50/50">
                {filteredMembers.map((m) => {
                  const isSelected = selectedMemberId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMemberId(m.id)}
                      className={`w-full p-2.5 text-left flex items-center justify-between text-xs transition ${
                        isSelected
                          ? 'bg-rose-50 border-l-4 border-rose-700 text-rose-900'
                          : 'hover:bg-white text-slate-700'
                      }`}
                    >
                      <div>
                        <div className="font-semibold">
                          {m.first_name} {m.last_name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {m.member_id} {m.phone ? `· ${m.phone}` : ''} {m.ministry_name ? `· ${m.ministry_name}` : ''}
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-rose-700" />}
                    </button>
                  );
                })}
                {filteredMembers.length === 0 && (
                  <div className="p-4 text-center text-slate-400 text-xs">
                    No members match your search
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label htmlFor="guest-name" className="block font-semibold text-slate-700 mb-1">Guest Full Name *</label>
                <input
                  id="guest-name"
                  type="text"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="e.g. Deaconess Beatrice Mensah"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="guest-phone" className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    id="guest-phone"
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="024 000 0000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label htmlFor="guest-email" className="block font-semibold text-slate-700 mb-1">Email (Optional)</label>
                  <input
                    id="guest-email"
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="guest@gmail.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={close} disabled={saving}
              className="px-3.5 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || (activeTab === 'member' && !selectedMemberId)}
              className="px-4 py-2 bg-rose-800 hover:bg-rose-900 disabled:opacity-50 text-white rounded-xl font-bold shadow-xs transition"
            >
              {saving ? 'Saving...' : 'Confirm Registration'}
            </button>
          </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
};
