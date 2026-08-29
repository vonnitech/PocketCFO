-- =============================================================================
-- Migration 018: created_at on vaults
-- Run in: Supabase Dashboard -> SQL Editor
-- =============================================================================
--
-- The vaults table had no timestamp, so "the first three vaults" had no stable
-- meaning. Two things needed one:
--
--   1. When Pro lapses on an account holding more than the free cap, the oldest
--      three vaults stay fully usable and the rest become deposit-locked. That
--      rule is only fair if "oldest" is a real, fixed fact rather than whatever
--      order the rows came back in.
--   2. The automatic surplus sweep picks a target vault. It was ordering by name
--      as a stand-in for a stable order; age is the more natural choice.
--
-- Backfill note: every pre-existing row takes the same DEFAULT now() at the
-- moment this runs, because the real creation order was never recorded and
-- cannot be recovered. The client therefore breaks ties on id, so the ordering
-- is deterministic even where the timestamps are identical. Rows created after
-- this migration get genuinely distinct timestamps.
--
-- Nothing is deleted or reordered. Safe to run repeatedly.

alter table public.vaults
  add column if not exists created_at timestamptz not null default now();

-- Matches the client's sort: age first, id as the tiebreaker.
create index if not exists idx_vaults_user_created
  on public.vaults (user_id, created_at, id);

-- Verify: the column exists with a default, and every row has a value.
select
  (select count(*) from public.vaults)                        as total_vaults,
  (select count(*) from public.vaults where created_at is null) as missing_created_at;
