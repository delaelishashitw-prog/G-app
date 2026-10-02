import React, { useState } from 'react';
import {
  X,
  User,
  Phone,
  Calendar,
  Coins,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageSquare,
  Copy,
  Printer,
  CreditCard,
  Building2,
  Share2,
} from 'lucide-react';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { PledgeRecord } from '../../types/database.types';
import { formatGHS, cleanGhanaPhone, numberToCedisWords } from '../../lib/currencyUtils';

interface PledgeDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  pledge: PledgeRecord | null;
  onOpenPaymentModal: (pledge: PledgeRecord) => void;
  onOpenEditModal: (pledge: PledgeRecord) => void;
}

export const PledgeDossierModal: React.FC<PledgeDossierModalProps> = ({
  isOpen,
  onClose,
  pledge,
  onOpenPaymentModal,
  onOpenEditModal,
}) => {
  const { settings, members, giving } = useChurchData();
  const [selectedTemplate, setSelectedTemplate] = useState<'friendly' | 'milestone' | 'yearend'>('friendly');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !pledge) return null;

  const member = members.find((m) => m.id === pledge.member_id);
  const memberPhone = pledge.member_phone || member?.phone || '';
  const cleanPhone = cleanGhanaPhone(memberPhone);

  const pctRedeemed =
    pledge.amount_pledged > 0
      ? Math.min(100, Math.round((pledge.amount_paid / pledge.amount_pledged) * 100))
      : 0;

  // Calculate days remaining or overdue
  let dueNotice = '';
  let isOverdue = false;
  if (pledge.due_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(pledge.due_date);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (pledge.balance <= 0) {
      dueNotice = 'Pledge fully redeemed and fulfilled';
    } else if (diffDays < 0) {
      isOverdue = true;
      dueNotice = `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`;
    } else if (diffDays === 0) {
      dueNotice = 'Due today!';
    } else {
      dueNotice = `${diffDays} day${diffDays === 1 ? '' : 's'} remaining`;
    }
  }

  // Related giving records for this member and building fund
  const relatedPayments = giving.filter(
    (g) =>
      g.member_id === pledge.member_id &&
      (g.category === 'Building Fund' ||
        (g.notes && g.notes.toLowerCase().includes('pledge')) ||
        (g.reference_number && g.reference_number.startsWith('PLG-')))
  );

  // Generate Pastoral WhatsApp Reminders
  const churchName = settings.church_name || 'Greater Works City Church';
  const getWhatsAppMessage = () => {
    const name = pledge.member_name.split(' ')[0] || 'Beloved';
    const campaign = pledge.campaign_name;
    const pledged = formatGHS(pledge.amount_pledged);
    const paid = formatGHS(pledge.amount_paid);
    const balance = formatGHS(pledge.balance);
    const momoAccount = '024 456 1234 (GWCC Project Acct)';
    const bankAccount = 'GCB Bank - 1041010098765 (Greater Works City Church)';

    if (selectedTemplate === 'friendly') {
      return `Calvary greetings ${name}! 🙌\n\nOn behalf of ${churchName}, we thank God for your continuous faith and partnership in the Gospel.\n\nThis is a gentle update regarding your kingdom commitment for *${campaign}*:\n• Total Vowed: ${pledged}\n• Total Paid: ${paid}\n• Outstanding Balance: ${balance}\n• Target Due Date: ${pledge.due_date || 'Open'}\n\nYou can remit your installment via:\n📱 *MTN MoMo:* ${momoAccount}\n🏦 *Bank Transfer:* ${bankAccount}\n\nMay the Lord who supplies seed to the sower multiply your seed sown (2 Cor 9:10). Stay blessed!`;
    }

    if (selectedTemplate === 'milestone') {
      return `Shalom ${name}! 🏛️\n\nGlory to God! The work on our *${campaign}* is progressing steadily to the glory of God.\n\nWe are currently mobilizing resources for the upcoming construction milestone. Your recorded commitment:\n• Covenant Amount: ${pledged}\n• Already Contributed: ${paid}\n• Remaining Covenant: ${balance}\n\nThank you for standing in the gap for God's sanctuary. You may redeem via MTN MoMo: ${momoAccount}. God richly bless you and your household!`;
    }

    return `Peace and grace unto you ${name}! 🕊️\n\nAs we review our church stewardship registers for *${churchName}*, we want to express our deepest appreciation for your vow towards *${campaign}*.\n\nStatus Summary:\n• Committed: ${pledged}\n• Redeemed: ${paid}\n• Balance to complete: ${balance}\n\nIf you have already remitted your balance or need assistance, kindly let our Finance Team know. Payments can be made via MoMo: ${momoAccount}. Remain greatly blessed!`;
  };

  const handleCopyMessage = () => {
    const msg = getWhatsAppMessage();
    navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    const msg = encodeURIComponent(getWhatsAppMessage());
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  const handlePrintCertificate = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-700/50 flex items-center justify-center border border-purple-400/30">
              <Coins className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">{pledge.member_name}</h2>
                <span
                  className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                    pledge.status === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
                      : pledge.status === 'partially_paid'
                      ? 'bg-amber-500/20 text-amber-200 border-amber-400/30'
                      : 'bg-purple-500/20 text-purple-200 border-purple-400/30'
                  }`}
                >
                  {pledge.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-purple-200 mt-0.5">{pledge.campaign_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-purple-200 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 text-xs overflow-y-auto flex-1">
          {/* Executive KPI Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Pledged Covenant
              </span>
              <div className="mt-1 text-lg font-extrabold text-slate-900 font-mono">
                {formatGHS(pledge.amount_pledged)}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5 italic">
                {numberToCedisWords(pledge.amount_pledged)}
              </p>
            </div>

            <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Redeemed & Paid
              </span>
              <div className="mt-1 text-lg font-extrabold text-emerald-800 font-mono">
                {formatGHS(pledge.amount_paid)}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{pctRedeemed}% Fulfilled</span>
              </div>
            </div>

            <div className="bg-purple-50/60 p-3.5 rounded-xl border border-purple-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-900">
                Remaining Balance
              </span>
              <div className="mt-1 text-lg font-extrabold text-purple-900 font-mono">
                {formatGHS(pledge.balance)}
              </div>
              <div
                className={`flex items-center gap-1 text-[11px] font-semibold mt-0.5 ${
                  isOverdue ? 'text-rose-700' : 'text-purple-700'
                }`}
              >
                {isOverdue ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                <span>{dueNotice}</span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
              <span>Redemption Progress</span>
              <span className="font-mono">{pctRedeemed}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${
                  pledge.balance === 0
                    ? 'bg-emerald-500'
                    : pctRedeemed > 50
                    ? 'bg-purple-700'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${pctRedeemed}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono pt-1">
              <span>Start: {pledge.start_date || 'Registration'}</span>
              <span>Target Deadline: {pledge.due_date || 'Open'}</span>
            </div>
          </div>

          {/* Covenant Agreement & Member Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-purple-700" />
                Member Information
              </h4>
              <div className="text-slate-600 space-y-1 text-xs">
                <div>
                  <span className="text-slate-400">ID:</span>{' '}
                  <strong className="text-slate-800">{member?.member_id || 'N/A'}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Phone:</span>{' '}
                  <strong className="text-slate-800">{memberPhone || 'Not provided'}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Status:</span>{' '}
                  <span className="capitalize font-semibold text-slate-700">
                    {member?.status || 'Active Member'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-purple-700" />
                Project Details
              </h4>
              <div className="text-slate-600 space-y-1 text-xs">
                <div>
                  <span className="text-slate-400">Campaign:</span>{' '}
                  <strong className="text-slate-800">{pledge.campaign_name}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Notes / Vow:</span>{' '}
                  <span className="text-slate-700 italic">
                    {pledge.notes || 'Sacrificial pledge for church development'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Pastoral WhatsApp Follow-up & Reminder Generator */}
          {pledge.balance > 0 && (
            <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-purple-800" />
                  <h4 className="font-bold text-purple-950 text-xs">
                    Pastoral WhatsApp Reminder Generator
                  </h4>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedTemplate('friendly')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                      selectedTemplate === 'friendly'
                        ? 'bg-purple-700 text-white'
                        : 'bg-white text-purple-800 border border-purple-200'
                    }`}
                  >
                    Gentle Reminder
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTemplate('milestone')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                      selectedTemplate === 'milestone'
                        ? 'bg-purple-700 text-white'
                        : 'bg-white text-purple-800 border border-purple-200'
                    }`}
                  >
                    Milestone Update
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTemplate('yearend')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                      selectedTemplate === 'yearend'
                        ? 'bg-purple-700 text-white'
                        : 'bg-white text-purple-800 border border-purple-200'
                    }`}
                  >
                    Reconciliation
                  </button>
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-purple-200 text-[11px] text-slate-800 font-mono whitespace-pre-line leading-relaxed max-h-36 overflow-y-auto">
                {getWhatsAppMessage()}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-[11px] text-purple-800">
                  Target recipient:{' '}
                  <strong>{memberPhone ? `${memberPhone}` : 'No phone registered'}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className="px-3 py-1 bg-white hover:bg-purple-50 text-purple-800 border border-purple-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenWhatsApp}
                    className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Send on WhatsApp</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Related Ledger Transactions */}
          {relatedPayments.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                Related Financial Receipts ({relatedPayments.length})
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                    <tr>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Channel / Method</th>
                      <th className="py-2 px-3">Tx Reference</th>
                      <th className="py-2 px-3 text-right">Amount (GH₵)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {relatedPayments.map((g) => (
                      <tr key={g.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono text-slate-600">{g.date}</td>
                        <td className="py-2 px-3 font-medium text-slate-800">
                          {g.payment_channel || g.payment_method}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-500">
                          {g.reference_number || '—'}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-emerald-700 text-right">
                          {formatGHS(g.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrintCertificate}
            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print Covenant Statement</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenEditModal(pledge);
              }}
              className="px-3.5 py-1.5 border border-slate-300 text-slate-700 hover:bg-white rounded-xl font-semibold text-xs transition"
            >
              Edit Pledge
            </button>

            {pledge.balance > 0 && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPaymentModal(pledge);
                }}
                className="px-4 py-1.5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition"
              >
                <CreditCard className="w-4 h-4" />
                <span>+ Record Payment</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
