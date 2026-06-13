import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Delete, Lock, ShieldAlert, LogOut, Fingerprint } from 'lucide-react';
import { useStore } from '../store/useStore';
import { supabase } from '../core/supabase';
import { hashPinSalted, constantTimeEqual } from '../lib/crypto';
import { logSecurityEvent } from '../core/telemetry';
import { hasEnrolledCredential, verifyCredential } from '../lib/webauthn';

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','del'] as const;

// ── Brute-force throttling ────────────────────────────────────────────────
// 4-digit PINs only have 10K combinations. Without throttling, anyone with the
// device could guess offline-equivalent speeds. We layer two defenses:
//   • Soft lock: after FAIL_THRESHOLD failed attempts, freeze the keypad for
//     COOLDOWN_MS. State persists in localStorage so closing the tab doesn't reset it.
//   • Nuclear option: after HARD_FAIL_LIMIT total fails, force-sign-out via
//     Supabase so re-entry requires email/password.
const FAIL_KEY        = 'pocket-cfo-pin-fails';
const COOLDOWN_KEY    = 'pocket-cfo-pin-cooldown-until';
const FAIL_THRESHOLD  = 5;
const HARD_FAIL_LIMIT = 15;
const COOLDOWN_MS     = 60_000;

function readFails(): number {
  try { return parseInt(localStorage.getItem(FAIL_KEY) ?? '0', 10) || 0; }
  catch { return 0; }
}
function writeFails(n: number): void {
  try { localStorage.setItem(FAIL_KEY, String(n)); } catch {}
}
function readCooldownUntil(): number {
  try { return parseInt(localStorage.getItem(COOLDOWN_KEY) ?? '0', 10) || 0; }
  catch { return 0; }
}
function writeCooldownUntil(epoch: number): void {
  try {
    if (epoch <= 0) localStorage.removeItem(COOLDOWN_KEY);
    else            localStorage.setItem(COOLDOWN_KEY, String(epoch));
  } catch {}
}
function clearFailState(): void {
  try { localStorage.removeItem(FAIL_KEY); localStorage.removeItem(COOLDOWN_KEY); }
  catch {}
}

