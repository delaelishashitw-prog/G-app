import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {AuthProvider,useAuth,isElishaRichard} from '../src/contexts/AuthContext.tsx';
import {readVerifiedProfile} from '../src/lib/authPolicy.ts';
import {authorizeRequest} from '../server/security.js';
import {aiHandler} from '../server/ai.js';
import serverlessAi from '../api/ai/assistant.js';
import {staffHandler} from '../server/staff.js';
import {staffWebHandler} from '../server/staffWeb.js';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
function storage(){const items=new Map();return {getItem:key=>items.get(key)??null,setItem(key,value){items.set(key,String(value));this[key]=String(value);},removeItem(key){items.delete(key);delete this[key];},clear(){for(const key of items.keys())delete this[key];items.clear();}};}
globalThis.localStorage=storage();globalThis.sessionStorage=storage();
globalThis.window={location:{origin:'https://app.example.test'},addEventListener(){},removeEventListener(){},dispatchEvent(){},setInterval,clearInterval};
globalThis.document={visibilityState:'visible',addEventListener(){},removeEventListener(){}};
const user={id:'22222222-2222-4222-8222-222222222222',email:'member@example.test',email_confirmed_at:'2026-01-01',user_metadata:{role:'super_admin',first_name:'Elisha',last_name:'Richard'}};
const profile={id:user.id,email:user.email,role:'member',first_name:'Elisha',last_name:'Richard',is_active:true,has_login_account:true};
const noop=()=>{};
let counter=0;
async function mountAuth(client,seeds={}){
  localStorage.clear();sessionStorage.clear();
  const url=`https://auth-test-${++counter}.supabase.co`,key='test-anon-key';
  localStorage.setItem('gwcc_supabase_url',url);localStorage.setItem('gwcc_supabase_anon_key',key);
  for(const [key,value] of Object.entries(seeds))localStorage.setItem(key,value);
  globalThis.__GWCC_SUPABASE_CLIENT__={...client,__gwcc_config_key:`${url}:${key}`};
  let value,tree;
  function Capture(){value=useAuth();return null;}
  await act(async()=>{tree=create(React.createElement(AuthProvider,null,React.createElement(Capture)));});
  return {get value(){return value;},unmount:()=>act(async()=>tree.unmount())};
}
function mockClient(overrides={}){
  const client={auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:noop}}}),signOut:async()=>({error:null}),...overrides}};
  return client;
}
test('forged local flags and staff directories cannot establish a session; a rejected password remains rejected',async()=>{
  const auth=await mountAuth(mockClient({signInWithPassword:async()=>({data:{},error:{message:'Invalid login credentials'}})}),{
    gwcc_auth_authenticated:'true',gwcc_active_user:JSON.stringify({...profile,role:'super_admin'}),gwcc_registered_users:JSON.stringify([profile])});
  try{
    assert.equal(auth.value.isAuthenticated,false);assert.equal(auth.value.currentUser.id,'');
    let result;await act(async()=>{result=await auth.value.login(user.email,'wrong-password');});
    assert.equal(result.success,false);assert.equal(auth.value.isAuthenticated,false);assert.equal(auth.value.session,null);
    assert.equal(localStorage.getItem('gwcc_registered_users'),null);
    assert.equal((await auth.value.loginAsMember('0241234567','4567')).success,false);
  }finally{await auth.unmount();}
});
test('member login rejects unlinked accounts and staff credentials, and clears the Supabase session on rejection',async()=>{
  for(const kind of ['unlinked','staff','linked']){
    let signouts=0;
    const record={...profile,role:kind==='staff'?'administrator':'member',authorization_reviewed_at:'2026-10-15'};
    const client=mockClient({
      signInWithPassword:async()=>({data:{session:{access_token:'verified-test-token',user}}}),
      getUser:async()=>({data:{user}}),signOut:async()=>{signouts++;return {error:null};},
    });
    client.rpc=async()=>({data:{role:record.role,required:record.role!=='member',verified_factors:record.role==='member'?0:1,satisfied:true}});
    client.from=table=>({select(){return this;},eq(){return this;},single:async()=>({data:record}),maybeSingle:async()=>({data:kind==='linked'?{id:'own-member',auth_user_id:user.id}:null})});
    client.channel=()=>({on(){return this;},subscribe(){return this;}});client.removeChannel=()=>{};
    const auth=await mountAuth(client);
    try{
      let result;await act(async()=>{result=await auth.value.loginAsMember(user.email,'a-long-member-password');});
      assert.equal(result.success,kind==='linked',kind);
      if(kind==='linked'){assert.equal(auth.value.currentMember.id,'own-member');assert.equal(auth.value.isAuthenticated,true);assert.equal(signouts,0);}
      else {assert.equal(auth.value.isAuthenticated,false);assert.equal(signouts,1);assert.match(result.message,kind==='staff'?/Staff Login/:/not linked/);}
    }finally{await auth.unmount();}
  }
});
test('authorization ignores identity names and editable auth metadata, and requires verified active protected profiles',async()=>{
  const client={from:()=>({select:()=>({eq:()=>({single:async()=>({data:profile})})})})};
  assert.equal((await readVerifiedProfile(client,user)).role,'member');
  assert.equal(isElishaRichard({first_name:'Elisha',last_name:'Richard'}),false);
  await assert.rejects(readVerifiedProfile(client,{...user,email_confirmed_at:null}),/Verify/);
  const unreviewed={from:()=>({select:()=>({eq:()=>({single:async()=>({data:{...profile,role:'super_admin'}})})})})};
  await assert.rejects(readVerifiedProfile(unreviewed,user),/review/);
  const inactive={from:()=>({select:()=>({eq:()=>({single:async()=>({data:{...profile,is_active:false}})})})})};
  await assert.rejects(readVerifiedProfile(inactive,user),/inactive/);
});

