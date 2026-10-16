import test from 'node:test';
import assert from 'node:assert/strict';
import {smsHandler} from '../server/sms.js';
import {smsWebHandler} from '../server/smsWeb.js';
import {ghanaMobile,submissionOutcomes,verifiedReports,TEST_SMS,SMS_SEND_ROLES} from '../server/smsProvider.js';
import {smsSegments} from '../src/lib/smsSegments.js';
import {HttpError} from '../server/security.js';
const actor='11111111-1111-4111-8111-111111111111',operation='aaaaaaaa-aaaa-4aaa-8aaa-111111111111';
const recipients=[{id:'a',name:'Synthetic A',phone:'233240000001'},{id:'b',name:'Synthetic B',phone:'233240000002'}];
const preview={draft_id:'draft',version:'2026-10-16T15:00:00Z',digest:'current-digest',sender:'GWCC',message:'Synthetic only',recipients};
const response=()=>({code:0,body:null,setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;}});
function env(){
 const values={SUPABASE_URL:'https://sms-test.supabase.co',SUPABASE_ANON_KEY:'public-test-key',SUPABASE_SERVICE_ROLE_KEY:'private-test-service',ARKESEL_API_KEY:'private-test-provider-key',ARKESEL_SENDER_ID:'GWCC',ARKESEL_SMS_ENABLED:'true'};
 const before=Object.fromEntries(Object.keys(values).map(key=>[key,process.env[key]]));Object.assign(process.env,values);
 return ()=>{for(const [key,value]of Object.entries(before))if(value===undefined)delete process.env[key];else process.env[key]=value;};
}
function backend({fetchImpl,reused=false,finishError=false}={}){
 const calls=[],dispatch={id:operation,snapshot:preview,state:'started',outcomes:[]};
 const client={rpc:async(name,args)=>{calls.push({name,args,client:'user'});return {data:name==='gwcc_sms_preview'?preview:[]};}};
 const admin={rpc:async(name,args)=>{
   calls.push({name,args,client:'server'});
   if(name==='gwcc_sms_claim')return {data:{created:!reused,dispatch}};
   if(name==='gwcc_sms_finish')return finishError?{error:{message:'Synthetic database outage'}}:{data:{...dispatch,state:args.p_state,outcomes:args.p_outcomes}};
   if(name==='gwcc_sms_reports')return {data:{...dispatch,outcomes:[{phone:recipients[0].phone,provider_id:'message-id-111',status:'accepted'}]}};
 }};
 return {calls,dependencies:{edgeRuntime:true,authorizeRequest:async(_req,options)=>{calls.push({name:'authorize',options});return {client,profile:{id:actor,role:'super_admin'}};},createClient:()=>admin,fetch:fetchImpl||(async()=>Response.json({status:'success',data:recipients.map((r,i)=>({recipient:r.phone,id:'provider-id-'+i}))}))}};
}
const req=(body)=>({method:'POST',headers:{authorization:'Bearer verified-user'},body});
const send={action:'send',operation_id:operation,draft_id:'draft',version:preview.version,digest:preview.digest,confirmed:true};

