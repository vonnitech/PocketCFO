-- Prevent delayed/retried LemonSqueezy events from overwriting newer billing state.
alter table public.profiles
  add column if not exists ls_event_updated_at timestamptz;

-- Keep client sessions from changing the ordering cursor used by the webhook.
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
    return new;
  end if;

  if new.pro_plan is distinct from old.pro_plan
  or new.pro_expires_at is distinct from old.pro_expires_at
  or new.pro_source is distinct from old.pro_source
  or new.ls_customer_id is distinct from old.ls_customer_id
  or new.ls_subscription_id is distinct from old.ls_subscription_id
  or new.stripe_customer_id is distinct from old.stripe_customer_id
  or new.ls_event_updated_at is distinct from old.ls_event_updated_at then
    raise exception 'profiles: billing columns are written by the billing webhook only'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;
