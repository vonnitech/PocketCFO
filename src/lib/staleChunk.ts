// After a deploy, a tab opened on the old version asks for page files that no
// longer exist ("Failed to fetch dynamically imported module"). Reloading picks
// up the new version. The timestamp guard stops a reload loop if the file is
// genuinely missing or the network is down.
const RELOAD_KEY = 'stale-chunk-reloaded-at';
const RELOAD_GAP_MS = 30_000;

const STALE_CHUNK_PATTERN =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return STALE_CHUNK_PATTERN.test(message);
}

/** Reloads once to fetch the new version. Returns false if it already tried recently. */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_GAP_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Without storage there is no loop guard, so leave it to the error screen.
    return false;
  }
  window.location.reload();
  return true;
}
