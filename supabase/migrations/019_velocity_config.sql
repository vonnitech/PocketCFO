-- Velocity Control Unit: per-user daily pacing and surplus routing.
--
-- Stored as a single jsonb column rather than four scalar columns. The shape is
-- read and written as one object by the client, is never queried by field, and
-- is likely to gain fields; four columns would mean a migration per field for
-- no gain. The client validates every field on read (normalizeVelocityConfig in
-- src/core/velocity.ts), so a null, an older shape, or a hand-edited row all
-- degrade to the FLAT no-op rather than reaching the maths.
--
-- Deliberately NOT added to the billing guard trigger: this is user-owned
-- preference data, not an entitlement, so the normal RLS "own row" policy is
-- the correct level of protection.

alter table public.profiles
  add column if not exists velocity_config jsonb;

comment on column public.profiles.velocity_config is
  'Daily pacing config: { paceModel, weekdayTrim, surplusRouting, sweepTargetVaultId }. Null means FLAT defaults.';

-- Rows predating this column read as null and fall back to defaults client
-- side, so no backfill is required. Left null on purpose so "never configured"
-- stays distinguishable from "explicitly set to flat".
