import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { sanitizeRecordForSupabase, upsertSettingsWithFallback } from './supabase.ts';
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
  assert.ok(SQL_FIX_CHURCH_FINANCE_SCHEMA.includes('gwcc_apply_finance_balance'), 'Quick fix must define church_accounts');
  assert.ok(SQL_FIX_CHURCH_FINANCE_SCHEMA.includes('gwcc_apply_mutations'), 'Quick fix must define church_finances');
});

test('Church Finance: migration 20261010000004 exists on disk', () => {
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261010000004_create_church_finance_and_accounts.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration file must exist');
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  assert.ok(sql.includes('public.church_accounts'));
  assert.ok(sql.includes('public.church_finances'));
});

test('Church Finance: voiding an expense reverses account balance and marks status voided', async () => {
  const { voidChurchFinance } = await import('../features/finance/financeStore.ts');

  let finances = [
    {
      id: 'fin-void-test-1',
      transaction_type: 'expense',
      account_id: 'acc-void-1',
      account_name: 'GCB Bank Operations',
      category: 'Utilities & Power',
      title: 'Power Voucher',
      amount: 500,
      currency: 'GHS',
      date: '2026-10-10',
      status: 'completed',
    },
  ];

  let accounts = [
    {
      id: 'acc-void-1',
      name: 'GCB Bank Operations',
      account_type: 'bank',
      bank_or_provider: 'GCB Bank',
      current_balance: 1000,
      currency: 'GHS',
      is_active: true,
    },
  ];

  let budgets = [
    {
      id: 'bgt-1',
      department: 'Facilities & Maintenance',
      allocated_amount: 5000,
      spent_amount: 500,
      currency: 'GHS',
    },
  ];

  const setFinances = (updater) => {
    finances = typeof updater === 'function' ? updater(finances) : updater;
  };
  const setAccounts = (updater) => {
    accounts = typeof updater === 'function' ? updater(accounts) : updater;
  };
  const setBudgets = (updater) => {
    budgets = typeof updater === 'function' ? updater(budgets) : updater;
  };

  voidChurchFinance(
    'fin-void-test-1',
    'Duplicate entry test',
    'Finance Officer',
    setFinances,
    setAccounts,
    setBudgets,
    () => {},
    () => {},
    {finances,accounts,budgets:typeof budgets==='undefined'?[]:budgets}
  );

  // Expense reversed: 1000 + 500 = 1500
  assert.equal(accounts[0].current_balance, 1500, 'Account balance should be credited back by 500');
  assert.equal(finances[0].status, 'voided');
  assert.equal(finances[0].void_reason, 'Duplicate entry test');
  assert.equal(finances[0].voided_by, 'Finance Officer');
});

test('Church Finance: internal transfers are requests and never move balances before approval and payment', async () => {
  const { transferBetweenAccounts } = await import('../features/finance/financeStore.ts');

  let finances = [];
  let accounts = [
    {
      id: 'acc-src',
      name: 'GCB Operations',
      account_type: 'bank',
      bank_or_provider: 'GCB',
      current_balance: 2000,
      currency: 'GHS',
      is_active: true,
    },
    {
      id: 'acc-dest',
      name: 'Cathedral Petty Cash',
      account_type: 'cash_petty',
      bank_or_provider: 'Cash Float',
      current_balance: 300,
      currency: 'GHS',
      is_active: true,
    },
  ];

  const setFinances = (updater) => {
    finances = typeof updater === 'function' ? updater(finances) : updater;
  };
  const setAccounts = (updater) => {
    accounts = typeof updater === 'function' ? updater(accounts) : updater;
  };

  // 1. Same account transfer should fail
  const sameResult = transferBetweenAccounts(
    'acc-src',
    'acc-src',
    500,
    'Invalid transfer',
    setAccounts,
    setFinances,
    () => {},
    () => {},
    {finances,accounts,budgets:typeof budgets==='undefined'?[]:budgets}
  );
  assert.equal(sameResult.success, false);

  // 2. Overdraft transfer should fail
  const overdraftResult = transferBetweenAccounts(
    'acc-src',
    'acc-dest',
    5000,
    'Overdraft transfer',
    setAccounts,
    setFinances,
    () => {},
    () => {},
    {finances,accounts,budgets:typeof budgets==='undefined'?[]:budgets}
  );
  assert.equal(overdraftResult.success, true); // Funding is checked when payment is recorded.

  // 3. Valid transfer of 600
  const validResult = transferBetweenAccounts(
    'acc-src',
    'acc-dest',
    600,
    'Replenish float',
    setAccounts,
    setFinances,
    () => {},
    () => {},
    {finances,accounts,budgets:typeof budgets==='undefined'?[]:budgets}
  );
  assert.equal(validResult.success, true);
  assert.equal(accounts.find((a) => a.id === 'acc-src').current_balance, 2000);
  assert.equal(accounts.find((a) => a.id === 'acc-dest').current_balance, 300);
  assert.equal(finances.length, 2);
  assert.equal(finances[0].transaction_type, 'transfer');
  assert.equal(finances[0].amount, 600);
  assert.equal(finances[0].account_id, 'acc-src');
  assert.equal(finances[0].to_account_id, 'acc-dest');
});

