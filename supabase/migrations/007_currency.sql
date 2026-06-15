-- =============================================================================
-- Migration 007: currency column on profiles
-- Run in: Supabase Dashboard -> SQL Editor
-- =============================================================================
--
-- Per-user display currency (ISO 4217 code, e.g. USD, EUR, GBP). Display only,
-- no FX conversion. Defaults to USD. Safe to run repeatedly (IF NOT EXISTS).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';
