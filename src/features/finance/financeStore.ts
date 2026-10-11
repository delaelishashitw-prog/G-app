import type { Dispatch, SetStateAction } from 'react';
import type { ExpenseRecord, GivingRecord, Member, ChurchAccount, ChurchFinanceRecord, DepartmentBudget } from '../../types/database.types';

export function recordGiving(
  data: Omit<GivingRecord, 'id' | 'created_at'>,
  members: Member[],
  setGiving: Dispatch<SetStateAction<GivingRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
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
    id: `giv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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

export function recordExpense(
  data: Omit<ExpenseRecord, 'id' | 'created_at'>,
  setExpenses: Dispatch<SetStateAction<ExpenseRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
): ExpenseRecord {
  let approver = data.approved_by?.trim();
  if (
    !approver ||
    approver === 'Rev. Emmanuel Appiah' ||
    approver.includes('Agyemang-Prempeh') ||
    approver.includes('Emmanuel Agyemang') ||
    approver.includes('Emmanuel Appiah')
  ) {
    approver = 'Prophet Elisha K. Richard';
  }

  const newRecord: ExpenseRecord = {
    ...data,
    approved_by: approver,
    id: `exp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    created_at: new Date().toISOString(),
  };
  setExpenses((prev) => [newRecord, ...prev]);
  logAction('RECORD_EXPENSE', 'Finance', `Disbursed GH₵ ${data.amount.toFixed(2)} for ${data.category} (${data.description || data.title})`, newRecord.id);
  dbSyncUpsert('expenses', newRecord);
  return newRecord;
}

export function updateExpense(
  id: string,
  updates: Partial<ExpenseRecord>,
  setExpenses: Dispatch<SetStateAction<ExpenseRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  let sanitizedUpdates = { ...updates };
  if (sanitizedUpdates.approved_by !== undefined) {
    const raw = sanitizedUpdates.approved_by?.trim();
    if (
      !raw ||
      raw === 'Rev. Emmanuel Appiah' ||
      raw.includes('Agyemang-Prempeh') ||
      raw.includes('Emmanuel Agyemang') ||
      raw.includes('Emmanuel Appiah')
    ) {
      sanitizedUpdates.approved_by = 'Prophet Elisha K. Richard';
    }
  }

  setExpenses((prev) =>
    prev.map((e) => {
      if (e.id === id) {
        const updated = { ...e, ...sanitizedUpdates };
        logAction(
          'UPDATE_EXPENSE',
          'Finance',
          `Updated expense voucher: ${updated.title || updated.description} (GH₵ ${updated.amount.toFixed(2)})`,
          id
        );
        dbSyncUpsert('expenses', updated);
        return updated;
      }
      return e;
    })
  );
}

export function deleteExpense(
  id: string,
  setExpenses: Dispatch<SetStateAction<ExpenseRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncDelete: (table: string, id: string) => void
) {
  setExpenses((prev) => prev.filter((e) => e.id !== id));
  logAction('DELETE_EXPENSE', 'Finance', `Deleted expense voucher ${id}`, id);
  dbSyncDelete('expenses', id);
}

