-- =============================================================================
-- Migration 002: recon_history table + missing profile columns
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================================================

-- ── New profile columns ────────────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name       TEXT    NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS recurring_bills  JSONB   NOT NULL DEFAULT '[]'::jsonb;

-- ── recon_history table ────────────────────────────────────────────────────────
-- Stores each daily log entry so streak and history survive sign-out / refresh.
CREATE TABLE IF NOT EXISTS public.recon_history (
  id              UUID          PRIMARY KEY,
  user_id         UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  date            DATE          NOT NULL,
  raw_spend       NUMERIC(14,2) NOT NULL DEFAULT 0,
  impulse_spend   NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  surplus         NUMERIC(14,2) NOT NULL DEFAULT 0,
  action          TEXT          NOT NULL DEFAULT 'roll' CHECK (action IN ('roll', 'stash')),
  impulse_id      TEXT,
  tier            TEXT          NOT NULL DEFAULT 'TIGHT',
  tier_multiplier NUMERIC(6,4)  NOT NULL DEFAULT 0.75,
  tier_limit      NUMERIC(14,2) NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recon_history_user_date
  ON public.recon_history (user_id, date DESC);

ALTER TABLE public.recon_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recon_history: select own"
  ON public.recon_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "recon_history: insert own"
  ON public.recon_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "recon_history: delete own"
  ON public.recon_history FOR DELETE
  USING (auth.uid() = user_id);
