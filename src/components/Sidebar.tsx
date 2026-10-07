import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  User,
  UserCheck,
  ClipboardCheck,
  CalendarDays,
  Wallet,
  Coins,
  Church,
  Network,
  CalendarCheck,
  HeartHandshake,
  MessageSquare,
  BarChart3,
  ShieldCheck,
  Settings,
  History,
  ChevronLeft,
  ChevronRight,
  Flame,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useChurchData } from '../contexts/ChurchDataContext';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen?: boolean;
  setMobileOpen?: (v: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}) => {
  const { canAccess, currentUser, logout } = useAuth();
  const { visitors, prayerRequests, welfareClaims } = useChurchData();
  const navigate = useNavigate();

  const pendingVisitorsCount = visitors.filter(
    (v) => v.follow_up_status === 'new' || v.follow_up_status === 'follow_up_required'
  ).length;

  const pendingPrayersCount = prayerRequests.filter(
    (p) => p.status === 'new' || p.status === 'praying'
  ).length;

  const pendingWelfareCount = welfareClaims.filter(
    (w) => w.status === 'pending' || w.status === 'under_review'
  ).length;

  const navSections = [
    {
      group: 'Core Administration',
      items: [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard, module: 'dashboard' },
        { name: 'Members', path: '/members', icon: Users, module: 'members' },
        {
          name: 'Visitors',
          path: '/visitors',
          icon: UserCheck,
          module: 'visitors',
          badge: pendingVisitorsCount > 0 ? pendingVisitorsCount : undefined,
          badgeColor: 'bg-amber-500 text-white',
        },
        { name: 'Attendance', path: '/attendance', icon: ClipboardCheck, module: 'attendance' },
        { name: 'Services', path: '/services', icon: CalendarDays, module: 'services' },
      ],
    },
    {
      group: 'Financial Stewardship',
      items: [
        { name: 'Finance & Giving', path: '/finance', icon: Wallet, module: 'finance' },
        {
          name: 'Welfare & Relief',
          path: '/welfare',
          icon: HeartHandshake,
          module: 'finance',
          badge: pendingWelfareCount > 0 ? pendingWelfareCount : undefined,
          badgeColor: 'bg-emerald-600 text-white',
        },
        { name: 'Pledges', path: '/pledges', icon: Coins, module: 'pledges' },
      ],
    },
    {
      group: 'Church Life & Fellowship',
      items: [
        { name: 'Ministries', path: '/ministries', icon: Church, module: 'ministries' },
        { name: 'Small Groups', path: '/small-groups', icon: Network, module: 'small_groups' },
        { name: 'Events & Calendar', path: '/events', icon: CalendarCheck, module: 'events' },
        {
          name: 'Member Portal',
          path: '/portal',
          icon: User,
          module: 'members',
          badge: 'Portal',
          badgeColor: 'bg-emerald-600 text-white font-medium text-[10px]',
        },
      ],
    },
    {
      group: 'Pastoral & Ministry',
      items: [
        {
          name: 'Pastoral Care',
          path: '/pastoral-care',
          icon: HeartHandshake,
          module: 'pastoral_care',
          badge: pendingPrayersCount > 0 ? pendingPrayersCount : undefined,
          badgeColor: 'bg-emerald-500 text-white',
        },
        { name: 'Communication', path: '/communication', icon: MessageSquare, module: 'communication' },
        {
          name: 'AI Pastoral Assistant',
          path: '/assistant',
          icon: Sparkles,
          module: 'dashboard',
          badge: 'AI',
          badgeColor: 'bg-emerald-400 text-slate-950 font-bold',
        },
      ],
    },
    {
      group: 'Management & System',
      items: [
        { name: 'Reports & Analytics', path: '/reports', icon: BarChart3, module: 'reports' },
        { name: 'Users & Roles', path: '/users', icon: ShieldCheck, module: 'users' },
        { name: 'Audit Logs', path: '/audit-logs', icon: History, module: 'audit_logs' },
        { name: 'Settings & Supabase', path: '/settings', icon: Settings, module: 'settings' },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={() => setMobileOpen?.(false)}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-[#0f172a] text-slate-200 border-r border-slate-800 transition-all duration-300 ease-in-out ${
          collapsed ? 'w-20' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 bg-[#0a0f1d]">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-md shadow-emerald-950/40 shrink-0 overflow-hidden p-0.5 border border-emerald-500/40">
              <img
                src="/assets/logo.png"
                alt="Church Management System Logo"
                className="w-full h-full object-contain"
                loading="eager"
              />
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <span className="font-bold text-sm text-white tracking-wide flex items-center gap-1">
                  CMS <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">HQ</span>
                </span>
                <span className="text-xs text-slate-400 truncate">Church Management System</span>
              </div>
            )}
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navSections.map((section, sIndex) => {
            const visibleItems = section.items.filter((item) => canAccess(item.module));
            if (visibleItems.length === 0) return null;

            return (
              <div key={sIndex} className="space-y-1">
                {!collapsed && (
                  <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {section.group}
                  </div>
                )}
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/'}
                      onClick={() => setMobileOpen?.(false)}
                      className={({ isActive }) =>
                        `flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                          isActive
                            ? 'bg-[#064e3b] text-white shadow-sm border border-emerald-500/30 font-semibold'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                        } ${collapsed ? 'justify-center' : 'justify-between'}`
                      }
                      title={collapsed ? item.name : undefined}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 shrink-0 transition-colors ${collapsed ? '' : ''}`} />
                        {!collapsed && <span className="truncate">{item.name}</span>}
                      </div>

                      {!collapsed && item.badge !== undefined && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.badgeColor || 'bg-emerald-500 text-white'}`}>
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Active Staff Profile & Sign Out Bar */}
        <div className="p-2.5 border-t border-slate-800 bg-[#0c1222]">
          {!collapsed ? (
            <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                {currentUser.avatar_url ? (
                  <img
                    src={currentUser.avatar_url}
                    alt={currentUser.first_name}
                    className="w-8 h-8 rounded-full object-cover shrink-0 border border-emerald-500/30"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {currentUser.first_name[0]}
                    {currentUser.last_name[0]}
                  </div>
                )}
                <div className="min-w-0 truncate">
                  <p className="text-xs font-bold text-white truncate leading-tight">
                    {currentUser.first_name} {currentUser.last_name}
                  </p>
                  <p className="text-[10px] text-emerald-400 capitalize truncate">
                    {currentUser.role.replace('_', ' ')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    navigate('/login');
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                  title="Sign out / Switch account"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  navigate('/login');
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
                title="Sign out / Switch account"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Church Location Pill Footer */}
        <div className="p-3 border-t border-slate-800 bg-[#0a0f1d]/50">
          {!collapsed ? (
            <div className="flex items-center justify-between text-xs text-slate-400">
              <div className="truncate">
                <p className="text-white font-medium truncate">Joma Assembly, Accra</p>
                <p className="text-[11px] text-slate-500">GMT (Africa/Accra)</p>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-800 rounded text-amber-400 border border-slate-700">
                GH₵ GHS
              </span>
            </div>
          ) : (
            <div className="flex justify-center text-[10px] font-mono text-amber-400 font-bold">
              GH₵
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
