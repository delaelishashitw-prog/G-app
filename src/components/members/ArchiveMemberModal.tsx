import React from 'react';
import { Archive, AlertTriangle, X, ShieldAlert } from 'lucide-react';
import { Member } from '../../types/database.types';

interface ArchiveMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  member: Member;
  isProcessing?: boolean;
}

export const ArchiveMemberModal: React.FC<ArchiveMemberModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  member,
  isProcessing = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-modal-title"
      >
        {/* Top Accent Bar */}
        <div className="h-2 bg-gradient-to-r from-rose-500 via-red-600 to-amber-500" />

        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                <Archive className="w-6 h-6" />
              </div>
              <div>
                <h3 id="archive-modal-title" className="text-lg font-bold text-slate-900 leading-tight">
                  Archive Member Profile
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confirm moving this member to church archives
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Member Card Preview */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3">
            {member.profile_photo_url ? (
              <img
                src={member.profile_photo_url}
                alt={member.first_name}
                className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-sm shrink-0 border border-teal-200">
                {member.first_name[0]}
                {member.last_name[0]}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-bold text-slate-900 text-sm truncate">
                {member.first_name} {member.last_name}
              </p>
              <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">
                {member.member_id} • {member.phone || 'No phone'}
              </p>
            </div>
          </div>

          {/* Warning notice */}
          <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/80 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>What happens when you archive:</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-amber-800 text-[11px] leading-relaxed">
              <li>
                This member is hidden from the active church directory, cell groups, and attendance rosters.
              </li>
              <li>
                All historical tithes, offerings, pledges, and attendance logs are <strong>fully preserved</strong>.
              </li>
              <li>
                You can view or <strong>restore</strong> this member anytime from the <em>Archived Members</em> filter.
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition border border-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isProcessing}
              className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{isProcessing ? 'Archiving...' : 'Yes, Archive Member'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
