-- =============================================================================
-- 009_lemonsqueezy_billing.sql  —  LemonSqueezy billing columns on profiles
-- Run in: Supabase Dashboard → SQL Editor. Safe to re-run.
--
-- The LemonSqueezy webhook (Vercel /api/lemonsqueezy-webhook) writes these via
-- the service role; the app reads pro_plan/pro_expires_at to decide isPro. No
-- RLS change needed (the webhook uses the service role, which bypasses RLS).
--
-- ls_customer_id powers the billing portal (api/portal.ts); ls_subscription_id
-- is kept for future server-side subscription management. The legacy
-- stripe_customer_id column from 008 is left in place, unused.
-- =============================================================================
alter table public.profiles
  add column if not exists ls_customer_id     text,
  add column if not exists ls_subscription_id text;

-- Allow 'lemonsqueezy' as an entitlement source (drop-then-add so re-runnable).
alter table public.profiles drop constraint if exists profiles_pro_source_check;
alter table public.profiles add  constraint profiles_pro_source_check
  check (pro_source is null or pro_source in ('stripe', 'revenuecat', 'lemonsqueezy'));
