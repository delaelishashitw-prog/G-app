import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSupabaseClient, getStoredSupabaseConfig } from '../lib/supabase';
import { consumePasswordLink, EXPIRED_LINK_MESSAGE, CHANGED_LINK_SESSION_MESSAGE, getInitialAuthLink } from '../lib/authLinks';
import { matchesPasswordSession, savePasswordFromLink, verifyPasswordLink, type PasswordLinkProof } from '../lib/passwordSetup';

export function PasswordSetupPage() {
  const [proof, setProof] = useState<PasswordLinkProof | null>(null);
  const [busy, setBusy] = useState(false), [done, setDone] = useState(false), [checking, setChecking] = useState(true);
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState(''), [error, setError] = useState('');
  const [signInPath, setSignInPath] = useState('/portal');
  const saving = useRef(false);
  useEffect(() => {
    let alive = true;
    const client = getSupabaseClient(), link = getInitialAuthLink();
    if (!client || link.kind !== 'password') {
      setError(!client ? 'Secure sign-in is not configured.' : EXPIRED_LINK_MESSAGE);
      setChecking(false);
      return;
    }
    verifyPasswordLink(client, link).then(async verified => {
      const { data: profile, error: profileError } = await client.from('profiles').select('role').eq('id', verified.userId).maybeSingle();
      if (profileError || !profile) throw new Error('Your church account could not be checked. Please reconnect and reopen your email link.');
      const current = await client.auth.getSession();
      if (current.error || !matchesPasswordSession(verified, current.data.session)) throw new Error(CHANGED_LINK_SESSION_MESSAGE);
      if (alive) { setSignInPath(profile.role === 'member' ? '/portal' : '/login'); setProof(verified); }
    }).catch(error => { if (alive) { setProof(null); setError((error as Error).message); } })
      .finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !proof || done) return;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (!matchesPasswordSession(proof, session)) {
        setProof(null); setPassword(''); setConfirmation(''); setError(CHANGED_LINK_SESSION_MESSAGE);
      }
    });
    return () => subscription.unsubscribe();
  }, [proof, done]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving.current || !proof || done) return;
    setError('');
    if (password.length < 12) { setError('Use at least 12 characters.'); return; }
    if (password !== confirmation) { setError('The passwords do not match.'); return; }
    saving.current = true; setBusy(true);
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error('Secure sign-in is unavailable.');
      await savePasswordFromLink(client, proof, getStoredSupabaseConfig(), password);
      consumePasswordLink(); setDone(true); setPassword(''); setConfirmation('');
    } catch (error) {
      setError((error as Error).message);
      if ((error as Error).message === CHANGED_LINK_SESSION_MESSAGE) { setProof(null); setPassword(''); setConfirmation(''); }
    }
    finally { saving.current = false; setBusy(false); }
  };
  return <main className="min-h-screen bg-slate-100 flex items-center justify-center p-5"><div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm space-y-5">
    <h1 className="text-xl font-bold text-slate-900">Set your account password</h1>
    {checking && <p role="status" className="text-sm text-slate-600">Checking your email link…</p>}
    {done ? <p role="status">Your password has been saved. <Link className="underline text-emerald-800" to={signInPath}>Continue to {signInPath === '/portal' ? 'Member Portal' : 'sign in'}</Link></p> :
      proof && <form onSubmit={save} className="space-y-4">
        <p className="text-sm text-slate-600">Set the password for <strong className="break-all">{proof.email}</strong>.</p>
        <label className="block text-sm font-medium">New password<input required minLength={12} autoComplete="new-password" type="password" value={password} disabled={busy} onChange={e => setPassword(e.target.value)} className="mt-1 w-full border rounded-lg p-2" /></label>
        <label className="block text-sm font-medium">Confirm password<input required minLength={12} autoComplete="new-password" type="password" value={confirmation} disabled={busy} onChange={e => setConfirmation(e.target.value)} className="mt-1 w-full border rounded-lg p-2" /></label>
        <button disabled={busy} className="w-full bg-emerald-800 text-white rounded-lg py-2 font-semibold disabled:opacity-50">{busy ? 'Saving…' : 'Save password'}</button>
      </form>}
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    {!done && <div className="flex flex-wrap gap-4 text-sm">
      <Link className="underline text-slate-600" to="/portal">Member sign-in and password help</Link>
      <Link className="underline text-slate-600" to="/login">Staff sign-in and password help</Link>
    </div>}
  </div></main>;
}
