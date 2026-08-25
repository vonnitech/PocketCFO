-- =============================================================================
-- 012_rls_enable_guard.sql  —  Assert RLS is actually ON, not just policied
-- Run in: Supabase Dashboard → SQL Editor. Safe to re-run (idempotent).
--
-- 009_rls_perf.sql creates one policy per table, but a policy on a table whose
-- RLS is disabled is INERT: Postgres never consults it and every authenticated
-- caller reads every row. The enable statement lived only in supabase_schema.sql
-- (profiles, transactions, vaults) and 002 (recon_history). `debts` and
-- `subscriptions` were created through the dashboard, so nothing in this repo
-- ever asserted it for them — their protection rested on the table editor's
-- default having been left alone, which is not something the repo could prove.
--
-- Unguessable UUID primary keys do NOT substitute for this. They change how an
-- attacker discovers a row id, not whether the database hands the row over.
--
-- Note on FORCE ROW LEVEL SECURITY: deliberately not used. It would subject the
-- table owner to policies too, which mainly means Dashboard/SQL-editor sessions
-- (running as postgres) silently returning zero rows and looking like data loss.
-- service_role holds BYPASSRLS either way, so the billing webhook is unaffected
-- by that choice.
-- =============================================================================

-- Refuse to enable RLS on a table that has no policy yet. Enabling it there
-- would deny every read and write instead of scoping them, turning a silent
-- exposure into a silent outage.
do $$
declare
  t     text;
  tbls  text[] := array['profiles','transactions','vaults','debts','subscriptions','recon_history'];
  n     int;
begin
  foreach t in array tbls loop
    if to_regclass('public.' || t) is null then
      raise exception '012: table public.% does not exist. Run the earlier migrations first.', t;
    end if;

    select count(*) into n
      from pg_policies
     where schemaname = 'public' and tablename = t;

    if n = 0 then
      raise exception
        '012: public.% has no RLS policies. Enabling RLS now would deny all access. Run 009_rls_perf.sql first.', t;
    end if;
  end loop;
end $$;

alter table public.profiles      enable row level security;
alter table public.transactions  enable row level security;
alter table public.vaults        enable row level security;
alter table public.debts         enable row level security;
alter table public.subscriptions enable row level security;
alter table public.recon_history enable row level security;

-- Prove the migration did what it claims rather than trusting the ALTERs.
do $$
declare
  bad text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into bad
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public'
     and c.relkind = 'r'
     and c.relname in ('profiles','transactions','vaults','debts','subscriptions','recon_history')
     and c.relrowsecurity = false;

  if bad is not null then
    raise exception '012: RLS still disabled on: %', bad;
  end if;

  raise notice '012: RLS enabled and policied on all 6 tables.';
end $$;

-- Final state, for the record.
select c.relname                as table_name,
       c.relrowsecurity         as rls_enabled,
       count(p.policyname)      as policies
  from pg_class c
  join pg_namespace ns on ns.oid = c.relnamespace
  left join pg_policies p on p.schemaname = 'public' and p.tablename = c.relname
 where ns.nspname = 'public'
   and c.relkind = 'r'
   and c.relname in ('profiles','transactions','vaults','debts','subscriptions','recon_history')
 group by c.relname, c.relrowsecurity
 order by c.relname;
