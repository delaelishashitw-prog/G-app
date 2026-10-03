import React, { useState } from 'react';
import { X, UserPlus, Gift, Calendar, Check, Hash, User } from 'lucide-react';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useToast } from '../contexts/ToastContext';
import { PaymentMethod, GenderType } from '../types/database.types';
import { ProfilePhotoUpload } from './ProfilePhotoUpload';

interface QuickActionModalProps {
  isOpen: boolean;
  type: 'member' | 'visitor' | 'giving' | 'attendance' | 'event' | null;
  onClose: () => void;
}

export const QuickActionModal: React.FC<QuickActionModalProps> = ({ isOpen, type, onClose }) => {
  const { error: toastError, success: toastSuccess } = useToast();
  const {
    members,
    ministries,
    services,
    addMember,
    addVisitor,
    recordGiving,
    recordAttendance,
    createEvent,
  } = useChurchData();

  const [notification, setNotification] = useState<string | null>(null);

  // Member form state
  const [memberForm, setMemberForm] = useState({
    first_name: '',
    last_name: '',
    gender: 'male' as GenderType,
    phone: '+233 ',
    email: '',
    marital_status: 'single' as 'single' | 'married',
    city: 'Accra',
    region: 'Greater Accra',
    gps_address: 'GA-',
    status: 'active' as const,
    date_joined: new Date().toISOString().split('T')[0],
    ministry_id: '',
    profile_photo_url: '',
  });

  // Visitor form state
  const [visitorForm, setVisitorForm] = useState({
    full_name: '',
    gender: 'female' as GenderType,
    phone: '+233 ',
    email: '',
    service_attended: 'Sunday 2nd Service (Celebration Service)',
    invited_by: '',
    how_heard: 'Friend / Family',
    prayer_request: '',
  });

  // Giving form state
  const [givingMode, setGivingMode] = useState<'name' | 'tithe_number'>('name');
  const [givingForm, setGivingForm] = useState({
    member_id: '',
    tithe_number: '',
    donor_name: '',
    category: 'Tithe' as const,
    amount: '',
    payment_method: 'mobile_money' as PaymentMethod,
    payment_channel: 'MTN MoMo',
    reference_number: '',
    notes: '',
  });

  // Attendance form state
  const [attendanceForm, setAttendanceForm] = useState({
    service_id: services[0]?.id || '',
    person_type: 'member' as 'member' | 'visitor',
    person_id: members[0]?.id || '',
  });

  // Event form state
  const [eventForm, setEventForm] = useState({
    title: '',
    event_type: 'church_service' as const,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    start_time: '18:30',
    end_time: '20:30',
    venue: 'GWCC Main Auditorium, Joma, Accra',
    expected_attendance: '200',
  });

  if (!isOpen || !type) return null;

  const showSuccess = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
      onClose();
    }, 1200);
  };

  const handleMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberForm.first_name || !memberForm.last_name || !memberForm.phone) return;
    const selectedMin = ministries.find((m) => m.id === memberForm.ministry_id);
    const dateJoined = memberForm.date_joined || new Date().toISOString().split('T')[0];
    const res = addMember({
      first_name: memberForm.first_name,
      last_name: memberForm.last_name,
      gender: memberForm.gender,
      phone: memberForm.phone,
      email: memberForm.email || undefined,
      marital_status: memberForm.marital_status,
      nationality: 'Ghanaian',
      city: memberForm.city,
      region: memberForm.region,
      gps_address: memberForm.gps_address,
      status: memberForm.status,
      profile_photo_url: memberForm.profile_photo_url || undefined,
      membership_date: dateJoined,
      date_joined: dateJoined,
      ministry_id: memberForm.ministry_id || undefined,
      ministry_name: selectedMin ? selectedMin.name : undefined,
      baptism_status: false,
      salvation_status: true,
      membership_class_completed: false,
      is_archived: false,
    });
    showSuccess(`Registered ${res.first_name} (${res.member_id}) successfully!`);
  };

  const handleVisitorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorForm.full_name || !visitorForm.phone) return;
    addVisitor({
      full_name: visitorForm.full_name,
      gender: visitorForm.gender,
      phone: visitorForm.phone,
      email: visitorForm.email || undefined,
      visit_date: new Date().toISOString().split('T')[0],
      service_attended: visitorForm.service_attended,
      invited_by: visitorForm.invited_by || undefined,
      how_heard: visitorForm.how_heard,
      prayer_request: visitorForm.prayer_request || undefined,
      follow_up_status: 'new',
    });
    showSuccess(`Visitor ${visitorForm.full_name} registered successfully!`);
  };

  const handleGivingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(givingForm.amount);
    if (isNaN(amt) || amt <= 0) return;

    let memberName = '';
    let titheNum = givingForm.tithe_number ? givingForm.tithe_number.trim() : '';
    let memberId = givingForm.member_id;

    if (memberId) {
      const mem = members.find((m) => m.id === memberId);
      memberName = mem ? `${mem.first_name} ${mem.last_name}` : '';
      if (!titheNum && mem?.tithe_number) {
        titheNum = mem.tithe_number;
      }
    } else if (titheNum) {
      const mem = members.find(
        (m) =>
          m.tithe_number?.trim().toLowerCase() === titheNum.toLowerCase() ||
          (m.tithe_number && titheNum.replace(/\D/g, '') && m.tithe_number.replace(/\D/g, '') === titheNum.replace(/\D/g, ''))
      );
      if (mem) {
        memberId = mem.id;
        memberName = `${mem.first_name} ${mem.last_name}`;
        titheNum = mem.tithe_number || titheNum;
      }
    }

    recordGiving({
      member_id: memberId || undefined,
      member_name: memberName || undefined,
      tithe_number: titheNum || undefined,
      donor_name: memberName ? undefined : givingForm.donor_name || (titheNum ? `Tithe Envelope #${titheNum}` : 'Anonymous Giver'),
      category: givingForm.category,
      amount: amt,
      currency: 'GHS',
      date: new Date().toISOString().split('T')[0],
      payment_method: givingForm.payment_method,
      payment_channel: givingForm.payment_channel,
      reference_number: givingForm.reference_number || undefined,
      notes: givingForm.notes || undefined,
    });
    showSuccess(`Recorded GH₵ ${amt.toFixed(2)} (${givingForm.category})${titheNum ? ` • Tithe #${titheNum}` : ''}!`);
  };

  const handleAttendanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!attendanceForm.service_id || !attendanceForm.person_id) return;
    const res = recordAttendance(
      attendanceForm.service_id,
      attendanceForm.person_type,
      attendanceForm.person_id,
      'manual'
    );
    if (res.success) {
      showSuccess(res.message);
    } else {
      toastError('Attendance Recording', res.message);
    }
  };

  const handleEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.title) return;
    createEvent({
      title: eventForm.title,
      event_type: eventForm.event_type,
      start_date: eventForm.start_date,
      end_date: eventForm.end_date,
      start_time: eventForm.start_time,
      end_time: eventForm.end_time,
      venue: eventForm.venue,
      expected_attendance: parseInt(eventForm.expected_attendance, 10) || 100,
      status: 'upcoming',
    });
    showSuccess(`Scheduled: ${eventForm.title}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
              {type === 'member' && <UserPlus className="w-5 h-5" />}
              {type === 'visitor' && <UserPlus className="w-5 h-5 text-blue-600" />}
              {type === 'giving' && <Gift className="w-5 h-5 text-amber-600" />}
              {type === 'attendance' && <Calendar className="w-5 h-5 text-purple-600" />}
              {type === 'event' && <Calendar className="w-5 h-5 text-rose-600" />}
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-base capitalize">
                {type === 'member' && 'Add New Church Member'}
                {type === 'visitor' && 'Register First-Time Visitor'}
                {type === 'giving' && 'Record Giving / Donation (GH₵)'}
                {type === 'attendance' && 'Check-in Attendance'}
                {type === 'event' && 'Schedule Church Program'}
              </h3>
              <p className="text-xs text-slate-500">Greater Works City Church, Joma</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Banner */}
        {notification && (
          <div className="p-3 bg-emerald-600 text-white text-sm font-semibold flex items-center justify-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4" /> {notification}
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {type === 'member' && (
            <form onSubmit={handleMemberSubmit} className="space-y-4">
              <ProfilePhotoUpload
                value={memberForm.profile_photo_url}
                onChange={(url) => setMemberForm((prev) => ({ ...prev, profile_photo_url: url }))}
                memberName={`${memberForm.first_name} ${memberForm.last_name}`.trim() || 'New Member'}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={memberForm.first_name}
                    onChange={(e) => setMemberForm({ ...memberForm, first_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. Kwadwo"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={memberForm.last_name}
                    onChange={(e) => setMemberForm({ ...memberForm, last_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. Antwi"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                  <select
                    value={memberForm.gender}
                    onChange={(e) => setMemberForm({ ...memberForm, gender: e.target.value as GenderType })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone (+233) *</label>
                  <input
                    type="tel"
                    required
                    value={memberForm.phone}
                    onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                    placeholder="+233 24 123 4567"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">GhanaPost GPS Digital Address</label>
                  <input
                    type="text"
                    value={memberForm.gps_address}
                    onChange={(e) => setMemberForm({ ...memberForm, gps_address: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono uppercase"
                    placeholder="GA-183-4921"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    value={memberForm.email}
                    onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    placeholder="member@gmail.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date Joined GWCC *</label>
                  <input
                    type="date"
                    required
                    value={memberForm.date_joined}
                    onChange={(e) => setMemberForm({ ...memberForm, date_joined: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ministry Fellowship</label>
                  <select
                    value={memberForm.ministry_id}
                    onChange={(e) => setMemberForm({ ...memberForm, ministry_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">-- General Assembly --</option>
                    {ministries.map((min) => (
                      <option key={min.id} value={min.id}>
                        {min.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#064e3b] hover:bg-[#047857] text-white font-semibold text-sm rounded-xl transition shadow-md"
                >
                  Save Member & Auto-Generate ID (GWCC-######)
                </button>
              </div>
            </form>
          )}

          {type === 'visitor' && (
            <form onSubmit={handleVisitorSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={visitorForm.full_name}
                  onChange={(e) => setVisitorForm({ ...visitorForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  placeholder="e.g. Samuel Kyei"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number (+233) *</label>
                  <input
                    type="tel"
                    required
                    value={visitorForm.phone}
                    onChange={(e) => setVisitorForm({ ...visitorForm, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                    placeholder="+233 20 000 0000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                  <select
                    value={visitorForm.gender}
                    onChange={(e) => setVisitorForm({ ...visitorForm, gender: e.target.value as GenderType })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Service Attended</label>
                <select
                  value={visitorForm.service_attended}
                  onChange={(e) => setVisitorForm({ ...visitorForm, service_attended: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  <option value="Sunday 1st Service (Prophetic Encounter)">Sunday 1st Service</option>
                  <option value="Sunday 2nd Service (Celebration Service)">Sunday 2nd Service</option>
                  <option value="Midweek Miracle & Teaching Service">Midweek Miracle Service</option>
                  <option value="Friday All-Night Deliverance Vigil">Friday All-Night Vigil</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Prayer Request / Notes</label>
                <textarea
                  rows={2}
                  value={visitorForm.prayer_request}
                  onChange={(e) => setVisitorForm({ ...visitorForm, prayer_request: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  placeholder="E.g. Praying for employment, healing, family salvation..."
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-sm rounded-xl transition shadow-md"
                >
                  Register Visitor for Pastoral Follow-Up
                </button>
              </div>
            </form>
          )}

          {type === 'giving' && (
            <form onSubmit={handleGivingSubmit} className="space-y-4">
              {/* Dual Mode Switcher */}
              <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setGivingMode('name')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    givingMode === 'name'
                      ? 'bg-white text-emerald-950 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <User className="w-3.5 h-3.5 text-emerald-700" />
                  <span>By Member Name</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setGivingMode('tithe_number');
                    setGivingForm((prev) => ({ ...prev, category: 'Tithe' }));
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    givingMode === 'tithe_number'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Hash className="w-3.5 h-3.5 text-emerald-200" />
                  <span>By Tithe Number</span>
                </button>
              </div>

              {/* Mode A: By Tithe Number */}
              {givingMode === 'tithe_number' && (
                <div className="space-y-2 p-3 bg-amber-50/60 rounded-xl border border-amber-200 text-xs">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-amber-950 text-xs flex items-center gap-1.5">
                      <Hash className="w-4 h-4 text-amber-700" />
                      Enter Tithe Envelope / Card # *
                    </label>
                    <span className="text-[11px] text-amber-800">Auto-resolves member</span>
                  </div>

                  <input
                    type="text"
                    list="quick-tithe-list"
                    value={givingForm.tithe_number}
                    onChange={(e) => {
                      const val = e.target.value;
                      const cleanedVal = val.trim();
                      const matched = members.find(
                        (m) =>
                          m.tithe_number?.toLowerCase() === cleanedVal.toLowerCase() ||
                          (cleanedVal.length >= 2 &&
                            m.tithe_number &&
                            cleanedVal.replace(/\D/g, '') &&
                            m.tithe_number.replace(/\D/g, '') === cleanedVal.replace(/\D/g, ''))
                      );

                      if (matched) {
                        setGivingForm((prev) => ({
                          ...prev,
                          tithe_number: val,
                          member_id: matched.id,
                          category: 'Tithe',
                        }));
                      } else {
                        setGivingForm((prev) => ({
                          ...prev,
                          tithe_number: val,
                          member_id: '',
                          category: 'Tithe',
                        }));
                      }
                    }}
                    placeholder="Type or select tithe # (e.g. T-1001)..."
                    className="w-full px-3 py-2 text-sm border border-amber-300 rounded-lg font-mono font-bold bg-white"
                  />
                  <datalist id="quick-tithe-list">
                    {members
                      .filter((m) => !m.is_archived && m.tithe_number)
                      .map((m) => (
                        <option key={m.id} value={m.tithe_number}>
                          {m.first_name} {m.last_name} ({m.member_id})
                        </option>
                      ))}
                  </datalist>

                  {givingForm.tithe_number && (
                    <div>
                      {givingForm.member_id ? (
                        (() => {
                          const m = members.find((x) => x.id === givingForm.member_id);
                          if (!m) return null;
                          return (
                            <div className="p-2 bg-emerald-100/90 border border-emerald-300 rounded-lg flex items-center justify-between text-xs">
                              <span className="font-bold text-emerald-950">
                                {m.first_name} {m.last_name} ({m.member_id})
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-800 text-white font-mono text-[10px]">
                                Tithe #{m.tithe_number || givingForm.tithe_number}
                              </span>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="p-2 bg-amber-100/90 border border-amber-300 rounded-lg text-[11px] text-amber-950">
                          <span>Tithe Envelope #{givingForm.tithe_number} (Unassigned envelope)</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Mode B: By Member Name */}
              {givingMode === 'name' && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Member (or leave blank for Anonymous)</label>
                  <select
                    value={givingForm.member_id}
                    onChange={(e) => {
                      const memId = e.target.value;
                      const selected = members.find((m) => m.id === memId);
                      setGivingForm((prev) => ({
                        ...prev,
                        member_id: memId,
                        tithe_number: selected?.tithe_number || '',
                        donor_name: selected ? '' : prev.donor_name,
                      }));
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  >
                    <option value="">-- Anonymous / Congregational Giving --</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.first_name} {m.last_name} ({m.member_id} {m.tithe_number ? `• Tithe #${m.tithe_number}` : ''})
                      </option>
                    ))}
                  </select>

                  {givingForm.member_id && (
                    (() => {
                      const m = members.find((x) => x.id === givingForm.member_id);
                      if (!m) return null;
                      return (
                        <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                          <span className="text-slate-600 font-medium">
                            Member ID: <strong className="text-slate-900">{m.member_id}</strong>
                          </span>
                          {m.tithe_number ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono font-bold text-[11px] border border-emerald-300 flex items-center gap-1">
                              <Hash className="w-3 h-3 text-emerald-700" />
                              Tithe #{m.tithe_number}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No Tithe # Assigned</span>
                          )}
                        </div>
                      );
                    })()
                  )}

                  {!givingForm.member_id && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Donor Name / Source</label>
                      <input
                        type="text"
                        value={givingForm.donor_name}
                        onChange={(e) => setGivingForm({ ...givingForm, donor_name: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                        placeholder="e.g. Sunday Basket Offering or Guest Donor"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Giving Category *</label>
                  <select
                    value={givingForm.category}
                    onChange={(e) => setGivingForm({ ...givingForm, category: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  >
                    <option value="Tithe">Tithe (10%)</option>
                    <option value="Offering">Offering</option>
                    <option value="Thanksgiving">Thanksgiving</option>
                    <option value="Building Fund">Building Fund</option>
                    <option value="First Fruit">First Fruit</option>
                    <option value="Missions">Missions</option>
                    <option value="Seed">Sacrificial Seed</option>
                    <option value="Donation">Special Donation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (GH₵) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={givingForm.amount}
                    onChange={(e) => setGivingForm({ ...givingForm, amount: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono font-bold"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={givingForm.payment_method}
                    onChange={(e) => setGivingForm({ ...givingForm, payment_method: e.target.value as PaymentMethod })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  >
                    <option value="mobile_money">Mobile Money (MoMo)</option>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="card">Card / POS</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Channel / Telco</label>
                  <input
                    type="text"
                    value={givingForm.payment_channel}
                    onChange={(e) => setGivingForm({ ...givingForm, payment_channel: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    placeholder="MTN MoMo / Telecel Cash / GCB"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Transaction Ref / MoMo ID</label>
                <input
                  type="text"
                  value={givingForm.reference_number}
                  onChange={(e) => setGivingForm({ ...givingForm, reference_number: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  placeholder="e.g. MM-20260923-0199"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-semibold text-sm rounded-xl transition shadow-md"
                >
                  Record Giving Record (GH₵)
                </button>
              </div>
            </form>
          )}

          {type === 'attendance' && (
            <form onSubmit={handleAttendanceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Church Service *</label>
                <select
                  value={attendanceForm.service_id}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, service_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-medium"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.day_of_week} {s.start_time})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Person to Check In *</label>
                <select
                  value={attendanceForm.person_id}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, person_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-medium"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name} ({m.member_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-semibold text-sm rounded-xl transition shadow-md"
                >
                  Record Attendance Check-in
                </button>
              </div>
            </form>
          )}

          {type === 'event' && (
            <form onSubmit={handleEventSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Event Title *</label>
                <input
                  type="text"
                  required
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  placeholder="e.g. Night of Prophetic Praise"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Event Date</label>
                  <input
                    type="date"
                    value={eventForm.start_date}
                    onChange={(e) => setEventForm({ ...eventForm, start_date: e.target.value, end_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Venue</label>
                  <input
                    type="text"
                    value={eventForm.venue}
                    onChange={(e) => setEventForm({ ...eventForm, venue: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-semibold text-sm rounded-xl transition shadow-md"
                >
                  Schedule Church Event
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
