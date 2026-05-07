import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Skull, X, ShieldCheck } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { useStore } from '../store/useStore';
import { Subscription } from '../store/useStore';

import { calculateNewBaselineBills, calculateNewWealthTarget } from '../core/math';
import { executeLeechKill } from '../db';

export default function LeechList() {
  const storeState = useStore();
  const { setState, ghostMode, updateState } = storeState;
  const state = storeState;

  const totalBleed = useMemo(() => {
    return state.subscriptions.reduce((acc, sub) => acc + sub.amount, 0);
  }, [state.subscriptions]);

  const [leechToKill, setLeechToKill] = useState<Subscription | null>(null);
  const [isAddingLeech, setIsAddingLeech] = useState(false);
  const [newLeech, setNewLeech] = useState({ name: '', amount: 0 });

  const setUsage = (id: string, usage: 'Active' | 'Low Use' | 'Idle') => {
    setState({
      subscriptions: state.subscriptions.map(s => s.id === id ? { ...s, usage } : s)
    });
  };

  const confirmKillLeech = (sub: Subscription) => {
    setLeechToKill(sub);
  };

  const executeKillLeech = async () => {
    if (!leechToKill) return;
    const sub = leechToKill;
    
    try {
      await executeLeechKill({
        id: sub.id,
        name: sub.name,
        monthlyCost: sub.amount,
        status: 'ACTIVE',
        dateAdded: Date.now(),
        dateKilled: null
      });
    } catch (e) {
      console.error("Failed to log to IDB", e);
    }

    updateState(prev => {
      const newExp = (prev.stats?.experience || 0) + 50;
      const newLevel = Math.floor(newExp / 1000) + 1;
      const newFixedBills = calculateNewBaselineBills(prev.fixedBills, sub.amount);
      const newGoal = calculateNewWealthTarget(prev.monthlySavingsGoal, sub.amount);
      
      return {
        ...prev,
        subscriptions: prev.subscriptions.filter(s => s.id !== sub.id),
        fixedBills: newFixedBills,
        monthlySavingsGoal: newGoal,
        stats: {
          ...prev.stats,
          experience: newExp,
          level: newLevel,
          leechesKilled: (prev.stats?.leechesKilled || 0) + 1,
          lifetimeCapture: (prev.stats?.lifetimeCapture || 0) + sub.amount
        }
      };
    });
    setLeechToKill(null);
  };

  const submitNewLeech = () => {
    if (!newLeech.name || newLeech.amount <= 0) return;
    const newSub: Subscription = {
      id: Math.random().toString(36).substr(2, 9),
      name: newLeech.name,
      amount: newLeech.amount,
      usage: 'Active',
      billingCycle: 'Monthly'
    };
    updateState(prev => ({
      ...prev,
      subscriptions: [...prev.subscriptions, newSub],
      fixedBills: prev.fixedBills + newLeech.amount
    }));
    setIsAddingLeech(false);
    setNewLeech({ name: '', amount: 0 });
  };

  const getUsageColor = (usage: string) => {
    switch (usage) {
      case 'Active': return 'bg-action-capture text-text-main border-action-capture';
      case 'Low Use': return 'bg-action-target text-text-main border-action-target';
      case 'Idle': return 'bg-action-bleed text-white border-action-bleed';
      default: return 'bg-gray-500 text-white border-gray-500';
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1 }
  };

  return (
    <motion.div 
      className="space-y-8 max-w-4xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <header className="text-center">
        <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter text-action-bleed flex items-center justify-center gap-4 uppercase">
          <Skull size={40} /> Subscription Review
        </h1>
        <p className="text-text-muted font-mono mt-2 uppercase tracking-widest text-[10px]">
          Monitor your subscriptions
        </p>
      </header>

      <motion.div variants={itemVariants} className="text-center py-8">
        <p className="text-xs font-black uppercase opacity-60 tracking-widest mb-2 italic">Total Monthly Subscriptions</p>
        <div className="text-6xl md:text-9xl font-black italic tracking-tighter text-action-bleed drop-shadow-[0_0_15px_rgba(255,0,60,0.5)] leading-none">
          -{formatCurrency(totalBleed, ghostMode)}
        </div>
      </motion.div>

      <motion.div variants={containerVariants} className="space-y-4">
        <AnimatePresence>
          {state.subscriptions.map(sub => (
            <motion.div
              key={sub.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, x: 50 }}
              className="p-4 md:p-6 rounded-[28px] border-4 border-border bg-surface/10 flex flex-col md:flex-row items-center gap-6"
            >
              <div className="flex-1 w-full flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black italic uppercase tracking-tighter italic">{sub.name}</h3>
                  <p className="text-xs font-mono opacity-60 uppercase">{formatCurrency(sub.amount, ghostMode)} / {sub.billingCycle}</p>
                </div>
                
                <div className="flex gap-2">
                  {(['Active', 'Low Use', 'Idle'] as const).map((status) => (
                    <motion.button
                      key={status}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setUsage(sub.id, status)}
                      className={`px-3 py-1 md:py-2 text-[10px] font-black uppercase tracking-widest border-2 rounded-xl transition-all ${
                        sub.usage === status ? getUsageColor(status) : 'border-border text-text-main opacity-40 hover:opacity-100'
                      }`}
                    >
                      {status}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t-2 md:border-t-0 border-border/20">
                <div className="text-2xl font-black italic">
                  {formatCurrency(sub.amount, ghostMode)}
                </div>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => confirmKillLeech(sub)}
                  className="btn-kill w-12 h-12 flex items-center justify-center rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none transition-all ml-auto md:ml-0"
                >
                  <X size={24} strokeWidth={4} />
                </motion.button>
              </div>
            </motion.div>
          ))}

          {state.subscriptions.length === 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 border-4 border-dashed border-action-capture/30 rounded-[32px] bg-action-capture/5"
            >
              <ShieldCheck size={64} className="mx-auto mb-4 text-action-capture" />
              <h3 className="text-2xl font-black italic uppercase text-action-capture">No Subscriptions Found</h3>
              <p className="text-xs font-mono uppercase opacity-60 mt-2">Everything is looking good.</p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div variants={itemVariants} className="pt-8">
           {isAddingLeech ? (
             <div className="p-6 rounded-[28px] border-4 border-action-target bg-action-target/10 flex flex-col md:flex-row items-center gap-4">
                <input 
                  autoFocus
                  placeholder="Subscription Name"
                  className="bg-surface text-text-main border-2 border-border p-3 rounded-xl text-xs font-black uppercase flex-1 w-full outline-none"
                  value={newLeech.name}
                  onChange={e => setNewLeech({...newLeech, name: e.target.value})}
                />
                <input 
                  type="number"
                  placeholder="Monthly Cost"
                  className="bg-surface text-text-main border-2 border-border p-3 rounded-xl text-xs font-black w-full flex-1 md:w-32 uppercase outline-none"
                  value={newLeech.amount === 0 ? '' : newLeech.amount}
                  onChange={e => setNewLeech({...newLeech, amount: parseFloat(e.target.value) || 0})}
                />
                <div className="flex gap-2 w-full md:w-auto">
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsAddingLeech(false)}
                    className="flex-1 md:flex-none px-6 py-3 border-4 border-border bg-surface text-text-main rounded-xl font-black text-xs uppercase"
                  >
                    Cancel
                  </motion.button>
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={submitNewLeech}
                    className="flex-1 md:flex-none px-6 py-3 bg-base text-text-main rounded-xl font-black text-xs uppercase border-4 border-border transition-all"
                  >
                    Add
                  </motion.button>
                </div>
             </div>
           ) : (
             <motion.button 
               whileTap={{ scale: 0.98 }}
               onClick={() => setIsAddingLeech(true)}
               className="w-full py-6 border-4 border-dashed border-border/30 rounded-[28px] font-black uppercase text-xs hover:border-action-target hover:text-action-target transition-all tracking-widest italic"
             >
               + ADD NEW SUBSCRIPTION
             </motion.button>
           )}
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {leechToKill && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-base/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: -20 }}
              className="bg-base w-full max-w-md p-8 rounded-[32px] border-8 border-action-bleed flex flex-col items-center text-center shadow-2xl"
            >
               <div className="w-20 h-20 bg-action-bleed text-white rounded-3xl flex items-center justify-center mb-6 border-4 border-border rotate-12">
                 <Skull size={40} />
               </div>
               <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-2 italic">Cancel Subscription?</h2>
               <p className="text-sm font-mono opacity-80 mb-8 lowercase leading-relaxed">
                 did you actually go to settings and cancel <span className="font-black border-b-2 border-action-bleed">{leechToKill.name}</span>?
               </p>
               <div className="flex gap-4 w-full">
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setLeechToKill(null)}
                    className="flex-1 py-4 bg-surface font-black text-xs uppercase rounded-2xl border-4 border-transparent hover:border-border transition-all"
                  >
                    Go Back
                  </motion.button>
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={executeKillLeech}
                    className="btn-kill flex-1 py-4 font-black text-xs uppercase rounded-2xl tracking-widest"
                  >
                    Yes, its gone
                  </motion.button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
