import test from 'node:test';
import assert from 'node:assert/strict';
import { childContactErrors } from './childRegistration.ts';

test('child can register without personal phone with verified guardian fields supplied', () => {
  assert.deepEqual(childContactErrors(7, '+233', 'Ama Mensah', '+233 24 123 4567'), {});
});
test('child must have named guardian and a phone', () => {
  const errors = childContactErrors(11, '', '', '');
  assert.ok(errors.emergency_name);
  assert.ok(errors.emergency_phone);
  assert.equal(errors.phone, undefined);
});
test('child personal phone, when entered, must be valid', () => {
  assert.ok(childContactErrors(5, '123', 'Ama Mensah', '0241234567').phone);
});
test('adult still needs a personal phone', () => {
  assert.ok(childContactErrors(25, '', 'Ama Mensah', '0241234567').phone);
});
test('12 is child and 13 is not', () => {
  assert.deepEqual(childContactErrors(12, '', 'Ama Mensah', '0241234567'), {});
  assert.ok(childContactErrors(13, '', 'Ama Mensah', '0241234567').phone);
});
