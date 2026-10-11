import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { sanitizeRecordForSupabase } from './supabase.ts';
import {
  SQL_MIGRATION_SCHEMA,
  SQL_FIX_RLS_SCHEMA,
  SQL_FIX_CHURCH_FINANCE_SCHEMA,
} from './supabaseSchema.ts';
import {
  sampleChurchAccounts,
  sampleChurchFinances,
  sampleDepartmentBudgets,
} from './initialData.ts';

test('Church Finance: sample accounts and clean finance state are properly configured', () => {
  assert.ok(sampleChurchAccounts.length >= 3, 'Should have at least 3 sample church accounts');
  const gcbAccount = sampleChurchAccounts.find((a) => a.account_type === 'bank');
  assert.ok(gcbAccount, 'Should have a bank account');
  assert.ok(gcbAccount.current_balance >= 0, 'Bank account should have a valid balance');

  const momoAccount = sampleChurchAccounts.find((a) => a.account_type === 'momo');
  assert.ok(momoAccount, 'Should have an MTN MoMo account');
  assert.ok(momoAccount.bank_or_provider.includes('MTN MoMo'));

  assert.ok(Array.isArray(sampleChurchFinances), 'Should have sample church financial records array');
  assert.ok(Array.isArray(sampleDepartmentBudgets), 'Should have sample department budgets array');
});

test('Church Finance: sanitizeRecordForSupabase handles church_accounts correctly', () => {
  const accountInput = {
    id: 'acc-test-1',
    name: 'Ecobank Church Operations',
    account_type: 'bank',
    bank_or_provider: 'Ecobank Ghana',
    current_balance: 55000,
    currency: 'GHS',
    is_active: true,
  };

  const sanitized = sanitizeRecordForSupabase('church_accounts', accountInput);
  assert.equal(sanitized.id, 'acc-test-1');
  assert.equal(sanitized.name, 'Ecobank Church Operations');
  assert.equal(sanitized.bank_or_provider, 'Ecobank Ghana');
  assert.equal(sanitized.current_balance, 55000);
  assert.equal(sanitized.currency, 'GHS');
  assert.equal(sanitized.is_active, true);
});

test('Church Finance: sanitizeRecordForSupabase handles church_finances correctly', () => {
  const financeInput = {
    id: 'fin-test-1',
    transaction_type: 'expense',
    account_id: 'acc-1',
    account_name: 'GCB Bank - Main Operations Account',
    category: 'Utilities',
    title: 'Electricity ECG Prepaid Top-up',
    recipient_or_vendor: 'Electricity Company of Ghana',
    amount: 1450,
    currency: 'GHS',
    date: '2026-10-05',
    payment_method: 'bank_transfer',
    department: 'Facilities & Logistics',
    status: 'completed',
  };

  const sanitized = sanitizeRecordForSupabase('church_finances', financeInput);
  assert.equal(sanitized.id, 'fin-test-1');
  assert.equal(sanitized.category, 'Utilities');
  assert.equal(sanitized.amount, 1450);
  assert.equal(sanitized.account_id, 'acc-1');
  assert.equal(sanitized.status, 'completed');
});

test('Church Finance: SQL schemas contain dedicated church_accounts and church_finances tables', () => {
  assert.ok(SQL_MIGRATION_SCHEMA.includes('church_accounts'), 'Full migration must include church_accounts');
  assert.ok(SQL_MIGRATION_SCHEMA.includes('church_finances'), 'Full migration must include church_finances');
  assert.ok(SQL_FIX_RLS_SCHEMA.includes('church_accounts'), 'RLS fix must include church_accounts');
  assert.ok(SQL_FIX_RLS_SCHEMA.includes('church_finances'), 'RLS fix must include church_finances');
  assert.ok(SQL_FIX_CHURCH_FINANCE_SCHEMA.includes('CREATE TABLE IF NOT EXISTS public.church_accounts'), 'Quick fix must define church_accounts');
  assert.ok(SQL_FIX_CHURCH_FINANCE_SCHEMA.includes('CREATE TABLE IF NOT EXISTS public.church_finances'), 'Quick fix must define church_finances');
});

test('Church Finance: migration 20261010000004 exists on disk', () => {
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261010000004_create_church_finance_and_accounts.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration file must exist');
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  assert.ok(sql.includes('public.church_accounts'));
  assert.ok(sql.includes('public.church_finances'));
});
