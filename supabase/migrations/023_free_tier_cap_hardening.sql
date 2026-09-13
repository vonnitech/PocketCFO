-- Fix the free-tier cap trigger installed by migration 017.
--
-- A SECURITY DEFINER function runs as its owner, so `current_user` inside the
-- old function resolved to postgres and every caller took the privileged bypass.
-- This replacement applies the cap to every insert. Server/admin work can still
-- change or temporarily disable the trigger explicitly when performing recovery.
--
-- The per-user transaction lock closes the count-then-insert race: concurrent
-- inserts for one account are serialized before the current row count is read.

create or replace function public.enforce_free_tier_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  free_cap   integer := 3;
  active_pro boolean;
  row_count  integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 0)
  );

  select (p.pro_plan is not null
          and (p.pro_expires_at is null or p.pro_expires_at > pg_catalog.now()))
    into active_pro
    from public.profiles p
   where p.id = new.user_id;

  if coalesce(active_pro, false) then
    return new;
  end if;

  if tg_table_name = 'vaults' then
    select count(*) into row_count
      from public.vaults v
     where v.user_id = new.user_id
       and v.deleted is not true;
  elsif tg_table_name = 'subscriptions' then
    select count(*) into row_count
      from public.subscriptions s
     where s.user_id = new.user_id;
  else
    raise exception 'Free-tier cap trigger attached to unexpected table'
      using errcode = 'invalid_parameter_value';
  end if;

  if row_count >= free_cap then
    raise exception 'Free accounts are limited to % %.', free_cap, tg_table_name
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_free_tier_cap() from public;
