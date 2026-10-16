import React,{useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from '../../contexts/AuthContext';
import {useToast} from '../../contexts/ToastContext';
import {apiRequest} from '../../lib/apiClient';
import {communicationPhone} from '../../lib/communicationUtils';
import type {CommunicationRecord} from '../../types/database.types';

type Recipient={id:string;name:string;phone:string;reason?:string};
type Preview={draft_id:string;version:string;digest:string;title:string;message:string;sender:string;recipients:Recipient[];excluded:Recipient[]};
type Estimate={segments:number;encoding:string;total:number};
type Dispatch={id:string;draft_id:string|null;state:string;created_at:string;estimated_units:number;snapshot:{title:string;message:string;sender:string;is_test:boolean;recipients:Recipient[]};outcomes:{phone:string;provider_id:string|null;status:string}[]};
type Connection={provider:string;api_key_configured:boolean;sender_id:string|null;enabled:boolean;ready:boolean;provider_verified?:boolean;sms_balance?:number|null;test_message:string};
const button='border rounded-lg px-3 py-2 text-sm disabled:opacity-50';
const stateNames:Record<string,string>={accepted:'Accepted · awaiting delivery',delivered:'Delivered',failed:'Delivery failed',rejected:'Rejected by provider',unknown:'Submission unconfirmed'};
export const SmsConnectionPanel:React.FC<{draft:CommunicationRecord|null;reviewRequest:number;onClose:()=>void}>=({draft,reviewRequest,onClose})=>{
  const {currentRole,isSimulating}=useAuth(),{error:toastError,info}=useToast();
  const canSend=['super_admin','senior_pastor','administrator'].includes(currentRole)&&!isSimulating;
  const [connection,setConnection]=useState<Connection|null>(null),[dispatches,setDispatches]=useState<Dispatch[]>([]),[loadError,setLoadError]=useState('');
  const [working,setWorking]=useState(false),busy=useRef(false),[phone,setPhone]=useState(''),[testConsent,setTestConsent]=useState(false);
  const testOperation=useRef<{phone:string;id:string}|null>(null),[review,setReview]=useState<{preview:Preview;estimate:Estimate;id:string}|null>(null),[consent,setConsent]=useState(false);
  const [reviewing,setReviewing]=useState(false),[reviewError,setReviewError]=useState('');
  const reviewPanel=useRef<HTMLDivElement>(null);
  const mergeDispatch=(record:Dispatch)=>setDispatches(previous=>[record,...previous.filter(row=>row.id!==record.id)].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,30));
  const load=useCallback(async()=>{
    const [status,history]=await Promise.all([apiRequest<Connection>('/api/sms',{action:'status'}),apiRequest<{dispatches:Dispatch[]}>('/api/sms',{action:'history'})]);
    setConnection(status);setDispatches(history.dispatches);setLoadError('');
  },[]);
  const reloadHistory=async()=>{
    const history=await apiRequest<{dispatches:Dispatch[]}>('/api/sms',{action:'history'});
    setDispatches(history.dispatches);
  };
  useEffect(()=>{let active=true;load().catch(error=>{if(active)setLoadError(error.message);});return()=>{active=false;};},[load]);
  useEffect(()=>{
    let active=true;setReview(null);setConsent(false);setReviewError('');setReviewing(false);
    if(draft&&canSend){
      if(draft._sync_status==='pending'||!draft.updated_at){setReviewError('Wait for this draft’s cloud confirmation before reviewing SMS.');return;}
      setReviewing(true);
      apiRequest<{preview:Preview;estimate:Estimate}>('/api/sms',{action:'preview',draft_id:draft.id,version:draft.updated_at})
        .then(result=>{if(active)setReview({...result,id:crypto.randomUUID()});})
        .catch(error=>{if(active)setReviewError(error.message);}).finally(()=>{if(active)setReviewing(false);});
    }
    return()=>{active=false;};
  },[draft?.id,draft?.updated_at,draft?._sync_status,canSend,reviewRequest]);
  useEffect(()=>{
    if(!draft||!canSend)return;
    const frame=requestAnimationFrame(()=>{
      const panel=reviewPanel.current;
      panel?.focus({preventScroll:true});
      panel?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    });
    return()=>cancelAnimationFrame(frame);
  },[draft?.id,canSend,reviewRequest]);
  const run=async(action:()=>Promise<void>)=>{
    if(busy.current)return;busy.current=true;setWorking(true);
    try{await action();}catch(error){toastError('SMS action incomplete',(error as Error).message);}finally{busy.current=false;setWorking(false);}
  };
  const checked=Boolean(connection?.provider_verified),ready=Boolean(connection?.ready&&checked);
  const recordNotice=(result:{dispatch:Dispatch;reused?:boolean})=>{
    mergeDispatch(result.dispatch);
    if(result.reused)info('Previous SMS submission retained','No duplicate request was sent. Review its delivery status below.');
    else info(result.dispatch.state==='submitted'?'SMS submitted to Arkesel':result.dispatch.state==='rejected'?'SMS rejected by Arkesel':'SMS submission unconfirmed',
      result.dispatch.state==='submitted'?'Acceptance is not delivery. Check delivery reports below.':'Review delivery history and the provider dashboard before trying another submission.');
  };
  const test=()=>run(async()=>{
    const normalized=communicationPhone(phone);
    if(!normalized||!/^233[25]\d{8}$/.test(normalized)||!testConsent)throw new Error('Enter your Ghana mobile number and confirm permission for one charged test SMS.');
    if(!ready)throw new Error('Check the provider connection before sending a test.');
    if(testOperation.current?.phone!==normalized)testOperation.current={phone:normalized,id:crypto.randomUUID()};
    recordNotice(await apiRequest('/api/sms',{action:'test',operation_id:testOperation.current.id,phone:normalized,confirmed:true}));
    setTestConsent(false);
  });
  const send=()=>run(async()=>{
    if(!review||!consent||!ready)throw new Error('Review recipients, connection and SMS charges first.');
    const {preview}=review;
    recordNotice(await apiRequest('/api/sms',{action:'send',operation_id:review.id,draft_id:preview.draft_id,version:preview.version,digest:preview.digest,confirmed:true}));
    setConsent(false);onClose();
  });
  return <section aria-label="SMS connection" className="min-w-0 space-y-4 bg-white rounded-2xl border border-slate-200 p-5">
    <div><h2 className="font-bold">SMS connection · Arkesel</h2><p className="text-sm text-slate-600 mt-1">Send Ghana mobile SMS after reviewing recipients. Scheduling is not enabled.</p></div>
    {loadError&&<p role="alert" className="text-sm text-amber-900">{loadError} <button type="button" disabled={working} onClick={()=>run(load)} className="underline">Reload SMS status</button></p>}
    {!connection&&!loadError&&<p className="text-sm text-slate-600">Loading SMS connection…</p>}
    {connection&&<>
      <p role="status" className={`rounded-lg p-3 text-sm ${connection.ready?'bg-emerald-50 text-emerald-900':'bg-amber-50 text-amber-900'}`}>
        {connection.ready?checked?'Provider connection checked. Review sender approval in Arkesel before sending.':'Backend configured. Check the provider connection before sending.':'SMS sending is disabled. Complete backend setup to activate it.'}
      </p>
      <dl className="grid grid-cols-2 gap-2 text-sm"><dt>API key</dt><dd>{connection.api_key_configured?'Stored on backend':'Not configured'}</dd><dt>Approved sender setting</dt><dd className="break-all">{connection.sender_id||'Not configured'}</dd><dt>Sending switch</dt><dd>{connection.enabled?'Enabled':'Disabled'}</dd>{connection.sms_balance!==undefined&&<><dt>Provider SMS balance</dt><dd>{connection.sms_balance===null?'Not returned':connection.sms_balance.toLocaleString('en-GH')} credits</dd></>}</dl>
      <button type="button" disabled={working||!connection.api_key_configured} onClick={()=>run(async()=>{
        setConnection(previous=>previous?{...previous,provider_verified:false}:previous);
        const result=await apiRequest<Connection>('/api/sms',{action:'check'});setConnection(result);info('Connection checked','No SMS was sent. Sender approval must be completed in Arkesel.');
      })} className={button}>Check connection — no SMS sent</button>
      {canSend&&!connection.ready&&<details className="rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-semibold">Complete SMS setup</summary>
        <p className="mt-2">In <a className="underline" href="https://supabase.com/dashboard/project/noskcrmvnancdyhvzfin/functions/secrets" target="_blank" rel="noreferrer">Supabase Edge Function Secrets</a>, save:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2"><li><code>ARKESEL_API_KEY</code> — the key generated for this app.</li><li><code>ARKESEL_SENDER_ID</code> — your approved sender name, such as GWCC.</li><li><code>ARKESEL_SMS_ENABLED</code> — true, after sender approval.</li></ul>
        <p className="mt-2">Keep the key out of chat and message drafts. Reload SMS status after saving the secrets. Buying credits and approving the sender are completed in Arkesel.</p>
        <button type="button" disabled={working} onClick={()=>run(load)} className={button+' mt-2'}>Reload SMS status</button>
      </details>}
      {canSend&&<div className="space-y-2 border-t pt-3"><h3 className="font-semibold text-sm">Test with your own phone</h3><p className="text-xs text-slate-600 break-words">{connection.test_message}</p>
        <label htmlFor="sms-test-phone" className="block text-sm font-medium">Your test mobile number</label><input id="sms-test-phone" type="tel" disabled={working} value={phone} onChange={e=>{setPhone(e.target.value);setTestConsent(false);}} placeholder="024… or +233…" className="w-full min-w-0 border rounded-lg p-2"/>
        <label className="flex gap-2 text-xs items-start"><input type="checkbox" checked={testConsent} disabled={working} onChange={e=>setTestConsent(e.target.checked)} className="mt-0.5"/>This is my number and I agree to receive one test SMS. Provider charges apply.</label>
        <button type="button" onClick={test} disabled={working||!ready||!testConsent} className={button}>Send one test SMS</button>
      </div>}
    </>}
    {draft&&canSend&&<div ref={reviewPanel} tabIndex={-1} role="region" aria-label="Review SMS submission" className="scroll-mt-24 space-y-3 border-2 border-emerald-700 rounded-xl p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
      <h3 className="font-semibold break-words [overflow-wrap:anywhere]">Review SMS: {draft.title}</h3>{reviewing&&<p className="text-sm">Checking the current audience…</p>}{reviewError&&<p role="alert" className="text-sm text-rose-800">{reviewError}</p>}
      {review&&<>
        <p className="text-sm">From <strong>{review.preview.sender}</strong> · {review.preview.recipients.length} Ghana mobile recipients</p>
        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm">{review.preview.message}</p>
        <p className="text-xs text-slate-600">Estimated {review.estimate.segments} {review.estimate.encoding} segment(s) per number · {review.estimate.total} total segments. Arkesel determines final charges.</p>
        <details className="text-xs"><summary className="cursor-pointer underline">Review every number and SMS exclusions</summary><div className="max-h-48 overflow-y-auto mt-2 space-y-1">{review.preview.recipients.map(row=><p key={row.id} className="break-words">{row.name} · +{row.phone}</p>)}{review.preview.excluded.map(row=><p key={row.id} className="text-amber-900 break-words">{row.name} — {row.reason}</p>)}</div></details>
        {review.preview.sender!==connection?.sender_id&&<p className="text-xs text-rose-800">Save the draft with the configured approved sender ID before sending.</p>}
        {review.estimate.segments>10||review.estimate.total>500?<p className="text-xs text-rose-800">Shorten this message or reduce the audience to fit the submission limit.</p>:null}
        <label className="flex gap-2 text-xs items-start"><input type="checkbox" checked={consent} disabled={working} onChange={e=>setConsent(e.target.checked)} className="mt-0.5"/>I have permission to message these recipients and accept the SMS charges.</label>
        <button type="button" onClick={send} disabled={working||!consent||!ready||review.preview.sender!==connection?.sender_id||review.estimate.segments>10||review.estimate.total>500} className="rounded-lg px-3 py-2 bg-emerald-800 text-white text-sm disabled:opacity-50">Confirm and send to {review.preview.recipients.length} numbers</button>
      </>}
      <button type="button" disabled={working} onClick={onClose} className={button}>Cancel SMS review</button>
    </div>}
    <div className="space-y-3 border-t pt-3"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold text-sm">SMS delivery history</h3><button type="button" disabled={working} onClick={()=>run(reloadHistory)} className="text-xs underline">Reload history</button></div>
      {!dispatches.length&&<p className="text-xs text-slate-500">No SMS submissions recorded. Saved drafts are not delivery records.</p>}
      {dispatches.map(row=><article key={row.id} aria-label={`SMS submission: ${row.snapshot.title}`} className="space-y-2 rounded-lg border p-3 text-xs">
        <p className="break-words font-semibold">{row.snapshot.is_test?'Test · ':''}{row.snapshot.title}</p>
        <p>{new Date(row.created_at).toLocaleString('en-GB',{timeZone:'Africa/Accra'})} · {row.snapshot.recipients.length} numbers · {row.estimated_units} estimated segments</p>
        {['started','unknown'].includes(row.state)&&<p className="text-amber-900">Submission unconfirmed. Check Arkesel before creating another send; this request will not be automatically resent.</p>}
        <p>{row.outcomes.filter(o=>o.status==='delivered').length} delivered · {row.outcomes.filter(o=>o.status==='accepted').length} awaiting delivery · {row.outcomes.filter(o=>['failed','rejected'].includes(o.status)).length} failed/rejected · {row.state==='started'?row.snapshot.recipients.length:row.outcomes.filter(o=>o.status==='unknown').length} unconfirmed</p>
        <details><summary className="cursor-pointer underline">Recipient delivery details</summary><div className="mt-2 space-y-1">{row.snapshot.recipients.map(person=>{const outcome=row.outcomes.find(o=>o.phone===person.phone);return <p key={person.id} className="break-words">{person.name} · +{person.phone} — {stateNames[outcome?.status||'unknown']||'Status unconfirmed'}</p>;})}</div></details>
        {row.outcomes.some(o=>o.provider_id&&!['delivered','failed','rejected'].includes(o.status))&&<button type="button" disabled={working} onClick={()=>run(async()=>{const result=await apiRequest<{dispatch:Dispatch}>('/api/sms',{action:'refresh',id:row.id});mergeDispatch(result.dispatch);})} className={button}>Check delivery reports</button>}
      </article>)}
      <p className="text-xs text-slate-500">Limits: 200 numbers and 500 estimated segments per submission; 1,000 estimated segments per rolling 24 hours for this app. Unknown outcomes count toward the limit. No automatic retries.</p>
      {!canSend&&<p className="text-xs text-slate-600">Your role can prepare drafts and review history. An administrator must approve SMS sending.</p>}
    </div>
  </section>;
};
