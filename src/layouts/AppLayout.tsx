import { SyncStatusBanner } from '../components/SyncStatusBanner';
import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, Navigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { GlobalSearchModal } from '../components/GlobalSearchModal';
import { NotificationModal } from '../components/NotificationModal';
import { QuickActionModal } from '../components/QuickActionModal';
import { AiAssistantModal } from '../components/AiAssistantModal';
import { KeyboardShortcutsModal } from '../components/KeyboardShortcutsModal';
import { ShieldAlert, Sparkles, Keyboard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useToast } from '../contexts/ToastContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

export const AppLayout: React.FC = () => {
  const {
    currentRole,
    currentUser,
    isAuthenticated,
    isAuthLoading,
    isSimulating,
    impersonatingAdmin,
    exitSimulation,
    canAccess,
    logout,
  } = useAuth();
  const { refreshData } = useChurchData();
  const { success, warning } = useToast();
  const location = useLocation();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const [quickActionType, setQuickActionType] = useState<
    'member' | 'visitor' | 'giving' | 'attendance' | 'event' | null
  >(null);

  const isAnyModalOpen =
    searchOpen ||
    notificationsOpen ||
    aiAssistantOpen ||
    shortcutsHelpOpen ||
    Boolean(quickActionType);

  const handleCloseAllModals = () => {
    setSearchOpen(false);
    setNotificationsOpen(false);
    setAiAssistantOpen(false);
    setShortcutsHelpOpen(false);
    setQuickActionType(null);
  };

  const handleGlobalRefresh = async () => {
    const res = await refreshData();
    if (res.success) {
      success('Church Records Refreshed', res.message);
    } else {
      warning('Refresh Warning', res.message);
    }
  };

  // Keyboard shortcut system for navigation speed and productivity
  const { shortcuts } = useKeyboardShortcuts({
    onOpenSearch: () => setSearchOpen(true),
    onOpenAssistant: () => setAiAssistantOpen(true),
    onOpenShortcutsHelp: () => setShortcutsHelpOpen(true),
    onToggleSidebar: () => setSidebarCollapsed((prev) => !prev),
    onRefreshData: handleGlobalRefresh,
    onQuickAction: (type) => setQuickActionType(type),
    isAnyModalOpen,
    onCloseAllModals: handleCloseAllModals,
  });

  if (isAuthLoading && !isAuthenticated) return <div className="p-8 text-center">Verifying your account…</div>;

  // Redirect to login if user is not authenticated (must be after all hooks)
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Members can ONLY view their personal member portal - protect admin back-office!
  if (currentRole === 'member') {
    return <Navigate to="/portal" replace />;
  }

  // Route-level authorization module resolution
  const getRequiredModuleForPath = (pathname: string): { module: string; label: string } | null => {
    const clean = pathname.toLowerCase();
    if (clean === '/' || clean === '') return null; // Dashboard is core
    if (clean.startsWith('/users')) return { module: 'users', label: 'Staff Directory & Access Control' };
    if (clean.startsWith('/church-finance') || clean.startsWith('/finance')) return { module: 'finance', label: 'Church Treasury & Finance' };
    if (clean.startsWith('/giving')) return { module: 'giving', label: 'Member Giving & Tithes' };
    if (clean.startsWith('/pledges')) return { module: 'pledges', label: 'Pledge Campaigns' };
    if (clean.startsWith('/welfare')) return { module: 'welfare', label: 'Welfare & Relief Fund' };
    if (clean.startsWith('/pastoral-care')) return { module: 'pastoral_care', label: 'Pastoral Care & Counseling' };
    if (clean.startsWith('/reports')) return { module: 'reports', label: 'Reports & Analytics' };
    if (clean.startsWith('/audit-logs')) return { module: 'audit_logs', label: 'Audit Trail Logs' };
    if (clean.startsWith('/settings')) return { module: 'settings', label: 'System Settings & Cloud Database' };
    if (clean.startsWith('/visitors')) return { module: 'visitors', label: 'Visitors & Follow-up' };
    if (clean.startsWith('/attendance')) return { module: 'attendance', label: 'Attendance & Headcounts' };
    if (clean.startsWith('/services')) return { module: 'services', label: 'Church Services' };
    if (clean.startsWith('/ministries')) return { module: 'ministries', label: 'Ministries & Departments' };
    if (clean.startsWith('/small-groups')) return { module: 'small_groups', label: 'Cell Groups & Fellowships' };
    if (clean.startsWith('/events')) return { module: 'events', label: 'Events & Calendar' };
    if (clean.startsWith('/communication')) return { module: 'communication', label: 'Broadcast Communications' };
    if (clean.startsWith('/inventory')) return { module: 'settings', label: 'Asset Inventory & Equipment' };
    if (clean.startsWith('/members')) return { module: 'members', label: 'Congregational Registry' };
    return null;
  };

  const requiredModuleInfo = getRequiredModuleForPath(location.pathname);
  const isRouteUnauthorized = requiredModuleInfo ? !canAccess(requiredModuleInfo.module) : false;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#070b14] flex text-slate-800 dark:text-slate-100 antialiased selection:bg-emerald-700 selection:text-white transition-colors duration-200">
      {/* Collapsible Left Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        {/* Top Navbar */}
        <Header
          onToggleMobileMenu={() => setMobileMenuOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenNotifications={() => setNotificationsOpen(true)}
          onOpenQuickAction={(type) => setQuickActionType(type)}
          onOpenAssistant={() => setAiAssistantOpen(true)}
          onOpenShortcutsHelp={() => setShortcutsHelpOpen(true)}
        />

        {/* Authorized RBAC Simulation Banner (Active only when Super Admin is testing a user or role) */}
        {isSimulating && impersonatingAdmin && (
          <div className="bg-amber-500 text-slate-950 border-b border-amber-600 px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-semibold shadow-xs z-30">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-slate-950 shrink-0" />
              <span>
                <strong>RBAC Simulation Active:</strong> Currently previewing system as{' '}
                <span className="underline font-bold">{currentUser.first_name} {currentUser.last_name}</span> ({currentRole.replace('_', ' ').toUpperCase()}). Actions are simulated under this role's security boundary.
              </span>
            </div>
            <button
              onClick={exitSimulation}
              className="self-start sm:self-auto px-3 py-1 bg-slate-950 hover:bg-slate-900 text-amber-300 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              Exit Simulation & Return to Super Admin ({impersonatingAdmin.first_name})
            </button>
          </div>
        )}

        <SyncStatusBanner />

        {/* Dynamic Page Outlet with smooth route transitions */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {isRouteUnauthorized ? (
            <div className="bg-white rounded-2xl border border-rose-200 p-8 sm:p-12 text-center shadow-xs max-w-xl mx-auto my-12 animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200 shadow-xs">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Access Restricted
              </h2>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Your account role <span className="font-bold text-slate-800 uppercase px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">{currentRole.replace('_', ' ')}</span> does not have authorization to view <strong className="text-slate-800">{requiredModuleInfo?.label}</strong>.
              </p>
              <p className="text-[11px] text-slate-400 mt-2">
                This operational security boundary is enforced according to Greater Works City Church administrative policy.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                  to="/"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs"
                >
                  Return to Dashboard
                </Link>
                {isSimulating && (
                  <button
                    onClick={exitSimulation}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold transition shadow-xs"
                  >
                    Exit Simulation Mode
                  </button>
                )}
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="w-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          )}
        </main>

        {/* Footer */}
        <footer className="py-4 px-6 text-center text-xs text-slate-600 border-t border-slate-200 bg-white">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
            <span>Greater Works City Church • Joma, Accra</span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setShortcutsHelpOpen(true)}
                className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                title="View Keyboard Shortcuts Cheat Sheet (Press ?)"
              >
                <Keyboard className="w-3.5 h-3.5 text-slate-400" />
                <span>Shortcuts</span>
                <kbd className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded border border-slate-300 dark:border-slate-700">
                  ?
                </kbd>
              </button>
              <span>Enterprise Church Ops • Currency: GHS (GH₵)</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Floating AI Pastoral Assistant Trigger */}
      <button
        onClick={() => setAiAssistantOpen(true)}
        className="fixed bottom-6 right-6 z-40 p-3.5 bg-gradient-to-r from-emerald-900 to-[#064e3b] hover:from-emerald-800 hover:to-[#047857] text-white rounded-full shadow-2xl hover:shadow-emerald-900/50 flex items-center gap-2 border-2 border-emerald-400/40 hover:scale-105 transition duration-200 group cursor-pointer"
        title="Open Pastoral AI Assistant"
      >
        <Sparkles className="w-5 h-5 text-emerald-300 group-hover:rotate-12 transition-transform animate-pulse" />
        <span className="text-xs font-bold hidden sm:inline pr-1">Ask AI Assistant</span>
      </button>

      {/* Modals */}
      <GlobalSearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onQuickAction={(type) => setQuickActionType(type)}
        onOpenAssistant={() => setAiAssistantOpen(true)}
        onOpenShortcutsHelp={() => setShortcutsHelpOpen(true)}
        onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
        onRefreshData={handleGlobalRefresh}
      />
      <NotificationModal isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
      <AiAssistantModal isOpen={aiAssistantOpen} onClose={() => setAiAssistantOpen(false)} />
      <KeyboardShortcutsModal
        isOpen={shortcutsHelpOpen}
        onClose={() => setShortcutsHelpOpen(false)}
        shortcuts={shortcuts}
      />
      <QuickActionModal
        isOpen={Boolean(quickActionType)}
        type={quickActionType}
        onClose={() => setQuickActionType(null)}
      />
    </div>
  );
};
