import { ArrowLeft, Home } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import CoinCatch from '../components/CoinCatch';

// A compact card: the coin catch game screen on top, then what happened and a
// way out. Short enough that on a phone the game, the words and both buttons
// all sit above the bottom menu without scrolling.
export default function NotFound() {
  const { pathname } = useLocation();

  return (
    <section className="min-h-[calc(100vh-10rem)] flex items-center justify-center py-4">
      <div
        className="w-full max-w-xl bg-surface rounded-[1.6rem]"
        style={{ padding: '14px 14px 20px', border: '1.5px solid #11110F', boxShadow: '7px 7px 0 #11110F', marginRight: 7 }}
      >
        <CoinCatch />

        <div className="mt-4 px-1.5">
          <h1 className="text-[1.6rem] sm:text-[2rem] font-extrabold tracking-tight leading-tight text-text-main">
            Page not found
          </h1>
          {/* Showing the path that failed turns a dead end into something the
              person can actually check or correct. */}
          <p className="mt-1 text-[15px] font-semibold text-text-muted">Maybe a typo, or the page moved.</p>
          <p className="mt-2.5 inline-block max-w-full truncate align-top font-mono text-[11px] font-bold text-text-main px-2.5 py-1 rounded-lg bg-input" style={{ border: '1.5px dashed currentColor' }}>{pathname}</p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link
              to="/"
              className="min-w-0 flex items-center justify-center gap-2 h-12 rounded-xl bg-action-primary text-primary-contrast text-[11px] font-bold uppercase tracking-widest transition-opacity hover:opacity-90"
              style={{ border: '1.5px solid #11110F' }}
            >
              <Home size={16} strokeWidth={2.5} aria-hidden="true" />
              Dashboard
            </Link>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="min-w-0 flex items-center justify-center gap-2 h-12 rounded-xl text-[11px] font-bold uppercase tracking-widest text-text-main transition-colors hover:bg-input"
              style={{ border: '1.5px solid currentColor' }}
            >
              <ArrowLeft size={16} strokeWidth={2.5} aria-hidden="true" />
              Go back
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
