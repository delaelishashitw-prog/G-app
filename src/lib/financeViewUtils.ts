import type { ChurchAccount, ChurchFinanceRecord, DepartmentBudget } from '../types/database.types';
import { accountEffect, isActiveTransaction, money } from './ledgerUtils';
import { budgetPeriodRange, recordMatchesBudget } from './budgetPeriod';

export const CASH_DENOMINATIONS=[200,100,50,20,10,5,2,1,0.5,0.2,0.1];
export const ghanaToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Accra',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function financeDateMatches(date:string,filter:string,start='',end='',today=ghanaToday()):boolean {
  const key=String(date||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(key)||Number.isNaN(Date.parse(key))||new Date(key).toISOString().slice(0,10)!==key)return false;
  if(filter==='all')return true;
  if(filter==='today')return key===today;
  if(filter==='this_year')return key.startsWith(today.slice(0,4));
  if(filter==='this_month')return key.startsWith(today.slice(0,7));
  const current=new Date(today+'T12:00:00Z');
  if(filter==='last_month'){current.setUTCDate(1);current.setUTCMonth(current.getUTCMonth()-1);return key.startsWith(current.toISOString().slice(0,7));}
  if(filter==='this_week'||filter==='last_week'){
    current.setUTCDate(current.getUTCDate()-(current.getUTCDay()+6)%7-(filter==='last_week'?7:0));const from=current.toISOString().slice(0,10);
    current.setUTCDate(current.getUTCDate()+6);return key>=from&&key<=current.toISOString().slice(0,10);
  }
  return filter==='custom'&&(!start||key>=start)&&(!end||key<=end)&&(!start||!end||start<=end);
}
export const isCashAccount=(account:ChurchAccount)=>account.is_active && account.currency==='GHS' && ['cash_petty','cash'].includes(account.account_type);
export const financeReference=(record:Pick<ChurchFinanceRecord,'reference_no'> & Partial<Pick<ChurchFinanceRecord,'_sync_status'>>)=>record.reference_no&&!record.reference_no.startsWith('PENDING-')?record.reference_no:record._sync_status==='pending'||record.reference_no?.startsWith('PENDING-')?'Awaiting cloud number':'No reference recorded';
export function financeTotals(rows:ChurchFinanceRecord[]) {
  let income=0,expenditure=0,incomeCount=0,expenditureCount=0;
  for(const row of rows){if(!isActiveTransaction(row))continue;const cents=Math.round(money(row.amount)*100);
    if(['income','grant'].includes(row.transaction_type)){income+=cents;incomeCount++;}
    if(['expense','disbursement'].includes(row.transaction_type)){expenditure+=cents;expenditureCount++;}
  }
  return {income:income/100,expenditure:expenditure/100,net:(income-expenditure)/100,incomeCount,expenditureCount};
}
export function budgetSpending(budget:DepartmentBudget,rows:ChurchFinanceRecord[]):number|null {
  if(!budgetPeriodRange(budget.period))return null;
  return rows.filter(row=>isActiveTransaction(row)&&['expense','disbursement'].includes(row.transaction_type)&&recordMatchesBudget(row,budget))
    .reduce((cents,row)=>cents+Math.round(money(row.amount)*100),0)/100;
}
export function validateBudgetAllocation(budget:Pick<DepartmentBudget,'department'|'period'|'allocated_amount'|'currency'>&{id?:string},existing:DepartmentBudget[]) {
  const range=budgetPeriodRange(budget.period);
  if(!range||!budget.department.trim()||!Number.isFinite(budget.allocated_amount)||money(budget.allocated_amount)<=0)throw new Error('Enter a department, supported budget period and finite positive allocation.');
  const overlap=existing.find(row=>row.id!==budget.id&&row.department.trim().toLowerCase()===budget.department.trim().toLowerCase()&&row.currency===budget.currency&&(()=>{const other=budgetPeriodRange(row.period);return !other||(range.start<=other.end&&other.start<=range.end);})());
  if(overlap)throw new Error('This department already has a budget in an overlapping period. Edit that budget or choose a different period.');
}
export function financeReconciliation(accounts:ChurchAccount[],rows:ChurchFinanceRecord[]) {
  const accountIds=new Set(accounts.map(account=>account.id)),references=new Map<string,ChurchFinanceRecord[]>();
  const accountChecks=accounts.map(account=>{
    const opening=typeof account.opening_balance==='number'&&Number.isFinite(account.opening_balance)?Math.round(money(account.opening_balance)*100):null;
    const movement=rows.reduce((cents,row)=>cents+accountEffect(row,account.id),0);
    const expected=opening===null?null:opening+movement;
    return {account,opening:opening===null?null:opening/100,movement:movement/100,expected:expected===null?null:expected/100,difference:expected===null?null:(Math.round(money(account.current_balance)*100)-expected)/100};
  });
  for(const row of rows){if(!row.reference_no||row.reference_no.startsWith('PENDING-'))continue;const key=row.reference_no.trim().toUpperCase();references.set(key,[...(references.get(key)||[]),row]);}
  const missingAccounts=rows.filter(row=>!row.account_id||!accountIds.has(row.account_id)||(row.transaction_type==='transfer'&&(!row.to_account_id||!accountIds.has(row.to_account_id))));
  const duplicateReferences=[...references].filter(([,records])=>records.length>1).map(([reference,records])=>({reference,records}));
  const unresolved=accountChecks.filter(row=>row.difference===null||row.difference!==0);
  const unresolvedIds=new Set(unresolved.map(row=>row.account.id));
  const paymentsToReview=rows.filter(row=>isActiveTransaction(row)&&['expense','disbursement'].includes(row.transaction_type)&&unresolvedIds.has(row.account_id||''));
  return {accountChecks,unresolved,missingAccounts,duplicateReferences,paymentsToReview,pending:rows.some(row=>row._sync_status==='pending')};
}
export function financeCsv(rows:ChurchFinanceRecord[]):string {
  const headers=['Record ID','Date','Transaction Type','Voucher / Ref #','Title / Description','Vendor / Recipient','Holding Account','Destination Account','Category','Department','Amount (GHS)','Payment Method','Approved By','Status','Cloud Confirmation'];
  const records=rows.map(row=>[row.id,row.date,row.transaction_type,financeReference(row),row.title,row.recipient_or_vendor||'',row.account_name,row.to_account_name||'',row.category,row.department||'',money(row.amount).toFixed(2),row.payment_method,row.approved_by||'',row.status,row._sync_status==='pending'?'Awaiting confirmation':'Confirmed']);
  return buildCsv([headers,...records]);
}
export function buildCsv(rows:(string|number)[][]):string {
  const cell=(value:string|number)=>{const raw=String(value??'');const safe=typeof value==='string'&&/^[\s\uFEFF]*[=+\-@]/.test(raw)?`'${raw}`:raw;return `"${safe.replace(/"/g,'""')}"`;};
  return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
export function downloadCsvFile(contents:string,filename:string) {
  const url=URL.createObjectURL(new Blob([contents],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function validateCashCount(input:{accountId:string;serviceId:string;date:string;counter1:string;counter2:string;supervisor:string;counts:Record<number,number>},accounts:ChurchAccount[],services:{id:string;is_active?:boolean}[],rows:ChurchFinanceRecord[]) {
  const account=accounts.find(row=>row.id===input.accountId&&isCashAccount(row));
  if(!account)throw new Error('Select an active GHS cash account. Bank and MoMo accounts cannot receive a physical cash count.');
  if(!services.some(row=>row.id===input.serviceId&&row.is_active===true))throw new Error('Select an active service for this cash count.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||Number.isNaN(Date.parse(input.date))||new Date(input.date).toISOString().slice(0,10)!==input.date||input.date>ghanaToday())throw new Error('Choose a valid cash-count date up to today.');
  const names=[input.counter1,input.counter2,input.supervisor].map(name=>name.trim());
  if(names.some(name=>name.length<2||name.length>150)||names[0].toLowerCase()===names[1].toLowerCase())throw new Error('Enter two different counter names and a supervisor name.');
  let cents=0;for(const [denomination,quantity] of Object.entries(input.counts)){
    if(!CASH_DENOMINATIONS.includes(Number(denomination))||!Number.isInteger(quantity)||quantity<0||quantity>1000000)throw new Error('Enter whole, non-negative quantities for the listed denominations.');
    cents+=Math.round(Number(denomination)*100)*quantity;
  }
  if(cents<=0)throw new Error('Record counted notes or coins before posting.');
  const key=`${input.serviceId}:${input.date}`;
  if(rows.some(row=>row.cash_count_key===key&&!['voided','cancelled','failed'].includes(row.status)))throw new Error('A cash count for this service and date is already recorded. Review or void that count before posting a replacement.');
  return {account,amount:cents/100,key,details:{denominations:input.counts,counter1:names[0],counter2:names[1],supervisor:names[2]}};
}
