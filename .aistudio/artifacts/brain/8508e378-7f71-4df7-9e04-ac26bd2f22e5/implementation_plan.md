# Implementation Plan: Separate Member Giving & Dedicated Church Finance

Separate the existing combined Finance page into two purpose-built, dedicated pages: **Member Giving** (congregational stewardship, tithes, offerings, receipts, member giving statements) and **Church Finance** (institutional church operating expenses, bank and MoMo accounts, department/project budgets, payment vouchers, and cash reconciliation). Add dedicated `church_accounts` and `church_finances` PostgreSQL tables in Supabase with full RLS and real-time synchronization.

---

## 1. User Alignment & Clarified Decisions

Based on the clarifying questions:
1. **Sidebar & Route Structure**: Two separate top-level pages in the sidebar:
   - **Member Giving** (`/giving` and legacy `/finance` alias)
   - **Church Finance** (`/church-finance`)
2. **Dedicated Church Finance Scope**:
   - Church operational expenses & vendor disbursements
   - Church bank & Mobile Money (MoMo) accounts (`church_accounts`) with real-time balance tracking
   - Department and capital project budgets (`department_budgets`)
   - Sunday Cash Counting Sheet & Official Payment Vouchers
3. **Database & Supabase Structure**:
   - Dedicated `public.church_accounts` and `public.church_finances` tables in Supabase with RLS policies, automated column migrations, and 2-way cloud synchronization.

---

## 2. Architecture & Data Model

### A. Supabase Database Schema

