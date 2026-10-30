import test from 'node:test';
import assert from 'node:assert/strict';
import { attendancePassValue, resolveAttendancePass } from '../src/features/attendance/attendancePass.ts';

const member = { id: 'member:one/é', member_id: 'GWCC-2026-0001', first_name: 'Private', last_name: 'Name', email: 'private@example.test', phone: '0240000000', status: 'active', is_archived: false };

test('attendance pass is a stable directory reference without personal contacts or names', () => {
  const value = attendancePassValue(member);
  for (const field of ['first_name', 'last_name', 'email', 'phone', 'member_id']) assert.ok(!value.includes(member[field]));
  assert.equal(resolveAttendancePass(value, [member]).member.id, member.id);
  const renamed = { ...member, member_id: 'GWCC-RENAMED', first_name: 'Changed' };
  assert.equal(attendancePassValue(renamed), value);
  assert.equal(resolveAttendancePass(value, [renamed]).member.first_name, 'Changed');
});

test('legacy passes resolve the exact Member ID and reject partial, contact, name and ambiguous matches', () => {
  assert.equal(resolveAttendancePass(member.member_id, [member]).member.id, member.id);
  for (const value of ['GWCC-2026', member.first_name, member.phone, 'member:one/é']) assert.ok(resolveAttendancePass(value, [member]).error);
  assert.match(resolveAttendancePass(member.member_id, [member, { ...member, id: 'other' }]).error, /more than one/);
  assert.equal(resolveAttendancePass(attendancePassValue(member), [member, { ...member, id: 'other' }]).member.id, member.id);
});

test('archived, deceased, transferred and unconfirmed member records cannot issue or resolve a pass', () => {
  for (const change of [{ is_archived: true }, { status: 'deceased' }, { status: 'transferred' }, { _sync_status: 'pending' }]) {
    const unavailable = { ...member, ...change };
    assert.equal(attendancePassValue(unavailable), null);
    assert.ok(resolveAttendancePass(attendancePassValue(member), [unavailable]).error);
    assert.ok(resolveAttendancePass(member.member_id, [unavailable]).error);
  }
});

test('invalid and unrelated QR payloads never become a member selection', () => {
  for (const value of ['', 'GWCC:MEMBER:2:member', 'GWCC:MEMBER:1:%ZZ', 'GWCC:CHILD:pickup-code', 'https://example.test/?id=GWCC-2026-0001', '{"member_id":"GWCC-2026-0001"}', 'x'.repeat(513), 'GWCC\u0000-2026-0001']) {
    assert.ok(resolveAttendancePass(value, [member]).error);
  }
  assert.equal(attendancePassValue({ ...member, id: '' }), null);
  assert.equal(attendancePassValue({ ...member, id: 'x'.repeat(129) }), null);
});
