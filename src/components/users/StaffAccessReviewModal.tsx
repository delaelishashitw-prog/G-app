import React from 'react';
import { Check, X, ShieldCheck } from 'lucide-react';
import type { UserProfile } from '../../types/database.types';
import { ROLE_PERMISSIONS } from '../../contexts/AuthContext';
import { ACCESS_MODULES } from '../../lib/accessModules';
import { staffProfileAccessBlockers } from '../../lib/staffAccessReview';
import { useModalFocus } from '../../hooks/useModalFocus';

export const StaffAccessReviewModal: React.FC<{ user: UserProfile; onClose: () => void }> = ({ user, onClose }) => {
  const panel = useModalFocus(true, onClose);
  const grants = ROLE_PERMISSIONS[user.role] || [];
  const blockers = staffProfileAccessBlockers(user);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs">
    <div ref={panel} role="dialog" aria-modal="true" aria-label="Staff access review" className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 p-4 sm:p-5">
        <div className="min-w-0 space-y-1 break-words">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><ShieldCheck className="h-5 w-5 shrink-0 text-indigo-700" />Review Access</h2>
          <p className="font-semibold text-slate-800">{user.first_name} {user.last_name}</p>
          {user.email && <p className="text-xs text-slate-500">{user.email}</p>}
          <p className="text-xs font-bold uppercase text-indigo-800">{user.role.replaceAll('_', ' ')}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close access review" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><X className="h-4 w-4" /></button>
      </div>
      <div className="space-y-4 overflow-y-auto p-4 sm:p-5">
        <section aria-label="Staff profile requirements" className={`rounded-xl border p-3 text-xs ${blockers.length ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-emerald-200 bg-emerald-50 text-emerald-950'}`}>
          <h3 className="mb-1 font-bold">Staff profile requirements</h3>
          {blockers.length ? <ul className="list-disc space-y-1 pl-4">{blockers.map(message => <li key={message}>{message}</li>)}</ul>
            : <p>{user.role === 'member' ? 'The member profile is active.' : 'The profile is active and its role has been reviewed.'}</p>}
          <p className="mt-2">The account owner must sign in with their verified email and complete the required security checks.</p>
        </section>
        <p className="text-xs leading-relaxed text-slate-600">This review shows the role’s application areas. Access to individual records and actions is checked separately when the account owner uses the app.</p>
        <table className="w-full table-fixed text-left text-xs">
          <caption className="pb-2 text-left font-bold text-slate-800">Role permissions · {grants.length} application area{grants.length === 1 ? '' : 's'}</caption>
          <thead><tr className="border-b border-slate-200 text-slate-500"><th scope="col" className="w-3/5 py-2 pr-3">Application area</th><th scope="col" className="py-2">Role permission</th></tr></thead>
          <tbody>{ACCESS_MODULES.map(module => {
            const allowed = grants.includes(module.id);
            return <tr key={module.id} className="border-b border-slate-100 align-top">
              <th scope="row" className="break-words py-2.5 pr-3 font-semibold text-slate-800">{module.label}</th>
              <td className="py-2.5"><span className={`inline-flex items-start gap-1 ${allowed ? 'text-emerald-800' : 'text-slate-500'}`}>
                {allowed ? <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> : <X aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
                {allowed ? 'Included in role' : 'Not included in role'}
              </span></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <div className="flex shrink-0 justify-end border-t border-slate-200 p-4"><button type="button" onClick={onClose} className="rounded-xl bg-indigo-700 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-800">Done</button></div>
    </div>
  </div>;
};
