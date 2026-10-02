import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Menu,
  Search,
  Bell,
  Plus,
  ChevronDown,
  User,
  Shield,
  LogOut,
  Sparkles,
  MapPin,
  Calendar,
  Gift,
  UserPlus,
  Heart,
  Database,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useChurchData } from '../contexts/ChurchDataContext';
import { UserRole } from '../types/database.types';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onOpenQuickAction: (action: 'member' | 'visitor' | 'giving' | 'attendance' | 'event') => void;
  onOpenAssistant?: () => void;
}

const ROLE_LABELS: Record<UserRole, { title: string; color: string }> = {
  super_admin: { title: 'Super Admin', color: 'bg-red-500/10 text-red-700 border-red-200' },
  senior_pastor: { title: 'Senior Pastor', color: 'bg-purple-500/10 text-purple-700 border-purple-200' },
  administrator: { title: 'Administrator', color: 'bg-blue-500/10 text-blue-700 border-blue-200' },
  finance_officer: { title: 'Finance Officer', color: 'bg-amber-500/10 text-amber-700 border-amber-200' },
  pastor: { title: 'Pastor', color: 'bg-indigo-500/10 text-indigo-700 border-indigo-200' },
  ministry_leader: { title: 'Ministry Leader', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-200' },
  attendance_officer: { title: 'Attendance Officer', color: 'bg-teal-500/10 text-teal-700 border-teal-200' },
  data_entry: { title: 'Data Entry', color: 'bg-slate-500/10 text-slate-700 border-slate-200' },
  member: { title: 'Church Member', color: 'bg-emerald-500/10 text-emerald-800 border-emerald-300' },
};

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileMenu,
  onOpenSearch,
  onOpenNotifications,
  onOpenQuickAction,
  onOpenAssistant,
}) => {
  const { currentUser, currentRole, setCurrentRole, availableUsers, switchUser, logout } = useAuth();
  const { settings, visitors, prayerRequests, supabaseStatus } = useChurchData();
  const [profileOpen, setProfileOpen] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);

  const pendingCount =
    visitors.filter((v) => v.follow_up_status === 'new' || v.follow_up_status === 'follow_up_required').length +
    prayerRequests.filter((p) => p.status === 'new').length;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-white border-b border-slate-200 shadow-xs">
      {/* Left side: Mobile menu toggle + Location info */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile Church Logo & Name */}
        <div className="flex items-center gap-2 lg:hidden">
          <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 p-0.5 shadow-2xs shrink-0 flex items-center justify-center">
            <img
              src="/assets/logo.png"
              alt="CMS"
              className="w-full h-full object-contain"
              loading="eager"
            />
          </div>
          <span className="font-bold text-xs text-slate-900 truncate">CMS</span>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600">
          <img
            src="/assets/logo.png"
            alt="Church Logo"
            className="w-6 h-6 object-contain rounded"
            loading="eager"
          />
          <span className="font-semibold text-slate-900">{settings.church_name}</span>
          <span className="text-slate-300">•</span>
          <span className="flex items-center gap-1 text-slate-500">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            {settings.location}
          </span>
          <span className="text-slate-300">•</span>
          <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-semibold border border-emerald-200">
            {settings.currency_symbol} {settings.currency}
          </span>
        </div>
      </div>

      {/* Center/Right controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Supabase Cloud Status Indicator */}
        <Link
          to="/settings"
          className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition border ${
            supabaseStatus === 'connected'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 shadow-2xs'
              : supabaseStatus === 'tables_missing'
              ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 shadow-2xs'
              : supabaseStatus === 'syncing'
              ? 'bg-sky-50 text-sky-800 border-sky-200 animate-pulse'
              : supabaseStatus === 'error'
              ? 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100'
              : 'bg-slate-50 text-slate-600 border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-100'
          }`}
          title={
            supabaseStatus === 'connected'
              ? 'Connected to live Supabase PostgreSQL database'
              : supabaseStatus === 'tables_missing'
              ? 'Connected to Supabase! Tables pending setup. Click to run SQL schema.'
              : 'Click to configure and connect Supabase database'
          }
        >
          <Database
            className={`w-3.5 h-3.5 ${
              supabaseStatus === 'connected'
                ? 'text-emerald-700'
                : supabaseStatus === 'tables_missing'
                ? 'text-amber-600'
                : 'text-slate-400'
            }`}
          />
          <span>
            {supabaseStatus === 'connected'
              ? 'Supabase Active'
              : supabaseStatus === 'tables_missing'
              ? 'Setup Tables'
              : supabaseStatus === 'syncing'
              ? 'Syncing Cloud...'
              : supabaseStatus === 'error'
              ? 'Supabase Error'
              : 'Connect Supabase'}
          </span>
          {supabaseStatus === 'connected' && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          )}
          {supabaseStatus === 'tables_missing' && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
          )}
        </Link>

        {/* Global Search Button */}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 text-xs sm:text-sm transition shadow-2xs"
          title="Global Search across Members, Visitors, ID, Tithe, Phone (Ctrl+K)"
        >
          <Search className="w-4 h-4 text-slate-400" />
          <span className="hidden md:inline">Search church records...</span>
          <span className="hidden sm:inline-block font-mono text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-400">
            ⌘K
          </span>
        </button>

        {/* AI Assistant Button */}
        {onOpenAssistant && (
          <button
            onClick={onOpenAssistant}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-800 to-teal-800 hover:from-emerald-700 hover:to-teal-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition border border-emerald-600/40"
            title="Open GWCC Pastoral AI Assistant (Gemini 3.8 Flash)"
          >
            <Sparkles className="w-4 h-4 text-emerald-300 animate-pulse" />
            <span className="hidden sm:inline">AI Assistant</span>
          </button>
        )}

        {/* Member Portal Link for quick staff preview */}
        <Link
          to="/portal"
          className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200 transition"
          title="Open Member Self-Service Portal"
        >
          <User className="w-3.5 h-3.5 text-emerald-700" />
          <span>Member Portal</span>
        </Link>

        {/* Quick Action Dropdown */}
        <div className="relative">
          <button
            onClick={() => setQuickMenuOpen(!quickMenuOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#064e3b] hover:bg-[#047857] text-white text-xs sm:text-sm font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Quick Action</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-80" />
          </button>

          {quickMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setQuickMenuOpen(false)} />
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-sm animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  Church Operations
                </div>
                <button
                  onClick={() => {
                    setQuickMenuOpen(false);
                    onOpenQuickAction('member');
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 transition"
                >
                  <UserPlus className="w-4 h-4 text-emerald-600" />
                  <span>Register New Member</span>
                </button>
                <button
                  onClick={() => {
                    setQuickMenuOpen(false);
                    onOpenQuickAction('visitor');
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 transition"
                >
                  <User className="w-4 h-4 text-blue-600" />
                  <span>Register Visitor</span>
                </button>
                <button
                  onClick={() => {
                    setQuickMenuOpen(false);
                    onOpenQuickAction('giving');
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 transition"
                >
                  <Gift className="w-4 h-4 text-amber-600" />
                  <span>Record Giving (Tithe/Offering)</span>
                </button>
                <button
                  onClick={() => {
                    setQuickMenuOpen(false);
                    onOpenQuickAction('attendance');
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 transition"
                >
                  <Calendar className="w-4 h-4 text-purple-600" />
                  <span>Take Service Attendance</span>
                </button>
                <button
                  onClick={() => {
                    setQuickMenuOpen(false);
                    onOpenQuickAction('event');
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 transition"
                >
                  <Sparkles className="w-4 h-4 text-rose-600" />
                  <span>Schedule Event</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Notifications Button */}
        <button
          onClick={onOpenNotifications}
          className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
          title="Notifications & Action Items"
        >
          <Bell className="w-5 h-5" />
          {pendingCount > 0 && (
            <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full animate-pulse">
              {pendingCount}
            </span>
          )}
        </button>

        {/* User Profile & Role Switcher */}
        <div className="relative pl-1">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition"
          >
            {currentUser.avatar_url ? (
              <img
                src={currentUser.avatar_url}
                alt={currentUser.first_name}
                className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-2xs"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
                {currentUser.first_name[0]}
                {currentUser.last_name[0]}
              </div>
            )}
            <div className="hidden xl:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-800 leading-tight">
                {currentUser.first_name} {currentUser.last_name}
              </span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border w-fit ${ROLE_LABELS[currentRole].color}`}>
                {ROLE_LABELS[currentRole].title}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {profileOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-sm font-bold text-slate-900">
                    {currentUser.first_name} {currentUser.last_name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${ROLE_LABELS[currentRole].color}`}>
                      Active Role: {ROLE_LABELS[currentRole].title}
                    </span>
                  </div>
                </div>

                {/* Quick Role Switcher for Testing/Reviewing RBAC */}
                <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-emerald-600" />
                      Role-Based Access Tester
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Switch role to test live system permissions & views:
                  </p>
                  <select
                    value={currentRole}
                    onChange={(e) => {
                      setCurrentRole(e.target.value as UserRole);
                    }}
                    className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  >
                    <option value="super_admin">Super Admin (Full Access)</option>
                    <option value="senior_pastor">Senior Pastor</option>
                    <option value="administrator">Administrator</option>
                    <option value="finance_officer">Finance Officer</option>
                    <option value="pastor">Pastor</option>
                    <option value="ministry_leader">Ministry Leader</option>
                    <option value="attendance_officer">Attendance Officer</option>
                    <option value="data_entry">Data Entry</option>
                  </select>
                </div>

                {/* Switch User Profile */}
                <div className="px-4 py-2 border-b border-slate-100">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Switch Active Staff Member
                  </span>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {availableUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          switchUser(u.id);
                          setProfileOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition ${
                          u.id === currentUser.id
                            ? 'bg-emerald-50 text-emerald-900 font-bold'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span className="truncate">
                          {u.first_name} {u.last_name}
                        </span>
                        <span className="text-[10px] text-slate-400 capitalize">
                          {u.role.replace('_', ' ')}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-2 border-t border-slate-100 space-y-1">
                  <button
                    onClick={async () => {
                      setProfileOpen(false);
                      await logout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 rounded-lg transition"
                  >
                    <LogOut className="w-3.5 h-3.5 text-red-600" />
                    <span>Sign Out of Staff Portal</span>
                  </button>
                  <div className="px-2 py-0.5 text-[10px] text-slate-400">
                    Church Management System • City, Country
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
