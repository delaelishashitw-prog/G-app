import test from 'node:test';
import assert from 'node:assert/strict';
import { setSyncIdentity, pushAllDataToSupabase, getSyncStatus, clearPrivateCache } from '../src/lib/supabase.ts';

let sequence=0;
async function bulkFixture(run) {
  const previousFetch=globalThis.fetch,previousStorage=globalThis.localStorage,navigatorDescriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  const values=new Map(),owner=`bulk-${++sequence}`,url=`https://${owner}.supabase.co`,key='test-public-key';
  const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  globalThis.localStorage=storage;Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
  storage.setItem('gwcc_supabase_url',url);storage.setItem('gwcc_supabase_anon_key',key);
  globalThis.__GWCC_SUPABASE_CLIENT__={__gwcc_config_key:`${url}:${key}`,auth:{getSession:async()=>({data:{session:{access_token:'test-token',user:{id:owner}}}})}};
  const requests=[];let rejectTable=null,beforeReply=null;
  globalThis.fetch=async(input,init)=>{
    assert.equal(String(input),url+'/rest/v1/rpc/gwcc_apply_mutations');
    const args=JSON.parse(init.body);requests.push(args);
    const rejected=args.p_changes.some(change=>change.table===rejectTable);
    if(beforeReply)await beforeReply(args);
    return new Response(JSON.stringify(rejected?{message:'Synthetic cloud rejection'}:args.p_changes.map(change=>({table:change.table,record:{...change.record,updated_at:'2026-10-16T00:00:00Z'}}))),{status:rejected?400:200,headers:{'content-type':'application/json'}});
  };
  try{await setSyncIdentity(owner,'super_admin');await run({requests,reject:value=>{rejectTable=value;},onReply:fn=>{beforeReply=fn;}});}
  finally{clearPrivateCache();globalThis.fetch=previousFetch;if(previousStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=previousStorage;if(navigatorDescriptor)Object.defineProperty(globalThis,'navigator',navigatorDescriptor);else delete globalThis.navigator;delete globalThis.__GWCC_SUPABASE_CLIENT__;}
}
test('bulk sync streams bounded chunks and reports only acknowledged records',async()=>bulkFixture(async({requests})=>{
  const members=Array.from({length:6},(_,i)=>({id:`photo-${i}`,first_name:'Photo',last_name:String(i),profile_photo_url:'data:image/jpeg;base64,'+'A'.repeat(70000)}));
  const data={settings:{id:'gwcc_global_settings',church_name:'Test'},members};
  const result=await pushAllDataToSupabase(data);
  assert.equal(result.success,true);assert.equal(result.summary.members,6);assert.equal(result.summary.settings,1);
  assert.ok(requests.length>=7);assert.ok(requests.every(request=>request.p_changes.length<=50));assert.ok(requests.every(request=>Buffer.byteLength(JSON.stringify(request.p_changes))<128000));
  assert.equal(new Set(requests.map(request=>request.p_operation_id)).size,requests.length);assert.equal(getSyncStatus().pending,0);
}));
test('bulk sync stops if the signed-in identity changes and does not queue old records for the next account',async()=>bulkFixture(async({requests,onReply})=>{
  let changed=false;onReply(async()=>{if(!changed){changed=true;await setSyncIdentity('another-account','super_admin');}});
  const result=await pushAllDataToSupabase({settings:{id:'gwcc_global_settings'},members:[{id:'private-old-record',first_name:'Original account'}]});
  assert.equal(result.success,false);assert.match(result.errors[0],/account changed/);assert.equal(requests.length,1);assert.equal(getSyncStatus().pending,0);
}));
test('bulk sync stops at a rejected chunk, retains it, and never counts it as synced',async()=>bulkFixture(async({requests,reject})=>{
  reject('members');const result=await pushAllDataToSupabase({settings:{id:'gwcc_global_settings'},members:[{id:'member',first_name:'Pending'}],giving:[{id:'should-not-send',amount:100}]});
  assert.equal(result.success,false);assert.equal(result.summary.settings,1);assert.equal(result.summary.members,0);assert.match(result.errors[0],/Synthetic cloud rejection/);
  assert.equal(requests.length,2);assert.equal(getSyncStatus().pending,1);assert.ok(requests.every(request=>request.p_changes.every(change=>change.table!=='giving')));
}));
