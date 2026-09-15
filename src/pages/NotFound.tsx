import { ArrowLeft, Home, SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="min-h-[calc(100vh-8rem)] flex items-center justify-center py-8">
      <div className="w-full max-w-xl bg-surface border-4 border-border rounded-[2rem] p-6 sm:p-10 shadow-[8px_8px_0px_0px_var(--shadow-color)] text-center overflow-hidden">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border-[3px] border-border bg-accent text-black">
          <SearchX size={30} strokeWidth={3} aria-hidden="true" />
        </div>

        <p className="text-sm font-black uppercase tracking-[0.25em] text-text-muted">Error 404</p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-black italic uppercase tracking-tight text-text-main">
          Page not found
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm font-bold leading-relaxed text-text-muted">
          This address may be incorrect, or the page may have moved.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            to="/"
            className="min-w-0 flex items-center justify-center gap-2 rounded-2xl border-[3px] border-border bg-black px-5 py-4 text-sm font-black uppercase tracking-wide text-white shadow-[4px_4px_0px_0px_var(--accent)] transition-transform active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            <Home size={18} aria-hidden="true" />
            Dashboard
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="min-w-0 flex items-center justify-center gap-2 rounded-2xl border-[3px] border-border bg-input px-5 py-4 text-sm font-black uppercase tracking-wide text-text-main transition-colors hover:bg-surface"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            Go back
          </button>
        </div>
      </div>
    </section>
  );
}
