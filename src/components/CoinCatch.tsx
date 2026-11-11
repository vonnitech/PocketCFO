import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useStore } from '../store/useStore';
import { currencyDef, guessCurrency } from '../lib/currency';
import { userKey } from '../lib/userScopedStorage';
import { createCoinCatch, type CoinCatchGame, type CoinCatchPhase } from '../lib/coinCatch';

const BEST_BASE = 'pocket-cfo-coin-catch-best-v1';
const LIVES = 3;
const INK = '#11110F';
const PAPER = '#FFFDF8';

function readBest(): number {
  try { return Number(localStorage.getItem(userKey(BEST_BASE))) || 0; } catch { return 0; }
}

// The game screen at the top of the 404 card: a light tint of the account's
// own colour with the big "404" on it. Tapping anywhere on the screen starts a
// game; while playing the numerals fade back and coins fall over them. The
// canvas engine lives in lib/coinCatch.ts; this component owns the numerals,
// the score chips and the paused and game-over panels.
export default function CoinCatch() {
  const fieldRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
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
      // Demo coins hang between the "Tap to play" pill and the pig.
      readyPanelBottom: () => {
        const f = fieldRef.current, h = hintRef.current;
        if (!f || !h) return 0;
        return h.getBoundingClientRect().bottom - f.getBoundingClientRect().top;
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

  const playing = phase === 'playing';
  const onAction = () => (phase === 'paused' ? gameRef.current?.resume() : gameRef.current?.start());
  // Chip spacing is inline: as utility classes the gaps collapsed and the lives
  // pill slid under the pause button.
  const chip = 'flex items-center h-8 px-3 rounded-full text-[11px] font-bold';
  const chipStyle: CSSProperties = { background: PAPER, color: INK, border: `1.5px solid ${INK}`, gap: 6, flexShrink: 0 };
  // The engine draws the floor line in --border-primary; here it follows the text.
  const fieldStyle = {
    '--border-primary': 'var(--text-primary)',
    background: 'color-mix(in srgb, var(--color-action-primary) 32%, var(--bg-secondary))',
    border: `1.5px solid ${INK}`,
  } as CSSProperties;

  return (
    // The engine shakes this element when a life is lost, so its class list
    // must not be rewritten by React mid-game.
    <div ref={fieldRef} style={fieldStyle} className="coin-catch-field relative h-[clamp(220px,32vh,280px)] sm:h-[clamp(270px,40vh,330px)] overflow-hidden rounded-[1.05rem] text-text-main">
      {/* Announces only lost lives and the end or pause of a game, not every coin. */}
      <p role="status" className="sr-only">{status}</p>

      {/* Layer 1: the 404 itself. Coins fall in front of it during play. */}
      <div className={`absolute inset-x-0 top-0 transition-opacity duration-500 ${phase === 'ready' ? '' : 'opacity-15'}`}>
        {/* Hidden during a game: faded, the dark Best chip showed through as a
            grey block behind the lives and pause buttons. */}
        <div className="flex items-center justify-between px-5 pt-4" style={{ visibility: phase === 'ready' ? 'visible' : 'hidden' }}>
          <span className="flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ background: PAPER, color: INK, border: `1.5px solid ${INK}` }}>
            <i aria-hidden="true" className="block w-2.5 h-2.5 rounded-full" style={{ background: '#1DCB63', border: `1.5px solid ${INK}` }} />
            Coin catch
          </span>
          {best > 0 && (
            <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full text-action-primary" style={{ background: INK }}>
              Best {money(best)}
            </span>
          )}
        </div>
        {/* A hard offset shadow in the account colour, like the card shadows. */}
        <p
          className="text-center font-extrabold tracking-tighter leading-none text-[4rem] sm:text-[5rem]"
          style={{ textShadow: '4px 4px 0 var(--color-action-primary)' }}
        >
          404
        </p>
        <p
          ref={hintRef}
          className="flex justify-center mt-3"
          style={{ visibility: phase === 'ready' ? 'visible' : 'hidden' }}
        >
          <span className="flex items-center gap-1.5 h-7 px-3.5 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ background: INK, color: PAPER }}>
            <Play size={11} strokeWidth={3} fill="currentColor" aria-hidden="true" />
            Tap to play
          </span>
        </p>
      </div>

      {/* Layer 2: the game. */}
      <canvas
        ref={canvasRef}
        // A keyboard stop only during play; start() and resume() focus it themselves.
        tabIndex={playing ? 0 : -1}
        aria-label="Coin catching game. Use the left and right arrow keys, or drag, to move the piggy bank."
        className={`absolute inset-0 block w-full h-full outline-none ${playing ? 'cursor-none touch-none' : ''}`}
      />

      {/* Layer 3: controls. Clicks pass through to the canvas except on the controls themselves. */}
      <div className="pointer-events-none absolute inset-0">
        {phase === 'ready' && (
          // The whole screen is the start button.
          <button
            ref={actionRef}
            type="button"
            onClick={onAction}
            aria-label={best > 0 ? `Play coin catch. Best ${money(best)}.` : 'Play coin catch'}
            className="pointer-events-auto absolute inset-0 cursor-pointer rounded-[1.05rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px]"
          />
        )}

        {(playing || phase === 'paused') && (
          <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            <span className={chip} style={chipStyle}>
              Saved <span className="tabular-nums">{money(saved)}</span>
            </span>
            <div className="flex items-center" style={{ gap: 8 }}>
              <span className={chip} style={chipStyle}>
                {Array.from({ length: LIVES }, (_, i) => (
                  <i
                    key={i}
                    aria-hidden="true"
                    className="block w-3 h-3 rounded-full transition-opacity"
                    style={{ background: i < lives ? INK : 'transparent', border: `1.5px solid ${INK}`, opacity: i < lives ? 1 : 0.35 }}
                  />
                ))}
                <span className="sr-only" aria-live="polite">{lives} {lives === 1 ? 'life' : 'lives'} left</span>
              </span>
              {playing && (
                <button
                  type="button"
                  onClick={() => gameRef.current?.pause()}
                  aria-label="Pause"
                  className="pointer-events-auto grid place-items-center w-8 h-8 rounded-full"
                  style={chipStyle}
                >
                  <Pause size={13} strokeWidth={3} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        )}

        {(phase === 'paused' || phase === 'over') && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div
              className="pointer-events-auto w-full max-w-[16rem] flex flex-col items-center gap-2 rounded-2xl px-5 py-4 text-center"
              style={{ background: PAPER, color: INK, border: `1.5px solid ${INK}`, boxShadow: `5px 5px 0 ${INK}` }}
            >
              {phase === 'paused' ? (
                <>
                  <p className="text-lg font-extrabold">Paused</p>
                  <p className="text-xs font-semibold opacity-70">Saved so far: {money(saved)}</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-extrabold">Game over</p>
                  <p className="text-3xl font-extrabold tabular-nums">{money(saved)}</p>
                  <p className="text-xs font-semibold opacity-70">{newBest ? 'New best. ' : ''}Still no page, though.</p>
                </>
              )}
              <button
                ref={actionRef}
                type="button"
                onClick={onAction}
                className="mt-1 flex items-center justify-center gap-2 h-10 px-5 rounded-full text-[11px] font-bold uppercase tracking-widest"
                style={{ background: INK, color: PAPER }}
              >
                {phase === 'over' ? <RotateCcw size={14} strokeWidth={3} aria-hidden="true" /> : <Play size={14} strokeWidth={3} aria-hidden="true" />}
                {phase === 'paused' ? 'Resume' : 'Play again'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
