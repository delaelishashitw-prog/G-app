-- ==============================================================================
-- GREATER WORKS CITY CHURCH (GWCC) - MIGRATION 20261010000004
-- DEDICATED CHURCH ACCOUNTS AND CHURCH FINANCES TABLES
-- ==============================================================================

-- 1. Create church_accounts table
CREATE TABLE IF NOT EXISTS public.church_accounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR(150) NOT NULL,
  account_type VARCHAR(50) NOT NULL DEFAULT 'bank', -- 'bank', 'momo', 'cash_petty', 'treasury'
  account_number VARCHAR(100),
  bank_or_provider VARCHAR(150) NOT NULL DEFAULT 'GCB Bank',
  current_balance DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create church_finances table
CREATE TABLE IF NOT EXISTS public.church_finances (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  transaction_type VARCHAR(50) NOT NULL DEFAULT 'expense', -- 'expense', 'disbursement', 'transfer', 'income', 'grant'
  account_id TEXT,
  account_name VARCHAR(150) NOT NULL DEFAULT 'Main Operating Account',
  category VARCHAR(100) NOT NULL DEFAULT 'Operations',
  title VARCHAR(200) NOT NULL,
  recipient_or_vendor VARCHAR(150),
  amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'bank_transfer',
  reference_no VARCHAR(100),
  department VARCHAR(100),
  budget_id TEXT,
  description TEXT,
  notes TEXT,
  approved_by VARCHAR(150),
  receipt_url TEXT,
  recorded_by VARCHAR(150),
  status VARCHAR(30) NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes for fast filtering and reporting
CREATE INDEX IF NOT EXISTS idx_church_accounts_type ON public.church_accounts (account_type);
CREATE INDEX IF NOT EXISTS idx_church_finances_date ON public.church_finances (date);
CREATE INDEX IF NOT EXISTS idx_church_finances_category ON public.church_finances (category);
CREATE INDEX IF NOT EXISTS idx_church_finances_department ON public.church_finances (department);
CREATE INDEX IF NOT EXISTS idx_church_finances_account_id ON public.church_finances (account_id);

-- 4. Enable Row Level Security
ALTER TABLE public.church_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_finances ENABLE ROW LEVEL SECURITY;

-- 5. Drop any prior policies
DROP POLICY IF EXISTS "gwcc_policy_all_church_accounts" ON public.church_accounts;
DROP POLICY IF EXISTS "gwcc_policy_all_church_finances" ON public.church_finances;

-- 6. Open church staff policies
CREATE POLICY "gwcc_policy_all_church_accounts" ON public.church_accounts
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "gwcc_policy_all_church_finances" ON public.church_finances
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 7. Grant access to anon, authenticated, and service_role
GRANT ALL ON TABLE public.church_accounts TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.church_finances TO anon, authenticated, service_role;
