import React, { useState, useMemo } from 'react';
import {
  X,
  FileText,
  Download,
  Printer,
  Calendar,
  Settings2,
  CheckCircle,
  FileCheck,
  Building,
  Coins,
  Users,
  UserCheck,
  Award,
  Sparkles,
  ChevronRight,
  Eye,
  Network,
  Target,
} from 'lucide-react';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  ReportTemplateType,
  PdfExportOptions,
  generateChurchReportPdf,
  formatGHS,
} from '../lib/pdfReportGenerator';

interface ReportPdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTemplate?: ReportTemplateType;
  initialStartDate?: string;
  initialEndDate?: string;
}

const TEMPLATES: Array<{
  id: ReportTemplateType;
  title: string;
  badge: string;
  description: string;
  icon: React.ElementType;
  defaultOrientation: 'portrait' | 'landscape';
  category: 'finance' | 'membership' | 'attendance' | 'executive';
}> = [
  {
    id: 'financial_ledger',
    title: 'Financial Ledger & Giving Register',
    badge: 'Detailed Ledger',
    description: 'Itemized transaction records of all tithes, offerings, building funds, and mobile money giving.',
    icon: Coins,
    defaultOrientation: 'landscape',
    category: 'finance',
  },
  {
    id: 'financial_executive_summary',
    title: 'Executive Financial & Treasury Statement',
    badge: 'Treasury Audit',
    description: 'Comprehensive high-level balance sheet, income category breakdown, expenditure by department, and pledge analysis.',
    icon: Award,
    defaultOrientation: 'portrait',
    category: 'finance',
  },
  {
    id: 'membership_roster',
    title: 'Official Membership Register & Directory',
    badge: 'Congregational',
    description: 'Complete verified directory of church disciples with contacts, GhanaPost GPS addresses, and ministries.',
    icon: Users,
    defaultOrientation: 'landscape',
    category: 'membership',
  },
  {
    id: 'attendance_register',
    title: 'Worship Service Attendance Register',
    badge: 'Engagement',
    description: 'Official attendance logs, Sunday service headcounts, check-in channels, and member vs visitor ratio.',
    icon: UserCheck,
    defaultOrientation: 'portrait',
    category: 'attendance',
  },
  {
    id: 'visitor_follow_up',
    title: 'First-Time Visitors & Evangelism Report',
    badge: 'Souls Care',
    description: 'New visitor registration, follow-up milestone tracking, prayer requests, and member conversion metrics.',
    icon: FileCheck,
    defaultOrientation: 'portrait',
    category: 'attendance',
  },
  {
    id: 'comprehensive_executive',
    title: 'Quarterly Executive Intelligence Dossier',
    badge: 'Executive',
    description: 'All-inclusive administrative summary uniting finances, discipleship numbers, attendance, and project funds.',
    icon: Building,
    defaultOrientation: 'portrait',
    category: 'executive',
  },
  {
    id: 'small_groups',
    title: 'Cell Fellowship & Home Disciples Directory',
    badge: 'Cell Network',
    description: 'Directory of territorial cell fellowships, cell leaders, schedules, zones, and disciple counts.',
    icon: Network,
    defaultOrientation: 'landscape',
    category: 'membership',
  },
  {
    id: 'pledges_audit',
    title: 'Capital Projects & Faith Pledges Audit',
    badge: 'Pledges Audit',
    description: 'Official audit ledger of building campaign pledges, total redeemed capital, and outstanding balances.',
    icon: Target,
    defaultOrientation: 'landscape',
    category: 'finance',
  },
];

