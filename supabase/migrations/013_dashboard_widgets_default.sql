-- =============================================================================
-- Migration 013: realign the dashboard_widgets column default
-- Run in: Supabase Dashboard -> SQL Editor
-- =============================================================================
--
-- The column default seeded every new profile with four widgets, one of them a
-- 'momentum' card that was removed from the UI in 811b294. Nothing renders it and
-- nothing can toggle it, so new accounts were being created with a preference for
-- a widget that does not exist.
--
-- The canonical list now lives in src/core/widgets.ts (DASHBOARD_WIDGETS). This
-- is the one copy that cannot import it, so it is asserted here instead.
--
-- Scope: the DEFAULT only applies to rows inserted without an explicit value, so
-- this changes nothing for existing profiles. A stale 'momentum' entry on an
-- existing row is inert: both visibility lookups resolve by id and never read an
-- id they do not know about. Existing rows are deliberately left alone rather
-- than rewritten, so no real user preference can be clobbered by this migration.
--
-- Safe to run repeatedly.

ALTER TABLE public.profiles
  ALTER COLUMN dashboard_widgets SET DEFAULT '[
    {"id":"safe-spend","visible":true},
    {"id":"vault-status","visible":true},
    {"id":"alert","visible":true}
  ]'::jsonb;

-- Verify: should report the three-widget default with no 'momentum' entry.
SELECT column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'profiles'
  AND column_name  = 'dashboard_widgets';
