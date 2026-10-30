import test from 'node:test';
import assert from 'node:assert/strict';
import {saveChildCheckIn,saveChildCheckout} from '../src/features/attendance/childCheckInStore.ts';
import {writeFinance} from '../src/features/finance/durableFinance.ts';
import {recordChurchFinance} from '../src/features/finance/financeStore.ts';
import {MEMBER_DIRECTORY_COLUMNS,memberForRole} from '../src/lib/memberPrivacy.ts';

const input={child_name:'Synthetic Child',age_group:'juniors',class_room:'Synthetic Hall',service_id:'service',service_name:'Synthetic Service',date:'2026-10-30',check_in_time:'08:00',parent_name:'Synthetic Parent',parent_phone:'0240000001',has_allergy_alert:false,checked_in_by:'staff'};
function childFixture(){
 const records=[];let writes=0,retries=0,flushes=0,current=true,admit=true,cloud=false;
 const writer={pending:()=>structuredClone(records),persist:async row=>{writes++;records.push(structuredClone(row));return {success:false,pending:1,durable:admit,error:admit?undefined:'Synthetic device failure'};},retry:async()=>{retries++;return {success:false,pending:1,durable:admit,error:admit?undefined:'Synthetic device failure'};},flush:async()=>{flushes++;return {success:cloud,pending:cloud?0:1,error:cloud?undefined:'Synthetic lost response'};},current:()=>current};
 return {writer,records,counts:()=>({writes,retries,flushes}),setCloud:v=>cloud=v,setAdmission:v=>admit=v,setCurrent:v=>current=v};
}
test('child retry and reopened form preserve one record, tag and original time after a lost reply',async()=>{
 const f=childFixture();
 await assert.rejects(saveChildCheckIn(input,'request-one',[],f.writer),/lost response/);
 const first=structuredClone(f.records[0]);f.setCloud(true);
 const saved=await saveChildCheckIn({...input,check_in_time:'08:05'},'request-two',[],f.writer);
 assert.deepEqual(saved,first);assert.equal(f.records.length,1);assert.deepEqual(f.counts(),{writes:1,retries:1,flushes:2});
});
test('child device failure never issues a pass or calls a successful empty flush, and changed intent is rejected',async()=>{
 const f=childFixture();f.setAdmission(false);f.setCloud(true);
 await assert.rejects(saveChildCheckIn(input,'request-one',[],f.writer),/device failure/);assert.equal(f.counts().flushes,0);
 await assert.rejects(saveChildCheckIn({...input,child_name:'Changed'},'request-one',[],f.writer),/different details/);
 f.setAdmission(true);f.setCurrent(false);
 await assert.rejects(saveChildCheckIn(input,'request-one',[],f.writer),/account changed/);
});
test('a check-in confirmed by background sync reopens its existing pass without rewriting its token',async()=>{
 const f=childFixture(),row={...input,id:'stable',security_code:'GWCC-ABCDEF123456',status:'checked_in',created_at:new Date().toISOString()};
 assert.equal(await saveChildCheckIn(input,'stable',[row],f.writer),row);
 assert.deepEqual(f.counts(),{writes:0,retries:0,flushes:0});
});
test('pickup retries preserve the authorized collector and Ghana checkout time',async()=>{
 const f=childFixture(),row={...input,id:'child',security_code:'GWCC-ABCDEF123456',status:'checked_in',created_at:new Date().toISOString()};
 const originalTimezone=process.env.TZ;process.env.TZ='Pacific/Auckland';
 try{
  await assert.rejects(saveChildCheckout(row,'Synthetic Parent','staff',[row],f.writer),/lost response/);
  const saved=f.records[0];assert.equal(saved.check_out_time,new Date().toISOString().slice(11,16));
  f.setCloud(true);assert.deepEqual(await saveChildCheckout(row,'Synthetic Parent','staff',[row],f.writer),saved);
  assert.equal(f.counts().writes,1);
  await assert.rejects(saveChildCheckout(row,'Stranger','staff',[row],f.writer),/authorized/);
 }finally{if(originalTimezone===undefined)delete process.env.TZ;else process.env.TZ=originalTimezone;}
});
const snapshot=()=>({finances:[],accounts:[{id:'cash',name:'Synthetic Cash',account_type:'cash_petty',currency:'GHS',is_active:true,current_balance:100,opening_balance:100}],budgets:[]});
const financeInput={transaction_type:'income',account_id:'cash',account_name:'Synthetic Cash',category:'General',title:'Synthetic income',amount:25,currency:'GHS',date:'2026-10-30',payment_method:'cash',status:'completed'};
const plan=(stage,amount=25)=>recordChurchFinance({...financeInput,amount},stage.setFinances,stage.setAccounts,stage.setBudgets,stage.log,stage.sync,stage.state,'stable-income');
test('financial admission failure keeps published state and balances unchanged, then retries the same preserved intent',async()=>{
 const state=snapshot(),retained=new Map(),published=[];let attempts=0,retries=0,admit=false;
 const writer={normalize:(_table,row)=>row,pending:(table,id)=>retained.get(table+id),persist:async changes=>{attempts++;for(const c of changes)retained.set(c.table+c.record.id,structuredClone(c.record));return {durable:admit,error:'Synthetic storage full'};},retry:async()=>{retries++;return {durable:admit};},current:()=>true,apply:changes=>published.push(...changes),log:()=>{}};
 await assert.rejects(writeFinance([],state,stage=>plan(stage),writer),/storage full/);
 assert.equal(state.accounts[0].current_balance,100);assert.equal(state.finances.length,0);assert.equal(published.length,0);
 await assert.rejects(writeFinance([],state,stage=>plan(stage,30),writer),/earlier financial change/);
 admit=true;const row=await writeFinance([],state,stage=>plan(stage),writer);
 assert.equal(row.id,'stable-income');assert.equal(row._sync_status,'pending');assert.equal(published.length,1);assert.equal(attempts,1);assert.equal(retries,1);
});
test('financial admission cannot publish into a different signed-in account',async()=>{
 let current=true,published=false;
 const writer={normalize:(_table,row)=>row,pending:()=>undefined,persist:async()=>{current=false;return {durable:true};},retry:async()=>({durable:true}),current:()=>current,apply:()=>published=true,log:()=>{}};
 await assert.rejects(writeFinance([],snapshot(),stage=>plan(stage),writer),/account changed/);assert.equal(published,false);
});
test('directory projection omits private notes without mutating the source member',()=>{
 assert.equal(MEMBER_DIRECTORY_COLUMNS.split(',').includes('notes'),false);
 const row={id:'member',notes:'Private'};assert.deepEqual(memberForRole(row,'attendance_officer'),{id:'member'});
 assert.equal(memberForRole(row,'pastor').notes,'Private');assert.equal(row.notes,'Private');
});
