import React, { useState } from 'react';
import {
  X,
  Mail,
  Phone,
  Building,
  Shield,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Key,
  Edit2,
  Eye,
  Printer,
  Calendar,
  User,
  Briefcase,
  AlertTriangle,
  Info,
  Check,
} from 'lucide-react';
import { UserProfile, UserRole } from '../../types/database.types';
import { ROLE_PERMISSIONS, isElishaRichard } from '../../contexts/AuthContext';

interface StaffDossierModalProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (user: UserProfile) => void;
  onResetPassword: (user: UserProfile) => void;
  onToggleStatus: (user: UserProfile) => void;
  onSimulateAccess?: (user: UserProfile) => void;
  isSuperAdmin: boolean;
  currentUserId: string;
}

export const StaffDossierModal: React.FC<StaffDossierModalProps> = ({
  user,
  isOpen,
  onClose,
  onEdit,
  onResetPassword,
  onToggleStatus,
  onSimulateAccess,
  isSuperAdmin,
  currentUserId,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'permissions' | 'audit'>('overview');

  if (!isOpen) return null;

  const isCurrent = user.id === currentUserId;
  const isProtectedRoot = isElishaRichard(user);
  const hasLogin = user.has_login_account !== false;

  const formatEmploymentType = (type?: string) => {
    switch (type) {
      case 'full_time':
        return 'Full-Time Staff';
      case 'part_time':
        return 'Part-Time Staff';
      case 'volunteer':
        return 'Ministerial Volunteer';
      case 'contract':
        return 'Contractor / External';
      default:
        return 'Appointed Staff';
    }
  };

  const getRoleCategory = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return { label: 'Executive Leadership', color: 'bg-purple-100 text-purple-900 border-purple-200' };
      case 'senior_pastor':
      case 'pastor':
        return { label: 'Pastoral Directorate', color: 'bg-indigo-100 text-indigo-900 border-indigo-200' };
      case 'administrator':
      case 'finance_officer':
      case 'data_entry':
        return { label: 'Church Administration', color: 'bg-blue-100 text-blue-900 border-blue-200' };
      case 'ministry_leader':
      case 'attendance_officer':
        return { label: 'Ministry & Protocol', color: 'bg-teal-100 text-teal-900 border-teal-200' };
      default:
        return { label: 'Congregant Portal', color: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
  };

  const roleCat = getRoleCategory(user.role);
  const allowedModules = user.role === 'super_admin' ? [
    'dashboard', 'members', 'visitors', 'attendance', 'services', 'finance', 'welfare',
    'giving', 'pledges', 'ministries', 'small_groups', 'events', 'pastoral_care',
    'prayer_requests', 'communication', 'reports', 'users', 'settings', 'audit_logs'
  ] : (ROLE_PERMISSIONS[user.role] || []);

  const moduleLabels: Record<string, string> = {
    dashboard: 'Executive Dashboard & Metrics',
    members: 'Congregational Membership Directory',
    visitors: 'Visitors Assimilation & First-Timers',
    attendance: 'Service Registers & Headcounts',
    services: 'Service Planning & Duty Rosters',
    finance: 'Church Treasury & Bank Disbursements',
    welfare: 'Welfare & Benevolence Relief',
    giving: 'Member Giving & Tithe Ledger',
    pledges: 'Sanctuary & Building Campaigns',
    ministries: 'Departments & Ministries Coordination',
    small_groups: 'Home Cell Groups & Fellowships',
    events: 'Church Calendar & Special Events',
    pastoral_care: 'Pastoral Counseling & Home Visitations',
    prayer_requests: 'Intercessory Prayer Records',
    communication: 'Bulk SMS & WhatsApp Broadcasts',
    reports: 'Financial & Operational PDF Reports',
    users: 'Staff Directory & Access Control (RBAC)',
    settings: 'System Configuration & Cloud Database',
    audit_logs: 'Immutable Security Audit Trail',
  };

  const handlePrintDossier = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 animate-fade-in my-8 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
            title="Close dossier"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div className="relative shrink-0">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={`${user.first_name} ${user.last_name}`}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-white/20 shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-indigo-800 text-white font-bold flex items-center justify-center text-2xl border-2 border-white/20 shadow-lg">
                  {user.first_name?.[0] || 'U'}
                  {user.last_name?.[0] || ''}
                </div>
              )}
              <span
                className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-slate-900 flex items-center justify-center text-[10px] ${
                  user.is_active ? 'bg-emerald-500 text-white' : 'bg-slate-500 text-white'
                }`}
                title={user.is_active ? 'Active Profile' : 'Suspended Profile'}
              >
                {user.is_active ? '✓' : '—'}
              </span>
            </div>

            <div className="text-center sm:text-left space-y-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">
                  {user.first_name} {user.last_name}
                </h2>
                {isCurrent && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/40">
                    Your Session
                  </span>
                )}
                {isProtectedRoot && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-200 border border-amber-400/40">
                    Root Protected
                  </span>
                )}
              </div>

              {user.job_title ? (
                <p className="text-sm font-semibold text-indigo-300">
                  {user.job_title}
                </p>
              ) : (
                <p className="text-xs text-slate-400 italic">No formal ministry title assigned</p>
              )}

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-slate-300 pt-1">
                <span className="flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-indigo-400" />
                  {user.department || 'General Ministry'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                  {formatEmploymentType(user.employment_type)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-200 bg-slate-50/50 shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Staff Overview & Bio
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'permissions'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            RBAC Access & Privileges
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700 flex-1">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Account Status Alert Banner */}
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                  user.is_active
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50/60 border-rose-200 text-rose-950'
                }`}
              >
                {user.is_active ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <p className="font-bold">
                    {user.is_active ? 'Active Staff Account' : 'Suspended Account (Login Blocked)'}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    {user.is_active
                      ? hasLogin
                        ? 'This staff member is fully authorized to log into the church management back-office according to their role permissions.'
                        : 'This staff member is recorded in the directory. System login credentials are not enabled for this record.'
                      : 'This staff account has been suspended. Back-office login and API actions are revoked while historical records remain attributable.'}
                  </p>
                </div>
              </div>

              {/* Staff Bio & Contact Information Grid */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  Biographical & Contact Details
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Official Email</span>
                    <p className="font-semibold text-slate-900 flex items-center gap-1.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {user.email || '—'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Telephone / WhatsApp</span>
                    <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {user.phone || '—'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Department / Directorate</span>
                    <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {user.department || 'General Administration'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Employment Status</span>
                    <p className="font-semibold text-slate-900">
                      {formatEmploymentType(user.employment_type)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Staff Record ID</span>
                    <p className="font-mono text-[11px] text-slate-600">
                      {user.id}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">System Enrollment Date</span>
                    <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Established'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Login Account Details */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-indigo-600" />
                  Credentials & Back-Office Access
                </h3>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800">
                        {hasLogin ? 'Back-Office Login Enabled' : 'Directory-Only Record (No Login)'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {hasLogin
                          ? `Authenticates via email: ${user.email}`
                          : 'This profile is retained for church organizational records without login credentials.'}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        hasLogin
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : 'bg-slate-200 text-slate-700 border-slate-300'
                      }`}
                    >
                      {hasLogin ? 'Login Enabled' : 'Directory Only'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RBAC PERMISSIONS */}
          {activeTab === 'permissions' && (
            <div className="space-y-5">
              {/* Architecture Principle Note */}
              <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                <div className="text-[11px] text-indigo-950 space-y-1">
                  <p className="font-bold">
                    Separation of Ecclesiastical Title & System Security Role
                  </p>
                  <p>
                    In Greater Works City Church, a staff member's <strong>Ministry Title</strong> (e.g. &ldquo;{user.job_title || 'Appointed Leader'}&rdquo;) defines their pastoral or ministerial office. Their <strong>System Security Role</strong> (e.g. &ldquo;{user.role.replace('_', ' ').toUpperCase()}&rdquo;) controls data boundaries, financial ledger access, and operational permissions.
                  </p>
                </div>
              </div>

              {/* Role Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                    <div>
                      <p className="font-bold text-sm text-slate-900">
                        {user.role.replace('_', ' ').toUpperCase()}
                      </p>
                      <p className="text-[10px] text-slate-500">Effective Application Permission Role</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${roleCat.color}`}>
                    {roleCat.label}
                  </span>
                </div>
              </div>

              {/* Accessible Modules Grid */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center justify-between">
                  <span>Authorized Subsystems ({allowedModules.length})</span>
                  <span className="text-[10px] font-normal text-slate-400">Strictly enforced at route and data levels</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(moduleLabels).map(([modId, modLabel]) => {
                    const isAllowed = user.role === 'super_admin' || allowedModules.includes(modId);
                    return (
                      <div
                        key={modId}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                          isAllowed
                            ? 'bg-emerald-50/40 border-emerald-200 text-slate-900'
                            : 'bg-slate-50/60 border-slate-200 text-slate-400'
                        }`}
                      >
                        <span className="font-medium truncate pr-2">{modLabel}</span>
                        {isAllowed ? (
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3" />
                          </span>
                        ) : (
                          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center shrink-0">
                            <X className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintDossier}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              title="Print official staff dossier card"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Dossier</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Simulate button for super admin */}
            {isSuperAdmin && !isProtectedRoot && user.role !== 'super_admin' && onSimulateAccess && (
              <button
                onClick={() => {
                  onClose();
                  onSimulateAccess(user);
                }}
                disabled={isCurrent}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shadow-2xs ${
                  isCurrent
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 cursor-pointer'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Simulate Access</span>
              </button>
            )}

            {/* Reset Password button if login enabled */}
            {hasLogin && (
              <button
                onClick={() => {
                  onClose();
                  onResetPassword(user);
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Reset Credentials</span>
              </button>
            )}

            {/* Toggle Status Button */}
            {!isProtectedRoot && !isCurrent && (
              <button
                onClick={() => {
                  onClose();
                  onToggleStatus(user);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  user.is_active
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{user.is_active ? 'Suspend Account' : 'Activate Account'}</span>
              </button>
            )}

            {/* Edit button */}
            <button
              onClick={() => {
                onClose();
                onEdit(user);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Profile & Role</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
