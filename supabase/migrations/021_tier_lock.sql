-- Spend tier commitment, moved off localStorage.
--
-- The tier multiplier and its lock were stored in localStorage only, which made
-- the commitment device weaker than it looked: clearing browser data ended the
-- lock, and it never followed the user to a second device. A commitment you can
-- void by opening a private window is not one.
--
-- One jsonb column rather than three scalars, matching velocity_config: the
-- shape is read and written as a unit, never queried by field, and the client
-- validates every field on read.

alter table public.profiles
  add column if not exists tier_lock jsonb;

comment on column public.profiles.tier_lock is
  'Spend tier commitment: { tierId, lockedUntil, breakCount }. Null means never configured (defaults to TIGHT, unlocked).';
