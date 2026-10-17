import React,{useCallback,useEffect,useRef,useState} from 'react';
import {getSupabaseClient} from '../../lib/supabase';
import type {Member,RosterAssignment} from '../../types/database.types';
import {rosterDate,rosterToday,type RosterSubstituteRequest} from '../../lib/rosterUtils';

interface Props {
 members:Member[];assignments:RosterAssignment[];onPendingChange?:(ids:string[])=>void;
 refreshData:()=>Promise<{success:boolean;message:string}>;
}
export function RosterRequestPanel({members,assignments,refreshData,onPendingChange}:Props){
 const [requests,setRequests]=useState<RosterSubstituteRequest[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [busy,setBusy]=useState<string|null>(null),[choices,setChoices]=useState<Record<string,string>>({}),[reasons,setReasons]=useState<Record<string,string>>({});
 const [showHistory,setShowHistory]=useState(false);const running=useRef(false),alive=useRef(true);
 const load=useCallback(async()=>{
  const client=getSupabaseClient();if(!client){setError('Secure roster review is unavailable.');return;}
  const {data,error}=await client.rpc('gwcc_roster_requests');
  if(!alive.current)return;
  if(error){setError(error.message);return;}
  const rows=Array.isArray(data)?data:[];setRequests(rows);onPendingChange?.(rows.filter(r=>r.status==='pending').map(r=>r.assignment_id));setError('');
 },[onPendingChange]);
 useEffect(()=>{alive.current=true;void load();const timer=setInterval(()=>void load(),30000);return()=>{alive.current=false;clearInterval(timer);};},[load]);
 const eligible=members.filter(m=>!m.is_archived&&!['inactive','visitor','deceased','transferred'].includes(m.status));
 const unlinked=assignments.filter(a=>rosterDate(a.date)&&rosterDate(a.date)<rosterToday()&&!members.some(m=>m.id===a.member_id||m.member_id===a.member_id));
 const pending=requests.filter(r=>r.status==='pending');
 const act=async(id:string,action:'approve'|'reject'|'link')=>{
  if(running.current)return;running.current=true;setBusy(id);setError('');setNotice('');
  try{
   const client=getSupabaseClient();if(!client)throw new Error('Secure roster review is unavailable.');
   const assignment=assignments.find(a=>a.id===id),request=requests.find(r=>r.assignment_id===id);
   const response=action==='link'?await client.rpc('gwcc_link_historical_roster',{p_id:id,p_version:assignment?.updated_at,p_member_id:choices[id]}):await client.rpc('gwcc_review_roster_request',{
    p_id:id,p_version:request?.updated_at,p_assignment_version:assignment?.updated_at,p_action:action,p_replacement_id:choices[id]||null,p_reason:reasons[id]||'',
   });
   if(response.error)throw response.error;
   if(action!=='link')setRequests(previous=>previous.map(r=>r.assignment_id===id?response.data:r));
   setNotice(action==='link'?'Historical link saved. The original record remains in protected history.':action==='approve'?'Replacement assigned. The new volunteer’s duty awaits confirmation.':'Request rejected; the original duty remains assigned.');
   const refreshed=await refreshData();if(!refreshed.success)setError('Your review was saved, but the roster could not refresh. Reload before another decision.');
   await load();
  }catch(e){setError((e as Error).message||'Review could not be confirmed. Retry the same decision.');}
  finally{running.current=false;setBusy(null);}
 };
 return <section aria-label="Roster substitute requests" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 rounded-2xl space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-lg">Substitute requests ({pending.length} pending)</h2><p className="text-xs text-slate-500">Review the request and select a replacement before approving.</p></div><button type="button" onClick={()=>void load()} disabled={busy!==null} className="border rounded-lg px-3 py-2 text-xs">Refresh requests</button></div>
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="text-sm text-emerald-800">{notice}</p>}
  {pending.length===0&&<p className="text-sm text-slate-500">No substitute requests awaiting review.</p>}
  {(showHistory?requests:pending).map(r=><article key={r.id} className="border rounded-xl p-4 space-y-3" aria-label={`Substitute request for ${r.member_name}`}>
   <div><h3 className="font-bold">{r.member_name} — {r.service_name}</h3><p className="text-xs text-slate-500">{r.date} · {r.role_title} · {r.status}</p></div>
   <p className="text-sm">{r.reason}{r.notes?`: ${r.notes}`:''}</p>{r.suggestion&&<p className="text-xs">Member’s suggestion: {r.suggestion}</p>}
   {r.status==='pending'?<div className="space-y-3">
    <div><label htmlFor={`replacement-${r.id}`} className="block text-xs font-semibold mb-1">Replacement member for {r.member_name}</label><select id={`replacement-${r.id}`} value={choices[r.id]||''} onChange={e=>setChoices(p=>({...p,[r.id]:e.target.value}))} disabled={busy!==null} className="w-full border rounded-lg p-2 text-sm bg-white text-slate-900"><option value="">Choose an active member</option>{eligible.filter(m=>m.id!==r.member_id).map(m=><option key={m.id} value={m.id}>{m.first_name} {m.last_name} ({m.member_id})</option>)}</select></div>
    <div><label htmlFor={`review-${r.id}`} className="block text-xs font-semibold mb-1">Review reason for {r.member_name} (required for rejection)</label><textarea id={`review-${r.id}`} maxLength={2000} rows={2} value={reasons[r.id]||''} onChange={e=>setReasons(p=>({...p,[r.id]:e.target.value}))} disabled={busy!==null} className="w-full border rounded-lg p-2 text-sm bg-white text-slate-900"/></div>
    <div className="flex flex-wrap gap-2"><button type="button" disabled={busy!==null||!choices[r.id]} onClick={()=>void act(r.id,'approve')} className="bg-emerald-800 text-white rounded-lg px-3 py-2 text-xs disabled:opacity-50">{busy===r.id?'Saving decision...':'Approve replacement'}</button><button type="button" disabled={busy!==null||!reasons[r.id]?.trim()} onClick={()=>void act(r.id,'reject')} className="border rounded-lg px-3 py-2 text-xs disabled:opacity-50">Reject request</button></div>
   </div>:<p className="text-sm">{r.replacement_member_name?`Replacement: ${r.replacement_member_name}. `:''}{r.review_reason||''}</p>}
  </article>)}
  {requests.some(r=>r.status!=='pending')&&<button type="button" onClick={()=>setShowHistory(v=>!v)} className="text-xs underline">{showHistory?'Show pending requests':'Show reviewed requests'}</button>}
  {unlinked.length>0&&<div className="border-t pt-4 space-y-3"><h3 className="font-bold">Historical member links requiring review ({unlinked.length})</h3><p className="text-xs text-slate-500">Check the original name and service details before linking a member. The original record will be retained.</p>{unlinked.map(a=><div key={a.id} className="border rounded-xl p-3 space-y-2"><p className="text-sm font-semibold">{a.member_name} — {a.service_name} · {a.date}</p><label htmlFor={`link-${a.id}`} className="block text-xs">Reviewed member for historical assignment {a.member_name}</label><select id={`link-${a.id}`} className="w-full border rounded-lg p-2 text-sm bg-white text-slate-900" value={choices[a.id]||''} disabled={busy!==null} onChange={e=>setChoices(p=>({...p,[a.id]:e.target.value}))}><option value="">Review and choose the correct member</option>{eligible.map(m=><option key={m.id} value={m.id}>{m.first_name} {m.last_name} ({m.member_id})</option>)}</select><button type="button" disabled={busy!==null||!choices[a.id]} onClick={()=>void act(a.id,'link')} className="border rounded-lg px-3 py-2 text-xs disabled:opacity-50">Confirm historical member link</button></div>)}</div>}
 </section>;
}
