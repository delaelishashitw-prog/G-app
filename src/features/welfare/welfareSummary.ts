import type { WelfareClaim, WelfareContribution } from '../../types/database.types';
import { money } from '../../lib/ledgerUtils';

export function paidWelfareAmount(claim: Pick<WelfareClaim, 'amount_disbursed'>): number {
  // Approval/request amounts are commitments, not evidence of payment.
  return money(claim.amount_disbursed ?? 0);
}

function sumMoney(amounts: readonly number[]): number {
  return amounts.reduce((pesewas, amount) => pesewas + Math.round(money(amount) * 100), 0) / 100;
}

/** Dues ledger balance; appeal receipts and treasury account balances are separate. */
export function summarizeWelfare<T extends Pick<WelfareClaim, 'amount_disbursed'>>(
  contributions: readonly Pick<WelfareContribution, 'amount'>[],
  claims: readonly T[],
) {
  const totalDuesCollected = sumMoney(contributions.map(contribution => contribution.amount));
  const paidClaims = claims.filter(claim => paidWelfareAmount(claim) > 0);
  const totalDisbursed = sumMoney(paidClaims.map(paidWelfareAmount));
  return {
    totalDuesCollected,
    totalDisbursed,
    paidClaims,
    fundBalance: money(totalDuesCollected - totalDisbursed),
  };
}
