import React, { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { exportPendingChanges, restorePendingChanges } from '../lib/supabase';

export function PendingBackupControls({includeExport=true}:{includeExport?:boolean}) {
  const file = useRef<HTMLInputElement>(null);
  const [busy,setBusy] = useState(false), [message,setMessage] = useState(''), [error,setError] = useState('');
  const download = () => {
    const url=URL.createObjectURL(new Blob([exportPendingChanges()],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=`gwcc-pending-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const restore = async (event:React.ChangeEvent<HTMLInputElement>) => {
    const selected=event.target.files?.[0];event.target.value='';if(!selected)return;
    setBusy(true);setError('');setMessage('');
    try {
      if(selected.size>20*1024*1024)throw new Error('Choose a pending-changes backup smaller than 20 MB.');
      const count=await restorePendingChanges(await selected.text());
      setMessage(`${count} pending change${count===1?'':'s'} restored. Review pending changes, then use Retry sync to send them. Nothing was sent by this restore action.`);
    } catch(err){setError((err as Error).message);}finally{setBusy(false);}
  };
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2 text-xs">
      {includeExport&&<button type="button" onClick={download} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 font-semibold hover:bg-slate-50"><Download className="w-3.5 h-3.5"/>Export pending backup</button>}
      <button type="button" onClick={()=>file.current?.click()} disabled={busy} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 font-semibold hover:bg-slate-50 disabled:opacity-50"><Upload className="w-3.5 h-3.5"/>{busy?'Restoring…':'Restore pending backup'}</button>
      <input ref={file} type="file" accept="application/json,.json" aria-label="Pending changes backup file" onChange={event=>void restore(event)} className="sr-only"/>
    </div>
    {message&&<p role="status" className="text-xs text-emerald-800">{message}</p>}
    {error&&<p role="alert" className="text-xs text-red-800">{error}</p>}
  </div>;
}
