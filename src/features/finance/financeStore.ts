import type { Dispatch, SetStateAction } from 'react';
import type { ExpenseRecord, GivingRecord, Member } from '../../types/database.types';

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
