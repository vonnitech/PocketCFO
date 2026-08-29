-- =============================================================================
-- POCKET CFO — Production Database Schema
-- Run once in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================================

-- UUID helper (required for uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =============================================================================
-- TABLE: profiles
-- One row per authenticated user.
-- NOTE: `id` is the primary key AND the foreign key to auth.users —
--       there is no separate user_id column.
--       RLS uses auth.uid() = id (not user_id).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id                   UUID          NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Horizon math
  liquid_assets        NUMERIC(14,2) NOT NULL DEFAULT 0,
  next_payday          DATE,
  payday_anchor_day    INTEGER CHECK (payday_anchor_day IS NULL OR payday_anchor_day BETWEEN 1 AND 31),
  upcoming_bills       NUMERIC(14,2) NOT NULL DEFAULT 0,
  hard_daily_cap       NUMERIC(14,2) NOT NULL DEFAULT 0,
  monthly_take_home    NUMERIC(14,2) NOT NULL DEFAULT 0,
  fixed_bills          NUMERIC(14,2) NOT NULL DEFAULT 0,
  monthly_savings_goal NUMERIC(14,2) NOT NULL DEFAULT 0,

  -- Extended config (populated progressively)
  fixed_burn           NUMERIC(14,2) NOT NULL DEFAULT 0,
  extra_cash_pool      NUMERIC(14,2) NOT NULL DEFAULT 0,
  rollover_pool        NUMERIC(14,2) NOT NULL DEFAULT 0,
  last_sweep_date      DATE,
  salary_current       NUMERIC(14,2) NOT NULL DEFAULT 0,
  salary_target        NUMERIC(14,2) NOT NULL DEFAULT 0,

  -- Gamification
  stat_level                   INTEGER       NOT NULL DEFAULT 1,
  stat_experience              NUMERIC(14,2) NOT NULL DEFAULT 0,
  stat_flips_executed          INTEGER       NOT NULL DEFAULT 0,
  stat_subscriptions_cancelled INTEGER       NOT NULL DEFAULT 0,
  stat_lifetime_capture        NUMERIC(14,2) NOT NULL DEFAULT 0,

  -- Preferences
  theme               TEXT    NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  privacy_mode        BOOLEAN NOT NULL DEFAULT FALSE,
  theme_primary_color TEXT,
  theme_capture_color TEXT,

  -- Dashboard widget visibility (JSONB array)
  -- Keep in step with DASHBOARD_WIDGETS in src/core/widgets.ts. Migration 013
  -- realigned this after a removed 'momentum' widget lingered here.
  dashboard_widgets JSONB NOT NULL DEFAULT '[
    {"id":"safe-spend","visible":true},
    {"id":"vault-status","visible":true},
    {"id":"alert","visible":true}
  ]'::jsonb,

  -- Onboarding flags
  has_completed_onboarding BOOLEAN NOT NULL DEFAULT FALSE,
  is_configured            BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =============================================================================
-- TABLE: transactions
-- Every dollar movement logged by the app.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  amount      NUMERIC(14,2) NOT NULL,
  merchant    TEXT          NOT NULL DEFAULT 'GENERAL',
  category    TEXT          NOT NULL DEFAULT 'OTHER',
  flip_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_flip     BOOLEAN       NOT NULL DEFAULT FALSE,
  date        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date
  ON public.transactions (user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_category
  ON public.transactions (user_id, category);


-- =============================================================================
-- TABLE: vaults
-- Savings buckets — each with a name, target, and running balance.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.vaults (
  id      UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name    TEXT          NOT NULL,
  target  NUMERIC(14,2) NOT NULL DEFAULT 0,
  current NUMERIC(14,2) NOT NULL DEFAULT 0,
  deleted BOOLEAN       NOT NULL DEFAULT FALSE
);


-- =============================================================================
-- ROW LEVEL SECURITY
-- Each table is locked to the authenticated user's own rows.
-- profiles: condition is auth.uid() = id  (id IS the user's UUID)
-- others:   condition is auth.uid() = user_id
-- =============================================================================

-- ── profiles ──────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: select own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: insert own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: update own"
  ON public.profiles FOR UPDATE
  USING  (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: delete own"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);


-- ── transactions ───────────────────────────────────────────────────────────────
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions: select own"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "transactions: insert own"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions: update own"
  ON public.transactions FOR UPDATE
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions: delete own"
  ON public.transactions FOR DELETE
  USING (auth.uid() = user_id);


-- =============================================================================
-- TABLE: debts
-- Liabilities the user is tracking and paying down.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.debts (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name          TEXT          NOT NULL,
  balance       NUMERIC(14,2) NOT NULL DEFAULT 0,
  interest_rate NUMERIC(5,2)  NOT NULL DEFAULT 0,
  min_payment   NUMERIC(14,2) NOT NULL DEFAULT 0,

  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debts_user ON public.debts (user_id);


-- =============================================================================
-- TABLE: subscriptions
-- Recurring charges the user wants to audit and cancel.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name          TEXT          NOT NULL,
    amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
    usage         TEXT          NOT NULL DEFAULT 'Active'   CHECK (usage IN ('Active', 'Low Use', 'Idle')),
    billing_cycle TEXT          NOT NULL DEFAULT 'Monthly'  CHECK (billing_cycle IN ('Monthly', 'Yearly')),
    next_billing_date DATE,

    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
  );
  
  CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions (user_id);
  CREATE INDEX IF NOT EXISTS idx_subscriptions_user_next_billing ON public.subscriptions (user_id, next_billing_date);


-- ── vaults ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.vaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vaults: select own"
  ON public.vaults FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "vaults: insert own"
  ON public.vaults FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "vaults: update own"
  ON public.vaults FOR UPDATE
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "vaults: delete own"
  ON public.vaults FOR DELETE
  USING (auth.uid() = user_id);


-- ── debts ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "debts: select own"
  ON public.debts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "debts: insert own"
  ON public.debts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "debts: update own"
  ON public.debts FOR UPDATE
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "debts: delete own"
  ON public.debts FOR DELETE
  USING (auth.uid() = user_id);


-- ── subscriptions ──────────────────────────────────────────────────────────────
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions: select own"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "subscriptions: insert own"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "subscriptions: update own"
  ON public.subscriptions FOR UPDATE
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "subscriptions: delete own"
  ON public.subscriptions FOR DELETE
  USING (auth.uid() = user_id);


-- =============================================================================
-- TRIGGER: auto-create profile row on signup
-- Fires after every INSERT on auth.users.
-- Uses ON CONFLICT DO NOTHING so re-runs are safe.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop before recreating so re-runs don't error
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
