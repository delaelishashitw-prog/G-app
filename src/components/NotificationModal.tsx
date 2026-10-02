import React from 'react';
import { X, Cake, Phone, MessageCircle, AlertCircle, Sparkles, ArrowRight, UserCheck, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChurchData } from '../contexts/ChurchDataContext';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { members, visitors, prayerRequests, pledges } = useChurchData();

  if (!isOpen) return null;

  // Check upcoming birthdays (in September / current month or near dates)
  const today = new Date();
  const currentMonth = today.getMonth() + 1;

  const birthdayMembers = members.filter((m) => {
    if (!m.date_of_birth) return false;
    const parts = m.date_of_birth.split('-');
    if (parts.length < 3) return false;
    const birthMonth = parseInt(parts[1], 10);
    return birthMonth === currentMonth;
  });

  const pendingVisitors = visitors.filter(
    (v) => v.follow_up_status === 'new' || v.follow_up_status === 'follow_up_required'
  );

  const urgentPrayers = prayerRequests.filter((p) => p.status === 'new');

  const outstandingPledges = pledges.filter((p) => p.status === 'partially_paid' || p.status === 'active');

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 sm:p-6 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Pastoral Action Center</h3>
              <p className="text-xs text-slate-500">Real-time alerts & ministerial reminders</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Upcoming Birthdays Section */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                <Cake className="w-4 h-4 text-amber-600" />
                Birthdays This Month ({birthdayMembers.length})
              </span>
              <span className="text-[10px] bg-amber-200/60 text-amber-900 px-2 py-0.5 rounded-full font-semibold">
                GWCC Celebrations
              </span>
            </div>
            {birthdayMembers.length > 0 ? (
              <div className="space-y-2 pt-1">
                {birthdayMembers.map((m) => {
                  const birthDay = m.date_of_birth ? m.date_of_birth.split('-')[2] : '';
                  const cleanPhone = m.phone.replace(/[^0-9]/g, '');
                  const whatsappUrl = `https://wa.me/${cleanPhone}?text=Happy%20Birthday%20${encodeURIComponent(
                    m.first_name
                  )}!%20Grace%20and%20peace%20from%20Greater%20Works%20City%20Church%20(GWCC).%20May%20this%20new%20season%20bring%20breakthrough!`;

                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-2 bg-white rounded-lg border border-amber-100 shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5">
                        {m.profile_photo_url ? (
                          <img
                            src={m.profile_photo_url}
                            alt={m.first_name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center font-bold text-xs">
                            {m.first_name[0]}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-xs text-slate-800">
                            {m.first_name} {m.last_name}
                          </p>
                          <p className="text-[10px] text-slate-500">Day: {birthDay}th this month • {m.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <a
                          href={`tel:${m.phone}`}
                          className="p-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                          title="Call member"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition"
                          title="Send Birthday WhatsApp message"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-amber-700">No member birthdays recorded for this month.</p>
            )}
          </div>

          {/* Visitors Requiring Follow-Up */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-blue-600" />
                Visitors Needing Follow-up ({pendingVisitors.length})
              </span>
              <button
                onClick={() => {
                  onClose();
                  navigate('/visitors');
                }}
                className="text-xs text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-0.5"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-2 pt-1">
              {pendingVisitors.slice(0, 3).map((v) => (
                <div
                  key={v.id}
                  className="p-2.5 bg-white rounded-lg border border-blue-100 shadow-2xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{v.full_name}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                      {v.visit_date}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 truncate">{v.prayer_request || 'Attended Sunday Service'}</p>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>Phone: {v.phone}</span>
                    <a
                      href={`tel:${v.phone}`}
                      className="text-emerald-700 hover:underline font-semibold flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" /> Call Now
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* New Prayer Requests */}
          <div className="p-3.5 bg-rose-50/70 border border-rose-200/80 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-rose-600" />
                Pending Prayer Intercession ({urgentPrayers.length})
              </span>
              <button
                onClick={() => {
                  onClose();
                  navigate('/pastoral-care');
                }}
                className="text-xs text-rose-700 hover:text-rose-900 font-semibold flex items-center gap-0.5"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-1.5 pt-1">
              {urgentPrayers.map((p) => (
                <div key={p.id} className="p-2 bg-white rounded-lg border border-rose-100 shadow-2xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{p.requester_name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-medium">
                      {p.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 mt-1">{p.request}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Pledges Summary */}
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                Pledge Campaigns In Progress
              </span>
              <button
                onClick={() => {
                  onClose();
                  navigate('/pledges');
                }}
                className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-0.5"
              >
                Pledges <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              {outstandingPledges.length} members with active pledges toward the Cathedral Expansion and Evangelism Bus campaigns.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
