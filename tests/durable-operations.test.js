import test from 'node:test';
import assert from 'node:assert/strict';
import { saveAsset, removeAsset, saveMaintenance, graduateStudent } from '../src/features/operations/durableOperations.ts';

function fixture() {
  const retained=new Map(),deletions=new Set(),writes=[],applied=[],logs=[];
  let durable=true,current=true,retries=0;
  const writer={
    persist:async changes=>{writes.push(structuredClone(changes));for(const c of changes)retained.set(`${c.table}:${c.record.id}`,structuredClone(c.record));return {durable,error:durable?undefined:'Synthetic storage full'};},
    remove:async(table,id,version)=>{writes.push({table,id,version});deletions.add(`${table}:${id}`);return {durable,error:'Synthetic storage full'};},
    pending:(table,id)=>retained.get(`${table}:${id}`),pendingDelete:(table,id)=>deletions.has(`${table}:${id}`),
    retry:async()=>{retries++;return {durable,error:'Synthetic storage full'};},current:()=>current,
    apply:(...args)=>applied.push(structuredClone(args)),log:(...args)=>logs.push(args),
  };
  return {writer,retained,writes,applied,logs,setDurable:v=>durable=v,setCurrent:v=>current=v,get retries(){return retries;}};
}
const asset={id:'asset-1',asset_tag:'AST-1',name:'Synthetic Keyboard',purchase_cost:200,category:'musical_instruments',department:'Music',purchase_date:'2026-10-01',current_condition:'working',location:'Auditorium',custodian_name:'Synthetic Custodian',maintenance_logs:[],created_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-01T00:00:00Z'};
const student={id:'student',member_id:'person',member_name:'Synthetic Member',cohort_id:'class',cohort_name:'Class',status:'in_progress',completed_modules:[],updated_at:asset.updated_at};
const member={id:'person',first_name:'Synthetic',last_name:'Member',status:'active',membership_class_completed:false,updated_at:asset.updated_at};

test('asset admission failure preserves the original request and applies no success; changed retries are rejected',async()=>{
  const f=fixture();f.setDurable(false);
  await assert.rejects(saveAsset(asset,[],f.writer,asset.id,true),/storage full/);
  assert.equal(f.applied.length,0);assert.equal(f.logs.length,0);
  const saved=structuredClone(f.writes[0]);
  await assert.rejects(saveAsset({...asset,name:'Different'},[],f.writer,asset.id,true),/earlier change/);
  assert.equal(f.writes.length,1);
  f.setDurable(true);const result=await saveAsset(asset,[],f.writer,asset.id,true);
  assert.equal(f.writes.length,1);assert.equal(f.retries,1);assert.deepEqual(f.writes[0],saved);
  assert.equal(result._sync_status,'pending');assert.equal(f.applied.length,1);assert.equal(f.logs.length,1);
});
test('asset saves reject invalid or duplicate data, and a confirmed registration is not created twice',async()=>{
  const f=fixture();
  await assert.rejects(saveAsset({...asset,purchase_cost:NaN},[],f.writer,asset.id,true),/valid/);
  await assert.rejects(saveAsset({...asset,id:'second'},[asset],f.writer,'second',true),/tag is already/);
  assert.equal(await saveAsset(asset,[asset],f.writer,asset.id,true),asset);assert.equal(f.writes.length,0);
  await assert.rejects(saveAsset({...asset,name:'Old form'},[asset],f.writer,asset.id,false,'old-version'),/changed while the form/);
  f.writer.persist=async()=>{f.setCurrent(false);return {durable:true};};
  await assert.rejects(saveAsset({...asset,name:'Edited'},[asset],f.writer,asset.id),/account changed/);assert.equal(f.applied.length,0);
});
test('maintenance retries preserve one receipt and asset version; rejected deletions remain visible until preserved',async()=>{
  const f=fixture(),data={asset_id:asset.id,service_date:'2026-10-29',service_type:'routine_maintenance',technician_vendor:'Synthetic vendor',cost:25,details:'Synthetic service',performed_by:'Synthetic'};
  f.setDurable(false);await assert.rejects(saveMaintenance(asset.id,data,[asset],f.writer,'maintenance-1'),/storage full/);
  f.setDurable(true);const result=await saveMaintenance(asset.id,data,[asset],f.writer,'maintenance-1');
  assert.equal(result.maintenance_logs.length,1);assert.equal(f.writes.length,1);assert.equal(f.writes[0][0].record._expected_updated_at,asset.updated_at);
  const d=fixture();d.setDurable(false);await assert.rejects(removeAsset(asset.id,[asset],d.writer),/storage full/);assert.equal(d.applied.length,0);
  d.setDurable(true);await removeAsset(asset.id,[asset],d.writer);assert.equal(d.writes.length,1);assert.equal(d.retries,1);assert.deepEqual(d.applied[0],['assets',[],asset.id]);
});
test('graduation admits the student and member completion in one batch, including version checks',async()=>{
  const f=fixture();await graduateStudent(student.id,undefined,[student],[member],f.writer,row=>row);
  assert.equal(f.writes.length,1);assert.deepEqual(f.writes[0].map(c=>c.table),['foundation_students','members']);
  assert.equal(f.writes[0][0].record.status,'graduated');assert.equal(f.writes[0][1].record.membership_class_completed,true);
  assert.equal(f.writes[0][1].record._expected_updated_at,member.updated_at);assert.equal(f.applied.length,2);
  assert.equal(member.membership_class_completed,false);assert.equal(student.status,'in_progress');
});
test('failed graduation leaves both views unchanged and retries the same certificate and exact retained request',async()=>{
  const f=fixture();f.setDurable(false);await assert.rejects(graduateStudent(student.id,undefined,[student],[member],f.writer,row=>row),/storage full/);
  const request=structuredClone(f.writes[0]);assert.equal(f.applied.length,0);assert.equal(f.logs.length,0);
  f.setDurable(true);await graduateStudent(student.id,undefined,[student],[member],f.writer,row=>row);
  assert.deepEqual(f.writes,[request]);assert.equal(f.retries,1);assert.equal(f.applied[0][1][0].certificate_no,request[0].record.certificate_no);
});
test('existing graduates can repair member completion without replacing their certificate; archived or missing members cannot graduate',async()=>{
  const graduated={...student,status:'graduated',certificate_no:'ORIGINAL-CERT',graduation_date:'2020-01-01'};
  const f=fixture();await graduateStudent(student.id,undefined,[graduated],[member],f.writer,row=>row);
  assert.equal(f.writes[0][0].record.certificate_no,'ORIGINAL-CERT');assert.equal(f.writes[0][0].record.graduation_date,'2020-01-01');
  const noOp=fixture();await graduateStudent(student.id,undefined,[graduated],[{...member,membership_class_completed:true}],noOp.writer,row=>row);assert.equal(noOp.writes.length,0);
  await assert.rejects(graduateStudent(student.id,undefined,[student],[{...member,is_archived:true}],fixture().writer,row=>row),/Review this member/);
  await assert.rejects(graduateStudent(student.id,undefined,[student],[],fixture().writer,row=>row),/removed/);
});
