import test from 'node:test';
import assert from 'node:assert/strict';
import {validateWelfareFundReceipt,welfareFundSources,includedWelfareFundReceipt} from '../features/welfare/welfareFund.ts';
import {assessWelfareStanding} from '../features/welfare/welfareEligibility.ts';
import {summarizeWelfare} from '../features/welfare/welfareSummary.ts';

const valid = {id:'wfr-test',amount:15400,date:'2026-10-22',source:'opening_balance',reference_no:'WFR-TEST',notes:'Carried-forward welfare funds from previous ledger'};
test('unnamed fund receipts validate source, finite pesewas, date, reference and source note',()=>{
  for(const source of Object.keys(welfareFundSources))assert.doesNotThrow(()=>validateWelfareFundReceipt({...valid,source},'2026-10-23'));
  for(const amount of [0,-1,NaN,Infinity,-Infinity,0.001,1.234,1e9+1])assert.throws(()=>validateWelfareFundReceipt({...valid,amount},'2026-10-23'),/amount/);
  for(const date of ['2026-10-24','2026-02-30','not-a-date','2026-1-1',''])assert.throws(()=>validateWelfareFundReceipt({...valid,date},'2026-10-23'),/date/);
  for(const patch of [{source:'member'},{source:'constructor'},{reference_no:' '},{reference_no:'a'.repeat(101)},{notes:' '},{notes:'a'.repeat(1001)}])assert.throws(()=>validateWelfareFundReceipt({...valid,...patch},'2026-10-23'));
});
test('unnamed money never enrolls a member or clears their existing arrears',()=>{
  const member={id:'member-one',member_id:'GWCC-1'};
  const dues=[{member_id:member.id,amount:10,month:'2026-04',date:'2026-04-10'}];
  const before=assessWelfareStanding(member,dues,new Date('2026-10-23T12:00:00Z'));
  const fund=[{...valid,status:'active'}];
  assert.equal(summarizeWelfare(dues,[],fund).fundBalance,15410);
  assert.deepEqual(assessWelfareStanding(member,dues,new Date('2026-10-23T12:00:00Z')),before);
  assert.equal(before.eligibility,'partial');
  assert.equal(before.welfareJoiningDate,'2026-04-10');
  assert.equal(assessWelfareStanding({id:'new-member'},dues).eligibility,'not_enrolled');
  assert.equal(includedWelfareFundReceipt({...fund[0],_sync_status:'pending'}),false);
});
