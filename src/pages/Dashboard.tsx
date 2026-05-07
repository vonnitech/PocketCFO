import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, Shield, TrendingUp, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { formatCurrency } from '../lib/utils';

export default function Dashboard() {
  const { 
    safeSpendLimit, 
    liquidAssets, 
    primaryVaultBalance, 
    ghostMode,
    logSpend
  } = useStore();

  const [isLogMode, setIsLogMode] = useState(false);
  const [spendAmount, setSpendAmount] = useState('');

  const handleLogSpend = () => {
    const amt = parseFloat(spendAmount);
    if (!isNaN(amt) && amt > 0) {
      logSpend(amt);
      setIsLogMode(false);
      setSpendAmount('');
    }
  };

  const format = (val: number) => formatCurrency(val, ghostMode);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-12 max-w-5xl mx-auto"
    >
      {/* Friendly Header */}
      <header className="border-b-8 border-current pb-8 flex justify-between items-end">
        <div>
          <h1 className="text-4xl sm:text-6xl md:text-8xl font-black italic uppercase tracking-tighter leading-none mb-4">
            Hello.
          </h1>
          <p className="text-text-muted font-bold tracking-[0.2em] uppercase text-sm">
            Current Financial Snapshot // {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="hidden md:block text-right">
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Financial Health</p>
          <div className="text-4xl font-black italic tracking-tighter text-action-capture">Stable</div>
        </div>
      </header>

      {/* Main Focus: The Daily Allowance */}
      <section className="relative group">
        <div className="card-brutal bg-surface border-border flex flex-col md:flex-row items-center gap-12 p-12">
          <div className="bg-action-capture p-8 border-4 border-black shadow-brutal rotate-[-2deg] group-hover:rotate-0 transition-transform">
            <Wallet size={64} strokeWidth={3} className="text-black" />
          </div>
          
          <div className="flex-1 text-center md:text-left">
            <p className="text-text-muted text-xs uppercase font-black tracking-[0.4em] mb-4">You can safely spend...</p>
            <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-2 sm:gap-4">
              <span className="text-4xl xs:text-5xl sm:text-7xl md:text-9xl font-black italic tracking-tighter leading-none">
                {format(safeSpendLimit)}
              </span>
              <span className="text-text-muted font-mono text-lg sm:text-xl uppercase font-bold">Today</span>
            </div>
            <p className="mt-8 text-sm text-text-muted font-medium max-w-md leading-relaxed mx-auto md:mx-0">
              This amount is calculated after all your bills, debts, and savings goals are set aside. 
              Go ahead and enjoy it—it's yours.
            </p>
          </div>
        </div>
      </section>

      {/* The Pillars of Stability */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Savings Pillar */}
        <div className="card-brutal border-border flex flex-col justify-between min-h-[200px]">
          <div>
            <div className="flex justify-between items-start mb-6">
              <p className="text-text-muted text-[10px] uppercase font-black tracking-widest">Future Savings</p>
              <Shield size={24} className="text-action-target" strokeWidth={3} />
            </div>
            <p className="text-5xl font-black italic tracking-tighter">{format(primaryVaultBalance)}</p>
          </div>
          <p className="text-[10px] text-text-muted mt-8 font-bold uppercase tracking-widest">Reserved for goals & emergencies</p>
        </div>

        {/* Assets Pillar */}
        <div className="card-brutal border-border flex flex-col justify-between min-h-[200px]">
          <div>
            <div className="flex justify-between items-start mb-6">
              <p className="text-text-muted text-[10px] uppercase font-black tracking-widest">Spendable Cash</p>
              <TrendingUp size={24} className="text-action-capture" strokeWidth={3} />
            </div>
            <p className="text-5xl font-black italic tracking-tighter">{format(liquidAssets)}</p>
          </div>
          <p className="text-[10px] text-text-muted mt-8 font-bold uppercase tracking-widest">Total cash currently available</p>
        </div>
      </div>

      {/* Comfort Footer */}
      <footer className="border-t-8 border-current pt-8 pb-20 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex items-center gap-6">
           <div className="w-12 h-12 bg-black flex items-center justify-center text-white font-black italic text-xl">C</div>
           <div>
             <p className="font-black uppercase tracking-widest text-xs italic">CFO Comfort Mode</p>
             <p className="text-[10px] text-text-muted uppercase font-bold tracking-widest mt-1">Focus. Stability. Peace of Mind.</p>
           </div>
        </div>
        
        <div className="flex gap-4">
          <button onClick={() => setIsLogMode(true)} className="btn-brutal bg-action-target text-black text-xs">
            Log Spend
          </button>
          <Link to="/audit" className="btn-brutal bg-white text-black text-xs">
            Audit
          </Link>
          <Link to="/vaults" className="btn-brutal bg-white text-black text-xs">
            Vaults
          </Link>
        </div>
      </footer>

      {/* Log Spend Modal */}
      <AnimatePresence>
        {isLogMode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: 50, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="bg-base card-brutal w-full max-w-md"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-black italic tracking-tighter uppercase">Log Spend</h2>
                <button onClick={() => setIsLogMode(false)} className="text-text-muted hover:text-text-main"><X /></button>
              </div>
              
              <div className="relative mb-6">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-2xl font-black text-text-muted">$</span>
                </div>
                <input 
                  type="number"
                  className="w-full bg-surface border-4 border-black rounded-xl p-4 pl-12 text-3xl font-black outline-none focus:border-action-target transition-colors text-text-main"
                  placeholder="0.00"
                  value={spendAmount}
                  onChange={e => setSpendAmount(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="flex gap-4">
                <button onClick={() => setIsLogMode(false)} className="flex-1 btn-brutal bg-surface text-text-main">Cancel</button>
                <button onClick={handleLogSpend} className="flex-1 btn-brutal bg-action-target text-black shadow-brutal-green hover:translate-y-1 hover:shadow-none transition-all">Submit</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
