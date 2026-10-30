import assert from 'node:assert/strict';
import test from 'node:test';
import { welfareClaimsCsv, welfareDuesCsv } from '../src/features/welfare/welfareCsv.ts';

test('welfare claims CSV quotes names, comma-separated titles, and embedded newlines exactly once', () => {
  const csv = welfareClaimsCsv([{
    claim_number: 'W-123',
    date_submitted: '2026-10-30',
    member_name: 'Ama, "Sister" Mensah',
    member_phone: '0240000000',
    category: 'bereavement',
    emergency_level: 'urgent',
    title: 'Funeral, care\nurgent',
    amount_requested: 200,
    amount_approved: 125.5,
    status: 'approved',
    disbursement_voucher_no: 'V-007',
  }]);
  assert.ok(csv.startsWith('\uFEFF"Claim ID","Date Submitted"'));
  assert.match(csv, /"Ama, ""Sister"" Mensah"/);
  assert.ok(csv.includes('"Funeral, care\nurgent"'));
  assert.ok(csv.includes('"200.00","125.50"'));
  assert.ok(csv.includes('"V-007"'));
  assert.equal(csv.split('\r\n').length, 2, 'only row delimiters use CRLF');
});

test('welfare exports neutralize leading spreadsheet formulas and preserve valid money values', () => {
  const claims = welfareClaimsCsv([{
    claim_number: 'W-124',
    date_submitted: '2026-10-30',
    member_name: '=HYPERLINK("https://example.test", "Open")',
    category: 'emergency_relief',
    emergency_level: 'normal',
    title: '+SUM(1,2)',
    amount_requested: 20,
    status: 'pending',
  }]);
  assert.ok(claims.includes('"\'=HYPERLINK('));
  assert.ok(claims.includes('"\'+SUM(1,2)"'));
  assert.ok(claims.includes('"20.00","0.00"'));
  const dues = welfareDuesCsv([{
    reference_no: 'R-1',
    date: '2026-10-30',
    member_name: '  @cmd',
    tithe_number: '0012',
    month: '2026-10',
    payment_method: 'cash',
    payment_channel: '',
    amount: 20,
    recorded_by: '-HARMFUL',
  }]);
  assert.ok(dues.includes('"\'  @cmd"'));
  assert.ok(dues.includes('"\'-HARMFUL"'));
  assert.ok(dues.includes('"0012"'), 'preserve tithe numbers with leading zeros');
  assert.ok(dues.includes('"20.00"'));
});

test('welfare exports preserve header-only empty sets', () => {
  assert.equal(welfareClaimsCsv([]).split('\r\n').length, 1);
  assert.equal(welfareDuesCsv([]).split('\r\n').length, 1);
});
