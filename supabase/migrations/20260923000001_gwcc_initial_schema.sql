-- ==============================================================================
-- GREATER WORKS CITY CHURCH (GWCC) - PRODUCTION SUPABASE DATABASE SCHEMA
-- Location: Joma, Ablekuma Central, Accra, Ghana
-- Currency: Ghana Cedi (GHS / GH₵) | Timezone: Africa/Accra
-- Platform: Greater Works Church Management System (ChMS)
-- ==============================================================================
-- INSTRUCTIONS FOR LIVE DEPLOYMENT:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/<your-project-id>
-- 2. Click "SQL Editor" in the left sidebar
-- 3. Click "New Query", paste this entire script, and click "Run" (▶)
-- 4. In the ChMS app, navigate to Settings -> Supabase Hub, enter your URL and Anon Key
-- 5. Click "Test Connection" and "Push Local Data to Supabase"
-- ==============================================================================

-- 1. POSTGRES EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. AUTOMATION FUNCTIONS & TRIGGERS
-- ==============================================================================

-- 2.1 Automated updated_at Timestamp Function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2.2 Symmetrical Date Joined & Membership Date Sync
CREATE OR REPLACE FUNCTION public.handle_member_date_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.membership_date IS NULL AND NEW.date_joined IS NOT NULL THEN
    NEW.membership_date = NEW.date_joined;
  ELSIF NEW.date_joined IS NULL AND NEW.membership_date IS NOT NULL THEN
    NEW.date_joined = NEW.membership_date;
  ELSIF NEW.membership_date IS NULL AND NEW.date_joined IS NULL THEN
    NEW.membership_date = CURRENT_DATE;
    NEW.date_joined = CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2.3 Automated Pledge Balance Calculation Trigger
CREATE OR REPLACE FUNCTION public.handle_pledge_balance()
RETURNS TRIGGER AS $$
BEGIN
  NEW.balance = GREATEST(0.00, NEW.amount_pledged - NEW.amount_paid);
  IF NEW.balance <= 0.00 THEN
    NEW.status = 'completed';
  ELSIF NEW.amount_paid > 0.00 THEN
    NEW.status = 'partially_paid';
  ELSE
    NEW.status = 'active';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 2.5 DROP LEGACY RESTRICTIVE CHECK AND FOREIGN KEY CONSTRAINTS ON PRE-EXISTING TABLES
-- ==============================================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop check constraints on status/gender/type/enum columns
  FOR r IN (
    SELECT tc.table_name, tc.constraint_name 
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu 
      ON tc.constraint_name = ccu.constraint_name 
      AND tc.constraint_schema = ccu.constraint_schema
    WHERE tc.table_schema = 'public' 
      AND tc.constraint_type = 'CHECK'
      AND ccu.column_name IN ('status', 'gender', 'marital_status', 'role', 'follow_up_status', 'care_type', 'category', 'type', 'channel', 'payment_method')
  ) LOOP
    EXECUTE format('ALTER TABLE IF EXISTS public.%I DROP CONSTRAINT IF EXISTS %I;', r.table_name, r.constraint_name);
  END LOOP;

  -- Drop legacy foreign keys that block offline-first text ID synchronization
  FOR r IN (
    SELECT tc.table_name, tc.constraint_name 
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu 
      ON tc.constraint_name = ccu.constraint_name 
      AND tc.constraint_schema = ccu.constraint_schema
    WHERE tc.table_schema = 'public' 
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name IN ('attendance', 'prayer_requests', 'pastoral_care', 'giving', 'pledges', 'events', 'visitors', 'profiles')
      AND ccu.column_name IN ('member_id', 'service_id', 'ministry_id', 'campaign_id', 'id')
  ) LOOP
    EXECUTE format('ALTER TABLE IF EXISTS public.%I DROP CONSTRAINT IF EXISTS %I;', r.table_name, r.constraint_name);
  END LOOP;
END $$;

-- Explicit drops for known foreign key constraints
ALTER TABLE IF EXISTS public.attendance DROP CONSTRAINT IF EXISTS attendance_member_id_fkey;
ALTER TABLE IF EXISTS public.attendance DROP CONSTRAINT IF EXISTS attendance_service_id_fkey;
ALTER TABLE IF EXISTS public.prayer_requests DROP CONSTRAINT IF EXISTS prayer_requests_member_id_fkey;
ALTER TABLE IF EXISTS public.pastoral_care DROP CONSTRAINT IF EXISTS pastoral_care_member_id_fkey;
ALTER TABLE IF EXISTS public.giving DROP CONSTRAINT IF EXISTS giving_member_id_fkey;
ALTER TABLE IF EXISTS public.pledges DROP CONSTRAINT IF EXISTS pledges_member_id_fkey;
ALTER TABLE IF EXISTS public.events DROP CONSTRAINT IF EXISTS events_ministry_id_fkey;
ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Ensure created_at has DEFAULT NOW() on all tables where created_at is NOT NULL
DO $$
BEGIN
  ALTER TABLE IF EXISTS public.events ALTER COLUMN created_at SET DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE IF EXISTS public.pastoral_care ALTER COLUMN created_at SET DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE IF EXISTS public.prayer_requests ALTER COLUMN created_at SET DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE IF EXISTS public.giving ALTER COLUMN created_at SET DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE IF EXISTS public.expenses ALTER COLUMN created_at SET DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE IF EXISTS public.pledges ALTER COLUMN created_at SET DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE IF EXISTS public.pledge_campaigns ALTER COLUMN created_at SET DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE IF EXISTS public.services ALTER COLUMN created_at SET DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE IF EXISTS public.headcounts ALTER COLUMN created_at SET DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE IF EXISTS public.ministries ALTER COLUMN created_at SET DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE IF EXISTS public.small_groups ALTER COLUMN created_at SET DEFAULT NOW();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ==============================================================================
-- 3. TABLE DEFINITIONS (Idempotent: CREATE TABLE IF NOT EXISTS)
-- ==============================================================================

