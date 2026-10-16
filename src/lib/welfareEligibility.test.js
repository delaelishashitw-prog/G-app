import test from 'node:test';
import assert from 'node:assert/strict';
import { assessWelfareStanding, classifyWelfareEligibility } from '../features/welfare/welfareEligibility.ts';

const asOf = new Date('2026-10-16T00:00:00Z');
const member = { id: 'm1', member_id: 'GWCC-1', membership_date: '2026-04-15' };
const paid = (...months) => months.map(month => ({ member_id: 'm1', month, amount: 50 }));

test('two overdue months retain qualification; three or more mark defaulters partially eligible', () => {
  const two = assessWelfareStanding(member, paid('2026-04', '2026-05', '2026-06', '2026-07'), asOf);
  assert.equal(two.arrearsCount, 2);
  assert.equal(two.eligibility, 'full');
  const three = assessWelfareStanding(member, paid('2026-04', '2026-05', '2026-06'), asOf);
  assert.deepEqual(three.arrearsMonths, ['2026-07', '2026-08', '2026-09']);
  assert.equal(three.isDefaulter, true);
  assert.equal(three.eligibility, 'partial');
  assert.equal(assessWelfareStanding(member, [], asOf).eligibility, 'partial');
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

test('current joining month is not overdue and December is assessed correctly in January', () => {
  const fresh = assessWelfareStanding({ ...member, membership_date: '2026-10-12' }, [], asOf);
  assert.equal(fresh.arrearsCount, 0);
  assert.equal(fresh.eligibility, 'probation');
  const january = assessWelfareStanding({ ...member, membership_date: '2025-10-01' }, [], new Date('2026-01-01T00:00:00Z'));
  assert.deepEqual(january.arrearsMonths, ['2025-10', '2025-11', '2025-12']);
  assert.equal(january.assessedThrough, '2025-12');
  assert.equal(january.eligibility, 'partial');
});

test('missing or invalid joining dates use first paid month, otherwise require review', () => {
  const invalid = { ...member, membership_date: '2026-02-31' };
  assert.equal(assessWelfareStanding(invalid, [], asOf).eligibility, 'review');
  assert.equal(assessWelfareStanding(invalid, [], asOf).arrearsCount, null);
  const fallback = assessWelfareStanding(invalid, paid('2026-07', '2026-08', '2026-09'), asOf);
  assert.equal(fallback.startMonth, '2026-07');
  assert.equal(fallback.startBasis, 'first recorded dues month');
  assert.equal(fallback.eligibility, 'full');
  assert.equal(assessWelfareStanding({ ...invalid, date_joined: '2026-04-15' }, [], asOf).isDefaulter, true);
});
