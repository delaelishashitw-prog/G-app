import assert from 'node:assert/strict';
import test from 'node:test';
import { validateWelfareDue, newWelfareDueReference } from '../src/features/welfare/welfareDuesRules.ts';

const today = '2026-10-30';
const due = {
  member_id: 'member-1', member_name: 'Ama Mensah', amount: 20,
  date: today, month: '2026-10', reference_no: 'MTN-123',
};

test('validates Ghana welfare due amounts and payment dates', () => {
  assert.doesNotThrow(() => validateWelfareDue(due, [], today));
  for (const amount of [0, -20, NaN, Infinity, 20.123, 1_000_000_001]) {
    assert.throws(() => validateWelfareDue({ ...due, amount }, [], today), /amount/i);
  }
  for (const date of ['2026-10-31', '2026-02-30', 'not-a-date']) {
    assert.throws(() => validateWelfareDue({ ...due, date }, [], today), /date/i);
  }
  for (const month of ['2026-13', '2026-00', 'nonsense', '1899-12']) {
    assert.throws(() => validateWelfareDue({ ...due, month }, [], today), /month/i);
  }
});

test('refuses a repeated reference but allows separate receipts for the same member/month', () => {
  assert.throws(
    () => validateWelfareDue({ ...due, reference_no: ' mtn-123 ' }, [{ reference_no: 'MTN-123' }], today),
    /already uses this payment reference/i,
  );
  assert.doesNotThrow(
    () => validateWelfareDue({ ...due, reference_no: 'MTN-124' }, [{ reference_no: 'MTN-123' }], today),
  );
});

test('auto references include an unpredictable suffix, not a three digit random number', () => {
  const id = 'abcdef12-3456-78ab-90cd-ef1234567890';
  assert.equal(newWelfareDueReference('2026-10', id), 'WLF-202610-ABCDEF123456');
});
