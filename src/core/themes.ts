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

// Free tier: 3 preset themes (Original + 2). All other presets and the custom
// colour studio are Pro. Change which two accompany 'default' here.
export const FREE_THEME_IDS = new Set(['default', 'pink-sky', 'orange-royal']);

export const DEFAULT_THEME: ColorTheme =
  COLOR_THEMES.find(t => t.id === 'default') ?? COLOR_THEMES[0];

// True when the applied colours are one of the free presets. Anything else is a
// Pro preset or a custom colour-studio pair, both of which are Pro-only.
export const isFreeThemeColors = (
  primary?: string,
  capture?: string,
): boolean => {
  // Nothing applied yet means the default palette is in effect.
  if (!primary && !capture) return true;
  return COLOR_THEMES.some(
    t => FREE_THEME_IDS.has(t.id) && t.primary === primary && t.capture === capture,
  );
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
}): boolean => {
  if (input.isLoading || input.isPro || !input.dataFresh) return false;
  return !isFreeThemeColors(input.primary, input.capture);
};
