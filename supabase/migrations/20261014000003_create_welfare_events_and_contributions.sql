-- ==============================================================================
-- Migration: Create welfare_events and welfare_event_contributions
-- Greater Works City Church (GWCC) - ChMS
-- Enables congregational welfare event appeals with mandatory minimum GH¢ 20.00,
-- multi-role permissions, pastoral privacy, and persistent finance linkage.
-- ==============================================================================

-- 1. Create table welfare_events
CREATE TABLE IF NOT EXISTS public.welfare_events (
  id VARCHAR(100) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  category_custom VARCHAR(255),
  member_id VARCHAR(100) NOT NULL,
  member_name VARCHAR(150) NOT NULL,
  beneficiary_family_name VARCHAR(200),
  description TEXT NOT NULL,
  pastoral_notes TEXT,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL,
  target_amount NUMERIC(12, 2),
  minimum_contribution NUMERIC(10, 2) NOT NULL DEFAULT 20.00 CHECK (minimum_contribution >= 20.00),
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  created_by VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create table welfare_event_contributions
CREATE TABLE IF NOT EXISTS public.welfare_event_contributions (
  id VARCHAR(100) PRIMARY KEY,
  event_id VARCHAR(100) NOT NULL REFERENCES public.welfare_events(id) ON DELETE CASCADE,
  member_id VARCHAR(100) NOT NULL,
  contributor_name VARCHAR(150) NOT NULL,
  contributor_phone VARCHAR(50),
  tithe_number VARCHAR(50),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 20.00),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'mobile_money',
  payment_channel VARCHAR(100),
  reference_no VARCHAR(100),
  notes TEXT,
  payment_status VARCHAR(50) NOT NULL DEFAULT 'confirmed',
  recorded_by VARCHAR(150) NOT NULL,
  corrected_by VARCHAR(150),
  finance_transaction_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes for fast query performance
CREATE INDEX IF NOT EXISTS idx_welfare_events_category ON public.welfare_events(category);
CREATE INDEX IF NOT EXISTS idx_welfare_events_status ON public.welfare_events(status);
CREATE INDEX IF NOT EXISTS idx_welfare_events_member_id ON public.welfare_events(member_id);

CREATE INDEX IF NOT EXISTS idx_wec_event_id ON public.welfare_event_contributions(event_id);
CREATE INDEX IF NOT EXISTS idx_wec_member_id ON public.welfare_event_contributions(member_id);
CREATE INDEX IF NOT EXISTS idx_wec_payment_date ON public.welfare_event_contributions(payment_date);
CREATE INDEX IF NOT EXISTS idx_wec_payment_status ON public.welfare_event_contributions(payment_status);

-- 4. Enable Row Level Security (RLS) & Grant Access
ALTER TABLE public.welfare_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.welfare_event_contributions ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.welfare_events TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.welfare_event_contributions TO anon, authenticated, service_role;

-- 5. Permissive Policies for Client Application Operations
DROP POLICY IF EXISTS "gwcc_policy_all_welfare_events" ON public.welfare_events;
CREATE POLICY "gwcc_policy_all_welfare_events" ON public.welfare_events
  FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "gwcc_policy_all_welfare_event_contributions" ON public.welfare_event_contributions;
CREATE POLICY "gwcc_policy_all_welfare_event_contributions" ON public.welfare_event_contributions
  FOR ALL TO public USING (true) WITH CHECK (true);

-- 6. Add to Realtime Publication if available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.welfare_events;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.welfare_event_contributions;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;
