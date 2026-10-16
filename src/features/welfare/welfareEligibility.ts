import type { Member, WelfareContribution } from '../../types/database.types';

export const WELFARE_ARREARS_THRESHOLD = 3;
export type WelfareEligibility = 'full' | 'partial' | 'probation' | 'review';

export const welfareEligibilityLabel: Record<WelfareEligibility, string> = {
  full: 'Fully eligible',
  partial: 'Defaulter — Partially eligible',
  probation: 'Probation — Committee review',
  review: 'Review needed — Joining date missing',
};

function monthNumber(value: string | undefined): number | null {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const [year, month] = value.split('-').map(Number);
  return year >= 1900 ? year * 12 + month - 1 : null;
}

function monthKey(value: number): string {
  return `${Math.floor(value / 12)}-${String(value % 12 + 1).padStart(2, '0')}`;
}

function joiningMonth(value: string | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value.slice(0, 10)) return null;
  return monthNumber(value.slice(0, 7));
}

export function classifyWelfareEligibility(arrearsMonths: number, consecutivePaidMonths: number): WelfareEligibility {
  if (arrearsMonths >= WELFARE_ARREARS_THRESHOLD) return 'partial';
  return consecutivePaidMonths >= 3 ? 'full' : 'probation';
}

/** Recorded monthly coverage, not a monetary debt calculation. The current month is not overdue. */
export function assessWelfareStanding(
  member: Pick<Member, 'id' | 'member_id' | 'membership_date' | 'date_joined'>,
  contributions: readonly Pick<WelfareContribution, 'member_id' | 'month' | 'amount'>[],
  asOf = new Date(),
) {
  const currentMonth = asOf.getUTCFullYear() * 12 + asOf.getUTCMonth();
  const paid = [...new Set(contributions
    .filter(c => c.member_id === member.id || (Boolean(member.member_id) && c.member_id === member.member_id))
    .filter(c => Number.isFinite(Number(c.amount)) && Number(c.amount) > 0)
    .map(c => monthNumber(c.month))
    .filter((month): month is number => month !== null && month <= currentMonth))].sort((a, b) => a - b);

  const joined = joiningMonth(member.membership_date) ?? joiningMonth(member.date_joined);
  const start = joined ?? paid[0] ?? null;
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
  const eligibility: WelfareEligibility = start === null
    ? 'review'
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
    startMonth: start === null ? null : monthKey(start),
    startBasis: joined !== null ? 'joining date' : paid.length ? 'first recorded dues month' : null,
    assessedThrough: monthKey(currentMonth - 1),
  };
}

export type WelfareStanding = ReturnType<typeof assessWelfareStanding>;
