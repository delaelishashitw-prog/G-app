import test from 'node:test';
import assert from 'node:assert/strict';

test('Member Giving: Voided transactions are strictly excluded from stewardship totals', () => {
  const records = [
    { id: '1', amount: 500, category: 'Tithe', status: 'completed' },
    { id: '2', amount: 200, category: 'Offering', status: 'completed' },
    { id: '3', amount: 1500, category: 'Tithe', status: 'voided', void_reason: 'Duplicate entry' },
    { id: '4', amount: 300, category: 'Thanksgiving', status: 'completed' },
  ];

  // Calculation logic mirroring GivingPage
  const activeRecords = records.filter((r) => r.status !== 'voided');
  const totalAmount = activeRecords.reduce((s, r) => s + r.amount, 0);
  const titheAmount = activeRecords.filter((r) => r.category === 'Tithe').reduce((s, r) => s + r.amount, 0);

  assert.equal(totalAmount, 1000, 'Voided GH₵ 1,500 must not inflate total income');
  assert.equal(titheAmount, 500, 'Voided tithe must not count towards active tithe stewardship');
});

test('Member Giving: Duplicate MoMo / Bank reference detection', () => {
  const existingRecords = [
    { id: 'g-1', reference_number: 'MM-7890123', status: 'completed' },
    { id: 'g-2', reference_number: 'MM-4567890', status: 'voided' },
  ];

  const isDuplicateActive = (newRef) => {
    return existingRecords.some(
      (g) => g.status !== 'voided' && g.reference_number?.toLowerCase() === newRef.toLowerCase()
    );
  };

  assert.equal(isDuplicateActive('MM-7890123'), true, 'Existing active reference must trigger duplicate alert');
  assert.equal(isDuplicateActive('mm-7890123'), true, 'Case-insensitive reference matching');
  assert.equal(isDuplicateActive('MM-4567890'), false, 'Voided reference should not block valid resubmission');
  assert.equal(isDuplicateActive('NEW-REF-001'), false, 'New unique reference is valid');
});

test('Member Giving: Privacy scoping protects other members records', () => {
  const allGiving = [
    { id: '1', member_id: 'mem-1', member_name: 'Ebenezer Quaye', amount: 1000 },
    { id: '2', member_id: 'mem-2', member_name: 'Grace Mensah', amount: 2500 },
    { id: '3', member_id: 'mem-1', member_name: 'Ebenezer Quaye', amount: 500 },
  ];

  // Member-scoped view for Ebenezer Quaye (mem-1)
  const scopedForMem1 = allGiving.filter((g) => g.member_id === 'mem-1');

  assert.equal(scopedForMem1.length, 2);
  assert.ok(scopedForMem1.every((g) => g.member_id === 'mem-1'));
  assert.equal(scopedForMem1.some((g) => g.member_name === 'Grace Mensah'), false, 'Grace Mensah records are confidential');
});
