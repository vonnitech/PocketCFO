-- =============================================================================
-- 026: remember which vault a wishlist item became
--
-- "Save for it" on the wishlist creates a vault, but nothing recorded the link,
-- so the vault could not say where it came from and the wishlist filed the item
-- under "Got it", as if it had been bought.
--
-- Nullable, and deliberately NOT a foreign key. The app writes the vault row in
-- the background and links the wishlist item straight away, so a constraint
-- could reject the link if it landed first. An id that no longer matches a
-- vault simply shows no tag. Vaults are soft-deleted (deleted = true), so
-- restoring one brings its wishlist tag back with it.
--
-- The app tolerates this column being absent: reads select *, and the link
-- write falls back to the old state-only update. Run it whenever convenient.
-- =============================================================================

ALTER TABLE public.wishlist_items
  ADD COLUMN IF NOT EXISTS vault_id UUID;

CREATE INDEX IF NOT EXISTS idx_wishlist_items_vault
  ON public.wishlist_items (vault_id)
  WHERE vault_id IS NOT NULL;

COMMENT ON COLUMN public.wishlist_items.vault_id IS
  'The vault created by "Save for it", if any. Lets the vault show "From your wishlist".';
