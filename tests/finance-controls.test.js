import test from 'node:test';
import assert from 'node:assert/strict';
import {budgetPeriodRange} from '../src/lib/budgetPeriod.ts';
import {financeCsv,financeTotals,budgetSpending,validateBudgetAllocation,financeReconciliation,validateCashCount,financeDateMatches,financeReference,ghanaToday} from '../src/lib/financeViewUtils.ts';

const account=(id,type='bank',opening=100,balance=100)=>({id,name:id,account_type:type,currency:'GHS',is_active:true,opening_balance:opening,current_balance:balance});
const row=(id,type='income',amount=10,extra={})=>({id,transaction_type:type,amount,status:'completed',date:'2026-10-16',currency:'GHS',department:'Facilities',account_id:'bank',account_name:'Bank',category:'Review',title:id,payment_method:'cash',...extra});

test('finance CSV preserves complete hash/quote/newline content and neutralizes spreadsheet formulas',()=>{
  const csv=financeCsv([row('one','income',10.5,{reference_no:'REF#1',title:'=1+1',recipient_or_vendor:'Vendor "North", A\nBranch'}),row('two','transfer',20,{reference_no:'TRF-1',to_account_name:'Cash',_sync_status:'pending'})]);
  assert.ok(csv.startsWith('\uFEFF"Record ID"'));assert.ok(csv.includes('"Voucher / Ref #"'));
  assert.ok(csv.includes('"REF#1"'));assert.ok(csv.includes('"\'=1+1"'));assert.ok(csv.includes('"Vendor ""North"", A\nBranch"'));
  assert.ok(csv.includes('"10.50"'));assert.ok(csv.includes('"Cash"'));assert.ok(csv.includes('"Awaiting confirmation"'));assert.ok(csv.includes('"Payment Recorded By"'));
});
test('finance totals use exact cents and exclude non-posting statuses and both transfer legs',()=>{
  const totals=financeTotals([row('a','income',0.1),row('b','grant',0.2),row('c','expense',0.12),row('d','disbursement',0.03),row('transfer','transfer',1000),...['pending','voided','cancelled','failed'].map((status,i)=>row(String(i),'income',999,{status}))]);
  assert.deepEqual(totals,{income:0.3,expenditure:0.15,net:0.15,incomeCount:2,expenditureCount:2});
});
test('budget usage derives from ledger history, period, currency and explicit assignments instead of a stale spent field',()=>{
  const budget={id:'budget',department:'Facilities',period:'2026 Annual',currency:'GHS',allocated_amount:1000,spent_amount:999};
  const rows=[row('one','expense',20),row('last-year','expense',500,{date:'2025-12-31'}),row('next-year','expense',500,{date:'2027-01-01'}),row('pending','expense',500,{status:'pending'}),row('void','expense',500,{status:'voided'}),row('usd','expense',500,{currency:'USD'}),row('other','expense',500,{budget_id:'other-budget'}),row('assigned','disbursement',5,{budget_id:'budget',department:'Other'})];
  assert.equal(budgetSpending(budget,rows),25);assert.equal(budget.spent_amount,999);assert.equal(budgetSpending({...budget,period:'Unknown'},rows),null);
  assert.deepEqual(budgetPeriodRange('2024-02'),{start:'2024-02-01',end:'2024-02-29',year:'2024'});
  assert.deepEqual(budgetPeriodRange('Q1-2026'),{start:'2026-01-01',end:'2026-03-31',year:'2026'});
  assert.equal(budgetSpending({...budget,period:'Q1-2026'},[row('march','expense',7,{date:'2026-03-31'}),row('april','expense',8,{date:'2026-04-01'})]),7);
});
test('budget allocation rejects overlapping periods for the same department while allowing another year or currency',()=>{
  const existing={id:'old',department:'Facilities',period:'2026 Annual',currency:'GHS',allocated_amount:1000,spent_amount:0};
  assert.throws(()=>validateBudgetAllocation({...existing,id:'new',department:' facilities ',period:'Q1-2026'},[existing]),/overlapping/);
  assert.doesNotThrow(()=>validateBudgetAllocation({...existing,id:'new',period:'2027 Annual'},[existing]));
  assert.doesNotThrow(()=>validateBudgetAllocation({...existing,id:'new',currency:'USD'},[existing]));
  assert.doesNotThrow(()=>validateBudgetAllocation(existing,[existing]));
  assert.throws(()=>validateBudgetAllocation({...existing,allocated_amount:Infinity},[]),/finite positive/);
});
test('reconciliation exposes missing links, repeated references and differences without rewriting historical money',()=>{
  const accounts=[account('bank','bank',100,110),account('cash','cash_petty',0,30),{...account('unknown'),opening_balance:undefined}];
  const rows=[row('deposit','income',10,{reference_no:'DUP'}),row('cash-payment','expense',5,{account_id:'cash',reference_no:'dup'}),row('orphan','income',7,{account_id:'missing',reference_no:'OLD',_sync_status:'pending'})];
  const before=structuredClone({accounts,rows}),review=financeReconciliation(accounts,rows);
  assert.equal(review.accountChecks[0].difference,0);assert.equal(review.accountChecks[1].difference,35);assert.equal(review.accountChecks[2].expected,null);
  assert.equal(review.missingAccounts[0].id,'orphan');assert.equal(review.duplicateReferences[0].records.length,2);assert.equal(review.paymentsToReview[0].id,'cash-payment');assert.equal(review.pending,true);
  assert.deepEqual({accounts,rows},before);
});
test('physical cash posting requires a real cash account, service, two different counters and exact whole denominations',()=>{
  const accounts=[account('bank'),account('cash','cash_petty'),account('momo','momo')],services=[{id:'service',is_active:true}],input={accountId:'cash',serviceId:'service',date:ghanaToday(),counter1:'First Counter',counter2:'Second Counter',supervisor:'Supervisor',counts:{0.1:1,0.2:1}};
  const valid=validateCashCount(input,accounts,services,[]);assert.equal(valid.amount,0.3);
  for(const accountId of ['bank','momo','missing'])assert.throws(()=>validateCashCount({...input,accountId},accounts,services,[]),/cash account/);
  assert.throws(()=>validateCashCount({...input,serviceId:''},accounts,services,[]),/active service/);
  assert.throws(()=>validateCashCount({...input,counter2:input.counter1},accounts,services,[]),/different counter/);
  assert.throws(()=>validateCashCount({...input,counts:{10:1.5}},accounts,services,[]),/whole/);
  assert.throws(()=>validateCashCount({...input,date:'2026-02-31'},accounts,services,[]),/valid cash-count date/);
  assert.throws(()=>validateCashCount(input,accounts,services,[row('saved','income',0.3,{cash_count_key:valid.key})]),/already recorded/);
  assert.doesNotThrow(()=>validateCashCount(input,accounts,services,[row('void','income',0.3,{cash_count_key:valid.key,status:'voided'})]));
});
test('Ghana finance date filtering handles week/year boundaries and rejects impossible or reversed dates',()=>{
  assert.equal(financeDateMatches('2026-10-12','this_week','','','2026-10-16'),true);assert.equal(financeDateMatches('2026-10-18','this_week','','','2026-10-16'),true);
  assert.equal(financeDateMatches('2026-10-19','this_week','','','2026-10-16'),false);assert.equal(financeDateMatches('2026-10-11','last_week','','','2026-10-16'),true);
  assert.equal(financeDateMatches('2025-12-31','last_month','','','2026-01-01'),true);assert.equal(financeDateMatches('2026-02-31','all'),false);
  assert.equal(financeDateMatches('2026-10-16','custom','2026-10-20','2026-10-10'),false);
  assert.equal(financeReference({reference_no:'PENDING-private-id'}),'Awaiting cloud number');assert.equal(financeReference({}),'No reference recorded');
});
