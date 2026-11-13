import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { formatCurrency, formatWhole } from '../lib/utils';

// Long amounts step down in size so they stay on one line in the card.
function amountSize(text: string): string {
  if (text.length <= 12) return 'text-[3.4rem]';
  if (text.length <= 15) return 'text-[2.6rem]';
  return 'text-[2rem]';
}

export function PaydayBanner() {
  const paydayBanner       = useStore(s => s.paydayBanner);
  const dismissPaydayBanner = useStore(s => s.dismissPaydayBanner);
  const privacyMode        = useStore(s => s.privacyMode);
  const navigate           = useNavigate();

  const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  // Cents only when the pay actually has them ("R 50 000", not "R 50 000,00").
  const amountText = !paydayBanner ? ''
    : privacyMode || !Number.isInteger(paydayBanner.amount)
      ? formatCurrency(paydayBanner.amount, privacyMode)
      : formatWhole(paydayBanner.amount);

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
            {/* The bold colour card, same family as the dashboard's daily card:
                the account's own colour, an ink edge and a hard ink shadow.
                Edge and shadow are inline so the restyle's global border rules
                (which thin and soften borders) cannot reach them. */}
            <div
              className="bg-action-primary text-primary-contrast rounded-[1.6rem] p-6"
              style={{ border: '1.5px solid #11110F', boxShadow: '7px 7px 0 #11110F' }}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold uppercase tracking-widest">Payday</p>
                <span
                  className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full text-action-primary"
                  style={{ background: '#11110F' }}
                >
                  {todayLabel}
                </span>
              </div>

              <p className="text-[1.4rem] font-extrabold tracking-tight leading-tight mt-6">Your pay is in</p>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12, duration: 0.45, ease: 'easeOut' }}
                className={`${amountSize(amountText)} font-extrabold tracking-tighter tabular-nums leading-none mt-2 [overflow-wrap:anywhere]`}
              >
                {amountText}
              </motion.p>
              <p className="text-sm font-semibold opacity-75 mt-3">
                Added to your balance.
              </p>

              <div className="flex gap-2.5 mt-6">
                <button
                  type="button"
                  onClick={handleFundVaults}
                  className="flex-1 h-12 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-opacity hover:opacity-90"
                  style={{ background: '#11110F', color: '#FFFDF8' }}
                >
                  Fund vaults
                </button>
                <button
                  type="button"
                  onClick={dismissPaydayBanner}
                  className="h-12 px-5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-colors hover:bg-black/10"
                  style={{ border: '1.5px solid currentColor' }}
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
