import { useRef, useState } from 'react';
import type { Member } from '../../types/database.types';
import { useModalFocus } from '../../hooks/useModalFocus';

export function BatchArchiveMembersModal({members,onClose,onConfirm}:{members:Member[];onClose:()=>void;onConfirm:()=>Promise<void>}) {
  const [saving,setSaving]=useState(false),[error,setError]=useState('');
  const busy=useRef(false);
  const close=()=>{if(!busy.current)onClose();};
  const panel=useModalFocus(true,close);
  const confirm=async()=>{
    if(busy.current || !members.length)return;
    busy.current=true;setSaving(true);setError('');
    try{await onConfirm();onClose();}
    catch(err){setError((err as Error).message || 'The selected members could not be archived.');}
    finally{busy.current=false;setSaving(false);}
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="batch-archive-title" className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
      <h2 id="batch-archive-title" className="text-lg font-bold">Review selected members to archive</h2>
      <p className="text-sm text-slate-600">Only the {members.length} members listed here will move to archives. Their giving and attendance history will be preserved.</p>
      <ul className="max-h-64 space-y-2 overflow-y-auto rounded-xl border p-3 text-sm">
        {members.map(member=><li key={member.id}>{member.first_name} {member.last_name} <span className="font-mono text-xs text-slate-500">({member.member_id})</span></li>)}
      </ul>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" disabled={saving} onClick={close} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
        <button type="button" disabled={saving||!members.length||members.some(row=>row._sync_status==='pending')} onClick={()=>void confirm()} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving?'Saving archive…':`Archive ${members.length} selected members`}</button>
      </div>
    </div>
  </div>;
}
