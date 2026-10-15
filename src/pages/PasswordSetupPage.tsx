import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSupabaseClient } from '../lib/supabase';

export function PasswordSetupPage(){
  const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[done,setDone]=useState(false);
  const [password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[error,setError]=useState('');
  useEffect(()=>{
    let alive=true;const client=getSupabaseClient();
    if(!client){setError('Secure sign-in is not configured.');return;}
    client.auth.getUser().then(({data,error})=>{if(!alive)return;if(error||!data.user?.email_confirmed_at)setError('This invitation or reset link is invalid or expired. Request a new email.');else setReady(true);});
    return()=>{alive=false;};
  },[]);
  const save=async(event:React.FormEvent)=>{
    event.preventDefault();setError('');
    if(password.length<12){setError('Use at least 12 characters.');return;}
    if(password!==confirmation){setError('The passwords do not match.');return;}
    setBusy(true);
    try{const client=getSupabaseClient();if(!client)throw new Error('Secure sign-in is unavailable.');
      const {error}=await client.auth.updateUser({password});if(error)throw error;setDone(true);setPassword('');setConfirmation('');
    }catch(error){setError((error as Error).message);}finally{setBusy(false);}
  };
  return <main className="min-h-screen bg-slate-100 flex items-center justify-center p-5"><div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm space-y-5">
    <h1 className="text-xl font-bold text-slate-900">Set your account password</h1>
    {done?<p role="status">Your password has been saved. <Link className="underline text-emerald-800" to="/login">Continue to sign in</Link></p>:<form onSubmit={save} className="space-y-4">
      <p className="text-sm text-slate-600">Complete your invitation or password reset using the secure link from your email.</p>
      <label className="block text-sm font-medium">New password<input required minLength={12} autoComplete="new-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full border rounded-lg p-2"/></label>
      <label className="block text-sm font-medium">Confirm password<input required minLength={12} autoComplete="new-password" type="password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} className="mt-1 w-full border rounded-lg p-2"/></label>
      <button disabled={!ready||busy} className="w-full bg-emerald-800 text-white rounded-lg py-2 font-semibold disabled:opacity-50">{busy?'Saving…':'Save password'}</button>
    </form>}
    {error&&<p role="alert" className="text-sm text-red-800">{error}</p>}
    {!done&&<Link className="text-sm underline text-slate-600" to="/login">Back to sign in</Link>}
  </div></main>;
}