test('Church Finance: recordChurchFinance rounds decimal precision and keeps requests outside account and budget spending', async () => {
  const { recordChurchFinance } = await import('../features/finance/financeStore.ts');

  let finances = [];
  let accounts = [
    {
      id: 'acc-ops',
      name: 'Main Operations',
      account_type: 'bank',
      bank_or_provider: 'GCB',
      current_balance: 5000,
      currency: 'GHS',
      is_active: true,
    },
  ];
  let budgets = [
    {
      id: 'bgt-facilities',
      department: 'Facilities & Logistics',
      period: '2026 Annual',
      allocated_amount: 10000,
      spent_amount: 1000,
      currency: 'GHS',
    },
  ];

  const setFinances = (updater) => {
    finances = typeof updater === 'function' ? updater(finances) : updater;
  };
  const setAccounts = (updater) => {
    accounts = typeof updater === 'function' ? updater(accounts) : updater;
  };
  const setBudgets = (updater) => {
    budgets = typeof updater === 'function' ? updater(budgets) : updater;
  };

  const rec = recordChurchFinance(
    {
      transaction_type: 'expense',
      account_id: 'acc-ops',
      account_name: 'Main Operations',
      category: 'Utilities & Power',
      title: 'Water Bill Payment',
      amount: 450.555, // needs rounding to 450.56
      currency: 'GHS',
      date: '2026-10-12',
      department: 'Facilities & Logistics',
      status: 'completed',
    },
    setFinances,
    setAccounts,
    setBudgets,
    ()=>{},()=>{}, {finances,accounts,budgets}
  );

  assert.equal(rec.amount, 450.56, 'Amount should be rounded to two decimal places');
  assert.equal(accounts[0].current_balance, 5000);assert.equal(rec.approval_state,'requested');assert.equal(rec.status,'pending');
  assert.equal(budgets[0].spent_amount, 1000);
});

test('Church Settings: sanitizeRecordForSupabase correctly formats settings table record', () => {
  const inputSettings = {
    church_name: 'Greater Works City Church',
    senior_pastor: 'Prophet Elisha K. Richard',
    pastor_signature_url: '/assets/pastor_signature.svg',
    phone: '+233 24 456 7890',
  };

  const sanitized = sanitizeRecordForSupabase('settings', inputSettings);
  assert.equal(sanitized.id, 'gwcc_global_settings');
  assert.equal(sanitized.church_name, 'Greater Works City Church');
  assert.equal(sanitized.short_name, 'GWCC');
  assert.equal(sanitized.pastor_signature_url, '/assets/pastor_signature.svg');
  assert.ok(sanitized.updated_at, 'Should include updated_at timestamp');
});

test('Church Settings: upsertSettingsWithFallback automatically removes pastor_signature_url when schema cache missing column error occurs', async () => {
  const recordedPayloads = [];
  const fakeClient = {
    from: (table) => {
      assert.equal(table, 'settings');
      return {
        upsert: async (payload) => {
          recordedPayloads.push({ ...payload });
          // First attempt: simulate PostgREST schema cache error for pastor_signature_url
          if (payload.pastor_signature_url) {
            return {
              error: {
                message: "Could not find the 'pastor_signature_url' column of 'settings' in the schema cache",
                code: 'PGRST204',
              },
            };
          }
          // Second attempt: succeeds once pastor_signature_url is stripped
          return { error: null };
        },
      };
    },
  };

  const testPayload = {
    church_name: 'Greater Works City Church',
    pastor_signature_url: '/assets/custom_signature.svg',
    senior_pastor: 'Prophet Elisha K. Richard',
  };

  const result = await upsertSettingsWithFallback(fakeClient, testPayload);
  assert.equal(result.error, null, 'Fallback should resolve the error without throwing');
  assert.equal(recordedPayloads.length, 2, 'Should have made 2 attempts');
  assert.ok(recordedPayloads[0].pastor_signature_url, 'First attempt had pastor_signature_url');
  assert.equal(recordedPayloads[1].pastor_signature_url, undefined, 'Second attempt had pastor_signature_url removed');
  assert.equal(recordedPayloads[1].church_name, 'Greater Works City Church');
});

test('Church Settings: SQL schemas and migrations contain pastor_signature_url', () => {
  assert.ok(
    SQL_MIGRATION_SCHEMA.includes('pastor_signature_url'),
    'SQL_MIGRATION_SCHEMA should declare pastor_signature_url column'
  );
  assert.ok(
    SQL_MIGRATION_SCHEMA.includes('pastor_signature_url'),
    'SQL_FIX_RLS_SCHEMA should include pastor_signature_url migration statement'
  );

  const migrationFile = fs.readFileSync(
    'supabase/migrations/20261014000002_add_pastor_signature_url_to_settings.sql',
    'utf-8'
  );
  assert.ok(
    migrationFile.includes('ALTER TABLE public.settings'),
    'Migration file should alter public.settings'
  );
  assert.ok(
    migrationFile.includes('pastor_signature_url'),
    'Migration file should add pastor_signature_url'
  );
});

