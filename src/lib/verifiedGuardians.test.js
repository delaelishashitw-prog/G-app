import test from 'node:test';
import assert from 'node:assert/strict';
import { getVerifiedGuardians } from './verifiedGuardians.ts';

const adult = (id, is_archived = false) => ({ id, first_name: id, last_name: 'Mensah', is_archived });
const link = (overrides = {}) => ({
  id: 'l1', child_member_id: 'child1', guardian_member_id: 'adult1',
  relationship: 'mother', is_primary: false, pickup_authorized: false,
  verified_at: '2026-10-30T08:00:00Z', ...overrides
});

test('returns only explicitly verified guardians for the selected child', () => {
  const links = [link(), link({id:'l2',child_member_id:'other'}), link({id:'l3',verified_at:undefined})];
  const result = getVerifiedGuardians('child1', links, [adult('adult1')]);
  assert.equal(result.length, 1);
  assert.equal(result[0].guardian.id, 'adult1');
});
test('does not return missing or archived guardian records', () => {
  assert.deepEqual(getVerifiedGuardians('child1',[link()],[adult('adult1',true)]),[]);
  assert.deepEqual(getVerifiedGuardians('child1',[link()],[]),[]);
});
test('pickup permission is returned as explicit recorded value, not inferred', () => {
  const result = getVerifiedGuardians('child1',[link({pickup_authorized:false})],[adult('adult1')]);
  assert.equal(result[0].pickupAuthorized,false);
});
test('primary guardian sorts before other verified guardians', () => {
  const links=[link({id:'l1',guardian_member_id:'adult1'}),link({id:'l2',guardian_member_id:'adult2',is_primary:true})];
  const result=getVerifiedGuardians('child1',links,[adult('adult1'),adult('adult2')]);
  assert.equal(result[0].guardian.id,'adult2');
});