test('both AI deployments share a guard that rejects missing tokens, wrong roles, suspended accounts, disallowed origins and exhausted quotas',async()=>{
  process.env.SUPABASE_URL='https://server-test.supabase.co';process.env.SUPABASE_ANON_KEY='test-public-key';
  assert.equal(serverlessAi,aiHandler);
  const req={headers:{authorization:'Bearer test-token',host:'app.example.test',origin:'https://app.example.test'}};
  function deps({record=profile,authUser=user,allowed=true,error=null}={}){return {createClient:()=>({auth:{getUser:async()=>({data:{user:authUser}})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:record})})})}),rpc:async name=>name==='gwcc_security_status'?{data:{role:record.role,satisfied:true}}:{data:allowed,error}})};}
  const staff={...profile,role:'administrator',authorization_reviewed_at:'2026-10-15'};
  await assert.rejects(authorizeRequest({headers:{}},{roles:['administrator']},deps()),error=>error.status===401);
  await assert.rejects(authorizeRequest(req,{roles:['administrator']},deps()),error=>error.status===403);
  await assert.rejects(authorizeRequest(req,{roles:['administrator']},deps({record:{...staff,is_active:false}})),error=>error.status===403);
  await assert.rejects(authorizeRequest(req,{roles:['administrator']},deps({record:{...staff,has_login_account:null}})),error=>error.status===403);
  await assert.rejects(authorizeRequest(req,{roles:['administrator']},deps({record:staff,authUser:{...user,email_confirmed_at:null}})),error=>error.status===401);
  await assert.rejects(authorizeRequest({...req,headers:{...req.headers,origin:'https://untrusted.example.test'}},{roles:['administrator']},deps({record:staff})),error=>error.status===403);
  await assert.rejects(authorizeRequest(req,{roles:['administrator']},deps({record:staff,allowed:false})),error=>error.status===429);
  await assert.rejects(authorizeRequest(req,{roles:['administrator']},deps({record:staff,error:{message:'missing migration'}})),error=>error.status===503);
  assert.equal((await authorizeRequest(req,{roles:['administrator']},deps({record:staff}))).profile.role,'administrator');
});

