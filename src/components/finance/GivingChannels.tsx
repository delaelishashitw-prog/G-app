import React,{useRef,useState} from 'react';
import {useAuth} from '../../contexts/AuthContext';
import {useGivingChannels} from '../../hooks/useGivingChannels';
import {saveGivingChannel,type GivingChannelRequest} from '../../lib/givingChannels';

export function GivingInstructions({reference,enabled=true}:{reference?:string;enabled?:boolean}){
  const {channels,loading,error,refresh}=useGivingChannels(enabled);
  return <section aria-label="Official giving instructions" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 space-y-3 text-slate-900">
    <h3 className="font-bold">Official giving instructions</h3>
    {loading?<p className="text-sm">Checking approved giving channels…</p>:error?<p role="alert" className="text-sm">{error} <button type="button" onClick={()=>void refresh()} className="underline">Retry</button></p>:!channels.length?<p className="text-sm">Contact the church office for confirmed payment instructions. No giving channel has been approved in the system.</p>:<div className="grid gap-3 sm:grid-cols-2">{channels.map(channel=><div key={channel.id} className="rounded-xl bg-white border border-emerald-200 p-3 break-words"><p className="font-semibold text-sm">{channel.bank_or_provider}</p><p className="font-mono font-bold mt-1">{channel.account_number}</p><p className="text-sm">Account name: {channel.account_name}</p><p className="text-xs mt-1">{channel.currency}{reference?` · Reference: ${reference}`:''}</p></div>)}</div>}
    <p className="text-xs">A finance officer records your receipt after confirming payment.</p>
  </section>;
}

export function GivingChannelsPanel(){
  const {currentUser}=useAuth();
  const canManage=['super_admin','senior_pastor','finance_officer'].includes(currentUser.role);
  const {channels:accounts,loading,error,refresh}=useGivingChannels(canManage,true);
  const [selected,setSelected]=useState(''),[holder,setHolder]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[problem,setProblem]=useState(''),[notice,setNotice]=useState('');
  const request=useRef<GivingChannelRequest|null>(null),working=useRef(false);
  const account=accounts.find(row=>row.id===selected);
  const invalidate=()=>{request.current=null;setProblem('');setNotice('');};
  async function submit(enable:boolean){
    if(working.current||!account)return;
    if(enable&&(!confirmed||!holder.trim())){setProblem('Confirm the account holder name and check the payment details before publishing.');return;}
    if(!request.current||request.current.p_enabled!==enable)request.current={p_operation_id:crypto.randomUUID(),p_account_id:account.id,p_account_version:account.account_version,p_channel_version:account.channel_version,p_enabled:enable,p_account_name:holder.trim()};
    working.current=true;setBusy(true);setProblem('');setNotice('');
    try{await saveGivingChannel(request.current);request.current=null;setNotice(enable?'Giving channel approved and saved to the cloud.':'Giving channel disabled.');setSelected('');setHolder('');setConfirmed(false);await refresh();}
    catch(cause){setProblem((cause as Error).message);}
    finally{working.current=false;setBusy(false);}
  }
  return <section aria-label="Manage official giving channels" className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 text-slate-900">
    <h3 className="font-bold">Official member giving channels</h3>
    <p className="text-sm">Approved channels appear in the member portal and pledge reminders. Confirm the receiving account name and number with the church before publishing.</p>
    {!canManage?<p className="text-sm">A finance officer or senior administrator manages these channels under Church Finance → Accounts.</p>:<>
      {loading&&<p className="text-sm">Loading church accounts…</p>}
      {error&&<p role="alert" className="text-sm text-rose-800">{error} <button type="button" onClick={()=>void refresh()} className="underline">Refresh accounts</button></p>}
      {!loading&&!error&&!accounts.length&&<p className="text-sm">Add a bank or MoMo holding account in Church Finance first.</p>}
      <ul className="space-y-1 text-sm">{accounts.map(row=><li key={row.id} className="break-words">{row.label}: {row.approved&&row.is_active?'Approved':row.enabled?'Needs review or account activation':'Not published'}</li>)}</ul>
      <form onSubmit={event=>{event.preventDefault();void submit(true);}} className="space-y-3">
        <label className="block text-sm">Receiving church account<select aria-label="Receiving church account" value={selected} disabled={busy||loading} onChange={event=>{const next=accounts.find(row=>row.id===event.target.value);setSelected(event.target.value);setHolder(next?.account_name||'');setConfirmed(false);invalidate();}} className="block border rounded-lg p-2 w-full mt-1"><option value="">Select a bank or MoMo account</option>{accounts.map(row=><option key={row.id} value={row.id}>{row.label} · {row.account_number||'Number missing'}</option>)}</select></label>
        {account&&<><p className="text-sm break-words">{account.bank_or_provider} · <strong>{account.account_number||'Number missing'}</strong> · {account.currency}</p>
          <label className="block text-sm">Registered account holder name<input aria-label="Registered account holder name" required maxLength={160} value={holder} disabled={busy} onChange={event=>{setHolder(event.target.value);setConfirmed(false);invalidate();}} className="block border rounded-lg p-2 w-full mt-1"/></label>
          <label className="flex gap-2 items-start text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event=>{setConfirmed(event.target.checked);invalidate();}}/>I have confirmed this account name and receiving number with the church.</label>
          <div className="flex flex-wrap gap-3"><button type="submit" disabled={busy||loading||!confirmed||!account.is_active||!account.account_number} className="bg-emerald-800 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">{busy?'Saving…':'Approve giving channel'}</button>{account.enabled&&<button type="button" disabled={busy||loading} onClick={()=>void submit(false)} className="border border-rose-300 text-rose-900 px-4 py-2 rounded-lg text-sm">Disable giving channel</button>}</div>
        </>}
      </form>
      {problem&&<p role="alert" className="text-sm text-rose-800">{problem}</p>}{notice&&<p role="status" className="text-sm text-emerald-800">{notice}</p>}
    </>}
    <GivingInstructions/>
  </section>;
}
