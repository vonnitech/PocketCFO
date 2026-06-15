import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Delete, Lock, X, Check } from 'lucide-react';
import { useStore } from '../store/useStore';
import { hashPinSalted, newSaltB64, constantTimeEqual } from '../lib/crypto';
import { logSecurityEvent } from '../core/telemetry';

// Minimal rejection list. We block only the few PINs a thief would type FIRST
// (four-of-a-kind and the canonical 1234 / 4321). Everything else — years,
// birthdays, repeating pairs — is allowed, because a PIN the user actually
// remembers is more secure than one they have to write down. The brute-force
// throttle in ScreenLock handles the residual risk.
function rejectionReason(pin: string): string | null {
  if (!/^\d{4}$/.test(pin)) return 'Must be 4 digits';
  if (/^(\d)\1{3}$/.test(pin)) return 'Avoid four of the same digit';
  if (pin === '1234' || pin === '4321') return 'Too common, pick another';
  return null;
}

interface Props {
  open: boolean;
  mode: 'create' | 'change';   // 'change' requires entering the current PIN first
  onClose: () => void;
}

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','del'] as const;

// Two-step PIN entry: enter, then confirm. For 'change' mode, gates entry on
// the current PIN first so a thief who picks up an unlocked phone can't just
// rotate the PIN and lock the real owner out.
export function SetPinModal({ open, mode, onClose }: Props) {
  const pinHash    = useStore(s => s.pinHash);
  const pinSalt    = useStore(s => s.pinSalt);
  const setState   = useStore(s => s.setState);

  type Phase = 'current' | 'new' | 'confirm' | 'saving' | 'done';
  const [phase, setPhase]       = useState<Phase>('new');
  const [input, setInput]       = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError]       = useState('');
  const [shake, setShake]       = useState(false);

  useEffect(() => {
    if (open) {
      setPhase(mode === 'change' ? 'current' : 'new');
      setInput(''); setFirstPin(''); setError(''); setShake(false);
    }
  }, [open, mode]);

  if (!open) return null;

  const fail = (message: string) => {
    setShake(true); setError(message);
    setTimeout(() => { setInput(''); setShake(false); }, 600);
  };

  const press = async (key: string) => {
    if (phase === 'saving') return;
    if (key === 'del') { setInput(s => s.slice(0, -1)); setError(''); return; }
    if (input.length >= 4) return;
    const next = input + key;
    setInput(next);
    if (next.length !== 4) return;

    if (phase === 'current') {
      // Verify the existing PIN before letting the user pick a new one.
      if (!pinHash || !pinSalt) { setPhase('new'); setInput(''); return; }
      const h = await hashPinSalted(next, pinSalt);
      if (constantTimeEqual(h, pinHash)) {
        setPhase('new'); setInput(''); setError('');
      } else {
        fail('Wrong current PIN');
      }
      return;
    }

    if (phase === 'new') {
      const reason = rejectionReason(next);
      if (reason) {
        logSecurityEvent({ type: 'pin.weak_rejected', reason });
        fail(reason);
        return;
      }
      setFirstPin(next);
      setPhase('confirm');
      setInput('');
      setError('');
      return;
    }

    if (phase === 'confirm') {
      if (next !== firstPin) { fail("PINs don't match"); return; }
      setPhase('saving');
      const salt = newSaltB64();
      const hash = await hashPinSalted(next, salt);
      setState({ pinHash: hash, pinSalt: salt, lockEnabled: true });
      logSecurityEvent({ type: mode === 'change' ? 'pin.changed' : 'pin.created' });
      setPhase('done');
      setTimeout(() => onClose(), 700);
    }
  };

  const title = phase === 'current' ? 'Enter Current PIN'
    : phase === 'new'     ? (mode === 'change' ? 'Enter New PIN' : 'Set 4-Digit PIN')
    : phase === 'confirm' ? 'Confirm PIN'
    : phase === 'saving'  ? 'Saving…'
    : 'PIN Updated';

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-210 bg-black/80 backdrop-blur-sm"
            onClick={() => phase !== 'saving' && onClose()}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            className="fixed inset-0 z-210 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-[#0A0A0A] border-4 border-action-primary rounded-3xl shadow-[8px_8px_0px_0px_var(--color-action-primary)] max-w-sm w-full pointer-events-auto overflow-hidden">
              <div className="px-5 py-4 border-b-4 border-action-primary flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-action-primary text-[10px] font-black tracking-widest uppercase">
                  <Lock size={12} strokeWidth={3} /> Screen Lock PIN
                </div>
                {phase !== 'saving' && (
                  <button type="button" onClick={onClose} title="Close" aria-label="Close"
                    className="w-7 h-7 border-2 border-action-primary rounded-lg flex items-center justify-center text-action-primary">
                    <X size={12} strokeWidth={3} />
                  </button>
                )}
              </div>

              <div className="p-6 flex flex-col items-center gap-6">
                <p className="text-white text-xl font-black uppercase italic tracking-tighter text-center">
                  {title}
                </p>

                {/* Dots */}
                {phase !== 'done' && (
                  <motion.div
                    className="flex gap-5"
                    animate={shake ? { x: [-10, 10, -10, 10, -6, 6, 0] } : {}}
                    transition={{ duration: 0.45 }}
                  >
                    {Array.from({ length: 4 }, (_, i) => (
                      <div key={i}
                        className={`w-4 h-4 rounded-full border-2 transition-colors duration-150 ${
                          i < input.length
                            ? error ? 'bg-action-bleed border-action-bleed' : 'bg-action-primary border-action-primary'
                            : 'border-white/20 bg-transparent'
                        }`}
                      />
                    ))}
                  </motion.div>
                )}

                {phase === 'done' && (
                  <div className="w-14 h-14 bg-action-capture border-4 border-action-capture/40 rounded-2xl flex items-center justify-center">
                    <Check size={28} strokeWidth={3} className="text-capture-contrast" />
                  </div>
                )}

                {error && (
                  <p className="text-action-bleed text-[10px] font-black uppercase tracking-widest -mt-2">
                    {error}
                  </p>
                )}

                {/* Number pad */}
                {phase !== 'saving' && phase !== 'done' && (
                  <div className="grid grid-cols-3 gap-3 w-full">
                    {KEYS.map((key, i) => {
                      if (key === '') return <div key={i} />;
                      return (
                        <motion.button
                          key={key}
                          type="button"
                          whileTap={{ scale: 0.92 }}
                          onClick={() => press(key)}
                          className="h-14 rounded-2xl border-2 border-white/10 bg-white/5 text-white font-black text-xl flex items-center justify-center transition-colors active:bg-white/15"
                        >
                          {key === 'del' ? <Delete size={20} strokeWidth={2.5} /> : key}
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                <p className="text-white/30 text-[9px] font-bold uppercase tracking-widest text-center">
                  {phase === 'current'  && 'Verify current PIN to change it'}
                  {phase === 'new'      && 'Pick a 4-digit code you’ll remember'}
                  {phase === 'confirm'  && 'Re-enter to confirm'}
                  {phase === 'saving'   && 'Hashing & saving…'}
                  {phase === 'done'     && 'Screen lock is now active'}
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
