-- Daily journal and wishlist.
--
-- Both are user-owned personal data rather than entitlements, so the ordinary
-- "own row" RLS policies are the right level of protection and neither is added
-- to the billing guard trigger.
--
-- Stored per row rather than as jsonb on profiles, unlike velocity_config. Both
-- of these are lists that grow without bound and are read by date, so a single
-- document would have to be rewritten in full on every edit and could not be
-- queried by day. The journal in particular is only worth having if you can
-- look back over weeks.

-- =============================================================================
-- TABLE: journal_entries
-- One line a day, with an optional mood and a no-spend marker. At most one row
-- per user per day: writing again on the same day edits that day rather than
-- stacking up entries, which is what makes a weekly recap readable.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- The local calendar day the entry belongs to, as the client sees it. Stored
  -- as DATE rather than a timestamp so a day means the user's day, not UTC's.
  entry_date DATE        NOT NULL,

  note       TEXT,
  -- Three chips, nothing finer. A longer scale invites precision the user does
  -- not have about their own week, and makes the recap harder to phrase.
  mood       TEXT        CHECK (mood IN ('steady', 'stretched', 'broke')),
  no_spend   BOOLEAN     NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT journal_entries_one_per_day UNIQUE (user_id, entry_date)
);

-- The only read pattern: this user's entries, most recent first, usually the
-- last week or month.
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date
  ON public.journal_entries (user_id, entry_date DESC);

COMMENT ON TABLE public.journal_entries IS
  'One optional line per day, with mood and a no-spend marker. Never required, never prompted for twice.';

-- =============================================================================
-- TABLE: wishlist_items
-- Things wanted but not bought. Deliberately holds no link and no image: this
-- is a holding list, not a shopping tool.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.wishlist_items (
  id         UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name       TEXT          NOT NULL,
  amount     NUMERIC(14,2) NOT NULL,
  -- One line on why. Often the most useful part when read back weeks later.
  reason     TEXT,

  added_on   DATE          NOT NULL DEFAULT CURRENT_DATE,
  state      TEXT          NOT NULL DEFAULT 'wanted'
                           CHECK (state IN ('wanted', 'bought', 'dropped')),

  created_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wishlist_items_user_added
  ON public.wishlist_items (user_id, added_on DESC);

COMMENT ON TABLE public.wishlist_items IS
  'Wanted things, priced client side in days of the user''s cleared amount. No totals are stored or computed.';

-- =============================================================================
-- ROW LEVEL SECURITY
-- Same shape as transactions and vaults: a user reaches their own rows only.
-- =============================================================================
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journal_entries: select own"
  ON public.journal_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "journal_entries: insert own"
  ON public.journal_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "journal_entries: update own"
  ON public.journal_entries FOR UPDATE
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "journal_entries: delete own"
  ON public.journal_entries FOR DELETE
  USING (auth.uid() = user_id);


ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wishlist_items: select own"
  ON public.wishlist_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "wishlist_items: insert own"
  ON public.wishlist_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "wishlist_items: update own"
  ON public.wishlist_items FOR UPDATE
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "wishlist_items: delete own"
  ON public.wishlist_items FOR DELETE
  USING (auth.uid() = user_id);
