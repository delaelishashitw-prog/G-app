import { money, planAccountChange, planBudgetChange } from '../../lib/ledgerUtils';
import type { Dispatch, SetStateAction } from 'react';
import type { ExpenseRecord, GivingRecord, Member, ChurchAccount, ChurchFinanceRecord, DepartmentBudget } from '../../types/database.types';

export function recordGiving(
  data: Omit<GivingRecord, 'id' | 'created_at'>,
  members: Member[],
  setGiving: Dispatch<SetStateAction<GivingRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void,
  requestId?: string
): GivingRecord {
  const matchingMember = data.member_id
    ? members.find((x) => x.id === data.member_id)
    : data.tithe_number
      ? members.find((x) => x.tithe_number?.trim().toLowerCase() === data.tithe_number?.trim().toLowerCase())
      : undefined;

  const resolvedMemberId = data.member_id || matchingMember?.id;
  const resolvedMemberName = data.member_name || (matchingMember ? `${matchingMember.first_name} ${matchingMember.last_name}` : undefined);
  const resolvedTitheNumber = data.tithe_number || matchingMember?.tithe_number || undefined;

  const newRecord: GivingRecord = {
    ...data,
    member_id: resolvedMemberId,
    member_name: resolvedMemberName,
    tithe_number: resolvedTitheNumber,
    id: requestId || crypto.randomUUID(),
    created_at: new Date().toISOString(),
  };
  setGiving((prev) => [newRecord, ...prev]);

  const donor = resolvedMemberName || data.donor_name || (resolvedTitheNumber ? `Tither #${resolvedTitheNumber}` : 'Anonymous');

  logAction(
    'RECORD_GIVING',
    'Finance',
    `Recorded ${data.category} of GH₵ ${data.amount.toFixed(2)} from ${donor}${resolvedTitheNumber ? ` (Tithe #${resolvedTitheNumber})` : ''}`,
    newRecord.id
  );
  dbSyncUpsert('giving', newRecord);
  return newRecord;
}

export function updateGiving(
  id: string,
  updates: Partial<GivingRecord>,
  members: Member[],
  setGiving: Dispatch<SetStateAction<GivingRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  setGiving((prev) =>
    prev.map((g) => {
      if (g.id === id) {
        const mem = updates.member_id ? members.find((x) => x.id === updates.member_id) : undefined;
        const titheNum = updates.tithe_number !== undefined ? updates.tithe_number : mem?.tithe_number || g.tithe_number;
        const updated = { ...g, ...updates, tithe_number: titheNum };
        logAction(
          'UPDATE_GIVING',
          'Finance',
          `Updated giving entry of GH₵ ${updated.amount.toFixed(2)} for ${updated.member_name || updated.donor_name || 'Anonymous'}${updated.tithe_number ? ` (Tithe #${updated.tithe_number})` : ''}`,
          id
        );
        dbSyncUpsert('giving', updated);
        return updated;
      }
      return g;
    })
  );
}

export function deleteGiving(
  id: string,
  setGiving: Dispatch<SetStateAction<GivingRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncDelete: (table: string, id: string) => void
) {
  setGiving((prev) => prev.filter((g) => g.id !== id));
  logAction('DELETE_GIVING', 'Finance', `Deleted giving entry ${id}`, id);
  dbSyncDelete('giving', id);
}

export function voidGiving(
  id: string,
  voidReason: string,
  voidedBy: string,
  setGiving: Dispatch<SetStateAction<GivingRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  setGiving((prev) =>
    prev.map((g) => {
      if (g.id === id) {
        const updated: GivingRecord = {
          ...g,
          status: 'voided',
          void_reason: voidReason,
          voided_by: voidedBy,
        };
        logAction(
          'VOID_GIVING',
          'Finance',
          `Voided giving entry #${id} (GH₵ ${g.amount.toFixed(2)}) for ${g.member_name || g.donor_name || 'Anonymous'}. Reason: ${voidReason}`,
          id
        );
        dbSyncUpsert('giving', updated);
        return updated;
      }
      return g;
    })
  );
}

export function recordExpense(
  data: Omit<ExpenseRecord, 'id' | 'created_at'>,
  setExpenses: Dispatch<SetStateAction<ExpenseRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
): ExpenseRecord {
  throw new Error('Submit a payment request in Church Finance. Legacy expense history is read-only.');
}

export function updateExpense(..._args: unknown[]) {
  throw new Error('Legacy expense history is read-only. Submit a payment request in Church Finance.');
}

export function deleteExpense(..._args: unknown[]) {
  throw new Error('Legacy expense history is read-only. Submit a payment request in Church Finance.');
}

// -----------------------------------------------------------------------------
// DEDICATED CHURCH ACCOUNTS (Bank & MoMo)
// -----------------------------------------------------------------------------
export function addChurchAccount(
  data: Omit<ChurchAccount, 'id' | 'created_at' | 'updated_at'>,
  setChurchAccounts: Dispatch<SetStateAction<ChurchAccount[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void,
  requestId?: string
): ChurchAccount {
  const balance=money(Number(data.current_balance));
  if(balance<0)throw new Error('Enter a non-negative verified opening balance.');
  const newAccount: ChurchAccount = {
    ...data,
    id: requestId || crypto.randomUUID(),
    current_balance: balance,
    opening_balance: balance,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  setChurchAccounts((prev) => [...prev, newAccount]);
  logAction('ADD_CHURCH_ACCOUNT', 'Church Finance', `Added church account: ${newAccount.name} (${newAccount.bank_or_provider}) with balance GH₵ ${newAccount.current_balance.toFixed(2)}`, newAccount.id);
  dbSyncUpsert('church_accounts', newAccount);
  return newAccount;
}

export function updateChurchAccount(
  id: string,
  updates: Partial<ChurchAccount>,
  setChurchAccounts: Dispatch<SetStateAction<ChurchAccount[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  if (updates.current_balance !== undefined) throw new Error('Record an income, expense, or transfer to change an account balance.');
  setChurchAccounts((prev) =>
    prev.map((acc) => {
      if (acc.id === id) {
        const updated = {
          ...acc,
          ...updates,
          current_balance: updates.current_balance !== undefined ? Number(updates.current_balance) : acc.current_balance,
          updated_at: new Date().toISOString(),
        };
        logAction('UPDATE_CHURCH_ACCOUNT', 'Church Finance', `Updated church account: ${updated.name}`, id);
        dbSyncUpsert('church_accounts', updated);
        return updated;
      }
      return acc;
    })
  );
}

export function deleteChurchAccount(
  id: string,
  setChurchAccounts: Dispatch<SetStateAction<ChurchAccount[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncDelete: (table: string, id: string) => void
) {
  setChurchAccounts((prev) => prev.filter((acc) => acc.id !== id));
  logAction('DELETE_CHURCH_ACCOUNT', 'Church Finance', `Deleted church account ${id}`, id);
  dbSyncDelete('church_accounts', id);
}

// -----------------------------------------------------------------------------
// DEDICATED CHURCH FINANCES (Operating Expenses, Vouchers, Disbursements)
// -----------------------------------------------------------------------------
export interface FinanceSnapshot { finances: ChurchFinanceRecord[]; accounts: ChurchAccount[]; budgets: DepartmentBudget[] }
type Setter<T> = Dispatch<SetStateAction<T[]>>;
type Logger = (action:string,module:string,details:string,id?:string)=>void;
type Sync = (table:string,record:any)=>unknown;

function applyReceipt(before:ChurchFinanceRecord|undefined,after:ChurchFinanceRecord,state:FinanceSnapshot|undefined,
  setFinances:Setter<ChurchFinanceRecord>,setAccounts:Setter<ChurchAccount>,setBudgets:Setter<DepartmentBudget>|undefined,
  log:Logger|undefined,sync:Sync|undefined) {
  if(!state) throw new Error('A current finance snapshot is required.');
  after._sync_status='pending';
  const accounts=planAccountChange(state.accounts,before,after);
  const budgets=planBudgetChange(state.budgets,before,after);
  const finances=before?state.finances.map(row=>row.id===after.id?after:row):[after,...state.finances];
  // All validation/calculation happens before React receives any state update.
  setFinances(finances);setAccounts(accounts);setBudgets?.(budgets);
  log?.(before?'UPDATE_CHURCH_FINANCE':'RECORD_CHURCH_FINANCE','Church Finance',`${after.title}: GH₵ ${after.amount.toFixed(2)} (${after.status})`,after.id);
  sync?.('church_finances',after);
}

export function recordChurchFinance(data:Omit<ChurchFinanceRecord,'id'|'created_at'|'updated_at'>,
  sf:Setter<ChurchFinanceRecord>,sa:Setter<ChurchAccount>,sb?:Setter<DepartmentBudget>,log?:Logger,sync?:Sync,state?:FinanceSnapshot,requestId?:string):ChurchFinanceRecord {
  const now=new Date().toISOString();
  const id=requestId || crypto.randomUUID();
  const outbound=['expense','disbursement','transfer'].includes(data.transaction_type);
  const record:ChurchFinanceRecord={...data,id,reference_no:data.reference_no?.trim()||`PENDING-${id}`,amount:money(data.amount),status:outbound?'pending':data.status||'completed',...(outbound?{approval_state:'requested' as const,approved_by:undefined,approval_history:[]}:{}),created_at:now,updated_at:now};
  applyReceipt(undefined,record,state,sf,sa,sb,log,sync);return record;
}
export function updateChurchFinance(id:string,updates:Partial<ChurchFinanceRecord>,sf:Setter<ChurchFinanceRecord>,sa:Setter<ChurchAccount>,sb:Setter<DepartmentBudget>,log:Logger,sync:Sync,state?:FinanceSnapshot) {
  const existing=state?.finances.find(row=>row.id===id);if(!existing)throw new Error('Transaction not found. Refresh and try again.');
  if(existing.approval_state || ['expense','disbursement','transfer'].includes(existing.transaction_type))throw new Error('Cancel and replace a request, or void a historical payment, to correct its details.');
  if(existing.status==='voided')throw new Error('A voided receipt cannot be edited.');
  const updated={...existing,...updates,id:existing.id,amount:money(updates.amount??existing.amount),updated_at:new Date().toISOString(),_expected_updated_at:existing.updated_at};
  applyReceipt(existing,updated,state,sf,sa,sb,log,sync);
}
export function voidChurchFinance(id:string,reason:string,actor:string,sf:Setter<ChurchFinanceRecord>,sa:Setter<ChurchAccount>,sb:Setter<DepartmentBudget>,log:Logger,sync:Sync,state?:FinanceSnapshot) {
  const existing=state?.finances.find(row=>row.id===id);if(!existing)throw new Error('Transaction not found.');
  if(existing.approval_state)throw new Error('Use Approvals & Payments to cancel or void this request.');
  if(existing.status==='voided')return;
  if(!reason.trim())throw new Error('Enter a reason for voiding this receipt.');
  applyReceipt(existing,{...existing,status:'voided',void_reason:reason.trim(),voided_by:actor,updated_at:new Date().toISOString(),_expected_updated_at:existing.updated_at} as ChurchFinanceRecord,state,sf,sa,sb,log,sync);
}
export function deleteChurchFinance(id:string,sf:Setter<ChurchFinanceRecord>,sa:Setter<ChurchAccount>,sb:Setter<DepartmentBudget>,log:Logger,_delete:(table:string,id:string)=>unknown,sync:Sync,state?:FinanceSnapshot) {
  // Preserve posted history; removal is a documented reversal rather than destruction.
  voidChurchFinance(id,'Removed by the finance office','Church Finance Office',sf,sa,sb,log,sync,state);
}
export function transferBetweenAccounts(fromId:string,toId:string,amount:number,notes:string|undefined,sa:Setter<ChurchAccount>,sf:Setter<ChurchFinanceRecord>,log:Logger,sync:Sync,state?:FinanceSnapshot,requestId?:string):{success:boolean;message:string} {
  try {
    if(!state)throw new Error('Account state is unavailable. Refresh and try again.');
    const from=state.accounts.find(a=>a.id===fromId),to=state.accounts.find(a=>a.id===toId);
    if(!from||!to)throw new Error('Select the source and destination accounts.');
    recordChurchFinance({transaction_type:'transfer',account_id:fromId,account_name:from.name,to_account_id:toId,to_account_name:to.name,
      category:'Internal Transfer',title:`Transfer to ${to.name}`,amount:money(amount),currency:'GHS',date:new Date().toISOString().slice(0,10),
      payment_method:'internal_transfer',notes,status:'pending'},sf,sa,undefined,log,sync,state,requestId);
    return {success:true,message:'Transfer request saved on this device. After cloud confirmation, a different finance staff member must approve it before the transfer is recorded as paid.'};
  } catch(error) {return {success:false,message:(error as Error).message};}
}

// -----------------------------------------------------------------------------
// DEPARTMENT BUDGETS
// -----------------------------------------------------------------------------
export function addDepartmentBudget(
  data: Omit<DepartmentBudget, 'id' | 'created_at' | 'updated_at'>,
  setDepartmentBudgets: Dispatch<SetStateAction<DepartmentBudget[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void
): DepartmentBudget {
  const newBudget: DepartmentBudget = {
    ...data,
    id: crypto.randomUUID(),
    allocated_amount: Number(data.allocated_amount) || 0,
    spent_amount: Number(data.spent_amount) || 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  setDepartmentBudgets((prev) => [...prev, newBudget]);
  logAction('ADD_DEPARTMENT_BUDGET', 'Church Finance', `Added budget for ${newBudget.department}: GH₵ ${newBudget.allocated_amount.toFixed(2)}`, newBudget.id);
  return newBudget;
}

export function updateDepartmentBudget(
  id: string,
  updates: Partial<DepartmentBudget>,
  setDepartmentBudgets: Dispatch<SetStateAction<DepartmentBudget[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void
) {
  setDepartmentBudgets((prev) =>
    prev.map((b) => {
      if (b.id === id) {
        const updated = {
          ...b,
          ...updates,
          allocated_amount: updates.allocated_amount !== undefined ? Number(updates.allocated_amount) : b.allocated_amount,
          spent_amount: updates.spent_amount !== undefined ? Number(updates.spent_amount) : b.spent_amount,
          updated_at: new Date().toISOString(),
        };
        logAction('UPDATE_DEPARTMENT_BUDGET', 'Church Finance', `Updated budget for ${updated.department}`, id);
        return updated;
      }
      return b;
    })
  );
}
