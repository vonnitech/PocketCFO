import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Delete, Lock } from 'lucide-react';
import { useStore } from '../store/useStore';

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','del'] as const;

export function ScreenLock() {
  const isLocked     = useStore(s => s.isLocked);
  const lockEnabled  = useStore(s => s.lockEnabled);
  const securityPIN  = useStore(s => s.securityPIN);
  const setState     = useStore(s => s.setState);

  const [input, setInput]   = useState('');
  const [shake, setShake]   = useState(false);
  const [error, setError]   = useState(false);

  if (!lockEnabled || !isLocked) return null;

  const press = (key: string) => {
    if (key === 'del') {
      setInput(s => s.slice(0, -1));
      setError(false);
      return;
    }
    if (input.length >= 4) return;
    const next = input + key;
    setInput(next);
    if (next.length === 4) {
      if (next === securityPIN) {
        setState({ isLocked: false });
        setInput('');
        setError(false);
      } else {
        setShake(true);
        setError(true);
        setTimeout(() => { setInput(''); setShake(false); }, 600);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#0A0A0A] flex flex-col items-center justify-center gap-10 px-8">

      {/* Brand + lock icon */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-14 h-14 bg-action-primary border-4 border-black rounded-2xl flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <Lock size={24} strokeWidth={3} className="text-black" />
        </div>
        <div className="text-center">
          <p className="text-action-primary text-[10px] font-black uppercase tracking-[0.3em]">Pocket CFO</p>
          <p className="text-white text-2xl font-black uppercase italic tracking-tighter mt-0.5">Enter PIN</p>
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

      {error && (
        <AnimatePresence>
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-action-bleed text-[10px] font-black uppercase tracking-widest -mt-6"
          >
            Incorrect PIN
          </motion.p>
        </AnimatePresence>
      )}

      {/* Number pad */}
      <div className="grid grid-cols-3 gap-3 w-72">
        {KEYS.map((key, i) => {
          if (key === '') return <div key={i} />;
          return (
            <motion.button
              key={key}
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => press(key)}
              className="h-16 rounded-2xl border-2 border-white/10 bg-white/5 text-white font-black text-xl flex items-center justify-center transition-colors active:bg-white/15"
            >
              {key === 'del' ? <Delete size={20} strokeWidth={2.5} /> : key}
            </motion.button>
          );
        })}
      </div>

      <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest">
        App locked for security
      </p>
    </div>
  );
}
