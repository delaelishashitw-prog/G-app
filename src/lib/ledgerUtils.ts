import type { ChurchAccount, ChurchFinanceRecord, DepartmentBudget } from '../types/database.types';

export function money(value: number): number {
  if (!Number.isFinite(Number(value))) throw new Error('Enter a finite monetary amount.');
  return Math.round((Number(value)+Number.EPSILON)*100)/100;
}
export const isActiveTransaction = (row: { status?: string }) => !['voided','cancelled','pending','failed'].includes(row.status || 'completed');

export function accountEffect(record: ChurchFinanceRecord | undefined, accountId: string): number {
  if(!record || !isActiveTransaction(record)) return 0;
  const amount=Math.round(money(record.amount)*100);
  if(record.transaction_type==='transfer') return (record.to_account_id===accountId?amount:0)-(record.account_id===accountId?amount:0);
  if(record.account_id!==accountId) return 0;
  return ['income','grant'].includes(record.transaction_type)?amount:-amount;
}

export function planAccountChange(accounts:ChurchAccount[],before:ChurchFinanceRecord|undefined,after:ChurchFinanceRecord|undefined):ChurchAccount[] {
  if(after) {
    if(money(after.amount)<=0) throw new Error('Amount must be greater than zero.');
    if(!after.account_id) throw new Error('Select a holding account.');
    if(after.transaction_type==='transfer' && (!after.to_account_id || after.to_account_id===after.account_id)) throw new Error('A transfer needs two different accounts.');
  }
  const ids=new Set([before?.account_id,before?.to_account_id,after?.account_id,after?.to_account_id].filter(Boolean));
  for(const id of ids) {
    const selected=accounts.find(account=>account.id===id && account.is_active!==false);
    if(!selected)throw new Error('A selected account is missing or inactive.');
    if(after && selected.currency!==after.currency)throw new Error('The receipt and holding accounts must use the same currency.');
  }
  return accounts.map(account=>{
    const delta=accountEffect(after,account.id)-accountEffect(before,account.id);
    if(!delta)return account;
    const cents=Math.round(money(account.current_balance)*100)+delta;
    if(cents<0)throw new Error(`Insufficient balance in ${account.name}.`);
    return {...account,current_balance:cents/100,updated_at:new Date().toISOString()};
  });
}

export function planBudgetChange(budgets:DepartmentBudget[],before:ChurchFinanceRecord|undefined,after:ChurchFinanceRecord|undefined) {
  const effect=(row:ChurchFinanceRecord|undefined,department:string)=>row&&isActiveTransaction(row)&&['expense','disbursement'].includes(row.transaction_type)&&row.department?.toLowerCase()===department.toLowerCase()?money(row.amount):0;
  return budgets.map(budget=>({...budget,spent_amount:money(Math.max(0,budget.spent_amount+effect(after,budget.department)-effect(before,budget.department)))}));
}

export function sumActive<T extends {status?:string;amount:number}>(records:T[]):number {
  return records.filter(isActiveTransaction).reduce((cents,row)=>cents+Math.round(money(row.amount)*100),0)/100;
}
