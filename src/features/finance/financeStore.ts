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
  setDepartmentBudgets?: Dispatch<SetStateAction<DepartmentBudget[]>>,
  logAction?: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert?: (table: string, record: unknown) => void
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

  const numAmount = Math.round((Number(data.amount) || 0) * 100) / 100;

  const newRecord: ChurchFinanceRecord = {
    ...data,
    approved_by: approver,
    amount: numAmount,
    id: `cfin-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    status: data.status || 'completed',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  setChurchFinances((prev) => [newRecord, ...prev]);

  // If linked to an account, adjust holding account balance automatically
  if (data.account_id && newRecord.status !== 'voided') {
    setChurchAccounts((prevAccounts) =>
      prevAccounts.map((acc) => {
        if (acc.id === data.account_id) {
          const delta = data.transaction_type === 'income' || data.transaction_type === 'grant' ? numAmount : -numAmount;
          const updatedAcc = {
            ...acc,
            current_balance: Math.max(0, acc.current_balance + delta),
            updated_at: new Date().toISOString(),
          };
          if (dbSyncUpsert) {
            dbSyncUpsert('church_accounts', updatedAcc);
          }
          return updatedAcc;
        }
        return acc;
      })
    );
  }

  // Update matching department budget if applicable
  if (
    setDepartmentBudgets &&
    (data.transaction_type === 'expense' || data.transaction_type === 'disbursement') &&
    data.department &&
    newRecord.status !== 'voided'
  ) {
    setDepartmentBudgets((prevBudgets) =>
      prevBudgets.map((b) => {
        if (b.department.toLowerCase() === data.department!.toLowerCase()) {
          return {
            ...b,
            spent_amount: b.spent_amount + numAmount,
            updated_at: new Date().toISOString(),
          };
        }
        return b;
      })
    );
  }

  if (logAction) {
    logAction(
      'RECORD_CHURCH_FINANCE',
      'Church Finance',
      `Recorded ${data.transaction_type.toUpperCase()}: ${data.title} (GH₵ ${numAmount.toFixed(2)}) on ${data.account_name}`,
      newRecord.id
    );
  }
  if (dbSyncUpsert) {
    dbSyncUpsert('church_finances', newRecord);
  }
  return newRecord;
}

export function updateChurchFinance(
  id: string,
  updates: Partial<ChurchFinanceRecord>,
  setChurchFinances: Dispatch<SetStateAction<ChurchFinanceRecord[]>>,
  setChurchAccounts: Dispatch<SetStateAction<ChurchAccount[]>>,
  setDepartmentBudgets: Dispatch<SetStateAction<DepartmentBudget[]>>,
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

  setChurchFinances((prevFinances) => {
    const existing = prevFinances.find((item) => item.id === id);
    if (!existing) return prevFinances;

    const oldAmount = existing.amount;
    const newAmount = sanitizedUpdates.amount !== undefined
      ? Math.round((Number(sanitizedUpdates.amount) || 0) * 100) / 100
      : oldAmount;

    const oldAccountId = existing.account_id;
    const newAccountId = sanitizedUpdates.account_id !== undefined ? sanitizedUpdates.account_id : oldAccountId;

    const oldType = existing.transaction_type;
    const newType = sanitizedUpdates.transaction_type !== undefined ? sanitizedUpdates.transaction_type : oldType;

    const oldDepartment = existing.department;
    const newDepartment = sanitizedUpdates.department !== undefined ? sanitizedUpdates.department : oldDepartment;

    const isExistingActive = existing.status !== 'voided';
    const isNewActive = (sanitizedUpdates.status || existing.status) !== 'voided';

    // Update holding account balances if active
    if (isExistingActive && isNewActive) {
      setChurchAccounts((prevAccounts) => {
        let updatedAccounts = [...prevAccounts];

        // 1. If account stayed the same
        if (oldAccountId && oldAccountId === newAccountId) {
          const oldEffect = oldType === 'income' || oldType === 'grant' ? oldAmount : -oldAmount;
          const newEffect = newType === 'income' || newType === 'grant' ? newAmount : -newAmount;
          const diff = newEffect - oldEffect;

          if (diff !== 0) {
            updatedAccounts = updatedAccounts.map((acc) => {
              if (acc.id === oldAccountId) {
                const u = {
                  ...acc,
                  current_balance: Math.max(0, acc.current_balance + diff),
                  updated_at: new Date().toISOString(),
                };
                dbSyncUpsert('church_accounts', u);
                return u;
              }
              return acc;
            });
          }
        } else {
          // Account changed: reverse old, apply new
          if (oldAccountId) {
            const oldReversal = oldType === 'income' || oldType === 'grant' ? -oldAmount : oldAmount;
            updatedAccounts = updatedAccounts.map((acc) => {
              if (acc.id === oldAccountId) {
                const u = {
                  ...acc,
                  current_balance: Math.max(0, acc.current_balance + oldReversal),
                  updated_at: new Date().toISOString(),
                };
                dbSyncUpsert('church_accounts', u);
                return u;
              }
              return acc;
            });
          }
          if (newAccountId) {
            const newEffect = newType === 'income' || newType === 'grant' ? newAmount : -newAmount;
            updatedAccounts = updatedAccounts.map((acc) => {
              if (acc.id === newAccountId) {
                const u = {
                  ...acc,
                  current_balance: Math.max(0, acc.current_balance + newEffect),
                  updated_at: new Date().toISOString(),
                };
                dbSyncUpsert('church_accounts', u);
                return u;
              }
              return acc;
            });
          }
        }
        return updatedAccounts;
      });

      // Update Department Budget if an expense amount or department changed
      if ((oldType === 'expense' || oldType === 'disbursement') && (newType === 'expense' || newType === 'disbursement')) {
        setDepartmentBudgets((prevBudgets) => {
          return prevBudgets.map((b) => {
            const isOldMatch = oldDepartment && b.department.toLowerCase() === oldDepartment.toLowerCase();
            const isNewMatch = newDepartment && b.department.toLowerCase() === newDepartment.toLowerCase();

            if (isOldMatch && isNewMatch) {
              const diff = newAmount - oldAmount;
              return { ...b, spent_amount: Math.max(0, b.spent_amount + diff), updated_at: new Date().toISOString() };
            }
            if (isOldMatch) {
              return { ...b, spent_amount: Math.max(0, b.spent_amount - oldAmount), updated_at: new Date().toISOString() };
            }
            if (isNewMatch) {
              return { ...b, spent_amount: b.spent_amount + newAmount, updated_at: new Date().toISOString() };
            }
            return b;
          });
        });
      }
    }

    const updatedRecord: ChurchFinanceRecord = {
      ...existing,
      ...sanitizedUpdates,
      amount: newAmount,
      updated_at: new Date().toISOString(),
    };

    logAction(
      'UPDATE_CHURCH_FINANCE',
      'Church Finance',
      `Updated transaction ${updatedRecord.title} (GH₵ ${updatedRecord.amount.toFixed(2)}) on ${updatedRecord.account_name}`,
      id
    );
    dbSyncUpsert('church_finances', updatedRecord);

    return prevFinances.map((f) => (f.id === id ? updatedRecord : f));
  });
}

export function voidChurchFinance(
  id: string,
  voidReason: string,
  voidedBy: string,
  setChurchFinances: Dispatch<SetStateAction<ChurchFinanceRecord[]>>,
  setChurchAccounts: Dispatch<SetStateAction<ChurchAccount[]>>,
  setDepartmentBudgets: Dispatch<SetStateAction<DepartmentBudget[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  setChurchFinances((prevFinances) => {
    const target = prevFinances.find((f) => f.id === id);
    if (!target) return prevFinances;

    // If already voided, do not double-reverse
    if (target.status === 'voided') return prevFinances;

    // Reverse holding account balance
    if (target.account_id) {
      setChurchAccounts((prevAccounts) =>
        prevAccounts.map((acc) => {
          if (acc.id === target.account_id) {
            // Reversing an expense gives money back; reversing income removes money
            const isInc = target.transaction_type === 'income' || target.transaction_type === 'grant';
            const reversalDelta = isInc ? -target.amount : target.amount;
            const updatedAcc = {
              ...acc,
              current_balance: Math.max(0, acc.current_balance + reversalDelta),
              updated_at: new Date().toISOString(),
            };
            dbSyncUpsert('church_accounts', updatedAcc);
            return updatedAcc;
          }
          return acc;
        })
      );
    }

    // Reverse department budget spent amount if it was an expense
    if (
      (target.transaction_type === 'expense' || target.transaction_type === 'disbursement') &&
      target.department
    ) {
      setDepartmentBudgets((prevBudgets) =>
        prevBudgets.map((b) => {
          if (b.department.toLowerCase() === target.department!.toLowerCase()) {
            return {
              ...b,
              spent_amount: Math.max(0, b.spent_amount - target.amount),
              updated_at: new Date().toISOString(),
            };
          }
          return b;
        })
      );
    }

    const voidedRecord: ChurchFinanceRecord = {
      ...target,
      status: 'voided',
      void_reason: voidReason.trim() || 'Voided by administrative authority',
      voided_by: voidedBy.trim() || 'Church Finance Office',
      updated_at: new Date().toISOString(),
    };

    logAction(
      'VOID_CHURCH_FINANCE',
      'Church Finance',
      `Voided transaction #${id} "${target.title}" (GH₵ ${target.amount.toFixed(2)}). Reason: ${voidReason}`,
      id
    );
    dbSyncUpsert('church_finances', voidedRecord);

    return prevFinances.map((f) => (f.id === id ? voidedRecord : f));
  });
}

