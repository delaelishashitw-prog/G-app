import test from 'node:test';
import assert from 'node:assert/strict';
import {addMember,updateMember,bulkUpdateMembers,archiveMember,unarchiveMember} from '../src/features/members/memberStore.ts';
import {sanitizeMemberForSupabase} from '../src/lib/supabase.ts';
import {memberMatchesSearch,memberDirectoryPage,memberDirectoryPageSize,canEditMembers,canArchiveMembers,foundationEnrollmentId} from '../src/features/members/memberRules.ts';

const member={id:'one',member_id:'GWCC-900001',first_name:'Alpha',last_name:'Person',phone:'+233 24 000 0123',
  tithe_number:'T-123',status:'active',gender:'female',is_archived:false,auth_user_id:'preserved-login',
  membership_date:'2020-01-01',created_at:'2020-01-01T00:00:00Z',updated_at:'2026-10-24T10:00:00.123456+00:00'};
function fixture(persist=async()=>({durable:true})) {
  let rows=[structuredClone(member),{...member,id:'two',member_id:'GWCC-900002'}];
  const writes=[],logs=[];
  const writer={members:rows,isCurrent:()=>true,persist:async records=>{writes.push(structuredClone(records));return persist(records);},log:(...args)=>logs.push(args),
    setMembers:action=>{
      if(typeof action==='function'){
        const before=structuredClone(rows);
        // React may evaluate an updater again; storage and audit must stay outside it.
        assert.deepEqual(action(before),action(before));rows=action(rows);
      }else rows=action;
    }};
  return {writer,writes,logs,rows:()=>rows};
}
test('member changes become visible only after durable admission and remain explicitly pending',async()=>{
  let complete;
  const f=fixture(()=>new Promise(resolve=>{complete=resolve;}));
  const saving=addMember({first_name:'Synthetic',last_name:'Member',phone:'0240000456',status:'active'},f.writer);
  assert.equal(f.rows().length,2);assert.equal(f.logs.length,0);
  complete({durable:true});const saved=await saving;
  assert.equal(f.rows().length,3);assert.equal(saved._sync_status,'pending');
  assert.match(saved.member_id,/^PENDING-/);assert.equal(f.writes.length,1);assert.equal(f.logs.length,1);
  assert.equal(f.writes[0][0].record.id,saved.id);
});
test('failed storage preserves all member state and never logs a successful action',async()=>{
  for(const operation of [
    w=>addMember({first_name:'Synthetic',last_name:'Member',phone:'0240000123'},w),
    w=>updateMember('one',{first_name:'Changed'},w),
    w=>bulkUpdateMembers(['one','two'],{status:'inactive'},w),
    w=>archiveMember('one',w),w=>unarchiveMember('one',w),
  ]){
    const f=fixture(async()=>({durable:false,error:'Synthetic quota failure'})),before=structuredClone(f.rows());
    await assert.rejects(operation(f.writer),/Synthetic quota failure/);
    assert.deepEqual(f.rows(),before);assert.equal(f.logs.length,0);
  }
  const f=fixture();f.writer.isCurrent=()=>false;
  await assert.rejects(updateMember('one',{phone:'0240000456'},f.writer),/account changed/);
  assert.equal(f.rows()[0].phone,member.phone);assert.equal(f.logs.length,0);
});
test('member edits preserve exact snapshot versions and login identity, and reject stale or pending forms',async()=>{
  const f=fixture();
  await updateMember('one',{first_name:'Changed',id:'replace-id',member_id:'replace-code',auth_user_id:'replace-login'},f.writer,member.updated_at);
  const record=f.writes[0][0].record;
  assert.equal(record._expected_updated_at,member.updated_at);
  assert.equal(record.id,member.id);assert.equal(record.member_id,member.member_id);assert.equal(record.auth_user_id,member.auth_user_id);
  assert.equal(f.writes.length,1);assert.equal(f.logs.length,1);
  const stale=fixture();await assert.rejects(updateMember('one',{first_name:'Changed'},stale.writer,'older-version'),/changed while the form was open/);
  stale.writer.members[0]._sync_status='pending';await assert.rejects(archiveMember('one',stale.writer),/Wait for cloud confirmation/);
  assert.equal(stale.writes.length,0);
});
test('bulk member changes are admitted together, with exact unique targets and no partial updates on failure',async()=>{
  const f=fixture();await bulkUpdateMembers(['one','two','one'],{is_archived:true,auth_user_id:'replace'},f.writer);
  assert.equal(f.writes.length,1);assert.deepEqual(f.writes[0].map(item=>item.record.id),['one','two']);
  assert.ok(f.writes[0].every(item=>item.record._expected_updated_at===member.updated_at));
  assert.ok(f.rows().every(row=>row.is_archived&&row._sync_status==='pending'&&row.auth_user_id==='preserved-login'));
  const missing=fixture();await assert.rejects(bulkUpdateMembers(['one','missing'],{is_archived:true},missing.writer),/unavailable/);
  assert.equal(missing.writes.length,0);assert.ok(missing.rows().every(row=>!row.is_archived));
});
test('member search requires every mixed name and number token while retaining Ghana phone and ID searches',()=>{
  for(const query of ['alpha 900001','PERSON alpha','GWCC 900001','900001','0240000123','+233 24 000 0123','T-123'])
    assert.equal(memberMatchesSearch(member,query),true,query);
  for(const query of ['NoSuchName 900001','NoSuchName 0240000123','alpha 900002','900002'])
    assert.equal(memberMatchesSearch(member,query),false,query);
});
test('directory preferences validate page numbers, page sizes and allowed write roles',async()=>{
  assert.equal(memberDirectoryPage('2'),2);
  for(const value of ['NaN','-1','0','2garbage','1e100',Infinity])assert.equal(memberDirectoryPage(value),1);
  for(const value of ['bad','0','-24',999,null])assert.equal(memberDirectoryPageSize(value),24);
  assert.equal(memberDirectoryPageSize('48'),48);
  for(const role of ['finance_officer','ministry_leader','attendance_officer','member']){
    assert.equal(canEditMembers(role),false,role);assert.equal(canArchiveMembers(role),false,role);
  }
  assert.equal(canEditMembers('pastor'),true);assert.equal(canEditMembers('data_entry'),true);
  assert.equal(canArchiveMembers('administrator'),true);assert.equal(canArchiveMembers('data_entry'),false);
  assert.equal(await foundationEnrollmentId('cohort','one'),await foundationEnrollmentId('cohort','one'));
  assert.notEqual(await foundationEnrollmentId('cohort','one'),await foundationEnrollmentId('cohort','two'));
});

