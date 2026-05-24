-- =============================================================================
-- POCKET CFO — Phase 1 Migration Schema
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =============================================================================
-- TABLE: profiles
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  liquid_assets     NUMERIC(14, 2) NOT NULL DEFAULT 0,
  next_payday       DATE,
  upcoming_bills    NUMERIC(14, 2) NOT NULL DEFAULT 0,
  hard_daily_cap    NUMERIC(14, 2) NOT NULL DEFAULT 0,

  CONSTRAINT profiles_user_id_unique UNIQUE (user_id)
);


-- =============================================================================
-- TABLE: transactions
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  amount      NUMERIC(14, 2) NOT NULL,
  merchant    TEXT           NOT NULL DEFAULT 'GENERAL',
  category    TEXT           NOT NULL DEFAULT 'OTHER',
  flip_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  date        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_user_date ON public.transactions (user_id, date DESC);


-- =============================================================================
-- TABLE: vaults
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.vaults (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name          TEXT          NOT NULL,
  target        NUMERIC(14,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0
);


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaults      ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles: select own" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "profiles: insert own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles: update own" ON public.profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles: delete own" ON public.profiles FOR DELETE USING (auth.uid() = user_id);

-- transactions
CREATE POLICY "transactions: select own" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transactions: insert own" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions: update own" ON public.transactions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions: delete own" ON public.transactions FOR DELETE USING (auth.uid() = user_id);

-- vaults
CREATE POLICY "vaults: select own" ON public.vaults FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "vaults: insert own" ON public.vaults FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vaults: update own" ON public.vaults FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vaults: delete own" ON public.vaults FOR DELETE USING (auth.uid() = user_id);


-- =============================================================================
-- HELPER: auto-create profile on signup
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
