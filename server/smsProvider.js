import {HttpError} from './security.js';
export const TEST_SMS='GWCC SMS connection test. Your church app is connected to Arkesel.';
export const SMS_READ_ROLES=['super_admin','senior_pastor','administrator','pastor','ministry_leader'];
export const SMS_SEND_ROLES=['super_admin','senior_pastor','administrator'];
export function ghanaMobile(value){
  let text=String(value||'').trim();if(!/^(?:\+|00)?[\d ()-]+$/.test(text))return null;
  text=text.replace(/[ ()-]/g,'');
  if(text.startsWith('+'))text=text.slice(1);else if(text.startsWith('00'))text=text.slice(2);
  else if(/^0[25]\d{8}$/.test(text))text='233'+text.slice(1);else if(/^[25]\d{8}$/.test(text))text='233'+text;
  return /^233[25]\d{8}$/.test(text)?text:null;
}
export async function arkeselRequest(path,key,{body,fetchImpl=fetch}={}){
  // All callers supply fixed paths; no credential is placed in a URL or error.
  let response;
  try{response=await fetchImpl('https://sms.arkesel.com/api/v2/'+path,{method:body?'POST':'GET',headers:{'api-key':key,Accept:'application/json','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(12000)});}
  catch{throw new HttpError(502,'Arkesel did not confirm the request. Check delivery history before attempting another submission.');}
  let text='';
  try{
    if(response.body){const reader=response.body.getReader();let size=0;const decoder=new TextDecoder();try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>262144){await reader.cancel();throw new Error('large');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{reader.releaseLock();}}
    return {ok:response.ok,httpStatus:response.status,result:JSON.parse(text)};
  }catch{throw new HttpError(502,'Arkesel returned an unreadable response. Check delivery history before attempting another submission.');}
}
export function submissionOutcomes(recipients,response){
  const success=response?.ok&&response.result?.status==='success'&&Array.isArray(response.result.data);
  const rejected=response&&!success&&(response.httpStatus>=400&&response.httpStatus<500||response.ok&&response.result?.status==='error');
  const entries=success?response.result.data:[];
  return recipients.map(row=>{
    const matches=entries.filter(item=>ghanaMobile(item?.recipient)===row.phone&&typeof item.id==='string'&&/^[A-Za-z0-9-]{8,100}$/.test(item.id));
    const invalid=entries.some(item=>Array.isArray(item?.['invalid numbers'])&&item['invalid numbers'].some(phone=>String(phone).replace(/^\+/,'')===row.phone));
    return {phone:row.phone,provider_id:matches.length===1?matches[0].id:null,status:matches.length===1?'accepted':rejected||invalid?'rejected':'unknown'};
  });
}
export function verifiedReports(outcomes,response){
  if(!response.ok||response.result?.status!=='success'||!response.result.data||typeof response.result.data!=='object')throw new HttpError(502,'Arkesel could not confirm delivery reports. Existing statuses have been preserved.');
  const failed=new Set(['NOT_DELIVERED','UNDELIVERED','FAILED','EXPIRED','PROHIBITED','REJECTED']);
  return outcomes.flatMap(row=>{
    if(!row.provider_id||['delivered','failed','rejected'].includes(row.status))return [];
    const report=response.result.data[row.provider_id];
    // Bind both provider ID and recipient. Ignore unrelated/malformed reports.
    if(!report||ghanaMobile(report.recipient)!==row.phone)return [];
    const raw=String(report.status).toUpperCase();
    const status=raw==='DELIVERED'?'delivered':failed.has(raw)?'failed':['QUEUED','SUBMITTED','SENT','PENDING'].includes(raw)?'accepted':null;
    return status?[{provider_id:row.provider_id,phone:row.phone,status}]:[];
  });
}
