-- =============================================================================
-- 014_repair_profiles_billing_columns.sql
-- Repair live databases where some profile migrations were applied out of order.
-- Safe to re-run.
-- =============================================================================

alter table public.profiles
  add column if not exists first_name       text    not null default '',
  add column if not exists recurring_bills  jsonb   not null default '[]'::jsonb,
  add column if not exists paid_bill_keys   jsonb   not null default '[]'::jsonb,
  add column if not exists impulses         jsonb   not null default '[]'::jsonb,
  add column if not exists fire_config      jsonb,
  add column if not exists income_history   jsonb,
  add column if not exists currency         text    not null default 'USD',
  add column if not exists fixed_burn       numeric(14,2) not null default 0,
  add column if not exists fixed_bills      numeric(14,2) not null default 0,
  add column if not exists monthly_take_home numeric(14,2) not null default 0,
  add column if not exists monthly_savings_goal numeric(14,2) not null default 0,
  add column if not exists last_sweep_date  date,
  add column if not exists pro_plan           text,
  add column if not exists pro_expires_at     timestamptz,
  add column if not exists pro_source         text,
  add column if not exists stripe_customer_id text,
  add column if not exists ls_customer_id     text,
  add column if not exists ls_subscription_id text;

alter table public.profiles drop constraint if exists profiles_pro_plan_check;
alter table public.profiles add constraint profiles_pro_plan_check
  check (pro_plan is null or pro_plan in ('monthly', 'annual', 'lifetime'));

alter table public.profiles drop constraint if exists profiles_pro_source_check;
alter table public.profiles add constraint profiles_pro_source_check
  check (pro_source is null or pro_source in ('stripe', 'revenuecat', 'lemonsqueezy'));

create or replace function public.profiles_guard_billing_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.pro_plan           := null;
    new.pro_expires_at     := null;
    new.pro_source         := null;
    new.ls_customer_id     := null;
    new.ls_subscription_id := null;
    new.stripe_customer_id := null;
    return new;
  end if;

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
