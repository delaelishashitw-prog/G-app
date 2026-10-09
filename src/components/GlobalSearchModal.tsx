import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  Users,
  UserCheck,
  Calendar,
  ArrowRight,
  Phone,
  MapPin,
  Shield,
  ShieldCheck,
  Zap,
  Coins,
  CalendarCheck,
  UserPlus,
  RefreshCw,
  Moon,
  Sun,
  Key,
  Keyboard,
  Sparkles,
  HeartHandshake,
  FileText,
  Church,
  Network,
  GraduationCap,
  MessageSquare,
  BarChart3,
  Package,
  History,
  Settings,
  Wallet,
  CornerDownLeft,
  CheckCircle2,
  Command,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';

export type CommandCategory = 'all' | 'members' | 'pages' | 'tasks' | 'visitors' | 'events';

export interface CommandPaletteTask {
  id: string;
  title: string;
  category: 'Ministerial' | 'Stewardship' | 'System' | 'Pastoral';
  description: string;
  shortcut?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  keywords: string[];
}

export interface CommandPalettePage {
  id: string;
  title: string;
  path: string;
  module: string;
  group: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
}

export interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMember?: (memberId: string) => void;
  onQuickAction?: (action: 'member' | 'visitor' | 'giving' | 'attendance' | 'event') => void;
  onOpenAssistant?: () => void;
  onOpenShortcutsHelp?: () => void;
  onToggleSidebar?: () => void;
  onRefreshData?: () => void;
  onOpenChangePassword?: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectMember,
  onQuickAction,
  onOpenAssistant,
  onOpenShortcutsHelp,
  onToggleSidebar,
  onRefreshData,
  onOpenChangePassword,
}) => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CommandCategory>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const { members, visitors, events, refreshData } = useChurchData();
  const { canAccess, currentRole } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { success: toastSuccess, info: toastInfo } = useToast();

  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent);
  const modKey = isMac ? '⌘' : 'Ctrl';

  // Available system pages with RBAC modules
  const allPages: CommandPalettePage[] = useMemo(
    () => [
      {
        id: 'page-dashboard',
        title: 'Executive Dashboard',
        path: '/',
        module: 'dashboard',
        group: 'Overview',
        description: 'Church real-time pulse, attendance graphs & ministerial metrics',
        icon: BarChart3,
        keywords: ['dashboard', 'home', 'kpi', 'metrics', 'overview', 'pulse'],
      },
      {
        id: 'page-members',
        title: 'Members Directory',
        path: '/members',
        module: 'members',
        group: 'Membership',
        description: 'Full church membership roll, member dossiers & contact records',
        icon: Users,
        keywords: ['members', 'directory', 'people', 'congregation', 'profiles', 'contacts'],
      },
      {
        id: 'page-finance',
        title: 'Finance & Giving',
        path: '/finance',
        module: 'finance',
        group: 'Financial Stewardship',
        description: 'Tithes, offerings, covenant donations, bank accounts & disbursements',
        icon: Wallet,
        keywords: ['finance', 'giving', 'tithes', 'offerings', 'money', 'accounts', 'collections', 'tally'],
      },
      {
        id: 'page-welfare',
        title: 'Welfare & Benevolence',
        path: '/welfare',
        module: 'finance',
        group: 'Financial Stewardship',
        description: 'Benevolence fund, welfare claims review & monthly member dues',
        icon: HeartHandshake,
        keywords: ['welfare', 'benevolence', 'relief', 'aid', 'claims', 'dues', 'charity'],
      },
      {
        id: 'page-pledges',
        title: 'Pledges & Capital Campaigns',
        path: '/pledges',
        module: 'pledges',
        group: 'Financial Stewardship',
        description: 'Building fund, special mission pledges & pledge fulfillment tracker',
        icon: Coins,
        keywords: ['pledges', 'campaigns', 'building fund', 'donations', 'covenant'],
      },
      {
        id: 'page-attendance',
        title: 'Attendance & Check-in',
        path: '/attendance',
        module: 'attendance',
        group: 'Ministry Services',
        description: 'Sunday and midweek service headcount, digital check-in passes & trends',
        icon: CalendarCheck,
        keywords: ['attendance', 'checkin', 'headcount', 'present', 'service attendance'],
      },
      {
        id: 'page-visitors',
        title: 'First-time Visitors & Guests',
        path: '/visitors',
        module: 'visitors',
        group: 'Ministry Services',
        description: 'Assimilation Kanban pipeline, visitor follow-ups & pastoral calls',
        icon: UserCheck,
        keywords: ['visitors', 'guests', 'first timers', 'followup', 'assimilation', 'newcomers'],
      },
      {
        id: 'page-services',
        title: 'Services & Liturgies',
        path: '/services',
        module: 'services',
        group: 'Ministry Services',
        description: 'Service orders, bulletins, pulpit schedule & duty rosters',
        icon: Church,
        keywords: ['services', 'liturgy', 'duty roster', 'bulletin', 'preacher', 'order of service'],
      },
      {
        id: 'page-ministries',
        title: 'Church Ministries & Departments',
        path: '/ministries',
        module: 'ministries',
        group: 'Church Life',
        description: 'Choir, Ushers, Media, Protocol, Children Ministry leadership & teams',
        icon: Church,
        keywords: ['ministries', 'departments', 'choir', 'ushers', 'protocol', 'media'],
      },
      {
        id: 'page-small-groups',
        title: 'Small Groups & Cell Fellowship',
        path: '/small-groups',
        module: 'small_groups',
        group: 'Church Life',
        description: 'Zonal cell groups, home fellowship leaders & meetings',
        icon: Network,
        keywords: ['small groups', 'cells', 'zones', 'fellowship', 'home cells'],
      },
      {
        id: 'page-foundation',
        title: 'Foundation School & Discipleship',
        path: '/members?tab=foundation',
        module: 'members',
        group: 'Church Life',
        description: 'Believers foundation school classes, graduation status & discipleship',
        icon: GraduationCap,
        keywords: ['foundation school', 'discipleship', 'classes', 'baptism', 'training'],
      },
      {
        id: 'page-events',
        title: 'Church Events Calendar',
        path: '/events',
        module: 'events',
        group: 'Church Life',
        description: 'Conferences, revivals, vigils, executive calendar & iCal export',
        icon: Calendar,
        keywords: ['events', 'calendar', 'programs', 'conferences', 'revival', 'vigil'],
      },
      {
        id: 'page-pastoral-care',
        title: 'Pastoral Care & Counseling',
        path: '/pastoral-care',
        module: 'pastoral_care',
        group: 'Pastoral Care',
        description: 'Home/hospital visitations, confidential counseling & prayer logs',
        icon: HeartHandshake,
        keywords: ['pastoral care', 'counseling', 'visitation', 'prayer requests', 'pastor'],
      },
      {
        id: 'page-communication',
        title: 'Communication & Birthday Radar',
        path: '/communication',
        module: 'communication',
        group: 'Pastoral Care',
        description: 'Today’s celebrants, pastoral welcome messages & SMS dispatch',
        icon: MessageSquare,
        keywords: ['communication', 'sms', 'birthdays', 'celebrants', 'broadcast', 'welcome video'],
      },
      {
        id: 'page-assistant',
        title: 'Pastoral AI Assistant',
        path: '/assistant',
        module: 'dashboard',
        group: 'Pastoral Care',
        description: 'AI-assisted sermon research, liturgy generator & pastoral guidance',
        icon: Sparkles,
        keywords: ['ai', 'assistant', 'gemini', 'sermon', 'scripture', 'liturgy', 'pastoral ai'],
      },
      {
        id: 'page-reports',
        title: 'Executive Reports & Analytics',
        path: '/reports',
        module: 'reports',
        group: 'Management & System',
        description: 'Board summaries, PDF financial statements & growth analytics',
        icon: BarChart3,
        keywords: ['reports', 'analytics', 'statistics', 'pdf', 'executive report', 'trends'],
      },
      {
        id: 'page-inventory',
        title: 'Asset & Equipment Inventory',
        path: '/inventory',
        module: 'settings',
        group: 'Management & System',
        description: 'Sound equipment, media gear, church vehicles, furniture & maintenance',
        icon: Package,
        keywords: ['inventory', 'assets', 'equipment', 'instruments', 'maintenance'],
      },
      {
        id: 'page-users',
        title: 'Staff Directory & Access Control',
        path: '/users',
        module: 'users',
        group: 'Management & System',
        description: 'Staff profiles, RBAC permissions, password resets & Super Admin tools',
        icon: ShieldCheck,
        keywords: ['staff', 'users', 'access control', 'rbac', 'super admin', 'passwords', 'directory', 'roles'],
      },
      {
        id: 'page-audit-logs',
        title: 'System Audit Logs',
        path: '/audit-logs',
        module: 'audit_logs',
        group: 'Management & System',
        description: 'Immutable record of staff actions, data modifications & logins',
        icon: History,
        keywords: ['audit logs', 'history', 'security logs', 'activity trail', 'audit'],
      },
      {
        id: 'page-settings',
        title: 'Church Settings & Supabase Hub',
        path: '/settings',
        module: 'settings',
        group: 'Management & System',
        description: 'Church details, currency, Supabase cloud sync & database health',
        icon: Settings,
        keywords: ['settings', 'supabase', 'database', 'configuration', 'system settings'],
      },
      {
        id: 'page-security',
        title: 'Security & Password Management',
        path: '/settings?tab=security',
        module: 'settings',
        group: 'Management & System',
        description: 'Change workstation password, audit active credentials & default keys',
        icon: Key,
        keywords: ['security', 'password', 'change password', 'credentials', 'default password'],
      },
      {
        id: 'page-portal',
        title: 'Member Self-Service Portal',
        path: '/portal',
        module: 'members',
        group: 'Membership',
        description: 'Member view for personal giving statements, certificates & ID card',
        icon: Users,
        keywords: ['portal', 'member portal', 'self service', 'giving statement', 'id card'],
      },
    ],
    []
  );

  // Available interactive Tasks and Workflows
  const allTasks: CommandPaletteTask[] = useMemo(
    () => [
      {
        id: 'task-record-giving',
        title: 'Record Giving (Tithe / Offering)',
        category: 'Stewardship',
        description: 'Launch quick donation entry for tithe, offering or covenant pledge',
        shortcut: `${modKey}+Shift+G`,
        icon: Coins,
        keywords: ['give', 'giving', 'tithe', 'offering', 'donation', 'momo', 'cash', 'record giving'],
        action: () => {
          if (onQuickAction) {
            onQuickAction('giving');
          } else {
            navigate('/finance?action=record');
          }
        },
      },
      {
        id: 'task-mark-attendance',
        title: 'Check-in Attendee / Headcount',
        category: 'Ministerial',
        description: 'Rapid attendee check-in or service attendance tally',
        shortcut: `${modKey}+Shift+A`,
        icon: CalendarCheck,
        keywords: ['attendance', 'checkin', 'mark attendance', 'headcount', 'present'],
        action: () => {
          if (onQuickAction) {
            onQuickAction('attendance');
          } else {
            navigate('/attendance');
          }
        },
      },
      {
        id: 'task-new-visitor',
        title: 'Register First-time Visitor / Guest',
        category: 'Ministerial',
        description: 'Capture newcomer contact details, service attended & prayer request',
        shortcut: `${modKey}+Shift+V`,
        icon: UserPlus,
        keywords: ['visitor', 'guest', 'first timer', 'newcomer', 'add visitor', 'register visitor'],
        action: () => {
          if (onQuickAction) {
            onQuickAction('visitor');
          } else {
            navigate('/visitors?action=new');
          }
        },
      },
      {
        id: 'task-new-member',
        title: 'Add New Church Member',
        category: 'Ministerial',
        description: 'Register new member profile with Ghanaian phone, GPS address & ministry',
        shortcut: `${modKey}+Shift+M`,
        icon: Users,
        keywords: ['member', 'add member', 'new member', 'registration', 'register member', 'profile'],
        action: () => {
          if (onQuickAction) {
            onQuickAction('member');
          } else {
            navigate('/members?action=new');
          }
        },
      },
      {
        id: 'task-schedule-event',
        title: 'Schedule Church Event / Service',
        category: 'Ministerial',
        description: 'Create new church program, service, revival or special service',
        icon: Calendar,
        keywords: ['event', 'schedule event', 'program', 'calendar', 'service', 'create event'],
        action: () => {
          if (onQuickAction) {
            onQuickAction('event');
          } else {
            navigate('/events?action=new');
          }
        },
      },
      {
        id: 'task-welfare-claim',
        title: 'Apply Welfare Claim / Benevolence Aid',
        category: 'Stewardship',
        description: 'Submit benevolence request for medical, bereavement or emergency relief',
        icon: HeartHandshake,
        keywords: ['welfare claim', 'benevolence', 'aid', 'medical', 'relief', 'claim', 'welfare'],
        action: () => {
          navigate('/welfare?action=claim');
        },
      },
      {
        id: 'task-welfare-dues',
        title: 'Record Member Monthly Welfare Dues',
        category: 'Stewardship',
        description: 'Log monthly welfare dues contribution for active church member',
        icon: HeartHandshake,
        keywords: ['welfare dues', 'dues', 'contribution', 'monthly dues', 'welfare'],
        action: () => {
          navigate('/welfare?action=dues');
        },
      },
      {
        id: 'task-pastoral-visitation',
        title: 'Log Pastoral Visitation',
        category: 'Pastoral',
        description: 'Record home visit, hospital check or prayer session with notes',
        icon: HeartHandshake,
        keywords: ['visitation', 'pastoral visit', 'hospital', 'home visit', 'care'],
        action: () => {
          navigate('/pastoral-care?action=visitation');
        },
      },
      {
        id: 'task-pastoral-counseling',
        title: 'Schedule Pastoral Counseling Session',
        category: 'Pastoral',
        description: 'Book confidential counseling appointment with pastoral staff',
        icon: HeartHandshake,
        keywords: ['counseling', 'appointment', 'pastoral session', 'guidance', 'premarital'],
        action: () => {
          navigate('/pastoral-care?action=counseling');
        },
      },
      {
        id: 'task-order-of-service',
        title: 'Edit Order of Service & Duty Roster',
        category: 'Ministerial',
        description: 'Design Sunday service liturgy, assign stewards, choristers & preachers',
        icon: Church,
        keywords: ['order of service', 'duty roster', 'liturgy', 'roster', 'preacher', 'service'],
        action: () => {
          navigate('/services?tab=roster');
        },
      },
      {
        id: 'task-sunday-tally',
        title: 'Sunday Service Finance Tally Sheet',
        category: 'Stewardship',
        description: 'Count physical cash, denominations, MoMo and calculate reconciliation',
        icon: Wallet,
        keywords: ['tally sheet', 'sunday tally', 'count cash', 'denominations', 'reconciliation'],
        action: () => {
          navigate('/finance?tab=tally');
        },
      },
      {
        id: 'task-print-directory',
        title: 'Print / Export Member Directory',
        category: 'Ministerial',
        description: 'Generate formatted printable membership directory with photos & contact info',
        icon: FileText,
        keywords: ['print directory', 'export members', 'print', 'directory pdf'],
        action: () => {
          navigate('/members?action=print');
        },
      },
      {
        id: 'task-export-reports',
        title: 'Generate PDF Executive / Financial Report',
        category: 'System',
        description: 'Export official church report with charts, finances & membership KPIs',
        icon: BarChart3,
        keywords: ['pdf report', 'export pdf', 'financial report', 'analytics report'],
        action: () => {
          navigate('/reports');
        },
      },
      {
        id: 'task-ai-assistant',
        title: 'Ask Pastoral AI Assistant',
        category: 'Pastoral',
        description: 'Open AI Assistant for scripture study, sermon outline & counseling advice',
        shortcut: `${modKey}+J`,
        icon: Sparkles,
        keywords: ['ai assistant', 'ask ai', 'gemini', 'sermon', 'scripture', 'prayer outline'],
        action: () => {
          if (onOpenAssistant) {
            onOpenAssistant();
          } else {
            navigate('/assistant');
          }
        },
      },
      {
        id: 'task-refresh-records',
        title: 'Refresh All Church Records',
        category: 'System',
        description: 'Sync live data from Supabase cloud database and clear local cache',
        shortcut: `${modKey}+Shift+R`,
        icon: RefreshCw,
        keywords: ['refresh', 'sync', 'reload', 'sync cloud', 'database sync', 'update data'],
        action: async () => {
          if (onRefreshData) {
            onRefreshData();
          } else {
            const res = await refreshData();
            if (res.success) {
              toastSuccess('Records Refreshed', res.message);
            }
          }
        },
      },
      {
        id: 'task-toggle-theme',
        title: `Switch Theme to ${resolvedTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}`,
        category: 'System',
        description: `Currently ${resolvedTheme === 'dark' ? 'Dark' : 'Light'} theme active`,
        icon: resolvedTheme === 'dark' ? Sun : Moon,
        keywords: ['theme', 'dark mode', 'light mode', 'toggle theme', 'appearance'],
        action: () => {
          toggleTheme();
          toastInfo('Theme Updated', `Switched to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} mode`);
        },
      },
      {
        id: 'task-toggle-sidebar',
        title: 'Toggle Navigation Sidebar',
        category: 'System',
        description: 'Expand or collapse the left application navigation drawer',
        shortcut: `${modKey}+B`,
        icon: Command,
        keywords: ['toggle sidebar', 'collapse sidebar', 'sidebar', 'menu'],
        action: () => {
          onToggleSidebar?.();
        },
      },
      {
        id: 'task-change-password',
        title: 'Change Workstation Password',
        category: 'System',
        description: 'Update your staff security password and login credentials',
        icon: Key,
        keywords: ['password', 'change password', 'credentials', 'security', 'reset password'],
        action: () => {
          if (onOpenChangePassword) {
            onOpenChangePassword();
          } else {
            navigate('/settings?tab=security');
          }
        },
      },
      {
        id: 'task-shortcuts-help',
        title: 'Keyboard Shortcuts Cheat Sheet',
        category: 'System',
        description: 'View full guide of keyboard shortcuts for lightning-fast productivity',
        shortcut: '?',
        icon: Keyboard,
        keywords: ['keyboard shortcuts', 'shortcuts', 'cheatsheet', 'hotkeys', 'help'],
        action: () => {
          onOpenShortcutsHelp?.();
        },
      },
    ],
    [modKey, onQuickAction, navigate, onOpenAssistant, onRefreshData, refreshData, toastSuccess, resolvedTheme, toggleTheme, toastInfo, onToggleSidebar, onOpenChangePassword, onOpenShortcutsHelp]
  );

  // Focus input and reset query on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setActiveCategory('all');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle prefix commands in query
  // e.g. ">" -> tasks, "@" or "#" -> members, "/" -> pages
  const effectiveFilter = useMemo(() => {
    const trimmed = query.trim();
    if (trimmed.startsWith('>') || trimmed.toLowerCase().startsWith('task:')) {
      return { category: 'tasks' as CommandCategory, cleanQuery: trimmed.replace(/^>|^task:/i, '').trim().toLowerCase() };
    }
    if (trimmed.startsWith('@') || trimmed.startsWith('#') || trimmed.toLowerCase().startsWith('mem:') || trimmed.toLowerCase().startsWith('member:')) {
      return { category: 'members' as CommandCategory, cleanQuery: trimmed.replace(/^[@#]|^mem:|^member:/i, '').trim().toLowerCase() };
    }
    if (trimmed.startsWith('/') || trimmed.toLowerCase().startsWith('page:')) {
      return { category: 'pages' as CommandCategory, cleanQuery: trimmed.replace(/^\/|^page:/i, '').trim().toLowerCase() };
    }
    return { category: activeCategory, cleanQuery: trimmed.toLowerCase() };
  }, [query, activeCategory]);

  const cleanQuery = effectiveFilter.cleanQuery;
  const currentCategory = effectiveFilter.category;

  // Filtered members
  const matchingMembers = useMemo(() => {
    if (currentCategory !== 'all' && currentCategory !== 'members') return [];
    if (!cleanQuery) return members.slice(0, 4); // Quick suggestions when empty
    return members
      .filter((m) => {
        const fullName = `${m.first_name || ''} ${m.last_name || ''}`.toLowerCase();
        const memberId = (m.member_id || '').toLowerCase();
        const titheNumber = (m.tithe_number || '').toLowerCase();
        const phone = (m.phone || '').toLowerCase();
        const email = (m.email || '').toLowerCase();
        const address = (m.residential_address || '').toLowerCase();
        const gps = (m.gps_address || '').toLowerCase();
        return (
          fullName.includes(cleanQuery) ||
          memberId.includes(cleanQuery) ||
          titheNumber.includes(cleanQuery) ||
          phone.includes(cleanQuery) ||
          email.includes(cleanQuery) ||
          address.includes(cleanQuery) ||
          gps.includes(cleanQuery)
        );
      })
      .slice(0, 8);
  }, [cleanQuery, members, currentCategory]);

  // Filtered pages (RBAC-aware)
  const matchingPages = useMemo(() => {
    if (currentCategory !== 'all' && currentCategory !== 'pages') return [];
    const authorizedPages = allPages.filter((p) => canAccess(p.module));
    if (!cleanQuery) {
      // Return key frequent destinations when empty
      return authorizedPages.filter((p) =>
        ['page-dashboard', 'page-members', 'page-finance', 'page-pastoral-care', 'page-users', 'page-settings'].includes(p.id)
      );
    }
    return authorizedPages.filter(
      (p) =>
        p.title.toLowerCase().includes(cleanQuery) ||
        p.description.toLowerCase().includes(cleanQuery) ||
        p.group.toLowerCase().includes(cleanQuery) ||
        p.keywords.some((k) => k.includes(cleanQuery) || cleanQuery.includes(k))
    );
  }, [cleanQuery, allPages, canAccess, currentCategory]);

  // Filtered tasks
  const matchingTasks = useMemo(() => {
    if (currentCategory !== 'all' && currentCategory !== 'tasks') return [];
    if (!cleanQuery) {
      // Top ministerial tasks when empty
      return allTasks.slice(0, 5);
    }
    return allTasks.filter(
      (t) =>
        t.title.toLowerCase().includes(cleanQuery) ||
        t.description.toLowerCase().includes(cleanQuery) ||
        t.category.toLowerCase().includes(cleanQuery) ||
        t.keywords.some((k) => k.includes(cleanQuery) || cleanQuery.includes(k))
    );
  }, [cleanQuery, allTasks, currentCategory]);

  // Filtered visitors
  const matchingVisitors = useMemo(() => {
    if (currentCategory !== 'all' && currentCategory !== 'visitors') return [];
    if (!cleanQuery) return [];
    return visitors
      .filter((v) => {
        const name = (v.full_name || '').toLowerCase();
        const phone = (v.phone || '').toLowerCase();
        const service = (v.service_attended || '').toLowerCase();
        return name.includes(cleanQuery) || phone.includes(cleanQuery) || service.includes(cleanQuery);
      })
      .slice(0, 5);
  }, [cleanQuery, visitors, currentCategory]);

  // Filtered events
  const matchingEvents = useMemo(() => {
    if (currentCategory !== 'all' && currentCategory !== 'events') return [];
    if (!cleanQuery) return [];
    return events
      .filter((e) => {
        const title = (e.title || '').toLowerCase();
        const speaker = (e.speaker || '').toLowerCase();
        const venue = (e.venue || '').toLowerCase();
        return title.includes(cleanQuery) || speaker.includes(cleanQuery) || venue.includes(cleanQuery);
      })
      .slice(0, 5);
  }, [cleanQuery, events, currentCategory]);

  // Flat list of all unified results for arrow navigation and instant selection
  const flatResults = useMemo(() => {
    const list: Array<{
      type: 'page' | 'task' | 'member' | 'visitor' | 'event';
      id: string;
      item: any;
      onExecute: () => void;
    }> = [];

    // Prioritize Tasks and Pages for quick action matching, then Members
    matchingTasks.forEach((t) => {
      list.push({
        type: 'task',
        id: `task-${t.id}`,
        item: t,
        onExecute: () => {
          onClose();
          t.action();
        },
      });
    });

    matchingPages.forEach((p) => {
      list.push({
        type: 'page',
        id: `page-${p.id}`,
        item: p,
        onExecute: () => {
          onClose();
          navigate(p.path);
        },
      });
    });

    matchingMembers.forEach((m) => {
      list.push({
        type: 'member',
        id: `member-${m.id}`,
        item: m,
        onExecute: () => {
          onClose();
          navigate(`/members?id=${m.id}`);
          onSelectMember?.(m.id);
        },
      });
    });

    matchingVisitors.forEach((v) => {
      list.push({
        type: 'visitor',
        id: `visitor-${v.id}`,
        item: v,
        onExecute: () => {
          onClose();
          navigate('/visitors');
        },
      });
    });

    matchingEvents.forEach((e) => {
      list.push({
        type: 'event',
        id: `event-${e.id}`,
        item: e,
        onExecute: () => {
          onClose();
          navigate('/events');
        },
      });
    });

    return list;
  }, [matchingTasks, matchingPages, matchingMembers, matchingVisitors, matchingEvents, onClose, navigate, onSelectMember]);

  // Reset selectedIndex whenever the search result set updates
  useEffect(() => {
    setSelectedIndex(0);
  }, [flatResults.length, cleanQuery, currentCategory]);

  // Scroll active element into view
  useEffect(() => {
    if (!resultsContainerRef.current) return;
    const activeEl = resultsContainerRef.current.querySelector('[data-selected="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Category tab definitions
  const CATEGORIES: Array<{ id: CommandCategory; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }> = [
    { id: 'all', label: 'All', icon: Zap },
    { id: 'pages', label: 'Pages', icon: BarChart3, count: matchingPages.length },
    { id: 'tasks', label: 'Tasks', icon: CheckCircle2, count: matchingTasks.length },
    { id: 'members', label: 'Members', icon: Users, count: matchingMembers.length },
    { id: 'visitors', label: 'Visitors', icon: UserCheck, count: matchingVisitors.length },
    { id: 'events', label: 'Events', icon: Calendar, count: matchingEvents.length },
  ];

  // Global key navigation within modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape closes
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Arrow Down
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (flatResults.length > 0) {
          setSelectedIndex((prev) => (prev + 1) % flatResults.length);
        }
        return;
      }

      // Arrow Up
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (flatResults.length > 0) {
          setSelectedIndex((prev) => (prev - 1 + flatResults.length) % flatResults.length);
        }
        return;
      }

      // Enter executes current item
      if (e.key === 'Enter') {
        e.preventDefault();
        if (flatResults.length > 0 && flatResults[selectedIndex]) {
          flatResults[selectedIndex].onExecute();
        }
        return;
      }

      // Tab cycles category filter
      if (e.key === 'Tab') {
        e.preventDefault();
        const currentIndex = CATEGORIES.findIndex((c) => c.id === currentCategory);
        const nextIndex = e.shiftKey
          ? (currentIndex - 1 + CATEGORIES.length) % CATEGORIES.length
          : (currentIndex + 1) % CATEGORIES.length;
        setActiveCategory(CATEGORIES[nextIndex].id);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, flatResults, selectedIndex, currentCategory, CATEGORIES, onClose]);

  if (!isOpen) return null;

  const totalResultsCount =
    matchingTasks.length + matchingPages.length + matchingMembers.length + matchingVisitors.length + matchingEvents.length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-10 sm:pt-20 px-3 sm:px-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-3xl bg-white dark:bg-[#0e1726] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh] transition-all">
        {/* Top Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mr-3 shrink-0">
            <Search className="w-4 h-4" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members, pages, tasks, or type > for tasks, @ for members..."
            className="w-full bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm sm:text-base focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-1.5 ml-2 shrink-0">
            <button
              onClick={onClose}
              className="text-[11px] font-mono px-2 py-1 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-300 dark:hover:bg-slate-700 transition"
            >
              ESC
            </button>
          </div>
        </div>

        {/* Category Filter Tabs Bar */}
        <div className="flex items-center gap-1 px-4 py-2 bg-slate-100/60 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-800/80 overflow-x-auto text-xs shrink-0 no-scrollbar">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = currentCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
                {typeof cat.count === 'number' && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? 'bg-emerald-900 text-emerald-100' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {cat.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Results Body */}
        <div ref={resultsContainerRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
          {/* Empty Query: Smart Ministerial Launcher */}
          {!cleanQuery && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-400 dark:text-slate-500">
                  Quick Ministerial Launcher
                </span>
                <span className="text-[11px]">
                  Press <kbd className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">↑</kbd>{' '}
                  <kbd className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">↓</kbd> to jump
                </span>
              </div>

              {/* Tasks Section */}
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 mb-2 px-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>High-Frequency Tasks</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {matchingTasks.slice(0, 4).map((task) => {
                    const taskIndex = flatResults.findIndex((r) => r.id === `task-${task.id}`);
                    const isSelected = selectedIndex === taskIndex;
                    const TaskIcon = task.icon;
                    return (
                      <div
                        key={task.id}
                        data-selected={isSelected}
                        onClick={() => {
                          onClose();
                          task.action();
                        }}
                        onMouseEnter={() => setSelectedIndex(taskIndex)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500/50'
                            : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                          }`}
                        >
                          <TaskIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                              {task.title}
                            </span>
                            {task.shortcut && (
                              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 shrink-0">
                                {task.shortcut}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {task.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Frequent Pages */}
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-400 mb-2 px-1">
                  <BarChart3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Frequent Pages</span>
                </div>
                <div className="space-y-1.5">
                  {matchingPages.slice(0, 4).map((page) => {
                    const pageIndex = flatResults.findIndex((r) => r.id === `page-${page.id}`);
                    const isSelected = selectedIndex === pageIndex;
                    const PageIcon = page.icon;
                    return (
                      <div
                        key={page.id}
                        data-selected={isSelected}
                        onClick={() => {
                          onClose();
                          navigate(page.path);
                        }}
                        onMouseEnter={() => setSelectedIndex(pageIndex)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/50'
                            : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-indigo-600 text-white'
                                : 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300'
                            }`}
                          >
                            <PageIcon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                              {page.title}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {page.description}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            {page.group}
                          </span>
                          <ArrowRight
                            className={`w-3.5 h-3.5 transition ${
                              isSelected ? 'text-indigo-600 dark:text-indigo-400 translate-x-0.5' : 'text-slate-300 dark:text-slate-600'
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Members */}
              {matchingMembers.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-400 mb-2 px-1">
                    <Users className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>Church Members</span>
                  </div>
                  <div className="space-y-1.5">
                    {matchingMembers.slice(0, 3).map((mem) => {
                      const memIndex = flatResults.findIndex((r) => r.id === `member-${mem.id}`);
                      const isSelected = selectedIndex === memIndex;
                      return (
                        <div
                          key={mem.id}
                          data-selected={isSelected}
                          onClick={() => {
                            onClose();
                            navigate(`/members?id=${mem.id}`);
                            onSelectMember?.(mem.id);
                          }}
                          onMouseEnter={() => setSelectedIndex(memIndex)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition ${
                            isSelected
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500/50'
                              : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {mem.profile_photo_url ? (
                              <img
                                src={mem.profile_photo_url}
                                alt={mem.first_name}
                                className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center text-xs">
                                {mem.first_name[0]}
                                {mem.last_name[0]}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                                  {mem.first_name} {mem.last_name}
                                </span>
                                <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                                  {mem.member_id}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  {mem.phone}
                                </span>
                              </div>
                            </div>
                          </div>
                          <ArrowRight
                            className={`w-3.5 h-3.5 transition ${
                              isSelected ? 'text-emerald-600 dark:text-emerald-400 translate-x-0.5' : 'text-slate-300 dark:text-slate-600'
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No results message */}
          {cleanQuery && totalResultsCount === 0 && (
            <div className="py-12 text-center text-slate-400">
              <Search className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No matching results for &quot;{query}&quot;
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Try searching by first or last name, phone number, tithe number, or prefix with &gt; for tasks, @ for members, or / for pages.
              </p>
            </div>
          )}

          {/* Active Search Results Grouped */}
          {cleanQuery && (
            <div className="space-y-4">
              {/* TASKS */}
              {matchingTasks.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 mb-2 px-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Tasks & Actions ({matchingTasks.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {matchingTasks.map((task) => {
                      const taskIndex = flatResults.findIndex((r) => r.id === `task-${task.id}`);
                      const isSelected = selectedIndex === taskIndex;
                      const TaskIcon = task.icon;
                      return (
                        <div
                          key={task.id}
                          data-selected={isSelected}
                          onClick={() => {
                            onClose();
                            task.action();
                          }}
                          onMouseEnter={() => setSelectedIndex(taskIndex)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition ${
                            isSelected
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500/50'
                              : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                              }`}
                            >
                              <TaskIcon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                                {task.title}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {task.description}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {task.shortcut && (
                              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                {task.shortcut}
                              </span>
                            )}
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-100/70 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                              {task.category}
                            </span>
                            <CornerDownLeft
                              className={`w-3.5 h-3.5 transition ${
                                isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-600'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* PAGES */}
              {matchingPages.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-400 mb-2 px-1">
                    <BarChart3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Pages & Modules ({matchingPages.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {matchingPages.map((page) => {
                      const pageIndex = flatResults.findIndex((r) => r.id === `page-${page.id}`);
                      const isSelected = selectedIndex === pageIndex;
                      const PageIcon = page.icon;
                      return (
                        <div
                          key={page.id}
                          data-selected={isSelected}
                          onClick={() => {
                            onClose();
                            navigate(page.path);
                          }}
                          onMouseEnter={() => setSelectedIndex(pageIndex)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/50'
                              : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300'
                              }`}
                            >
                              <PageIcon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                                {page.title}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {page.description}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              {page.group}
                            </span>
                            <ArrowRight
                              className={`w-3.5 h-3.5 transition ${
                                isSelected ? 'text-indigo-600 dark:text-indigo-400 translate-x-0.5' : 'text-slate-300 dark:text-slate-600'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* MEMBERS */}
              {matchingMembers.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-400 mb-2 px-1">
                    <Users className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>Church Members ({matchingMembers.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {matchingMembers.map((mem) => {
                      const memIndex = flatResults.findIndex((r) => r.id === `member-${mem.id}`);
                      const isSelected = selectedIndex === memIndex;
                      return (
                        <div
                          key={mem.id}
                          data-selected={isSelected}
                          onClick={() => {
                            onClose();
                            navigate(`/members?id=${mem.id}`);
                            onSelectMember?.(mem.id);
                          }}
                          onMouseEnter={() => setSelectedIndex(memIndex)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition ${
                            isSelected
                              ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-500 ring-1 ring-teal-500/50'
                              : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {mem.profile_photo_url ? (
                              <img
                                src={mem.profile_photo_url}
                                alt={mem.first_name}
                                className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center text-xs shrink-0">
                                {mem.first_name[0]}
                                {mem.last_name[0]}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                                  {mem.first_name} {mem.last_name}
                                </span>
                                <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                                  {mem.member_id}
                                </span>
                                {mem.tithe_number && (
                                  <span className="font-mono text-[10px] bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800">
                                    Tithe: {mem.tithe_number}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  {mem.phone}
                                </span>
                                {mem.residential_address && (
                                  <span className="hidden sm:flex items-center gap-1 truncate max-w-xs">
                                    <MapPin className="w-3 h-3 text-slate-400" />
                                    {mem.residential_address}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] uppercase font-bold text-teal-700 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/60 px-2 py-0.5 rounded">
                              Profile
                            </span>
                            <ArrowRight
                              className={`w-3.5 h-3.5 transition ${
                                isSelected ? 'text-teal-600 dark:text-teal-400 translate-x-0.5' : 'text-slate-300 dark:text-slate-600'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* VISITORS */}
              {matchingVisitors.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-400 mb-2 px-1">
                    <UserCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Visitors & Guests ({matchingVisitors.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {matchingVisitors.map((vis) => {
                      const visIndex = flatResults.findIndex((r) => r.id === `visitor-${vis.id}`);
                      const isSelected = selectedIndex === visIndex;
                      return (
                        <div
                          key={vis.id}
                          data-selected={isSelected}
                          onClick={() => {
                            onClose();
                            navigate('/visitors');
                          }}
                          onMouseEnter={() => setSelectedIndex(visIndex)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition ${
                            isSelected
                              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 ring-1 ring-blue-500/50'
                              : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                                {vis.full_name}
                              </span>
                              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                                {vis.follow_up_status?.replace('_', ' ')}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              <span>{vis.phone}</span>
                              <span>•</span>
                              <span className="truncate max-w-xs">{vis.service_attended}</span>
                            </div>
                          </div>
                          <ArrowRight
                            className={`w-3.5 h-3.5 transition ${
                              isSelected ? 'text-blue-600 dark:text-blue-400 translate-x-0.5' : 'text-slate-300 dark:text-slate-600'
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* EVENTS */}
              {matchingEvents.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-800 dark:text-purple-400 mb-2 px-1">
                    <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>Church Events ({matchingEvents.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {matchingEvents.map((evt) => {
                      const evtIndex = flatResults.findIndex((r) => r.id === `event-${evt.id}`);
                      const isSelected = selectedIndex === evtIndex;
                      return (
                        <div
                          key={evt.id}
                          data-selected={isSelected}
                          onClick={() => {
                            onClose();
                            navigate('/events');
                          }}
                          onMouseEnter={() => setSelectedIndex(evtIndex)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition ${
                            isSelected
                              ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 ring-1 ring-purple-500/50'
                              : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                              {evt.title}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {evt.start_date} • {evt.venue}
                            </div>
                          </div>
                          <ArrowRight
                            className={`w-3.5 h-3.5 transition ${
                              isSelected ? 'text-purple-600 dark:text-purple-400 translate-x-0.5' : 'text-slate-300 dark:text-slate-600'
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with Keyboard Shortcuts Cheat Tips */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-1 py-0.2 rounded text-[10px]">
                ↑
              </kbd>
              <kbd className="font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-1 py-0.2 rounded text-[10px]">
                ↓
              </kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-1.5 py-0.2 rounded text-[10px]">
                ↵
              </kbd>
              <span>to select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-1.5 py-0.2 rounded text-[10px]">
                tab
              </kbd>
              <span>filter</span>
            </span>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
            <span className="hidden sm:inline text-slate-400">
              Prefixes: <code className="text-emerald-700 dark:text-emerald-400">&gt;</code> tasks, <code className="text-teal-700 dark:text-teal-400">@</code> members, <code className="text-indigo-700 dark:text-indigo-400">/</code> pages
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-slate-400">
              {flatResults.length} {flatResults.length === 1 ? 'result' : 'results'}
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-emerald-800 dark:text-emerald-400 font-semibold text-[10px]">
              Command Palette
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
