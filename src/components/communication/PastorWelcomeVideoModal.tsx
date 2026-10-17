import React,{useEffect,useState} from 'react';
import {X,Video,ExternalLink,Copy} from 'lucide-react';
import {useToast} from '../../contexts/ToastContext';
import {welcomeVideoUrl} from '../../lib/communicationUtils';
import {useModalFocus} from '../../hooks/useModalFocus';
interface Props {isOpen:boolean;onClose:()=>void;videoLink:string;onUpdateVideoLink?:(link:string)=>boolean}
export const PastorWelcomeVideoModal:React.FC<Props>=({isOpen,onClose,videoLink,onUpdateVideoLink})=>{
  const {success,error}=useToast();const [link,setLink]=useState(videoLink),[problem,setProblem]=useState('');const panel=useModalFocus(isOpen,onClose);
  const saved=welcomeVideoUrl(videoLink);
  useEffect(()=>{if(isOpen){setLink(videoLink);setProblem('');}},[isOpen,videoLink]);
  if(!isOpen)return null;
  const save=(event:React.FormEvent)=>{event.preventDefault();if(link.trim()&&!welcomeVideoUrl(link)){setProblem('Enter a valid published HTTPS video URL.');return;}if(onUpdateVideoLink?.(link)){setProblem('');success('Welcome video updated',link.trim()?'The published link is saved on this device.':'The video link has been removed.');}};
  const copy=async()=>{try{await navigator.clipboard.writeText(saved);success('Video link copied');}catch{error('Could not copy','Select and copy the published link.');}};
  return <div role="dialog" aria-modal="true" aria-label="Welcome video setup" className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70">
    <div ref={panel} className="w-full max-w-xl bg-white rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
      <header className="flex justify-between items-center gap-3"><h2 className="font-bold flex items-center gap-2"><Video className="w-5 h-5 text-emerald-700"/>Pastor’s welcome video</h2><button type="button" aria-label="Close welcome video" onClick={onClose}><X className="w-5 h-5"/></button></header>
      {saved?<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3 text-sm"><p className="break-all">{saved}</p><div className="flex flex-wrap gap-2"><a href={saved} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-emerald-800 text-white px-3 py-2 flex items-center gap-2"><ExternalLink className="w-4 h-4"/>Open published video</a><button type="button" onClick={()=>void copy()} className="border rounded-lg px-3 py-2 flex items-center gap-2"><Copy className="w-4 h-4"/>Copy video link</button></div></div>:<p role="status" className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">No welcome video is configured. Welcome messages will omit the video section.</p>}
      {onUpdateVideoLink&&<form onSubmit={save} className="space-y-3"><label htmlFor="welcome-video-url" className="block text-sm font-semibold">Published welcome video URL</label><input id="welcome-video-url" type="url" maxLength={2048} value={link} onChange={event=>setLink(event.target.value)} placeholder="https://…" className="w-full min-w-0 rounded-lg border p-3 text-sm"/><p className="text-xs text-slate-500">Paste the address of your real published video. Saved on this device. Leave blank to remove it.</p>{problem&&<p role="alert" className="text-sm text-rose-700">{problem}</p>}<button type="submit" className="rounded-lg bg-emerald-800 text-white px-4 py-2 text-sm font-semibold">Save video link</button></form>}
      <button type="button" onClick={onClose} className="border rounded-lg px-4 py-2 text-sm">Done</button>
    </div>
  </div>;
};
