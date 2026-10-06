import React, { useState, useMemo } from 'react';
import {
  Coins,
  Plus,
  Calendar,
  CheckCircle,
  TrendingUp,
  AlertCircle,
  User,
  CreditCard,
  Building2,
  Search,
  Filter,
  ArrowUpDown,
  Printer,
  Share2,
  ExternalLink,
  Clock,
  Sparkles,
  Phone,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  MoreVertical,
} from 'lucide-react';
import { useChurchData } from '../contexts/ChurchDataContext';
import { PledgeRecord, PledgeCampaign } from '../types/database.types';
import { formatGHS, cleanGhanaPhone } from '../lib/currencyUtils';
import { AddPledgeModal } from '../components/pledges/AddPledgeModal';
import { RecordPledgePaymentModal } from '../components/pledges/RecordPledgePaymentModal';
import { PledgeDossierModal } from '../components/pledges/PledgeDossierModal';
import { CampaignManagerModal } from '../components/pledges/CampaignManagerModal';
import { EditPledgeModal } from '../components/pledges/EditPledgeModal';
import { PrintPledgesModal } from '../components/pledges/PrintPledgesModal';

export const PledgesPage: React.FC = () => {
  const { pledges, campaigns, members, settings } = useChurchData();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'due_date' | 'amount_pledged' | 'balance' | 'name'>('due_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDossierModalOpen, setIsDossierModalOpen] = useState(false);
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Selected item targets
  const [selectedPledge, setSelectedPledge] = useState<PledgeRecord | null>(null);
  const [selectedCampaignToEdit, setSelectedCampaignToEdit] = useState<PledgeCampaign | null>(null);
  const [preselectedCampaignId, setPreselectedCampaignId] = useState<string | undefined>(undefined);

  // Overdue status check helper
  const isPledgeOverdue = (p: PledgeRecord) => {
    if (p.balance <= 0 || !p.due_date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(p.due_date);
    due.setHours(0, 0, 0, 0);
    return due.getTime() < today.getTime();
  };

  // Filter and Sort Pledges
  const filteredPledges = useMemo(() => {
    return pledges
      .filter((p) => {
        // Search Term Filter
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          const matchName = p.member_name.toLowerCase().includes(term);
          const matchCampaign = p.campaign_name.toLowerCase().includes(term);
          const matchPhone = (p.member_phone || '').includes(term);
          const matchNotes = (p.notes || '').toLowerCase().includes(term);
          if (!matchName && !matchCampaign && !matchPhone && !matchNotes) {
            return false;
          }
        }

        // Campaign Filter
        if (selectedCampaignFilter !== 'all') {
          if (p.campaign_id !== selectedCampaignFilter && p.campaign_name !== selectedCampaignFilter) {
            return false;
          }
        }

        // Status Filter
        if (selectedStatusFilter !== 'all') {
          if (selectedStatusFilter === 'overdue') {
            if (!isPledgeOverdue(p)) return false;
          } else if (selectedStatusFilter === 'completed') {
            if (p.balance > 0) return false;
          } else if (selectedStatusFilter === 'partially_paid') {
            if (p.amount_paid === 0 || p.balance === 0) return false;
          } else if (selectedStatusFilter === 'active') {
            if (p.amount_paid > 0) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        let comp = 0;
        if (sortBy === 'amount_pledged') {
          comp = a.amount_pledged - b.amount_pledged;
        } else if (sortBy === 'balance') {
          comp = a.balance - b.balance;
        } else if (sortBy === 'name') {
          comp = a.member_name.localeCompare(b.member_name);
        } else {
          // due_date
          const da = a.due_date ? new Date(a.due_date).getTime() : 9999999999999;
          const db = b.due_date ? new Date(b.due_date).getTime() : 9999999999999;
          comp = da - db;
        }
        return sortDirection === 'asc' ? comp : -comp;
      });
  }, [pledges, searchTerm, selectedCampaignFilter, selectedStatusFilter, sortBy, sortDirection]);

  // Aggregate Metrics across all pledges
  const totalPledged = pledges.reduce((sum, p) => sum + p.amount_pledged, 0);
  const totalPaid = pledges.reduce((sum, p) => sum + p.amount_paid, 0);
  const totalBalance = pledges.reduce((sum, p) => sum + p.balance, 0);
  const realizedPercent = totalPledged > 0 ? ((totalPaid / totalPledged) * 100).toFixed(1) : '0';

  const completedCount = pledges.filter((p) => p.balance === 0).length;
  const partialCount = pledges.filter((p) => p.amount_paid > 0 && p.balance > 0).length;
  const overdueCount = pledges.filter((p) => isPledgeOverdue(p)).length;

  // Aggregate target across all active campaigns
  const totalCampaignTarget = campaigns.reduce((s, c) => s + (c.is_active ? c.target_amount : 0), 0);

  // Quick WhatsApp trigger
  const handleQuickWhatsApp = (p: PledgeRecord) => {
    const phone = cleanGhanaPhone(p.member_phone);
    const name = p.member_name.split(' ')[0] || 'Beloved';
    const text = encodeURIComponent(
      `Calvary greetings ${name} from ${settings.church_name}! 🙌\n\nGentle update on your kingdom pledge for *${p.campaign_name}*:\n• Total Vowed: ${formatGHS(p.amount_pledged)}\n• Redeemed: ${formatGHS(p.amount_paid)}\n• Current Balance: ${formatGHS(p.balance)}\n\nYou may remit via ${settings.phone ? `MoMo: ${settings.phone} (${settings.short_name || 'Church'} Project Acct)` : 'the church treasury'}. God multiply your seed sown!`
    );
    const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-purple-700/10 border border-purple-200 flex items-center justify-center text-purple-800">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                Pledge Campaigns & Kingdom Commitments
              </h1>
              <p className="text-xs text-slate-500">
                Cathedral expansion, bus procurement, and developmental covenants in Ghana Cedi (GH₵)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Registry</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedCampaignToEdit(null);
              setIsCampaignModalOpen(true);
            }}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
          >
            <Building2 className="w-3.5 h-3.5 text-purple-300" />
            <span>+ New Campaign</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPreselectedCampaignId(undefined);
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Record Pledge</span>
          </button>
        </div>
      </div>

      {/* Financial Executive Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pledged */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Pledged</span>
            <span className="p-1.5 bg-purple-50 text-purple-700 rounded-lg">
              <Coins className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
            {formatGHS(totalPledged)}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>{pledges.length} total commitments</span>
            <span className="font-semibold text-purple-800">
              {totalCampaignTarget > 0 ? ((totalPledged / totalCampaignTarget) * 100).toFixed(0) : 0}% of target
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-purple-600 h-1.5 rounded-full"
              style={{
                width: `${Math.min(100, totalCampaignTarget > 0 ? (totalPledged / totalCampaignTarget) * 100 : 0)}%`,
              }}
            />
          </div>
        </div>

        {/* Redeemed & Collected */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Redeemed & Paid
            </span>
            <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <CheckCircle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono tracking-tight">
            {formatGHS(totalPaid)}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">{completedCount} fully completed</span>
            <span className="font-bold text-emerald-700 font-mono">{realizedPercent}% Realized</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full"
              style={{ width: `${Math.min(100, parseFloat(realizedPercent))}%` }}
            />
          </div>
        </div>

        {/* Outstanding Balance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-purple-900 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Outstanding Balance
            </span>
            <span className="p-1.5 bg-purple-50 text-purple-800 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-purple-900 font-mono tracking-tight">
            {formatGHS(totalBalance)}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>{partialCount} in installments</span>
            <span className="font-semibold text-slate-700">Remaining vows</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-purple-800 h-1.5 rounded-full"
              style={{
                width: `${Math.min(100, totalPledged > 0 ? (totalBalance / totalPledged) * 100 : 0)}%`,
              }}
            />
          </div>
        </div>

        {/* Overdue & Health Indicator */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Maturity Status</span>
            <span className={`p-1.5 rounded-lg ${overdueCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
              <AlertCircle className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <div className={`text-2xl font-black font-mono tracking-tight ${overdueCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {overdueCount}
            </div>
            <span className="text-xs font-semibold text-slate-500">past due date</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">
              {pledges.length > 0
                ? `${Math.round(((pledges.length - overdueCount) / pledges.length) * 100)}% on schedule`
                : 'No pledges'}
            </span>
            {overdueCount > 0 && (
              <button
                type="button"
                onClick={() => setSelectedStatusFilter('overdue')}
                className="text-rose-600 font-bold hover:underline"
              >
                View Overdue →
              </button>
            )}
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className={`${overdueCount > 0 ? 'bg-rose-500' : 'bg-emerald-500'} h-1.5 rounded-full`}
              style={{
                width: `${pledges.length > 0 ? Math.min(100, ((pledges.length - overdueCount) / pledges.length) * 100) : 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Capital Projects / Campaigns Showcase */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-700" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Active Capital Campaigns ({campaigns.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedCampaignToEdit(null);
              setIsCampaignModalOpen(true);
            }}
            className="text-xs font-semibold text-purple-700 hover:text-purple-900 hover:underline flex items-center gap-1"
          >
            <span>+ Add Campaign</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((camp) => {
            const campPledges = pledges.filter(
              (p) => p.campaign_id === camp.id || p.campaign_name === camp.name
            );
            const committed = campPledges.reduce((s, p) => s + p.amount_pledged, 0);
            const collected = campPledges.reduce((s, p) => s + p.amount_paid, 0);
            const percentOfTarget =
              camp.target_amount > 0 ? Math.min(100, Math.round((committed / camp.target_amount) * 100)) : 0;
            const percentRedeemed =
              committed > 0 ? Math.min(100, Math.round((collected / committed) * 100)) : 0;

            const isSelected = selectedCampaignFilter === camp.name || selectedCampaignFilter === camp.id;

            return (
              <div
                key={camp.id}
                className={`bg-white rounded-2xl border transition shadow-xs p-5 space-y-3.5 relative flex flex-col justify-between ${
                  isSelected ? 'border-purple-600 ring-2 ring-purple-600/10' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-1">
                      {camp.name}
                    </h3>
                    <span
                      className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        camp.is_active
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {camp.is_active ? 'Active' : 'Closed'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                    {camp.description || `Church infrastructural covenant project for ${settings.branch_name || settings.church_name}.`}
                  </p>
                </div>

                {/* Numbers Grid */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Fundraising Target:</span>
                    <span className="font-mono font-bold text-slate-900">{formatGHS(camp.target_amount)}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Committed ({campPledges.length} vows):</span>
                    <span className="font-mono font-bold text-purple-900">{formatGHS(committed)}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Redeemed & Collected:</span>
                    <span className="font-mono font-bold text-emerald-700">{formatGHS(collected)}</span>
                  </div>

                  {/* Dual-layer Progress Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[10px] text-slate-400 font-semibold font-mono">
                      <span>Target Reach: {percentOfTarget}%</span>
                      <span>Realized: {percentRedeemed}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden relative">
                      {/* Committed layer */}
                      <div
                        className="bg-purple-200 h-2.5 rounded-full absolute top-0 left-0"
                        style={{ width: `${percentOfTarget}%` }}
                      />
                      {/* Collected layer */}
                      <div
                        className="bg-emerald-500 h-2.5 rounded-full absolute top-0 left-0"
                        style={{
                          width: `${camp.target_amount > 0 ? Math.min(100, (collected / camp.target_amount) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-2 flex items-center justify-between text-xs gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedCampaignFilter('all');
                      } else {
                        setSelectedCampaignFilter(camp.name);
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-lg font-semibold transition ${
                      isSelected
                        ? 'bg-purple-700 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {isSelected ? 'Viewing Commitments' : 'Filter Commitments'}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCampaignToEdit(camp);
                        setIsCampaignModalOpen(true);
                      }}
                      className="px-2 py-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                      title="Edit Campaign Details"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPreselectedCampaignId(camp.id);
                        setIsAddModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold rounded-lg border border-purple-200 transition"
                    >
                      + Pledge
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter, Search & Tabs Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        {/* Top Filter Row: Search & Dropdowns */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search member, phone, campaign, or vow note..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-purple-600 focus:outline-hidden transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Campaign and Sort controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Campaign Select */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="font-semibold">Project:</span>
              <select
                value={selectedCampaignFilter}
                onChange={(e) => setSelectedCampaignFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-hidden"
              >
                <option value="all">All Projects ({pledges.length})</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Select */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-hidden"
              >
                <option value="due_date">Due Date</option>
                <option value="balance">Remaining Balance</option>
                <option value="amount_pledged">Amount Pledged</option>
                <option value="name">Member Name</option>
              </select>
              <button
                type="button"
                onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition"
                title={`Sort ${sortDirection === 'asc' ? 'Descending' : 'Ascending'}`}
              >
                {sortDirection === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <button
              type="button"
              onClick={() => setSelectedStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition ${
                selectedStatusFilter === 'all'
                  ? 'bg-purple-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Pledges ({pledges.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedStatusFilter('active')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition ${
                selectedStatusFilter === 'active'
                  ? 'bg-purple-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Active Pending ({pledges.filter((p) => p.amount_paid === 0).length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedStatusFilter('partially_paid')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition ${
                selectedStatusFilter === 'partially_paid'
                  ? 'bg-purple-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Installments ({partialCount})
            </button>

            <button
              type="button"
              onClick={() => setSelectedStatusFilter('completed')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition ${
                selectedStatusFilter === 'completed'
                  ? 'bg-purple-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Completed ({completedCount})
            </button>

            <button
              type="button"
              onClick={() => setSelectedStatusFilter('overdue')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition ${
                selectedStatusFilter === 'overdue'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              Overdue ({overdueCount})
            </button>
          </div>

          <div className="text-xs text-slate-400 font-mono">
            Showing <strong>{filteredPledges.length}</strong> of {pledges.length} records
          </div>
        </div>
      </div>

      {/* Main High-Density Pledges Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              <tr>
                <th className="py-3 px-4">Member Name & Contact</th>
                <th className="py-3 px-4">Campaign Project</th>
                <th className="py-3 px-4 text-right">Pledged (GH₵)</th>
                <th className="py-3 px-4 text-right">Paid (GH₵)</th>
                <th className="py-3 px-4 text-right">Balance (GH₵)</th>
                <th className="py-3 px-4">Redemption</th>
                <th className="py-3 px-4">Target Due Date</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPledges.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Coins className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600">No pledge commitments found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Try adjusting your filters or click "+ Record Pledge" to enter a new covenant.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredPledges.map((plg) => {
                  const overdue = isPledgeOverdue(plg);
                  const pct =
                    plg.amount_pledged > 0
                      ? Math.min(100, Math.round((plg.amount_paid / plg.amount_pledged) * 100))
                      : 0;

                  return (
                    <tr
                      key={plg.id}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                      onClick={() => {
                        setSelectedPledge(plg);
                        setIsDossierModalOpen(true);
                      }}
                    >
                      {/* Member Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-800 font-bold flex items-center justify-center text-xs shrink-0">
                            {plg.member_name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 hover:text-purple-800 transition">
                              {plg.member_name}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                              {plg.member_phone ? (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  {plg.member_phone}
                                </span>
                              ) : (
                                <span>No phone</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Campaign Name */}
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-800 line-clamp-1">
                          {plg.campaign_name}
                        </span>
                        {plg.notes && (
                          <span className="text-[10px] text-slate-400 italic line-clamp-1">
                            {plg.notes}
                          </span>
                        )}
                      </td>

                      {/* Pledged */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-right">
                        {plg.amount_pledged.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Paid */}
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-700 text-right">
                        {plg.amount_paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Balance */}
                      <td className="py-3.5 px-4 font-mono font-bold text-purple-900 text-right">
                        {plg.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Progress */}
                      <td className="py-3.5 px-4 min-w-[120px]">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono text-slate-500">
                            <span>{pct}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${
                                plg.balance === 0
                                  ? 'bg-emerald-500'
                                  : pct > 50
                                  ? 'bg-purple-700'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Due Date & Overdue Badge */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="font-mono text-slate-700 text-[11px]">
                            {plg.due_date || 'Open'}
                          </div>
                          {overdue && (
                            <span className="inline-block text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                              Past Due
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`text-[9px] font-bold uppercase px-2.5 py-0.5 rounded-full inline-block ${
                            plg.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : plg.status === 'partially_paid'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {plg.status.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td
                        className="py-3.5 px-4 text-right"
                        onClick={(e) => e.stopPropagation()} // don't trigger row click
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          {plg.balance > 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPledge(plg);
                                setIsPaymentModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white font-bold rounded-lg text-[11px] transition shadow-2xs"
                            >
                              + Pay
                            </button>
                          ) : (
                            <span className="text-emerald-700 font-semibold text-[11px] flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Redeemed
                            </span>
                          )}

                          {plg.balance > 0 && plg.member_phone && (
                            <button
                              type="button"
                              onClick={() => handleQuickWhatsApp(plg)}
                              className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition border border-emerald-200"
                              title="Send WhatsApp Payment Reminder"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPledge(plg);
                              setIsDossierModalOpen(true);
                            }}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                            title="View Pledge Dossier"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Encouraging Pastoral Scripture Banner */}
      <div className="p-4 bg-gradient-to-r from-purple-900 to-indigo-950 text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-700/60 border border-purple-400/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <div className="font-semibold text-xs text-purple-100 italic">
              "Go up to the mountain, and bring wood, and build the house; and I will take pleasure in it, and I will be glorified, saith the LORD."
            </div>
            <p className="text-[10px] text-purple-300 mt-0.5">— Haggai 1:8 • {settings.church_name} Sanctuary Development</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs shrink-0">
          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl font-semibold transition"
          >
            Export All Pledges
          </button>
        </div>
      </div>

      {/* ALL MODALS */}
      <AddPledgeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        preselectedCampaignId={preselectedCampaignId}
      />

      <RecordPledgePaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedPledge(null);
        }}
        pledge={selectedPledge}
      />

      <PledgeDossierModal
        isOpen={isDossierModalOpen}
        onClose={() => {
          setIsDossierModalOpen(false);
          setSelectedPledge(null);
        }}
        pledge={selectedPledge}
        onOpenPaymentModal={(p) => {
          setSelectedPledge(p);
          setIsPaymentModalOpen(true);
        }}
        onOpenEditModal={(p) => {
          setSelectedPledge(p);
          setIsEditModalOpen(true);
        }}
      />

      <CampaignManagerModal
        isOpen={isCampaignModalOpen}
        onClose={() => {
          setIsCampaignModalOpen(false);
          setSelectedCampaignToEdit(null);
        }}
        campaignToEdit={selectedCampaignToEdit}
      />

      <EditPledgeModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedPledge(null);
        }}
        pledge={selectedPledge}
      />

      <PrintPledgesModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        pledgesList={pledges}
      />
    </div>
  );
};
