import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { DollarSign } from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatCurrency } from '../lib/utils';

export function PaydayBanner() {
  const paydayBanner       = useStore(s => s.paydayBanner);
  const dismissPaydayBanner = useStore(s => s.dismissPaydayBanner);
  const privacyMode        = useStore(s => s.privacyMode);
  const navigate           = useNavigate();

  const handleFundVaults = () => {
    dismissPaydayBanner();
    navigate('/vaults');
  };

  return (
    <AnimatePresence>
      {paydayBanner && (
        <motion.div
          key="payday-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-end justify-center p-4 pb-10 bg-black/80 backdrop-blur-sm"
          onClick={dismissPaydayBanner}
        >
          <motion.div
            initial={{ y: 80, scale: 0.95 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 80, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            className="w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-black border-4 border-action-primary rounded-3xl p-6 shadow-[8px_8px_0px_0px_var(--color-action-primary)]">

              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 bg-action-primary border-4 border-black rounded-xl flex items-center justify-center shrink-0">
                  <DollarSign size={24} strokeWidth={3} className="text-black" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/40 leading-none mb-0.5">Payday</p>
                  <p className="text-[15px] font-black uppercase tracking-tight text-white leading-none">Take-Home Landed</p>
                </div>
              </div>

              <p className="text-5xl font-black italic tracking-tighter text-action-primary tabular-nums leading-none mb-1">
                {formatCurrency(paydayBanner.amount, privacyMode)}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-6">
                Added to your liquid balance
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleFundVaults}
                  className="flex-1 h-13 bg-action-primary border-4 border-black rounded-2xl text-black font-black uppercase text-[11px] tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
                >
                  Fund Vaults
                </button>
                <button
                  type="button"
                  onClick={dismissPaydayBanner}
                  className="h-13 px-5 border-4 border-white/20 rounded-2xl text-white/50 font-black uppercase text-[11px] tracking-widest hover:border-white/40 hover:text-white/80 transition-colors"
                >
                  Later
                </button>
              </div>

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
