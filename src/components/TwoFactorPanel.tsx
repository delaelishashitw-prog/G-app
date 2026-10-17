import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ShieldCheck,Smartphone} from 'lucide-react';
import {useAuth} from '../contexts/AuthContext';
import {getSupabaseClient} from '../lib/supabase';
import {mfaError,validMfaCode} from '../lib/mfa';

type Factor={id:string;friendly_name?:string;factor_type:string;status:string};
type Enrollment={id:string;secret:string;qr:string};
const field='mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900';
const button='rounded-lg bg-emerald-800 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50';

export function TwoFactorPanel(){
  const {currentUser,securityStatus,refreshSecurity}=useAuth();
  const [factors,setFactors]=useState<Factor[]>([]),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[name,setName]=useState('');
  const [enrollment,setEnrollment]=useState<Enrollment|null>(null),[code,setCode]=useState(''),[selected,setSelected]=useState('');
  const [removing,setRemoving]=useState(''),[remaining,setRemaining]=useState('');
  const mounted=useRef(true),lock=useRef(false),owner=useRef(currentUser.id);
  owner.current=currentUser.id;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const load=useCallback(async()=>{
    const client=getSupabaseClient();if(!client)throw new Error('Secure sign-in is unavailable.');
    const {data,error}=await client.auth.mfa.listFactors();if(error)throw error;
    if(mounted.current){setFactors(data.all);setLoaded(true);setSelected(previous=>data.totp.some(f=>f.id===previous)?previous:data.totp[0]?.id||'');}
  },[]);
  useEffect(()=>{void load().catch(()=>{if(mounted.current)setError('Authenticators could not be loaded. Reconnect and try again.');});},[load]);
  const verified=factors.filter(f=>f.status==='verified'),totp=verified.filter(f=>f.factor_type==='totp');
  const pending=factors.filter(f=>f.status!=='verified'&&f.factor_type==='totp'&&f.id!==enrollment?.id);
  const needsCode=Boolean(securityStatus?.required&&!securityStatus.satisfied&&verified.length>0);
  const run=async(work:(client:NonNullable<ReturnType<typeof getSupabaseClient>>,live:()=>boolean)=>Promise<void>)=>{
    if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');
    const id=currentUser.id,live=()=>mounted.current&&owner.current===id;
    try{const client=getSupabaseClient();if(!client)throw new Error('Secure sign-in is unavailable.');
      const {data,error}=await client.auth.getUser();if(error||data.user?.id!==id)throw new Error('Account changed');
      if(live())await work(client,live);
    }catch(error){if(live())setError(mfaError(error));}finally{lock.current=false;if(live())setBusy(false);}
  };
  const check=async(client:NonNullable<ReturnType<typeof getSupabaseClient>>,id:string)=>{
    if(!id||!validMfaCode(code))throw new Error('Invalid code');
    // Codes and enrollment secrets stay in memory and go only to Supabase Auth.
    const {error}=await client.auth.mfa.challengeAndVerify({factorId:id,code});if(error)throw error;
  };
  const verify=(event:React.FormEvent)=>{
    event.preventDefault();void run(async(client,live)=>{
      await check(client,enrollment?.id||selected);if(!live())return;
      setCode('');setEnrollment(null);await refreshSecurity();if(!live())return;
      await load();if(live())setNotice('Authenticator verified. Two-factor protection is active.');
    });
  };
  const start=(event:React.FormEvent)=>{
    event.preventDefault();void run(async(client,live)=>{
      const friendlyName=name.trim();if(!friendlyName||friendlyName.length>60){setError('Enter a device name of 1–60 characters.');return;}
      const {data,error}=await client.auth.mfa.enroll({factorType:'totp',friendlyName,issuer:'Greater Works City Church'});if(error)throw error;
      if(live()){setEnrollment({id:data.id,secret:data.totp.secret,qr:data.totp.qr_code});setCode('');setName('');}
    });
  };
  const cancel=(id:string)=>void run(async(client,live)=>{
    const {error}=await client.auth.mfa.unenroll({factorId:id});if(error)throw error;
    if(!live())return;setEnrollment(null);setCode('');await load();if(live())setNotice('Unfinished setup removed. You can start again.');
  });
  const remove=(event:React.FormEvent)=>{
    event.preventDefault();void run(async(client,live)=>{
      if(!removing||remaining===removing||!totp.some(f=>f.id===remaining)||verified.length<2)throw new Error('Invalid authenticator');
      await check(client,remaining);if(!live())return;
      const {error}=await client.auth.mfa.unenroll({factorId:removing});if(error)throw error;
      if(!live())return;setRemoving('');setRemaining('');setCode('');await refreshSecurity();await load();if(live())setNotice('Old authenticator removed. Your verified backup remains active.');
    });
  };
  return <section aria-label="Two-factor authentication" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 text-slate-900 space-y-5">
    <div className="flex items-center gap-3"><ShieldCheck className="h-7 w-7 text-emerald-700 shrink-0"/><div><h2 className="text-lg font-bold">Two-factor authentication</h2><p className="text-sm text-slate-600">{securityStatus?.satisfied&&verified.length>0?'Protection active for this session.':'Protect your church account with an authenticator app.'}</p></div></div>
    <p className="text-sm text-slate-600">Required for super administrators, senior pastors, administrators and finance officers. Each person uses their own authenticator. Codes work without mobile credit.</p>
    {error&&<p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {notice&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {!loaded?<div className="space-y-3"><p role="status" className="text-sm text-slate-600">Loading your authenticators…</p>{error&&<button className={button} disabled={busy} onClick={()=>void run(async()=>{await load();})}>Retry loading authenticators</button>}</div>:<>
      {needsCode&&!enrollment?<form onSubmit={verify} className="space-y-4">
        <p className="font-medium">Enter your authenticator code to continue.</p>
        <label className="block text-sm">Authenticator<select aria-label="Authenticator" className={field} value={selected} onChange={e=>{setSelected(e.target.value);setCode('');}} disabled={busy}>{totp.map(f=><option key={f.id} value={f.id}>{f.friendly_name||'Authenticator'}</option>)}</select></label>
        {totp.length===0&&<p role="alert">This account has a factor that this screen cannot verify. Contact the church’s system owner for recovery.</p>}
        <CodeInput code={code} setCode={setCode} busy={busy}/><button className={button} disabled={busy||!selected||!validMfaCode(code)}>{busy?'Verifying…':'Verify and continue'}</button>
      </form>:enrollment?<form onSubmit={verify} className="space-y-4">
        <h3 className="font-semibold">Scan with your authenticator</h3>
        <p className="text-sm text-slate-600">In your authenticator app, add an account and scan this QR code. On the same phone, use the manual setup key. Keep this key private.</p>
        <img src={enrollment.qr} alt="Private authenticator setup QR code" className="h-52 w-52 max-w-full bg-white mx-auto"/>
        <details><summary className="cursor-pointer text-sm font-semibold text-emerald-900">Enter setup key manually</summary><p className="text-sm mt-2">Choose a time-based account (TOTP).</p><code className="mt-2 block break-all rounded-lg bg-slate-100 p-3 select-all">{enrollment.secret}</code></details>
        <CodeInput code={code} setCode={setCode} busy={busy}/><div className="flex flex-wrap gap-3"><button className={button} disabled={busy||!validMfaCode(code)}>{busy?'Verifying…':'Verify authenticator'}</button><button type="button" className="text-sm underline p-2" disabled={busy} onClick={()=>cancel(enrollment.id)}>Cancel setup</button></div>
      </form>:<>
        {verified.length>0&&<div className="space-y-3"><h3 className="font-semibold">Your authenticators</h3>{verified.map(f=><div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3" key={f.id}><span className="text-sm flex items-center gap-2"><Smartphone className="h-4 w-4"/>{f.friendly_name||'Authenticator'} · Verified</span><button type="button" disabled={busy||totp.filter(other=>other.id!==f.id).length===0} onClick={()=>{setRemoving(f.id);setRemaining(totp.find(other=>other.id!==f.id)?.id||'');setCode('');}} className="text-sm underline disabled:opacity-40">Remove {f.friendly_name||'authenticator'}</button></div>)}
          <p className="text-xs text-slate-600">Add and verify a backup on another device before removing your last authenticator.</p></div>}
        {removing?<form onSubmit={remove} className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4"><h3 className="font-semibold">Verify the authenticator you will keep</h3><label className="block text-sm">Remaining authenticator<select aria-label="Remaining authenticator" className={field} value={remaining} onChange={e=>{setRemaining(e.target.value);setCode('');}} disabled={busy}>{totp.filter(f=>f.id!==removing).map(f=><option key={f.id} value={f.id}>{f.friendly_name||'Authenticator'}</option>)}</select></label><CodeInput code={code} setCode={setCode} busy={busy}/><div className="flex flex-wrap gap-3"><button className={button} disabled={busy||!validMfaCode(code)}>Verify backup and remove old device</button><button type="button" className="p-2 text-sm underline" disabled={busy} onClick={()=>{setRemoving('');setCode('');}}>Keep both devices</button></div></form>:<form onSubmit={start} className="space-y-3"><h3 className="font-semibold">{verified.length?'Add a backup authenticator':'Set up your authenticator'}</h3><p className="text-sm text-slate-600">Use a trusted authenticator such as Google Authenticator, Microsoft Authenticator or a password manager that supports TOTP.</p><label className="block text-sm">Device name<input className={field} value={name} onChange={e=>setName(e.target.value)} required maxLength={60} disabled={busy} placeholder={verified.length?'Backup device':'My phone'} autoComplete="off"/></label><button className={button} disabled={busy}>{busy?'Starting…':verified.length?'Set up backup authenticator':'Start authenticator setup'}</button></form>}
      </>}
      {pending.length>0&&<div className="border-t pt-3 space-y-2"><h3 className="text-sm font-semibold">Unfinished setups</h3>{pending.map(f=><div key={f.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{f.friendly_name||'Unnamed device'} · Not verified</span><button disabled={busy} onClick={()=>cancel(f.id)} className="p-2 underline">Discard unfinished setup</button></div>)}<p className="text-xs text-slate-600">If you left setup before confirming a code, discard it and start again. Existing verified devices stay active.</p></div>}
    </>}
    <details className="border-t pt-4 text-sm"><summary className="cursor-pointer font-semibold">Lost or changed your phone?</summary><div className="mt-3 space-y-2 text-slate-600"><p>Choose your backup authenticator at sign-in. After signing in, add your new phone here and verify it before removing the lost device.</p><p>If every authenticator is lost, contact the church’s system owner. They must verify your identity and recover the account through Supabase Auth. A password reset alone does not remove two-factor protection.</p><p>Keep the backup on a separate device or in a secure password manager. Never send your setup key or verification codes to anyone, including church support.</p></div></details>
  </section>;
}
function CodeInput({code,setCode,busy}:{code:string;setCode:(value:string)=>void;busy:boolean}){
  return <label className="block text-sm font-medium">Six-digit code<input className={field+' font-mono text-lg tracking-widest'} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={busy} placeholder="000000"/></label>;
}
