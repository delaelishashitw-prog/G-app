import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeRecordForSupabase } from './supabase.ts';
import { SQL_MIGRATION_SCHEMA, SQL_FIX_RLS_SCHEMA, SQL_FIX_WELFARE_SCHEMA } from './supabaseSchema.ts';

test('sanitizes welfare contribution and claim records for Supabase persistence', () => {
  const contribution = sanitizeRecordForSupabase('welfare_contributions', {
    id: 'wlf-123',
    member_id: 'MEM-001',
    member_name: 'Jane Doe',
    date: '2025-06-30',
    month: '2025-06',
    amount: '120.50',
    payment_method: 'mobile_money',
    payment_channel: 'MTN MoMo',
    recorded_by: 'Pastor A',
  });

  assert.equal(contribution.amount, 120.5);
  assert.equal(contribution.date, '2025-06-30');
  assert.equal(contribution.month, '2025-06');
  assert.equal(contribution.member_id, 'MEM-001');

  // Ensure fallback when member_id is blank
  const blankMemberContribution = sanitizeRecordForSupabase('welfare_contributions', {
    id: 'wlf-999',
    member_id: '',
    member_name: 'Anonymous Donor',
    amount: 50,
  });
  assert.equal(blankMemberContribution.member_id, 'wlf-999');

  const claim = sanitizeRecordForSupabase('welfare_claims', {
    id: 'claim-456',
    member_id: 'MEM-002',
    member_name: 'John Smith',
    category: 'emergency_relief',
    title: 'School fees',
    description: 'School fees for the term',
    amount_requested: '850.00',
    status: 'pending',
    emergency_level: 'urgent',
    date_submitted: '2025-07-01',
  });

  assert.equal(claim.amount_requested, 850);
  assert.equal(claim.date_submitted, '2025-07-01');
  assert.equal(claim.status, 'pending');
  assert.ok(claim.claim_number.startsWith('BEN-'));
});

test('SQL schema scripts include full welfare tables and RLS permissions', () => {
  assert.ok(SQL_MIGRATION_SCHEMA.includes('welfare_contributions'));
  assert.ok(SQL_MIGRATION_SCHEMA.includes('welfare_claims'));
  assert.ok(SQL_MIGRATION_SCHEMA.includes('ALTER TABLE public.welfare_contributions ENABLE ROW LEVEL SECURITY;'));
  assert.ok(SQL_MIGRATION_SCHEMA.includes('ALTER TABLE public.welfare_claims ENABLE ROW LEVEL SECURITY;'));

  assert.ok(SQL_FIX_RLS_SCHEMA.includes('welfare_contributions'));
  assert.ok(SQL_FIX_RLS_SCHEMA.includes('welfare_claims'));

  assert.ok(SQL_FIX_WELFARE_SCHEMA.includes('CREATE POLICY "gwcc_policy_all_welfare_contributions"'));
  assert.ok(SQL_FIX_WELFARE_SCHEMA.includes('CREATE POLICY "gwcc_policy_all_welfare_claims"'));
});

test('Elisha Richard has super_admin role and unrestricted permissions', async () => {
  const { sampleUsers } = await import('./initialData.ts');
  const { isElishaRichard, ROLE_PERMISSIONS } = await import('../contexts/AuthContext.tsx');

  const elisha = sampleUsers.find((u) => u.first_name === 'Elisha' && u.last_name === 'Richard');
  assert.ok(elisha, 'Elisha Richard must exist in sampleUsers');
  assert.equal(elisha.role, 'super_admin', 'Elisha Richard must have role super_admin');

  // Verify helper recognition
  assert.ok(isElishaRichard(elisha));
  assert.ok(isElishaRichard(null, 'prophet@greaterworkscitychurch.org'));
  assert.ok(isElishaRichard(null, 'delaelishashitw@gmail.com'));
  assert.ok(isElishaRichard({ first_name: 'Elisha', last_name: 'Richard' }));

  // Verify super_admin has all core modules
  const superAdminModules = ROLE_PERMISSIONS.super_admin;
  assert.ok(superAdminModules.includes('users'));
  assert.ok(superAdminModules.includes('settings'));
  assert.ok(superAdminModules.includes('audit_logs'));
  assert.ok(superAdminModules.includes('finance'));
  assert.ok(superAdminModules.includes('members'));
});


