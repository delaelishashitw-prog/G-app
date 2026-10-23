import type { WelfareFundReceipt } from '../../types/database.types';
import { ghanaToday } from '../../lib/financeViewUtils';

export const WELFARE_FUND_READ_ROLES = ['super_admin', 'senior_pastor', 'administrator', 'finance_officer', 'pastor'];
export const WELFARE_FUND_WRITE_ROLES = ['super_admin', 'senior_pastor', 'finance_officer'];
export const WELFARE_FUND_VOID_ROLES = ['super_admin', 'senior_pastor'];
export const welfareFundSources = {
  opening_balance: 'Carried-forward balance',
  unallocated_dues: 'Dues without member breakdown',
  donation: 'Anonymous donation',
  other: 'Other welfare funds',
} as const;

export type WelfareFundInput = Pick<WelfareFundReceipt, 'id' | 'amount' | 'date' | 'source' | 'reference_no' | 'notes'>;

export function validateWelfareFundReceipt(input: WelfareFundInput, today = ghanaToday()): void {
  if (!input.id || input.id.length > 100) throw new Error('A receipt ID is required. Reopen the form.');
  if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 1e9 || input.amount !== Math.round(input.amount * 100) / 100) {
    throw new Error('Enter an amount above zero, up to GH₵ 1,000,000,000, with at most two decimal places.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(input.date)) || new Date(input.date).toISOString().slice(0, 10) !== input.date || input.date > today) {
    throw new Error('Enter a valid receipt date up to today.');
  }
  if (!Object.hasOwn(welfareFundSources, input.source)) throw new Error('Choose the source of these welfare funds.');
  if (!input.reference_no.trim() || input.reference_no.trim().length > 100) throw new Error('Enter a reference of up to 100 characters.');
  if (input.notes.trim().length < 5 || input.notes.trim().length > 1000) throw new Error('Explain the source of the money in 5–1,000 characters.');
}

/** A pending void retains the previously confirmed amount until the cloud accepts it. */
export function includedWelfareFundReceipt(receipt: Pick<WelfareFundReceipt, 'status' | '_sync_status' | 'updated_at'>): boolean {
  if (receipt._sync_status === 'pending') return receipt.status === 'voided' && Boolean(receipt.updated_at);
  return receipt.status === 'active';
}

export function welfareFundReceiptStatus(receipt: WelfareFundReceipt): string {
  if (receipt._sync_status === 'pending') return receipt.status === 'voided' ? 'Void awaiting confirmation' : 'Awaiting cloud confirmation';
  return receipt.status === 'voided' ? 'Voided' : 'Confirmed';
}