-- 3.1 CHURCH SETTINGS & BRANDING
CREATE TABLE IF NOT EXISTS public.settings (
  id TEXT PRIMARY KEY DEFAULT 'gwcc_global_settings',
  church_name VARCHAR(200) NOT NULL DEFAULT 'Greater Works City Church',
  branch_name VARCHAR(100) DEFAULT 'Joma Assembly',
  tagline VARCHAR(250) DEFAULT 'Taking Cities and Nations for Christ through the Greater Works',
  short_name VARCHAR(50) NOT NULL DEFAULT 'GWCC',
  logo_url TEXT DEFAULT '/assets/logo.png',
  pastor_signature_url TEXT DEFAULT '/assets/pastor_signature.svg',
  location VARCHAR(200) NOT NULL DEFAULT 'Joma, Accra, Ghana',
  address TEXT DEFAULT 'Main High Street, Adjacent to Joma Market, Joma, Accra',
  gps_address VARCHAR(50) DEFAULT 'GA-183-4921',
  phone VARCHAR(50) DEFAULT '+233 24 456 7890',
  email VARCHAR(100) DEFAULT 'admin@greaterworkscitychurch.org',
  currency VARCHAR(10) DEFAULT 'GHS',
  currency_symbol VARCHAR(10) DEFAULT 'GH₵',
  timezone VARCHAR(50) DEFAULT 'Africa/Accra',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.2 USER PROFILES & ROLES
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  department VARCHAR(100),
  role TEXT NOT NULL DEFAULT 'data_entry',
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent schema migration for existing Supabase installations:
-- If public.profiles pre-existed (e.g. Supabase starter template), ensure all GWCC columns and compatible types exist.
DO $$
DECLARE
  r RECORD;
BEGIN
  -- 1. Drop foreign key constraint on auth.users if present, allowing custom staff IDs
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
      AND table_name = 'profiles' 
      AND constraint_name = 'profiles_id_fkey'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
  END IF;

  -- 2. Drop legacy CHECK constraints on role (e.g. profiles_role_check from starter templates)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
      AND table_name = 'profiles' 
      AND constraint_name = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
  END IF;

  FOR r IN (
    SELECT tc.constraint_name 
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu 
      ON tc.constraint_name = ccu.constraint_name 
      AND tc.constraint_schema = ccu.constraint_schema
    WHERE tc.table_schema = 'public' 
      AND tc.table_name = 'profiles' 
      AND tc.constraint_type = 'CHECK'
      AND ccu.column_name = 'role'
  ) LOOP
    EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
  END LOOP;

  -- 3. Convert id column type from UUID to TEXT if it was created as UUID
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'id' 
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.profiles ALTER COLUMN id TYPE TEXT USING id::text;
    ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
  END IF;

  -- 3. Add all required columns if they do not exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'first_name') THEN
    ALTER TABLE public.profiles ADD COLUMN first_name VARCHAR(100) DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'last_name') THEN
    ALTER TABLE public.profiles ADD COLUMN last_name VARCHAR(100) DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email') THEN
    ALTER TABLE public.profiles ADD COLUMN email VARCHAR(255);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone') THEN
    ALTER TABLE public.profiles ADD COLUMN phone VARCHAR(50);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'department') THEN
    ALTER TABLE public.profiles ADD COLUMN department VARCHAR(100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role') THEN
    ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'data_entry';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_url') THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_active') THEN
    ALTER TABLE public.profiles ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'created_at') THEN
    ALTER TABLE public.profiles ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'updated_at') THEN
    ALTER TABLE public.profiles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- 3.3 MINISTRIES & DEPARTMENTS
CREATE TABLE IF NOT EXISTS public.ministries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  leader_id TEXT,
  leader_name VARCHAR(150),
  assistant_leader_id TEXT,
  assistant_leader_name VARCHAR(150),
  meeting_schedule VARCHAR(150),
  meeting_day VARCHAR(50),
  meeting_time VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent column additions for pre-existing ministries table
