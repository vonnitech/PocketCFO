-- =============================================================================
-- 008_pro_billing.sql  —  Pro entitlement columns on profiles
-- Run in: Supabase Dashboard → SQL Editor. Safe to re-run.
--
-- The Stripe webhook (Vercel /api/stripe-webhook) writes these via the service
-- role; the app reads pro_plan/pro_expires_at to decide isPro. No RLS change
-- needed (the webhook uses the service role, which bypasses RLS).
-- =============================================================================
alter table public.profiles
  add column if not exists pro_plan           text,
  add column if not exists pro_expires_at     timestamptz,
  add column if not exists pro_source         text,
  add column if not exists stripe_customer_id text;

-- Constrain to known values (drop-then-add so it's re-runnable).
alter table public.profiles drop constraint if exists profiles_pro_plan_check;
alter table public.profiles add  constraint profiles_pro_plan_check
  check (pro_plan is null or pro_plan in ('monthly', 'annual', 'lifetime'));

alter table public.profiles drop constraint if exists profiles_pro_source_check;
alter table public.profiles add  constraint profiles_pro_source_check
  check (pro_source is null or pro_source in ('stripe', 'revenuecat'));
