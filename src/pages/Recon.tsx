import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Ghost, ChevronRight, CheckCircle2, ArrowRightLeft, ShieldCheck } from 'lucide-react';
import BrutalCard from '../components/BrutalCard';
import { formatCurrency } from '../lib/utils';
import { useStore, Gremlin, ReconEntry } from '../store/useStore';
import { 
  calculateTrueSafeSpend, 
  calculateGremlinPenalty, 
  calculateDailySurplus,
  calculateDailyDrain
} from '../core/math';

type Step = 'RAW_SPEND' | 'HABIT_CHECK' | 'SELECT_HABIT' | 'SUMMARY';

export default function Recon() {
  const state = useStore();
  const { 
    ghostMode,
    updateState,
    gremlins,
    reconHistory,
    setState 
  } = state;

  const [step, setStep] = useState<Step>('RAW_SPEND');
  const [rawSpend, setRawSpend] = useState('');
  const [selectedGremlinId, setSelectedGremlinId] = useState<string | null>(null);
  const [gremlinSpend, setGremlinSpend] = useState('');
  const [completed, setCompleted] = useState(false);

  const [isAddingGremlin, setIsAddingGremlin] = useState(false);
  const [newGremlinName, setNewGremlinName] = useState('');

  const submitNewGremlin = () => {
    if (newGremlinName.trim()) {
      const newGremlin: Gremlin = { id: Math.random().toString(36).substr(2, 9), name: newGremlinName.trim(), taxRate: 0.5 };
      setState({ gremlins: [...gremlins, newGremlin] });
    }
    setIsAddingGremlin(false);
    setNewGremlinName('');
  };

  const today = new Date().toLocaleDateString();
  const alreadyDoneToday = reconHistory.some(entry => entry.date === today);

  const safeSpendLimit = useMemo(() => calculateTrueSafeSpend(state), [state]);

  const transactionsToday = useMemo(() => {
    const todayStr = new Date().toLocaleDateString();
    return state.transactions.filter(t => new Date(t.date).toLocaleDateString() === todayStr);
  }, [state.transactions]);

  const recordedDailyDrain = useMemo(() => calculateDailyDrain(transactionsToday), [transactionsToday]);

  // If user hasn't typed anything, we show the recorded drain
  const displayRawSpend = rawSpend === '' ? recordedDailyDrain.toString() : rawSpend;

  const taxAmount = useMemo(() => {
    if (!selectedGremlinId || !gremlinSpend) return 0;
    const gremlin = gremlins.find(g => g.id === selectedGremlinId);
    if (!gremlin) return 0;
    return calculateGremlinPenalty(parseFloat(gremlinSpend), gremlin.taxRate);
  }, [selectedGremlinId, gremlinSpend, gremlins]);

  const surplus = useMemo(() => {
    const spent = parseFloat(displayRawSpend || '0');
    return calculateDailySurplus(safeSpendLimit, spent + taxAmount);
  }, [safeSpendLimit, displayRawSpend, taxAmount]);

  const handleAction = (action: 'roll' | 'stash') => {
    const finalSpend = parseFloat(displayRawSpend);
    const newEntry: ReconEntry = {
      id: Math.random().toString(36).substr(2, 9),
      date: today,
      rawSpend: finalSpend,
      gremlinSpend: parseFloat(gremlinSpend || '0'),
      taxAmount: taxAmount,
      surplus: surplus,
      action: action,
      gremlinId: selectedGremlinId || undefined
    };

    updateState(prev => {
      const nextVaults = [...prev.vaults];
      let nextRolloverPool = prev.rolloverPool;

      if (action === 'roll') {
        nextRolloverPool = surplus;
        if (taxAmount > 0 && nextVaults.length > 0) {
          nextVaults[0].current = Math.max(0, nextVaults[0].current + taxAmount);
        }
      } else {
        if (nextVaults.length > 0) {
          nextVaults[0].current = Math.max(0, nextVaults[0].current + surplus + taxAmount);
        }
        nextRolloverPool = 0;
      }

      const gainedXP = action === 'roll' && surplus > 0 ? 10 : 0;
      const newExp = (prev.stats?.experience || 0) + gainedXP;
      const newLevel = Math.floor(newExp / 1000) + 1;

      return {
        ...prev,
        vaults: nextVaults,
        rolloverPool: nextRolloverPool,
        reconHistory: [...prev.reconHistory, newEntry],
        stats: {
          ...prev.stats,
          experience: newExp,
          level: newLevel,
          lifetimeCapture: (prev.stats?.lifetimeCapture || 0) + taxAmount
        }
      };
    });

    setCompleted(true);
  };

  const resetReconForTesting = () => {
    setState({
      reconHistory: reconHistory.filter(entry => entry.date !== today)
    });
    setCompleted(false);
    setStep('RAW_SPEND');
    setRawSpend('');
    setSelectedGremlinId(null);
    setGremlinSpend('');
  };

  if (alreadyDoneToday || completed) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-24 h-24 rounded-full bg-action-capture/20 flex items-center justify-center border-4 border-action-capture">
          <CheckCircle2 size={48} className="text-action-capture" />
        </div>
        <div className="text-center">
          <h2 className="text-3xl font-black italic tracking-tighter uppercase">Review Complete</h2>
          <p className="text-text-muted font-mono uppercase tracking-widest text-[10px] mt-2">Finish line reached for {today}</p>
        </div>
        <BrutalCard title="Results" color="bg-surface" className="w-full max-w-md">
           <div className="space-y-3">
              <div className="flex justify-between text-xs font-black uppercase">
                <span className="opacity-60">Status</span>
                <span className="text-action-capture">Success</span>
              </div>
              <div className="flex justify-between text-xs font-black uppercase">
                <span className="opacity-60">Daily Surplus</span>
                <span>{formatCurrency(surplus, ghostMode)}</span>
              </div>
              <div className="flex justify-between text-xs font-black uppercase">
                <span className="opacity-60">Gremlin Tax Collected</span>
                <span className={taxAmount > 0 ? "text-action-bleed" : ""}>{formatCurrency(taxAmount, ghostMode)}</span>
              </div>
           </div>
        </BrutalCard>
        <button 
          onClick={resetReconForTesting}
          className="mt-8 text-[10px] font-mono text-text-muted hover:text-text-main underline tracking-widest uppercase"
        >
          [DEBUG] Reset Today's Recon
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <header className="text-center">
        <h1 className="text-4xl font-black italic tracking-tighter text-action-capture uppercase">Daily Review</h1>
        <p className="text-text-muted font-mono mt-2 uppercase tracking-widest text-[10px]">Financial awareness gathering // {today}</p>
      </header>

      <AnimatePresence mode="wait">
        {step === 'RAW_SPEND' && (
          <motion.div
            key="raw-spend"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <BrutalCard title="Today's Spending" color="bg-action-capture/10">
              <div className="space-y-6">
                <div className="text-center">
                   <p className="text-[10px] font-black uppercase opacity-60 mb-2">Target Daily Budget</p>
                   <p className="font-mono text-5xl md:text-7xl font-black italic tracking-tighter text-action-capture">{formatCurrency(safeSpendLimit, ghostMode)}</p>
                </div>
                
                <div className="relative group">
                  <span className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 text-2xl md:text-4xl font-black italic text-text-muted/20 group-focus-within:text-text-muted/50 transition-colors pointer-events-none">$</span>
                  <input 
                    autoFocus
                    type="number"
                    placeholder="Today's Spending"
                    className="w-full bg-base border-4 border-border rounded-3xl p-6 md:p-8 pl-10 md:pl-16 text-3xl md:text-5xl font-black italic outline-none text-center placeholder:text-text-muted/20 placeholder:text-xl md:placeholder:text-4xl shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] focus:shadow-none focus:translate-x-1 focus:translate-y-1 transition-all"
                    value={displayRawSpend}
                    onChange={(e) => setRawSpend(e.target.value)}
                  />
                </div>

                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  disabled={!displayRawSpend}
                  onClick={() => setStep('HABIT_CHECK')}
                  className="btn-brutal w-full py-6 text-action-target shadow-brutal flex items-center justify-center gap-2 group hover:text-base transition-all text-xl"
                >
                  Continue <ChevronRight size={24} className="group-hover:translate-x-2 transition-transform" />
                </motion.button>
              </div>
            </BrutalCard>
          </motion.div>
        )}

        {step === 'HABIT_CHECK' && (
          <motion.div
            key="habit-check"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <BrutalCard title="Habit Check" color="bg-action-bleed/10">
              <div className="space-y-8 py-4">
                <div className="flex justify-center">
                  <div className="p-6 rounded-full bg-action-bleed/20 border-4 border-action-bleed text-action-bleed animate-pulse">
                    <Ghost size={64} />
                  </div>
                </div>
                
                <h3 className="text-2xl font-black italic text-center uppercase tracking-tight px-4">Any extra spending on habits today?</h3>
                
                <div className="grid grid-cols-2 gap-4 px-4">
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setStep('SUMMARY')}
                    className="py-12 border-4 border-border font-black uppercase tracking-widest text-xl hover:bg-action-capture/20 hover:border-action-capture transition-all rounded-3xl"
                  >
                    No
                  </motion.button>
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setStep('SELECT_HABIT')}
                    className="btn-brutal py-12 text-action-bleed shadow-brutal text-xl"
                  >
                    Yes
                  </motion.button>
                </div>
              </div>
            </BrutalCard>
          </motion.div>
        )}

        {step === 'SELECT_HABIT' && (
          <motion.div
            key="select-habit"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <BrutalCard title="Select Habit" color="bg-action-bleed/10">
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-2">
                  {gremlins.length > 0 ? (
                    gremlins.map(g => (
                      <button 
                        key={g.id}
                        onClick={() => setSelectedGremlinId(g.id)}
                        className={`p-4 rounded-2xl border-4 transition-all flex justify-between items-center ${
                          selectedGremlinId === g.id 
                            ? 'border-action-bleed bg-action-bleed text-white shadow-xl' 
                            : 'border-black hover:bg-black hover:text-white dark:border-border dark:hover:bg-border'
                        }`}
                      >
                        <span className="font-black italic uppercase">{g.name}</span>
                        <span className="font-mono text-[10px] font-bold">{(g.taxRate * 100)}% tax</span>
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-12 border-4 border-dashed border-border/20 rounded-3xl space-y-4">
                       <Ghost size={48} className="mx-auto mb-4 opacity-20" />
                       <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase opacity-60">No habits identified.</p>
                        <p className="text-[8px] font-mono uppercase">Define your habits in settings to enable tracking.</p>
                       </div>
                       {isAddingGremlin ? (
                         <div className="flex gap-2 justify-center max-w-xs mx-auto px-4">
                           <input 
                             autoFocus
                             className="bg-surface border-2 border-border p-2 rounded-xl text-center text-xs font-black uppercase w-full"
                             placeholder="Habit Name"
                             value={newGremlinName}
                             onChange={(e) => setNewGremlinName(e.target.value)}
                           />
                           <motion.button 
                             whileTap={{ scale: 0.9 }}
                             onClick={submitNewGremlin}
                             className="px-4 py-2 bg-text-main text-base rounded-xl font-black text-xs uppercase"
                           >
                             ADD
                           </motion.button>
                         </div>
                       ) : (
                         <motion.button 
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setIsAddingGremlin(true)}
                          className="px-6 py-2 bg-text-main text-base text-[10px] font-black uppercase rounded-full"
                         >
                           + Quick Add Habit
                         </motion.button>
                       )}
                    </div>
                  )}
                </div>

                {selectedGremlinId && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 pt-4"
                  >
                    <p className="text-[10px] font-black uppercase opacity-60 text-center">Amount spent on this habit</p>
                    <div className="relative">
                      <input 
                        type="number"
                        placeholder="0.00"
                        value={gremlinSpend}
                        onChange={(e) => setGremlinSpend(e.target.value)}
                        className="w-full bg-surface border-4 border-border p-4 text-3xl font-black italic outline-none text-center"
                      />
                    </div>
                  </motion.div>
                )}

                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  disabled={!selectedGremlinId || !gremlinSpend}
                  onClick={() => setStep('SUMMARY')}
                  className="w-full py-6 bg-text-main text-base font-black italic uppercase tracking-widest flex items-center justify-center gap-2 group border-4 border-border"
                >
                  Apply Penalty <ChevronRight size={24} />
                </motion.button>
              </div>
            </BrutalCard>
          </motion.div>
        )}

        {step === 'SUMMARY' && (
          <motion.div
            key="summary"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <BrutalCard title="Summary" color="bg-action-target">
              <div className="space-y-6 text-black">
                 <div className="flex flex-col gap-4">
                   <div className="flex justify-between items-center border-b-2 border-black/10 pb-2">
                     <span className="text-[10px] font-black uppercase opacity-60">Daily Budget</span>
                     <span className="font-black">{formatCurrency(safeSpendLimit, ghostMode)}</span>
                   </div>
                   <div className="flex justify-between items-center border-b-2 border-black/10 pb-2">
                     <span className="text-[10px] font-black uppercase opacity-60">Total Spent</span>
                     <span className="font-black">-{formatCurrency(parseFloat(displayRawSpend || '0'), ghostMode)}</span>
                   </div>
                   {taxAmount > 0 && (
                     <div className="flex justify-between items-center border-b-2 border-action-bleed/20 pb-2 text-action-bleed">
                       <span className="text-[10px] font-black uppercase opacity-80">Extra Savings (Tax)</span>
                       <span className="font-black">-{formatCurrency(taxAmount, ghostMode)}</span>
                     </div>
                   )}
                   <div className="flex justify-between items-center pt-2">
                     <span className="text-xl font-black italic uppercase tracking-tighter">Remaining</span>
                     <span className={`text-4xl font-black italic tracking-tighter ${surplus >= 0 ? 'text-action-capture' : 'text-action-bleed'}`}>
                       {formatCurrency(surplus, ghostMode)}
                     </span>
                   </div>
                </div>

                <div className="space-y-3 pt-6 border-t-4 border-black">
                   <p className="text-[10px] font-black uppercase text-center mb-4 italic">Finish Review:</p>
                   {taxAmount > 0 && (
                     <div className="bg-black/5 p-4 rounded-2xl border-2 border-black/10 mb-4">
                        <div className="flex items-center gap-3 mb-2">
                           <ShieldCheck size={20} className="text-action-capture" />
                           <span className="text-[10px] font-black uppercase tracking-tighter">Savings Capture</span>
                        </div>
                        <p className="text-[10px] opacity-70 leading-relaxed font-medium">
                          The {formatCurrency(taxAmount, ghostMode)} extra savings will be added to your vault.
                        </p>
                     </div>
                   )}
                   <div className="grid grid-cols-2 gap-4">
                      <motion.button 
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleAction('roll')}
                        className="flex flex-col items-center gap-2 p-6 border-4 border-black rounded-3xl hover:bg-white transition-all bg-white/50"
                      >
                         <ArrowRightLeft size={32} />
                         <span className="font-black uppercase text-[10px]">Roll Over</span>
                      </motion.button>
                      <motion.button 
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleAction('stash')}
                        className="flex flex-col items-center gap-2 p-6 bg-black text-action-target border-4 border-black rounded-3xl hover:bg-gray-900 transition-all"
                      >
                         <ShieldCheck size={32} />
                         <span className="font-black uppercase text-[10px]">{taxAmount > 0 ? 'Save All' : 'Save Surplus'}</span>
                      </motion.button>
                   </div>
                </div>
              </div>
            </BrutalCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