#### 1. `public.church_accounts` Table
Tracks institutional church holding accounts:
```sql
CREATE TABLE IF NOT EXISTS public.church_accounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR(150) NOT NULL,
  account_type VARCHAR(50) NOT NULL DEFAULT 'bank', -- 'bank', 'momo', 'cash_petty', 'treasury'
  account_number VARCHAR(100),
  bank_or_provider VARCHAR(150) NOT NULL DEFAULT 'GCB Bank', -- 'GCB Bank', 'MTN MoMo', 'Ecobank', 'Cash on Hand'
  current_balance DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### 2. `public.church_finances` Table
Tracks all institutional church disbursements, operating expenses, transfers, and incoming project funds:
```sql
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
```

#### 3. Row-Level Security & Migration
- Create migration `supabase/migrations/20261010000004_create_church_finance_and_accounts.sql`.
- Update `SQL_MIGRATION_SCHEMA`, `SQL_FIX_RLS_SCHEMA`, and `SQL_CHECK_TABLES` in `src/lib/supabaseSchema.ts`.
- Grant schema privileges to `anon`, `authenticated`, and `service_role` with open church management policies (`gwcc_policy_all_church_accounts` and `gwcc_policy_all_church_finances`).

---

## 3. Component & State Implementation Steps

### Step 1: Types & Data Interfaces (`src/types/database.types.ts`)
- Define `ChurchAccount`:
  - `id`, `name`, `account_type`, `account_number`, `bank_or_provider`, `current_balance`, `currency`, `is_active`, `description`, `created_at`, `updated_at`.
- Define `ChurchFinanceRecord`:
  - `id`, `transaction_type`, `account_id`, `account_name`, `category`, `title`, `recipient_or_vendor`, `amount`, `currency`, `date`, `payment_method`, `reference_no`, `department`, `budget_id`, `description`, `notes`, `approved_by`, `receipt_url`, `recorded_by`, `status`, `created_at`, `updated_at`.
- Keep existing `GivingRecord`, `GivingCategory`, and `DepartmentBudget`.

### Step 2: Initial Data & Seed Records (`src/lib/initialData.ts`)
- Seed `sampleChurchAccounts`:
  - `GCB Bank - Main Operations Account` (GH₵ 48,500.00)
  - `MTN MoMo - Church Merchant Account` (GH₵ 12,850.00)
  - `CalBank - Sanctuary Building Project Fund` (GH₵ 85,000.00)
  - `Cathedral Petty Cash & Vestry Float` (GH₵ 2,400.00)
- Seed `sampleChurchFinances`:
  - Sound equipment maintenance, generator fuel, guest preacher honorarium, electricity bill, municipal sanitation levy, communion elements.

### Step 3: Context & Synchronization (`src/contexts/ChurchDataContext.tsx` & `src/lib/supabase.ts`)
- Add `churchAccounts` and `churchFinances` states in `ChurchDataContext`.
- Add CRUD methods:
  - `addChurchAccount`, `updateChurchAccount`, `deleteChurchAccount`.
  - `recordChurchFinance`, `updateChurchFinance`, `deleteChurchFinance`.
  - `transferBetweenAccounts(fromId, toId, amount, notes)`.
- Connect to `localStorage` caching with `saveToStorage`.
- Add sanitizers `sanitizeRecordForSupabase('church_accounts', ...)` and `sanitizeRecordForSupabase('church_finances', ...)`.
- Add to `pushToSupabase` and `pullFromSupabase` sync pipelines.

### Step 4: Sidebar & Route Updates (`src/components/Sidebar.tsx` & `src/App.tsx`)
- In `src/components/Sidebar.tsx` under **Financial Stewardship**:
  1. **Member Giving** (path: `/giving`, icon: `Coins`, module: `finance`)
  2. **Church Finance** (path: `/church-finance`, icon: `Landmark`, module: `finance`)
  3. **Welfare & Relief** (path: `/welfare`, icon: `HeartHandshake`)
  4. **Pledges** (path: `/pledges`, icon: `HandHeart`)
- In `src/App.tsx`:
  - Add `/giving` route pointing to `GivingPage`.
  - Keep `/finance` route redirecting or rendering `GivingPage` for backwards compatibility.
  - Add `/church-finance` route pointing to `ChurchFinancePage`.

### Step 5: Dedicated Member Giving Page (`src/pages/GivingPage.tsx`)
Refactor the giving portion of `FinancePage.tsx` into a streamlined **Member Giving** hub:
1. **Header & Date Filter**: Quick date presets (`Today`, `This Sunday`, `This Month`, `Year-to-Date`, `Custom`).
2. **KPI Highlights**:
   - Total Member Giving for selected period.
   - Tithe contributions with active tither count.
   - General Offerings & First Fruits.
   - Average giving per active family.
3. **Core Tabs**:
   - **Giving Ledger**: Filterable table by category (Tithe, Offering, Seed, Thanksgiving, etc.), payment channel (MTN MoMo, Telecel, Cash, Bank Transfer), and member search.
   - **Tither Directory & Records**: Member tithe frequency, envelope numbers (e.g. `T-1001`), and consecutive faithfulness indicators.
   - **Sunday Service Breakdown**: Giving grouped by specific church service programs.
4. **Member Action Modals**:
   - Record Member Giving (single entry).
   - Batch Sunday Giving Entry (rapid table entry).
   - Print Official Member Giving Receipt.
   - Generate Individual Member Annual/Monthly Giving Statement (PDF).

### Step 6: Dedicated Church Finance Page (`src/pages/ChurchFinancePage.tsx`)
Build the institutional **Church Finance** hub:
1. **Institutional Treasury Overview**:
   - Total Available Liquidity across all accounts.
   - Monthly Operational Burn / Total Expenditures.
   - Department Budget Burn Rate & Variance.
   - Net Operating Surplus / Deficit.
2. **Church Holding Accounts Panel**:
   - Visual account cards for GCB Bank, MTN MoMo Merchant, CalBank Building Fund, and Petty Cash.
   - Account detail, account number, current balance in GH₵.
   - Quick action to "Add Account" or "Internal Transfer" between accounts.
3. **Institutional Expenditure & Finance Ledger**:
   - Transactions filterable by account, expense category, department, and date range.
   - Columns: Date, Reference/Voucher No, Title/Item, Recipient/Vendor, Account, Category, Department, Amount, Payment Method, Status, Actions.
4. **Department & Project Budgets**:
   - Department budget allocations vs. spent amounts with percentage progress bars.
   - Add/edit budget allocations for Sound & Media, Protocol, Children's Ministry, Facilities, etc.
5. **Cash Reconciliation & Sunday Counter**:
   - Integrated Sunday Cash Counter Sheet for cash notes (GH₵ 200, 100, 50, etc.) with usher verification and lead counters.
6. **Payment Voucher Generator**:
   - Official Church Payment Voucher modal with budget authorization, approvals, and PDF export.

---

## 4. Verification & Testing Plan

1. **Unit Tests**:
   - Update `src/lib/supabaseWelfareSync.test.js` or create `src/lib/churchFinanceSync.test.js` to verify:
     - Sanitization of `church_accounts` and `church_finances`.
     - Schema definitions and RLS policies for `church_accounts` and `church_finances`.
   - Run `npm test` to verify all 26+ tests pass.
2. **Type Safety & Build**:
   - Run `npm run lint` (`tsc --noEmit`) to verify 0 type errors.
   - Run `compile_applet` to confirm the production Vite build succeeds.
3. **User Flow & Usability Verification**:
   - Verify sidebar navigation switches cleanly between **Member Giving** and **Church Finance**.
   - Verify recording a member tithe on `/giving` updates giving totals and does not pollute institutional expenses.
   - Verify recording an institutional expenditure on `/church-finance` deducts from the selected holding account (e.g., GCB or MoMo).
   - Verify internal transfers between church accounts update balances correctly.
   - Verify Supabase schema export script in Settings includes both new tables.
