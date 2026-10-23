import type { WelfareClaim, WelfareContribution, WelfareFundReceipt } from '../../types/database.types';
import { money } from '../../lib/ledgerUtils';
import { includedWelfareFundReceipt } from './welfareFund';

export function paidWelfareAmount(claim: Pick<WelfareClaim, 'amount_disbursed'>): number {
  // Approval/request amounts are commitments, not evidence of payment.
  return money(claim.amount_disbursed ?? 0);
}

function sumMoney(amounts: readonly number[]): number {
  return amounts.reduce((pesewas, amount) => pesewas + Math.round(money(amount) * 100), 0) / 100;
}

/** Member dues plus confirmed unnamed receipts, less payouts. Appeal funds are separate. */
export function summarizeWelfare<T extends Pick<WelfareClaim, 'amount_disbursed'>>(
  contributions: readonly Pick<WelfareContribution, 'amount'>[],
  claims: readonly T[],
  fundReceipts: readonly WelfareFundReceipt[] = [],
) {
  const totalDuesCollected = sumMoney(contributions.map(contribution => contribution.amount));
  const totalAdditionalFunds = sumMoney(fundReceipts.filter(includedWelfareFundReceipt).map(receipt => receipt.amount));
  const paidClaims = claims.filter(claim => paidWelfareAmount(claim) > 0);
  const totalDisbursed = sumMoney(paidClaims.map(paidWelfareAmount));
  return {
    totalDuesCollected,
    totalAdditionalFunds,
    totalDisbursed,
    paidClaims,
    fundBalance: money(totalDuesCollected + totalAdditionalFunds - totalDisbursed),
  };
}
