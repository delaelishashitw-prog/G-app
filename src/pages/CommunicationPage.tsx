import React,{useMemo,useRef,useState} from 'react';
import type {CommunicationRecord,Member} from '../types/database.types';
import {FileText,MessageSquare,Save,ExternalLink,Plus,Copy,Archive,RotateCcw} from 'lucide-react';
import {useChurchData} from '../contexts/ChurchDataContext';
import {useToast} from '../contexts/ToastContext';
import {communicationPhone,communicationRecipients,RECIPIENT_TYPES,type RecipientType} from '../lib/communicationUtils';
import {SmsConnectionPanel} from '../components/communication/SmsConnectionPanel';
import {useAuth} from '../contexts/AuthContext';

export interface CelebrantItem {
  id:string;member:Member;type:'birthday'|'anniversary';dateStr:string;daysUntil:number;isToday:boolean;yearsCount:number;
  milestoneTitle:string;spouseName?:string;suggestedScripture:string;personalizedBlessing:string;smsMessage:string;
}
const blankForm=()=>({title:'Church announcement',message:'',sender:'GWCC',type:'all_members',groupId:'',channel:'sms' as CommunicationRecord['channel']});
const audienceNames:Record<string,string>={all_members:'Current members',visitors:'Visitors',leaders:'Active leaders',ministry:'Ministry',small_group:'Small group',custom:'Unrecorded audience'};
const field='mt-1 block w-full min-w-0 border border-slate-300 rounded-lg p-2';
export const CommunicationPage:React.FC=()=>{
  const {members,visitors,ministries,smallGroups,communications,saveCommunicationDraft,archiveCommunicationDraft}=useChurchData();
  const {info,success,error:toastError}=useToast();
  const {currentRole,isSimulating}=useAuth();
  const canSendSms=['super_admin','senior_pastor','administrator'].includes(currentRole)&&!isSimulating;
  const [smsDraftId,setSmsDraftId]=useState<string|null>(null);
  const [smsReviewRequest,setSmsReviewRequest]=useState(0);
  const [form,setForm]=useState(blankForm),[phone,setPhone]=useState(''),[editingId,setEditingId]=useState<string|null>(null);
  const editorId=useRef<string>(crypto.randomUUID()),busy=useRef(false);
  const [saving,setSaving]=useState(false),[search,setSearch]=useState(''),[showArchived,setShowArchived]=useState(false),[limit,setLimit]=useState(20);
  const [confirmArchive,setConfirmArchive]=useState<string|null>(null),[legacy,setLegacy]=useState(false);
  const audience=useMemo(()=>communicationRecipients(form.type,form.groupId,members,visitors),[form.type,form.groupId,members,visitors]);
  const groups=form.type==='ministry'?ministries:smallGroups;
  const groupName=groups.find(row=>row.id===form.groupId)?.name;
  const savedEditor=communications.find(row=>row.id===editingId);
  const recipientChanges=savedEditor?.recipient_ids&&JSON.stringify([...savedEditor.recipient_ids].sort())!==JSON.stringify(audience.selected.map(row=>row.id).sort());
  const visible=useMemo(()=>communications.filter(row=>Boolean(row.archived_at)===showArchived&&`${row.title} ${row.message} ${row.recipient_group_name||''}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>(b.updated_at||b.created_at||b.sent_at||'').localeCompare(a.updated_at||a.created_at||a.sent_at||'')),[communications,showArchived,search]);
  const change=(key:keyof typeof form,value:string)=>setForm(previous=>({...previous,[key]:value}));
  const newDraft=()=>{editorId.current=crypto.randomUUID();setEditingId(null);setForm(blankForm());setLegacy(false);setPhone('');};
  const openDraft=(row:CommunicationRecord,copy=false)=>{
    editorId.current=copy?crypto.randomUUID():row.id;setEditingId(copy?null:row.id);
    setForm({title:row.title,message:row.message,sender:row.sender_id||'GWCC',type:RECIPIENT_TYPES.includes(row.recipient_type as RecipientType)?row.recipient_type:'',groupId:row.recipient_group_id||'',channel:row.channel});
    setLegacy(!row.recipient_ids);window.scrollTo({top:0,behavior:'smooth'});
  };
  const save=async(event:React.FormEvent)=>{
    event.preventDefault();if(busy.current)return;
    if(['ministry','small_group'].includes(form.type)&&!groupName){toastError('Choose recipients','Choose an available ministry or small group.');return;}
    busy.current=true;setSaving(true);
    try{
      const record=await saveCommunicationDraft({id:editorId.current,title:form.title,channel:form.channel,recipient_type:form.type as RecipientType,
        recipient_group_id:['ministry','small_group'].includes(form.type)?form.groupId:null,recipient_group_name:['ministry','small_group'].includes(form.type)?groupName:null,
        recipient_ids:audience.selected.map(row=>row.id),recipient_count:audience.selected.length,message:form.message,sender_id:form.sender,status:'draft'});
      setEditingId(record.id);setLegacy(false);
      info('Draft saved on this device','Awaiting cloud confirmation. No message has been sent or scheduled.');
    }catch(cause){toastError('Draft not saved',(cause as Error).message);}finally{busy.current=false;setSaving(false);}
  };
  const archive=async(row:CommunicationRecord,archived:boolean)=>{
    if(busy.current)return;busy.current=true;setSaving(true);
    try{await archiveCommunicationDraft(row.id,archived);setConfirmArchive(null);if(archived&&editingId===row.id)newDraft();info(archived?'Draft archive awaiting confirmation':'Draft restore awaiting confirmation','Follow the sync status for cloud confirmation.');}
    catch(cause){toastError('Draft not updated',(cause as Error).message);}finally{busy.current=false;setSaving(false);}
  };
  const copyMessage=async(message:string)=>{
    try{await navigator.clipboard.writeText(message);success('Message copied','Review the message before sharing it.');}
    catch{toastError('Could not copy','Select and copy the message text manually.');}
  };
  const openWhatsApp=()=>{
    const digits=communicationPhone(phone);
    if(!digits||!form.message.trim()||form.message.trim().length>5000){toastError('WhatsApp draft incomplete','Enter a complete phone number and a message of up to 5,000 characters.');return;}
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(form.message.trim())}`,'_blank','noopener,noreferrer');
  };
  return <div className="space-y-6 min-w-0 max-w-full">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900">Communication</h1><p className="text-sm text-slate-600 mt-1">Prepare and manage church message drafts.</p></div>
      <button type="button" onClick={newDraft} disabled={saving} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><Plus className="w-4 h-4"/>New draft</button></div>
    <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Saving a draft does not send, schedule or publish it. Use the SMS connection panel to check Arkesel and review a saved SMS before sending. Scheduling is not enabled. WhatsApp conversations are reviewed and sent manually in WhatsApp.</div>
    <div className="grid min-w-0 gap-6 lg:grid-cols-2">
      <form onSubmit={save} className="min-w-0 space-y-4 bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="font-bold flex items-center gap-2"><FileText className="w-5 h-5"/>{editingId?'Edit message draft':'Message draft'}</h2>
        {legacy&&<p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">This older draft has no saved recipient list. Review the audience and phone numbers before saving.</p>}
        {recipientChanges&&<p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">The directory has changed since this draft was saved. Saving will update its recipient list to the preview below.</p>}
        <label htmlFor="communication-title" className="block text-sm font-medium">Title</label><input id="communication-title" required maxLength={200} value={form.title} onChange={e=>change('title',e.target.value)} className={field}/>
        <label htmlFor="communication-channel" className="block text-sm font-medium">Draft channel</label><select id="communication-channel" value={form.channel} onChange={e=>change('channel',e.target.value)} className={field}><option value="sms">SMS draft</option><option value="whatsapp">WhatsApp draft</option><option value="announcement">Announcement draft</option></select>
        <label htmlFor="communication-recipients" className="block text-sm font-medium">Recipients</label><select id="communication-recipients" required value={form.type} onChange={e=>setForm(previous=>({...previous,type:e.target.value,groupId:''}))} className={field}>
          <option value="">Choose recipients</option>{RECIPIENT_TYPES.map(type=><option key={type} value={type}>{audienceNames[type]}</option>)}</select>
        {['ministry','small_group'].includes(form.type)&&<><label htmlFor="communication-group" className="block text-sm font-medium">Choose group</label><select id="communication-group" required value={form.groupId} onChange={e=>change('groupId',e.target.value)} className={field}><option value="">Choose…</option>{form.groupId&&!groupName&&<option value={form.groupId}>Group no longer available — choose another</option>}{groups.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></>}
        <div className="space-y-2 text-sm"><p>{audience.selected.length} unique valid phone numbers · {audience.issues.length} excluded records.</p>
          {audience.selected.length===0&&<p className="text-amber-800">No valid recipient numbers in this audience. You can save the message for later.</p>}
          <details className="rounded-lg border p-3"><summary className="cursor-pointer font-semibold">Review recipients and exclusions</summary><div className="mt-3 max-h-64 overflow-y-auto space-y-2 text-xs">
            {audience.selected.slice(0,100).map(row=><p key={row.id} className="break-words">{row.name} · +{row.phone}</p>)}
            {audience.issues.slice(0,100).map(row=><p key={row.id} className="break-words text-amber-900">{row.name} — {row.reason}</p>)}
            {audience.selected.length>100||audience.issues.length>100?<p>Showing the first 100 entries in each list.</p>:null}</div><a href="/members" className="mt-2 inline-block text-xs text-emerald-800 underline">Review directory contacts</a></details>
        </div>
        <label htmlFor="communication-sender" className="block text-sm font-medium">Sender ID</label><input id="communication-sender" required maxLength={11} pattern="[A-Za-z0-9 \-]{1,11}" value={form.sender} onChange={e=>change('sender',e.target.value)} className={field}/>
        <label htmlFor="communication-message" className="block text-sm font-medium">Message</label><textarea id="communication-message" required rows={6} maxLength={5000} value={form.message} onChange={e=>change('message',e.target.value)} className={field}/>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500"><span>{form.message.length}/5,000 characters · {form.title.length}/200 title characters</span><button type="submit" disabled={saving} className="flex gap-2 items-center bg-emerald-800 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50"><Save className="w-4 h-4"/>{saving?'Saving…':editingId?'Save changes':'Save draft'}</button></div>
      </form>
      <div className="min-w-0 space-y-6">
        <SmsConnectionPanel draft={communications.find(row=>row.id===smsDraftId)||null} reviewRequest={smsReviewRequest} onClose={()=>setSmsDraftId(null)}/>
        <section className="min-w-0 space-y-3 bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-bold flex gap-2 items-center"><MessageSquare className="w-5 h-5"/>WhatsApp</h2><p className="text-sm text-slate-600">Use the current message draft to open one conversation. Review and send it in WhatsApp.</p>
          <label htmlFor="communication-phone" className="block text-sm font-medium">Phone number</label><input id="communication-phone" type="tel" value={phone} placeholder="024… or +233… or 00233…" onChange={e=>setPhone(e.target.value)} className={field}/>
          <button type="button" onClick={openWhatsApp} className="flex gap-2 items-center border border-emerald-700 text-emerald-800 rounded-lg px-4 py-2 text-sm font-semibold"><ExternalLink className="w-4 h-4"/>Open WhatsApp draft</button>
        </section>
        <section aria-label="Saved messages" className="min-w-0 space-y-3 bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-bold">Saved messages</h2><label htmlFor="communication-search" className="sr-only">Search saved messages</label><input id="communication-search" value={search} placeholder="Search saved messages" onChange={e=>{setSearch(e.target.value);setLimit(20);}} className={field}/>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showArchived} onChange={e=>{setShowArchived(e.target.checked);setLimit(20);}}/>Show archived drafts</label>
          {visible.length===0&&<p className="text-sm text-slate-500">No saved messages match this view.</p>}
          {visible.slice(0,limit).map(row=><article key={row.id} aria-label={`Saved message: ${row.title}`} className="min-w-0 border-t pt-3 text-sm space-y-2">
            <div className="flex flex-wrap justify-between gap-2"><strong className="min-w-0 break-all">{row.title}</strong><span className="text-xs text-slate-500 shrink-0">{row._sync_status==='pending'?'Awaiting cloud confirmation':row.status==='draft'?row.archived_at?'Archived draft':'Draft · cloud confirmed':'Imported record — delivery unverified'}</span></div>
            <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-slate-700">{row.message}</p>
            <p className="text-xs text-slate-500 break-words">{row.recipient_group_name||audienceNames[row.recipient_type]||'Audience needs review'} · {row.recipient_count} {row.recipient_ids?'saved recipients':'intended recipients — list unrecorded'}</p>
            <p className="text-xs text-slate-500">Recorded: {row.created_at||row.sent_at?new Date(row.created_at||row.sent_at).toLocaleString('en-GB',{timeZone:'Africa/Accra'}):'Date unavailable'}</p>
            <div className="flex flex-wrap gap-2 text-xs">
              {row.status==='draft'&&!row.archived_at&&<button type="button" disabled={saving} onClick={()=>openDraft(row)} className="border rounded-lg px-3 py-2">Edit draft</button>}
              {canSendSms&&row.status==='draft'&&row.channel==='sms'&&!row.archived_at&&<button type="button" disabled={saving||row._sync_status==='pending'||!row.updated_at||!row.recipient_ids} onClick={()=>{setSmsDraftId(row.id);setSmsReviewRequest(previous=>previous+1);}} className="border border-emerald-700 text-emerald-900 rounded-lg px-3 py-2">Review SMS send</button>}
              <button type="button" disabled={saving} onClick={()=>openDraft(row,true)} className="border rounded-lg px-3 py-2">Copy as new draft</button>
              <button type="button" onClick={()=>copyMessage(row.message)} className="flex items-center gap-1 border rounded-lg px-3 py-2"><Copy className="w-3 h-3"/>Copy message</button>
              {row.status==='draft'&&(row.archived_at?<button type="button" disabled={saving} onClick={()=>archive(row,false)} className="flex items-center gap-1 border rounded-lg px-3 py-2"><RotateCcw className="w-3 h-3"/>Restore draft</button>:confirmArchive===row.id?<><button type="button" disabled={saving} onClick={()=>archive(row,true)} className="border rounded-lg px-3 py-2 text-rose-800">Confirm archive</button><button type="button" onClick={()=>setConfirmArchive(null)}>Cancel archive</button></>:<button type="button" disabled={saving} onClick={()=>setConfirmArchive(row.id)} className="flex items-center gap-1 border rounded-lg px-3 py-2"><Archive className="w-3 h-3"/>Archive draft</button>)}
            </div>
          </article>)}
          {visible.length>limit&&<button type="button" onClick={()=>setLimit(previous=>previous+20)} className="text-sm underline">Show more messages</button>}
        </section>
      </div>
    </div>
  </div>;
};
