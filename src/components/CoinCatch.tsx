import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useStore } from '../store/useStore';
import { currencyDef, guessCurrency } from '../lib/currency';
import { userKey } from '../lib/userScopedStorage';
import { createCoinCatch, type CoinCatchGame, type CoinCatchPhase } from '../lib/coinCatch';

const BEST_BASE = 'pocket-cfo-coin-catch-best-v1';
const LIVES = 3;

function readBest(): number {
  try { return Number(localStorage.getItem(userKey(BEST_BASE))) || 0; } catch { return 0; }
}

// The game on the 404 page. The canvas engine lives in lib/coinCatch.ts; this
// component owns the score bar and the start, pause and game-over panels.
export default function CoinCatch() {
  const fieldRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const gameRef = useRef<CoinCatchGame | null>(null);
  const savedRef = useRef(0);

  const [phase, setPhase] = useState<CoinCatchPhase>('ready');
  const [saved, setSaved] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [best, setBest] = useState(readBest);
  const [newBest, setNewBest] = useState(false);
  const [status, setStatus] = useState('');
  // In memory too, so a best still counts where the browser will not store it.
  const bestRef = useRef(best);

  // Signed-in people see their own currency; visitors get a guess from the device.
  const userId = useStore(s => s.userId);
  const currency = useStore(s => s.currency);
  const money = useMemo(() => {
    const def = currencyDef(userId ? currency : guessCurrency());
    let fmt: Intl.NumberFormat;
    try {
      fmt = new Intl.NumberFormat(def.locale, { style: 'currency', currency: def.code, maximumFractionDigits: 0 });
    } catch {
      fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    }
    return (n: number) => fmt.format(n);
  }, [userId, currency]);

  useEffect(() => {
    const stored = readBest();
    bestRef.current = stored;
    setBest(stored);
  }, [userId]);

  useEffect(() => {
    const field = fieldRef.current, canvas = canvasRef.current;
    if (!field || !canvas) return;
    const game = createCoinCatch(field, canvas, {
      onSaved: n => { savedRef.current = n; setSaved(n); },
      onLives: setLives,
      onPhase: setPhase,
      readyPanelBottom: () => {
        const panel = panelRef.current;
        return panel ? panel.offsetTop + panel.offsetHeight : 0;
      },
    });
    gameRef.current = game;
    return () => { game.destroy(); gameRef.current = null; };
  }, []);

  useEffect(() => {
    const score = savedRef.current;
    if (phase === 'over') {
      const isBest = score > 0 && score > Math.max(bestRef.current, readBest());
      setNewBest(isBest);
      if (isBest) {
        bestRef.current = score;
        setBest(score);
        try { localStorage.setItem(userKey(BEST_BASE), String(score)); } catch {}
      }
      setStatus(`Game over. Saved ${money(score)}.${isBest ? ' New best.' : ''}`);
    } else if (phase === 'paused') {
      setStatus(`Paused. Saved ${money(score)} so far.`);
    } else {
      setStatus('');
    }
    // Keyboard players land on the panel's button when the game stops, unless
    // they moved focus somewhere else on the page. Checked a tick later: when a
    // Tab away is what paused the game, focus has not reached its target yet.
    if (phase !== 'over' && phase !== 'paused') return;
    const id = window.setTimeout(() => {
      const active = document.activeElement;
      const focusInGame = !active || active === document.body || fieldRef.current?.contains(active);
      if (focusInGame) actionRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(id);
    // Runs on phase changes only; money just formats the amount in the message.
  }, [phase]);

  const onAction = () => (phase === 'paused' ? gameRef.current?.resume() : gameRef.current?.start());

  return (
    <div className="w-full bg-surface border-4 border-border rounded-[2rem] shadow-[8px_8px_0px_0px_var(--shadow-color)] p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-xl font-black italic uppercase tracking-tight text-text-main">Coin catch</h2>
        <span className="font-mono text-[10px] font-black uppercase tracking-widest text-text-muted">While you're here</span>
      </div>
      <p className="mt-1 text-sm font-bold leading-relaxed text-text-muted">
        Move the piggy to catch coins. Dodge the red bills. Miss three coins and the game ends.
      </p>

      {/* Announces only lost lives and the end or pause of a game, not every coin. */}
      <p role="status" className="sr-only">{status}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Stat label="Saved"><span className="text-capture-readable">{money(saved)}</span></Stat>
        <Stat label="Lives">
          <span className="flex gap-1" aria-hidden="true">
            {Array.from({ length: LIVES }, (_, i) => (
              <i
                key={i}
                className={`block w-3 h-3 rounded-full border-2 transition-opacity ${i < lives ? 'bg-action-primary border-black' : 'border-text-muted opacity-40'}`}
              />
            ))}
          </span>
          <span className="sr-only" aria-live="polite">{lives} {lives === 1 ? 'life' : 'lives'} left</span>
        </Stat>
        <Stat label="Best">{money(best)}</Stat>
      </div>

      {/* The engine shakes this element when a life is lost, so its class
          list must not be rewritten by React mid-game. */}
      <div ref={fieldRef} className="coin-catch-field relative mt-4 h-[clamp(280px,46vh,420px)] overflow-hidden rounded-2xl border-[3px] border-border bg-page dot-bg">
        <canvas
          ref={canvasRef}
          // A keyboard stop only during play; start() and resume() focus it themselves.
          tabIndex={phase === 'playing' ? 0 : -1}
          aria-label="Coin catching game. Use the left and right arrow keys, or drag, to move the piggy bank."
          className={`block w-full h-full outline-none ${phase === 'playing' ? 'cursor-none touch-none' : ''}`}
        />
        {phase !== 'playing' && (
          // The start panel sits at the top so the pig stays in view below it.
          <div className={`absolute inset-0 flex justify-center p-4 ${phase === 'ready' ? 'items-start pointer-events-none' : 'items-center bg-page/60'}`}>
            <div
              ref={panelRef}
              className="pointer-events-auto w-full max-w-xs flex flex-col items-center gap-3 rounded-2xl border-4 border-border bg-surface px-5 py-4 text-center shadow-[5px_5px_0px_0px_var(--shadow-color)]"
            >
              {phase === 'ready' && (
                <>
                  <p className="text-lg font-black italic uppercase tracking-tight text-text-main">Coin catch</p>
                  <div className="flex gap-4 text-xs font-black text-text-main">
                    <span className="flex items-center gap-1.5"><i className="block w-4 h-4 rounded-full bg-[#1DCB63] border-[3px] border-black" />Catch</span>
                    <span className="flex items-center gap-1.5"><i className="block w-3.5 h-4.5 rounded-[3px] bg-action-bleed border-[3px] border-black" />Dodge</span>
                  </div>
                  <p className="text-xs font-bold text-text-muted">Drag, tap or use the arrow keys to move.</p>
                </>
              )}
              {phase === 'paused' && (
                <>
                  <p className="text-lg font-black italic uppercase tracking-tight text-text-main">Paused</p>
                  <p className="text-xs font-bold text-text-muted">Saved so far: {money(saved)}</p>
                </>
              )}
              {phase === 'over' && (
                <>
                  <p className="text-lg font-black italic uppercase tracking-tight text-text-main">Game over</p>
                  {newBest && (
                    <span className="rounded-full border-2 border-black bg-action-primary px-2.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest text-primary-contrast">
                      New best
                    </span>
                  )}
                  <p className="font-mono text-3xl font-bold text-capture-readable">{money(saved)}</p>
                  <p className="text-xs font-bold text-text-muted">saved. Still no page, though.</p>
                </>
              )}
              <button
                ref={actionRef}
                type="button"
                onClick={onAction}
                className="flex items-center justify-center gap-2 h-11 px-6 bg-action-primary border-4 border-black rounded-full text-xs font-black uppercase tracking-widest text-primary-contrast shadow-brutal-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
              >
                {phase === 'over' ? <RotateCcw size={16} strokeWidth={3} aria-hidden="true" /> : <Play size={16} strokeWidth={3} aria-hidden="true" />}
                {phase === 'ready' ? 'Play' : phase === 'paused' ? 'Resume' : 'Play again'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 min-h-11">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-muted [@media(hover:none)]:hidden">
          Arrow keys or A and D to move. Space to pause.
        </span>
        {phase === 'playing' && (
          <button
            type="button"
            onClick={() => gameRef.current?.pause()}
            className="ml-auto flex items-center gap-2 h-11 px-5 bg-input border-4 border-border rounded-full text-xs font-black uppercase tracking-widest text-text-main shadow-[3px_3px_0px_0px_var(--shadow-color)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
          >
            <Pause size={16} strokeWidth={3} aria-hidden="true" />
            Pause
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-input px-3 py-1.5 text-xs font-black text-text-main">
      {label}
      <span className="font-mono font-bold tabular-nums">{children}</span>
    </div>
  );
}
