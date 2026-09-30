import { ArrowLeft, Home } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function NotFound() {
  const { pathname } = useLocation();

  return (
    <section className="min-h-[calc(100vh-8rem)] flex items-center justify-center py-4">
      <div className="w-full max-w-xl bg-surface border-4 border-border rounded-[2rem] shadow-[8px_8px_0px_0px_var(--shadow-color)] overflow-hidden">
        {/* The numerals carry the page. A dotted field behind them gives the
            block some weight without adding another competing element. */}
        <div className="dot-bg border-b-4 border-border px-6 py-7 sm:py-9 text-center">
          <span className="inline-flex px-3 py-1 mb-4 bg-action-primary border-2 border-black rounded-full font-mono text-[10px] font-black uppercase tracking-widest text-black">
            Error 404
          </span>
          <p className="font-black italic leading-none tracking-tighter text-[4.5rem] sm:text-[6.5rem] text-action-primary [text-shadow:5px_5px_0_var(--border-primary)]">
            404
          </p>
        </div>

        <div className="px-6 py-7 sm:px-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-black italic uppercase tracking-tight text-text-main">
            Page not found
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm font-bold leading-relaxed text-text-muted">
            This address may be incorrect, or the page may have moved.
          </p>

          {/* Showing the path that failed turns a dead end into something the
              person can actually check or correct. */}
          <div className="mt-5 inline-flex max-w-full items-baseline gap-2 rounded-xl border-[3px] border-border bg-input px-3 py-2">
            <span className="shrink-0 font-mono text-[10px] font-black uppercase tracking-widest text-text-muted">
              Path
            </span>
            <span className="min-w-0 truncate font-mono text-xs font-bold text-text-main">
              {pathname}
            </span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link
              to="/"
              className="dark:bg-action-primary dark:text-primary-contrast dark:border-action-primary dark:shadow-none dark:hover:translate-x-0 dark:hover:translate-y-0 dark:hover:brightness-110 min-w-0 flex items-center justify-center gap-2 h-14 bg-black border-4 border-black rounded-2xl text-sm font-black uppercase tracking-widest text-action-primary shadow-[4px_4px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
            >
              <Home size={18} strokeWidth={3} aria-hidden="true" />
              Dashboard
            </Link>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="min-w-0 flex items-center justify-center gap-2 h-14 bg-input border-4 border-border rounded-2xl text-sm font-black uppercase tracking-widest text-text-main shadow-[4px_4px_0px_0px_var(--shadow-color)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
            >
              <ArrowLeft size={18} strokeWidth={3} aria-hidden="true" />
              Go back
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
