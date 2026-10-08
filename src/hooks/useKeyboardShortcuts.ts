import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';

export interface ShortcutDefinition {
  id: string;
  category: 'Navigation' | 'Quick Actions' | 'Search & Tools' | 'General';
  label: string;
  keys: string[];
  description: string;
  action: () => void;
}

export interface UseKeyboardShortcutsOptions {
  onOpenSearch: () => void;
  onOpenAssistant?: () => void;
  onOpenShortcutsHelp: () => void;
  onToggleSidebar?: () => void;
  onRefreshData?: () => void;
  onQuickAction?: (action: 'member' | 'visitor' | 'giving' | 'attendance' | 'event') => void;
  isAnyModalOpen?: boolean;
  onCloseAllModals?: () => void;
}

/**
 * Checks if the event target is an editable input or textarea
 */
export function isEditableElement(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = (el.tagName || '').toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    el.isContentEditable ||
    el.getAttribute('role') === 'textbox'
  );
}

/**
 * Hook to manage global application keyboard shortcuts.
 */
export function useKeyboardShortcuts({
  onOpenSearch,
  onOpenAssistant,
  onOpenShortcutsHelp,
  onToggleSidebar,
  onRefreshData,
  onQuickAction,
  isAnyModalOpen,
  onCloseAllModals,
}: UseKeyboardShortcutsOptions) {
  const navigate = useNavigate();
  const { info } = useToast();

  const navigateWithFeedback = useCallback(
    (path: string, label: string, shortcutKey: string) => {
      navigate(path);
      info(label, `Navigated via ${shortcutKey}`);
    },
    [navigate, info]
  );

  // List of all shortcuts for display in cheat sheet modal and reference
  const shortcuts: ShortcutDefinition[] = [
    // Navigation
    {
      id: 'nav-search',
      category: 'Search & Tools',
      label: 'Global Search',
      keys: ['Ctrl', 'K'],
      description: 'Search members, visitors, tithes, IDs, and phone numbers',
      action: onOpenSearch,
    },
    {
      id: 'nav-members',
      category: 'Navigation',
      label: 'Members Directory',
      keys: ['Ctrl', 'M'],
      description: 'Go to Church Members & Profiles',
      action: () => navigateWithFeedback('/members', 'Members Directory', 'Ctrl+M'),
    },
    {
      id: 'nav-finance',
      category: 'Navigation',
      label: 'Finance & Tithes',
      keys: ['Ctrl', 'F'],
      description: 'Go to Financial Accounts, Giving & Expenses',
      action: () => navigateWithFeedback('/finance', 'Finance & Giving', 'Ctrl+F'),
    },
    {
      id: 'nav-dashboard',
      category: 'Navigation',
      label: 'Executive Dashboard',
      keys: ['Ctrl', 'D'],
      description: 'Return to Church Overview & Live Metrics',
      action: () => navigateWithFeedback('/', 'Executive Dashboard', 'Ctrl+D'),
    },
    {
      id: 'nav-attendance',
      category: 'Navigation',
      label: 'Attendance & Check-in',
      keys: ['Ctrl', 'A'],
      description: 'Go to Service Attendance & Headcounts',
      action: () => navigateWithFeedback('/attendance', 'Attendance Tracker', 'Ctrl+A'),
    },
    {
      id: 'nav-visitors',
      category: 'Navigation',
      label: 'First-time Visitors',
      keys: ['Ctrl', 'V'],
      description: 'Go to Visitors & Follow-up Pipeline',
      action: () => navigateWithFeedback('/visitors', 'Visitors & Follow-ups', 'Ctrl+V'),
    },
    {
      id: 'nav-services',
      category: 'Navigation',
      label: 'Services & Orders',
      keys: ['Ctrl', 'S'],
      description: 'View Service schedules & liturgies',
      action: () => navigateWithFeedback('/services', 'Services & Schedules', 'Ctrl+S'),
    },
    {
      id: 'nav-pledges',
      category: 'Navigation',
      label: 'Pledges & Campaigns',
      keys: ['Ctrl', 'P'],
      description: 'View Capital campaigns & pledges',
      action: () => navigateWithFeedback('/pledges', 'Pledges & Campaigns', 'Ctrl+P'),
    },
    {
      id: 'nav-events',
      category: 'Navigation',
      label: 'Calendar & Events',
      keys: ['Ctrl', 'E'],
      description: 'View Church Events & Programs',
      action: () => navigateWithFeedback('/events', 'Calendar & Events', 'Ctrl+E'),
    },
    {
      id: 'nav-reports',
      category: 'Navigation',
      label: 'Analytics & Reports',
      keys: ['Ctrl', 'R'],
      description: 'View Executive summaries & exports',
      action: () => navigateWithFeedback('/reports', 'Analytics & Reports', 'Ctrl+R'),
    },
    {
      id: 'nav-settings',
      category: 'Navigation',
      label: 'Settings & Supabase',
      keys: ['Ctrl', ','],
      description: 'Open System Settings & Database Hub',
      action: () => navigateWithFeedback('/settings', 'System Settings', 'Ctrl+,'),
    },

    // Quick Actions
    {
      id: 'act-new-member',
      category: 'Quick Actions',
      label: 'New Member',
      keys: ['Ctrl', 'Shift', 'M'],
      description: 'Open New Member Registration modal',
      action: () => onQuickAction?.('member'),
    },
    {
      id: 'act-record-giving',
      category: 'Quick Actions',
      label: 'Record Giving',
      keys: ['Ctrl', 'Shift', 'G'],
      description: 'Record Tithe, Offering, or Covenant donation',
      action: () => onQuickAction?.('giving'),
    },
    {
      id: 'act-new-visitor',
      category: 'Quick Actions',
      label: 'Register Visitor',
      keys: ['Ctrl', 'Shift', 'V'],
      description: 'Register a First-time Guest or Visitor',
      action: () => onQuickAction?.('visitor'),
    },
    {
      id: 'act-mark-attendance',
      category: 'Quick Actions',
      label: 'Mark Attendance',
      keys: ['Ctrl', 'Shift', 'A'],
      description: 'Rapid attendee check-in or headcount record',
      action: () => onQuickAction?.('attendance'),
    },

    // Search & Tools
    {
      id: 'tool-ai-assistant',
      category: 'Search & Tools',
      label: 'Pastoral AI Assistant',
      keys: ['Ctrl', 'J'],
      description: 'Open AI Assistant for sermon prep & care advice',
      action: () => onOpenAssistant?.(),
    },
    {
      id: 'tool-toggle-sidebar',
      category: 'Search & Tools',
      label: 'Toggle Sidebar',
      keys: ['Ctrl', 'B'],
      description: 'Expand or collapse navigation sidebar',
      action: () => onToggleSidebar?.(),
    },
    {
      id: 'tool-refresh-data',
      category: 'Search & Tools',
      label: 'Refresh Church Records',
      keys: ['Ctrl', 'Shift', 'R'],
      description: 'Re-sync all data from Supabase cloud or local storage',
      action: () => onRefreshData?.(),
    },

    // General
    {
      id: 'gen-shortcuts-help',
      category: 'General',
      label: 'Keyboard Shortcuts Help',
      keys: ['?'],
      description: 'Display this shortcuts cheatsheet',
      action: onOpenShortcutsHelp,
    },
    {
      id: 'gen-close-modal',
      category: 'General',
      label: 'Close / Dismiss',
      keys: ['Esc'],
      description: 'Close active dialog, modal, or search bar',
      action: () => onCloseAllModals?.(),
    },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent);
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      const isAlt = e.altKey;
      const key = (e.key || '').toLowerCase();
      const inInput = isEditableElement(e.target);

      // 1. Escape: Close open modals
      if (e.key === 'Escape') {
        if (isAnyModalOpen) {
          e.preventDefault();
          onCloseAllModals?.();
          return;
        }
      }

      // 2. Global Search: Ctrl+K / Cmd+K (allowed everywhere, even from within inputs)
      if (modifier && key === 'k') {
        e.preventDefault();
        onOpenSearch();
        return;
      }

      // 3. Question mark '?' or 'Ctrl+/' to open shortcuts cheatsheet
      // Only when not currently typing inside an input/textarea
      if (!inInput) {
        if (e.key === '?' || (modifier && e.key === '/')) {
          e.preventDefault();
          onOpenShortcutsHelp();
          return;
        }
      }

      // 4. Quick Actions: Ctrl + Shift + [M/G/V/A]
      if (modifier && e.shiftKey) {
        if (key === 'm') {
          e.preventDefault();
          onQuickAction?.('member');
          return;
        }
        if (key === 'g') {
          e.preventDefault();
          onQuickAction?.('giving');
          return;
        }
        if (key === 'v') {
          e.preventDefault();
          onQuickAction?.('visitor');
          return;
        }
        if (key === 'a') {
          e.preventDefault();
          onQuickAction?.('attendance');
          return;
        }
        if (key === 'r') {
          e.preventDefault();
          onRefreshData?.();
          return;
        }
      }

      // If user is inside an editable field, DO NOT intercept navigation shortcuts
      // (prevents interfering with typing or standard text editing Ctrl+A, Ctrl+F, etc.)
      if (inInput) return;

      // 5. Navigation shortcuts: Ctrl + Key or Alt + Key
      if (modifier || isAlt) {
        switch (key) {
          // Ctrl+M: Members
          case 'm':
            e.preventDefault();
            navigateWithFeedback('/members', 'Members Directory', modifier ? 'Ctrl+M' : 'Alt+M');
            break;

          // Ctrl+F: Finance
          case 'f':
            e.preventDefault();
            navigateWithFeedback('/finance', 'Finance & Giving', modifier ? 'Ctrl+F' : 'Alt+F');
            break;

          // Ctrl+D: Dashboard
          case 'd':
            e.preventDefault();
            navigateWithFeedback('/', 'Executive Dashboard', modifier ? 'Ctrl+D' : 'Alt+D');
            break;

          // Ctrl+A: Attendance Tracker
          case 'a':
            e.preventDefault();
            navigateWithFeedback('/attendance', 'Attendance Tracker', modifier ? 'Ctrl+A' : 'Alt+A');
            break;

          // Ctrl+V: Visitors
          case 'v':
            e.preventDefault();
            navigateWithFeedback('/visitors', 'Visitors & Follow-ups', modifier ? 'Ctrl+V' : 'Alt+V');
            break;

          // Ctrl+S: Services
          case 's':
            e.preventDefault();
            navigateWithFeedback('/services', 'Services & Schedules', modifier ? 'Ctrl+S' : 'Alt+S');
            break;

          // Ctrl+P: Pledges
          case 'p':
            e.preventDefault();
            navigateWithFeedback('/pledges', 'Pledges & Campaigns', modifier ? 'Ctrl+P' : 'Alt+P');
            break;

          // Ctrl+E: Events
          case 'e':
            e.preventDefault();
            navigateWithFeedback('/events', 'Calendar & Events', modifier ? 'Ctrl+E' : 'Alt+E');
            break;

          // Ctrl+R: Reports
          case 'r':
            e.preventDefault();
            navigateWithFeedback('/reports', 'Analytics & Reports', modifier ? 'Ctrl+R' : 'Alt+R');
            break;

          // Ctrl+J: Pastoral AI Assistant
          case 'j':
            e.preventDefault();
            onOpenAssistant?.();
            break;

          // Ctrl+B: Toggle Sidebar
          case 'b':
            e.preventDefault();
            onToggleSidebar?.();
            break;

          // Ctrl+,: Settings
          case ',':
            e.preventDefault();
            navigateWithFeedback('/settings', 'System Settings', modifier ? 'Ctrl+,' : 'Alt+,');
            break;

          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    navigateWithFeedback,
    onOpenSearch,
    onOpenAssistant,
    onOpenShortcutsHelp,
    onToggleSidebar,
    onRefreshData,
    onQuickAction,
    isAnyModalOpen,
    onCloseAllModals,
  ]);

  return { shortcuts };
}
