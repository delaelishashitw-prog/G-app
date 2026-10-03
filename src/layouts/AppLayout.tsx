import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
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
  const { currentRole, isAuthenticated } = useAuth();
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

  // Redirect to login if user is not authenticated (must be after all hooks)
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Members can ONLY view their personal member portal - protect admin back-office!
  if (currentRole === 'member') {
    return <Navigate to="/portal" replace />;
  }

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

        {/* Optional Role testing banner if not super admin */}
        {currentRole !== 'super_admin' && (
          <div className="bg-amber-500/10 dark:bg-amber-950/30 border-b border-amber-300 dark:border-amber-800/60 px-4 py-1.5 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Role Preview Active:</strong> You are browsing with <em>{currentRole.replace('_', ' ').toUpperCase()}</em> permissions. Use the profile dropdown in the top-right to switch roles.
              </span>
            </div>
          </div>
        )}

        {/* Dynamic Page Outlet with smooth route transitions */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
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
        </main>

        {/* Footer */}
        <footer className="py-4 px-6 text-center text-xs text-slate-600 border-t border-slate-200 bg-white">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
            <span>Church Management System • City, Country</span>
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
              <span>Enterprise Church Ops • Currency: USD ($)</span>
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
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
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
