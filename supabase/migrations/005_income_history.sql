-- =============================================================================
-- Migration 005: Income history column
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS income_history JSONB;
