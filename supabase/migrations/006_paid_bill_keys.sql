-- =============================================================================
-- Migration 006: paid_bill_keys column on profiles
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================================================
--
-- WHY: the bill queue is now DERIVED as (recurring_bills template − paid keys),
-- with `paid_bill_keys` (an array of "name:amount" strings for bills paid this
-- cycle) as the single, server-persisted source of truth. This makes paid state
-- bulletproof and consistent across every device/browser: paying a bill records
-- its key here; signing in elsewhere derives the identical queue, so paid bills
-- never reappear (and can't be paid — and double-charged — twice).
--
-- Safe to run repeatedly (IF NOT EXISTS).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS paid_bill_keys JSONB NOT NULL DEFAULT '[]'::jsonb;
