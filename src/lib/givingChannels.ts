import {getSupabaseClient} from './supabase';

export interface GivingChannel {
  id:string;account_type:'bank'|'momo';account_number:string;bank_or_provider:string;currency:string;account_name:string;
}
export interface GivingChannelAccount extends GivingChannel {
  label:string;is_active:boolean;account_version:string;channel_version:string|null;enabled:boolean;approved:boolean;
}
export interface GivingChannelRequest {
  p_operation_id:string;p_account_id:string;p_account_version:string;p_channel_version:string|null;p_enabled:boolean;p_account_name:string;
}
export async function loadGivingChannels(manage=false):Promise<GivingChannelAccount[]>{
  const client=getSupabaseClient();if(!client)throw new Error('Connect to the church system to confirm giving details.');
  const {data,error}=await client.rpc(manage?'gwcc_giving_channel_accounts':'gwcc_giving_channels');
  if(error)throw new Error(error.message);
  if(!Array.isArray(data))throw new Error('Giving details could not be verified. Contact the church office.');
  return data;
}
export async function saveGivingChannel(request:GivingChannelRequest):Promise<void>{
  if(!navigator.onLine)throw new Error('Connect to the internet to approve giving details.');
  const client=getSupabaseClient();if(!client)throw new Error('Connect to the church system first.');
  const {data,error}=await client.rpc('gwcc_set_giving_channel',request);
  if(error)throw new Error(error.message);
  if(data?.account_id!==request.p_account_id||data?.enabled!==request.p_enabled)throw new Error('Giving channel confirmation was interrupted. Retry the same request.');
  window.dispatchEvent(new Event('gwcc-giving-channels-updated'));
}
export function givingInstructions(channels:GivingChannel[]):string {
  return channels.length?channels.map(c=>`${c.bank_or_provider}: ${c.account_number} (${c.account_name}; ${c.currency})`).join('\n')
    :'Contact the church office for confirmed payment instructions.';
}
