-- =============================================================================
-- 009_rls_perf.sql  —  Fix Supabase linter performance warnings
-- Run in: Supabase Dashboard → SQL Editor. Safe to re-run (idempotent).
--
-- Fixes two WARN-level lints (no security change — same access, faster):
--   1. auth_rls_initplan: auth.uid() was re-evaluated per row. Wrapping it in
--      (select auth.uid()) makes Postgres evaluate it once per query.
--   2. multiple_permissive_policies: each table had TWO overlapping policies
--      (an old "Users can manage their own X" FOR ALL + newer per-action
--      "X: <action> own"). Collapse to ONE policy per table.
--
-- Result: one consolidated, optimized policy per table, scoped to authenticated.
-- =============================================================================

-- profiles (keyed on id) -------------------------------------------------------
drop policy if exists "profiles: select own"               on public.profiles;
drop policy if exists "profiles: insert own"               on public.profiles;
drop policy if exists "profiles: update own"               on public.profiles;
drop policy if exists "profiles: delete own"               on public.profiles;
drop policy if exists "Users can manage their own profile" on public.profiles;
create policy "profiles_own" on public.profiles
  for all to authenticated
  using  ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- transactions (keyed on user_id) ---------------------------------------------
drop policy if exists "transactions: select own"                on public.transactions;
drop policy if exists "transactions: insert own"                on public.transactions;
drop policy if exists "transactions: update own"                on public.transactions;
drop policy if exists "transactions: delete own"                on public.transactions;
drop policy if exists "Users can manage their own transactions" on public.transactions;
create policy "transactions_own" on public.transactions
  for all to authenticated
  using  ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- vaults ----------------------------------------------------------------------
drop policy if exists "vaults: select own"               on public.vaults;
drop policy if exists "vaults: insert own"               on public.vaults;
drop policy if exists "vaults: update own"               on public.vaults;
drop policy if exists "vaults: delete own"               on public.vaults;
drop policy if exists "Users can manage their own vaults" on public.vaults;
create policy "vaults_own" on public.vaults
  for all to authenticated
  using  ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- debts -----------------------------------------------------------------------
drop policy if exists "debts: select own"               on public.debts;
drop policy if exists "debts: insert own"               on public.debts;
drop policy if exists "debts: update own"               on public.debts;
drop policy if exists "debts: delete own"               on public.debts;
drop policy if exists "Users can manage their own debts" on public.debts;
create policy "debts_own" on public.debts
  for all to authenticated
  using  ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- subscriptions ---------------------------------------------------------------
drop policy if exists "subscriptions: select own"                on public.subscriptions;
drop policy if exists "subscriptions: insert own"                on public.subscriptions;
drop policy if exists "subscriptions: update own"                on public.subscriptions;
drop policy if exists "subscriptions: delete own"                on public.subscriptions;
drop policy if exists "Users can manage their own subscriptions" on public.subscriptions;
create policy "subscriptions_own" on public.subscriptions
  for all to authenticated
  using  ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- recon_history ---------------------------------------------------------------
drop policy if exists "recon_history: select own"                on public.recon_history;
drop policy if exists "recon_history: insert own"                on public.recon_history;
drop policy if exists "recon_history: update own"                on public.recon_history;
drop policy if exists "recon_history: delete own"                on public.recon_history;
drop policy if exists "Users can manage their own recon_history" on public.recon_history;
create policy "recon_history_own" on public.recon_history
  for all to authenticated
  using  ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
