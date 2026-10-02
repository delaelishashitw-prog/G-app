import React, { useState } from 'react';
import { ShieldCheck, Plus, Check, X, User, Shield, KeyRound, AlertCircle } from 'lucide-react';
import { useAuth, ROLE_PERMISSIONS } from '../contexts/AuthContext';
import { UserRole } from '../types/database.types';

export const UsersPage: React.FC = () => {
  const { availableUsers, currentRole, setCurrentRole, switchUser, currentUser } = useAuth();
  const [selectedUser, setSelectedUser] = useState(currentUser);

  const rolesList: { role: UserRole; title: string; desc: string }[] = [
    { role: 'super_admin', title: 'Super Admin', desc: 'Full system control, schema access, user management' },
    { role: 'senior_pastor', title: 'Senior Pastor', desc: 'Full pastoral oversight, giving view, member records' },
    { role: 'administrator', title: 'Administrator', desc: 'Daily operations, members, visitors, communications' },
    { role: 'finance_officer', title: 'Finance Officer', desc: 'Giving records, tithes, expenditure, pledges' },
    { role: 'pastor', title: 'Pastor', desc: 'Pastoral care, counseling, prayer requests, visitors' },
    { role: 'ministry_leader', title: 'Ministry Leader', desc: 'Department and small group administration' },
    { role: 'attendance_officer', title: 'Attendance Officer', desc: 'Headcount and check-in scanner management' },
    { role: 'data_entry', title: 'Data Entry', desc: 'Basic data recording, read-only on sensitive finance' },
    { role: 'member', title: 'Church Member', desc: 'Congregant access: strictly view personal portal, tithes, attendance, & prayers only' },
  ];

  const modules = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'members', label: 'Members Registry' },
    { id: 'visitors', label: 'Visitors & Follow-up' },
    { id: 'attendance', label: 'Attendance & Check-in' },
    { id: 'finance', label: 'Finance & Giving (GH₵)' },
    { id: 'pledges', label: 'Pledge Campaigns' },
    { id: 'pastoral_care', label: 'Pastoral Care & Prayers' },
    { id: 'communication', label: 'Bulk SMS & WhatsApp' },
    { id: 'reports', label: 'Reports & Exports' },
    { id: 'users', label: 'Users & Roles' },
    { id: 'settings', label: 'Settings & Supabase' },
    { id: 'audit_logs', label: 'Audit Trail Logs' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-700" />
            Users & Role-Based Access Control (RBAC)
          </h1>
          <p className="text-xs text-slate-500">
            Greater Works City Church system privileges and administrative credentials
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs bg-indigo-50 text-indigo-800 font-bold px-3 py-1.5 rounded-xl border border-indigo-200">
            Current Session Role: {currentRole.replace('_', ' ').toUpperCase()}
          </span>
        </div>
      </div>

      {/* Quick Interactive Staff Switcher */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-600" />
            Staff Accounts Directory (Click to Switch Current Session)
          </h3>
          <span className="text-xs text-slate-400">8 Pre-configured Staff Profiles</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {availableUsers.map((u) => {
            const isCurrent = u.id === currentUser.id;
            return (
              <div
                key={u.id}
                onClick={() => {
                  switchUser(u.id);
                  setSelectedUser(u);
                }}
                className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center gap-3 ${
                  isCurrent
                    ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-indigo-300 bg-white'
                }`}
              >
                {u.avatar_url ? (
                  <img
                    src={u.avatar_url}
                    alt={u.first_name}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center text-xs">
                    {u.first_name[0]}
                    {u.last_name[0]}
                  </div>
                )}
                <div className="truncate">
                  <p className="font-bold text-xs text-slate-900 truncate">
                    {u.first_name} {u.last_name}
                  </p>
                  <p className="text-[10px] font-semibold text-indigo-700 capitalize">
                    {u.role.replace('_', ' ')}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RBAC Permissions Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Role Permissions Matrix
            </h3>
            <p className="text-xs text-slate-500">
              Granular access control defined for each ministry and administrative rank
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">Row Level Security (RLS) Enforced</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">System Module</th>
                {rolesList.map((r) => (
                  <th key={r.role} className="py-3 px-3 text-center">
                    <span className="block">{r.title}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {modules.map((mod) => (
                <tr key={mod.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-bold text-slate-800">{mod.label}</td>
                  {rolesList.map((r) => {
                    const allowedModules = ROLE_PERMISSIONS[r.role] || [];
                    const hasAccess = allowedModules.includes(mod.id);
                    return (
                      <td key={r.role} className="py-3 px-3 text-center">
                        {hasAccess ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-800">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400">
                            <X className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
