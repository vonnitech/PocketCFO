-- =============================================================================
-- Migration 004: FIRE strategy config column
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fire_config JSONB;
