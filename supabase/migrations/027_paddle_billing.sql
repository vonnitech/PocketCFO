-- =============================================================================
-- 027_paddle_billing.sql  -  Paddle billing columns on profiles
-- Run in: Supabase Dashboard -> SQL Editor. Safe to re-run.
--
-- Paddle replaces LemonSqueezy for new subscribers. The ls_* columns stay so an
-- account that subscribed through LemonSqueezy keeps working until it cancels.
--
-- paddle_customer_id is written by /api/checkout BEFORE the checkout opens, and
-- is how /api/paddle-webhook finds the account an event belongs to. Linking by
-- customer (which only the server can create) rather than by checkout custom
-- data means a checkout opened in someone's name from the browser cannot touch
-- their entitlement.
-- =============================================================================
alter table public.profiles
  add column if not exists paddle_customer_id      text,
  add column if not exists paddle_subscription_id  text,
  add column if not exists paddle_event_updated_at timestamptz;

create unique index if not exists profiles_paddle_customer_id_key
  on public.profiles (paddle_customer_id)
  where paddle_customer_id is not null;

alter table public.profiles drop constraint if exists profiles_pro_source_check;
alter table public.profiles add  constraint profiles_pro_source_check
  check (pro_source is null or pro_source in ('stripe', 'revenuecat', 'lemonsqueezy', 'paddle'));

-- Same guard as 011/022, extended to the Paddle columns: only the billing
-- endpoints (service role) may write them.
create or replace function public.profiles_guard_billing_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.pro_plan := null;
    new.pro_expires_at := null;
    new.pro_source := null;
    new.ls_customer_id := null;
    new.ls_subscription_id := null;
    new.stripe_customer_id := null;
    new.ls_event_updated_at := null;
    new.paddle_customer_id := null;
    new.paddle_subscription_id := null;
    new.paddle_event_updated_at := null;
    return new;
  end if;

  if new.pro_plan is distinct from old.pro_plan
  or new.pro_expires_at is distinct from old.pro_expires_at
  or new.pro_source is distinct from old.pro_source
  or new.ls_customer_id is distinct from old.ls_customer_id
  or new.ls_subscription_id is distinct from old.ls_subscription_id
  or new.stripe_customer_id is distinct from old.stripe_customer_id
  or new.ls_event_updated_at is distinct from old.ls_event_updated_at
  or new.paddle_customer_id is distinct from old.paddle_customer_id
  or new.paddle_subscription_id is distinct from old.paddle_subscription_id
  or new.paddle_event_updated_at is distinct from old.paddle_event_updated_at then
    raise exception 'profiles: billing columns are written by the billing webhook only'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;