test('staff directory creation supplies required names and password resets select the actual login profile',async()=>{
  process.env.SUPABASE_URL='https://server-test.supabase.co';process.env.SUPABASE_ANON_KEY='test-public-key';
  const previous=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='server-only-test-key';
  const inserts=[],filters=[],passwordUpdates=[];
  const admin={from:table=>({insert:async row=>{inserts.push({table,row});return {error:null};}}),auth:{admin:{updateUserById:async(id,patch)=>{passwordUpdates.push({id,patch});return {error:null};}}}};
  const query={select(){return this;},eq(key,value){filters.push([key,value]);return this;},single:async()=>({data:{id:user.id,role:'finance_officer'}})};
  const client={from:()=>query,rpc:async(_name,args)=>({data:{id:args.p_id,...args.p_updates}})};
  const dependencies={authorizeRequest:async()=>({client,profile:{id:'root',role:'super_admin'}}),createClient:()=>admin};
  const response=()=>({code:0,body:null,setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;}});
  try{
    const res=response();
    await staffHandler({method:'POST',body:{action:'create',first_name:'Directory',last_name:'Staff',role:'data_entry',has_login_account:false}},res,dependencies);
    assert.equal(res.code,201);assert.equal(inserts[0].row.first_name,'Directory');assert.equal(inserts[0].row.last_name,'Staff');assert.equal(inserts[0].row.has_login_account,false);
    const reset=response();
    await staffHandler({method:'POST',body:{action:'reset_password',email:user.email,password:'a-long-test-password'}},reset,dependencies);
    assert.equal(reset.code,200);assert.ok(filters.some(([key,value])=>key==='has_login_account' && value===true));
    assert.equal(passwordUpdates[0].id,user.id);
    assert.ok(inserts.every(({row})=>!JSON.stringify(row).includes('a-long-test-password')));
  }finally{if(previous===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=previous;}
});

test('staff forwarding verifies root first, uses only the configured project and leaves quota consumption to the authenticated destination',async()=>{
  const previous=process.env.SUPABASE_SERVICE_ROLE_KEY;delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL='https://server-test.supabase.co';process.env.SUPABASE_ANON_KEY='test-public-key';
  const calls=[],checks=[];
  const response=()=>({code:0,body:null,setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;}});
  const req={method:'POST',headers:{authorization:'Bearer caller-token'},body:{action:'create',url:'https://untrusted.example.test'}};
  try {
    const dependencies={authorizeRequest:async(_req,options)=>{checks.push(options);return {profile:{role:'super_admin'}};},fetch:async(url,options)=>{calls.push({url,options});return Response.json({user:{id:user.id}},{status:201});}};
    const res=response();await staffHandler(req,res,dependencies);
    assert.equal(res.code,201);assert.equal(calls[0].url,'https://server-test.supabase.co/functions/v1/gwcc-staff');
    assert.equal(calls[0].options.headers.Authorization,'Bearer caller-token');assert.equal(calls[0].options.redirect,'error');
    assert.deepEqual(checks,[{roles:['super_admin'],bucket:null}]);
    const rejected=response();
    await staffHandler(req,rejected,{...dependencies,authorizeRequest:async()=>{const error=new (await import('../server/security.js')).HttpError(403,'Not authorized');throw error;}});
    assert.equal(rejected.code,403);assert.equal(calls.length,1);
    const unauthenticated=await staffWebHandler(new Request('https://server-test.supabase.co/functions/v1/gwcc-staff',{method:'POST',body:'{}'}));
    assert.equal(unauthenticated.status,401);
    const buckets=[];
    const destination=await staffWebHandler(new Request('https://server-test.supabase.co/functions/v1/gwcc-staff',{method:'POST',body:JSON.stringify({action:'archive',id:user.id})}),{
      authorizeRequest:async(_req,options)=>{buckets.push(options.bucket);return {client:{rpc:async()=>({data:{id:user.id,is_active:false}})},profile:{role:'super_admin'}};},
    });
    assert.equal(destination.status,200);assert.deepEqual(buckets,['staff']);
  } finally {if(previous===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=previous;}
});

test('the edge adapter rejects non-POST methods, malformed bodies and oversized streamed UTF-8 before staff writes',async()=>{
  let invoked=0;const dependencies={authorizeRequest:async()=>{invoked++;throw new Error('Unexpected write');}};
  const method=await staffWebHandler(new Request('https://edge.example.test'),dependencies);
  assert.equal(method.status,405);assert.equal(method.headers.get('Allow'),'POST');
  const malformed=await staffWebHandler(new Request('https://edge.example.test',{method:'POST',body:'{'}),dependencies);
  assert.equal(malformed.status,400);
  const large=await staffWebHandler(new Request('https://edge.example.test',{method:'POST',body:JSON.stringify({name:'🙂'.repeat(6000)})}),dependencies);
  assert.equal(large.status,413);assert.equal(invoked,0);assert.equal(large.headers.get('Cache-Control'),'no-store');
});

