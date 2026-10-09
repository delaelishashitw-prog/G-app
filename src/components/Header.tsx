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
  Sun,
  Moon,
  WifiOff,
  Keyboard,
  RefreshCw,
  ShieldAlert,
  Key,
} from 'lucide-react';
import { ChangePasswordModal } from './ChangePasswordModal';
import { useAuth } from '../contexts/AuthContext';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useToast } from '../contexts/ToastContext';
import { UserRole } from '../types/database.types';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onOpenQuickAction: (action: 'member' | 'visitor' | 'giving' | 'attendance' | 'event') => void;
  onOpenAssistant?: () => void;
  onOpenShortcutsHelp?: () => void;
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
  onOpenShortcutsHelp,
}) => {
  const {
    currentUser,
    currentRole,
    logout,
    isSimulating,
    impersonatingAdmin,
    exitSimulation,
    canAccess,
  } = useAuth();
  const {
    settings,
    visitors,
    prayerRequests,
    supabaseStatus,
    isRefreshing,
    lastRefreshedAt,
    refreshData,
  } = useChurchData();
  const { theme, resolvedTheme, isDark, toggleTheme } = useTheme();
  const { isOnline } = useNetworkStatus();
  const { success, warning } = useToast();
  const [profileOpen, setProfileOpen] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const handleHeaderRefresh = async () => {
    const res = await refreshData();
    if (res.success) {
      success('Church Records Refreshed', res.message);
    } else {
      warning('Refresh Warning', res.message);
    }
  };

  const pendingCount =
    visitors.filter((v) => v.follow_up_status === 'new' || v.follow_up_status === 'follow_up_required').length +
    prayerRequests.filter((p) => p.status === 'new').length;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-white dark:bg-[#0b1120] border-b border-slate-200 dark:border-slate-800 shadow-xs transition-colors duration-200">
      {/* Left side: Mobile menu toggle + Location info */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile Church Logo & Name */}
        <div className="flex items-center gap-2 lg:hidden">
          <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 dark:border-slate-700 p-0.5 shadow-2xs shrink-0 flex items-center justify-center">
            <img
              src="/assets/logo.png"
              alt="CMS"
              className="w-full h-full object-contain"
              loading="eager"
            />
          </div>
          <span className="font-bold text-xs text-slate-900 dark:text-white truncate">CMS</span>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <img
            src="/assets/logo.png"
            alt="Church Logo"
            className="w-6 h-6 object-contain rounded"
            loading="eager"
          />
          <span className="font-semibold text-slate-900 dark:text-white">{settings.church_name}</span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            {settings.location}
          </span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span className="font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded text-[11px] font-semibold border border-emerald-200 dark:border-emerald-800/80">
            {settings.currency_symbol} {settings.currency}
          </span>
        </div>
      </div>

      {/* Global Command Palette / Quick Search Bar */}
      <div className="flex-1 max-w-md mx-3 lg:mx-6 hidden md:block">
        <button
          type="button"
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between gap-3 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 hover:shadow-xs text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs sm:text-sm transition duration-150 group cursor-pointer text-left"
          title="Open Command Palette: Search members, pages, tasks (Ctrl+K or /)"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
            <span className="truncate text-slate-500 dark:text-slate-400 text-xs font-normal">
              Search members, pages, tasks...
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <kbd className="font-mono text-[10px] font-bold bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded shadow-2xs">
              ⌘K
            </kbd>
            <kbd className="hidden lg:inline-block font-mono text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/80 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              /
            </kbd>
          </div>
        </button>
      </div>

      {/* Center/Right controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Offline Connectivity Warning Badge */}
        {!isOnline && (
          <span
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 shadow-2xs animate-pulse"
            title="Navigator reports offline. System operating with local caching."
          >
            <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Offline Mode</span>
          </span>
        )}

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

        {/* Refresh Data Button */}
        <button
          onClick={handleHeaderRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold transition shadow-2xs cursor-pointer disabled:opacity-60"
          title={`Refresh Church Data (Ctrl+Shift+R) • Last updated: ${lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 ${
              isRefreshing ? 'animate-spin text-emerald-600 dark:text-emerald-400' : ''
            }`}
          />
          <span className="hidden md:inline">
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </span>
        </button>

        {/* Mobile / Compact Search Trigger */}
        <button
          onClick={onOpenSearch}
          className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs transition shadow-2xs"
          title="Global Search across Members, Pages, Tasks (Ctrl+K or /)"
        >
          <Search className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="font-mono text-[10px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-1 py-0.2 rounded text-slate-400 dark:text-slate-500">
            ⌘K
          </span>
        </button>

        {/* Keyboard Shortcuts Trigger Button */}
        {onOpenShortcutsHelp && (
          <button
            onClick={onOpenShortcutsHelp}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs transition shadow-2xs"
            title="Keyboard Shortcuts Cheat Sheet (Press ? anytime)"
          >
            <Keyboard className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <kbd className="font-mono text-[10px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-1.5 py-0.2 rounded text-slate-400 dark:text-slate-500">
              ?
            </kbd>
          </button>
        )}

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

        {/* Dark / Light Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-600 dark:text-amber-400 hover:text-slate-900 dark:hover:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition shadow-2xs group cursor-pointer"
          title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          aria-label={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        >
          {isDark ? (
            <Sun className="w-5 h-5 text-amber-400 transition-transform duration-200 group-hover:rotate-45" />
          ) : (
            <Moon className="w-5 h-5 text-slate-600 dark:text-slate-300 group-hover:text-slate-900 transition-transform duration-200 group-hover:-rotate-12" />
          )}
        </button>

        {/* Notifications Button */}
        <button
          onClick={onOpenNotifications}
          className="relative p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition shadow-2xs cursor-pointer"
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
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            {currentUser.avatar_url ? (
              <img
                src={currentUser.avatar_url}
                alt={currentUser.first_name}
                className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-2xs"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
                {currentUser.first_name[0]}
                {currentUser.last_name[0]}
              </div>
            )}
            <div className="hidden xl:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
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
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {currentUser.first_name} {currentUser.last_name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{currentUser.email}</p>
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border inline-flex items-center gap-1 ${ROLE_LABELS[currentRole]?.color || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                      <Shield className="w-3 h-3" />
                      {ROLE_LABELS[currentRole]?.title || currentRole}
                    </span>
                    {currentUser.department && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-medium truncate max-w-[150px]">
                        {currentUser.department}
                      </span>
                    )}
                  </div>
                </div>

                {/* If an authorized Super Admin is in active simulation mode */}
                {isSimulating && impersonatingAdmin && (
                  <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/80">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900 dark:text-amber-200 mb-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>RBAC Simulation Active</span>
                    </div>
                    <p className="text-[10px] text-amber-800 dark:text-amber-300 mb-2 leading-relaxed">
                      Testing views as <strong>{currentUser.first_name}</strong>. Primary account: <strong>{impersonatingAdmin.first_name}</strong> (Super Admin).
                    </p>
                    <button
                      onClick={() => {
                        exitSimulation();
                        setProfileOpen(false);
                      }}
                      className="w-full py-1.5 px-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      Exit Simulation & Restore Admin
                    </button>
                  </div>
                )}

                {/* Secure Account Navigation */}
                <div className="p-2 border-b border-slate-100 dark:border-slate-800 space-y-0.5">
                  {canAccess('users') && (
                    <Link
                      to="/users"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <Shield className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Staff Directory & Access Control</span>
                    </Link>
                  )}
                  {canAccess('settings') && (
                    <Link
                      to="/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>Church & Account Settings</span>
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      setIsChangePasswordOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Change Account Password</span>
                  </button>
                </div>

                <div className="p-2 space-y-1">
                  <button
                    onClick={async () => {
                      setProfileOpen(false);
                      await logout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span>Sign Out of Staff Portal</span>
                  </button>
                  <div className="px-2 py-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                    Greater Works City Church • Staff Back-Office
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </header>
  );
};
