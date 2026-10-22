// Colour themes and the free-tier subset, in one module.
//
// These lived inside Settings.tsx, which is why a Pro theme outlived a lapsed
// subscription: the picker gated SELECTING a locked theme, but nothing outside
// that screen knew which colours were Pro, so an already-applied one simply
// stayed. App.tsx now reverts to the default palette when the entitlement
// resolves to free, and it needs these definitions to do it.

export interface ColorTheme {
  id: string;
  name: string;
  primary: string;
  capture: string;
}

export const COLOR_THEMES: ColorTheme[] = [
  // Original
  { id: 'default',           name: 'Original',           primary: '#facc15', capture: '#00CC55' },
  // Pinks — vivid → soft → pale
  { id: 'hot-magenta',       name: 'Hot Magenta',         primary: '#FF006E', capture: '#FFD60A' },
  { id: 'pink-sky',          name: 'Pink & Sky',          primary: '#FF5C9E', capture: '#4BBFD4' },
  { id: 'blush-butter',      name: 'Blush & Butter',      primary: '#E36887', capture: '#F3D98F' },
  { id: 'ballet-cherry',     name: 'Ballet & Cherry',     primary: '#F5A0B8', capture: '#CC1133' },
  { id: 'hibiscus-cola',     name: 'Hibiscus Cola',       primary: '#E0A4B0', capture: '#7C0116' },
  { id: 'bubblegum',         name: 'Sand & Steel',        primary: '#E8C29A', capture: '#57798F' },
  { id: 'sweet-ocean',       name: 'Sweet Ocean',         primary: '#F8C6F2', capture: '#01006C' },
  // Reds
  { id: 'raspberry-lemon',   name: 'Raspberry Lemon',     primary: '#C8154B', capture: '#FFF8B6' },
  { id: 'coral-lemon',       name: 'Coral & Lemon',       primary: '#FF5960', capture: '#FFE783' },
  { id: 'sunny-spark',       name: 'Sunny Spark',         primary: '#DE4818', capture: '#ECDC80' },
  // Oranges
  { id: 'deep-roots',        name: 'Deep Roots',          primary: '#FB884C', capture: '#3A1A0A' },
  { id: 'orange-royal',      name: 'Orange & Royal',      primary: '#FF8800', capture: '#3355CC' },
  { id: 'yam-tide',          name: 'Yam & High Tide',     primary: '#EA9216', capture: '#313841' },
  { id: 'amber-flamingo',    name: 'Amber & Flamingo',    primary: '#FFBF00', capture: '#F0563A' },
  { id: 'chili-flare',       name: 'Chili Flare',         primary: '#FFD9A1', capture: '#BE2717' },
  // Yellows & Golds
  { id: 'saffron-steel',     name: 'Saffron & Steel',     primary: '#E8C547', capture: '#4F7CAC' },
  { id: 'gold-vintage',      name: 'Gold Vintage',        primary: '#A77E16', capture: '#1A2800' },
  { id: 'cherry-blossom',    name: 'Cherry Blossom',      primary: '#FAFFC7', capture: '#F8A8B9' },
  // Olives & Yellow-Greens
  { id: 'olive-foliage',     name: 'Olive & Foliage',     primary: '#D2DB76', capture: '#2D371D' },
  { id: 'matcha-honey',      name: 'Matcha Honey',        primary: '#9CA764', capture: '#F1E8C7' },
  // Greens
  { id: 'lime-royal',        name: 'Lime & Royal',        primary: '#88CC22', capture: '#3355CC' },
  { id: 'avocado-chiffon',   name: 'Avocado & Chocolate', primary: '#568203', capture: '#7B3F00' },
  { id: 'cyprus-jade',       name: 'Cyprus & Jade',       primary: '#004643', capture: '#ABD1C6' },
  // Teals & Cyans
  { id: 'turquoise-teal',    name: 'Turquoise & Teal',    primary: '#22CCBB', capture: '#007799' },
  { id: 'pool-poppy',        name: 'Pool & Poppy',        primary: '#00AACC', capture: '#FF3344' },
  { id: 'sky-kelly',         name: 'Sky & Kelly',         primary: '#4BBFD4', capture: '#2EAA5C' },
  // Blues & Navies
  { id: 'blue-choc',         name: 'Blue & Choc',         primary: '#7CA7EB', capture: '#402924' },
  { id: 'cobalt-butter',     name: 'Cobalt & Butter',     primary: '#0F52BB', capture: '#FFFF9A' },
  { id: 'blue-yellow',       name: 'Blue & Sunshine',     primary: '#4455CC', capture: '#FFD600' },
  { id: 'midnight-ocean',    name: 'Midnight Ocean',      primary: '#122C4F', capture: '#5B88B2' },
  { id: 'deep-mariner',      name: 'Deep Mariner',        primary: '#014770', capture: '#E9E5D2' },
  // Purples
  { id: 'lavender-purple',   name: 'Lavender & Purple',   primary: '#B8A8D8', capture: '#7733BB' },
];

export const DEFAULT_THEME: ColorTheme =
  COLOR_THEMES.find(t => t.id === 'default') ?? COLOR_THEMES[0];

// Free tier: the Original palette plus ONE preset of the account's choosing,
// picked at the end of onboarding (or later in Settings), with FREE_SWAPS
// changes of mind after that. Every other preset and the custom colour studio
// are Pro. The pick is stored on the profile (theme_unlock, migration 025).
export const FREE_SWAPS = 1;

export interface ThemeUnlock {
  /** The one non-default preset this account keeps on the free plan. */
  freeThemeId: string | null;
  /** How many times the pick has been changed. Capped at FREE_SWAPS. */
  swapsUsed: number;
}

