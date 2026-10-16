import test from 'node:test';
import assert from 'node:assert/strict';
import {communicationPhone,communicationRecipients,validateCommunicationDraft} from '../src/lib/communicationUtils.ts';
import {saveCommunicationDraft,archiveCommunicationDraft} from '../src/features/communications/communicationStore.ts';

const member=(id,extra={})=>({id,first_name:'Synthetic',last_name:id,phone:'0240000001',status:'active',is_archived:false,ministry_id:'a',small_group_id:'s',...extra});
const draft={id:'draft',title:'Notice',message:'Synthetic only',sender_id:'GWCC',channel:'sms',recipient_type:'all_members',recipient_count:1,recipient_ids:['a'],status:'draft',created_by:'authenticated-actor'};
test('communication phone normalization supports Ghana local, +233 and 00233 without guessing missing digits or stripping letters',()=>{
  for(const number of ['024 000 0001','+233 (24) 000-0001','00233240000001','240000001','233240000001'])assert.equal(communicationPhone(number),'233240000001');
  for(const number of ['+2330240000001','23324000001','abc+233240000001','024000001','123456789','+233240000001ext4',''])assert.equal(communicationPhone(number),null,number);
  assert.equal(communicationPhone('+1 (202) 555-0100'),'12025550100');
});
test('audiences exclude archived/inactive and invalid contacts, retain current leaders and deduplicate normalized numbers deterministically',()=>{
  const members=[member('b',{phone:'+233240000001'}),member('a'),member('archived',{is_archived:true}),member('inactive',{status:'inactive'}),member('bad',{phone:'23324000001'}),member('leader',{status:'leader',phone:'0240000002'}),member('new',{status:'new_member',phone:'0240000003'}),member('space',{leadership_position:' ',ministry_id:'b',phone:'0240000004'})];
  const result=communicationRecipients('all_members','',members,[]);assert.deepEqual(result.selected.map(row=>row.id),['a','leader','new','space']);assert.equal(result.issues.length,4);
  assert.deepEqual(communicationRecipients('leaders','',members,[]).selected.map(row=>row.id),['leader']);
  assert.equal(communicationRecipients('ministry','',members,[]).selected.length,0);
  assert.deepEqual(communicationRecipients('ministry','b',members,[]).selected.map(row=>row.id),['space']);
  assert.equal(communicationRecipients('visitors','',[],[{id:'v',full_name:'Visitor',phone:'0240000001',follow_up_status:'new'},{id:'old',full_name:'Converted',phone:'0240000002',follow_up_status:'converted_to_member'}]).selected.length,1);
});
test('draft validation blocks overlong titles, inconsistent counts and missing groups before anything is queued',()=>{
  for(const changes of [{title:'x'.repeat(201)},{message:' '},{message:'x'.repeat(5001)},{recipient_count:-1},{recipient_ids:['a','a'],recipient_count:2},{recipient_type:'ministry'},{recipient_type:'custom'},{sender_id:'x'.repeat(12)}])assert.throws(()=>validateCommunicationDraft({...draft,...changes}));
  assert.doesNotThrow(()=>validateCommunicationDraft({...draft,recipient_ids:[],recipient_count:0}));
});
test('save edits the same draft ID, preserves its creator/version and awaits durable device storage',async()=>{
  let rows=[],release;const writes=[],logs=[];const setter=value=>{rows=typeof value==='function'?value(rows):value;};
  const pending=saveCommunicationDraft(draft,rows,setter,(...args)=>logs.push(args),async(table,record)=>{writes.push({table,record});await new Promise(resolve=>release=resolve);return {success:false,pending:1,durable:true};});
  assert.equal(rows.length,1);assert.equal(logs.length,0);release();await pending;
  rows[0]={...rows[0],updated_at:'2026-10-16T14:00:00Z',_sync_status:undefined};
  const before=rows[0];await saveCommunicationDraft({...draft,message:'Edited',created_by:'other'},rows,setter,()=>{},async(table,record)=>{writes.push({table,record});return {success:false,pending:1,durable:true,error:'Earlier cloud error'};});
  assert.equal(rows.length,1);assert.equal(rows[0].id,draft.id);assert.equal(rows[0].created_by,draft.created_by);assert.equal(rows[0].sent_at,before.sent_at);assert.equal(writes.at(-1).record._expected_updated_at,before.updated_at);assert.equal(rows[0]._sync_status,'pending');
  await archiveCommunicationDraft(draft.id,true,rows,setter,()=>{},async()=>({success:false,pending:1,durable:true}));assert.ok(rows[0].archived_at);assert.equal(rows[0].message,'Edited');
  await archiveCommunicationDraft(draft.id,false,rows,setter,()=>{},async()=>({success:false,pending:1,durable:true}));assert.equal(rows[0].archived_at,null);
});
test('failed device persistence does not report a saved draft or discard the memory copy',async()=>{
  let rows=[],logged=false;
  await assert.rejects(saveCommunicationDraft(draft,rows,value=>rows=value,()=>logged=true,async()=>({success:false,pending:1,error:'Device storage failed'})),/Device storage failed/);
  assert.equal(rows.length,1);assert.equal(rows[0].message,draft.message);assert.equal(logged,false);
  await assert.rejects(saveCommunicationDraft({...draft,title:'x'.repeat(201)},rows,()=>assert.fail('Invalid draft changed state'),()=>{},async()=>assert.fail('Invalid draft queued')),/1–200/);
});