export function deleteChurchFinance(
  id: string,
  setChurchFinances: Dispatch<SetStateAction<ChurchFinanceRecord[]>>,
  setChurchAccounts: Dispatch<SetStateAction<ChurchAccount[]>>,
  setDepartmentBudgets: Dispatch<SetStateAction<DepartmentBudget[]>>,
  logAction: (action: string, module: string, details: string, recordId?: string) => void,
  dbSyncDelete: (table: string, id: string) => void,
  dbSyncUpsert: (table: string, record: unknown) => void
) {
  setChurchFinances((prevFinances) => {
    const target = prevFinances.find((f) => f.id === id);

    // If active (not voided), reverse its balance impact on holding accounts
    if (target && target.status !== 'voided' && target.account_id) {
      setChurchAccounts((prevAccounts) =>
        prevAccounts.map((acc) => {
          if (acc.id === target.account_id) {
            const isInc = target.transaction_type === 'income' || target.transaction_type === 'grant';
            const reversalDelta = isInc ? -target.amount : target.amount;
            const updatedAcc = {
              ...acc,
              current_balance: Math.max(0, acc.current_balance + reversalDelta),
              updated_at: new Date().toISOString(),
            };
            dbSyncUpsert('church_accounts', updatedAcc);
            return updatedAcc;
          }
          return acc;
        })
      );

      // Also reverse department budget if applicable
      if (
        (target.transaction_type === 'expense' || target.transaction_type === 'disbursement') &&
        target.department
      ) {
        setDepartmentBudgets((prevBudgets) =>
          prevBudgets.map((b) => {
            if (b.department.toLowerCase() === target.department!.toLowerCase()) {
              return {
                ...b,
                spent_amount: Math.max(0, b.spent_amount - target.amount),
                updated_at: new Date().toISOString(),
              };
            }
            return b;
          })
        );
      }
    }

    logAction('DELETE_CHURCH_FINANCE', 'Church Finance', `Deleted church finance record ${id} ("${target?.title || ''}")`, id);
    dbSyncDelete('church_finances', id);
    return prevFinances.filter((f) => f.id !== id);
  });
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
  const cleanAmount = Math.round((Number(amount) || 0) * 100) / 100;
  if (cleanAmount <= 0) {
    return { success: false, message: 'Transfer amount must be greater than zero.' };
  }

  let fromAccName = 'Source Account';
  let toAccName = 'Destination Account';
  let success = false;

  setChurchAccounts((prev) => {
    const fromAcc = prev.find((a) => a.id === fromAccountId);
    const toAcc = prev.find((a) => a.id === toAccountId);

    if (!fromAcc || !toAcc) return prev;
    if (fromAcc.current_balance < cleanAmount) {
      return prev; // Not enough balance
    }

    fromAccName = fromAcc.name;
    toAccName = toAcc.name;
    success = true;

    const updatedFrom = {
      ...fromAcc,
      current_balance: Math.max(0, fromAcc.current_balance - cleanAmount),
      updated_at: new Date().toISOString(),
    };
    const updatedTo = {
      ...toAcc,
      current_balance: toAcc.current_balance + cleanAmount,
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

  // Create an audit ledger record in church_finances capturing both legs
  const transferRecord: ChurchFinanceRecord = {
    id: `cfin-transfer-${Date.now()}`,
    transaction_type: 'transfer',
    account_id: fromAccountId,
    account_name: fromAccName,
    to_account_id: toAccountId,
    to_account_name: toAccName,
    category: 'Internal Transfer',
    title: `Transfer to ${toAccName}`,
    recipient_or_vendor: toAccName,
    amount: cleanAmount,
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
    `Transferred GH₵ ${cleanAmount.toFixed(2)} from ${fromAccName} to ${toAccName}`,
    transferRecord.id
  );

  return { success: true, message: `Successfully transferred GH₵ ${cleanAmount.toFixed(2)} from ${fromAccName} to ${toAccName}.` };
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
