import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  Shield,
  ArrowRight,
  Database,
  CheckCircle2,
  Sparkles,
  Users,
  Church,
  Calendar,
  Wallet,
  UserCheck,
  AlertCircle,
  HelpCircle,
  X,
  Phone,
  Briefcase,
  KeyRound,
  LogOut,
  ChevronRight,
  ExternalLink,
  Info,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useToast } from '../contexts/ToastContext';
import { UserProfile, UserRole } from '../types/database.types';
import { clearSupabaseCredentials } from '../lib/supabase';

type AuthTab = 'signin' | 'register' | 'recovery';

export const LoginPage: React.FC = () => {
  const {
    login,
    register,
    resetPassword,
    quickLoginAs,
    availableUsers,
    isAuthenticated,
    currentUser,
    logout,
  } = useAuth();
  const { settings, isSupabaseConfigured, supabaseStatus } = useChurchData();
  const { success: toastSuccess, error: toastError } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/';

  // Active Tab: signin | register | recovery
  const [activeTab, setActiveTab] = useState<AuthTab>('signin');

  // Sign In form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Registration form states
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regDepartment, setRegDepartment] = useState('Administration');
  const [regRole, setRegRole] = useState<UserRole>('administrator');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regShowPassword, setRegShowPassword] = useState(false);

  // Recovery form states
  const [recoveryEmail, setRecoveryEmail] = useState('');

  // Modal states
  const [forgotModalOpen, setForgotModalOpen] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    setIsLoading(true);

    try {
      const res = await login(email, password);
      if (res.success) {
        toastSuccess('Welcome Back', res.message);
        navigate(from, { replace: true });
      } else {
        setErrorMessage(res.message || 'Invalid email or credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (!regFirstName.trim() || !regLastName.trim() || !regEmail.trim()) {
      setErrorMessage('Please fill in your full name and official email address.');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await register({
        first_name: regFirstName,
        last_name: regLastName,
        email: regEmail,
        phone: regPhone,
        department: regDepartment,
        role: regRole,
        password: regPassword,
      });

      if (res.success) {
        toastSuccess('Staff Account Activated', res.message);
        navigate(from, { replace: true });
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Registration failed. Please contact the administrator.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (!recoveryEmail.trim() || !recoveryEmail.includes('@')) {
      setErrorMessage('Please enter a valid church staff email address.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await resetPassword(recoveryEmail);
      if (res.success) {
        setInfoMessage(res.message);
        toastSuccess('Password Recovery', res.message);
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to dispatch recovery link.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row antialiased">
      {/* LEFT COLUMN: Hero & Assembly Brand Showcase (Visible on large screens) */}
      <div className="lg:w-5/12 xl:w-5/12 bg-[#064e3b] text-white p-8 lg:p-12 xl:p-14 flex flex-col justify-between relative overflow-hidden shrink-0">
        {/* Subtle decorative background elements */}
        <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-96 h-96 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md p-2 border border-white/20 shadow-md flex items-center justify-center shrink-0">
              <img
                src={settings.logo_url || '/assets/logo.png'}
                alt="GWCC Crest"
                className="w-full h-full object-contain"
                loading="eager"
              />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-200 block">
                Church Management System
              </span>
              <h1 className="text-xl lg:text-2xl font-black tracking-tight text-white">
                {settings.church_name}
              </h1>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white leading-tight">
              Efficient Church Administration
            </h2>
            <p className="text-xs lg:text-sm text-emerald-100/90 leading-relaxed">
              Empowering church leadership and ministry teams with real-time member records, attendance tracking, giving reports, and pastoral care tools.
            </p>
          </div>
        </div>

        {/* Core Assembly Specifications */}
        <div className="relative z-10 my-8 py-5 border-y border-white/10 grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
              Assembly Location
            </span>
            <p className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>{settings.location}</span>
            </p>
            <p className="text-[11px] text-emerald-200/70 font-mono">Location: City, Country</p>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
              Financial Currency
            </span>
            <p className="text-sm font-bold text-white">
              {settings.currency_symbol} {settings.currency} (Ghana Cedi)
            </p>
            <p className="text-[11px] text-emerald-200/70">MTN MoMo & Bank Ledgers</p>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
              Cloud Database
            </span>
            <p className="text-sm font-bold text-white flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-300" />
              <span>{isSupabaseConfigured ? 'Supabase PostgreSQL' : 'Local Storage Engine'}</span>
            </p>
            <p className="text-[11px] text-emerald-200/70">Row Level Security (RLS)</p>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
              Access Control
            </span>
            <p className="text-sm font-bold text-white flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-300" />
              <span>8 Staff Roles</span>
            </p>
            <p className="text-[11px] text-emerald-200/70">Granular Department Rights</p>
          </div>
        </div>

        {/* Biblical Quote & Foundation Scripture */}
        <div className="relative z-10 space-y-2">
          <blockquote className="text-xs italic text-emerald-100/90 border-l-2 border-emerald-400 pl-3 leading-relaxed">
            "Very truly I tell you, whoever believes in me will do the works I have been doing, and they will do even greater things than these, because I am going to the Father."
          </blockquote>
          <span className="text-[11px] font-bold text-emerald-300 block pl-3">
            — John 14:12 (GWCC Foundation Scripture)
          </span>
        </div>
      </div>

      {/* RIGHT COLUMN: Sign In & Authentication Portal */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-8 lg:p-10 xl:p-12 max-w-3xl w-full mx-auto overflow-y-auto">
        {/* Top Bar for Mobile */}
        <div className="flex items-center justify-between pb-5 border-b border-slate-200 lg:hidden mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-800 p-1.5 flex items-center justify-center shrink-0">
              <img
                src={settings.logo_url || '/assets/logo.png'}
                alt="GWCC"
                className="w-full h-full object-contain"
                loading="eager"
              />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900">{settings.short_name} Staff Portal</h2>
              <p className="text-[10px] text-slate-500">{settings.location}</p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            Secure ChMS
          </span>
        </div>

        {/* Currently Logged In Notification Banner (If user navigates to /login while already logged in) */}
        {isAuthenticated && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                {currentUser.avatar_url ? (
                  <img
                    src={currentUser.avatar_url}
                    alt={currentUser.first_name}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <span>
                    {currentUser.first_name[0]}
                    {currentUser.last_name[0]}
                  </span>
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Signed in as {currentUser.first_name} {currentUser.last_name}
                </p>
                <p className="text-[11px] text-slate-600">
                  Active Role: <span className="font-semibold text-emerald-800 uppercase">{currentUser.role.replace('_', ' ')}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => navigate(from, { replace: true })}
                className="flex-1 sm:flex-none px-3 py-1.5 bg-[#064e3b] hover:bg-[#047857] text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <span>Enter Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  toastSuccess('Signed Out', 'You have been signed out of your session.');
                }}
                className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}

        {/* Center Auth Card */}
        <div className="space-y-6">
          {/* Header & Tabs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                Staff Access & Security
              </span>
              {isSupabaseConfigured ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Supabase Cloud Auth Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  Local Enterprise Session
                </span>
              )}
            </div>

            {/* Member Portal Quick Switch Banner */}
            <div className="mb-4 p-3.5 bg-gradient-to-r from-emerald-900 to-[#064e3b] rounded-2xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs border border-emerald-700/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
                  <Users className="w-4 h-4 text-emerald-300" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Looking for the Member Portal?</p>
                  <p className="text-[11px] text-emerald-100/80">Congregants can sign in to view personal tithes, pledges, attendance, & prayers.</p>
                </div>
              </div>
              <Link
                to="/portal"
                className="shrink-0 px-3.5 py-1.5 bg-white text-emerald-950 hover:bg-emerald-50 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-2xs"
              >
                <span>Go to Member Portal</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {activeTab === 'signin' && 'Sign In to Your Workstation'}
              {activeTab === 'register' && 'Request Church Staff Access'}
              {activeTab === 'recovery' && 'Staff Password Recovery'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {activeTab === 'signin' && 'Enter your official church staff email and password to access the workstation.'}
              {activeTab === 'register' && 'Register new church staff, ministry coordinators, or volunteers for ChMS access.'}
              {activeTab === 'recovery' && 'Reset your password securely via Supabase Auth or obtain administrator reset instructions.'}
            </p>

            {/* Mode Switch Tabs */}
            <div className="flex items-center gap-2 mt-4 p-1 bg-slate-200/70 rounded-xl max-w-md">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signin');
                  setErrorMessage(null);
                  setInfoMessage(null);
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'signin'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Lock className="w-3.5 h-3.5 text-emerald-800" />
                <span>Staff Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  setErrorMessage(null);
                  setInfoMessage(null);
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'register'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5 text-emerald-800" />
                <span>Register Staff</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('recovery');
                  setErrorMessage(null);
                  setInfoMessage(null);
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'recovery'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5 text-emerald-800" />
                <span>Password Help</span>
              </button>
            </div>
          </div>

          {/* Feedback Banners */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-bold">Authentication Notice</p>
                <p className="text-[11px] text-red-800 leading-relaxed">{errorMessage}</p>
                {(errorMessage.toLowerCase().includes('api key') ||
                  errorMessage.toLowerCase().includes('apikey') ||
                  errorMessage.toLowerCase().includes('cloud') ||
                  errorMessage.toLowerCase().includes('jwt')) && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        clearSupabaseCredentials();
                        setErrorMessage(null);
                        setInfoMessage('Stored cloud keys cleared! You are now in offline local mode. You can sign in below with your staff account or use the Quick Staff Sign-In buttons.');
                      }}
                      className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-lg text-[11px] font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Clear Cloud Key & Switch to Local Mode</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {infoMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">System Status</p>
                <p className="text-[11px] text-emerald-800">{infoMessage}</p>
              </div>
            </div>
          )}

          {/* TAB 1: SIGN IN FORM */}
          {activeTab === 'signin' && (
            <div className="space-y-4">
              <form onSubmit={handleSignIn} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Staff Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@church.org"
                      className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-emerald-800 focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800 transition shadow-2xs"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700">Password</label>
                    <button
                      type="button"
                      onClick={() => setForgotModalOpen(true)}
                      className="text-[11px] text-emerald-800 hover:text-emerald-950 font-semibold flex items-center gap-1"
                    >
                      <HelpCircle className="w-3 h-3" />
                      <span>Forgot Password?</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter secret workstation key"
                      className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-emerald-800 focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800 transition shadow-2xs"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-slate-400 hover:text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-800 focus:ring-emerald-700 border-slate-300"
                    />
                    <span>Remember this device session</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-[#064e3b] hover:bg-[#047857] text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Verifying Credentials...</span>
                    </span>
                  ) : (
                    <>
                      <span>Sign In to Workspace</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Quick Staff Sign-In Panel */}
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-800" />
                    <span>Quick Staff Sign-In (Instant Access)</span>
                  </span>
                  <span className="text-[10px] text-slate-600 font-medium">1-Click Login</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableUsers.slice(0, 4).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        quickLoginAs(u);
                        toastSuccess('Quick Sign-In Successful', `Welcome, ${u.first_name} ${u.last_name}!`);
                        navigate(from, { replace: true });
                      }}
                      className="p-2.5 rounded-xl border border-slate-200 hover:border-emerald-700 bg-white hover:bg-emerald-50/50 text-left transition flex items-center justify-between group shadow-2xs cursor-pointer"
                    >
                      <div className="truncate pr-2">
                        <p className="font-bold text-slate-900 group-hover:text-emerald-950 text-xs truncate">
                          {u.first_name} {u.last_name}
                        </p>
                        <p className="text-[10px] text-slate-600 capitalize truncate">
                          {u.role.replace('_', ' ')} • {u.department || 'Staff'}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-800 shrink-0 transition" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STAFF REGISTRATION / ACCESS REQUEST */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={regFirstName}
                    onChange={(e) => setRegFirstName(e.target.value)}
                    placeholder="e.g. Kwame"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-emerald-800 focus:border-emerald-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={regLastName}
                    onChange={(e) => setRegLastName(e.target.value)}
                    placeholder="e.g. Mensah"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-emerald-800 focus:border-emerald-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Staff Email *</label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="k.mensah@church.org"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-emerald-800 focus:border-emerald-800"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+233 24 000 0000"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-emerald-800 focus:border-emerald-800"
                    />
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department / Ministry</label>
                  <select
                    value={regDepartment}
                    onChange={(e) => setRegDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-emerald-800 focus:border-emerald-800"
                  >
                    <option value="Administration">Church Administration Office</option>
                    <option value="Pastoral">Pastoral Care & Counseling</option>
                    <option value="Finance">Finance & Treasury</option>
                    <option value="Protocol">Protocol & Ushers</option>
                    <option value="Youth">Youth Fellowship</option>
                    <option value="Children">Sunday School / Children</option>
                    <option value="Media">Media, Sound & Tech</option>
                    <option value="Music">Choir & Worship Ministry</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Role</label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-emerald-800 focus:border-emerald-800"
                  >
                    <option value="administrator">Administrator</option>
                    <option value="pastor">Pastor / Pastoral Worker</option>
                    <option value="finance_officer">Finance Officer</option>
                    <option value="ministry_leader">Ministry Leader</option>
                    <option value="attendance_officer">Attendance Officer</option>
                    <option value="data_entry">Data Entry Clerk</option>
                    <option value="senior_pastor">Senior Pastor</option>
                    <option value="super_admin">Super Administrator</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Create Password (min 6 chars) *</label>
                  <div className="relative">
                    <input
                      type={regShowPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-10 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-emerald-800 focus:border-emerald-800"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <button
                      type="button"
                      onClick={() => setRegShowPassword(!regShowPassword)}
                      className="p-1 text-slate-400 hover:text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2"
                    >
                      {regShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Confirm Password *</label>
                  <div className="relative">
                    <input
                      type={regShowPassword ? 'text' : 'password'}
                      required
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-emerald-800 focus:border-emerald-800"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-[#064e3b] hover:bg-[#047857] text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating Account...</span>
                  </span>
                ) : (
                  <>
                    <span>Create & Activate Staff Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 3: PASSWORD RECOVERY */}
          {activeTab === 'recovery' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <Shield className="w-4 h-4 text-emerald-800" />
                  <span>Church Administrative Security Protocol</span>
                </div>
                <p>
                  To safeguard member data and ministry records, password resets for staff are managed through authenticated directory channels or your IT administrator.
                </p>
              </div>

              <form onSubmit={handleRecovery} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Enter Your Staff Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      placeholder="e.g. staff@church.org"
                      className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-emerald-800 focus:border-emerald-800 transition"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 bg-[#064e3b] hover:bg-[#047857] text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Sending Reset Link...</span>
                    </span>
                  ) : (
                    <>
                      <span>Request Password Reset Link</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="pt-6 border-t border-slate-200 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400 mt-6">
          <span>
            Greater Works City Church • Joma Assembly, Accra, Ghana
          </span>
          <span className="font-mono">
            ChMS v2.6 Enterprise Edition
          </span>
        </div>
      </div>

      {/* Forgot Password Helper Modal */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900">
                <HelpCircle className="w-5 h-5 text-emerald-800" />
                <h3 className="font-bold text-sm">Staff Password Reset Guide</h3>
              </div>
              <button
                onClick={() => setForgotModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2.5">
              <p>
                In production, credentials authenticate directly against your church <strong>Supabase Auth</strong> cluster or are managed by your church IT & Administration desk.
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                If you have forgotten your password, enter your staff email in the <strong>Password Help</strong> tab to request a secure reset link, or contact the church administration office.
              </p>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setForgotModalOpen(false);
                  setActiveTab('recovery');
                }}
                className="flex-1 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 transition"
              >
                Send Reset Link
              </button>
              <button
                type="button"
                onClick={() => setForgotModalOpen(false)}
                className="flex-1 py-2 bg-[#064e3b] text-white font-bold rounded-xl text-xs hover:bg-[#047857] transition"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