export function ScreenLock() {
  const isLocked     = useStore(s => s.isLocked);
  const lockEnabled  = useStore(s => s.lockEnabled);
  const pinHash      = useStore(s => s.pinHash);
  const pinSalt      = useStore(s => s.pinSalt);
  const userId       = useStore(s => s.userId);
  const setState     = useStore(s => s.setState);

  const canUseBiometrics = !!userId && hasEnrolledCredential(userId);

  const [input, setInput]                 = useState('');
  const [shake, setShake]                 = useState(false);
  const [error, setError]                 = useState(false);
  const [verifying, setVerifying]         = useState(false);
  const [failCount, setFailCount]         = useState<number>(() => readFails());
  const [cooldownUntil, setCooldownUntil] = useState<number>(() => readCooldownUntil());
  const [now, setNow]                     = useState<number>(() => Date.now());
  const tickRef                           = useRef<ReturnType<typeof setInterval> | null>(null);

  const inCooldown = cooldownUntil > now;
  const secondsLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  // Tick once per second only while a cooldown is active.
  useEffect(() => {
    if (!inCooldown) {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      return;
    }
    tickRef.current = setInterval(() => setNow(Date.now()), 250);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [inCooldown]);

  // When a cooldown expires naturally, clear it from storage too.
  useEffect(() => {
    if (cooldownUntil > 0 && cooldownUntil <= now) {
      writeCooldownUntil(0);
      setCooldownUntil(0);
    }
  }, [now, cooldownUntil]);

  if (!lockEnabled || !isLocked) return null;

  const verify = async (candidate: string): Promise<boolean> => {
    setVerifying(true);
    try {
      // Belt-and-suspenders: if somehow the lock got enabled without a PIN, just
      // unlock and disable so the user isn't soft-bricked.
      if (!pinHash || !pinSalt) {
        clearFailState();
        setState({ isLocked: false, lockEnabled: false });
        return true;
      }
      const candidateHash = await hashPinSalted(candidate, pinSalt);
      return constantTimeEqual(candidateHash, pinHash);
    } finally {
      setVerifying(false);
    }
  };

  const forceSignOut = async () => {
    logSecurityEvent({ type: 'pin.force_signout', attempts: failCount });
    clearFailState();
    setFailCount(0);
    setCooldownUntil(0);
    setState({ isLocked: false, lockEnabled: false, pinHash: '', pinSalt: '' });
    try { await supabase.auth.signOut(); } catch {}
  };

  const handleFailure = () => {
    const nextCount = failCount + 1;
    writeFails(nextCount);
    setFailCount(nextCount);
    setShake(true);
    setError(true);
    setTimeout(() => { setInput(''); setShake(false); }, 600);

    if (nextCount >= HARD_FAIL_LIMIT) {
      forceSignOut();
      return;
    }
    // Every FAIL_THRESHOLD bad attempts triggers a fresh cooldown window.
    if (nextCount % FAIL_THRESHOLD === 0) {
      const until = Date.now() + COOLDOWN_MS;
      writeCooldownUntil(until);
      setCooldownUntil(until);
      logSecurityEvent({ type: 'pin.lockout', attempts: nextCount, cooldownSec: COOLDOWN_MS / 1000 });
    }
  };

  const press = async (key: string) => {
    if (verifying || inCooldown) return;
    if (key === 'del') {
      setInput(s => s.slice(0, -1));
      setError(false);
      return;
    }
    if (input.length >= 4) return;
    const next = input + key;
    setInput(next);
    if (next.length === 4) {
      const ok = await verify(next);
      if (ok) {
        clearFailState();
        setFailCount(0);
        setCooldownUntil(0);
        setState({ isLocked: false });
        setInput('');
        setError(false);
      } else {
        handleFailure();
      }
    }
  };

  const tryBiometrics = async () => {
    if (!userId || inCooldown) return;
    const ok = await verifyCredential(userId);
    if (ok) {
      logSecurityEvent({ type: 'webauthn.unlock_ok' });
      clearFailState();
      setFailCount(0);
      setCooldownUntil(0);
      setState({ isLocked: false });
    } else {
      logSecurityEvent({ type: 'webauthn.unlock_fail', reason: 'user_cancelled_or_denied' });
    }
  };

  // Auto-prompt biometrics once when the lock screen first appears, so the user
  // doesn't have to tap the button before getting the Face ID / Touch ID modal.
  const autoPromptedRef = useRef(false);
  useEffect(() => {
    if (autoPromptedRef.current) return;
    if (!canUseBiometrics || inCooldown) return;
    autoPromptedRef.current = true;
    tryBiometrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseBiometrics, inCooldown]);

  const remainingBeforeHardWipe = Math.max(0, HARD_FAIL_LIMIT - failCount);

  return (
    <div className="fixed inset-0 z-200 bg-[#0A0A0A] flex flex-col items-center justify-center gap-10 px-8">

      {/* Brand + lock icon */}
      <div className="flex flex-col items-center gap-3">
        <div className={`w-14 h-14 border-4 border-black rounded-2xl flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${inCooldown ? 'bg-action-bleed' : 'bg-action-primary'}`}>
          {inCooldown
            ? <ShieldAlert size={24} strokeWidth={3} className="text-white" />
            : <Lock        size={24} strokeWidth={3} className="text-black" />
          }
        </div>
        <div className="text-center">
          <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${inCooldown ? 'text-action-bleed' : 'text-action-primary'}`}>Pocket CFO</p>
          <p className="text-white text-2xl font-black uppercase italic tracking-tighter mt-0.5">
            {inCooldown ? 'Locked Out' : 'Enter PIN'}
          </p>
        </div>
      </div>

      {/* PIN dots */}
      <motion.div
        className="flex gap-5"
        animate={shake ? { x: [-10, 10, -10, 10, -6, 6, 0] } : {}}
        transition={{ duration: 0.45 }}
      >
        {Array.from({ length: 4 }, (_, i) => (
          <motion.div
            key={i}
            animate={i < input.length ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.15 }}
            className={`w-5 h-5 rounded-full border-2 transition-colors duration-150 ${
              i < input.length
                ? error ? 'bg-action-bleed border-action-bleed' : 'bg-action-primary border-action-primary'
                : 'border-white/20 bg-transparent'
            }`}
          />
        ))}
      </motion.div>

      {(error || inCooldown) && (
        <AnimatePresence mode="wait">
          {inCooldown ? (
            <motion.div
              key="cooldown"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="-mt-4 flex flex-col items-center gap-1.5"
            >
              <p className="text-action-bleed text-[11px] font-black uppercase tracking-widest tabular-nums">
                Try again in {secondsLeft}s
              </p>
              <p className="text-white/40 text-[9px] font-bold uppercase tracking-widest">
                {remainingBeforeHardWipe} attempt{remainingBeforeHardWipe !== 1 ? 's' : ''} until sign-out
              </p>
            </motion.div>
          ) : (
            <motion.p
              key="err"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-action-bleed text-[10px] font-black uppercase tracking-widest -mt-6"
            >
              Incorrect PIN
            </motion.p>
          )}
        </AnimatePresence>
      )}

      {/* Number pad */}
      <div className={`grid grid-cols-3 gap-3 w-72 transition-opacity ${inCooldown ? 'opacity-30 pointer-events-none' : ''}`}>
        {KEYS.map((key, i) => {
          if (key === '') return <div key={i} />;
          return (
            <motion.button
              key={key}
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => press(key)}
              disabled={inCooldown || verifying}
              className="h-16 rounded-2xl border-2 border-white/10 bg-white/5 text-white font-black text-xl flex items-center justify-center transition-colors active:bg-white/15 disabled:cursor-not-allowed"
            >
              {key === 'del' ? <Delete size={20} strokeWidth={2.5} /> : key}
            </motion.button>
          );
        })}
      </div>

      {/* Biometric fallback — only if a credential was enrolled in Settings */}
      {canUseBiometrics && !inCooldown && (
        <button
          type="button"
          onClick={tryBiometrics}
          className="flex items-center gap-2 text-white/80 text-[11px] font-black uppercase tracking-widest hover:text-action-primary transition-colors"
        >
          <Fingerprint size={14} strokeWidth={2.5} />
          Use Biometrics
        </button>
      )}

      {/* Escape hatch for someone who genuinely forgot — sign out & start over */}
      <button
        type="button"
        onClick={forceSignOut}
        className="text-white/40 text-[10px] font-bold uppercase tracking-widest hover:text-white/70 transition-colors flex items-center gap-1.5"
      >
        <LogOut size={11} strokeWidth={2.5} />
        Forgot PIN · sign out
      </button>
    </div>
  );
}
