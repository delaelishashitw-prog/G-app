import test from 'node:test';
import assert from 'node:assert/strict';
import { assessWelfareStanding, classifyWelfareEligibility } from '../features/welfare/welfareEligibility.ts';

const asOf = new Date('2026-10-16T00:00:00Z');
const member = { id: 'm1', member_id: 'GWCC-1', membership_date: '2026-04-15' };
const paid = (...months) => months.map(month => ({ member_id: 'm1', month, date: `${month}-15`, amount: 50 }));

test('two overdue months retain qualification; three or more mark defaulters partially eligible', () => {
  const two = assessWelfareStanding(member, paid('2026-04', '2026-05', '2026-06', '2026-07'), asOf);
  assert.equal(two.arrearsCount, 2);
  assert.equal(two.eligibility, 'full');
  const three = assessWelfareStanding(member, paid('2026-04', '2026-05', '2026-06'), asOf);
  assert.deepEqual(three.arrearsMonths, ['2026-07', '2026-08', '2026-09']);
  assert.equal(three.isDefaulter, true);
  assert.equal(three.eligibility, 'partial');
  const gaps = assessWelfareStanding(member, paid('2026-04', '2026-06', '2026-08'), asOf);
  assert.deepEqual(gaps.arrearsMonths, ['2026-05', '2026-07', '2026-09']);
  assert.equal(gaps.eligibility, 'partial');
  assert.equal(classifyWelfareEligibility(24, 30), 'partial');
});

test('receipt duplicates do not create months or a qualifying consecutive streak', () => {
  const result = assessWelfareStanding(member, paid('2026-04', '2026-04', '2026-06'), asOf);
  assert.equal(result.paidMonths.length, 2);
  assert.equal(result.consecutivePaidMonths, 1);
  assert.equal(result.arrearsCount, 4);
  const probation = assessWelfareStanding({ ...member, membership_date: '2026-08-01' }, paid('2026-08', '2026-08', '2026-08'), asOf);
  assert.equal(probation.eligibility, 'probation');
});

test('catch-up payments settle their recorded month; future, invalid and nonpositive receipts do not clear arrears', () => {
  const receipts = [
    ...paid('2026-04', '2026-05', '2026-06', '2026-12', '2026-13'),
    { member_id: 'GWCC-1', month: '2026-07', amount: 50, date: '2026-10-16' },
    { member_id: 'm1', month: '2026-08', amount: 0 },
    { member_id: 'm1', month: '2026-09', amount: -50 },
    { member_id: 'someone-else', month: '2026-08', amount: 50 },
  ];
  const result = assessWelfareStanding(member, receipts, asOf);
  assert.deepEqual(result.arrearsMonths, ['2026-08', '2026-09']);
  assert.equal(result.eligibility, 'full');
  assert.equal(result.lastPaidMonth, '2026-07');
});

test('current first-payment month is not overdue and December is assessed correctly in January', () => {
  const fresh = assessWelfareStanding(member, [{ ...paid('2026-10')[0], date: '2026-10-12' }], asOf);
  assert.equal(fresh.arrearsCount, 0);
  assert.equal(fresh.eligibility, 'probation');
  assert.equal(fresh.welfareJoiningDate, '2026-10-12');
  const january = assessWelfareStanding(member, paid('2025-09'), new Date('2026-01-01T00:00:00Z'));
  assert.deepEqual(january.arrearsMonths, ['2025-10', '2025-11', '2025-12']);
  assert.equal(january.assessedThrough, '2025-12');
  assert.equal(january.eligibility, 'partial');
});

test('welfare joining date comes from the first payment regardless of church membership date', () => {
  const receipts = paid('2026-09', '2026-07', '2026-08');
  for (const membership_date of ['2004-01-10', '2026-02-31', '2099-12-01', undefined]) {
    const standing = assessWelfareStanding({ ...member, membership_date, date_joined: '2004-01-10' }, receipts, asOf);
    assert.equal(standing.welfareJoiningDate, '2026-07-15');
    assert.equal(standing.startMonth, '2026-07');
    assert.equal(standing.startBasis, 'first welfare payment');
    assert.equal(standing.arrearsCount, 0);
    assert.equal(standing.eligibility, 'full');
  }
});

test('enrollment uses the receipt payment date, not its applicable dues month or entry order', () => {
  const receipts = [
    ...paid('2026-09', '2026-08'),
    { ...paid('2026-04')[0], date: '2026-07-20' },
  ];
  const standing = assessWelfareStanding(member, receipts, asOf);
  assert.equal(standing.welfareJoiningDate, '2026-07-20');
  assert.deepEqual(standing.arrearsMonths, ['2026-07']);
  assert.deepEqual(standing.paidMonths, ['2026-08', '2026-09']);
  assert.equal(standing.eligibility, 'probation');
});

test('members without a positive dated payment are not defaulters, even after years of church membership', () => {
  const oldMember = { ...member, membership_date: '2004-01-10' };
  const unpaid = assessWelfareStanding(oldMember, [], asOf);
  assert.equal(unpaid.eligibility, 'not_enrolled');
  assert.equal(unpaid.isDefaulter, false);
  assert.equal(unpaid.arrearsCount, null);
  assert.equal(unpaid.welfareJoiningDate, null);
  assert.deepEqual(unpaid.arrearsMonths, []);
  assert.equal(assessWelfareStanding(oldMember, [{ ...paid('2026-01')[0], amount: 0 }], asOf).eligibility, 'not_enrolled');
  assert.equal(assessWelfareStanding(oldMember, [{ ...paid('2026-01')[0], date: '2026-02-31' }], asOf).eligibility, 'review');
});

test('future-dated payments cannot enroll a member or cover overdue months before payment', () => {
  const future = { ...paid('2026-07')[0], date: '2026-11-01' };
  assert.equal(assessWelfareStanding(member, [future], asOf).eligibility, 'not_enrolled');
  const standing = assessWelfareStanding(member, [...paid('2026-04', '2026-05', '2026-06'), future], asOf);
  assert.equal(standing.welfareJoiningDate, '2026-04-15');
  assert.deepEqual(standing.arrearsMonths, ['2026-07', '2026-08', '2026-09']);
  assert.equal(standing.eligibility, 'partial');
});