// -----------------------------------------------------------------------------
// DEDICATED CHURCH ACCOUNTS (Bank & MoMo)
// -----------------------------------------------------------------------------
export function addChurchAccount(
  data: Omit<ChurchAccount, 'id' | 'created_at' | 'updated_at'>,
  setChurchAccounts: Dispatch<SetStateAction<ChurchAccount[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
): ChurchAccount {
  const newAccount: ChurchAccount = {
    ...data,
    id: `acc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    current_balance: Number(data.current_balance) || 0,
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
export function recordChurchFinance(
  data: Omit<ChurchFinanceRecord, 'id' | 'created_at' | 'updated_at'>,
  setChurchFinances: Dispatch<SetStateAction<ChurchFinanceRecord[]>>,
  setChurchAccounts: Dispatch<SetStateAction<ChurchAccount[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
): ChurchFinanceRecord {
  let approver = data.approved_by?.trim();
  if (
    !approver ||
    approver === 'Rev. Emmanuel Appiah' ||
    approver.includes('Agyemang-Prempeh') ||
    approver.includes('Emmanuel Agyemang') ||
    approver.includes('Emmanuel Appiah')
  ) {
    approver = 'Prophet Elisha K. Richard';
  }

  const newRecord: ChurchFinanceRecord = {
    ...data,
    approved_by: approver,
    amount: Number(data.amount) || 0,
    id: `cfin-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  setChurchFinances((prev) => [newRecord, ...prev]);

  // If linked to an account, adjust holding account balance automatically
  if (data.account_id) {
    setChurchAccounts((prevAccounts) =>
      prevAccounts.map((acc) => {
        if (acc.id === data.account_id) {
          const delta = data.transaction_type === 'income' || data.transaction_type === 'grant' ? data.amount : -data.amount;
          const updatedAcc = {
            ...acc,
            current_balance: Math.max(0, acc.current_balance + delta),
            updated_at: new Date().toISOString(),
          };
          dbSyncUpsert('church_accounts', updatedAcc);
          return updatedAcc;
        }
        return acc;
      })
    );
  }

  logAction(
    'RECORD_CHURCH_FINANCE',
    'Church Finance',
    `Recorded ${data.transaction_type.toUpperCase()}: ${data.title} (GH₵ ${data.amount.toFixed(2)}) on ${data.account_name}`,
    newRecord.id
  );
  dbSyncUpsert('church_finances', newRecord);
  return newRecord;
}

export function updateChurchFinance(
  id: string,
  updates: Partial<ChurchFinanceRecord>,
  setChurchFinances: Dispatch<SetStateAction<ChurchFinanceRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  let sanitizedUpdates = { ...updates };
  if (sanitizedUpdates.approved_by !== undefined) {
    const raw = sanitizedUpdates.approved_by?.trim();
    if (
      !raw ||
      raw === 'Rev. Emmanuel Appiah' ||
      raw.includes('Agyemang-Prempeh') ||
      raw.includes('Emmanuel Agyemang') ||
      raw.includes('Emmanuel Appiah')
    ) {
      sanitizedUpdates.approved_by = 'Prophet Elisha K. Richard';
    }
  }

  setChurchFinances((prev) =>
    prev.map((item) => {
      if (item.id === id) {
        const updated = {
          ...item,
          ...sanitizedUpdates,
          amount: sanitizedUpdates.amount !== undefined ? Number(sanitizedUpdates.amount) : item.amount,
          updated_at: new Date().toISOString(),
        };
        logAction(
          'UPDATE_CHURCH_FINANCE',
          'Church Finance',
          `Updated transaction ${updated.title} (GH₵ ${updated.amount.toFixed(2)})`,
          id
        );
        dbSyncUpsert('church_finances', updated);
        return updated;
      }
      return item;
    })
  );
}

export function deleteChurchFinance(
  id: string,
  setChurchFinances: Dispatch<SetStateAction<ChurchFinanceRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncDelete: (table: string, id: string) => void
) {
  setChurchFinances((prev) => prev.filter((f) => f.id !== id));
  logAction('DELETE_CHURCH_FINANCE', 'Church Finance', `Deleted church finance record ${id}`, id);
  dbSyncDelete('church_finances', id);
}

// -----------------------------------------------------------------------------
// INTERNAL TRANSFER BETWEEN CHURCH ACCOUNTS
// -----------------------------------------------------------------------------
export function transferBetweenAccounts(
  fromAccountId: string,
  toAccountId: string,
  amount: number,
  notes: string | undefined,
  setChurchAccounts: Dispatch<SetStateAction<ChurchAccount[]>>,
  setChurchFinances: Dispatch<SetStateAction<ChurchFinanceRecord[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
): { success: boolean; message: string } {
  if (fromAccountId === toAccountId) {
    return { success: false, message: 'Source and destination accounts must be different.' };
  }
  if (amount <= 0) {
    return { success: false, message: 'Transfer amount must be greater than zero.' };
  }

  let fromAccName = 'Source Account';
  let toAccName = 'Destination Account';
  let success = false;

  setChurchAccounts((prev) => {
    const fromAcc = prev.find((a) => a.id === fromAccountId);
    const toAcc = prev.find((a) => a.id === toAccountId);

    if (!fromAcc || !toAcc) return prev;
    if (fromAcc.current_balance < amount) {
      return prev; // Not enough balance
    }

    fromAccName = fromAcc.name;
    toAccName = toAcc.name;
    success = true;

    const updatedFrom = {
      ...fromAcc,
      current_balance: fromAcc.current_balance - amount,
      updated_at: new Date().toISOString(),
    };
    const updatedTo = {
      ...toAcc,
      current_balance: toAcc.current_balance + amount,
      updated_at: new Date().toISOString(),
    };

    dbSyncUpsert('church_accounts', updatedFrom);
    dbSyncUpsert('church_accounts', updatedTo);

    return prev.map((a) => {
      if (a.id === fromAccountId) return updatedFrom;
      if (a.id === toAccountId) return updatedTo;
      return a;
    });
  });

  if (!success) {
    return { success: false, message: 'Transfer failed: Insufficient balance or invalid account.' };
  }

  // Create an audit ledger record in church_finances
  const transferRecord: ChurchFinanceRecord = {
    id: `cfin-transfer-${Date.now()}`,
    transaction_type: 'transfer',
    account_id: fromAccountId,
    account_name: fromAccName,
    category: 'Internal Transfer',
    title: `Transfer to ${toAccName}`,
    recipient_or_vendor: toAccName,
    amount: amount,
    currency: 'GHS',
    date: new Date().toISOString().split('T')[0],
    payment_method: 'internal_transfer',
    reference_no: `TRF-${Date.now().toString().slice(-6)}`,
    department: 'Treasury & Administration',
    notes: notes || `Internal account transfer from ${fromAccName} to ${toAccName}`,
    approved_by: 'Prophet Elisha K. Richard',
    recorded_by: 'Church Accounts Office',
    status: 'completed',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  setChurchFinances((prev) => [transferRecord, ...prev]);
  dbSyncUpsert('church_finances', transferRecord);

  logAction(
    'ACCOUNT_TRANSFER',
    'Church Finance',
    `Transferred GH₵ ${amount.toFixed(2)} from ${fromAccName} to ${toAccName}`,
    transferRecord.id
  );

  return { success: true, message: `Successfully transferred GH₵ ${amount.toFixed(2)} from ${fromAccName} to ${toAccName}.` };
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
    id: `bgt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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
