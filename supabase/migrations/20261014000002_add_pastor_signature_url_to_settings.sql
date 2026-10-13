-- ==============================================================================
-- Migration: Add pastor_signature_url to settings table
-- Greater Works City Church (GWCC) - ChMS
-- Ensures the church settings table supports custom digital signatures for
-- membership certificates, official receipts, and pastoral care reports.
-- ==============================================================================

ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS pastor_signature_url TEXT DEFAULT '/assets/pastor_signature.svg';

-- Inform PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
