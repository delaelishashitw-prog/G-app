import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  CheckCircle,
  User,
  Users,
  Sparkles,
  HeartHandshake,
  Lock,
  Unlock,
  Maximize2,
  Calendar,
  Clock,
  Check,
  UserPlus,
} from 'lucide-react';
import { Member, Visitor, ChurchService, ChurchSettings } from '../../types/database.types';

interface AttendanceKioskModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: ChurchService;
  date: string;
  members: Member[];
  visitors: Visitor[];
  settings?: ChurchSettings;
  alreadyCheckedInIds: Set<string>;
  onCheckIn: (personType: 'member' | 'visitor', personId: string) => void;
  onOpenQuickVisitorModal: () => void;
}

export const AttendanceKioskModal: React.FC<AttendanceKioskModalProps> = ({
  isOpen,
  onClose,
  service,
  date,
  members,
  visitors,
  settings,
  alreadyCheckedInIds,
  onCheckIn,
  onOpenQuickVisitorModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [welcomeBanner, setWelcomeBanner] = useState<{
    name: string;
    type: 'member' | 'visitor';
    id: string;
  } | null>(null);
  const [isLocked, setIsLocked] = useState(true);
  const [pinPrompt, setPinPrompt] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Filter matching members and visitors
  const searchResults = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term || term.length < 2) return [];

    const matchedMembers = members
      .filter((m) => !m.is_archived)
      .filter(
        (m) =>
          (m.first_name || '').toLowerCase().includes(term) ||
          (m.last_name || '').toLowerCase().includes(term) ||
          (m.member_id || '').toLowerCase().includes(term) ||
          (m.phone && m.phone.includes(term))
      )
      .slice(0, 8)
      .map((m) => ({
        id: m.id,
        name: `${m.first_name} ${m.last_name}`,
        subtitle: `${m.member_id} • ${m.phone}`,
        type: 'member' as const,
        photo: m.profile_photo_url,
        isCheckedIn: alreadyCheckedInIds.has(m.id),
      }));

    const matchedVisitors = visitors
      .filter((v) => v.full_name.toLowerCase().includes(term) || (v.phone && v.phone.includes(term)))
      .slice(0, 4)
      .map((v) => ({
        id: v.id,
        name: v.full_name,
        subtitle: `Visitor • ${v.phone}`,
        type: 'visitor' as const,
        photo: undefined,
        isCheckedIn: alreadyCheckedInIds.has(v.id),
      }));

    return [...matchedMembers, ...matchedVisitors];
  }, [searchTerm, members, visitors, alreadyCheckedInIds]);

  const handlePerformCheckIn = (type: 'member' | 'visitor', id: string, name: string) => {
    onCheckIn(type, id);
    setWelcomeBanner({ name, type, id });
    setSearchTerm('');

    // Clear welcome banner after 4.5 seconds
    setTimeout(() => {
      setWelcomeBanner((prev) => (prev?.id === id ? null : prev));
    }, 4500);
  };

  const handleUnlockAttempt = () => {
    // Standard kiosk exit code: 1234 or gwcc
    if (pinInput === '1234' || pinInput.toLowerCase() === 'gwcc') {
      setIsLocked(false);
      setPinPrompt(false);
      setPinInput('');
      onClose();
    } else {
      setPinError(true);
      setTimeout(() => setPinError(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between overflow-hidden animate-in fade-in duration-200">
      {/* Kiosk Header */}
      <header className="p-6 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-600 flex items-center justify-center font-black text-xl shadow-lg shadow-teal-500/20 text-white overflow-hidden">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="w-full h-full object-contain p-1" />
            ) : (
              settings?.short_name?.slice(0, 2) || 'GW'
            )}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              {settings?.church_name || 'Church Sanctuary'}
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Self Check-In Kiosk
              </span>
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span>{service?.name || 'Worship Service'}</span>
              <span>•</span>
              <Calendar className="w-3.5 h-3.5" />
              <span>{date}</span>
            </p>
          </div>
        </div>

        {/* Exit / Admin Lock */}
        <div>
          {pinPrompt ? (
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-xl border border-slate-700 animate-in slide-in-from-right">
                <input
                  type="password"
                  placeholder="PIN (1234)"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUnlockAttempt()}
                  className={`w-32 px-2.5 py-1 text-xs bg-slate-900 border rounded-lg text-white font-mono text-center focus:outline-none ${
                    pinError ? 'border-rose-500' : 'border-slate-700'
                  }`}
                  autoFocus
                />
                <button
                  onClick={handleUnlockAttempt}
                  className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-xs font-bold rounded-lg transition"
                >
                  Exit
                </button>
                <button
                  onClick={() => setPinPrompt(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Default PIN: 1234 or gwcc</span>
            </div>
          ) : (
            <button
              onClick={() => setPinPrompt(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition border border-slate-800"
              title="Exit Kiosk Mode"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Exit Kiosk</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Interactive Touch Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-4xl w-full mx-auto space-y-8">
        {/* Welcome Celebration Overlay */}
        {welcomeBanner ? (
          <div className="w-full bg-gradient-to-r from-emerald-600/30 via-teal-600/30 to-emerald-600/30 border border-emerald-500/40 rounded-3xl p-8 text-center space-y-3 animate-in zoom-in-95 shadow-2xl backdrop-blur-md">
            <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30 animate-bounce">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Welcome, {welcomeBanner.name}!
            </h2>
            <p className="text-base text-emerald-200 max-w-md mx-auto">
              You are checked in for today&apos;s service. May God richly bless you and answer your prayers as we worship together!
            </p>
            <p className="text-xs text-slate-400">Please proceed into the sanctuary. Enjoy the service!</p>
          </div>
        ) : (
          <div className="text-center space-y-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-400 bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">
              <Sparkles className="w-3.5 h-3.5" /> Welcome to God&apos;s Presence
            </span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Check In For Service
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-md mx-auto">
              Enter your phone number, first or last name, or Member ID to check in.
            </p>
          </div>
        )}

        {/* Large Touch Search Bar */}
        <div className="w-full space-y-4">
          <div className="relative w-full">
            <Search className="w-6 h-6 absolute left-5 top-5 text-teal-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Type your phone number or name (e.g. 0244, Kwame, GWCC-001)..."
              className="w-full pl-16 pr-6 py-5 text-lg sm:text-xl font-medium bg-slate-900 border-2 border-slate-700 rounded-3xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 shadow-xl transition"
              autoFocus
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-5 top-5 p-1 text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Quick Action for First-Time Visitors */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-2">
            <p className="text-xs text-slate-400">
              Can&apos;t find your name? You might be a first-time visitor!
            </p>
            <button
              onClick={onOpenQuickVisitorModal}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-teal-500/20"
            >
              <UserPlus className="w-4 h-4" />
              <span>First Time Here? Tap to Welcome You</span>
            </button>
          </div>

          {/* Search Results Grid */}
          {searchTerm.trim().length >= 2 && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-2xl space-y-2 max-h-80 overflow-y-auto">
              {searchResults.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {searchResults.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border flex items-center justify-between transition ${
                        item.isCheckedIn
                          ? 'bg-slate-800/40 border-slate-800 opacity-70'
                          : 'bg-slate-800/90 hover:bg-slate-700/80 border-slate-700 hover:border-teal-500 cursor-pointer shadow-md'
                      }`}
                      onClick={() => {
                        if (!item.isCheckedIn) {
                          handlePerformCheckIn(item.type, item.id, item.name);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-teal-500/20 border border-teal-500/30 text-teal-300 font-bold flex items-center justify-center text-sm">
                          {item.name
                            .split(' ')
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join('')}
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm sm:text-base">{item.name}</p>
                          <p className="text-xs text-slate-400">{item.subtitle}</p>
                        </div>
                      </div>

                      <div>
                        {item.isCheckedIn ? (
                          <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                            <CheckCircle className="w-3.5 h-3.5" /> In
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePerformCheckIn(item.type, item.id, item.name);
                            }}
                            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold shadow-md transition"
                          >
                            Check In
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center space-y-2">
                  <p className="text-slate-400 text-sm">No member found matching &quot;{searchTerm}&quot;.</p>
                  <button
                    onClick={onOpenQuickVisitorModal}
                    className="text-teal-400 hover:text-teal-300 font-bold text-xs underline"
                  >
                    Tap here to register as a first-time visitor
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Kiosk Footer */}
      <footer className="p-4 border-t border-slate-800 text-center text-xs text-slate-500 flex flex-wrap items-center justify-between max-w-5xl mx-auto w-full">
        <span>Greater Works City Church • Joma Assembly, Accra</span>
        <span>Scripture: &quot;I was glad when they said unto me, Let us go into the house of the LORD.&quot; — Psalm 122:1</span>
      </footer>
    </div>
  );
};