ALTER TABLE public.ministries ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.ministries ADD COLUMN IF NOT EXISTS leader_id TEXT;
ALTER TABLE public.ministries ADD COLUMN IF NOT EXISTS leader_name VARCHAR(150);
ALTER TABLE public.ministries ADD COLUMN IF NOT EXISTS assistant_leader_id TEXT;
ALTER TABLE public.ministries ADD COLUMN IF NOT EXISTS assistant_leader_name VARCHAR(150);
ALTER TABLE public.ministries ADD COLUMN IF NOT EXISTS meeting_schedule VARCHAR(150);
ALTER TABLE public.ministries ADD COLUMN IF NOT EXISTS meeting_day VARCHAR(50);
ALTER TABLE public.ministries ADD COLUMN IF NOT EXISTS meeting_time VARCHAR(50);
ALTER TABLE public.ministries ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE public.ministries ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 0;
ALTER TABLE public.ministries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 3.4 SMALL GROUPS (CELL FELLOWSHIPS)
CREATE TABLE IF NOT EXISTS public.small_groups (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR(150) NOT NULL,
  leader_id TEXT,
  leader_name VARCHAR(150),
  leader_phone VARCHAR(50),
  assistant_leader_id TEXT,
  assistant_leader_name VARCHAR(150),
  meeting_location TEXT NOT NULL,
  meeting_address TEXT,
  zone VARCHAR(100),
  meeting_day VARCHAR(50) NOT NULL,
  meeting_time VARCHAR(50) NOT NULL,
  notes TEXT,
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent column additions for pre-existing small_groups table
ALTER TABLE public.small_groups ADD COLUMN IF NOT EXISTS leader_id TEXT;
ALTER TABLE public.small_groups ADD COLUMN IF NOT EXISTS leader_name VARCHAR(150);
ALTER TABLE public.small_groups ADD COLUMN IF NOT EXISTS leader_phone VARCHAR(50);
ALTER TABLE public.small_groups ADD COLUMN IF NOT EXISTS assistant_leader_id TEXT;
ALTER TABLE public.small_groups ADD COLUMN IF NOT EXISTS assistant_leader_name VARCHAR(150);
ALTER TABLE public.small_groups ADD COLUMN IF NOT EXISTS meeting_location TEXT DEFAULT '';
ALTER TABLE public.small_groups ADD COLUMN IF NOT EXISTS meeting_address TEXT;
ALTER TABLE public.small_groups ADD COLUMN IF NOT EXISTS zone VARCHAR(100);
ALTER TABLE public.small_groups ADD COLUMN IF NOT EXISTS meeting_day VARCHAR(50) DEFAULT 'Wednesday';
ALTER TABLE public.small_groups ADD COLUMN IF NOT EXISTS meeting_time VARCHAR(50) DEFAULT '18:00';
ALTER TABLE public.small_groups ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.small_groups ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 0;
ALTER TABLE public.small_groups ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 3.5 MEMBERS TABLE (Full Ecclesiastical, Biodata & Ghanaian Demographic Registry)
CREATE TABLE IF NOT EXISTS public.members (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  member_id VARCHAR(50) UNIQUE NOT NULL, -- e.g. GWCC-000001
  tithe_number VARCHAR(50),             -- e.g. T-1042
  
  -- Personal Information & Biodata
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  last_name VARCHAR(100) NOT NULL,
  gender VARCHAR(20) NOT NULL DEFAULT 'male',
  date_of_birth DATE,
  marital_status VARCHAR(50) DEFAULT 'single',
  nationality VARCHAR(100) DEFAULT 'Ghanaian',
  national_id VARCHAR(50),               -- Ghana Card PIN e.g. GHA-712345678-9
  hometown VARCHAR(150),
  region_of_origin VARCHAR(100) DEFAULT 'Greater Accra',
  
  -- Family & Marital Details
  spouse_name VARCHAR(150),
  spouse_is_member BOOLEAN DEFAULT FALSE,
  wedding_anniversary DATE,
  number_of_children INTEGER DEFAULT 0,
  
  -- Vocation & Education
  occupation VARCHAR(150),
  employer VARCHAR(150),
  education VARCHAR(100),
  
  -- Contact Information & Residence
  phone VARCHAR(50) NOT NULL,
  alternative_phone VARCHAR(50),
  preferred_communication VARCHAR(50) DEFAULT 'whatsapp',
  email VARCHAR(255),
  residential_address TEXT,
  landmark TEXT,                         -- Nearest Landmark / Directions
  city VARCHAR(100) DEFAULT 'Accra',
  region VARCHAR(100) DEFAULT 'Greater Accra',
  gps_address VARCHAR(50),               -- GhanaPost GPS e.g. GA-183-4921
  profile_photo_url TEXT,

  -- Church Membership Life & Dates
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  membership_date DATE DEFAULT CURRENT_DATE, -- Date Joined GWCC (primary)
  date_joined DATE DEFAULT CURRENT_DATE,     -- Date Joined Alias (compatibility)
  first_visit_date DATE,
  right_hand_of_fellowship_date DATE,
  previous_church VARCHAR(200),
  ministry_id TEXT,
  ministry_name VARCHAR(150),
  small_group_id TEXT,
  small_group_name VARCHAR(150),
  leadership_position VARCHAR(150),

  -- Spiritual Milestones & Discipleship Checklist
  salvation_status BOOLEAN DEFAULT TRUE,
  salvation_date DATE,
  baptism_status BOOLEAN DEFAULT FALSE,
  baptism_date DATE,
  baptized_by VARCHAR(150),
  holy_spirit_baptism BOOLEAN DEFAULT FALSE,
  holy_spirit_baptism_date DATE,
  membership_class_completed BOOLEAN DEFAULT FALSE,
  spiritual_gifts TEXT,
  talents_skills TEXT,

  -- Emergency Next-of-Kin Contact
  emergency_name VARCHAR(150),
  emergency_relationship VARCHAR(100),
  emergency_phone VARCHAR(50),
  emergency_alt_phone VARCHAR(50),

  -- Administrative Metadata
  notes TEXT,
  is_archived BOOLEAN DEFAULT FALSE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Drop legacy check constraints on members table (e.g. members_status_check from old schemas)
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_status_check;
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_gender_check;
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_marital_status_check;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tc.constraint_name 
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu 
      ON tc.constraint_name = ccu.constraint_name 
      AND tc.constraint_schema = ccu.constraint_schema
    WHERE tc.table_schema = 'public' 
      AND tc.table_name = 'members' 
      AND tc.constraint_type = 'CHECK'
      AND ccu.column_name IN ('status', 'gender', 'marital_status')
  ) LOOP
    EXECUTE 'ALTER TABLE public.members DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
  END LOOP;
END $$;

-- Idempotent column additions for pre-existing members table
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS tithe_number VARCHAR(50);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS gender VARCHAR(20) DEFAULT 'male';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS marital_status VARCHAR(50) DEFAULT 'single';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS nationality VARCHAR(100) DEFAULT 'Ghanaian';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS national_id VARCHAR(50);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS hometown VARCHAR(150);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS region_of_origin VARCHAR(100) DEFAULT 'Greater Accra';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS spouse_name VARCHAR(150);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS spouse_is_member BOOLEAN DEFAULT FALSE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS wedding_anniversary DATE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS number_of_children INTEGER DEFAULT 0;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS occupation VARCHAR(150);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS employer VARCHAR(150);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS education VARCHAR(100);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS alternative_phone VARCHAR(50);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS preferred_communication VARCHAR(50) DEFAULT 'whatsapp';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS residential_address TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS landmark TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT 'Accra';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS region VARCHAR(100) DEFAULT 'Greater Accra';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS gps_address VARCHAR(50);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS membership_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS date_joined DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS first_visit_date DATE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS right_hand_of_fellowship_date DATE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS previous_church VARCHAR(200);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS ministry_id TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS ministry_name VARCHAR(150);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS small_group_id TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS small_group_name VARCHAR(150);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS leadership_position VARCHAR(150);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS salvation_status BOOLEAN DEFAULT TRUE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS salvation_date DATE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS baptism_status BOOLEAN DEFAULT FALSE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS baptism_date DATE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS baptized_by VARCHAR(150);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS holy_spirit_baptism BOOLEAN DEFAULT FALSE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS holy_spirit_baptism_date DATE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS membership_class_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS spiritual_gifts TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS talents_skills TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS emergency_name VARCHAR(150);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS emergency_relationship VARCHAR(100);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS emergency_phone VARCHAR(50);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS emergency_alt_phone VARCHAR(50);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3.6 VISITORS & GUEST ASSIMILATION
CREATE TABLE IF NOT EXISTS public.visitors (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  full_name VARCHAR(200) NOT NULL,
  gender VARCHAR(20),
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  address TEXT,
  gps_address VARCHAR(50),
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  service_attended VARCHAR(150) NOT NULL,
  invited_by VARCHAR(150),
  how_heard VARCHAR(150),
  prayer_request TEXT,
  follow_up_status VARCHAR(50) NOT NULL DEFAULT 'new',
  assigned_to TEXT,
  assigned_to_name VARCHAR(150),
  converted_to_member_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Drop legacy check constraints on visitors
ALTER TABLE public.visitors DROP CONSTRAINT IF EXISTS visitors_follow_up_status_check;
ALTER TABLE public.visitors DROP CONSTRAINT IF EXISTS visitors_gender_check;

-- Idempotent column additions for pre-existing visitors table
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS gps_address VARCHAR(50);
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS visit_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS service_attended VARCHAR(150) DEFAULT 'Sunday Main Service';
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS invited_by VARCHAR(150);
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS how_heard VARCHAR(150);
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS prayer_request TEXT;
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS follow_up_status VARCHAR(50) DEFAULT 'new';
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS assigned_to_name VARCHAR(150);
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS converted_to_member_id TEXT;
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3.7 WORSHIP SERVICES & ORDER OF SERVICE
CREATE TABLE IF NOT EXISTS public.services (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR(150) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'sunday',
  day_of_week VARCHAR(20) NOT NULL,
  start_time VARCHAR(20) NOT NULL,
  end_time VARCHAR(20) NOT NULL,
  venue VARCHAR(200) DEFAULT 'Main Cathedral Sanctuary, Joma',
  service_leader VARCHAR(150),
  preacher VARCHAR(150),
  worship_leader VARCHAR(150),
  expected_attendance INTEGER DEFAULT 200,
  order_of_service JSONB DEFAULT '[]'::jsonb,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent column additions for pre-existing services table
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS venue VARCHAR(200) DEFAULT 'Main Cathedral Sanctuary, Joma';
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS service_leader VARCHAR(150);
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS preacher VARCHAR(150);
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS worship_leader VARCHAR(150);
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS expected_attendance INTEGER DEFAULT 200;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS order_of_service JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 3.8 SERVICE DUTY ROSTER ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.roster_assignments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  service_id TEXT,
  service_name VARCHAR(150) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  member_id TEXT,
  member_name VARCHAR(150) NOT NULL,
  member_phone VARCHAR(50),
  department VARCHAR(80) NOT NULL DEFAULT 'ushers_protocol',
  role_title VARCHAR(150) NOT NULL,
  report_time VARCHAR(30) NOT NULL DEFAULT '08:00',
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent column additions for pre-existing roster assignments table
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS service_id TEXT;
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS service_name VARCHAR(150);
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS member_id TEXT;
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS member_name VARCHAR(150);
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS member_phone VARCHAR(50);
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS department VARCHAR(80) DEFAULT 'ushers_protocol';
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS role_title VARCHAR(150);
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS report_time VARCHAR(30) DEFAULT '08:00';
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'pending';
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.roster_managers (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.9 ATTENDANCE CHECK-IN LOGS
CREATE TABLE IF NOT EXISTS public.attendance (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  service_id TEXT NOT NULL,
  service_name VARCHAR(150),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  member_id TEXT,
  member_name VARCHAR(150),
  visitor_id TEXT,
  visitor_name VARCHAR(150),
  person_name VARCHAR(150),
  person_type VARCHAR(20) DEFAULT 'member',
  check_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_in_method VARCHAR(50) DEFAULT 'manual',
  status VARCHAR(20) DEFAULT 'present',
  recorded_by TEXT
);

-- 3.9 AUDITORIUM HEADCOUNTS
CREATE TABLE IF NOT EXISTS public.headcounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  service_id TEXT NOT NULL,
  service_name VARCHAR(150),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  men INTEGER DEFAULT 0,
  women INTEGER DEFAULT 0,
  youth INTEGER DEFAULT 0,
  children INTEGER DEFAULT 0,
  visitors INTEGER DEFAULT 0,
  ushers_protocol INTEGER DEFAULT 0,
  online_viewers INTEGER DEFAULT 0,
  total_auditorium INTEGER DEFAULT 0,
  notes TEXT,
  counted_by VARCHAR(150),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.10 FINANCIAL GIVING & TITHES
CREATE TABLE IF NOT EXISTS public.giving (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  member_id TEXT,
  member_name VARCHAR(150),
  donor_name VARCHAR(150),
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(14, 2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'mobile_money',
  payment_channel VARCHAR(50) DEFAULT 'MTN MoMo',
  reference_number VARCHAR(100),
  service_id TEXT,
  service_name VARCHAR(150),
  notes TEXT,
  recorded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.11 PLEDGE CAMPAIGNS (CAPITAL / BUILDING FUNDS)
CREATE TABLE IF NOT EXISTS public.pledge_campaigns (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR(200) NOT NULL,
  target_amount DECIMAL(14, 2) NOT NULL CHECK (target_amount > 0),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.12 MEMBER PLEDGES & COVENANTS
CREATE TABLE IF NOT EXISTS public.pledges (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  campaign_id TEXT,
  campaign_name VARCHAR(200),
  member_id TEXT NOT NULL,
  member_name VARCHAR(150),
  member_phone VARCHAR(50),
  amount_pledged DECIMAL(14, 2) NOT NULL CHECK (amount_pledged > 0),
  amount_paid DECIMAL(14, 2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
  balance DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  start_date DATE DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.13 OPERATIONAL EXPENDITURE & VOUCHERS
CREATE TABLE IF NOT EXISTS public.expenses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  category VARCHAR(100) NOT NULL,
  title VARCHAR(200),
  recipient VARCHAR(150),
  amount DECIMAL(14, 2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  account VARCHAR(100) NOT NULL DEFAULT 'Mobile Money Account',
  payment_method VARCHAR(50) NOT NULL DEFAULT 'mobile_money',
  reference_number VARCHAR(100),
  description TEXT NOT NULL,
  notes TEXT,
  approved_by VARCHAR(150),
  receipt_url TEXT,
  recorded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.14 CHURCH EVENTS & CONFERENCES
CREATE TABLE IF NOT EXISTS public.events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  theme VARCHAR(250),
  theme_scripture VARCHAR(200),
  event_type VARCHAR(50) DEFAULT 'church_service',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time VARCHAR(20) NOT NULL,
  end_time VARCHAR(20) NOT NULL,
  venue VARCHAR(200) DEFAULT 'Main Cathedral Sanctuary, Joma, Accra',
  organizer VARCHAR(150),
  speaker VARCHAR(150),
  ministry_id TEXT,
  ministry_name VARCHAR(150),
  expected_attendance INTEGER,
  budget DECIMAL(14, 2),
  status VARCHAR(30) DEFAULT 'upcoming',
  requires_registration BOOLEAN DEFAULT FALSE,
  registration_count INTEGER DEFAULT 0,
  banner_color VARCHAR(50) DEFAULT 'emerald',
  attendees JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.15 PASTORAL CARE & COUNSELING
CREATE TABLE IF NOT EXISTS public.pastoral_care (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  member_id TEXT NOT NULL,
  member_name VARCHAR(150),
  member_phone VARCHAR(50),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  care_type VARCHAR(100) NOT NULL,
  pastor_name VARCHAR(150),
  assigned_pastor VARCHAR(150) NOT NULL,
  follow_up_date DATE,
  action_items TEXT,
  status VARCHAR(30) DEFAULT 'in_progress',
  notes TEXT NOT NULL,
  is_confidential BOOLEAN DEFAULT TRUE,
  recorded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.16 PRAYER REQUESTS & INTERCESSION
CREATE TABLE IF NOT EXISTS public.prayer_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  member_id TEXT,
  requester_name VARCHAR(150) NOT NULL,
  requester_phone VARCHAR(50),
  category VARCHAR(100) DEFAULT 'Healing',
  request TEXT NOT NULL,
  date_submitted DATE NOT NULL DEFAULT CURRENT_DATE,
  assigned_leader VARCHAR(150),
  status VARCHAR(50) NOT NULL DEFAULT 'new',
  testimony TEXT,
  is_confidential BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.17 BROADCAST COMMUNICATIONS & SMS
CREATE TABLE IF NOT EXISTS public.communications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title VARCHAR(200) NOT NULL,
  channel VARCHAR(50) NOT NULL DEFAULT 'sms',
  recipient_type VARCHAR(50) NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  message TEXT NOT NULL,
  sender_id VARCHAR(50) DEFAULT 'GWCC',
  status VARCHAR(30) DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

-- 3.18 WELFARE CONTRIBUTIONS & RELIEF FUND
CREATE TABLE IF NOT EXISTS public.welfare_contributions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  member_id TEXT NOT NULL,
  member_name VARCHAR(150) NOT NULL,
  tithe_number VARCHAR(50),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  month VARCHAR(7) NOT NULL,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0.00 CHECK (amount >= 0),
  payment_method VARCHAR(50) NOT NULL DEFAULT 'mobile_money',
  payment_channel VARCHAR(100),
  reference_no VARCHAR(100),
  notes TEXT,
  recorded_by VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.welfare_claims (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  claim_number VARCHAR(50) UNIQUE NOT NULL,
  member_id TEXT NOT NULL,
  member_name VARCHAR(150) NOT NULL,
  member_phone VARCHAR(50),
  category VARCHAR(50) NOT NULL CHECK (
    category IN (
      'bereavement',
      'hospital_medical',
      'childbirth_naming',
      'wedding_marriage',
      'education_welfare',
      'emergency_relief'
    )
  ),
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  amount_requested DECIMAL(14,2) NOT NULL DEFAULT 0.00 CHECK (amount_requested >= 0),
  amount_approved DECIMAL(14,2) DEFAULT 0.00 CHECK (amount_approved IS NULL OR amount_approved >= 0),
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'under_review', 'approved', 'disbursed', 'declined')
  ),
  emergency_level VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (
    emergency_level IN ('normal', 'urgent', 'critical')
  ),
  date_submitted DATE NOT NULL DEFAULT CURRENT_DATE,
  date_reviewed DATE,
  reviewed_by VARCHAR(150),
  pastoral_notes TEXT,
  disbursement_date DATE,
  disbursement_method VARCHAR(50),
  disbursement_channel VARCHAR(100),
  disbursement_voucher_no VARCHAR(100),
  supporting_documents TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.19 AUDIT TRAIL LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_name VARCHAR(150) NOT NULL,
  user_role VARCHAR(100),
  action VARCHAR(100) NOT NULL,
  module VARCHAR(100) NOT NULL,
  record_id VARCHAR(100),
  details TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. NON-DESTRUCTIVE COLUMN MIGRATIONS (Safe for existing live databases)
-- ==============================================================================
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS general_secretary VARCHAR(150) DEFAULT 'Tamekloe Clara Gaewornu';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS senior_pastor VARCHAR(150) DEFAULT 'Prophet Elisha K. Richard';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS pastor_signature_url TEXT DEFAULT '/assets/pastor_signature.svg';

ALTER TABLE public.members ADD COLUMN IF NOT EXISTS date_joined DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS national_id VARCHAR(50);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS hometown VARCHAR(150);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS region_of_origin VARCHAR(100) DEFAULT 'Greater Accra';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS landmark TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS spouse_name VARCHAR(150);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS spouse_is_member BOOLEAN DEFAULT FALSE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS wedding_anniversary DATE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS number_of_children INTEGER DEFAULT 0;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS preferred_communication VARCHAR(50) DEFAULT 'whatsapp';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS baptized_by VARCHAR(150);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS salvation_date DATE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS holy_spirit_baptism BOOLEAN DEFAULT FALSE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS holy_spirit_baptism_date DATE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS right_hand_of_fellowship_date DATE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS previous_church VARCHAR(200);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS spiritual_gifts TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS talents_skills TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS ministry_name VARCHAR(150);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS small_group_name VARCHAR(150);

ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS assigned_to_name VARCHAR(150);

ALTER TABLE public.services ADD COLUMN IF NOT EXISTS order_of_service JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS service_leader VARCHAR(150);
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS preacher VARCHAR(150);
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS worship_leader VARCHAR(150);
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS expected_attendance INTEGER DEFAULT 200;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS theme VARCHAR(250);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS theme_scripture VARCHAR(200);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_type VARCHAR(50) DEFAULT 'church_service';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS start_time VARCHAR(20) DEFAULT '09:00';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_time VARCHAR(20) DEFAULT '12:00';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS venue VARCHAR(200) DEFAULT 'Main Cathedral Sanctuary, Joma, Accra';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS organizer VARCHAR(150);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS speaker VARCHAR(150);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ministry_id TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ministry_name VARCHAR(150);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS expected_attendance INTEGER;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS budget DECIMAL(14, 2);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'upcoming';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS requires_registration BOOLEAN DEFAULT FALSE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS registration_count INTEGER DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS banner_color VARCHAR(50) DEFAULT 'emerald';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS attendees JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.pledge_campaigns ADD COLUMN IF NOT EXISTS name VARCHAR(200);
ALTER TABLE public.pledge_campaigns ADD COLUMN IF NOT EXISTS target_amount DECIMAL(14, 2) DEFAULT 0.00;
ALTER TABLE public.pledge_campaigns ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.pledge_campaigns ADD COLUMN IF NOT EXISTS end_date DATE DEFAULT CURRENT_DATE + INTERVAL '365 days';
ALTER TABLE public.pledge_campaigns ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.pledge_campaigns ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.pledge_campaigns ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.pledges ADD COLUMN IF NOT EXISTS campaign_id TEXT;
ALTER TABLE public.pledges ADD COLUMN IF NOT EXISTS campaign_name VARCHAR(200);
ALTER TABLE public.pledges ADD COLUMN IF NOT EXISTS member_id TEXT;
ALTER TABLE public.pledges ADD COLUMN IF NOT EXISTS member_name VARCHAR(150);
ALTER TABLE public.pledges ADD COLUMN IF NOT EXISTS member_phone VARCHAR(50);
ALTER TABLE public.pledges ADD COLUMN IF NOT EXISTS amount_pledged DECIMAL(14, 2) DEFAULT 0.00;
ALTER TABLE public.pledges ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(14, 2) DEFAULT 0.00;
ALTER TABLE public.pledges ADD COLUMN IF NOT EXISTS balance DECIMAL(14, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.pledges ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.pledges ADD COLUMN IF NOT EXISTS due_date DATE DEFAULT CURRENT_DATE + INTERVAL '90 days';
ALTER TABLE public.pledges ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
ALTER TABLE public.pledges ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.pledges ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.pledges ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.giving ADD COLUMN IF NOT EXISTS member_id TEXT;
ALTER TABLE public.giving ADD COLUMN IF NOT EXISTS member_name VARCHAR(150);
ALTER TABLE public.giving ADD COLUMN IF NOT EXISTS donor_name VARCHAR(150);
ALTER TABLE public.giving ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'tithe';
ALTER TABLE public.giving ADD COLUMN IF NOT EXISTS amount DECIMAL(14, 2) DEFAULT 0.00;
ALTER TABLE public.giving ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'GHS';
ALTER TABLE public.giving ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.giving ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'mobile_money';
ALTER TABLE public.giving ADD COLUMN IF NOT EXISTS payment_channel VARCHAR(50) DEFAULT 'MTN MoMo';
ALTER TABLE public.giving ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100);
ALTER TABLE public.giving ADD COLUMN IF NOT EXISTS service_id TEXT;
ALTER TABLE public.giving ADD COLUMN IF NOT EXISTS service_name VARCHAR(150);
ALTER TABLE public.giving ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.giving ADD COLUMN IF NOT EXISTS recorded_by TEXT;
ALTER TABLE public.giving ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'Operational';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS title VARCHAR(200);
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS recipient VARCHAR(150);
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS amount DECIMAL(14, 2) DEFAULT 0.00;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'GHS';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS account VARCHAR(100) DEFAULT 'Mobile Money Account';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'mobile_money';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100);
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS approved_by VARCHAR(150);
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS recorded_by TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.pastoral_care ADD COLUMN IF NOT EXISTS member_id TEXT;
ALTER TABLE public.pastoral_care ADD COLUMN IF NOT EXISTS member_name VARCHAR(150);
ALTER TABLE public.pastoral_care ADD COLUMN IF NOT EXISTS member_phone VARCHAR(50);
ALTER TABLE public.pastoral_care ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.pastoral_care ADD COLUMN IF NOT EXISTS care_type VARCHAR(100) DEFAULT 'Visitation';
ALTER TABLE public.pastoral_care ADD COLUMN IF NOT EXISTS pastor_name VARCHAR(150);
ALTER TABLE public.pastoral_care ADD COLUMN IF NOT EXISTS assigned_pastor VARCHAR(150) DEFAULT 'Pastor';
ALTER TABLE public.pastoral_care ADD COLUMN IF NOT EXISTS follow_up_date DATE;
ALTER TABLE public.pastoral_care ADD COLUMN IF NOT EXISTS action_items TEXT;
ALTER TABLE public.pastoral_care ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'in_progress';
ALTER TABLE public.pastoral_care ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE public.pastoral_care ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN DEFAULT TRUE;
ALTER TABLE public.pastoral_care ADD COLUMN IF NOT EXISTS recorded_by TEXT;
ALTER TABLE public.pastoral_care ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.pastoral_care ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.prayer_requests ADD COLUMN IF NOT EXISTS member_id TEXT;
ALTER TABLE public.prayer_requests ADD COLUMN IF NOT EXISTS requester_name VARCHAR(150) DEFAULT '';
ALTER TABLE public.prayer_requests ADD COLUMN IF NOT EXISTS requester_phone VARCHAR(50);
ALTER TABLE public.prayer_requests ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'Healing';
ALTER TABLE public.prayer_requests ADD COLUMN IF NOT EXISTS request TEXT DEFAULT '';
ALTER TABLE public.prayer_requests ADD COLUMN IF NOT EXISTS date_submitted DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.prayer_requests ADD COLUMN IF NOT EXISTS assigned_leader VARCHAR(150);
ALTER TABLE public.prayer_requests ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'new';
ALTER TABLE public.prayer_requests ADD COLUMN IF NOT EXISTS testimony TEXT;
ALTER TABLE public.prayer_requests ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN DEFAULT FALSE;
ALTER TABLE public.prayer_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.prayer_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS service_name VARCHAR(150);
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS member_id TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS member_name VARCHAR(150);
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS visitor_id TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS visitor_name VARCHAR(150);
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS person_name VARCHAR(150);
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS person_type VARCHAR(20) DEFAULT 'member';
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_in_method VARCHAR(50) DEFAULT 'manual';
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'present';
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS recorded_by TEXT;

ALTER TABLE public.headcounts ADD COLUMN IF NOT EXISTS counted_by VARCHAR(150);
ALTER TABLE public.headcounts ADD COLUMN IF NOT EXISTS ushers_protocol INTEGER DEFAULT 0;
ALTER TABLE public.headcounts ADD COLUMN IF NOT EXISTS online_viewers INTEGER DEFAULT 0;
ALTER TABLE public.headcounts ADD COLUMN IF NOT EXISTS total_auditorium INTEGER DEFAULT 0;
ALTER TABLE public.headcounts ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS title VARCHAR(200) DEFAULT '';
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS channel VARCHAR(50) DEFAULT 'sms';
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS recipient_type VARCHAR(50) DEFAULT 'all';
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS recipient_count INTEGER DEFAULT 0;
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS message TEXT DEFAULT '';
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS sender_id VARCHAR(50) DEFAULT 'GWCC';
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'sent';
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS created_by TEXT;

ALTER TABLE public.welfare_contributions ADD COLUMN IF NOT EXISTS member_id TEXT;
ALTER TABLE public.welfare_contributions ADD COLUMN IF NOT EXISTS member_name VARCHAR(150) DEFAULT '';
ALTER TABLE public.welfare_contributions ADD COLUMN IF NOT EXISTS tithe_number VARCHAR(50);
ALTER TABLE public.welfare_contributions ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.welfare_contributions ADD COLUMN IF NOT EXISTS month VARCHAR(7) DEFAULT TO_CHAR(CURRENT_DATE, 'YYYY-MM');
ALTER TABLE public.welfare_contributions ADD COLUMN IF NOT EXISTS amount DECIMAL(14,2) DEFAULT 0.00;
ALTER TABLE public.welfare_contributions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'mobile_money';
ALTER TABLE public.welfare_contributions ADD COLUMN IF NOT EXISTS payment_channel VARCHAR(100);
ALTER TABLE public.welfare_contributions ADD COLUMN IF NOT EXISTS reference_no VARCHAR(100);
ALTER TABLE public.welfare_contributions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.welfare_contributions ADD COLUMN IF NOT EXISTS recorded_by VARCHAR(150) DEFAULT '';
ALTER TABLE public.welfare_contributions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS claim_number VARCHAR(50);
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS member_id TEXT;
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS member_name VARCHAR(150) DEFAULT '';
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS member_phone VARCHAR(50);
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'emergency_relief';
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS title VARCHAR(200) DEFAULT '';
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS amount_requested DECIMAL(14,2) DEFAULT 0.00;
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS amount_approved DECIMAL(14,2) DEFAULT 0.00;
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'pending';
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS emergency_level VARCHAR(20) DEFAULT 'normal';
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS date_submitted DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS date_reviewed DATE;
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(150);
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS pastoral_notes TEXT;
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS disbursement_date DATE;
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS disbursement_method VARCHAR(50);
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS disbursement_channel VARCHAR(100);
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS disbursement_voucher_no VARCHAR(100);
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS supporting_documents TEXT;
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.welfare_claims ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_name VARCHAR(150) DEFAULT '';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_role VARCHAR(100);
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action VARCHAR(100) DEFAULT '';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS module VARCHAR(100) DEFAULT '';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS record_id VARCHAR(100);
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS branch_name VARCHAR(100) DEFAULT 'Joma Assembly';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS tagline VARCHAR(250) DEFAULT 'Taking Cities and Nations for Christ through the Greater Works';

-- ==============================================================================
-- 5. HIGH PERFORMANCE DATABASE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_members_member_id ON public.members(member_id);
CREATE INDEX IF NOT EXISTS idx_members_tithe_number ON public.members(tithe_number);
CREATE INDEX IF NOT EXISTS idx_members_phone ON public.members(phone);
CREATE INDEX IF NOT EXISTS idx_members_status ON public.members(status);
CREATE INDEX IF NOT EXISTS idx_members_date_joined ON public.members(date_joined);
CREATE INDEX IF NOT EXISTS idx_members_membership_date ON public.members(membership_date);
CREATE INDEX IF NOT EXISTS idx_members_national_id ON public.members(national_id);
CREATE INDEX IF NOT EXISTS idx_members_ministry_id ON public.members(ministry_id);
CREATE INDEX IF NOT EXISTS idx_members_small_group_id ON public.members(small_group_id);
CREATE INDEX IF NOT EXISTS idx_members_archived ON public.members(is_archived);

CREATE INDEX IF NOT EXISTS idx_visitors_phone ON public.visitors(phone);
CREATE INDEX IF NOT EXISTS idx_visitors_visit_date ON public.visitors(visit_date);
CREATE INDEX IF NOT EXISTS idx_visitors_follow_up_status ON public.visitors(follow_up_status);

CREATE INDEX IF NOT EXISTS idx_attendance_service_date ON public.attendance(service_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_member_id ON public.attendance(member_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);

CREATE INDEX IF NOT EXISTS idx_headcounts_service_date ON public.headcounts(service_id, date);

CREATE INDEX IF NOT EXISTS idx_giving_member_id ON public.giving(member_id);
CREATE INDEX IF NOT EXISTS idx_giving_date ON public.giving(date);
CREATE INDEX IF NOT EXISTS idx_giving_category ON public.giving(category);
CREATE INDEX IF NOT EXISTS idx_giving_payment_method ON public.giving(payment_method);

CREATE INDEX IF NOT EXISTS idx_pledges_campaign_id ON public.pledges(campaign_id);
CREATE INDEX IF NOT EXISTS idx_pledges_member_id ON public.pledges(member_id);
CREATE INDEX IF NOT EXISTS idx_pledges_status ON public.pledges(status);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);

CREATE INDEX IF NOT EXISTS idx_pastoral_member_id ON public.pastoral_care(member_id);
CREATE INDEX IF NOT EXISTS idx_pastoral_date ON public.pastoral_care(date);

CREATE INDEX IF NOT EXISTS idx_prayer_date ON public.prayer_requests(date_submitted);
CREATE INDEX IF NOT EXISTS idx_prayer_status ON public.prayer_requests(status);

CREATE INDEX IF NOT EXISTS idx_welfare_contributions_member_id ON public.welfare_contributions(member_id);
CREATE INDEX IF NOT EXISTS idx_welfare_contributions_month ON public.welfare_contributions(month);
CREATE INDEX IF NOT EXISTS idx_welfare_claims_member_id ON public.welfare_claims(member_id);
CREATE INDEX IF NOT EXISTS idx_welfare_claims_status ON public.welfare_claims(status);
CREATE INDEX IF NOT EXISTS idx_welfare_claims_category ON public.welfare_claims(category);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_module ON public.audit_logs(module);

-- ==============================================================================
-- 6. TRIGGERS ATTACHMENTS
-- ==============================================================================

-- 6.1 Updated_at triggers
DROP TRIGGER IF EXISTS trg_members_updated_at ON public.members;
CREATE TRIGGER trg_members_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_members_date_sync ON public.members;
CREATE TRIGGER trg_members_date_sync
  BEFORE INSERT OR UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.handle_member_date_sync();

DROP TRIGGER IF EXISTS trg_visitors_updated_at ON public.visitors;
CREATE TRIGGER trg_visitors_updated_at
  BEFORE UPDATE ON public.visitors
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_pledges_updated_at ON public.pledges;
CREATE TRIGGER trg_pledges_updated_at
  BEFORE UPDATE ON public.pledges
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_pledges_balance ON public.pledges;
CREATE TRIGGER trg_pledges_balance
  BEFORE INSERT OR UPDATE ON public.pledges
  FOR EACH ROW EXECUTE FUNCTION public.handle_pledge_balance();

DROP TRIGGER IF EXISTS trg_pastoral_care_updated_at ON public.pastoral_care;
CREATE TRIGGER trg_pastoral_care_updated_at
  BEFORE UPDATE ON public.pastoral_care
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_prayer_requests_updated_at ON public.prayer_requests;
CREATE TRIGGER trg_prayer_requests_updated_at
  BEFORE UPDATE ON public.prayer_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_settings_updated_at ON public.settings;
CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES & SCHEMA PERMISSIONS
-- ==============================================================================
-- Grant API access on schema public to anon and authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ministries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.small_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.headcounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giving ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pledge_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pledges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pastoral_care ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.welfare_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.welfare_claims ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'settings', 'profiles', 'ministries', 'small_groups', 'members',
    'visitors', 'services', 'attendance', 'headcounts', 'giving',
    'pledge_campaigns', 'pledges', 'expenses', 'events', 'pastoral_care',
    'prayer_requests', 'communications', 'audit_logs',
    'welfare_contributions', 'welfare_claims'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('DROP POLICY IF EXISTS "gwcc_policy_all_%s" ON public.%I;', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "gwcc_policy_select_%s" ON public.%I;', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "gwcc_policy_write_%s" ON public.%I;', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "Allow all for anon" ON public.%I;', t);
      EXECUTE format('DROP POLICY IF EXISTS "Enable read access for all users" ON public.%I;', t);
      EXECUTE format('DROP POLICY IF EXISTS "Enable insert for all users" ON public.%I;', t);
      EXECUTE format('CREATE POLICY "gwcc_policy_all_%s" ON public.%I FOR ALL TO public USING (true) WITH CHECK (true);', t, t);
    END IF;
  END LOOP;
END
$$;

CREATE INDEX IF NOT EXISTS idx_roster_assignments_member_date
  ON public.roster_assignments (member_id, date);

ALTER TABLE public.roster_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_managers ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.roster_assignments TO authenticated, anon;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_roster_manager()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.roster_managers
    WHERE user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_roster_manager() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_roster_manager() TO authenticated;

CREATE OR REPLACE FUNCTION public.can_read_roster_assignment(assignment_member_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members AS member
    JOIN auth.users AS auth_user
      ON LOWER(BTRIM(COALESCE(member.email, ''))) = LOWER(BTRIM(COALESCE(auth_user.email, '')))
    WHERE (member.id = assignment_member_id OR member.member_id = assignment_member_id)
      AND auth_user.id = auth.uid()
      AND auth_user.email_confirmed_at IS NOT NULL
      AND COALESCE(auth_user.email, '') <> ''
  );
$$;

REVOKE ALL ON FUNCTION public.can_read_roster_assignment(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_roster_assignment(TEXT) TO authenticated;

DO $$
DECLARE
  existing_policy RECORD;
BEGIN
  FOR existing_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'roster_assignments'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.roster_assignments', existing_policy.policyname);
  END LOOP;
END
$$;

CREATE POLICY roster_assignments_manager_all
  ON public.roster_assignments
  FOR ALL
  TO authenticated
  USING (public.is_roster_manager())
  WITH CHECK (public.is_roster_manager());

CREATE POLICY roster_assignments_member_read
  ON public.roster_assignments
  FOR SELECT
  TO authenticated
  USING (public.can_read_roster_assignment(member_id));

CREATE POLICY roster_assignments_anon_all
  ON public.roster_assignments
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- 8. SUPABASE REALTIME REPLICATION (For live multi-device updates)
-- ==============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.members, public.giving, public.attendance, public.visitors, public.services, public.roster_assignments, public.pledges, public.welfare_contributions, public.welfare_claims;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END
$$;

-- ==============================================================================
-- 9. SUPABASE STORAGE BUCKET (Media, Avatars & Member Photos)
-- ==============================================================================
-- Keep storage private by default. If a public image or media asset is required,
-- add a specific policy for that object path instead of opening the whole bucket.
INSERT INTO storage.buckets (id, name, public)
VALUES ('gwcc-media', 'gwcc-media', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  DROP POLICY IF EXISTS "gwcc_storage_authenticated_read" ON storage.objects;
  CREATE POLICY "gwcc_storage_authenticated_read" ON storage.objects
    FOR SELECT TO authenticated, service_role USING (bucket_id = 'gwcc-media');

  DROP POLICY IF EXISTS "gwcc_storage_authenticated_insert" ON storage.objects;
  CREATE POLICY "gwcc_storage_authenticated_insert" ON storage.objects
    FOR INSERT TO authenticated, service_role WITH CHECK (bucket_id = 'gwcc-media');

  DROP POLICY IF EXISTS "gwcc_storage_authenticated_update" ON storage.objects;
  CREATE POLICY "gwcc_storage_authenticated_update" ON storage.objects
    FOR UPDATE TO authenticated, service_role USING (bucket_id = 'gwcc-media');
EXCEPTION
  WHEN undefined_table THEN NULL;
END
$$;

-- ==============================================================================
-- 10. REAL-TIME ANALYTICS VIEWS
-- ==============================================================================
CREATE OR REPLACE VIEW public.v_church_dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM public.members WHERE is_archived = FALSE) AS total_members,
  (SELECT COUNT(*) FROM public.members WHERE status = 'active' AND is_archived = FALSE) AS active_members,
  (SELECT COUNT(*) FROM public.visitors) AS total_visitors,
  (SELECT COALESCE(SUM(amount), 0.00) FROM public.giving WHERE date >= DATE_TRUNC('month', CURRENT_DATE)) AS monthly_giving,
  (SELECT COALESCE(SUM(amount), 0.00) FROM public.expenses WHERE date >= DATE_TRUNC('month', CURRENT_DATE)) AS monthly_expenses,
  (SELECT COALESCE(SUM(amount_pledged - amount_paid), 0.00) FROM public.pledges WHERE status != 'completed') AS outstanding_pledges,
  (SELECT COUNT(*) FROM public.small_groups) AS total_small_groups,
  (SELECT COUNT(*) FROM public.ministries WHERE status = 'active') AS active_ministries;

-- ==============================================================================
-- Production databases start empty. Demo data is never inserted by migrations.