export const DEFAULT_THEME_UNLOCK: ThemeUnlock = { freeThemeId: null, swapsUsed: 0 };

const sameHex = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

/**
 * The preset whose colours are applied, or undefined for a custom pair.
 *
 * Either order matches: Settings can flip a pairing so its two accents trade
 * places, and a flipped pairing is still the same pairing. That keeps a free
 * account's own pick free when flipped, and keeps the picker's selection on it.
 * No preset is another one reversed, so this cannot match the wrong one.
 */
export const findPreset = (primary?: string, capture?: string): ColorTheme | undefined =>
  COLOR_THEMES.find(t =>
    (sameHex(t.primary, primary) && sameHex(t.capture, capture))
    || (sameHex(t.primary, capture) && sameHex(t.capture, primary)));

export const themeName = (id: string | null | undefined): string =>
  COLOR_THEMES.find(t => t.id === id)?.name ?? 'Original';

// Read side for the theme_unlock column. Every field is validated because the
// row is client-written.
//
// A missing value means the account has never made a pick through this flow.
// That covers everyone from before it existed: Pink & Sky and Orange & Royal
// used to be free for all, and a lapsed Pro account may still be wearing a Pro
// preset. In each case the preset already applied becomes the pick, so nobody
// loses the colours they are looking at the day this ships.
export const normalizeThemeUnlock = (
  raw: unknown,
  primary?: string,
  capture?: string,
): ThemeUnlock => {
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    const id = typeof r.freeThemeId === 'string'
      && r.freeThemeId !== 'default'
      && COLOR_THEMES.some(t => t.id === r.freeThemeId)
      ? r.freeThemeId
      : null;
    const swaps = Number(r.swapsUsed);
    return {
      freeThemeId: id,
      swapsUsed: Number.isFinite(swaps) ? Math.min(FREE_SWAPS, Math.max(0, Math.floor(swaps))) : 0,
    };
  }
  const applied = findPreset(primary, capture);
  return {
    freeThemeId: applied && applied.id !== 'default' ? applied.id : null,
    swapsUsed: 0,
  };
};

// True when the applied colours are allowed on the free plan: the Original
// palette or this account's own pick. Anything else is a Pro preset or a custom
// colour-studio pair, both of which are Pro-only.
export const isFreeThemeColors = (
  primary?: string,
  capture?: string,
  unlock: ThemeUnlock = DEFAULT_THEME_UNLOCK,
): boolean => {
  // Nothing applied yet means the default palette is in effect.
  if (!primary && !capture) return true;
  const preset = findPreset(primary, capture);
  if (!preset) return false;
  return preset.id === 'default' || preset.id === unlock.freeThemeId;
};

// What happens when someone taps a preset. Kept pure so Settings and
// onboarding apply exactly the same rules.
//
//   apply        - go ahead; `unlock` is the value to store (unchanged unless
//                  this tap made or changed the free pick).
//   confirm_swap - a free account changing its pick while a swap remains. The
//                  UI asks first, then calls again with confirmSwap.
//   locked       - the swap is spent; this preset needs Pro.
export type ThemePickOutcome =
  | { kind: 'apply'; unlock: ThemeUnlock; usedSwap: boolean }
  | { kind: 'confirm_swap'; from: string; to: string }
  | { kind: 'locked' };

export const decideThemePick = (input: {
  themeId: string;
  isPro: boolean;
  unlock: ThemeUnlock;
  confirmSwap?: boolean;
}): ThemePickOutcome => {
  const { themeId, isPro, unlock } = input;
  // Pro choices never touch the free pick, so a lapsed subscriber falls back to
  // whatever they chose while free, not to their last Pro colour.
  if (isPro || themeId === 'default' || themeId === unlock.freeThemeId) {
    return { kind: 'apply', unlock, usedSwap: false };
  }
  if (!unlock.freeThemeId) {
    return { kind: 'apply', unlock: { ...unlock, freeThemeId: themeId }, usedSwap: false };
  }
  if (unlock.swapsUsed >= FREE_SWAPS) return { kind: 'locked' };
  if (!input.confirmSwap) return { kind: 'confirm_swap', from: unlock.freeThemeId, to: themeId };
  return {
    kind: 'apply',
    unlock: { freeThemeId: themeId, swapsUsed: unlock.swapsUsed + 1 },
    usedSwap: true,
  };
};

// Whether an applied theme must be reverted because Pro has ended.
//
// Extracted from the effect in App.tsx so the guard conditions are testable
// rather than buried in a component. Each `false` here is protecting a real
// case:
//   isLoading   - the entitlement has not resolved; stripping now would punish a
//                 paying customer for refreshing the page.
//   isPro       - still subscribed, nothing to do.
//   !dataFresh  - the profile came from the offline snapshot, not the server, so
//                 the colours may be stale; acting on them could revert a theme
//                 the account is still entitled to.
export const shouldRevertProTheme = (input: {
  isPro: boolean;
  isLoading: boolean;
  dataFresh: boolean;
  primary?: string;
  capture?: string;
  unlock?: ThemeUnlock;
}): boolean => {
  if (input.isLoading || input.isPro || !input.dataFresh) return false;
  return !isFreeThemeColors(input.primary, input.capture, input.unlock);
};

// Where a lapsed account lands when its Pro colours are reverted: its own free
// pick if it has one, otherwise Original.
export const fallbackTheme = (unlock: ThemeUnlock): ColorTheme =>
  COLOR_THEMES.find(t => t.id === unlock.freeThemeId) ?? DEFAULT_THEME;
