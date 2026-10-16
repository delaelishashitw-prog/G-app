import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Mail, ShieldCheck, X } from 'lucide-react';
import type { Member } from '../../types/database.types';
import { apiRequest } from '../../lib/apiClient';
import { useChurchData } from '../../contexts/ChurchDataContext';

interface Account { id: string; email: string; name: string; verified: boolean }
interface Access {
  state: 'unlinked' | 'existing' | 'pending' | 'ready' | 'blocked';
  email: string; message: string; account: Account | null;
}
const labels: Record<Access['state'], string> = {
  unlinked: 'No linked login', existing: 'Existing account found', pending: 'Invitation pending', ready: 'Ready to sign in', blocked: 'Administrator review required',
};

export function MemberPortalAccessModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const { refreshData } = useChurchData();
  const [email, setEmail] = useState(member.email || '');
  const [access, setAccess] = useState<Access | null>(null);
  const [busy, setBusy] = useState(false), [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const initialEmail = useRef<HTMLInputElement>(null);
  const requestVersion = useRef(0);
  const dialog = useRef<HTMLElement>(null);

  useEffect(() => { initialEmail.current?.focus(); return () => { requestVersion.current++; }; }, []);
  useEffect(() => {
    if (!member.auth_user_id) return;
    let alive = true;
    setBusy(true);
    apiRequest<{ access: Access }>('/api/staff', { action: 'member_access', member_id: member.id })
      .then(result => { if (alive) { setAccess(result.access); setEmail(result.access.email); } })
      .catch(err => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [member.auth_user_id, member.id]);

  const check = async (event: React.FormEvent) => {
    event.preventDefault(); const version = ++requestVersion.current;
    setBusy(true); setError(''); setMessage(''); setConfirmed(false); setAccess(null);
    try {
      const result = await apiRequest<{ access: Access }>('/api/staff', { action: 'member_access', member_id: member.id, email });
      if (version === requestVersion.current) { setAccess(result.access); setEmail(result.access.email); }
    } catch (err) { if (version === requestVersion.current) setError((err as Error).message); }
    finally { if (version === requestVersion.current) setBusy(false); }
  };
  const perform = async () => {
    if (!access || !confirmed || busy) return;
    const action = access.state === 'existing' ? 'link_member' : access.state === 'pending' ? 'resend_member_invite' : 'invite_member';
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await apiRequest<{ access: Access; message: string }>('/api/staff', {
        action, member_id: member.id, email: access.email, auth_user_id: access.account?.id,
      });
      setAccess(result.access); setEmail(result.access.email); setConfirmed(false); setMessage(result.message);
      // Re-read saved links; invitations never enter the offline mutation queue.
      await refreshData();
    } catch (err) { setError((err as Error).message); setConfirmed(false); setAccess(null); }
    finally { setBusy(false); }
  };
  const actionable = access && ['unlinked', 'existing', 'pending'].includes(access.state) && Boolean(access.email);

  return <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" onKeyDown={event => { if (event.key === 'Escape' && !busy) onClose(); }}>
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="portal-access-title" onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const items = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]') || [])];
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }} className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl bg-white p-5 sm:p-6 shadow-xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div><h2 id="portal-access-title" className="font-bold text-lg text-slate-900 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-700" />Member Portal Access</h2>
          <p className="text-sm text-slate-600 mt-1">{member.first_name} {member.last_name} · {member.member_id}</p></div>
        <button aria-label="Close portal access" disabled={busy} onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50"><X className="w-5 h-5" /></button>
      </div>
      <p className="text-sm text-slate-600">Each member uses their own email and password. Confirm the email belongs to this person before granting access to their records.</p>
      <form onSubmit={check} className="space-y-3">
        <label className="block text-sm font-semibold text-slate-800" htmlFor="portal-account-email">Member’s login email</label>
        <input ref={initialEmail} id="portal-account-email" type="email" autoComplete="off" required={!member.auth_user_id} maxLength={254} value={email} disabled={busy || Boolean(access && ['pending','ready'].includes(access.state))}
          onChange={event => { setEmail(event.target.value); setAccess(null); setConfirmed(false); setError(''); setMessage(''); }}
          placeholder="member@example.com" className="w-full border border-slate-300 rounded-xl p-3 text-sm disabled:bg-slate-50" />
        <p className="text-xs text-slate-500">This does not change the directory’s contact email. Update that separately if needed.</p>
        <button disabled={busy} className="w-full rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{busy ? 'Checking account…' : 'Check account status'}</button>
      </form>
      {access && <div className={`rounded-xl border p-4 space-y-2 text-sm ${access.state === 'blocked' ? 'bg-amber-50 border-amber-200 text-amber-950' : 'bg-emerald-50 border-emerald-200 text-emerald-950'}`}>
        <p className="font-bold flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" />{labels[access.state]}</p>
        <p>{access.message}</p>
        {access.account && <p className="break-words"><strong>{access.account.name}</strong><br />{access.account.email}<br />Email {access.account.verified ? 'verified' : 'not yet verified'}</p>}
      </div>}
      {actionable && <div className="space-y-4">
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} className="mt-1 shrink-0" />
          <span>I confirm <strong className="break-all">{access.email}</strong> belongs to <strong>{member.first_name} {member.last_name}</strong>{access.state === 'existing' ? ' and is the account shown above.' : ' and approve sending a setup invitation to this address.'}</span>
        </label>
        <button onClick={() => void perform()} disabled={!confirmed || busy} className="w-full bg-emerald-800 hover:bg-emerald-900 rounded-xl py-3 px-4 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          {busy ? 'Processing…' : access.state === 'existing' ? 'Link existing member account' : access.state === 'pending' ? 'Send a new invitation' : 'Send invitation and link account'}
        </button>
      </div>}
      {message && <p role="status" className="text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      <div className="border-t pt-4 text-sm text-slate-600 space-y-2"><p>Members open their invitation email, set a password of at least 12 characters, then sign in at <a href="/portal" target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-800 underline">Member Portal</a>.</p>
        <p>Members who already accepted an invitation can use “Forgot password?” on that page.</p></div>
    </section>
  </div>;
}
