import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Database,
  Copy,
  Check,
  Download,
  RotateCcw,
  Server,
  Shield,
  MapPin,
  Clock,
  Sparkles,
  Key,
  ExternalLink,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  EyeOff,
  Code2,
  Table,
  Building,
  CreditCard,
  Phone,
  Mail,
  Calendar,
  FileJson,
  Upload,
  Layers,
  Radio,
  Landmark,
  Smartphone,
  Save,
  Sun,
  Moon,
  Monitor,
  Palette,
} from 'lucide-react';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  testSupabaseConnection,
  checkSupabaseTables,
  getSupabaseProjectRef,
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_ANON_KEY,
} from '../lib/supabase';
import { SQL_MIGRATION_SCHEMA, SQL_FIX_RLS_SCHEMA } from '../lib/supabaseSchema';

export const SettingsPage: React.FC = () => {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();
  const {
    settings,
    updateSettings,
    resetToDefaultData,
    supabaseStatus,
    supabaseConfig,
    supabaseError,
    lastSyncTime,
    connectSupabase,
    disconnectSupabase,
    pushToSupabase,
    pullFromSupabase,
    members,
    visitors,
    attendance,
    giving,
    expenses,
    pledges,
    ministries,
    smallGroups,
  } = useChurchData();
  const { theme, resolvedTheme, isDark, setTheme, toggleTheme } = useTheme();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'identity' | 'appearance' | 'finance' | 'services' | 'supabase' | 'backup'>('identity');

  // General Settings state
  const [churchName, setChurchName] = useState(settings.church_name || 'Church Management System');
  const [shortName, setShortName] = useState(settings.short_name || 'CMS');
  const [seniorPastor, setSeniorPastor] = useState(settings.senior_pastor || 'Senior Pastor');
  const [generalSecretary, setGeneralSecretary] = useState(settings.general_secretary || 'General Secretary');
  const [tagline, setTagline] = useState(settings.tagline || 'Faithful, organized, and ready to serve');
  const [branchName, setBranchName] = useState(settings.branch_name || 'Main Branch');
  const [logoUrl, setLogoUrl] = useState(settings.logo_url || '/assets/logo.png');
  const [location, setLocation] = useState(settings.location || 'City, Country');
  const [address, setAddress] = useState(settings.address || 'Main Street, City');
  const [gpsAddress, setGpsAddress] = useState(settings.gps_address || 'GPS-0000');
  const [phone, setPhone] = useState(settings.phone || '+000 000 0000');
  const [email, setEmail] = useState(settings.email || 'admin@example.org');
  const [currency, setCurrency] = useState(settings.currency || 'USD');
  const [currencySymbol, setCurrencySymbol] = useState(settings.currency_symbol || '$');
  const [timezone, setTimezone] = useState(settings.timezone || 'UTC');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Financial Accounts & MoMo Configuration State (persisted in localStorage)
  const [momoNumber, setMomoNumber] = useState(() => {
    return localStorage.getItem('gwcc_momo_number') || '';
  });
  const [momoAccountName, setMomoAccountName] = useState(() => {
    return localStorage.getItem('gwcc_momo_name') || '';
  });
  const [telecelNumber, setTelecelNumber] = useState(() => {
    return localStorage.getItem('gwcc_telecel_number') || '';
  });
  const [bankName, setBankName] = useState(() => {
    return localStorage.getItem('gwcc_bank_name') || '';
  });
  const [bankAccountNumber, setBankAccountNumber] = useState(() => {
    return localStorage.getItem('gwcc_bank_account') || '';
  });
  const [bankBranch, setBankBranch] = useState(() => {
    return localStorage.getItem('gwcc_bank_branch') || '';
  });

  // Weekly Services Schedule (persisted in localStorage)
  const [sundayServiceTime, setSundayServiceTime] = useState(() => {
    return localStorage.getItem('gwcc_sunday_time') || '';
  });
  const [midweekServiceTime, setMidweekServiceTime] = useState(() => {
    return localStorage.getItem('gwcc_midweek_time') || '';
  });
  const [allNightServiceTime, setAllNightServiceTime] = useState(() => {
    return localStorage.getItem('gwcc_allnight_time') || '';
  });
  const [cellMeetingTime, setCellMeetingTime] = useState(() => {
    return localStorage.getItem('gwcc_cell_time') || '';
  });

  // Supabase Credentials Form state
  const [supabaseUrlInput, setSupabaseUrlInput] = useState(supabaseConfig.url || '');
  const [supabaseKeyInput, setSupabaseKeyInput] = useState(supabaseConfig.anonKey || '');
  const [showKey, setShowKey] = useState(false);

  // Testing & Sync states
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs?: number;
    message: string;
    tablesStatus?: 'ready' | 'tables_missing';
  } | null>(null);
  const [isSyncingPush, setIsSyncingPush] = useState(false);
  const [isSyncingPull, setIsSyncingPull] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ message: string; percent: number } | null>(null);
  const [syncResult, setSyncResult] = useState<{ success: boolean; text: string } | null>(null);

  // Table inspection state
  const [isCheckingTables, setIsCheckingTables] = useState(false);
  const [tableStatus, setTableStatus] = useState<{ ready: boolean; existing: string[]; missing: string[] } | null>(null);

  // SQL code viewer state
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedFixSql, setCopiedFixSql] = useState(false);
  const [showSqlEditor, setShowSqlEditor] = useState(false);

  // Supabase project direct URL helpers
  const projectRef = getSupabaseProjectRef(supabaseUrlInput || supabaseConfig.url || '');
  const sqlEditorUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/sql/new`
    : 'https://supabase.com/dashboard';

  // Sync inputs when context config changes
  useEffect(() => {
    setSupabaseUrlInput(supabaseConfig.url || '');
    setSupabaseKeyInput(supabaseConfig.anonKey || '');
  }, [supabaseConfig]);

  // Sync settings when settings in context change
  useEffect(() => {
    if (settings) {
      if (settings.church_name) setChurchName(settings.church_name);
      if (settings.short_name) setShortName(settings.short_name);
      if (settings.senior_pastor) setSeniorPastor(settings.senior_pastor);
      if (settings.general_secretary) setGeneralSecretary(settings.general_secretary);
      if (settings.tagline) setTagline(settings.tagline);
      if (settings.branch_name) setBranchName(settings.branch_name);
      if (settings.logo_url) setLogoUrl(settings.logo_url);
      if (settings.location) setLocation(settings.location);
      if (settings.address) setAddress(settings.address);
      if (settings.gps_address) setGpsAddress(settings.gps_address);
      if (settings.phone) setPhone(settings.phone);
      if (settings.email) setEmail(settings.email);
    }
  }, [settings]);

  const handleSaveIdentitySettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      church_name: churchName,
      short_name: shortName,
      tagline,
      branch_name: branchName,
      senior_pastor: seniorPastor,
      general_secretary: generalSecretary,
      logo_url: logoUrl,
      location,
      address,
      gps_address: gpsAddress,
      phone,
      email,
      currency,
      currency_symbol: currencySymbol,
      timezone,
    });
    setSavedSuccess(true);
    toastSuccess('Settings Saved', 'Church profile information updated successfully.');
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleSaveFinancialConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('gwcc_momo_number', momoNumber);
    localStorage.setItem('gwcc_momo_name', momoAccountName);
    localStorage.setItem('gwcc_telecel_number', telecelNumber);
    localStorage.setItem('gwcc_bank_name', bankName);
    localStorage.setItem('gwcc_bank_account', bankAccountNumber);
    localStorage.setItem('gwcc_bank_branch', bankBranch);
    toastSuccess('Financial Channels Saved', 'Official MoMo Merchant and Bank account details updated.');
  };

  const handleSaveServiceSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('gwcc_sunday_time', sundayServiceTime);
    localStorage.setItem('gwcc_midweek_time', midweekServiceTime);
    localStorage.setItem('gwcc_allnight_time', allNightServiceTime);
    localStorage.setItem('gwcc_cell_time', cellMeetingTime);
    toastSuccess('Service Schedule Saved', 'Weekly worship services and prayer timetable updated.');
  };

  const handleExportFullJsonBackup = () => {
    const backupData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      church: settings.church_name,
      settings,
      financial_accounts: {
        momo_number: momoNumber,
        momo_name: momoAccountName,
        telecel_number: telecelNumber,
        bank_name: bankName,
        bank_account: bankAccountNumber,
        bank_branch: bankBranch,
      },
      schedule: {
        sunday: sundayServiceTime,
        midweek: midweekServiceTime,
        all_night: allNightServiceTime,
        cell: cellMeetingTime,
      },
      counts: {
        members: members.length,
        visitors: visitors.length,
        attendance: attendance.length,
        giving: giving.length,
        expenses: expenses.length,
        pledges: pledges.length,
        ministries: ministries.length,
        small_groups: smallGroups.length,
      },
      data: {
        members,
        visitors,
        attendance,
        giving,
        expenses,
        pledges,
        ministries,
        smallGroups,
      },
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GWCC_Database_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toastSuccess('Backup Exported', 'Full church database JSON backup downloaded successfully.');
  };

  const handleTestConnection = async () => {
    let testUrl = supabaseUrlInput.trim();
    let testKey = supabaseKeyInput.trim();

    if (testUrl.includes('noskcrmvnancdyhvzfin') && testKey !== DEFAULT_SUPABASE_ANON_KEY) {
      testKey = DEFAULT_SUPABASE_ANON_KEY;
      testUrl = DEFAULT_SUPABASE_URL;
      setSupabaseUrlInput(DEFAULT_SUPABASE_URL);
      setSupabaseKeyInput(DEFAULT_SUPABASE_ANON_KEY);
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection(testUrl, testKey);
      setTestResult({
        success: res.success,
        latencyMs: res.latencyMs,
        message: res.message,
        tablesStatus: res.tablesStatus,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Connection test failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveSupabaseConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    let saveUrl = supabaseUrlInput.trim();
    let saveKey = supabaseKeyInput.trim();

    if (saveUrl.includes('noskcrmvnancdyhvzfin') && saveKey !== DEFAULT_SUPABASE_ANON_KEY) {
      saveKey = DEFAULT_SUPABASE_ANON_KEY;
      saveUrl = DEFAULT_SUPABASE_URL;
      setSupabaseUrlInput(DEFAULT_SUPABASE_URL);
      setSupabaseKeyInput(DEFAULT_SUPABASE_ANON_KEY);
    }

    if (!saveUrl || !saveKey) {
      toastError('Missing Credentials', 'Please provide both your Supabase Project URL and Anon Key.');
      return;
    }
    const res = await connectSupabase(saveUrl, saveKey);
    if (res.success) {
      setTestResult({
        success: true,
        message: 'Connected and credentials saved successfully!',
      });
      toastSuccess('Supabase Connected', 'Database credentials saved and verified.');
    } else {
      setTestResult({
        success: false,
        message: res.message,
      });
      toastError('Connection Failed', res.message);
    }
  };

  const handleCheckTables = async () => {
    setIsCheckingTables(true);
    try {
      const status = await checkSupabaseTables();
      setTableStatus(status);
    } catch {
      // Ignore
    } finally {
      setIsCheckingTables(false);
    }
  };

  const handlePushData = async () => {
    const activeUrl = supabaseUrlInput.trim() || supabaseConfig.url;
    const activeKey = supabaseKeyInput.trim() || supabaseConfig.anonKey;

    if (!activeUrl || !activeKey) {
      toastError('Configuration Missing', 'Please enter your Supabase Project URL and Anon Key first.');
      return;
    }

    if (activeUrl !== supabaseConfig.url || activeKey !== supabaseConfig.anonKey || supabaseStatus === 'disconnected') {
      toastInfo('Connecting to Supabase', 'Saving credentials and establishing connection...');
      const conn = await connectSupabase(activeUrl, activeKey);
      if (!conn.success) {
        toastError('Connection Failed', conn.message);
        setSyncResult({ success: false, text: conn.message });
        return;
      }
    }

    setIsSyncingPush(true);
    setSyncResult(null);
    try {
      const res = await pushToSupabase((step, percent) => {
        setSyncProgress({ message: step, percent });
      });
      if (res.success) {
        const total = Object.values(res.summary).reduce((a, b) => a + b, 0);
        const msg = `Successfully pushed ${total} church records into Supabase across ${Object.keys(res.summary).length} tables!`;
        setSyncResult({
          success: true,
          text: msg,
        });
        toastSuccess('Push Complete', msg);
      } else {
        const total = Object.values(res.summary).reduce((a, b) => a + b, 0);
        const errText = res.errors.join('; ');
        setSyncResult({
          success: false,
          text: `Synced ${total} records, but ${res.errors.length} issue(s) occurred: ${errText}`,
        });
        toastError('Push Incomplete', `Synced ${total} records, but some tables had errors. Check migration.`);
      }
    } catch (err: any) {
      const errText = err?.message || 'Failed to push data to Supabase';
      setSyncResult({
        success: false,
        text: errText,
      });
      toastError('Push Error', errText);
    } finally {
      setIsSyncingPush(false);
      setSyncProgress(null);
    }
  };

  const handlePullData = async () => {
    let activeUrl = supabaseUrlInput.trim() || supabaseConfig.url;
    let activeKey = supabaseKeyInput.trim() || supabaseConfig.anonKey;

    if (activeUrl.includes('noskcrmvnancdyhvzfin') && activeKey !== DEFAULT_SUPABASE_ANON_KEY) {
      activeKey = DEFAULT_SUPABASE_ANON_KEY;
      activeUrl = DEFAULT_SUPABASE_URL;
      setSupabaseUrlInput(DEFAULT_SUPABASE_URL);
      setSupabaseKeyInput(DEFAULT_SUPABASE_ANON_KEY);
    }

    if (!activeUrl || !activeKey) {
      toastError('Configuration Missing', 'Please enter your Supabase Project URL and Anon Key first.');
      return;
    }

    if (activeUrl !== supabaseConfig.url || activeKey !== supabaseConfig.anonKey || supabaseStatus === 'disconnected') {
      toastInfo('Connecting to Supabase', 'Saving credentials and establishing connection...');
      const conn = await connectSupabase(activeUrl, activeKey);
      if (!conn.success) {
        toastError('Connection Failed', conn.message);
        setSyncResult({ success: false, text: conn.message });
        return;
      }
    }

    setIsSyncingPull(true);
    setSyncResult(null);
    try {
      const res = await pullFromSupabase();
      if (res.success) {
        const msg = 'Successfully refreshed local church data from Supabase!';
        setSyncResult({
          success: true,
          text: msg,
        });
        toastSuccess('Pull Complete', msg);
      } else {
        const errText = res.errors.join('; ') || 'No records returned or tables empty';
        setSyncResult({
          success: false,
          text: `Could not fetch records: ${errText}`,
        });
        toastError('Pull Incomplete', errText);
      }
    } catch (err: any) {
      const errText = err?.message || 'Failed to pull data from Supabase';
      setSyncResult({
        success: false,
        text: errText,
      });
      toastError('Pull Error', errText);
    } finally {
      setIsSyncingPull(false);
    }
  };

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(SQL_MIGRATION_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const copyFixSqlToClipboard = () => {
    navigator.clipboard.writeText(SQL_FIX_RLS_SCHEMA);
    setCopiedFixSql(true);
    toastSuccess('Fix Script Copied', 'Paste and run in your Supabase SQL Editor to resolve RLS policies and missing columns.');
    setTimeout(() => setCopiedFixSql(false), 2500);
  };

  const downloadSqlScript = () => {
    const element = document.createElement('a');
    const file = new Blob([SQL_MIGRATION_SCHEMA], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = '20260923000001_gwcc_initial_schema.sql';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const isConnected = supabaseStatus === 'connected';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-950 via-[#064e3b] to-emerald-900 p-6 rounded-3xl text-white shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-emerald-700/60 rounded-xl">
              <SettingsIcon className="w-5 h-5 text-emerald-200" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              System Administration & Preferences
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Church Settings & Cloud Database Hub
          </h1>
          <p className="text-xs text-emerald-100/90 mt-1 max-w-xl">
            Configure {settings.church_name} assembly parameters, Ghana Post GPS, Mobile Money accounts, weekly service timetables, and PostgreSQL cloud integration.
          </p>
        </div>

        {/* Cloud Status Pill */}
        <div className="flex items-center gap-3 bg-white/10 border border-white/20 p-3 rounded-2xl backdrop-blur-xs">
          <div>
            <span className="text-[10px] text-emerald-200 uppercase font-semibold block">PostgreSQL Status</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span className="text-xs font-bold text-white">
                {isConnected ? 'Connected to Cloud' : 'Local Browser State'}
              </span>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('supabase')}
            className="px-2.5 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-xl transition"
          >
            Manage
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>Settings updated and saved successfully!</span>
          </div>
          <button onClick={() => setSavedSuccess(false)} className="text-emerald-700 hover:text-emerald-900">
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('identity')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition shrink-0 ${
            activeTab === 'identity'
              ? 'border-[#064e3b] dark:border-emerald-400 text-[#064e3b] dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Church Identity & Address</span>
        </button>

        <button
          onClick={() => setActiveTab('appearance')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition shrink-0 ${
            activeTab === 'appearance'
              ? 'border-emerald-600 dark:border-emerald-400 text-emerald-800 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Palette className="w-4 h-4 text-amber-500" />
          <span>Appearance & Theme</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 capitalize">
            {theme}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('finance')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition shrink-0 ${
            activeTab === 'finance'
              ? 'border-[#064e3b] dark:border-emerald-400 text-[#064e3b] dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Smartphone className="w-4 h-4 text-emerald-600" />
          <span>MoMo & Financial Accounts</span>
        </button>

        <button
          onClick={() => setActiveTab('services')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition shrink-0 ${
            activeTab === 'services'
              ? 'border-[#064e3b] dark:border-emerald-400 text-[#064e3b] dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4 text-blue-600" />
          <span>Services & Timetable</span>
        </button>

        <button
          onClick={() => setActiveTab('supabase')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition shrink-0 ${
            activeTab === 'supabase'
              ? 'border-[#064e3b] dark:border-emerald-400 text-[#064e3b] dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Database className="w-4 h-4 text-purple-600" />
          <span>Supabase PostgreSQL Hub</span>
        </button>

        <button
          onClick={() => setActiveTab('backup')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition shrink-0 ${
            activeTab === 'backup'
              ? 'border-[#064e3b] dark:border-emerald-400 text-[#064e3b] dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Server className="w-4 h-4 text-amber-600" />
          <span>Backup & Maintenance</span>
        </button>
      </div>

      {/* TAB 1: CHURCH IDENTITY & ADDRESS */}
      {activeTab === 'identity' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Assembly Profile & Contact Information</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Official church information displayed on receipts, PDF bulletins, and reports.</p>
            </div>

            <form onSubmit={handleSaveIdentitySettings} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Official Assembly Name *</label>
                  <input
                    type="text"
                    required
                    value={churchName}
                    onChange={(e) => setChurchName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Senior Pastor & General Overseer *</label>
                  <input
                    type="text"
                    required
                    value={seniorPastor}
                    onChange={(e) => setSeniorPastor(e.target.value)}
                    className="w-full px-3 py-2 border border-emerald-300 bg-emerald-50/40 rounded-lg text-xs font-bold text-emerald-950 focus:outline-emerald-600"
                    placeholder="Enter senior pastor name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">General Secretary *</label>
                  <input
                    type="text"
                    required
                    value={generalSecretary}
                    onChange={(e) => setGeneralSecretary(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 bg-blue-50/40 rounded-lg text-xs font-bold text-blue-950 focus:outline-blue-600"
                    placeholder="Enter general secretary name"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Acronym / Short Name *</label>
                  <input
                    type="text"
                    required
                    value={shortName}
                    onChange={(e) => setShortName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assembly Branch Designation</label>
                  <input
                    type="text"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    placeholder="e.g. Joma Main Assembly"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Church Tagline / Motto</label>
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    placeholder="e.g. Exceeding Abundantly Above All"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ghana Post Digital Address (GPS) *</label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      required
                      value={gpsAddress}
                      onChange={(e) => setGpsAddress(e.target.value.toUpperCase())}
                      className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-emerald-800"
                      placeholder="e.g. GPS-0000"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assembly City & Region *</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Physical Auditorium Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  placeholder="e.g. Joma New Site, Off Ablekuma-Joma Highway"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Official Pastoral Phone / WhatsApp</label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Official Email Address</label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Currency Code</label>
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Currency Symbol</label>
                  <input
                    type="text"
                    value={currencySymbol}
                    onChange={(e) => setCurrencySymbol(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-emerald-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">System Timezone</label>
                  <input
                    type="text"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#064e3b] hover:bg-[#047857] text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Church Profile Parameters</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right Col: Logo & Crest Card */}
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
              <h3 className="font-bold text-slate-900 text-sm">Official Church Crest & Branding</h3>
              
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center justify-center text-center space-y-2">
                <div className="w-24 h-24 rounded-2xl bg-white border border-slate-200 p-2 shadow-2xs flex items-center justify-center">
                  <img
                    src={logoUrl}
                    alt="GWCC Logo Preview"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      if (target.src !== window.location.origin + '/assets/logo.png') {
                        target.src = '/assets/logo.png';
                      }
                    }}
                  />
                </div>
                <p className="font-bold text-slate-800 text-sm">{churchName}</p>
                <div className="w-full bg-white rounded-lg p-2 border border-slate-200 text-left space-y-1">
                  <div className="text-[11px] flex justify-between">
                    <span className="text-slate-500 font-medium">Overseer:</span>
                    <span className="font-bold text-emerald-800">{seniorPastor}</span>
                  </div>
                  <div className="text-[11px] flex justify-between">
                    <span className="text-slate-500 font-medium">Gen. Secretary:</span>
                    <span className="font-bold text-blue-800">{generalSecretary}</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">{gpsAddress}</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Crest Image URL / Asset Path</label>
                <input
                  type="text"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="/assets/logo.png"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">Default: /assets/logo.png</p>
              </div>
            </div>

            {/* Quick Appearance Card */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                  <Palette className="w-4 h-4 text-amber-500" />
                  Appearance Theme
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 capitalize">
                  {theme}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Active: <strong>{isDark ? 'Dark Theme' : 'Light Theme'}</strong>. Switch on the fly or open the Appearance tab.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex-1 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  {isDark ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                      <span>Switch to Light</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-teal-600" />
                      <span>Switch to Dark</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('appearance')}
                  className="py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold text-xs border border-emerald-200 dark:border-emerald-800/80 transition cursor-pointer"
                >
                  Theme Hub
                </button>
              </div>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-950 space-y-1.5">
              <span className="font-bold flex items-center gap-1.5 text-emerald-900">
                <Shield className="w-4 h-4 text-emerald-700" /> Verification Status
              </span>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Registered Assembly in Joma, Greater Accra, Ghana. All printed documents include the official seal, GPS coordinates, and church reference numbers.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB: APPEARANCE & DARK THEME */}
      {activeTab === 'appearance' && (
        <div className="space-y-6 max-w-4xl">
          {/* Main Appearance Panel */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Palette className="w-5 h-5 text-amber-500" />
                  Interface Theme & Color Mode
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Customize the visual workspace between Light, Dark, or System synchronized palettes.
                </p>
              </div>

              {/* Quick Toggle Pill */}
              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {isDark ? 'Dark Mode Active' : 'Light Mode Active'}
                </span>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    isDark ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                  role="switch"
                  aria-checked={isDark}
                  title="Toggle Light / Dark mode"
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out flex items-center justify-center text-[10px] ${
                      isDark ? 'translate-x-5 text-amber-600' : 'translate-x-0 text-slate-400'
                    }`}
                  >
                    {isDark ? '🌙' : '☀️'}
                  </span>
                </button>
              </div>
            </div>

            {/* Three Theme Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Option 1: Light Theme */}
              <div
                onClick={() => {
                  setTheme('light');
                  toastSuccess('Light Theme Enabled', 'Clean daytime church palette activated.');
                }}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-4 group ${
                  theme === 'light'
                    ? 'border-emerald-600 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                }`}
              >
                <div className="space-y-3">
                  {/* Mockup Preview */}
                  <div className="h-28 rounded-xl bg-slate-100 p-2 border border-slate-200 shadow-2xs space-y-1.5 flex flex-col justify-between overflow-hidden">
                    <div className="h-4 bg-white rounded-md border border-slate-200 flex items-center px-1.5 justify-between">
                      <div className="w-10 h-1.5 bg-emerald-700 rounded-full" />
                      <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-slate-200" />
                        <div className="w-2 h-2 rounded-full bg-slate-200" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 flex-1 pt-1">
                      <div className="bg-white rounded p-1.5 border border-slate-200 space-y-1">
                        <div className="w-12 h-1.5 bg-slate-800 rounded-full" />
                        <div className="w-8 h-1 bg-slate-300 rounded-full" />
                      </div>
                      <div className="bg-white rounded p-1.5 border border-slate-200 space-y-1">
                        <div className="w-10 h-1.5 bg-teal-700 rounded-full" />
                        <div className="w-6 h-1 bg-slate-300 rounded-full" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Sun className="w-4 h-4 text-amber-500" />
                        Light Theme
                      </span>
                      {theme === 'light' && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Clean off-white background with high-contrast text and crisp emerald green accents. Ideal for daytime office duties and PDF exports.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className={`w-full py-2 rounded-xl text-xs font-bold transition ${
                    theme === 'light'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {theme === 'light' ? 'Selected' : 'Use Light Mode'}
                </button>
              </div>

              {/* Option 2: Dark Theme */}
              <div
                onClick={() => {
                  setTheme('dark');
                  toastSuccess('Dark Theme Enabled', 'Deep obsidian dark mode activated.');
                }}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-4 group ${
                  theme === 'dark'
                    ? 'border-emerald-500 bg-emerald-950/20 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                }`}
              >
                <div className="space-y-3">
                  {/* Mockup Preview */}
                  <div className="h-28 rounded-xl bg-[#070b14] p-2 border border-slate-800 shadow-2xs space-y-1.5 flex flex-col justify-between overflow-hidden">
                    <div className="h-4 bg-[#0b1120] rounded-md border border-slate-800 flex items-center px-1.5 justify-between">
                      <div className="w-10 h-1.5 bg-emerald-400 rounded-full" />
                      <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-slate-700" />
                        <div className="w-2 h-2 rounded-full bg-slate-700" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 flex-1 pt-1">
                      <div className="bg-[#0f172a] rounded p-1.5 border border-slate-800 space-y-1">
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full" />
                        <div className="w-8 h-1 bg-slate-600 rounded-full" />
                      </div>
                      <div className="bg-[#0f172a] rounded p-1.5 border border-slate-800 space-y-1">
                        <div className="w-10 h-1.5 bg-teal-400 rounded-full" />
                        <div className="w-6 h-1 bg-slate-600 rounded-full" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Moon className="w-4 h-4 text-teal-400" />
                        Dark Theme
                      </span>
                      {theme === 'dark' && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/50">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Deep slate canvas (#0b1120) with neutral card elevations. Gentle on the eyes for projection booths, evening prayer, and night services.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className={`w-full py-2 rounded-xl text-xs font-bold transition ${
                    theme === 'dark'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {theme === 'dark' ? 'Selected' : 'Use Dark Mode'}
                </button>
              </div>

              {/* Option 3: System Theme */}
              <div
                onClick={() => {
                  setTheme('system');
                  toastSuccess('System Theme Enabled', 'Will match your device color scheme automatically.');
                }}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-4 group ${
                  theme === 'system'
                    ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                }`}
              >
                <div className="space-y-3">
                  {/* Mockup Preview (Split Light/Dark) */}
                  <div className="h-28 rounded-xl p-2 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1.5 flex flex-col justify-between overflow-hidden bg-gradient-to-r from-slate-100 via-slate-200 to-[#070b14]">
                    <div className="h-4 bg-white/80 dark:bg-slate-900/80 rounded-md border border-slate-300 dark:border-slate-700 flex items-center px-1.5 justify-between">
                      <div className="w-10 h-1.5 bg-blue-600 rounded-full" />
                      <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-slate-400" />
                        <div className="w-2 h-2 rounded-full bg-slate-600" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 flex-1 pt-1">
                      <div className="bg-white rounded p-1.5 border border-slate-200 space-y-1">
                        <div className="w-10 h-1 bg-slate-700 rounded-full" />
                      </div>
                      <div className="bg-[#0f172a] rounded p-1.5 border border-slate-700 space-y-1">
                        <div className="w-10 h-1 bg-slate-200 rounded-full" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Monitor className="w-4 h-4 text-blue-500" />
                        System Sync
                      </span>
                      {theme === 'system' && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300">
                          Active ({resolvedTheme})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Automatically detects your device setting. Switches to dark mode in the evening and light mode during the day as scheduled on your OS.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className={`w-full py-2 rounded-xl text-xs font-bold transition ${
                    theme === 'system'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {theme === 'system' ? 'Selected' : 'Sync with System'}
                </button>
              </div>
            </div>

            {/* Practical Notes & Compliance */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-600 dark:text-slate-400 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-200">
                <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Accessibility & Visual Specifications</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-[11px] leading-relaxed">
                <li>All themes maintain strict WCAG AA minimum 4.5:1 contrast ratios on primary data and typography.</li>
                <li>Theme selection is stored locally on this workstation and persists across page reloads and browser sessions.</li>
                <li>Printed reports, tithe receipts, and PDF exports automatically render in standard printable black-and-white for crisp paper printing.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MOMO & FINANCIAL ACCOUNTS */}
      {activeTab === 'finance' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5 max-w-3xl">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-emerald-700" />
              Ghana Mobile Money & Bank Accounts Configuration
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              These details are populated onto member digital giving receipts, financial bulletins, and payment voucher records.
            </p>
          </div>

          <form onSubmit={handleSaveFinancialConfig} className="space-y-4 text-xs">
            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3">
              <h3 className="font-bold text-amber-900 text-xs uppercase tracking-wide flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-amber-700" />
                MTN Mobile Money (MoMo) Merchant
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">MTN Merchant / Number</label>
                  <input
                    type="text"
                    value={momoNumber}
                    onChange={(e) => setMomoNumber(e.target.value)}
                    placeholder="Enter mobile money number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Account / Merchant Name</label>
                  <input
                    type="text"
                    value={momoAccountName}
                    onChange={(e) => setMomoAccountName(e.target.value.toUpperCase())}
                    placeholder="Enter merchant account name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-rose-50/60 border border-rose-200 rounded-xl space-y-3">
              <h3 className="font-bold text-rose-900 text-xs uppercase tracking-wide flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-rose-700" />
                Telecel Cash Merchant
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Telecel Cash Number</label>
                  <input
                    type="text"
                    value={telecelNumber}
                    onChange={(e) => setTelecelNumber(e.target.value)}
                    placeholder="Enter merchant number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3">
              <h3 className="font-bold text-blue-900 text-xs uppercase tracking-wide flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-blue-700" />
                Church Bank Account Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="GCB Bank / Ecobank"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    placeholder="Enter bank account number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Branch</label>
                  <input
                    type="text"
                    value={bankBranch}
                    onChange={(e) => setBankBranch(e.target.value)}
                    placeholder="Enter bank branch"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#064e3b] hover:bg-[#047857] text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Financial Channels</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: SERVICES & TIMETABLE */}
      {activeTab === 'services' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5 max-w-3xl">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-700" />
              Weekly Service Timetable & Schedules
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Service schedules displayed in attendance check-in kiosk, duty roster editor, and order of service bulletins.
            </p>
          </div>

          <form onSubmit={handleSaveServiceSchedule} className="space-y-4 text-xs">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                1. Sunday Prophetic Celebration Service
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Service Time</label>
                  <input
                    type="text"
                    value={sundayServiceTime}
                    onChange={(e) => setSundayServiceTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Audience</label>
                  <span className="block px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-600">
                    Whole Congregation, Visitors & Children Church
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                2. Wednesday Midweek Miracle & Teaching Service
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Service Time</label>
                  <input
                    type="text"
                    value={midweekServiceTime}
                    onChange={(e) => setMidweekServiceTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Focus</label>
                  <span className="block px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-600">
                    Word Exegesis, Communion & Deliverance Prayers
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                3. Friday Prophetic All-Night Vigil
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Service Schedule</label>
                  <input
                    type="text"
                    value={allNightServiceTime}
                    onChange={(e) => setAllNightServiceTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Focus</label>
                  <span className="block px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-600">
                    Intercessory Warfare, Prophetic Impartation
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                4. Community Cell Fellowships
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Meeting Time</label>
                  <input
                    type="text"
                    value={cellMeetingTime}
                    onChange={(e) => setCellMeetingTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Locations</label>
                  <span className="block px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-600">
                    Host homes across Joma, Ablekuma, Weija & Anyaa
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#064e3b] hover:bg-[#047857] text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Service Schedule</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: SUPABASE POSTGRESQL HUB */}
      {activeTab === 'supabase' && (
        <div className="space-y-6">
          {/* Main Integration Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            {/* Header & Status Pill */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Supabase PostgreSQL Integration</h2>
                  <p className="text-xs text-slate-500">Live cloud database connection & real-time synchronization</p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                    <span>Connected to Cloud DB</span>
                  </div>
                ) : supabaseStatus === 'tables_missing' ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    <span>Connected • Tables Pending</span>
                  </div>
                ) : supabaseStatus === 'syncing' ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">
                    <RefreshCw className="w-3 h-3 animate-spin text-sky-700" />
                    <span>Syncing...</span>
                  </div>
                ) : supabaseStatus === 'error' ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                    <AlertTriangle className="w-3 h-3 text-red-600" />
                    <span>Connection Error</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    <span>Local Mode (Unlinked)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Dedicated Callout when Supabase is connected but tables need to be created in SQL editor */}
            {supabaseStatus === 'tables_missing' && (
              <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-950 space-y-3 shadow-xs animate-in fade-in">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center shrink-0 mt-0.5">
                    <Database className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-amber-950 flex items-center gap-2">
                      <span>Connected to Supabase!</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-200 text-amber-900 font-semibold">
                        Schema Setup Needed
                      </span>
                    </h4>
                    <p className="text-xs text-amber-900/90 leading-relaxed">
                      Your Supabase URL and API Key are verified and working! The database tables haven't been created yet in your PostgreSQL project.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white/90 rounded-xl border border-amber-200 text-xs space-y-1.5">
                  <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wide">
                    ⚡ 2-Minute Quick Activation:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-700 text-xs pl-1">
                    <li>Click <strong>"Copy SQL Migration Script"</strong> below.</li>
                    <li>Click <strong>"Open Supabase SQL Editor"</strong>, paste into the query window, and click <strong>"Run"</strong>.</li>
                    <li>Return here and click <strong>"Push Local Data"</strong> to seed all your church records!</li>
                  </ol>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={copySqlToClipboard}
                    className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition"
                  >
                    {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSql ? 'SQL Script Copied!' : 'Copy SQL Migration Script'}</span>
                  </button>

                  <a
                    href={sqlEditorUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition"
                  >
                    <span>Open Supabase SQL Editor</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    type="button"
                    onClick={handlePushData}
                    disabled={isSyncingPush}
                    className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition ml-auto"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Push Seed Data to Cloud</span>
                  </button>
                </div>
              </div>
            )}

            {/* Connection Credentials Form */}
            <form onSubmit={handleSaveSupabaseConfig} className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">Supabase Project URL *</label>
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-emerald-800 hover:text-emerald-950 flex items-center gap-1 font-medium"
                  >
                    <span>Supabase Dashboard</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <input
                  type="url"
                  required
                  placeholder="https://xyzprojectid.supabase.co"
                  value={supabaseUrlInput}
                  onChange={(e) => setSupabaseUrlInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Located under: <strong>Project Settings → API → Project URL</strong>
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Supabase Anon Public API Key *</label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    required
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={supabaseKeyInput}
                    onChange={(e) => setSupabaseKeyInput(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Located under: <strong>Project Settings → API → Project API Keys → anon public</strong>
                </p>
              </div>

              {/* Action Buttons for Connection */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#064e3b] hover:bg-[#047857] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Save & Connect</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || !supabaseUrlInput || !supabaseKeyInput}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-500" />}
                  <span>{isTesting ? 'Testing Ping...' : 'Test Connection'}</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setSupabaseUrlInput(DEFAULT_SUPABASE_URL);
                    setSupabaseKeyInput(DEFAULT_SUPABASE_ANON_KEY);
                    toastInfo('Restoring GWCC Credentials', 'Applying official church project credentials...');
                    const res = await connectSupabase(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);
                    if (res.success) {
                      setTestResult({
                        success: true,
                        message: 'Connected to Greater Works City Church live Supabase cluster!',
                      });
                      toastSuccess('Connected', 'Official Greater Works City Church live database connected!');
                    }
                  }}
                  className="px-3.5 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-800" />
                  <span>Restore Official GWCC Keys</span>
                </button>

                {isConnected && (
                  <button
                    type="button"
                    onClick={disconnectSupabase}
                    className="px-3 py-2 border border-red-200 hover:bg-red-50 text-red-700 font-semibold rounded-xl text-xs ml-auto transition"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </form>

            {/* Test Connection Banner */}
            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex flex-col gap-2 animate-in fade-in ${
                  testResult.tablesStatus === 'tables_missing'
                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                    : testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {testResult.tablesStatus === 'tables_missing' ? (
                    <Database className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  ) : testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-bold">{testResult.message}</p>
                    {testResult.latencyMs !== undefined && (
                      <p className="text-[11px] opacity-80 mt-0.5">Response time: {testResult.latencyMs}ms</p>
                    )}
                  </div>
                </div>

                {testResult.tablesStatus === 'tables_missing' && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/80">
                    <button
                      type="button"
                      onClick={copySqlToClipboard}
                      className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition"
                    >
                      {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSql ? 'Copied!' : 'Copy SQL Script'}</span>
                    </button>
                    <a
                      href={sqlEditorUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition"
                    >
                      <span>Open Supabase SQL Editor</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Error Message if supabaseError */}
            {supabaseError && !testResult && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Database Notice</p>
                  <p className="text-[11px]">{supabaseError}</p>
                </div>
              </div>
            )}

            {/* Cloud Sync & Table Tools */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-xs">Cloud Data Synchronization</h3>
                  <p className="text-[11px] text-slate-500">
                    {lastSyncTime ? `Last synced: ${new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not yet synced with cloud database'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCheckTables}
                  disabled={isCheckingTables || !supabaseUrlInput}
                  className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg flex items-center gap-1 hover:bg-slate-50"
                >
                  <Table className="w-3.5 h-3.5 text-slate-500" />
                  <span>{isCheckingTables ? 'Inspecting...' : 'Verify Tables'}</span>
                </button>
              </div>

              {/* Push & Pull Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handlePushData}
                  disabled={isSyncingPush}
                  className="p-3 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 rounded-xl text-left transition flex items-center justify-between group"
                >
                  <div>
                    <span className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                      <UploadCloud className="w-4 h-4 text-emerald-700" />
                      Push Local Data to Supabase
                    </span>
                    <p className="text-[10px] text-emerald-700 mt-0.5">
                      Populates members, giving, and all tables into Supabase
                    </p>
                  </div>
                  {isSyncingPush && <RefreshCw className="w-4 h-4 text-emerald-700 animate-spin" />}
                </button>

                <button
                  type="button"
                  onClick={handlePullData}
                  disabled={isSyncingPull}
                  className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition flex items-center justify-between group"
                >
                  <div>
                    <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <DownloadCloud className="w-4 h-4 text-slate-700" />
                      Pull Latest from Supabase
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Refreshes app state with cloud database records
                    </p>
                  </div>
                  {isSyncingPull && <RefreshCw className="w-4 h-4 text-slate-700 animate-spin" />}
                </button>
              </div>

              {/* Sync Progress Bar */}
              {syncProgress && (
                <div className="space-y-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <div className="flex justify-between font-semibold text-slate-700 text-[11px]">
                    <span>{syncProgress.message}</span>
                    <span>{syncProgress.percent}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-1.5 rounded-full transition-all duration-200"
                      style={{ width: `${syncProgress.percent}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Sync Result Banner */}
              {syncResult && (
                <div className="space-y-3">
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      syncResult.success
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-red-50 border-red-200 text-red-900'
                    }`}
                  >
                    {syncResult.success ? <Check className="w-4 h-4 text-emerald-700" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
                    <span>{syncResult.text}</span>
                  </div>

                  {/* High-visibility Action Callout if Row-Level Security or Schema Cache Error occurred */}
                  {!syncResult.success &&
                    (syncResult.text.includes('violates row-level security policy') ||
                      syncResult.text.includes('schema cache') ||
                      syncResult.text.includes('column')) && (
                      <div className="p-4 bg-amber-50/90 border-2 border-amber-300 rounded-2xl text-xs space-y-3 animate-in fade-in">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-amber-200 text-amber-950 flex items-center justify-center shrink-0 mt-0.5">
                            <Shield className="w-4 h-4 text-amber-900" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="font-bold text-amber-950 text-sm flex items-center gap-2">
                              <span>Action Required: Row-Level Security (RLS) & Schema Fix</span>
                              <span className="px-2 py-0.5 rounded text-[10px] bg-amber-200 text-amber-900 font-mono font-semibold">
                                Easy 1-Minute Fix
                              </span>
                            </h4>
                            <p className="text-amber-900/90 leading-relaxed text-[11px]">
                              Your Supabase PostgreSQL database tables have Row-Level Security active without public API permissions, or are missing newly added columns (<code className="font-mono bg-amber-200/60 px-1 rounded">general_secretary</code>, <code className="font-mono bg-amber-200/60 px-1 rounded">updated_at</code>). Run our quick SQL script in your Supabase SQL Editor to resolve all 17 errors immediately!
                            </p>
                          </div>
                        </div>

                        <div className="p-3 bg-white/95 rounded-xl border border-amber-200 space-y-2">
                          <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wide">
                            How to solve this in 3 easy steps:
                          </p>
                          <ol className="list-decimal list-inside space-y-1 text-slate-700 text-xs pl-1">
                            <li>Click the green <strong>"Copy RLS & Schema Fix SQL"</strong> button below.</li>
                            <li>Click <strong>"Open Supabase SQL Editor"</strong>, paste the script into the query box, and click <strong>"Run" (▶)</strong>.</li>
                            <li>Return here and click <strong>"Push Local Data to Supabase"</strong> — your data will sync cleanly!</li>
                          </ol>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={copyFixSqlToClipboard}
                            className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition"
                          >
                            {copiedFixSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedFixSql ? 'Fix Script Copied!' : 'Copy RLS & Schema Fix SQL'}</span>
                          </button>

                          <a
                            href={sqlEditorUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition"
                          >
                            <span>Open Supabase SQL Editor</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>

                          <button
                            type="button"
                            onClick={() => setShowSqlEditor(!showSqlEditor)}
                            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold rounded-xl text-xs transition ml-auto"
                          >
                            {showSqlEditor ? 'Hide SQL Code' : 'View Fix Script'}
                          </button>
                        </div>
                      </div>
                    )}
                </div>
              )}

              {/* Table Inspection Result */}
              {tableStatus && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between font-bold text-slate-800">
                    <span>Database Schema Status:</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        tableStatus.ready
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {tableStatus.ready ? 'All 16 Tables Ready' : `${tableStatus.missing.length} Tables Missing`}
                    </span>
                  </div>
                  {tableStatus.missing.length > 0 && (
                    <div className="text-[11px] text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200">
                      Missing tables: <code>{tableStatus.missing.join(', ')}</code>. Run the SQL migration script below in your Supabase SQL Editor.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Migration SQL Script Hub */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-emerald-800" />
                <h3 className="font-bold text-slate-900 text-sm">PostgreSQL Schema & SQL Migration Script</h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyFixSqlToClipboard}
                  className="px-3 py-1.5 text-xs font-semibold text-amber-900 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 rounded-lg flex items-center gap-1 border border-amber-300 transition"
                  title="Copy 1-minute quick script to fix RLS and missing columns"
                >
                  {copiedFixSql ? <Check className="w-3.5 h-3.5 text-amber-700" /> : <Shield className="w-3.5 h-3.5 text-amber-600" />}
                  <span>{copiedFixSql ? 'Copied RLS Fix!' : 'Copy RLS Fix Script'}</span>
                </button>

                <button
                  type="button"
                  onClick={copySqlToClipboard}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 rounded-lg flex items-center gap-1 border border-emerald-200 transition"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? 'Copied Full SQL!' : 'Copy Full Schema'}</span>
                </button>

                <button
                  type="button"
                  onClick={downloadSqlScript}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg flex items-center gap-1 border border-slate-200 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .sql</span>
                </button>
              </div>
            </div>

            {/* 3-Step Setup Instructions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="font-bold text-slate-900 flex items-center gap-1 text-[11px]">
                  <span className="w-4 h-4 rounded-full bg-emerald-800 text-white flex items-center justify-center text-[10px]">1</span>
                  Create Supabase Project
                </span>
                <p className="text-[11px] text-slate-500">
                  Create a new project at <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-emerald-800 underline">supabase.com</a>.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="font-bold text-slate-900 flex items-center gap-1 text-[11px]">
                  <span className="w-4 h-4 rounded-full bg-emerald-800 text-white flex items-center justify-center text-[10px]">2</span>
                  Run SQL in Editor
                </span>
                <p className="text-[11px] text-slate-500">
                  Open <strong>SQL Editor</strong> in Supabase, paste this script, and click <strong>Run</strong>.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="font-bold text-slate-900 flex items-center gap-1 text-[11px]">
                  <span className="w-4 h-4 rounded-full bg-emerald-800 text-white flex items-center justify-center text-[10px]">3</span>
                  Connect & Sync
                </span>
                <p className="text-[11px] text-slate-500">
                  Enter your Project URL & Anon Key above, then click <strong>Push Local Data</strong>.
                </p>
              </div>
            </div>

            {/* Toggleable SQL Code View */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowSqlEditor(!showSqlEditor)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
              >
                <span>{showSqlEditor ? 'Hide SQL Script Preview' : 'Show SQL Script Preview'}</span>
                <span className="text-[10px] text-slate-400">({SQL_MIGRATION_SCHEMA.split('\n').length} lines)</span>
              </button>

              {showSqlEditor && (
                <pre className="p-3.5 bg-slate-950 text-emerald-400 font-mono text-[10px] rounded-xl overflow-x-auto max-h-56 border border-slate-800 animate-in fade-in">
                  {SQL_MIGRATION_SCHEMA}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: BACKUP & MAINTENANCE */}
      {activeTab === 'backup' && (
        <div className="space-y-6 max-w-4xl">
          {/* JSON Full Database Backup */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileJson className="w-5 h-5 text-emerald-700" />
                Church Database Backup & Archival Export
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Download an unencrypted, complete snapshot of all church records, members, financial transactions, pledges, and attendance logs.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Members</span>
                  <strong className="text-slate-800 text-sm">{members.length}</strong>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Visitors</span>
                  <strong className="text-slate-800 text-sm">{visitors.length}</strong>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Giving Records</span>
                  <strong className="text-emerald-800 text-sm">{giving.length}</strong>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Cell Fellowships</span>
                  <strong className="text-slate-800 text-sm">{smallGroups.length}</strong>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-slate-500 text-[11px]">
                  Format: Standard JSON format with ISO timestamped envelope.
                </p>
                <button
                  type="button"
                  onClick={handleExportFullJsonBackup}
                  className="px-4 py-2 bg-[#064e3b] hover:bg-[#047857] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Full JSON Backup</span>
                </button>
              </div>
            </div>
          </div>

          {/* Reset Clean Data */}
          <div className="bg-white p-6 rounded-2xl border border-rose-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-rose-800">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <h3 className="font-bold text-base text-slate-900">Restore Clean Ghanaian Congregation Seed Records</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              If your database has corrupted test records or you wish to start over with clean Greater Works City Church (Joma) assembly records, you can reset the state back to the original Ghanaian congregation seed data.
            </p>

            <div className="pt-2 flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  if (confirm('Are you sure you want to reset all records back to the initial Ghanaian seed data?')) {
                    resetToDefaultData();
                    toastSuccess('Reset Completed', 'Initial clean congregation seed data restored.');
                  }
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Clean Seed Data</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