test('SMS estimates count GSM extension characters, Unicode and surrogate pairs at segment boundaries',()=>{
 assert.equal(smsSegments('a'.repeat(160)).segments,1);assert.equal(smsSegments('a'.repeat(161)).segments,2);
 assert.equal(smsSegments('^'.repeat(80)).segments,1);assert.equal(smsSegments('^'.repeat(81)).segments,2);
 assert.equal(smsSegments('a'.repeat(152)+'^'+'a'.repeat(152)).segments,3);
 assert.equal(smsSegments('₵'.repeat(70)).segments,1);assert.equal(smsSegments('₵'.repeat(71)).segments,2);
 assert.equal(smsSegments('🙂'.repeat(35)).segments,1);assert.equal(smsSegments('🙂'.repeat(36)).segments,2);
 assert.equal(smsSegments(TEST_SMS).segments,1);assert.equal(smsSegments('').segments,0);
});
test('SMS provider accepts only complete Ghana mobiles and does not mislabel acceptance or unrelated reports as delivery',()=>{
 assert.equal(ghanaMobile('024 000 0001'),'233240000001');assert.equal(ghanaMobile('00233240000001'),'233240000001');
 for(const phone of ['23324000001','+2330240000001','+12025550100','0300000001','letters0240000001'])assert.equal(ghanaMobile(phone),null);
 const outcomes=submissionOutcomes(recipients,{ok:true,httpStatus:200,result:{status:'success',data:[{recipient:recipients[0].phone,id:'message-id-111'},{'invalid numbers':[recipients[1].phone]}]}});
 assert.deepEqual(outcomes.map(row=>row.status),['accepted','rejected']);
 assert.equal(submissionOutcomes(recipients,null)[0].status,'unknown');
 assert.equal(submissionOutcomes(recipients,{ok:false,httpStatus:500,result:{status:'error'}})[0].status,'unknown');
 assert.equal(submissionOutcomes(recipients,{ok:false,httpStatus:402,result:{status:'error'}})[0].status,'rejected');
 const report={ok:true,result:{status:'success',data:{'message-id-111':{recipient:recipients[1].phone,status:'DELIVERED'}}}};
 assert.deepEqual(verifiedReports(outcomes,report),[]);report.result.data['message-id-111'].recipient=recipients[0].phone;
 assert.equal(verifiedReports(outcomes,report)[0].status,'delivered');assert.deepEqual(verifiedReports([{...outcomes[0],status:'delivered'}],report),[]);
});
test('SMS status and connection checks expose no key, send no message and stay disabled without backend configuration',async()=>{
 const restore=env();try{
  const backendMock=backend({fetchImpl:async(url,options)=>{assert.equal(url,'https://sms.arkesel.com/api/v2/clients/balance-details');assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.headers['api-key'],'private-test-provider-key');return Response.json({status:'success',data:{sms_balance:'200'}});}});
  const status=response();await smsHandler(req({action:'status'}),status,backendMock.dependencies);assert.equal(status.body.ready,true);assert.ok(!JSON.stringify(status.body).includes('private-test'));
  const check=response();await smsHandler(req({action:'check'}),check,backendMock.dependencies);assert.equal(check.body.provider_verified,true);assert.equal(check.body.sms_balance,200);
  delete process.env.ARKESEL_API_KEY;const missing=response();await smsHandler(req(send),missing,backendMock.dependencies);assert.equal(missing.code,503);assert.equal(backendMock.calls.filter(row=>row.name==='gwcc_sms_claim').length,0);
 }finally{restore();}
});
test('SMS sending claims first, uses only server-resolved content, and repeated IDs make no second provider call',async()=>{
 const restore=env();try{
  let sends=0,claimed=false;
  const mock=backend({fetchImpl:async(url,options)=>{sends++;assert.ok(mock.calls.some(row=>row.name==='gwcc_sms_claim'));assert.equal(url,'https://sms.arkesel.com/api/v2/sms/send');assert.deepEqual(JSON.parse(options.body),{sender:'GWCC',message:preview.message,recipients:recipients.map(row=>row.phone)});return Response.json({status:'success',data:recipients.map((r,i)=>({recipient:r.phone,id:'provider-id-'+i}))});}});
  const admin=mock.dependencies.createClient();const original=admin.rpc;admin.rpc=async(name,args)=>{if(name==='gwcc_sms_claim'&&claimed)return {data:{created:false,dispatch:{id:operation,state:'submitted',snapshot:preview,outcomes:[]}}};const result=await original(name,args);if(name==='gwcc_sms_claim')claimed=true;return result;};
  const first=response();await smsHandler(req({...send,message:'forged',recipients:['233240999999'],sender:'Wrong'}),first,mock.dependencies);
  assert.equal(first.code,200);assert.equal(first.body.dispatch.state,'submitted');assert.equal(first.body.dispatch.outcomes[0].status,'accepted');
  const second=response();await smsHandler(req(send),second,mock.dependencies);assert.equal(second.body.reused,true);assert.equal(sends,1);assert.deepEqual(mock.calls.find(row=>row.name==='authorize').options.roles,SMS_SEND_ROLES);
 }finally{restore();}
});
test('missing consent and stale recipient review stop before provider calls; timeouts remain unknown and raw provider errors never reach the client',async()=>{
 const restore=env();try{
  let sends=0;const mock=backend({fetchImpl:async()=>{sends++;throw new Error('Secret private-test-provider-key should not escape');}});
  for(const body of [{...send,confirmed:false},{...send,digest:'stale-digest'}]){const res=response();await smsHandler(req(body),res,mock.dependencies);assert.ok([400,409].includes(res.code));}
  assert.equal(sends,0);const timeout=response();await smsHandler(req(send),timeout,mock.dependencies);assert.equal(timeout.body.dispatch.state,'unknown');assert.equal(sends,1);assert.ok(!JSON.stringify(timeout.body).includes('private-test'));
  const failing=backend({finishError:true});const unavailable=response();await smsHandler(req(send),unavailable,failing.dependencies);assert.equal(unavailable.code,503);assert.match(unavailable.body.error,/before attempting another/);
 }finally{restore();}
});
test('single-phone tests have fixed content, normalized destination and explicit consent',async()=>{
 const restore=env();try{
  const mock=backend();const admin=mock.dependencies.createClient(),original=admin.rpc;
  admin.rpc=async(name,args)=>name==='gwcc_sms_claim'?{data:{created:true,dispatch:{id:operation,snapshot:{message:TEST_SMS,sender:'GWCC',recipients:[recipients[0]]}}}}:original(name,args);
  mock.dependencies.fetch=async(_url,options)=>{const body=JSON.parse(options.body);assert.equal(body.message,TEST_SMS);assert.deepEqual(body.recipients,[recipients[0].phone]);return Response.json({status:'success',data:[{recipient:recipients[0].phone,id:'test-provider-id'}]});};
  const res=response();await smsHandler(req({action:'test',operation_id:operation,phone:'0240000001',message:'Do not use caller content',confirmed:true}),res,mock.dependencies);assert.equal(res.code,200);
  const bad=response();await smsHandler(req({action:'test',operation_id:operation,phone:'+12025550100',confirmed:true}),bad,mock.dependencies);assert.equal(bad.code,400);
 }finally{restore();}
});
test('delivery refresh queries only stored provider IDs and matches reports before updating immutable submission history',async()=>{
 const restore=env();try{
  const mock=backend({fetchImpl:async(url,options)=>{assert.equal(url,'https://sms.arkesel.com/api/v2/sms/message-reports');assert.deepEqual(JSON.parse(options.body),{msg_ids:['message-id-111']});return Response.json({status:'success',data:{'message-id-111':{recipient:recipients[0].phone,status:'DELIVERED'}}});}});
  const res=response();await smsHandler(req({action:'refresh',id:operation,msg_ids:['forged']}),res,mock.dependencies);assert.equal(res.code,200);
  assert.deepEqual(mock.calls.filter(row=>row.name==='gwcc_sms_reports').at(-1).args.p_reports,[{provider_id:'message-id-111',phone:recipients[0].phone,status:'delivered'}]);
 }finally{restore();}
});
test('SMS proxy verifies authorization before forwarding to its fixed backend; edge rejects malicious origins and malformed or oversized bodies',async()=>{
 const restore=env();try{
  let forwards=0;const dependencies={authorizeRequest:async()=>{throw new HttpError(403,'Not authorized');},fetch:async()=>{forwards++;return Response.json({});}};
  const denied=response();await smsHandler(req(send),denied,dependencies);assert.equal(denied.code,403);assert.equal(forwards,0);
  dependencies.authorizeRequest=async(_req,options)=>{assert.equal(options.bucket,null);return {client:{},profile:{role:'super_admin'}};};dependencies.fetch=async(url,options)=>{forwards++;assert.equal(url,'https://sms-test.supabase.co/functions/v1/gwcc-sms');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer verified-user');return Response.json({ready:false});};
  const forwarded=response();await smsHandler(req({action:'status',url:'https://untrusted.example.test'}),forwarded,dependencies);assert.equal(forwarded.code,200);assert.equal(forwards,1);
  const origin=await smsWebHandler(new Request('https://edge.test',{method:'POST',headers:{origin:'https://untrusted.test'},body:'{}'}),{appOrigin:'https://app.test'});assert.equal(origin.status,403);
  const method=await smsWebHandler(new Request('https://edge.test'));assert.equal(method.status,405);
  const malformed=await smsWebHandler(new Request('https://edge.test',{method:'POST',body:'{'}));assert.equal(malformed.status,400);
  const large=await smsWebHandler(new Request('https://edge.test',{method:'POST',body:JSON.stringify({x:'🙂'.repeat(6000)})}));assert.equal(large.status,413);
  const unauth=await smsWebHandler(new Request('https://edge.test',{method:'POST',body:'{"action":"status"}'}));assert.equal(unauth.status,401);
 }finally{restore();}
});
