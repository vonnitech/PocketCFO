-- =============================================================================
-- 011_billing_column_guard.sql  —  Stop users writing their own entitlement
-- Run in: Supabase Dashboard → SQL Editor. Safe to re-run.
--
-- The "profiles_own" policy from 009_rls_perf is `for all` over the user's own
-- row, and pro_plan / pro_expires_at live on that row. That let any signed-in
-- user grant themselves Pro with a single PostgREST call:
--
--   supabase.from('profiles').update({ pro_plan: 'lifetime' }).eq('id', me)
--
-- RLS alone cannot express "own row, except these columns", so a BEFORE trigger
-- carries the rule. A trigger is used rather than column-level GRANTs because
-- switching profiles to per-column grants would mean re-granting every future
-- column; here only the protected list needs maintaining.
--
-- The webhook (api/lemonsqueezy-webhook.ts) writes as service_role and passes
-- straight through, as do dashboard and migration sessions.
-- =============================================================================

create or replace function public.profiles_guard_billing_columns()
returns trigger
language plpgsql
-- Deliberately SECURITY INVOKER: current_user must resolve to the *caller's*
-- role for the check below. A definer function would report the owner instead
-- and wave every write through.
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  -- A user creating their own profile never arrives entitled.
  if tg_op = 'INSERT' then
    new.pro_plan           := null;
    new.pro_expires_at     := null;
    new.pro_source         := null;
    new.ls_customer_id     := null;
    new.ls_subscription_id := null;
    new.stripe_customer_id := null;
    return new;
  end if;

  -- Compared with IS DISTINCT FROM so ordinary profile saves, which round-trip
  -- these columns unchanged, are unaffected. Only real edits are rejected.
  if new.pro_plan           is distinct from old.pro_plan
  or new.pro_expires_at     is distinct from old.pro_expires_at
  or new.pro_source         is distinct from old.pro_source
  or new.ls_customer_id     is distinct from old.ls_customer_id
  or new.ls_subscription_id is distinct from old.ls_subscription_id
  or new.stripe_customer_id is distinct from old.stripe_customer_id then
    raise exception 'profiles: billing columns are written by the billing webhook only'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_billing on public.profiles;
create trigger profiles_guard_billing
  before insert or update on public.profiles
  for each row execute function public.profiles_guard_billing_columns();