test('partial staff sign-in is kept only for MFA and cannot read the staff directory or enable modules until security verification succeeds',async()=>{
 const record={...profile,role:'super_admin',authorization_reviewed_at:'2026-10-17'},session={access_token:'synthetic-aal1-token',user};
 let satisfied=false,directoryReads=0;
 const client=mockClient({getSession:async()=>({data:{session}}),getUser:async()=>({data:{user}})});
 client.rpc=async name=>{assert.equal(name,'gwcc_security_status');return {data:{role:record.role,required:true,verified_factors:satisfied?1:0,satisfied}};};
 client.from=table=>{assert.equal(table,'profiles');return {select(){return this;},eq(){return this;},single:async()=>({data:record}),order:async()=>{directoryReads++;return {data:[record]};}};};
 client.channel=()=>({on(){return this;},subscribe(){return this;}});client.removeChannel=()=>{};
 const auth=await mountAuth(client);
 try{
  assert.equal(auth.value.currentUser.id,user.id);assert.equal(auth.value.session.access_token,session.access_token);
  assert.equal(auth.value.isAuthenticated,false);assert.equal(auth.value.canAccess('finance'),false);assert.equal(auth.value.hasRole(['super_admin']),false);assert.equal(directoryReads,0);
  satisfied=true;await act(async()=>{await auth.value.refreshSecurity();});assert.equal(auth.value.isAuthenticated,true);assert.equal(auth.value.canAccess('finance'),true);assert.equal(directoryReads,1);
 }finally{await auth.unmount();}
});

test('API MFA authorization fails closed before quotas and applies even to forwarding handlers that do not consume a quota',async()=>{
 process.env.SUPABASE_URL='https://server-test.supabase.co';process.env.SUPABASE_ANON_KEY='test-public-key';
 const record={...profile,role:'super_admin',authorization_reviewed_at:'2026-10-17'},req={headers:{authorization:'Bearer signed-test-token'}};
 for(const state of [null,{role:'super_admin',satisfied:false},{role:'administrator',satisfied:true},true]){
  const calls=[],client={auth:{getUser:async()=>({data:{user}})},from:()=>({select(){return this;},eq(){return this;},single:async()=>({data:record})}),rpc:async name=>{calls.push(name);return {data:state};}};
  await assert.rejects(authorizeRequest(req,{roles:['super_admin'],bucket:null},{createClient:()=>client}),e=>e.status===403||e.status===503);
  assert.deepEqual(calls,['gwcc_security_status']);
 }
});

test('checking the current password for a password change does not downgrade or replace the MFA-verified app session',async()=>{
 const originalFetch=globalThis.fetch,requests=[],updates=[],record={...profile,role:'super_admin',authorization_reviewed_at:'2026-10-17'};
 const session={access_token:'original-mfa-verified-session',user};
 const client=mockClient({getSession:async()=>({data:{session}}),getUser:async()=>({data:{user}}),signInWithPassword:async()=>{throw new Error('Must not replace the active MFA session');},updateUser:async patch=>{updates.push(patch);return {error:null};}});
 client.rpc=async()=>({data:{role:record.role,required:true,verified_factors:1,satisfied:true}});
 client.from=()=>({select(){return this;},eq(){return this;},single:async()=>({data:record}),order:async()=>({data:[record]})});
 client.channel=()=>({on(){return this;},subscribe(){return this;}});client.removeChannel=()=>{};
 const auth=await mountAuth(client);
 globalThis.fetch=async(input,init)=>{
  const url=String(input);requests.push(url);
  if(url.includes('/token')){
   const body=JSON.parse(init.body);if(body.password==='incorrect')return Response.json({error:'invalid_grant',error_description:'Invalid login credentials'},{status:400});
   return Response.json({access_token:'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzeW50aGV0aWMifQ.signature',refresh_token:'isolated-refresh',expires_in:3600,token_type:'bearer',user});
  }
  if(url.includes('/logout'))return new Response(null,{status:204});
  throw new Error('Unexpected password verification request');
 };
 try{
  let result;await act(async()=>{result=await auth.value.changePassword('a-new-long-synthetic-password','incorrect');});assert.equal(result.success,false);assert.equal(updates.length,0);
  await act(async()=>{result=await auth.value.changePassword('a-new-long-synthetic-password','a-current-synthetic-password');});assert.equal(result.success,true);assert.deepEqual(updates,[{password:'a-new-long-synthetic-password'}]);
  assert.equal(auth.value.session.access_token,session.access_token);assert.equal(auth.value.isAuthenticated,true);assert.equal(requests.filter(url=>url.includes('/logout')).length,1);
 }finally{globalThis.fetch=originalFetch;await auth.unmount();}
});

