import { escapeHtml } from '../src/lib/escapeHtml.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {transferBetweenAccounts,voidChurchFinance} from '../src/features/finance/financeStore.ts';
import {recordPledgePayment} from '../src/features/pledges/pledgeStore.ts';
import {recordEventContribution,updateEventContribution,deleteEventContribution} from '../src/features/welfare/welfareStore.ts';
import {isActiveTransaction,sumActive} from '../src/lib/ledgerUtils.ts';
import {reportExpenses} from '../src/lib/reportData.ts';
import {createPickupToken,findPickup} from '../src/lib/childSafety.ts';
const noop=()=>{};
const account=(id,balance)=>({id,name:id,current_balance:balance,currency:'GHS',is_active:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('a transfer request scheduled alongside a React state update preserves balances and cannot bypass cloud approval',async()=>{
  let run,reverse,state,tree;const synced=[];
  function Screen(){
    const [accounts,sa]=React.useState([account('A',100),account('B',0)]),[finances,sf]=React.useState([]);
    state={accounts,finances,budgets:[]};
    run=()=>{sa(previous=>[...previous]);return transferBetweenAccounts('A','B',20,'Move funds',sa,sf,noop,(...args)=>synced.push(args),state);};
    reverse=()=>voidChurchFinance(finances[0].id,'Correction','Finance officer',sf,sa,noop,noop,(...args)=>synced.push(args),state);
    return null;
  }
  await act(async()=>{tree=create(React.createElement(Screen));});
  try{
    let result;await act(async()=>{result=run();});assert.equal(result.success,true);assert.equal(state.finances.length,1);
    assert.deepEqual(state.accounts.map(row=>row.current_balance),[100,0]);
    assert.equal(state.finances[0].status,'pending');assert.equal(state.finances[0].approval_state,'requested');
    assert.throws(()=>reverse(),/Approvals & Payments/);assert.equal(synced.length,1);
  }finally{await act(async()=>tree.unmount());}
});
test('pledge payments create the requested giving receipt before deferred React setters execute',()=>{
  const pledge={id:'pledge',member_id:'member',member_name:'Member',amount_pledged:100,amount_paid:0,balance:100};
  let scheduled,receipt;const writes=[];
  recordPledgePayment('pledge',20,[pledge],action=>scheduled=action,noop,(...args)=>writes.push(args),data=>receipt=data,{syncWithGiving:true,reference:'BANK-1'});
  assert.equal(receipt.amount,20);assert.equal(scheduled[0].amount_paid,20);assert.equal(writes[0][1].balance,80);
  assert.throws(()=>recordPledgePayment('pledge',101,[pledge],noop,noop,noop,noop),/remaining/);
});
test('linked welfare receipt creation, correction, and void adjust the same treasury account and preserve history',()=>{
  const event={id:'event',title:'Aid',minimum_contribution:20,status:'open'};
  const state={finances:[],accounts:[account('A',100)],budgets:[]};let contributions=[];
  const options=()=>({state,contributions,events:[event],linkToChurchFinance:true,financeAccountId:'A',setChurchFinances:next=>state.finances=next,setChurchAccounts:next=>state.accounts=next});
  const setContributions=action=>contributions=typeof action==='function'?action(contributions):action;
  const result=recordEventContribution({event_id:'event',member_id:'member',contributor_name:'Donor',amount:100,payment_status:'confirmed',payment_date:'2026-10-15',payment_method:'cash',recorded_by:'Officer'},[event],[],setContributions,noop,noop,options());
  assert.equal(result.success,true);assert.equal(state.accounts[0].current_balance,200);
  updateEventContribution(result.contribution.id,{amount:200},'Officer',setContributions,noop,noop,options());
  assert.equal(state.accounts[0].current_balance,300);assert.equal(state.finances.length,1);assert.equal(state.finances[0].amount,200);
  deleteEventContribution(result.contribution.id,contributions,'Officer',setContributions,noop,noop,options(),noop);
  assert.equal(state.accounts[0].current_balance,100);assert.equal(state.finances[0].status,'voided');assert.equal(contributions[0].payment_status,'voided');
});
test('financial summaries exclude voided receipts and include active treasury expenses alongside legacy history',()=>{
  const rows=[{amount:100,status:'completed'},{amount:500,status:'voided'},{amount:800,status:'pending'},{amount:900,status:'failed'},{amount:20}];
  assert.equal(sumActive(rows),120);assert.equal(rows.filter(isActiveTransaction).length,2);
  const reports=reportExpenses([{id:'old',amount:5}],[{id:'new',transaction_type:'expense',amount:10,status:'completed'},{id:'void',transaction_type:'expense',amount:999,status:'voided'}]);
  assert.deepEqual(reports.map(row=>row.id),['old','new']);assert.equal(reports.reduce((total,row)=>total+row.amount,0),15);
});
test('pickup requires one unambiguous active tag and an explicit authorized guardian',()=>{
  const token=createPickupToken([]);assert.match(token,/^GWCC-[A-F0-9]{12}$/);
  const child={id:'child',security_code:token,status:'checked_in',parent_name:'Parent One',alternate_pickup_name:'Aunt One'};
  assert.equal(findPickup([child],token,'parent one').id,'child');
  assert.throws(()=>findPickup([child],token,''),/authorized/);assert.throws(()=>findPickup([child],token,'Stranger'),/authorized/);
  assert.throws(()=>findPickup([child,{...child,id:'another'}],token,'Parent One'),/ambiguous/);
  assert.throws(()=>findPickup([{...child,status:'checked_out'}],token,'Parent One'),/No active/);
});

test('asset print fields remain literal text rather than executable HTML',()=>{assert.equal(escapeHtml('<img src=x onerror=alert(1)> & \"'), '&lt;img src=x onerror=alert(1)&gt; &amp; &quot;');});
