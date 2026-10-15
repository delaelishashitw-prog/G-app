import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {AuthProvider,useAuth,isElishaRichard} from '../src/contexts/AuthContext.tsx';
import {readVerifiedProfile} from '../src/lib/authPolicy.ts';
import {authorizeRequest} from '../server/security.js';
import {aiHandler} from '../server/ai.js';
import serverlessAi from '../api/ai/assistant.js';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;
function storage(){const items=new Map();return {getItem:key=>items.get(key)??null,setItem:(key,value)=>items.set(key,String(value)),removeItem:key=>items.delete(key),clear:()=>items.clear()};}
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
  const client={auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:noop}}}),...overrides}};
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
  function deps({record=profile,authUser=user,allowed=true,error=null}={}){return {createClient:()=>({auth:{getUser:async()=>({data:{user:authUser}})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:record})})})}),rpc:async()=>({data:allowed,error})})};}
  const staff={...profile,role:'administrator',authorization_reviewed_at:'2026-10-15'};
  await assert.rejects(authorizeRequest({headers:{}},{roles:['administrator']},deps()),error=>error.status===401);
  await assert.rejects(authorizeRequest(req,{roles:['administrator']},deps()),error=>error.status===403);
  await assert.rejects(authorizeRequest(req,{roles:['administrator']},deps({record:{...staff,is_active:false}})),error=>error.status===403);
  await assert.rejects(authorizeRequest(req,{roles:['administrator']},deps({record:staff,authUser:{...user,email_confirmed_at:null}})),error=>error.status===401);
  await assert.rejects(authorizeRequest({...req,headers:{...req.headers,origin:'https://untrusted.example.test'}},{roles:['administrator']},deps({record:staff})),error=>error.status===403);
  await assert.rejects(authorizeRequest(req,{roles:['administrator']},deps({record:staff,allowed:false})),error=>error.status===429);
  await assert.rejects(authorizeRequest(req,{roles:['administrator']},deps({record:staff,error:{message:'missing migration'}})),error=>error.status===503);
  assert.equal((await authorizeRequest(req,{roles:['administrator']},deps({record:staff}))).profile.role,'administrator');
});
