import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Plus,
  Check,
  X,
  User,
  Shield,
  KeyRound,
  AlertCircle,
  Search,
  Filter,
  Edit2,
  Trash2,
  Key,
  Eye,
  ArrowRight,
  Lock,
  CheckCircle2,
  Phone,
  Mail,
  Building,
  Users,
  Copy,
  Info,
  LayoutGrid,
  List,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { useAuth, ROLE_PERMISSIONS } from '../contexts/AuthContext';
import { useChurchData } from '../contexts/ChurchDataContext';
import { UserRole, UserProfile } from '../types/database.types';

export const UsersPage: React.FC = () => {
  const {
    availableUsers,
    currentRole,
    currentUser,
    impersonatingAdmin,
    startSimulation,
    createUser,
    updateUser,
    deleteUser,
    toggleUserStatus,
    resetPassword,
  } = useAuth();

  const { logAction } = useChurchData();

  const isSuperAdmin = currentUser.role === 'super_admin' || impersonatingAdmin?.role === 'super_admin';

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<'directory' | 'matrix' | 'roles_guide'>('directory');

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [moduleSearch, setModuleSearch] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [resetModalUser, setResetModalUser] = useState<UserProfile | null>(null);
  const [switchTargetUser, setSwitchTargetUser] = useState<UserProfile | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  // New User Form State
  const [newUserForm, setNewUserForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department: 'Church Administration',
    role: 'administrator' as UserRole,
    password: '',
  });

  // Edit User Form State
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department: '',
    role: 'administrator' as UserRole,
    is_active: true,
  });

  // Temporary password state for Reset Modal
  const [tempPassword, setTempPassword] = useState('');

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const rolesList: {
    role: UserRole;
    title: string;
    desc: string;
    category: 'Executive' | 'Pastoral' | 'Administrative' | 'Ministry' | 'Member';
    badgeColor: string;
    typicalHolders: string;
    keyPrivileges: string[];
    boundaries: string;
  }[] = [
    {
      role: 'super_admin',
      title: 'Super Admin',
      desc: 'Full system control, database access, user management, audit logs, and security enforcement',
      category: 'Executive',
      badgeColor: 'bg-purple-100 text-purple-900 border-purple-200',
      typicalHolders: 'Prophet Elisha K. Richard (General Overseer & Senior Pastor), IT Director, Senior Pastoral Board',
      keyPrivileges: [
        'Full read/write on every church module',
        'Staff account creation, role assignment, and suspension',
        'Supabase cloud migration and database keys management',
        'Access to full immutable Audit Trail Logs',
      ],
      boundaries: 'Unrestricted full access across all operational and financial records.',
    },
    {
      role: 'senior_pastor',
      title: 'Senior Pastor',
      desc: 'General Overseer pastoral oversight, confidential member records, treasury review, giving, and reports',
      category: 'Pastoral',
      badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-200',
      typicalHolders: 'Resident Associate Pastor, Pastoral Board Member, District Overseer',
      keyPrivileges: [
        'Congregational health & attendance analytics',
        'Pastoral care counseling, visitation logs, and prayer requests',
        'View church tithes, offerings, expenditure summaries, and pledge progress',
        'Broadcast communications (Bulk SMS & WhatsApp blessings)',
      ],
      boundaries: 'Excluded only from backend raw database key configuration.',
    },
    {
      role: 'administrator',
      title: 'Administrator',
      desc: 'Daily church operations, membership registers, visitor follow-up, schedules, and official notices',
      category: 'Administrative',
      badgeColor: 'bg-blue-100 text-blue-900 border-blue-200',
      typicalHolders: 'Head Church Administrator (e.g. Clara Gaewornu), Secretariat Staff',
      keyPrivileges: [
        'Member registry updates and visitor conversion pipelines',
        'Service schedule planning and duty roster management',
        'Bulk SMS and WhatsApp announcements',
        'Foundation School discipleship cohort management',
      ],
      boundaries: 'Restricted from confidential finance/treasury bank disbursements.',
    },
    {
      role: 'finance_officer',
      title: 'Finance Officer',
      desc: 'Treasury oversight, tithes, Sunday offerings tally, welfare disbursement, vouchers, and GRA compliance',
      category: 'Administrative',
      badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-200',
      typicalHolders: 'Church Treasurer, Financial Secretary, Head of Finance Committee',
      keyPrivileges: [
        'Cash and Mobile Money tithe & offering batch entry',
        'Pledge campaign recording and fulfillment tracking',
        'Expenditure vouchers and operational cash outflows in GH₵',
        'Financial audit statements and PDF ledger generation',
      ],
      boundaries: 'Read-only access on member registry (for donor linking only); no access to pastoral counseling.',
    },
    {
      role: 'pastor',
      title: 'Associate Pastor',
      desc: 'Pastoral care, counseling sessions, home visitations, hospital visits, intercessory watch, and visitor care',
      category: 'Pastoral',
      badgeColor: 'bg-amber-100 text-amber-900 border-amber-200',
      typicalHolders: 'Associate Pastors, Youth Pastor, Pastoral Assistants (e.g. Pastor Emmanuel Osei)',
      keyPrivileges: [
        'Pastoral counseling records and confidential spiritual notes',
        'Pastoral visitation schedules and home touchpoints',
        'Prayer requests intercession and tracking',
        'Visitor evangelism follow-up notes',
      ],
      boundaries: 'No access to financial ledger balances, expenditure approvals, or database settings.',
    },
    {
      role: 'ministry_leader',
      title: 'Ministry Leader',
      desc: 'Departmental coordination, choir, protocol, youth, men, women, small groups, and duty roster view',
      category: 'Ministry',
      badgeColor: 'bg-teal-100 text-teal-900 border-teal-200',
      typicalHolders: 'Choir Director, Youth Fellowship President, Women’s Ministry Leader',
      keyPrivileges: [
        'Department roster duty scheduling',
        'Small group fellowship attendance tracking',
        'Department-specific member directory viewing',
        'Targeted departmental SMS broadcast creation',
      ],
      boundaries: 'Strictly limited to department functions; cannot view tithes, pledges, or church-wide audit logs.',
    },
    {
      role: 'attendance_officer',
      title: 'Attendance Officer',
      desc: 'Usher headcount tallying, auditorium section counters, QR code check-ins, and service registers',
      category: 'Ministry',
      badgeColor: 'bg-orange-100 text-orange-900 border-orange-200',
      typicalHolders: 'Chief Usher, Protocol Lead, Service Tally Officers',
      keyPrivileges: [
        'Auditorium headcount counters (Men, Women, Youth, Children, Visitors)',
        'Check-in scanner operations and barcode/QR verification',
        'Service attendance register logging',
      ],
      boundaries: 'No access to finance, confidential pastoral counseling, or system settings.',
    },
    {
      role: 'data_entry',
      title: 'Data Entry Clerk',
      desc: 'Basic records entry, digitizing paper forms, Sunday attendance tallies, and visitor cards',
      category: 'Administrative',
      badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
      typicalHolders: 'Church Office Interns, Volunteer Secretariat Clerks',
      keyPrivileges: [
        'Create and update member profile biographical details',
        'Record paper visitor cards and evangelism contact sheets',
        'Input preliminary headcount numbers for supervisor verification',
      ],
      boundaries: 'Read-only or restricted access on finance, pastoral care, settings, and audit logs.',
    },
    {
      role: 'member',
      title: 'Church Member',
      desc: 'Congregant access: strictly view personal portal, tithes, attendance history, family, and prayer requests',
      category: 'Member',
      badgeColor: 'bg-cyan-100 text-cyan-900 border-cyan-200',
      typicalHolders: 'Registered Greater Works City Church Congregants',
      keyPrivileges: [
        'Personal Member Portal dashboard',
        'Personal tithe & offering giving statement download',
        'Self-service check-in barcode & prayer request submission',
        'Family household profile view',
      ],
      boundaries: 'Strictly sandboxed to personal data; zero access to staff modules or other members’ records.',
    },
  ];

  const modules = [
    { id: 'dashboard', label: 'Executive Dashboard', desc: 'Overview metrics, charts, upcoming services' },
    { id: 'members', label: 'Members Registry', desc: 'Congregational directory, bio-data, families' },
    { id: 'visitors', label: 'Visitors & Follow-up', desc: 'First-timer tracking, evangelism touches' },
    { id: 'attendance', label: 'Attendance & Headcounts', desc: 'Service registers, usher tallies, check-in' },
    { id: 'finance', label: 'Finance & Giving (GH₵)', desc: 'Tithes, Sunday offerings, treasury expenses' },
    { id: 'pledges', label: 'Pledge Campaigns', desc: 'Building fund & sanctuary project pledges' },
    { id: 'pastoral_care', label: 'Pastoral Care & Prayers', desc: 'Counseling logs, home visitations, prayers' },
    { id: 'communication', label: 'Bulk SMS & WhatsApp', desc: 'Broadcast radar, birthday greetings, SMS' },
    { id: 'reports', label: 'Reports & Archival Exports', desc: 'Formal PDF registers and financial statements' },
    { id: 'users', label: 'Users & Roles (RBAC)', desc: 'Staff credentials and system access permissions' },
    { id: 'settings', label: 'Settings & Supabase Sync', desc: 'Church profile, currency, cloud sync parameters' },
    { id: 'audit_logs', label: 'Audit Trail Logs', desc: 'Immutable security log of modifications' },
  ];

  // Derive unique departments from existing users
  const departments = useMemo(() => {
    const deps = new Set<string>();
    availableUsers.forEach((u) => {
      if (u.department) deps.add(u.department);
    });
    return Array.from(deps).sort();
  }, [availableUsers]);

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return availableUsers.filter((u) => {
      if (!u) return false;
      const query = (searchQuery || '').trim().toLowerCase();
      const firstName = u.first_name || '';
      const lastName = u.last_name || '';
      const email = u.email || '';
      const phone = u.phone || '';
      const department = u.department || '';
      const roleStr = String(u.role || '');

      const matchesSearch =
        !query ||
        `${firstName} ${lastName}`.toLowerCase().includes(query) ||
        email.toLowerCase().includes(query) ||
        phone.toLowerCase().includes(query) ||
        department.toLowerCase().includes(query) ||
        roleStr.toLowerCase().includes(query);

      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && Boolean(u.is_active)) ||
        (statusFilter === 'inactive' && !u.is_active);
      const matchesDepartment = departmentFilter === 'all' || u.department === departmentFilter;

      return matchesSearch && matchesRole && matchesStatus && matchesDepartment;
    });
  }, [availableUsers, searchQuery, roleFilter, statusFilter, departmentFilter]);

  // Summary Metrics
  const stats = useMemo(() => {
    const total = availableUsers.length;
    const active = availableUsers.filter((u) => u && u.is_active).length;
    const pastoral = availableUsers.filter((u) => u && (u.role === 'senior_pastor' || u.role === 'pastor')).length;
    const finance = availableUsers.filter((u) => u && u.role === 'finance_officer').length;
    const admins = availableUsers.filter((u) => u && (u.role === 'super_admin' || u.role === 'administrator')).length;
    return { total, active, pastoral, finance, admins };
  }, [availableUsers]);

  // Filtered modules for permissions matrix
  const filteredModules = useMemo(() => {
    if (!moduleSearch || !moduleSearch.trim()) return modules;
    const q = moduleSearch.toLowerCase();
    return modules.filter((m) => (m.label || '').toLowerCase().includes(q) || (m.desc || '').toLowerCase().includes(q));
  }, [modules, moduleSearch]);

  // Handle Add New User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.first_name.trim() || !newUserForm.last_name.trim() || !newUserForm.email.trim()) {
      showToast('Please provide first name, last name, and email address.', 'error');
      return;
    }

    const defaultPwd = newUserForm.password.trim() || 'Gwcc@2026';
    const result = await createUser({
      first_name: newUserForm.first_name.trim(),
      last_name: newUserForm.last_name.trim(),
      email: newUserForm.email.trim(),
      phone: newUserForm.phone.trim() || undefined,
      department: newUserForm.department.trim() || 'General Operations',
      role: newUserForm.role,
      password: defaultPwd,
    });

    if (result.success) {
      logAction(
        'CREATE_STAFF_USER',
        'Users & Roles',
        `Created staff account for ${newUserForm.first_name} ${newUserForm.last_name} with role ${newUserForm.role}`
      );
      showToast(`Staff account for ${newUserForm.first_name} created successfully!`, 'success');
      setIsAddModalOpen(false);
      setNewUserForm({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        department: 'Church Administration',
        role: 'administrator',
        password: '',
      });
    } else {
      showToast(result.message, 'error');
    }
  };

  // Open Edit User Modal
  const openEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setEditForm({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone || '',
      department: user.department || 'Church Administration',
      role: user.role,
      is_active: user.is_active,
    });
  };

  // Handle Save Edit User
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    updateUser(editingUser.id, {
      first_name: editForm.first_name.trim(),
      last_name: editForm.last_name.trim(),
      phone: editForm.phone.trim() || undefined,
      department: editForm.department.trim(),
      role: editForm.role,
      is_active: editForm.is_active,
    });

    logAction(
      'UPDATE_STAFF_USER',
      'Users & Roles',
      `Updated user ${editForm.first_name} ${editForm.last_name} (Role: ${editForm.role}, Active: ${editForm.is_active})`,
      editingUser.id
    );

    showToast(`Updated user profile for ${editForm.first_name} ${editForm.last_name}`, 'success');
    setEditingUser(null);
  };

  // Open Password Reset Modal
  const openResetModal = (user: UserProfile) => {
    setResetModalUser(user);
    const generated = `Gwcc@${Math.floor(1000 + Math.random() * 9000)}`;
    setTempPassword(generated);
  };

  // Confirm Password Reset
  const handleConfirmReset = async () => {
    if (!resetModalUser) return;
    await resetPassword(resetModalUser.email);
    logAction(
      'RESET_STAFF_PASSWORD',
      'Users & Roles',
      `Dispatched password reset instructions for ${resetModalUser.email}`,
      resetModalUser.id
    );
    showToast(`Dispatched password reset credentials for ${resetModalUser.email}`, 'success');
    setResetModalUser(null);
  };

  // Handle Delete User
  const handleDeleteUser = (user: UserProfile) => {
    if (user.id === currentUser.id) {
      showToast('Cannot delete the currently active logged-in user profile.', 'error');
      return;
    }

    if (confirm(`Are you sure you want to remove ${user.first_name} ${user.last_name} (${user.email}) from the staff registry?`)) {
      const ok = deleteUser(user.id);
      if (ok) {
        logAction('DELETE_STAFF_USER', 'Users & Roles', `Removed staff account ${user.email}`, user.id);
        showToast(`Staff account for ${user.first_name} was removed.`, 'info');
      } else {
        showToast('Failed to delete staff user.', 'error');
      }
    }
  };

  // Handle Authorized Super Admin View Simulation
  const handleConfirmSwitch = (target: UserProfile) => {
    if (target.role === 'super_admin') {
      showToast('Security Alert: Super Administrator accounts are protected and cannot be simulated.', 'error');
      setSwitchTargetUser(null);
      return;
    }
    const ok = startSimulation(target.id);
    if (ok) {
      logAction(
        'START_SIMULATION',
        'Security',
        `Super admin initiated view simulation as ${target.first_name} ${target.last_name} (${target.role})`,
        target.id
      );
      showToast(`Now simulating system view as ${target.first_name} ${target.last_name} (${target.role.replace('_', ' ').toUpperCase()})`, 'info');
    } else {
      showToast('Unauthorized: Only Super Administrators can simulate user sessions.', 'error');
    }
    setSwitchTargetUser(null);
  };

  const getRoleBadge = (role: UserRole) => {
    const meta = rolesList.find((r) => r.role === role);
    const colorClass = meta?.badgeColor || 'bg-slate-100 text-slate-800 border-slate-200';
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClass}`}>
        <Shield className="w-3 h-3" />
        {meta?.title || role.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm animate-fade-in ${
            toastMessage.type === 'success'
              ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
              : toastMessage.type === 'error'
              ? 'bg-rose-900 text-rose-100 border-rose-700'
              : 'bg-indigo-900 text-indigo-100 border-indigo-700'
          }`}
        >
          <Info className="w-4 h-4 shrink-0" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Users & Role-Based Access Control (RBAC)
              </h1>
              <p className="text-xs text-slate-500">
                Greater Works City Church credentials, staff permissions matrix, and administrative security
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <span className="text-slate-500">Active Session:</span>
            <span className="font-bold text-slate-800">
              {currentUser.first_name} {currentUser.last_name}
            </span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800">
              {currentRole.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Staff User
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium">Total Staff</p>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-xl font-bold text-slate-900 mt-1">{stats.total}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Configured Profiles</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium">Active Accounts</p>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-bold text-emerald-700 mt-1">{stats.active}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Authorized for login</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium">Pastoral Leaders</p>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-bold text-slate-900 mt-1">{stats.pastoral}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Prophet & Pastors</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium">Finance Officers</p>
            <Lock className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-bold text-slate-900 mt-1">{stats.finance}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Treasury & Auditing</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium">System Admins</p>
            <ShieldCheck className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-xl font-bold text-slate-900 mt-1">{stats.admins}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Super & Church Admin</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('directory')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'directory'
              ? 'bg-indigo-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          Staff Directory ({availableUsers.length})
        </button>

        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'matrix'
              ? 'bg-indigo-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Shield className="w-4 h-4" />
          RBAC Permissions Matrix
        </button>

        <button
          onClick={() => setActiveTab('roles_guide')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'roles_guide'
              ? 'bg-indigo-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Info className="w-4 h-4" />
          Role Capabilities Guide (9 Roles)
        </button>
      </div>

      {/* TAB 1: STAFF DIRECTORY */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, department, phone, or role..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-2 text-slate-400 hover:text-slate-600 text-xs rounded-lg hover:bg-slate-100"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Role filter */}
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="text-xs px-2.5 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700"
                >
                  <option value="all">All Roles</option>
                  {rolesList.map((r) => (
                    <option key={r.role} value={r.role}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Department filter */}
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="text-xs px-2.5 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs px-2.5 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700"
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>

              {/* View mode toggle */}
              <div className="flex items-center rounded-xl border border-slate-200 p-0.5 bg-slate-50">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition ${
                    viewMode === 'grid' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-400 hover:text-slate-600'
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg transition ${
                    viewMode === 'table' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-400 hover:text-slate-600'
                  }`}
                  title="Table View"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* User Count Indicator */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Showing {filteredUsers.length} of {availableUsers.length} staff accounts
            </span>
            <span className="text-[11px] text-slate-500 italic">
              {isSuperAdmin
                ? 'Tip: Super Admins can click "Test Access" to simulate staff role boundaries. Super Admin accounts are root-protected.'
                : 'Role access boundaries are strictly enforced. Contact Super Admin for privilege modifications.'}
            </span>
          </div>

          {/* Empty State */}
          {filteredUsers.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <User className="w-6 h-6" />
              </div>
              <p className="font-bold text-slate-800 text-sm">No staff accounts match your filters</p>
              <p className="text-xs text-slate-500">Try adjusting your search terms or clearing your role and status filters.</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setRoleFilter('all');
                  setStatusFilter('all');
                  setDepartmentFilter('all');
                }}
                className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition"
              >
                Reset Filters
              </button>
            </div>
          )}

          {/* GRID VIEW */}
          {viewMode === 'grid' && filteredUsers.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredUsers.map((u) => {
                const isCurrent = u.id === currentUser.id;
                return (
                  <div
                    key={u.id}
                    className={`bg-white rounded-2xl border p-4.5 transition flex flex-col justify-between space-y-3.5 relative ${
                      isCurrent
                        ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    {/* Top Row: Avatar & Badges */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {u.avatar_url ? (
                            <img
                              src={u.avatar_url}
                              alt={u.first_name || 'Staff'}
                              className="w-11 h-11 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center text-sm">
                              {u.first_name?.[0] || 'U'}
                              {u.last_name?.[0] || ''}
                            </div>
                          )}
                          <span
                            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                              u.is_active ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                            title={u.is_active ? 'Account Active' : 'Account Inactive'}
                          />
                        </div>

                        <div className="truncate">
                          <p className="font-bold text-sm text-slate-900 truncate">
                            {u.first_name} {u.last_name}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                            <Building className="w-3 h-3 text-slate-400 shrink-0" />
                            {u.department || 'General Ministry'}
                          </p>
                        </div>
                      </div>

                      {isCurrent && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-700 text-white shrink-0">
                          Active
                        </span>
                      )}
                    </div>

                    {/* Middle: Role & Contact */}
                    <div className="space-y-2 pt-1 border-t border-slate-100">
                      <div>{getRoleBadge(u.role)}</div>

                      <div className="space-y-1 text-xs text-slate-600">
                        <p className="flex items-center gap-1.5 truncate text-[11px] text-slate-500">
                          <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{u.email}</span>
                        </p>
                        {u.phone && (
                          <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{u.phone}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bottom: Action buttons */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Edit User & Permissions"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => openResetModal(u)}
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                          title="Reset Password / Credentials"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => toggleUserStatus(u.id)}
                          className={`p-1.5 rounded-lg transition ${
                            u.is_active
                              ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={u.is_active ? 'Suspend Account' : 'Activate Account'}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </button>

                        {u.id !== currentUser.id && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Access Simulation: restricted to Super Admin; Super Admin accounts cannot be simulated */}
                      {isSuperAdmin && u.role !== 'super_admin' && (
                        <button
                          onClick={() => setSwitchTargetUser(u)}
                          disabled={isCurrent}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                            isCurrent
                              ? 'bg-slate-100 text-slate-400 cursor-default'
                              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 cursor-pointer'
                          }`}
                        >
                          <Eye className="w-3 h-3" />
                          {isCurrent ? 'Current' : 'Test Access'}
                        </button>
                      )}
                      {u.role === 'super_admin' && (
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg" title="Root administrator accounts cannot be simulated">
                          Protected Root
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TABLE VIEW */}
          {viewMode === 'table' && filteredUsers.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-3">Role</th>
                      <th className="py-3 px-3">Department</th>
                      <th className="py-3 px-3">Contact</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((u) => {
                      const isCurrent = u.id === currentUser.id;
                      return (
                        <tr key={u.id} className={`hover:bg-slate-50/80 ${isCurrent ? 'bg-indigo-50/30' : ''}`}>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              {u.avatar_url ? (
                                <img
                                  src={u.avatar_url}
                                  alt={u.first_name || 'Staff'}
                                  className="w-8 h-8 rounded-full object-cover border border-slate-200"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center text-xs">
                                  {u.first_name?.[0] || 'U'}
                                  {u.last_name?.[0] || ''}
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-slate-900 flex items-center gap-1.5">
                                  {u.first_name} {u.last_name}
                                  {isCurrent && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-600 text-white">
                                      Active Session
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] text-slate-400">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">{getRoleBadge(u.role)}</td>
                          <td className="py-3 px-3 text-slate-700 font-medium">{u.department || '—'}</td>
                          <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">{u.phone || '—'}</td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {u.is_active ? 'Active' : 'Suspended'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openEditModal(u)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                title="Edit Role & Details"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => openResetModal(u)}
                                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                                title="Reset Password"
                              >
                                <Key className="w-3.5 h-3.5" />
                              </button>
                              {isSuperAdmin && u.role !== 'super_admin' && (
                                <button
                                  onClick={() => setSwitchTargetUser(u)}
                                  disabled={isCurrent}
                                  className={`text-[11px] font-bold px-2 py-1 rounded-lg transition ${
                                    isCurrent
                                      ? 'bg-slate-100 text-slate-400 cursor-default'
                                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 cursor-pointer'
                                  }`}
                                >
                                  {isCurrent ? 'Current' : 'Simulate'}
                                </button>
                              )}
                              {u.role === 'super_admin' && (
                                <span className="text-[10px] font-semibold text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                                  Root
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RBAC PERMISSIONS MATRIX */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  Granular Module Permission Matrix
                </h3>
                <p className="text-xs text-slate-500">
                  Defines exactly which church ministries and administrative ranks can access, record, or view each subsystem.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={moduleSearch}
                    onChange={(e) => setModuleSearch(e.target.value)}
                    placeholder="Search modules..."
                    className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
            </div>

            {/* Visual Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-700">Legend:</span>
              <div className="flex items-center gap-1.5 text-emerald-800">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100">
                  <Check className="w-3 h-3 text-emerald-700" />
                </span>
                <span>Authorized (Access Granted)</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-200">
                  <X className="w-3 h-3 text-slate-400" />
                </span>
                <span>Restricted (Access Denied)</span>
              </div>
              <div className="flex items-center gap-1.5 text-indigo-700 ml-auto font-medium">
                <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block" />
                <span>Column highlighted = Your Active Session Role ({currentRole.replace('_', ' ').toUpperCase()})</span>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-[11px] uppercase tracking-wider text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4 sticky left-0 bg-slate-100 z-10 w-64">System Module</th>
                    {rolesList.map((r) => {
                      const isCurrentRole = r.role === currentRole;
                      return (
                        <th
                          key={r.role}
                          className={`py-3 px-2.5 text-center min-w-[100px] ${
                            isCurrentRole ? 'bg-indigo-50/80 text-indigo-900 font-black' : ''
                          }`}
                        >
                          <span className="block text-slate-900">{r.title}</span>
                          <span className="text-[9px] font-normal text-slate-500 normal-case">{r.category}</span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredModules.map((mod) => (
                    <tr key={mod.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-bold text-slate-900 sticky left-0 bg-white">
                        <div>
                          <p>{mod.label}</p>
                          <p className="text-[10px] text-slate-400 font-normal">{mod.desc}</p>
                        </div>
                      </td>
                      {rolesList.map((r) => {
                        const isCurrentRole = r.role === currentRole;
                        const allowedModules = ROLE_PERMISSIONS[r.role] || [];
                        const hasAccess = r.role === 'super_admin' || allowedModules.includes(mod.id);
                        return (
                          <td
                            key={r.role}
                            className={`py-3 px-2 text-center ${isCurrentRole ? 'bg-indigo-50/40' : ''}`}
                          >
                            {hasAccess ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 shadow-2xs">
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
      )}

      {/* TAB 3: ROLE CAPABILITIES GUIDE */}
      {activeTab === 'roles_guide' && (
        <div className="space-y-4">
          <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl flex items-start gap-3">
            <Info className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-950 space-y-1">
              <p className="font-bold text-sm">Greater Works City Church Governance Model</p>
              <p>
                Access rights reflect biblical stewardship, pastoral confidentiality, and financial dual-control.
                Pastoral notes are strictly restricted to the Pastoral Council, while treasury disbursements require
                Finance Officer approval. All role adjustments are recorded in the permanent audit trail.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rolesList.map((r) => {
              const isCurrent = r.role === currentRole;
              const assignedCount = availableUsers.filter((u) => u.role === r.role).length;
              return (
                <div
                  key={r.role}
                  className={`bg-white rounded-2xl border p-5 space-y-3.5 flex flex-col justify-between ${
                    isCurrent ? 'border-indigo-600 ring-2 ring-indigo-500/20' : 'border-slate-200'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${r.badgeColor}`}>
                        {r.title}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {assignedCount} {assignedCount === 1 ? 'user' : 'users'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 font-medium leading-relaxed">{r.desc}</p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Typical Holders</p>
                      <p className="text-xs font-semibold text-slate-800">{r.typicalHolders}</p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                        Key Privileges
                      </p>
                      <ul className="space-y-1">
                        {r.keyPrivileges.map((p, idx) => (
                          <li key={idx} className="flex items-start gap-1.5 text-slate-600 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Data Boundaries</p>
                      <p className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-100">
                        {r.boundaries}
                      </p>
                    </div>
                  </div>

                  {isCurrent && (
                    <div className="pt-2 border-t border-slate-100 text-center">
                      <span className="text-xs font-bold text-indigo-700 flex items-center justify-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        This is your active role
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL 1: ADD NEW STAFF USER */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 animate-fade-in space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Add New Staff User</h3>
                  <p className="text-[11px] text-slate-500">Create credential and assign ministry role</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={newUserForm.first_name}
                    onChange={(e) => setNewUserForm({ ...newUserForm, first_name: e.target.value })}
                    placeholder="e.g. Samuel"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={newUserForm.last_name}
                    onChange={(e) => setNewUserForm({ ...newUserForm, last_name: e.target.value })}
                    placeholder="e.g. Mensah"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  placeholder="e.g. samuel.mensah@greaterworkscitychurch.org"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number (Ghana)</label>
                  <input
                    type="text"
                    value={newUserForm.phone}
                    onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                    placeholder="+233 24 123 4567"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={newUserForm.department}
                    onChange={(e) => setNewUserForm({ ...newUserForm, department: e.target.value })}
                    placeholder="e.g. Protocol & Ushers"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned System Role *</label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                >
                  {rolesList.map((r) => (
                    <option key={r.role} value={r.role}>
                      {r.title} — {r.desc.slice(0, 50)}...
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Initial Password (Optional)</label>
                <input
                  type="text"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  placeholder="Defaults to Gwcc@2026"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <p className="text-[10px] text-slate-400 mt-1">Staff will be asked to update their password upon first login.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold transition shadow-xs"
                >
                  Create Staff Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT USER & ROLE */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 animate-fade-in space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Edit Staff Profile: {editingUser.first_name} {editingUser.last_name}
                  </h3>
                  <p className="text-[11px] text-slate-500">Modify assigned ministry role, department, and active status</p>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.first_name}
                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email (Read-only)</label>
                <input
                  type="email"
                  disabled
                  value={editForm.email}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                >
                  {rolesList.map((r) => (
                    <option key={r.role} value={r.role}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <input
                  type="checkbox"
                  id="userActiveCheck"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <label htmlFor="userActiveCheck" className="text-xs font-semibold text-slate-800 cursor-pointer">
                  Account Active (Uncheck to suspend login privileges)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold transition shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: PASSWORD RESET CREDENTIAL HELPER */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-fade-in space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Staff Credential Recovery</h3>
                  <p className="text-[11px] text-slate-500">{resetModalUser.first_name} {resetModalUser.last_name}</p>
                </div>
              </div>
              <button
                onClick={() => setResetModalUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-3">
              <p>
                You can dispatch an official password reset link directly to <strong>{resetModalUser.email}</strong>,
                or provide the temporary one-time credential below for immediate access:
              </p>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <p className="text-[10px] uppercase font-bold text-slate-400">Temporary Access Password</p>
                <div className="flex items-center justify-between font-mono text-sm font-bold text-slate-900 bg-white p-2.5 rounded-lg border border-slate-200">
                  <span>{tempPassword}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(tempPassword);
                      setCopiedText(true);
                      setTimeout(() => setCopiedText(false), 2000);
                    }}
                    className="p-1 text-indigo-700 hover:text-indigo-900 transition flex items-center gap-1 text-xs"
                    title="Copy to clipboard"
                  >
                    {copiedText ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span className="text-[10px]">{copiedText ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Advise staff to change this temporary password after signing in.</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setResetModalUser(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition font-semibold text-xs"
              >
                Close
              </button>
              <button
                onClick={handleConfirmReset}
                className="px-4 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold transition text-xs shadow-xs"
              >
                Dispatch Reset Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: SIMULATE / SWITCH SESSION CONFIRMATION */}
      {switchTargetUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-fade-in space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Simulate Role Session</h3>
                <p className="text-[11px] text-slate-500">Switch current browser session to test access</p>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <p>
                You are about to switch your active session to:
              </p>
              <div className="font-bold text-slate-900 text-sm">
                {switchTargetUser.first_name} {switchTargetUser.last_name}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs">{getRoleBadge(switchTargetUser.role)}</span>
                <span className="text-slate-400">•</span>
                <span className="text-[11px] text-slate-500">{switchTargetUser.department}</span>
              </div>
              <p className="text-[11px] text-slate-500 pt-1">
                This will enter RBAC Simulation Mode to test navigation menus, module permissions, and data boundaries as this staff member. A persistent banner will appear allowing you to exit simulation and return to your Super Admin session at any time.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSwitchTargetUser(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirmSwitch(switchTargetUser)}
                className="px-4 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold transition text-xs shadow-xs cursor-pointer"
              >
                Start View Simulation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