test('a new password sign-in immediately suspends the old verified session while the MFA check is pending, and late results cannot restore a signed-out identity',async()=>{
 const record={...profile,role:'super_admin',authorization_reviewed_at:'2026-10-17'};
 const initial={access_token:'synthetic-aal2-token',user},next={access_token:'synthetic-aal1-token',user};
 let listener,release,hold=false;
 const client=mockClient({getSession:async()=>({data:{session:initial}}),getUser:async()=>({data:{user}}),onAuthStateChange:callback=>{listener=callback;return {data:{subscription:{unsubscribe:noop}}};}});
 client.rpc=async()=>{if(hold)await new Promise(resolve=>release=resolve);return {data:{role:record.role,required:true,verified_factors:1,satisfied:!hold}};};
 client.from=()=>({select(){return this;},eq(){return this;},single:async()=>({data:record}),order:async()=>({data:[record]})});
 client.channel=()=>({on(){return this;},subscribe(){return this;}});client.removeChannel=()=>{};
 const auth=await mountAuth(client);
 try{
  assert.equal(auth.value.isAuthenticated,true);
  const readCache=`gwcc_cache_${user.id}_members`,pending=`gwcc_outbox_v2_${user.id}`;localStorage.setItem(readCache,'previous private records');localStorage.setItem(pending,'pending work retained');
  hold=true;
  await act(async()=>{listener('SIGNED_IN',next);});
  assert.equal(auth.value.isAuthenticated,false);assert.equal(auth.value.canAccess('finance'),false);assert.equal(auth.value.isAuthLoading,true);
  assert.equal(localStorage.getItem(readCache),null);assert.equal(localStorage.getItem(pending),'pending work retained');
  await act(async()=>{await auth.value.logout();});assert.equal(auth.value.currentUser.id,'');
  await act(async()=>{release();});assert.equal(auth.value.currentUser.id,'');assert.equal(auth.value.isAuthenticated,false);
 }finally{await auth.unmount();}
});

test('a member who opts into MFA reaches the code challenge before any member-record lookup, then loads only their linked portal record',async()=>{
 const session={access_token:'synthetic-member-mfa-session',user};let satisfied=false,lookups=0;
 const client=mockClient({getUser:async()=>({data:{user}}),signInWithPassword:async()=>({data:{session}})});
 client.rpc=async()=>({data:{role:'member',required:true,verified_factors:1,satisfied}});
 client.from=table=>({select(){return this;},eq(){return this;},single:async()=>({data:profile}),maybeSingle:async()=>{assert.equal(table,'members');assert.equal(satisfied,true,'No member record lookup before MFA');lookups++;return {data:{id:'linked-mfa-member',auth_user_id:user.id}};}});
 client.channel=()=>({on(){return this;},subscribe(){return this;}});client.removeChannel=()=>{};
 const auth=await mountAuth(client);
 try{
  let result;await act(async()=>{result=await auth.value.loginAsMember(user.email,'a-long-synthetic-password');});
  assert.equal(result.success,true);assert.equal(auth.value.isAuthenticated,false);assert.equal(auth.value.securityStatus.required,true);assert.equal(lookups,0);
  client.auth.getSession=async()=>({data:{session}});satisfied=true;
  await act(async()=>{await auth.value.refreshSecurity();});assert.equal(auth.value.isAuthenticated,true);assert.equal(auth.value.currentMember.id,'linked-mfa-member');assert.equal(lookups,1);
 }finally{await auth.unmount();}
});
