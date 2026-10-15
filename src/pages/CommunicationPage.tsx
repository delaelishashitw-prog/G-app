import React, { useMemo, useState } from 'react';
import type { Member } from '../types/database.types';
import { FileText, MessageSquare, Save, ExternalLink } from 'lucide-react';
import { useChurchData } from '../contexts/ChurchDataContext';
import { useToast } from '../contexts/ToastContext';

export interface CelebrantItem {
  id:string;member:Member;type:'birthday'|'anniversary';dateStr:string;daysUntil:number;isToday:boolean;yearsCount:number;
  milestoneTitle:string;spouseName?:string;suggestedScripture:string;personalizedBlessing:string;smsMessage:string;
}
export const CommunicationPage:React.FC=()=>{
  const {members,visitors,ministries,smallGroups,communications,sendSMSMessage}=useChurchData();
  const {success,error:toastError}=useToast();
  const [group,setGroup]=useState('all_members');
  const [groupId,setGroupId]=useState('');
  const [title,setTitle]=useState('Church announcement');
  const [message,setMessage]=useState('');
  const [sender,setSender]=useState('GWCC');
  const [phone,setPhone]=useState('');
  const recipients=useMemo(()=>{
    if(group==='visitors')return visitors.map(row=>({id:row.id,name:row.full_name,phone:row.phone}));
    return members.filter(row=>group==='ministry'?row.ministry_id===groupId:group==='small_group'?row.small_group_id===groupId:group==='leaders'?Boolean(row.leadership_position):true)
      .map(row=>({id:row.id,name:`${row.first_name} ${row.last_name}`,phone:row.phone}));
  },[members,visitors,group,groupId]);
  const save=(event:React.FormEvent)=>{
    event.preventDefault();
    if(!message.trim()||!title.trim()){toastError('Draft incomplete','Enter a title and message.');return;}
    sendSMSMessage({title:title.trim(),channel:'sms',recipient_type:group==='small_group'?'custom':group as any,
      recipient_count:recipients.length,message:message.trim(),sender_id:sender.trim()||'GWCC',status:'draft'});
    success('Draft saved on this device','Cloud confirmation appears in the sync status. No message has been sent or scheduled.');
  };
  const openWhatsApp=()=>{
    let digits=phone.replace(/\D/g,'');if(digits.startsWith('0'))digits=`233${digits.slice(1)}`;
    if(!/^\d{9,15}$/.test(digits)||!message.trim()){toastError('WhatsApp draft incomplete','Enter an international phone number and message.');return;}
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`,'_blank','noopener,noreferrer');
  };
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold text-slate-900">Communication</h1><p className="text-sm text-slate-600 mt-1">Prepare announcements and open individual WhatsApp conversations.</p></div>
    <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      SMS delivery and scheduling require a connected provider. You can save drafts here. Delivery status and gateway credit balances are unavailable until that integration is configured.
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={save} className="space-y-4 bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="font-bold flex items-center gap-2"><FileText className="w-5 h-5"/>Message draft</h2>
        <label className="block text-sm font-medium">Title<input required value={title} onChange={e=>setTitle(e.target.value)} className="mt-1 w-full border rounded-lg p-2"/></label>
        <label className="block text-sm font-medium">Recipients<select value={group} onChange={e=>{setGroup(e.target.value);setGroupId('');}} className="mt-1 w-full border rounded-lg p-2">
          <option value="all_members">All members</option><option value="visitors">Visitors</option><option value="leaders">Leaders</option><option value="ministry">Ministry</option><option value="small_group">Small group</option>
        </select></label>
        {(group==='ministry'||group==='small_group')&&<label className="block text-sm font-medium">Choose group<select required value={groupId} onChange={e=>setGroupId(e.target.value)} className="mt-1 w-full border rounded-lg p-2"><option value="">Choose…</option>{(group==='ministry'?ministries:smallGroups).map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>}
        <p className="text-xs text-slate-500">{recipients.length} intended recipients. Drafts do not contact recipients.</p>
        <label className="block text-sm font-medium">Sender ID<input value={sender} maxLength={11} onChange={e=>setSender(e.target.value)} className="mt-1 w-full border rounded-lg p-2"/></label>
        <label className="block text-sm font-medium">Message<textarea required rows={6} maxLength={5000} value={message} onChange={e=>setMessage(e.target.value)} className="mt-1 w-full border rounded-lg p-2"/></label>
        <div className="flex items-center justify-between text-xs text-slate-500"><span>{message.length} characters</span><button type="submit" className="flex gap-2 items-center bg-emerald-800 text-white px-4 py-2 rounded-lg font-semibold"><Save className="w-4 h-4"/>Save draft</button></div>
      </form>
      <div className="space-y-6">
        <section className="space-y-3 bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-bold flex gap-2 items-center"><MessageSquare className="w-5 h-5"/>WhatsApp</h2>
          <p className="text-sm text-slate-600">Use the message draft to open a conversation. Review and send it in WhatsApp.</p>
          <label className="block text-sm font-medium">Phone number<input type="tel" value={phone} placeholder="+233…" onChange={e=>setPhone(e.target.value)} className="mt-1 w-full border rounded-lg p-2"/></label>
          <button type="button" onClick={openWhatsApp} className="flex gap-2 items-center border border-emerald-700 text-emerald-800 rounded-lg px-4 py-2 text-sm font-semibold"><ExternalLink className="w-4 h-4"/>Open WhatsApp draft</button>
        </section>
        <section className="space-y-3 bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-bold">Saved messages</h2>
          {communications.length===0&&<p className="text-sm text-slate-500">No saved messages.</p>}
          {communications.map(row=><article key={row.id} className="border-t pt-3 text-sm"><div className="flex justify-between gap-3"><strong>{row.title}</strong><span className="text-xs text-slate-500">{row.status==='draft'?'Draft':'Imported record — delivery unverified'}</span></div><p className="whitespace-pre-wrap mt-1 text-slate-700">{row.message}</p><p className="mt-2 text-xs text-slate-500">{row.recipient_count} intended recipients · {new Date(row.sent_at).toLocaleString()}</p></article>)}
        </section>
      </div>
    </div>
  </div>;
};
