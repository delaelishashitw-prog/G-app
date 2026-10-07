import React, { useState } from 'react';
import { X, Printer, Download, Check, HeartHandshake, ShieldCheck, FileCheck } from 'lucide-react';
import { useChurchData } from '../../contexts/ChurchDataContext';
import { useToast } from '../../contexts/ToastContext';
import { WelfareClaim, PaymentMethod } from '../../types/database.types';

interface BenevolenceVoucherModalProps {
  claim: WelfareClaim | null;
  isOpen: boolean;
  onClose: () => void;
}

export const BenevolenceVoucherModal: React.FC<BenevolenceVoucherModalProps> = ({
  claim,
  isOpen,
  onClose,
}) => {
  const { settings, disburseWelfareClaim } = useChurchData();
  const { success } = useToast();

  if (!isOpen || !claim) return null;

  const defaultVoucherNo = claim.disbursement_voucher_no || `WPV-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900))}`;
  const defaultAmount = claim.amount_approved || claim.amount_requested;

  const [voucherNo, setVoucherNo] = useState(defaultVoucherNo);
  const [approvedAmount, setApprovedAmount] = useState(String(defaultAmount));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(claim.disbursement_method || 'mobile_money');
  const [paymentChannel, setPaymentChannel] = useState(claim.disbursement_channel || 'MTN Mobile Money');
  const [recipientPhone, setRecipientPhone] = useState(claim.member_phone || '+233 24 ');
  const [notes, setNotes] = useState(claim.pastoral_notes || 'Approved relief assistance under GWCC Welfare Constitution Article 4.');
  const [isFinalized, setIsFinalized] = useState(claim.status === 'disbursed');

  const handleConfirmDisbursement = () => {
    const num = parseFloat(approvedAmount);
    disburseWelfareClaim(claim.id, {
      disbursement_method: paymentMethod,
      disbursement_channel: paymentChannel,
      disbursement_voucher_no: voucherNo,
      amount_approved: isNaN(num) ? claim.amount_requested : num,
      pastoral_notes: notes,
    });
    setIsFinalized(true);
    success('Relief Voucher Authorized', `Voucher ${voucherNo} recorded for ${claim.member_name}`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Controls Header */}
        <div className="no-print px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold tracking-tight">Official Benevolence Payment Voucher</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Voucher
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Editable Parameters (Hidden on Print) */}
          {!isFinalized && (
            <div className="no-print p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Voucher Authorization Settings
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Voucher Number</label>
                  <input
                    type="text"
                    value={voucherNo}
                    onChange={(e) => setVoucherNo(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 font-mono font-bold text-slate-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Approved Amount (GH₵)</label>
                  <input
                    type="number"
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 font-bold text-emerald-800 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Disbursement Channel</label>
                  <select
                    value={paymentChannel}
                    onChange={(e) => setPaymentChannel(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-slate-900 bg-white font-medium"
                  >
                    <option value="MTN Mobile Money">MTN Mobile Money</option>
                    <option value="Telecel Cash">Telecel Cash</option>
                    <option value="Cash at Sanctuary Desk">Cash at Sanctuary Desk</option>
                    <option value="GCB Bank Wire">GCB Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleConfirmDisbursement}
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  Authorize & Finalize Disbursement
                </button>
              </div>
            </div>
          )}

          {/* Printable Voucher Paper Document */}
          <div className="print-container bg-white border border-slate-300 p-6 sm:p-8 rounded-xl shadow-xs text-slate-900 font-sans space-y-6">
            {/* Church Header */}
            <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
              <div className="flex items-center justify-center gap-3">
                <img src="/assets/logo.png" alt="GWCC Logo" className="w-12 h-12 object-contain" />
                <div>
                  <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wide text-slate-900">
                    {settings.church_name}
                  </h1>
                  <p className="text-xs font-semibold text-emerald-800 italic">
                    "{settings.tagline}"
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-slate-600">
                Auditorium: {settings.address} • GPS Digital Address: <span className="font-mono font-bold">{settings.gps_address}</span>
              </p>
              <div className="inline-block mt-2 bg-slate-900 text-white px-4 py-1 rounded text-xs font-bold uppercase tracking-widest">
                BENEVOLENCE & WELFARE PAYMENT VOUCHER
              </div>
            </div>

            {/* Voucher Meta Info */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <p>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Voucher No:</span>{' '}
                  <span className="font-mono font-bold text-sm text-slate-900">{voucherNo}</span>
                </p>
                <p>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Claim Ref:</span>{' '}
                  <span className="font-mono font-semibold">{claim.claim_number}</span>
                </p>
                <p>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Date Authorized:</span>{' '}
                  <span className="font-medium">{claim.disbursement_date || new Date().toISOString().split('T')[0]}</span>
                </p>
              </div>

              <div className="space-y-1 text-right">
                <p>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Payee / Beneficiary:</span>{' '}
                  <span className="font-bold text-sm text-slate-900">{claim.member_name}</span>
                </p>
                <p>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Beneficiary Contact:</span>{' '}
                  <span className="font-mono">{claim.member_phone || 'Registered in GWCC Directory'}</span>
                </p>
                <p>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Payment Channel:</span>{' '}
                  <span className="font-semibold text-emerald-800">{paymentChannel}</span>
                </p>
              </div>
            </div>

            {/* Assistance Particulars Table */}
            <div className="border border-slate-300 rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 border-b border-slate-300 text-[11px] uppercase text-slate-700 font-bold">
                  <tr>
                    <th className="py-2.5 px-3 text-left">Benevolence Category</th>
                    <th className="py-2.5 px-3 text-left">Particulars / Relief Purpose</th>
                    <th className="py-2.5 px-3 text-right">Amount (GH₵)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="py-3 px-3 font-bold text-slate-900 capitalize">
                      {claim.category.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      <p className="font-semibold text-slate-900">{claim.title}</p>
                      <p className="text-[11px] text-slate-600 mt-0.5">{claim.description}</p>
                      {claim.supporting_documents && (
                        <p className="text-[10px] text-slate-500 italic mt-1">Verified: {claim.supporting_documents}</p>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-sm text-slate-900">
                      GH₵ {parseFloat(approvedAmount).toFixed(2)}
                    </td>
                  </tr>
                  <tr className="bg-slate-50 font-bold">
                    <td colSpan={2} className="py-2.5 px-3 text-right uppercase text-[11px] text-slate-700">
                      Total Disbursed Net Amount:
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-base text-emerald-800">
                      GH₵ {parseFloat(approvedAmount).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Remarks */}
            <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs">
              <span className="font-bold text-slate-800">Pastoral Council Remarks: </span>
              <span className="text-slate-700">{notes}</span>
            </div>

            {/* Signatures & Endorsement Box */}
            <div className="pt-6 grid grid-cols-3 gap-4 border-t border-slate-300 text-center text-xs">
              <div className="space-y-6">
                <div className="h-8 flex items-center justify-center italic text-slate-400 font-serif text-sm">
                  Prophet Elisha K. Richard
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <p className="font-bold text-slate-900">{settings.senior_pastor}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">General Overseer / Presiding</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="h-8 flex items-center justify-center italic text-slate-400 font-serif text-sm">
                  Tamekloe Clara G.
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <p className="font-bold text-slate-900">{settings.general_secretary}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">General Secretary</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="h-8 flex items-center justify-center italic text-slate-400 font-serif text-sm">
                  {claim.member_name}
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <p className="font-bold text-slate-900">{claim.member_name}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Beneficiary Signature</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
