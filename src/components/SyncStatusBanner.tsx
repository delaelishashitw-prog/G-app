import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { flushSyncOutbox, getSyncStatus, exportPendingChanges, discardPendingChanges } from '../lib/supabase';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';

export function SyncStatusBanner() {
  const { isAuthenticated }=useAuth();
  const [status,setStatus]=useState(getSyncStatus());
  const [busy,setBusy]=useState(false);
  const [review,setReview]=useState(false);
  const [exported,setExported]=useState('');
  useEffect(()=>{ const update=(event?:Event)=>setStatus((event as CustomEvent)?.detail||getSyncStatus()); window.addEventListener('gwcc-sync-status',update);update();return()=>window.removeEventListener('gwcc-sync-status',update); },[isAuthenticated]);
  if(!isAuthenticated || (status.pending===0&&!status.error)) return null;
  const download=()=>{const blob=new Blob([exportPendingChanges()],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`gwcc-pending-${new Date().toISOString().slice(0,10)}.json`;link.click();URL.revokeObjectURL(url);setExported(exportPendingChanges());};
  const retry=async()=>{setBusy(true);try{await flushSyncOutbox();}finally{setBusy(false);setStatus(getSyncStatus());}};
  return <><div role="status" className={`border-b px-4 py-3 text-sm flex flex-wrap items-center gap-3 ${status.error?'bg-rose-50 text-rose-900 border-rose-200':'bg-amber-50 text-amber-950 border-amber-200'}`}>
    {status.error?<CloudOff className="w-4 h-4"/>:<Cloud className="w-4 h-4"/>}
    <div className="flex-1 min-w-48"><strong>{status.error?.toLowerCase().includes('storage')?'Device storage failed. Keep this tab open and export your pending changes.':`${status.pending} change${status.pending===1?'':'s'} awaiting cloud confirmation.`}</strong>{status.error&&<p className="text-xs mt-1">{status.error}</p>}</div>
    <button type="button" onClick={retry} disabled={busy} className="rounded-lg border border-current px-3 py-1.5 text-xs font-semibold flex items-center gap-2 disabled:opacity-50"><RefreshCw className={`w-3 h-3 ${busy?'animate-spin':''}`}/>{busy?'Syncing…':'Retry sync'}</button>
    {status.error&&<button type="button" onClick={()=>setReview(true)} className="underline text-xs">Review pending changes</button>}
  </div>
  {review&&<div role="dialog" aria-modal="true" aria-label="Review pending changes" className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"><div className="bg-white rounded-xl p-5 max-w-2xl w-full space-y-4">
    <h2 className="font-bold">Pending changes on this device</h2><p className="text-sm">A rejected batch stays on this device. Export a copy before reconciling it with the church office. Reloading the cloud version discards these pending local changes.</p>
    <pre className="max-h-64 overflow-auto bg-slate-100 rounded p-3 text-xs whitespace-pre-wrap">{exportPendingChanges()}</pre>
    <div className="flex flex-wrap gap-3 text-sm"><button onClick={download} className="border rounded px-3 py-2">Export pending changes</button>
      <button disabled={exported!==exportPendingChanges()||busy} onClick={()=>{if(window.confirm('Discard the exported pending changes and reload the cloud records?')){discardPendingChanges();setReview(false);setStatus(getSyncStatus());}}} className="border rounded px-3 py-2 disabled:opacity-50">Discard local changes and reload cloud</button>
      <button onClick={()=>setReview(false)} className="underline">Close</button></div>
  </div></div>}</>;

}
