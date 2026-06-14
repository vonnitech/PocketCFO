// Official PocketCFO brand lockup: real coin-badge icon + wordmark, perfectly centered.
// The icon (public/icon.svg) is the brand mark — fixed brand colours, so it reads as
// identity and stays consistent in both light and dark themes.
export function BrandLogo() {
  return (
    <div className="flex flex-row items-center gap-2.5 select-none">
      {/* Brand mark — the coin badge, fixed square so it never warps */}
      <img
        src="/icon.svg"
        alt="PocketCFO"
        width={40}
        height={40}
        className="w-10 h-10 shrink-0 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
      />

      {/* Wordmark — single line, never wraps or truncates.
          "Pocket" uses the theme token (flips with the app's .dark class — Tailwind's
          dark: variant won't, since it keys off OS prefers-color-scheme here). */}
      <div className="text-xl font-black tracking-tighter leading-none whitespace-nowrap">
        <span className="text-text-main">Pocket</span>
        <span className="text-yellow-400">CFO</span>
      </div>
    </div>
  );
}
