import {createClient} from '@supabase/supabase-js';
import process from 'node:process';
import {authorizeRequest,serverSupabaseConfig,HttpError,requirePost,sendError} from './security.js';
import {arkeselRequest,ghanaMobile,submissionOutcomes,verifiedReports,TEST_SMS,SMS_READ_ROLES,SMS_SEND_ROLES} from './smsProvider.js';
import {smsSegments} from '../src/lib/smsSegments.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function rpc(client,name,args){const {data,error}=await client.rpc(name,args);if(error)throw new HttpError(error.code==='42501'?403:400,error.message);return data;}
function envConfig(){
  const apiKey=process.env.ARKESEL_API_KEY?.trim()||'',sender=process.env.ARKESEL_SENDER_ID?.trim()||'';
  const senderValid=/^[A-Za-z0-9 -]{1,11}$/.test(sender),enabled=process.env.ARKESEL_SMS_ENABLED==='true';
  return {apiKey,sender,senderValid,enabled};
}

export async function smsHandler(req,res,dependencies={}){
  if(!requirePost(req,res))return;
  try{
    if(new TextEncoder().encode(JSON.stringify(req.body||{})).length>20000)throw new HttpError(413,'The request is too large.');
    const body=req.body||{},action=body.action;
    const write=['send','test'].includes(action),forward=!dependencies.edgeRuntime;
    const {client,profile}=await (dependencies.authorizeRequest||authorizeRequest)(req,{
      roles:write?SMS_SEND_ROLES:SMS_READ_ROLES,bucket:forward?null:'notifications',allowedOrigins:dependencies.appOrigin?[dependencies.appOrigin]:[],
    });
    const config=serverSupabaseConfig();
    if(forward){
      let response;
      try{response=await (dependencies.fetch||fetch)(`${config.url}/functions/v1/gwcc-sms`,{
        method:'POST',headers:{Authorization:req.headers.authorization,apikey:config.key,'Content-Type':'application/json'},
        body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(25000),
      });}catch{throw new HttpError(503,'SMS service did not confirm this request. Check SMS delivery history before submitting again.');}
      let result;try{result=await response.json();}catch{throw new HttpError(503,'SMS service is temporarily unavailable. Check delivery history before submitting again.');}
      res.status(response.status).json(result);return;
    }
    const {apiKey,sender,senderValid,enabled}=envConfig(),serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
    const status={provider:'Arkesel',api_key_configured:Boolean(apiKey),sender_id:senderValid?sender:null,enabled,storage_configured:Boolean(serviceKey),ready:Boolean(apiKey&&senderValid&&enabled&&serviceKey),test_message:TEST_SMS};
    if(action==='status'){res.status(200).json(status);return;}
    if(action==='history'){res.status(200).json({dispatches:await rpc(client,'gwcc_sms_history',{})});return;}
    if(action==='check'){
      if(!apiKey)throw new HttpError(503,'Add ARKESEL_API_KEY in Supabase Edge Function Secrets first.');
      const response=await arkeselRequest('clients/balance-details',apiKey,{fetchImpl:dependencies.fetch||fetch});
      if(!response.ok||response.result?.status!=='success')throw new HttpError(502,'Arkesel rejected the connection check. Review the API key and account in the provider dashboard.');
      const raw=response.result?.data?.sms_balance,balance=raw!==null&&raw!==undefined&&String(raw).trim()!==''?Number(raw):NaN;
      res.status(200).json({...status,provider_verified:true,sms_balance:Number.isFinite(balance)&&balance>=0?balance:null});return;
    }
    if(action==='preview'){
      if(!SMS_SEND_ROLES.includes(profile.role))throw new HttpError(403,'Your role can prepare drafts; an administrator must approve SMS sending.');
      const preview=await rpc(client,'gwcc_sms_preview',{p_draft_id:body.draft_id,p_version:body.version});
      const estimate=smsSegments(preview.message);
      res.status(200).json({preview,estimate:{...estimate,total:estimate.segments*preview.recipients.length}});return;
    }
    if(!['send','test','refresh'].includes(action))throw new HttpError(400,'Unknown SMS operation.');
    if(!serviceKey)throw new HttpError(503,'The secure SMS backend is not configured.');
    const admin=(dependencies.createClient||createClient)(config.url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    if(action==='refresh'){
      if(!uuid.test(body.id||''))throw new HttpError(400,'Choose a recorded SMS submission.');
      const dispatch=await rpc(admin,'gwcc_sms_reports',{p_actor:profile.id,p_id:body.id,p_reports:null});
      const pending=dispatch.outcomes.filter(row=>row.provider_id&&!['delivered','failed','rejected'].includes(row.status));
      if(!pending.length){res.status(200).json({dispatch});return;}
      if(!apiKey)throw new HttpError(503,'Restore the Arkesel API key to check delivery reports.');
      const response=await arkeselRequest('sms/message-reports',apiKey,{body:{msg_ids:pending.map(row=>row.provider_id)},fetchImpl:dependencies.fetch||fetch});
      const reports=verifiedReports(pending,response);
      res.status(200).json({dispatch:await rpc(admin,'gwcc_sms_reports',{p_actor:profile.id,p_id:body.id,p_reports:reports})});return;
    }
    if(body.confirmed!==true)throw new HttpError(400,'Review and explicitly confirm the SMS recipients and charges first.');
    if(!uuid.test(body.operation_id||''))throw new HttpError(400,'A valid SMS operation ID is required.');
    if(!status.ready)throw new HttpError(503,'SMS sending is disabled. Configure the Arkesel API key, approved sender ID and enable flag in backend secrets.');
    let phone=null,estimate=smsSegments(TEST_SMS);
    if(action==='test'){
      phone=ghanaMobile(body.phone);if(!phone)throw new HttpError(400,'Enter your complete Ghana mobile number for the test.');
    }else{
      if(typeof body.draft_id!=='string'||typeof body.version!=='string'||typeof body.digest!=='string')throw new HttpError(400,'Review the saved SMS draft first.');
      // The database claim repeats this check atomically. No client message or recipient list is trusted.
      const preview=await rpc(client,'gwcc_sms_preview',{p_draft_id:body.draft_id,p_version:body.version});
      if(preview.digest!==body.digest)throw new HttpError(409,'The message or phone numbers changed. Review SMS again.');
      estimate=smsSegments(preview.message);
    }
    if(estimate.segments<1||estimate.segments>10)throw new HttpError(400,'Shorten this SMS to at most 10 segments per recipient.');
    const claim=await rpc(admin,'gwcc_sms_claim',{p_actor:profile.id,p_id:body.operation_id,p_draft_id:action==='test'?null:body.draft_id,p_version:action==='test'?null:body.version,p_digest:action==='test'?null:body.digest,p_sender:sender,p_test_phone:phone,p_segments:estimate.segments});
    if(!claim.created){res.status(200).json({dispatch:claim.dispatch,reused:true});return;}
    const snapshot=claim.dispatch.snapshot;
    let response=null;
    try{response=await arkeselRequest('sms/send',apiKey,{body:{sender:snapshot.sender,message:snapshot.message,recipients:snapshot.recipients.map(row=>row.phone)},fetchImpl:dependencies.fetch||fetch});}
    catch{/* The persistent claim prevents an ambiguous request from being sent twice. */}
    const outcomes=submissionOutcomes(snapshot.recipients,response);
    const state=outcomes.some(row=>row.provider_id)?'submitted':outcomes.every(row=>row.status==='rejected')?'rejected':'unknown';
    let dispatch;
    try{dispatch=await rpc(admin,'gwcc_sms_finish',{p_id:claim.dispatch.id,p_state:state,p_outcomes:outcomes});}
    catch{throw new HttpError(503,'The submission outcome could not be saved. Check SMS history and Arkesel before attempting another submission.');}
    res.status(200).json({dispatch,reused:false});
  }catch(error){sendError(res,error);}
}
