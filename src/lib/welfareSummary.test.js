import test from 'node:test';
import assert from 'node:assert/strict';
import { paidWelfareAmount, summarizeWelfare } from '../features/welfare/welfareSummary.ts';

test('welfare dues of GHc 10,895 with no payouts produce the same balance without assumed opening capital', () => {
  const summary = summarizeWelfare([{ amount: 10000 }, { amount: 895 }], []);
  assert.equal(summary.totalDuesCollected, 10895);
  assert.equal(summary.totalDisbursed, 0);
  assert.equal(summary.fundBalance, 10895);
  assert.equal(summarizeWelfare([], []).fundBalance, 0);
});

test('welfare totals include partial payouts and use paid amounts rather than requested or approved grants', () => {
  const partial = { id: 'partial', status: 'approved', amount_requested: 1500, amount_approved: 1000, amount_disbursed: 250 };
  const paid = { id: 'paid', status: 'disbursed', amount_requested: 2000, amount_approved: 1500, amount_disbursed: 1200 };
  const unpaid = { id: 'unpaid', status: 'approved', amount_requested: 3000, amount_approved: 2000, amount_disbursed: 0 };
  const summary = summarizeWelfare([{ amount: 10895 }], [partial, paid, unpaid]);
  assert.equal(summary.totalDisbursed, 1450);
  assert.equal(summary.fundBalance, 9445);
  assert.deepEqual(summary.paidClaims.map(claim => claim.id), ['partial', 'paid']);
  assert.equal(paidWelfareAmount({ status: 'disbursed', amount_approved: 999 }), 0);
});

test('welfare reconciliation retains a deficit and sums decimal receipts in pesewas', () => {
  const summary = summarizeWelfare([{ amount: 0.1 }, { amount: 0.2 }], [{ amount_disbursed: 1 }]);
  assert.equal(summary.totalDuesCollected, 0.3);
  assert.equal(summary.fundBalance, -0.7);
});

test('unnamed welfare receipts add to the fund, keep member dues separate, and exclude voids and unconfirmed receipts', () => {
  const receipt = (id, amount, status = 'active', extra = {}) => ({ id, amount, status, ...extra });
  const summary = summarizeWelfare([{ amount: 10895 }], [{ amount_disbursed: 250 }], [
    receipt('carry-forward', 15400), receipt('anonymous', 50.25), receipt('decimal', 0.1), receipt('decimal-2', 0.2),
    receipt('voided', 500, 'voided'), receipt('pending', 1000, 'active', { _sync_status: 'pending' }),
    receipt('pending-void', 200, 'voided', { _sync_status: 'pending', updated_at: '2026-10-22T12:00:00Z' }),
    receipt('unconfirmed-void', 100, 'voided', { _sync_status: 'pending' }),
  ]);
  assert.equal(summary.totalDuesCollected, 10895);
  assert.equal(summary.totalAdditionalFunds, 15650.55);
  assert.equal(summary.totalDisbursed, 250);
  assert.equal(summary.fundBalance, 26295.55);
});
