// Where someone came from, captured on arrival and kept until they sign up.
//
// A campaign link lands on the site, the person looks around, signs up twenty
// minutes later, and by then the URL parameters are long gone. So they are read
// once on first load and stored, then attached to the funnel events that matter.
//
// First touch wins. If someone arrives from a campaign, leaves, and comes back
// through a different link, the first visit is what earned the signup. Later
// visits do not overwrite it, because the last click before signing up is
// usually the person returning directly, which credits nothing to anything.
//
// These are campaign labels the user was sent with, not facts about them. No
// financial values and nothing personal, which is why they are safe to attach
// to events that are otherwise deliberately thin.

const STORAGE_KEY = 'stackpiggy-attribution-v1';

/** The standard five, and nothing else. Anything unrecognised is ignored. */
export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

type UtmKey = typeof UTM_KEYS[number];

export type Attribution = Partial<Record<UtmKey, string>> & {
  /** Date the first visit landed, so a campaign can be read over time. */
  landedOn?: string;
};

/** Campaign labels are short, and a URL is supplied by whoever sends the link. */
export const MAX_VALUE_LENGTH = 120;

// ── pure ────────────────────────────────────────────────────────────────────

/** Pulls the five recognised parameters out of a query string. No storage. */
export function parseUtm(search: string): Attribution {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return {};
  }
  const found: Attribution = {};
  for (const key of UTM_KEYS) {
    const raw = params.get(key);
    const value = raw ? raw.trim().slice(0, MAX_VALUE_LENGTH) : '';
    if (value) found[key] = value;
  }
  return found;
}

/** Whether a parsed record holds anything worth storing. */
export function hasCampaign(a: Attribution): boolean {
  return UTM_KEYS.some((k) => typeof a[k] === 'string' && a[k] !== '');
}

// ── storage ─────────────────────────────────────────────────────────────────

export function readAttribution(): Attribution {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Attribution = {};
    for (const key of UTM_KEYS) {
      const v = (parsed as Record<string, unknown>)[key];
      if (typeof v === 'string' && v) out[key] = v.slice(0, MAX_VALUE_LENGTH);
    }
    const landed = (parsed as Record<string, unknown>).landedOn;
    if (typeof landed === 'string') out.landedOn = landed;
    return out;
  } catch {
    return {};
  }
}

/**
 * Reads campaign parameters off the current URL and stores them if this is the
 * first time. Safe to call on every load.
 */
export function captureAttribution(): Attribution {
  const existing = readAttribution();
  // First touch wins, so an existing record is never overwritten.
  if (hasCampaign(existing)) return existing;

  const found = parseUtm(window.location.search);
  // Nothing to record. Storing an empty marker would make a later real campaign
  // look like a repeat visit and lose it.
  if (!hasCampaign(found)) return existing;

  found.landedOn = new Date().toISOString().slice(0, 10);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(found));
  } catch {
    // Storage blocked. Attribution is lost for this visit, which is survivable.
  }
  return found;
}

export function clearAttribution(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* nothing to do */ }
}
