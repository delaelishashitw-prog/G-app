import test from 'node:test';
import assert from 'node:assert/strict';
import {SyncOutbox} from '../src/lib/syncOutbox.ts';
import {fetchAllRows} from '../src/lib/supabase.ts';
const storage=()=>{const rows=new Map();return {getItem:key=>rows.get(key)||null,setItem:(key,value)=>rows.set(key,value)};};
const change=(id,value=1)=>({table:'members',operation:'upsert',id,record:{id,value}});
test('failed writes survive a reload with identical retry IDs and payloads, and merge over empty successful reads',async()=>{
  const disk=storage();let box=new SyncOutbox('owner',disk);box.enqueue(change('A'));
  let first;await box.flush({rpc:async(_name,args)=>{first=structuredClone(args);return {error:{message:'Network unavailable'}};}});
  assert.equal(box.status.pending,1);assert.match(box.status.error,/Network/);
  box=new SyncOutbox('owner',disk);assert.deepEqual(box.merge('members',[]).map(row=>row.id),['A']);
  let retry;await box.flush({rpc:async(_name,args)=>{retry=structuredClone(args);return {data:[{table:'members',record:{id:'A',updated_at:'2026-10-15T00:00:00Z'}}]};}});
  assert.deepEqual(retry,first);assert.equal(box.status.pending,0);
  assert.deepEqual(box.merge('members',[]),[]);
});
test('in-flight requests remain immutable, later edits receive acknowledged versions, and account queues stay isolated',async()=>{
  const disk=storage(),box=new SyncOutbox('A',disk);box.observe('members',[{id:'row',updated_at:'v1'}]);box.enqueue(change('row',1));
  let complete,calls=[];const running=box.flush({rpc:async(_name,args)=>{calls.push(structuredClone(args));if(calls.length===1)await new Promise(resolve=>complete=resolve);return {data:[{table:'members',record:{id:'row',updated_at:'v2'}}]};}});
  await Promise.resolve();box.enqueue(change('row',2));
  assert.equal(new SyncOutbox('B',disk).status.pending,0);
  assert.equal(calls[0].p_changes[0].record.value,1);complete();await running;
  assert.equal(calls.length,2);assert.notEqual(calls[0].p_operation_id,calls[1].p_operation_id);
  assert.equal(calls[1].p_changes[0].record.value,2);assert.equal(calls[1].p_changes[0].expected_updated_at,'v2');
});
test('related money mutations remain in one transaction at a full-batch boundary; storage failures are visible',()=>{
  const box=new SyncOutbox('owner',storage());for(let i=0;i<499;i++)box.enqueue(change(`m${i}`));
  box.enqueueMany([{...change('receipt'),table:'church_finances'},{...change('contribution'),table:'welfare_event_contributions'}]);
  const saved=JSON.parse(box.exportPending()).batches;assert.equal(saved.length,2);assert.deepEqual(saved[1].changes.map(row=>row.table),['church_finances','welfare_event_contributions']);
  const full=new SyncOutbox('full',{getItem:()=>null,setItem:()=>{throw new Error('Quota exceeded');}});
  assert.throws(()=>full.enqueue(change('safe')),/Quota/);assert.match(full.status.error,/storage failed/);
});
test('pagination reads beyond API limits, including limits smaller than the requested page, and preserves empty results',async()=>{
  const source=Array.from({length:1201},(_,index)=>({id:String(index)}));let calls=0;
  const client={from:()=>({select(){return this;},order(){return this;},async range(start,end){calls++;return {data:source.slice(start,Math.min(start+100,end+1))};}})};
  assert.equal((await fetchAllRows(client,'members')).length,1201);assert.equal(calls,14);
  const empty={from:()=>({select(){return this;},order(){return this;},range:async()=>({data:[]})})};assert.deepEqual(await fetchAllRows(empty,'members'),[]);
});
