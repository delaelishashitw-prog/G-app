import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, X } from 'lucide-react';
import { getSupabaseClient } from '../../lib/supabase';
import { useModalFocus } from '../../hooks/useModalFocus';

const states = {
  needs_email: 'Needs email', not_invited: 'Not invited', needs_link: 'Needs linking',
  pending: 'Invitation pending', ready: 'Ready to sign in', review: 'Needs review',
} as const;
type State = keyof typeof states;
type Row = { id: string; member_id: string; name: string; email: string; state: State; reason: string | null };
type Snapshot = { generated_at: string; members: Row[] };
function verified(value: unknown): Snapshot {
  const data = value as Snapshot;
  if (!data || !Number.isFinite(Date.parse(data.generated_at)) || !Array.isArray(data.members) || data.members.length > 10000 ||
    new Set(data.members.map(row => row?.id)).size !== data.members.length ||
    data.members.some(row => !row || typeof row.id !== 'string' || !row.id || typeof row.member_id !== 'string' || typeof row.name !== 'string' || typeof row.email !== 'string' || !Object.hasOwn(states,row.state)))
    throw new Error('The activation list could not be verified. Refresh and try again.');
  return data;
}
export default function MemberActivationPanel({ onClose, onManage, refreshKey = 0 }: { onClose: () => void; onManage: (id: string) => void; refreshKey?: number }) {
  const [snapshot,setSnapshot] = useState<Snapshot | null>(null);
  const [error,setError] = useState(''),[loading,setLoading] = useState(false);
  const [search,setSearch] = useState(''),[filter,setFilter] = useState<State | 'all'>('all'),[page,setPage] = useState(0);
  const pending = useRef<AbortController | null>(null);
  const panel = useModalFocus(true,onClose);
  const load = useCallback(async () => {
    pending.current?.abort();
    const controller=new AbortController();pending.current=controller;
    setLoading(true);setError('');setSnapshot(null);
    try {
      const client=getSupabaseClient();if(!client)throw new Error('Connect to the church database before checking activation.');
      const {data,error:failure}=await client.rpc('gwcc_member_activation_overview').abortSignal(controller.signal);
      if(failure)throw new Error('Activation status could not be loaded. Check your connection and super administrator access, then retry.');
      if(!controller.signal.aborted){setSnapshot(verified(data));setPage(0);}
    } catch(cause) {if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Activation status could not be loaded.');}
    finally {if(!controller.signal.aborted)setLoading(false);}
  },[]);
  useEffect(()=>{void load();return()=>{pending.current?.abort();};},[load,refreshKey]);
  const counts=useMemo(()=>Object.fromEntries(Object.keys(states).map(state=>[state,snapshot?.members.filter(row=>row.state===state).length||0])) as Record<State,number>,[snapshot]);
  const rows=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return (snapshot?.members||[]).filter(row=>(filter==='all'||row.state===filter)&&(!q||`${row.name} ${row.member_id} ${row.email}`.toLowerCase().includes(q)));
  },[snapshot,filter,search]);
  const pages=Math.max(1,Math.ceil(rows.length/20)),current=Math.min(page,pages-1);
  return createPortal(<div className="fixed inset-0 z-50 bg-slate-950/70 p-3 sm:p-6 flex items-center justify-center">
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="member-activation-title" className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[92dvh] overflow-y-auto p-4 sm:p-6 space-y-4">
      <div className="flex justify-between items-start gap-3">
        <div><h2 id="member-activation-title" className="text-lg font-bold text-slate-900">Member portal activation</h2>
          <p className="text-sm text-slate-600 mt-1">Review account access for unarchived members. Checking status does not send emails.</p></div>
        <button type="button" aria-label="Close member activation" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
        {([['all','All members'],...Object.entries(states)] as [State|'all',string][]).map(([state,label])=><button type="button" key={state} disabled={!snapshot} aria-pressed={filter===state}
          onClick={()=>{setFilter(state);setPage(0);}} className={`text-left border rounded-xl p-3 ${filter===state?'border-emerald-700 bg-emerald-50':'border-slate-200'} disabled:opacity-60`}>
          <span className="block text-xl font-bold">{snapshot?(state==='all'?snapshot.members.length:counts[state]):'—'}</span><span className="text-xs text-slate-700">{label}</span>
        </button>)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex-1 min-w-0"><span className="sr-only">Search activation list</span><input value={search} onChange={event=>{setSearch(event.target.value);setPage(0);}} placeholder="Search name, member ID or email" className="w-full border rounded-lg px-3 py-2 text-sm" /></label>
        <button type="button" disabled={loading} onClick={()=>void load()} className="flex gap-2 items-center px-3 py-2 border rounded-lg text-sm disabled:opacity-60"><RefreshCw className="w-4 h-4" />{loading?'Checking…':'Refresh status'}</button>
      </div>
      {error&&<p role="alert" className="bg-rose-50 text-rose-800 p-3 rounded-lg text-sm">{error}</p>}
      {loading&&<p role="status" className="text-sm text-slate-600">Checking member account status…</p>}
      {snapshot&&<>
        <p className="text-xs text-slate-500">Cloud account status: {new Date(snapshot.generated_at).toLocaleString('en-GH',{timeZone:'Africa/Accra'})}. Pending invitations do not confirm email delivery.</p>
        <ul aria-label="Member activation list" className="divide-y border rounded-xl overflow-hidden">
          {rows.slice(current*20,current*20+20).map(row=><li key={row.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0"><p className="font-semibold text-sm break-words">{row.name} <span className="font-normal text-slate-500">· {row.member_id}</span></p>
              <p className="text-sm text-slate-600 break-all">{row.email||'No email recorded'}</p><p className="text-xs mt-1 font-semibold text-emerald-800">{states[row.state]}</p>
              {row.reason&&<p className="text-xs text-slate-600 mt-1 break-words">{row.reason}</p>}</div>
            <button type="button" onClick={()=>onManage(row.id)} aria-label={`Review portal access for ${row.name}`} className="border border-emerald-700 text-emerald-800 px-3 py-2 rounded-lg text-sm shrink-0">Review access</button>
          </li>)}
          {!rows.length&&<li className="p-6 text-center text-sm text-slate-600">No members match this selection.</li>}
        </ul>
        <div className="flex items-center justify-between gap-2 text-sm"><button type="button" disabled={current===0} onClick={()=>setPage(current-1)} className="border rounded-lg p-2 disabled:opacity-40">Previous</button>
          <span>Page {current+1} of {pages} · {rows.length} members</span><button type="button" disabled={current===pages-1} onClick={()=>setPage(current+1)} className="border rounded-lg p-2 disabled:opacity-40">Next</button></div>
      </>}
      <p className="text-xs text-slate-600">Use Review access to confirm the person and their email before inviting or linking. Members with verified accounts can use <a className="underline" href="/portal" target="_blank" rel="noopener noreferrer">Member Portal</a> and its Forgot password option.</p>
    </div>
  </div>,document.body);
}
