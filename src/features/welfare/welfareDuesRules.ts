import type { WelfareContribution } from '../../types/database.types';
import { ghanaToday } from '../../lib/financeViewUtils';

export type WelfareDueInput = Pick<
  WelfareContribution,
  'member_id' | 'member_name' | 'amount' | 'date' | 'month' | 'reference_no'
>;

/**
 * Validate at the recording boundary, not only in the form. A second monthly
 * payment is permitted, but reusing the same payment reference is not.
 */
export function validateWelfareDue(
  input: WelfareDueInput,
  existing: readonly Pick<WelfareContribution, 'reference_no'>[] = [],
  today = ghanaToday(),
): void {
  if (!input.member_id?.trim() || !input.member_name?.trim()) {
    throw new Error('Select a valid church member before recording welfare dues.');
  }
  const amount = input.amount;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000 ||
      Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001) {
    throw new Error('Enter a positive amount in Ghana cedis with no more than two decimal places.');
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month || '') || Number(input.month.slice(0, 4)) < 1900) {
    throw new Error('Choose a valid contribution month.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date || '') ||
      !Number.isFinite(Date.parse(input.date)) ||
      new Date(input.date).toISOString().slice(0, 10) !== input.date ||
      input.date > today) {
    throw new Error('Choose a valid payment date that is not in the future.');
  }
  const reference = input.reference_no?.trim().toLowerCase() || '';
  if (reference.length > 100) throw new Error('A payment reference cannot exceed 100 characters.');
  if (reference && existing.some(row => row.reference_no?.trim().toLowerCase() === reference)) {
    throw new Error('A welfare dues receipt already uses this payment reference. Check the dues ledger before recording another payment.');
  }
}

/** A traceable receipt reference, without three-digit random collisions. */
export function newWelfareDueReference(month: string, uuid = crypto.randomUUID()): string {
  return `WLF-${month.replace('-', '')}-${uuid.replaceAll('-', '').slice(0, 12).toUpperCase()}`;
}
