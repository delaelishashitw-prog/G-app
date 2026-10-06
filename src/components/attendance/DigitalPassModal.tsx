import React from 'react';
import { X, QrCode, Printer, User, ShieldCheck, Sparkles, Building, Phone } from 'lucide-react';
import { Member, ChurchSettings } from '../../types/database.types';

interface DigitalPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member;
  settings: ChurchSettings;
}

export const DigitalPassModal: React.FC<DigitalPassModalProps> = ({
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95">
        {/* Modal Toolbar */}
        <div className="no-print p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-teal-400" />
            <span className="font-bold text-xs uppercase tracking-wider">Member Digital Pass</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pass Card */}
        <div className="p-6 bg-gradient-to-b from-teal-900 via-teal-800 to-slate-900 text-white text-center space-y-4">
          <div className="flex items-center justify-between text-left border-b border-teal-700/60 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-400/40 flex items-center justify-center font-black text-sm text-teal-300 overflow-hidden">
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt="Logo" className="w-full h-full object-contain p-0.5" />
                ) : (
                  settings.short_name?.slice(0, 2) || 'GW'
                )}
              </div>
              <div>
                <h4 className="font-extrabold text-xs tracking-tight text-white leading-tight">
                  {settings.church_name}
                </h4>
                <p className="text-[10px] text-teal-300">{settings.branch_name || settings.location || ''}</p>
              </div>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider bg-teal-400/20 text-teal-200 px-2 py-0.5 rounded-full border border-teal-400/30">
              Verified
            </span>
          </div>

          {/* Member Photo & Name */}
          <div className="space-y-2 pt-2">
            <div className="w-20 h-20 rounded-2xl bg-teal-700 mx-auto overflow-hidden border-2 border-white/20 shadow-xl flex items-center justify-center">
              {member.profile_photo_url ? (
                <img
                  src={member.profile_photo_url}
                  alt={member.first_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-10 h-10 text-teal-200" />
              )}
            </div>

            <div>
              <h3 className="text-lg font-black text-white">
                {member.first_name} {member.last_name}
              </h3>
              <p className="text-xs font-mono font-bold text-teal-300 mt-0.5">{member.member_id}</p>
              {member.ministry_name && (
                <p className="text-[11px] text-teal-100/80 mt-1 line-clamp-1">
                  {member.ministry_name}
                </p>
              )}
            </div>
          </div>

          {/* Simulated QR Code Box */}
          <div className="bg-white p-4 rounded-2xl shadow-xl max-w-[180px] mx-auto space-y-2">
            <div className="w-full aspect-square bg-slate-900 p-2 rounded-xl flex items-center justify-center">
              {/* QR Pattern Representation */}
              <div className="grid grid-cols-5 gap-1 w-full h-full p-1 bg-white rounded-lg">
                {Array.from({ length: 25 }).map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-[2px] ${
                      i % 2 === 0 || i % 7 === 0 || i === 0 || i === 4 || i === 20 || i === 24
                        ? 'bg-slate-900'
                        : 'bg-teal-700'
                    }`}
                  />
                ))}
              </div>
            </div>
            <p className="text-[10px] font-bold text-slate-500 font-mono tracking-widest uppercase">
              SCAN TO CHECK IN
            </p>
          </div>

          <p className="text-[10px] text-teal-200/70">
            Show this digital barcode pass at the GWCC reception or foyer kiosk for fast-track attendance.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="no-print p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">Tel: {member.phone}</span>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Pass</span>
          </button>
        </div>
      </div>
    </div>
  );
};
