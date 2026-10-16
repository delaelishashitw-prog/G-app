import type { Member, WelfareContribution } from '../../types/database.types';

export const WELFARE_ARREARS_THRESHOLD = 3;
export type WelfareEligibility = 'full' | 'partial' | 'probation' | 'not_enrolled' | 'review';

export const welfareEligibilityLabel: Record<WelfareEligibility, string> = {
  full: 'Fully eligible',
  partial: 'Defaulter — Partially eligible',
  probation: 'Probation — Committee review',
  not_enrolled: 'Not enrolled — No welfare payment',
  review: 'Review needed — Payment date missing',
};

function monthNumber(value: string | undefined): number | null {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const [year, month] = value.split('-').map(Number);
  return year >= 1900 ? year * 12 + month - 1 : null;
}

function monthKey(value: number): string {
  return `${Math.floor(value / 12)}-${String(value % 12 + 1).padStart(2, '0')}`;
}

function paymentDate(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value.slice(0, 10)) return null;
  return monthNumber(value.slice(0, 7)) === null ? null : value.slice(0, 10);
}

export function classifyWelfareEligibility(arrearsMonths: number, consecutivePaidMonths: number): WelfareEligibility {
  if (arrearsMonths >= WELFARE_ARREARS_THRESHOLD) return 'partial';
  return consecutivePaidMonths >= 3 ? 'full' : 'probation';
}

/** Recorded monthly coverage, not a monetary debt calculation. The current month is not overdue. */
export function assessWelfareStanding(
  member: Pick<Member, 'id' | 'member_id'>,
  contributions: readonly Pick<WelfareContribution, 'member_id' | 'month' | 'amount' | 'date'>[],
  asOf = new Date(),
) {
  const currentMonth = asOf.getUTCFullYear() * 12 + asOf.getUTCMonth();
  const today = asOf.toISOString().slice(0, 10);
  const positiveReceipts = contributions
    .filter(c => c.member_id === member.id || (Boolean(member.member_id) && c.member_id === member.member_id))
    .filter(c => Number.isFinite(Number(c.amount)) && Number(c.amount) > 0);
  const datedReceipts = positiveReceipts
    .map(receipt => ({ receipt, date: paymentDate(receipt.date) }))
    .filter((item): item is { receipt: typeof positiveReceipts[number]; date: string } => item.date !== null && item.date <= today);
  const welfareJoiningDate = datedReceipts.map(item => item.date).sort()[0] ?? null;
  const start = welfareJoiningDate ? monthNumber(welfareJoiningDate.slice(0, 7)) : null;
  const paid = [...new Set(datedReceipts.map(item => item.receipt)
    .map(c => monthNumber(c.month))
    .filter((month): month is number => month !== null && month <= currentMonth))].sort((a, b) => a - b);

  const paidSet = new Set(paid);
  const arrearsMonths: string[] = [];
  if (start !== null) {
    for (let month = start; month < currentMonth; month++) {
      if (!paidSet.has(month)) arrearsMonths.push(monthKey(month));
    }
  }
  const paidSinceJoining = paid.filter(month => start === null || month >= start);
  let consecutivePaidMonths = 0;
  let streak = 0;
  paidSinceJoining.forEach((month, index) => {
    streak = index > 0 && month === paidSinceJoining[index - 1] + 1 ? streak + 1 : 1;
    consecutivePaidMonths = Math.max(consecutivePaidMonths, streak);
  });
  const hasUndatedPayment = positiveReceipts.some(receipt => paymentDate(receipt.date) === null);
  const eligibility: WelfareEligibility = start === null
    ? hasUndatedPayment ? 'review' : 'not_enrolled'
    : classifyWelfareEligibility(arrearsMonths.length, consecutivePaidMonths);

  return {
    eligibility,
    label: welfareEligibilityLabel[eligibility],
    isDefaulter: eligibility === 'partial',
    arrearsCount: start === null ? null : arrearsMonths.length,
    arrearsMonths,
    paidMonths: paidSinceJoining.map(monthKey),
    consecutivePaidMonths,
    lastPaidMonth: paid.length ? monthKey(paid[paid.length - 1]) : null,
    welfareJoiningDate,
    startMonth: start === null ? null : monthKey(start),
    startBasis: welfareJoiningDate ? 'first welfare payment' : null,
    assessedThrough: monthKey(currentMonth - 1),
  };
}

export type WelfareStanding = ReturnType<typeof assessWelfareStanding>;