export const ReportPdfExportModal: React.FC<ReportPdfExportModalProps> = ({
  isOpen,
  onClose,
  defaultTemplate = 'financial_executive_summary',
  initialStartDate,
  initialEndDate,
}) => {
  const { members, visitors, attendance, giving, expenses, pledges, settings, smallGroups, ministries } = useChurchData();
  const { currentUser } = useAuth();
  const { success, error: toastError } = useToast();

  const currentYear = new Date().getFullYear();
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplateType>(defaultTemplate);
  const [startDate, setStartDate] = useState(initialStartDate || `${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(initialEndDate || `${currentYear}-12-31`);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [includeSignatures, setIncludeSignatures] = useState(true);
  const [includeSummaryKpis, setIncludeSummaryKpis] = useState(true);
  const [includeOfficialSeal, setIncludeOfficialSeal] = useState(true);
  const [preparedBy, setPreparedBy] = useState(
    currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Church Administrator'
  );
  const [preparedRole, setPreparedRole] = useState(
    currentUser?.role ? currentUser.role.replace(/_/g, ' ').toUpperCase() : 'SUPER ADMIN'
  );
  const [customNotes, setCustomNotes] = useState(
    'Certified authentic ecclesiastical record prepared for church archive and ministerial review.'
  );
  const [isGenerating, setIsGenerating] = useState(false);

  // Sync orientation when template changes
  const handleSelectTemplate = (id: ReportTemplateType) => {
    setSelectedTemplate(id);
    const tmpl = TEMPLATES.find((t) => t.id === id);
    if (tmpl) {
      setOrientation(tmpl.defaultOrientation);
    }
  };

  // Quick Date Range Presets
  const applyDatePreset = (preset: 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'all_time') => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();

    if (preset === 'this_month') {
      const first = new Date(y, m, 1).toISOString().split('T')[0];
      const last = new Date(y, m + 1, 0).toISOString().split('T')[0];
      setStartDate(first);
      setEndDate(last);
    } else if (preset === 'last_month') {
      const first = new Date(y, m - 1, 1).toISOString().split('T')[0];
      const last = new Date(y, m, 0).toISOString().split('T')[0];
      setStartDate(first);
      setEndDate(last);
    } else if (preset === 'this_quarter') {
      const qMonth = Math.floor(m / 3) * 3;
      const first = new Date(y, qMonth, 1).toISOString().split('T')[0];
      const last = new Date(y, qMonth + 3, 0).toISOString().split('T')[0];
      setStartDate(first);
      setEndDate(last);
    } else if (preset === 'this_year') {
      setStartDate(`${y}-01-01`);
      setEndDate(`${y}-12-31`);
    } else if (preset === 'all_time') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Filtered stats for preview
  const previewStats = useMemo(() => {
    const filteredGiving = giving.filter((g) => {
      if (startDate && g.date < startDate) return false;
      if (endDate && g.date > endDate) return false;
      return true;
    });

    const filteredExpenses = expenses.filter((e) => {
      if (startDate && e.date < startDate) return false;
      if (endDate && e.date > endDate) return false;
      return true;
    });

    const filteredAttendance = attendance.filter((a) => {
      if (startDate && a.date < startDate) return false;
      if (endDate && a.date > endDate) return false;
      return true;
    });

    const filteredVisitors = visitors.filter((v) => {
      if (startDate && v.visit_date < startDate) return false;
      if (endDate && v.visit_date > endDate) return false;
      return true;
    });

    const totalIncome = filteredGiving.reduce((s, g) => s + g.amount, 0);
    const totalExp = filteredExpenses.reduce((s, e) => s + e.amount, 0);

    return {
      givingCount: filteredGiving.length,
      totalIncome,
      expensesCount: filteredExpenses.length,
      totalExpense: totalExp,
      netSurplus: totalIncome - totalExp,
      membersCount: members.filter((m) => !m.is_archived).length,
      attendanceCount: filteredAttendance.length,
      visitorsCount: filteredVisitors.length,
    };
  }, [giving, expenses, attendance, visitors, members, startDate, endDate]);

  const generateOptions = (): PdfExportOptions => ({
    template: selectedTemplate,
    startDate,
    endDate,
    orientation,
    includeSignatures,
    includeSummaryKpis,
    includeOfficialSeal,
    preparedBy,
    preparedRole,
    notes: customNotes,
  });

  const getReportFilename = () => {
    const dateStamp = new Date().toISOString().split('T')[0];
    return `GWCC_${selectedTemplate.toUpperCase()}_${dateStamp}.pdf`;
  };

  // Download Action
  const handleDownloadPdf = async () => {
    try {
      setIsGenerating(true);
      const options = generateOptions();
      const doc = generateChurchReportPdf(
        {
          settings,
          members,
          visitors,
          attendance,
          giving,
          expenses,
          pledges,
          smallGroups,
          ministries,
          currentUser,
        },
        options
      );

      const filename = getReportFilename();
      doc.save(filename);
      success('PDF Document Downloaded', `Successfully exported ${filename}`);
      setIsGenerating(false);
      onClose();
    } catch (err: any) {
      console.error('PDF Generation failed:', err);
      toastError('Export Failed', err.message || 'Could not generate PDF document');
      setIsGenerating(false);
    }
  };

  // Print Action
  const handlePrintPdf = async () => {
    try {
      setIsGenerating(true);
      const options = generateOptions();
      const doc = generateChurchReportPdf(
        {
          settings,
          members,
          visitors,
          attendance,
          giving,
          expenses,
          pledges,
          smallGroups,
          ministries,
          currentUser,
        },
        options
      );

      doc.autoPrint();
      const blobUrl = doc.output('bloburl');
      const url = blobUrl as unknown as string;
      
      try {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.src = url;
        document.body.appendChild(iframe);
        iframe.onload = () => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch {
            doc.save(getReportFilename());
          }
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 60000);
        };
      } catch {
        doc.save(getReportFilename());
      }
      success('Print Stream Initiated', 'Document dispatched to system print preview');
      setIsGenerating(false);
    } catch (err: any) {
      console.error('PDF Print failed:', err);
      toastError('Print Error', err.message || 'Could not initiate print stream');
      setIsGenerating(false);
    }
  };

  // Preview Action
  const handlePreviewPdf = async () => {
    try {
      setIsGenerating(true);
      const options = generateOptions();
      const doc = generateChurchReportPdf(
        {
          settings,
          members,
          visitors,
          attendance,
          giving,
          expenses,
          pledges,
          currentUser,
        },
        options
      );

      const blobUrl = doc.output('bloburl');
      const a = document.createElement('a');
      a.href = blobUrl as unknown as string;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
      setIsGenerating(false);
    } catch (err: any) {
      console.error('Preview failed:', err);
      toastError('Preview Failed', err.message || 'Could not open preview');
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#064e3b] via-[#065f46] to-[#047857] text-white p-5 sm:p-6 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-emerald-200 shadow-inner">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">Export Official PDF Report</h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black uppercase tracking-wider">
                  Print Records
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                Generate formatted archival PDF reports with church letterhead, currency totals (GH₵), and sign-off blocks.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition border border-white/10"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* 1. Template Selection Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-black">
                  1
                </span>
                Select Report Template
              </label>
              <span className="text-[11px] text-slate-500">6 Formats Available</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {TEMPLATES.map((tmpl) => {
                const Icon = tmpl.icon;
                const isSelected = selectedTemplate === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tmpl.id)}
                    className={`text-left p-3.5 rounded-2xl border transition relative flex flex-col justify-between ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                            isSelected ? 'bg-[#064e3b] text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isSelected ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {tmpl.badge}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 leading-snug">{tmpl.title}</h4>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {tmpl.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                      <span>Default: {tmpl.defaultOrientation}</span>
                      {isSelected && (
                        <span className="flex items-center gap-1 text-emerald-700 font-bold">
                          <CheckCircle className="w-3 h-3" />
                          Selected
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Filters & Formatting Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-slate-100">
            {/* Left Column: Date Range and Presets */}
            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-black">
                  2
                </span>
                Reporting Period
              </label>

              {/* Date Presets */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyDatePreset('this_month')}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => applyDatePreset('last_month')}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  Last Month
                </button>
                <button
                  type="button"
                  onClick={() => applyDatePreset('this_quarter')}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  This Quarter
                </button>
                <button
                  type="button"
                  onClick={() => applyDatePreset('this_year')}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  Full Year 2026
                </button>
                <button
                  type="button"
                  onClick={() => applyDatePreset('all_time')}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  All History
                </button>
              </div>

              {/* Date Pickers */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                  />
                </div>
              </div>

              {/* Prepared By & Role */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Prepared By</label>
                  <input
                    type="text"
                    value={preparedBy}
                    onChange={(e) => setPreparedBy(e.target.value)}
                    placeholder="Officer Name"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Officer Role / Designation</label>
                  <input
                    type="text"
                    value={preparedRole}
                    onChange={(e) => setPreparedRole(e.target.value)}
                    placeholder="Title"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Customization Toggles & Orientation */}
            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-black">
                  3
                </span>
                Document Options & Page Layout
              </label>

              {/* Orientation Buttons */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Page Orientation</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrientation('portrait')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                      orientation === 'portrait'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-2xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-3.5 h-5 border border-current rounded-[2px]" />
                    <span>Portrait (A4 Vertical)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrientation('landscape')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                      orientation === 'landscape'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-2xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-5 h-3.5 border border-current rounded-[2px]" />
                    <span>Landscape (Wide Table)</span>
                  </button>
                </div>
              </div>

              {/* Inclusion Toggles */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-semibold text-slate-700">Include Executive KPI Summary Cards</span>
                  <input
                    type="checkbox"
                    checked={includeSummaryKpis}
                    onChange={(e) => setIncludeSummaryKpis(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-semibold text-slate-700">Include Official Signatures (Pastor & Finance)</span>
                  <input
                    type="checkbox"
                    checked={includeSignatures}
                    onChange={(e) => setIncludeSignatures(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-semibold text-slate-700">Include Official GWCC Verification Stamp</span>
                  <input
                    type="checkbox"
                    checked={includeOfficialSeal}
                    onChange={(e) => setIncludeOfficialSeal(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-500"
                  />
                </label>
              </div>

              {/* Notes input */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Document Notes / Endorsement</label>
                <input
                  type="text"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Optional administrative remarks..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
                />
              </div>
            </div>
          </div>

          {/* 3. Live Metrics Summary Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold tracking-wide uppercase text-slate-300">
                  Data Scope for {startDate && endDate ? `${startDate} to ${endDate}` : 'Complete Database'}
                </span>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">
                {settings.church_name} ({settings.location})
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
              <div>
                <span className="text-[10px] text-slate-400 block">Total Giving Volume</span>
                <span className="text-sm font-bold font-mono text-emerald-400">
                  {formatGHS(previewStats.totalIncome)}
                </span>
                <span className="text-[10px] text-slate-500 block">{previewStats.givingCount} transactions</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block">Operating Outflow</span>
                <span className="text-sm font-bold font-mono text-rose-400">
                  {formatGHS(previewStats.totalExpense)}
                </span>
                <span className="text-[10px] text-slate-500 block">{previewStats.expensesCount} expenses</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block">Active Communicants</span>
                <span className="text-sm font-bold font-mono text-amber-300">
                  {previewStats.membersCount} Members
                </span>
                <span className="text-[10px] text-slate-500 block">Roster count</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block">Service Check-Ins</span>
                <span className="text-sm font-bold font-mono text-blue-300">
                  {previewStats.attendanceCount} Attendances
                </span>
                <span className="text-[10px] text-slate-500 block">{previewStats.visitorsCount} visitors logged</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center gap-1.5 order-2 sm:order-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Ready for high-resolution vector PDF export & printing</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto order-1 sm:order-2">
            <button
              type="button"
              onClick={handlePreviewPdf}
              disabled={isGenerating}
              className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <Eye className="w-4 h-4 text-slate-500" />
              <span>Preview</span>
            </button>

            <button
              type="button"
              onClick={handlePrintPdf}
              disabled={isGenerating}
              className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Print Document</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGenerating}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-[#064e3b] hover:bg-[#047857] text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isGenerating ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
