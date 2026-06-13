import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { logSecurityEvent } from '../core/telemetry';

const IDLE_LOCK_MS = 5 * 60 * 1000;  // 5 minutes of inactivity

// Listens for real user activity (pointer / keyboard / scroll / touch) and
// triggers the Screen Lock after IDLE_LOCK_MS of zero input. Pairs with the
// existing visibility-based lock in App.tsx — that one fires when the tab
// backgrounds; this one fires when the user walks away without backgrounding.
export function useIdleLock(): void {
  const lockEnabled = useStore(s => s.lockEnabled);
  const pinHash     = useStore(s => s.pinHash);
  const isLocked    = useStore(s => s.isLocked);

  const lastActivityRef = useRef<number>(Date.now());
  const timerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Idle lock is meaningless without an active PIN-protected session.
    if (!lockEnabled || !pinHash || isLocked) return;

    const arm = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const idleMs = Date.now() - lastActivityRef.current;
        if (idleMs >= IDLE_LOCK_MS && useStore.getState().lockEnabled) {
          logSecurityEvent({ type: 'idle.locked', idleMs });
          useStore.getState().setState({ isLocked: true });
        }
      }, IDLE_LOCK_MS);
    };

    const onActivity = () => {
      lastActivityRef.current = Date.now();
      arm();
    };

    // 'pointermove' covers mouse + touch + pen with one listener. We use the
    // capture phase so child handlers can't accidentally swallow the signal.
    const events: (keyof WindowEventMap)[] = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];
    for (const ev of events) window.addEventListener(ev, onActivity, { passive: true, capture: true });
    arm();

    return () => {
      for (const ev of events) window.removeEventListener(ev, onActivity, true);
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [lockEnabled, pinHash, isLocked]);
}
