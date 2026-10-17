-- Free-tier colour pick, stored on the account.
--
-- Free accounts get the Original palette plus ONE preset pairing of their
-- choice, with one free swap after that. Every other preset and the custom
-- colour studio are Pro. The pick has to live on the profile rather than in
-- localStorage for the same reason as tier_lock (021): a choice you can reset by
-- clearing browser data, or dodge by signing in on a second device, is not a
-- limit at all.
--
-- One jsonb column, matching tier_lock and velocity_config: it is read and
-- written as a unit, never queried by field, and the client validates every
-- field on read (normalizeThemeUnlock in src/core/themes.ts).

alter table public.profiles
  add column if not exists theme_unlock jsonb;

comment on column public.profiles.theme_unlock is
  'Free-tier colour pick: { freeThemeId, swapsUsed }. Null means no pick yet; the client then treats an already-applied preset as the pick.';
