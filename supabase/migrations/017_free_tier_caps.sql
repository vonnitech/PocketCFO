-- =============================================================================
-- Migration 017: enforce the free-tier vault and subscription caps in the database
-- Run in: Supabase Dashboard -> SQL Editor
-- =============================================================================
--
-- The caps existed only in the client, and only on one button each. On the Vaults
-- page the lock sat on the "Create New Vault" toggle's onClick, while the
-- per-group "+ Add" button called openCreate() directly and walked straight past
-- it, so a free account could create vaults without limit. That specific hole is
-- now closed in the UI and again in the store's addVault, but a client-side cap is
-- advisory by definition: anyone with devtools or the anon key can insert rows
-- directly. This is the copy that actually holds.
--
-- Mirrors the entitlement rule in src/lib/pro.ts: a plan is active when pro_plan
-- is set AND pro_expires_at is null or still in the future.
--
-- Deliberately BEFORE INSERT only. Existing rows are never touched, so an account
-- already over the cap keeps everything it has and is simply blocked from adding
-- more. Nothing is deleted by this migration.
--
-- service_role, postgres and supabase_admin bypass the check, matching the
-- billing-column guard in 014, so webhooks and dashboard work are unaffected.
--
-- Safe to run repeatedly.

create or replace function public.enforce_free_tier_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  free_cap   integer := 3;
  active_pro boolean;
  row_count  integer;
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  select (p.pro_plan is not null
          and (p.pro_expires_at is null or p.pro_expires_at > now()))
    into active_pro
    from public.profiles p
   where p.id = new.user_id;

  if coalesce(active_pro, false) then
    return new;
  end if;

  if tg_table_name = 'vaults' then
    -- Soft-deleted vaults sit in the trash and do not occupy a slot, matching
    -- what the Vaults page counts.
    select count(*) into row_count
      from public.vaults v
     where v.user_id = new.user_id
       and v.deleted is not true;
  else
    select count(*) into row_count
      from public.subscriptions s
     where s.user_id = new.user_id;
  end if;

  if row_count >= free_cap then
    raise exception 'Free accounts are limited to % %. Upgrade to Pro to add more.',
      free_cap, tg_table_name
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists vaults_free_tier_cap on public.vaults;
create trigger vaults_free_tier_cap
  before insert on public.vaults
  for each row execute function public.enforce_free_tier_cap();

drop trigger if exists subscriptions_free_tier_cap on public.subscriptions;
create trigger subscriptions_free_tier_cap
  before insert on public.subscriptions
  for each row execute function public.enforce_free_tier_cap();

-- Verify: both triggers should be listed.
select event_object_table as table_name, trigger_name
from information_schema.triggers
where trigger_name in ('vaults_free_tier_cap', 'subscriptions_free_tier_cap')
order by 1;
