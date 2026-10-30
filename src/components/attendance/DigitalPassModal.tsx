import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, QrCode, Printer, User } from 'lucide-react';
import { Member, ChurchSettings } from '../../types/database.types';
import { AttendancePassQr } from './AttendancePassQr';
import { attendancePassValue } from '../../features/attendance/attendancePass';
import { useModalFocus } from '../../hooks/useModalFocus';

interface DigitalPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member;
  settings: ChurchSettings;
}

export const DigitalPassModal: React.FC<DigitalPassModalProps> = ({ isOpen, onClose, member, settings }) => {
  const panel = useModalFocus(isOpen, onClose);
  const value = attendancePassValue(member);
  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('attendance-pass-print-open');
    return () => document.body.classList.remove('attendance-pass-print-open');
  }, [isOpen]);
  if (!isOpen) return null;

  return createPortal(
    <div data-attendance-pass-root className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <style media="print">{`
        body.attendance-pass-print-open > :not([data-attendance-pass-root]) { display: none !important; }
        [data-attendance-pass-root], [data-attendance-pass-root] [role="dialog"] {
          display: block !important; position: static !important; width: 100% !important;
          height: auto !important; max-height: none !important; overflow: visible !important;
          padding: 0 !important; margin: 0 !important; border: 0 !important;
          background: white !important; box-shadow: none !important; backdrop-filter: none !important;
        }
        [data-attendance-pass-paper] { break-inside: avoid; background: white !important; color: black !important; }
        [data-attendance-pass-paper] * { color: black !important; box-shadow: none !important; }
      `}</style>
      <div ref={panel} role="dialog" aria-modal="true" aria-label="Member digital attendance pass" className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden my-auto shrink-0">
        <div className="no-print p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2"><QrCode className="w-5 h-5 text-teal-400" /><span className="font-bold text-xs uppercase tracking-wider">Member Digital Pass</span></div>
          <button type="button" onClick={onClose} aria-label="Close member pass" className="p-1 rounded-lg text-slate-300 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div data-attendance-pass-paper className="p-6 bg-gradient-to-b from-teal-900 via-teal-800 to-slate-900 text-white text-center space-y-4">
          <div className="border-b border-teal-700 pb-3">
            {settings.logo_url && <img src={settings.logo_url} alt="Church logo" className="w-10 h-10 mx-auto object-contain mb-2" />}
            <h2 className="font-bold text-sm">{settings.church_name}</h2>
            <p className="text-xs text-teal-200">{settings.branch_name || settings.location}</p>
          </div>
          <div className="w-20 h-20 rounded-2xl bg-teal-700 mx-auto overflow-hidden border-2 border-white/20 flex items-center justify-center">
            {member.profile_photo_url ? <img src={member.profile_photo_url} alt="Member photo" className="w-full h-full object-cover" /> : <User className="w-10 h-10 text-teal-200" />}
          </div>
          <div>
            <h3 className="text-lg font-black break-words">{member.first_name} {member.last_name}</h3>
            <p className="text-xs font-mono font-bold text-teal-200 mt-1 break-words">{member.member_id}</p>
            {member.ministry_name && <p className="text-xs text-teal-100 mt-1">{member.ministry_name}</p>}
          </div>
          <div className="bg-white p-2 rounded-xl max-w-[196px] mx-auto">
            <AttendancePassQr member={member} />
          </div>
          <p className="text-xs text-teal-100">Show this pass to attendance staff. They select the service and confirm your check-in.</p>
        </div>
        <div className="no-print p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">Member attendance pass</span>
          <button type="button" disabled={!value} onClick={() => { if (value) window.print(); }} className="inline-flex items-center gap-1 px-3 py-2 bg-teal-700 text-white rounded-xl text-xs font-bold disabled:opacity-50">
            <Printer className="w-3.5 h-3.5" />Print Pass
          </button>
        </div>
      </div>
    </div>, document.body
  );
};
