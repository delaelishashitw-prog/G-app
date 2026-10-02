import React, { useRef } from 'react';
import { X, Printer, User, ShieldCheck, Sparkles, Building, Phone, QrCode } from 'lucide-react';
import { Member, ChurchSettings } from '../../types/database.types';

interface MemberIdCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member;
  settings: ChurchSettings;
}

export const MemberIdCardModal: React.FC<MemberIdCardModalProps> = ({
  isOpen,
  onClose,
  member,
  settings,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden animate-in zoom-in-95 my-auto">
        {/* Header Toolbar */}
        <div className="no-print p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-600/30 text-teal-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider">Official Church Membership Card</h3>
              <p className="text-[10px] text-slate-400">{member.first_name} {member.last_name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Badge Card</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Card Container */}
        <div className="p-6 sm:p-8 bg-slate-50 space-y-6" id="printable-member-id">
          {/* FRONT OF CARD */}
          <div className="w-full max-w-md mx-auto aspect-[1.586/1] rounded-2xl bg-gradient-to-br from-teal-950 via-teal-900 to-slate-950 text-white p-5 shadow-2xl border border-teal-500/30 flex flex-col justify-between relative overflow-hidden">
            {/* Background Watermark */}
            <div className="absolute -right-8 -bottom-8 opacity-5 pointer-events-none">
              <Sparkles className="w-56 h-56 text-white" />
            </div>

            {/* Top Bar: Church Name & Branch */}
            <div className="flex items-start justify-between border-b border-teal-700/60 pb-2.5 relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center font-black text-sm text-teal-300 shadow-md">
                  GW
                </div>
                <div>
                  <h4 className="font-black text-xs sm:text-sm tracking-tight text-white uppercase leading-none">
                    {settings.church_name}
                  </h4>
                  <p className="text-[10px] font-bold text-teal-300 mt-0.5">
                    {settings.branch_name || 'Joma Assembly'} • Accra, Ghana
                  </p>
                </div>
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest bg-amber-400 text-slate-950 px-2 py-0.5 rounded shadow-xs">
                MEMBER
              </span>
            </div>

            {/* Middle: Photo & Details */}
            <div className="flex items-center gap-4 py-2 relative z-10">
              {/* Photo Box */}
              <div className="w-20 h-24 rounded-xl bg-teal-800/80 border-2 border-white/60 overflow-hidden shrink-0 shadow-lg flex items-center justify-center">
                {member.profile_photo_url ? (
                  <img
                    src={member.profile_photo_url}
                    alt={member.first_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 text-teal-300" />
                )}
              </div>

              {/* Text Info */}
              <div className="space-y-1 overflow-hidden">
                <h3 className="text-base sm:text-lg font-black text-white truncate leading-tight">
                  {member.first_name} {member.middle_name ? `${member.middle_name[0]}. ` : ''}{member.last_name}
                </h3>
                <div className="text-[11px] font-mono text-teal-200 font-bold">
                  ID: <span className="text-white">{member.member_id}</span>
                  {member.tithe_number && (
                    <span className="ml-2 text-amber-300">Tithe #{member.tithe_number}</span>
                  )}
                </div>
                <div className="text-[10px] text-teal-100/90 truncate">
                  Dept: <strong>{member.ministry_name || 'General Assembly'}</strong>
                </div>
                {member.leadership_position && (
                  <div className="text-[9px] font-bold text-purple-200 bg-purple-500/20 px-1.5 py-0.5 rounded w-max">
                    {member.leadership_position}
                  </div>
                )}
                <div className="text-[9px] text-slate-400 font-mono">
                  Tel: {member.phone}
                </div>
              </div>
            </div>

            {/* Bottom Bar: Barcode / QR Simulation & Expiry */}
            <div className="flex items-center justify-between pt-2 border-t border-teal-800/70 text-[9px] text-teal-300/80 relative z-10">
              <div className="flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-teal-400" />
                <span className="font-mono tracking-wider font-bold">{member.member_id}</span>
              </div>
              <div className="text-right">
                <span className="font-semibold">Issued: {member.membership_date?.slice(0, 4) || '2022'} • Valid Church Passport</span>
              </div>
            </div>
          </div>

          {/* BACK OF CARD */}
          <div className="w-full max-w-md mx-auto aspect-[1.586/1] rounded-2xl bg-white p-5 shadow-md border border-slate-300 flex flex-col justify-between text-slate-900 text-xs">
            <div className="border-b border-slate-200 pb-2 text-center">
              <h5 className="font-bold text-[11px] uppercase tracking-wider text-teal-900">
                Greater Works City Church • Membership Covenant
              </h5>
              <p className="text-[9px] text-slate-500 italic mt-0.5">
                &quot;Behold, how good and how pleasant it is for brethren to dwell together in unity!&quot; — Psalm 133:1
              </p>
            </div>

            <div className="space-y-1.5 text-[10px] text-slate-600">
              <p>
                <strong>Property of GWCC:</strong> This card certifies that the bearer is a bonafide member of Greater Works City Church, Joma Assembly.
              </p>
              <p>
                <strong>Emergency Contact:</strong> {member.emergency_name || 'Church Pastoral Board'} ({member.emergency_phone || settings.phone})
              </p>
              <p>
                <strong>Church Address:</strong> {settings.address} • GPS: {settings.gps_address}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px]">
              <div>
                <span className="text-slate-400 block text-[8px] uppercase">Resident Pastor Signature</span>
                <span className="font-serif italic font-bold text-slate-800">Pastor-in-Charge</span>
              </div>
              <div className="text-right text-slate-400 text-[9px]">
                If found, return to GWCC Joma Sanctuary
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
