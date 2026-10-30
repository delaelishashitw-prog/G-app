import test from 'node:test';
import assert from 'node:assert/strict';
import {
  childSessionRecord,
  childSessionRecords,
  childSessionActionError,
  canPrintChildPickupPass,
} from '../src/features/attendance/childSafetySession.ts';

const today = '2026-10-30';
const activeService = { id: 'sunday', is_active: true };
const record = {
  id: 'child-a', service_id: 'sunday', date: today,
  security_code: 'GWCC-ABC', status: 'checked_in',
};
const otherService = { ...record, id: 'child-b', service_id: 'wednesday' };
const priorDay = { ...record, id: 'child-c', date: '2026-10-29' };
const released = { ...record, id: 'child-d', status: 'checked_out' };

test('only a matching child record is selected for the active service and date', () => {
  assert.equal(childSessionRecord(record, 'sunday', today), record);
  assert.equal(childSessionRecord(otherService, 'sunday', today), null);
  assert.equal(childSessionRecord(priorDay, 'sunday', today), null);
  assert.equal(childSessionRecord(undefined, 'sunday', today), null);
  assert.deepEqual(childSessionRecords([record, otherService, priorDay, released], 'sunday', today), [record, released]);
});

test('new safety actions require an existing active service and today in Ghana', () => {
  assert.equal(childSessionActionError(activeService, 'sunday', today, today), null);
  assert.match(childSessionActionError(undefined, 'sunday', today, today), /active service/i);
  assert.match(childSessionActionError({ id: 'wednesday', is_active: true }, 'sunday', today, today), /active service/i);
  assert.match(childSessionActionError({ id: 'sunday', is_active: false }, 'sunday', today, today), /active service/i);
  assert.match(childSessionActionError(activeService, 'sunday', '2026-10-29', today), /today/i);
  assert.match(childSessionActionError(activeService, 'sunday', '2026-10-31', today), /today/i);
  assert.match(childSessionActionError(activeService, 'sunday', '2026-02-30', today), /today/i);
});

test('only active child pickup passes from the selected session can be printed', () => {
  assert.equal(canPrintChildPickupPass(record, 'sunday', today, today), true);
  assert.equal(canPrintChildPickupPass(released, 'sunday', today, today), false);
  assert.equal(canPrintChildPickupPass(otherService, 'sunday', today, today), false);
  assert.equal(canPrintChildPickupPass(priorDay, 'sunday', today, today), false);
  assert.equal(canPrintChildPickupPass(record, 'sunday', today, '2026-10-31'), false);
});
