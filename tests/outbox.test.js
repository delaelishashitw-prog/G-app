import test from 'node:test';
import assert from 'node:assert/strict';
import {SyncOutbox} from '../src/lib/syncOutbox.ts';
import {fetchAllRows} from '../src/lib/supabase.ts';
const storage=()=>{const rows=new Map();return {getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key)};};
const change=(id,value=1)=>({table:'members',operation:'upsert',id,record:{id,value}});
const acknowledged=args=>args.p_changes.filter(row=>row.table!=='audit_logs').map(row=>row.operation==='delete'?{table:row.table,id:row.id,deleted:true}:{table:row.table,record:{...row.record,updated_at:'2026-10-16T00:00:00Z'}});
function persistence(){
  let saved=null;
  return {get snapshot(){return structuredClone(saved);},fail:null,async load(){return structuredClone(saved);},async save(value,expected){
    if(this.fail?.(value))throw new Error('Quota exceeded');
    if((saved?.revision||0)!==expected)throw new Error('Another tab changed the pending queue');
    saved=structuredClone({...value,revision:expected+1});return saved.revision;
  }};
}
test('failed writes survive a reload with identical retry IDs and payloads, and merge over empty successful reads',async()=>{
  const disk=storage();let box=new SyncOutbox('owner',disk);await box.enqueue(change('A'));
  let first;await box.flush({rpc:async(_name,args)=>{first=structuredClone(args);return {error:{message:'Network unavailable'}};}});
  assert.equal(box.status.pending,1);assert.match(box.status.error,/Network/);
  box=new SyncOutbox('owner',disk);await box.ready;assert.deepEqual(box.merge('members',[]).map(row=>row.id),['A']);
  let retry;await box.flush({rpc:async(_name,args)=>{retry=structuredClone(args);return {data:acknowledged(args)};}});
  assert.deepEqual(retry,first);assert.equal(box.status.pending,0);assert.deepEqual(box.merge('members',[]),[]);
});
test('in-flight requests remain immutable, later edits receive acknowledged versions, and account queues stay isolated',async()=>{
  const disk=storage(),box=new SyncOutbox('A',disk);await box.observe('members',[{id:'row',updated_at:'v1'}]);await box.enqueue(change('row',1));
  let complete,started;const begin=new Promise(resolve=>started=resolve),calls=[];
  const running=box.flush({rpc:async(_name,args)=>{calls.push(structuredClone(args));if(calls.length===1){started();await new Promise(resolve=>complete=resolve);}return {data:[{table:'members',record:{id:'row',updated_at:'v2'}}]};}});
  await begin;await box.enqueue(change('row',2));
  const other=new SyncOutbox('B',disk);await other.ready;assert.equal(other.status.pending,0);
  assert.equal(calls[0].p_changes[0].record.value,1);complete();await running;
  assert.equal(calls.length,2);assert.notEqual(calls[0].p_operation_id,calls[1].p_operation_id);
  assert.equal(calls[1].p_changes[0].record.value,2);assert.equal(calls[1].p_changes[0].expected_updated_at,'v2');
});
test('related money mutations remain in one transaction at a full-batch boundary; storage failures retain an exportable copy',async()=>{
  const box=new SyncOutbox('owner',storage());for(let i=0;i<499;i++)await box.enqueue(change(`m${i}`));
  await box.enqueueMany([{...change('receipt'),table:'church_finances'},{...change('contribution'),table:'welfare_event_contributions'}]);
  const saved=JSON.parse(box.exportPending()).batches;assert.equal(saved.length,2);assert.deepEqual(saved[1].changes.map(row=>row.table),['church_finances','welfare_event_contributions']);
  const full=new SyncOutbox('full',{getItem:()=>null,setItem:()=>{throw new Error('Quota exceeded');}});
  await assert.rejects(full.enqueue(change('safe')),/Quota/);assert.match(full.status.error,/storage failed/);assert.match(full.exportPending(),/safe/);
});
test('legacy queues migrate only after a durable commit, preserving payloads, versions, other accounts, cache and authentication',async()=>{
  const disk=storage(),store=persistence(),legacy=[{id:'legacy-request',changes:[{...change('photo','data:image/jpeg;base64,'+'A'.repeat(120000)),expected_updated_at:'v1'}],createdAt:'2026-10-15T00:00:00Z',attempts:3,error:'Offline'}];
  const raw=JSON.stringify(legacy);disk.setItem('gwcc_outbox_v2_owner',raw);disk.setItem('gwcc_versions_v2_owner',JSON.stringify({'members:photo':'v1'}));
  for(const key of ['gwcc-church-auth-token','gwcc_cache_owner_members','gwcc_outbox_v2_other'])disk.setItem(key,'preserve');
  const originalSave=store.save;store.save=async function(...args){assert.equal(disk.getItem('gwcc_outbox_v2_owner'),raw);return originalSave.apply(this,args);};
  const box=new SyncOutbox('owner',disk,()=>{},store);await box.ready;
  const migrated=legacy.map(batch=>({...batch,requiresReview:true,migratedFromLegacy:true}));
  assert.deepEqual(store.snapshot.batches,migrated);assert.deepEqual(store.snapshot.versions,{'members:photo':'v1'});assert.equal(disk.getItem('gwcc_outbox_v2_owner'),null);
  for(const key of ['gwcc-church-auth-token','gwcc_cache_owner_members','gwcc_outbox_v2_other'])assert.equal(disk.getItem(key),'preserve');
  const reloaded=new SyncOutbox('owner',disk,()=>{},store);await reloaded.ready;assert.deepEqual(JSON.parse(reloaded.exportPending()).batches,migrated);
});
test('a failed migration retains the legacy queue, never sends it from an unverified storage state, and stays exportable',async()=>{
  const disk=storage(),store=persistence(),batch={id:'request',changes:[change('pending')],createdAt:'2026-10-15',attempts:0};
  disk.setItem('gwcc_outbox_v2_owner',JSON.stringify([batch]));store.fail=()=>true;
  const box=new SyncOutbox('owner',disk,()=>{},store);await box.ready;let requests=0;
  await assert.rejects(box.enqueue(change('new-during-storage-failure')),/storage could not load/);
  await box.flush({rpc:async()=>{requests++;return {data:[]};}});
  assert.equal(requests,0);assert.equal(disk.getItem('gwcc_outbox_v2_owner'),JSON.stringify([batch]));assert.match(box.exportPending(),/pending/);assert.match(box.exportPending(),/new-during-storage-failure/);assert.match(box.status.error,/storage could not load/);
});
test('a newer memory-only quota backup augments a never-sent legacy batch before review without changing its request ID',async()=>{
  const disk=storage(),store=persistence(),original={id:'legacy-unsent',changes:[change('first',1)],createdAt:'2026-10-15',attempts:0};
  disk.setItem('gwcc_outbox_v2_owner',JSON.stringify([original]));const box=new SyncOutbox('owner',disk,()=>{},store);await box.ready;
  let sent=0;const transport={rpc:async(_name,args)=>{sent++;assert.equal(args.p_operation_id,original.id);assert.equal(args.p_changes.length,2);assert.equal(args.p_changes[0].record.value,2);return {data:acknowledged(args)};}};
  await box.flush(transport);assert.equal(sent,0);
  const backup={owner:'owner',batches:[{...original,changes:[change('first',2),change('last-memory-only',3)],attempts:1}]};
  assert.equal(await box.restorePending(JSON.stringify(backup)),2);await box.flush(transport);assert.equal(sent,0);
  assert.equal((await box.flush(transport,()=>{},true)).success,true);assert.equal(sent,1);
});
test('cloud commit followed by local cleanup failure retries the original request without duplicating the logical write',async()=>{
  const disk=storage(),store=persistence();let box=new SyncOutbox('owner',disk,()=>{},store);await box.enqueue(change('receipt',200));
  const committed=new Map(),calls=[];
  const transport={rpc:async(_name,args)=>{calls.push(structuredClone(args));if(!committed.has(args.p_operation_id))committed.set(args.p_operation_id,acknowledged(args));return {data:committed.get(args.p_operation_id)};}};
  store.fail=snapshot=>snapshot.batches.length===0;
  const failed=await box.flush(transport);assert.equal(failed.success,false);assert.equal(failed.pending,1);assert.match(failed.error,/storage failed/);assert.equal(committed.size,1);
  assert.equal(store.snapshot.batches[0].id,calls[0].p_operation_id);
  store.fail=null;box=new SyncOutbox('owner',disk,()=>{},store);await box.ready;assert.equal((await box.flush(transport)).success,true);
  assert.deepEqual(calls[1],calls[0]);assert.equal(committed.size,1);assert.equal(store.snapshot.batches.length,0);
});
test('status stays pending until the acknowledged queue retirement commits durably',async()=>{
  const store=persistence(),box=new SyncOutbox('owner',storage(),()=>{},store);await box.enqueue(change('record'));
  let entered,complete;const retiring=new Promise(resolve=>entered=resolve),save=store.save;
  store.save=async function(snapshot,...args){if(!snapshot.batches.length){entered();await new Promise(resolve=>complete=resolve);}return save.call(this,snapshot,...args);};
  const running=box.flush({rpc:async(_name,args)=>({data:acknowledged(args)})});await retiring;
  assert.equal(box.status.pending,1);assert.equal(box.status.success,false);complete();assert.equal((await running).success,true);assert.equal(box.status.pending,0);
});
test('version/cache write failures do not hide cloud records or discard pending requests, and retry can repair empty-queue metadata',async()=>{
  const store=persistence(),box=new SyncOutbox('owner',storage(),()=>{},store);await box.ready;store.fail=()=>true;
  await box.observe('members',[{id:'cloud',updated_at:'v1'}]);assert.deepEqual(box.merge('members',[{id:'cloud'}]),[{id:'cloud'}]);assert.match(box.status.error,/storage failed/);
  store.fail=null;assert.equal((await box.flush({rpc:async()=>{throw new Error('No write expected');}})).success,true);assert.equal(store.snapshot.versions['members:cloud'],'v1');
});
test('unchanged cloud reads do not rewrite snapshots or advance queue revisions',async()=>{
  const store=persistence(),box=new SyncOutbox('owner',storage(),()=>{},store),rows=[{id:'same',updated_at:'v1'}];
  await box.observe('members',rows);const version=store.snapshot.revision;await box.observe('members',rows);assert.equal(store.snapshot.revision,version);
});
test('incomplete database acknowledgment retains every change and the stable operation ID',async()=>{
  const box=new SyncOutbox('owner',storage());await box.enqueueMany([change('one'),change('two')]);const original=JSON.parse(box.exportPending()).batches[0].id;
  const result=await box.flush({rpc:async()=>({data:[{table:'members',record:{id:'one'}}]})});
  assert.equal(result.pending,2);assert.match(result.error,/confirm every record/);assert.equal(JSON.parse(box.exportPending()).batches[0].id,original);
});
test('stale tabs cannot overwrite another tab’s durable queue; their own new changes remain exportable',async()=>{
  const disk=storage(),store=persistence(),one=new SyncOutbox('owner',disk,()=>{},store),two=new SyncOutbox('owner',disk,()=>{},store);await Promise.all([one.ready,two.ready]);
  await one.enqueue(change('first'));await assert.rejects(two.enqueue(change('second')),/Another tab/);
  assert.equal(store.snapshot.batches[0].changes[0].id,'first');assert.match(two.exportPending(),/second/);
});
test('backup restore checks the account and payload, preserves request IDs, and waits for explicit review across reloads',async()=>{
  const disk=storage(),store=persistence();let box=new SyncOutbox('owner',disk,()=>{},store);await box.enqueue(change('kept',100));
  const backup=box.exportPending(),id=JSON.parse(backup).batches[0].id;await box.discardPending(backup);
  await assert.rejects(box.restorePending(JSON.stringify({...JSON.parse(backup),owner:'other'})),/different account/);
  assert.equal(await box.restorePending(backup),1);assert.equal(await box.restorePending(backup),0);
  const altered=JSON.parse(backup);altered.batches[0].changes[0].record.value=999;
  await assert.rejects(box.restorePending(JSON.stringify(altered)),/different changes/);
  box=new SyncOutbox('owner',disk,()=>{},store);await box.ready;let sent=0;
  const transport={rpc:async(_name,args)=>{sent++;assert.equal(args.p_operation_id,id);return {data:acknowledged(args)};}};
  assert.equal((await box.flush(transport)).success,false);assert.equal(sent,0);
  assert.equal((await box.flush(transport,()=>{},true)).success,true);assert.equal(sent,1);
});
test('corrupt legacy data is retained for export and a changed queue cannot be discarded using an older backup',async()=>{
  const disk=storage();disk.setItem('gwcc_outbox_v2_owner','unreadable');const broken=new SyncOutbox('owner',disk);await broken.ready;
  await assert.rejects(broken.enqueue(change('new')),/unreadable/);assert.equal(disk.getItem('gwcc_outbox_v2_owner'),'unreadable');assert.match(broken.exportPending(),/unreadable/);
  const box=new SyncOutbox('safe',storage());await box.enqueue(change('one'));const old=box.exportPending();await box.enqueue(change('two'));
  await assert.rejects(box.discardPending(old),/changed after/);assert.equal(box.status.pending,2);
});
test('pagination reads beyond API limits, including limits smaller than the requested page, and preserves empty results',async()=>{
  const source=Array.from({length:1201},(_,index)=>({id:String(index)}));let calls=0;
  const client={from:()=>({select(){return this;},order(){return this;},async range(start,end){calls++;return {data:source.slice(start,Math.min(start+100,end+1))};}})};
  assert.equal((await fetchAllRows(client,'members')).length,1201);assert.equal(calls,14);
  const empty={from:()=>({select(){return this;},order(){return this;},range:async()=>({data:[]})})};assert.deepEqual(await fetchAllRows(empty,'members'),[]);
});
