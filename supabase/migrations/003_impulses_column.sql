-- =============================================================================
-- Migration 003: impulses (habit tracker) column on profiles
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS impulses JSONB NOT NULL DEFAULT '[]'::jsonb;
