import React from 'react';
import {Link,Navigate} from 'react-router-dom';
import {useAuth} from '../contexts/AuthContext';
import {TwoFactorPanel} from '../components/TwoFactorPanel';

export function AccountSecurityPage(){
  const {currentUser,session,securityStatus,isAuthLoading,logout}=useAuth();
  if(isAuthLoading&&!session)return <main className="p-8 text-center">Verifying your account…</main>;
  if(!session||!currentUser.id)return <Navigate to="/login" replace/>;
  return <main className="min-h-screen bg-slate-100 p-4 sm:p-8"><div className="mx-auto max-w-xl space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-800">Greater Works City Church</p><h1 className="mt-2 text-2xl font-bold text-slate-900">Secure your account</h1><p className="mt-1 break-all text-sm text-slate-600">{currentUser.email}</p></div><button onClick={()=>void logout()} className="p-2 text-sm underline">Sign out</button></div>
    {!securityStatus?.satisfied&&<p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Complete two-factor setup or verification to open church records. Your unsynced changes remain saved on this device.</p>}
    <TwoFactorPanel key={currentUser.id}/>
    {securityStatus?.satisfied&&<Link to={currentUser.role==='member'?'/portal':'/'} className="block rounded-lg bg-emerald-800 p-3 text-center text-sm font-semibold text-white">Continue to {currentUser.role==='member'?'Member Portal':'church records'}</Link>}
  </div></main>;
}