test('a failed member admission retries its retained request and stable member ID without enqueuing a second registration',async()=>{
  let retained,retries=0;
  const f=fixture(async records=>{retained=sanitizeMemberForSupabase(structuredClone(records[0].record));return {durable:false,error:'Synthetic quota failure'};});
  f.writer.normalize=sanitizeMemberForSupabase;
  const input={first_name:'Synthetic',last_name:'Retry',phone:'0240000123'};
  await assert.rejects(addMember(input,f.writer,'stable-registration-id'),/quota/);
  f.writer.pending=id=>id===retained.id?retained:undefined;
  f.writer.retryPending=async()=>{retries++;return {durable:true};};
  const saved=await addMember(input,f.writer,'stable-registration-id');
  assert.equal(saved.id,retained.id);assert.equal(f.writes.length,1);assert.equal(retries,1);assert.equal(f.rows().length,3);
  const original=structuredClone(retained);
  await assert.rejects(addMember({...input,first_name:'Different'},f.writer,'stable-registration-id'),/earlier change/);
  assert.deepEqual(retained,original);assert.equal(f.writes.length,1);
  const confirmed=fixture();
  const again=await addMember({first_name:member.first_name,last_name:member.last_name,phone:member.phone},confirmed.writer,member.id);
  assert.equal(again.member_id,member.member_id);assert.equal(confirmed.writes.length,0);
  await assert.rejects(addMember({first_name:'Different',last_name:member.last_name,phone:member.phone},confirmed.writer,member.id),/already confirmed/);
});
