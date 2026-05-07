import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { ChevronRight, ChevronLeft, DollarSign, Building2, TrendingUp, Target, Zap } from 'lucide-react';

export default function Onboarding() {
  const updateState = useStore(s => s.updateState);
  const [phase, setPhase] = useState(1);
  
  // Phase Data
  const [takeHome, setTakeHome] = useState('');
  const [bills, setBills] = useState('');
  const [savingsGoal, setSavingsGoal] = useState('');
  const [vaultName, setVaultName] = useState('');
  const [vaultTarget, setVaultTarget] = useState('');

  const handleFinish = () => {
    const numCapital = parseFloat(takeHome) || 0;
    const numBurn = parseFloat(bills) || 0;
    const numSavingsGoal = parseFloat(savingsGoal) || 0;
    const numVaultTarget = parseFloat(vaultTarget) || 0;
    
    updateState(prev => {
      prev.monthlyTakeHome = numCapital;
      prev.fixedBills = numBurn;
      prev.monthlySavingsGoal = numSavingsGoal;
      
      prev.hasCompletedOnboarding = true;
      prev.isConfigured = true;
      prev.liquidAssets = numCapital;
      prev.fixedBurn = numBurn;
      
      const discretionary = Math.max(0, numCapital - numBurn - numSavingsGoal);
      prev.safeSpendLimit = discretionary / 30;
      prev.primaryVaultBalance = numSavingsGoal;

      if (vaultName && numVaultTarget > 0) {
        prev.vaults = [{
          id: 'v_' + Math.random().toString(36).substr(2, 9),
          name: vaultName,
          target: numVaultTarget,
          current: 0,
          color: 'bg-action-target'
        }];
      }

      return prev;
    });
  };

  // Prevent scroll during onboarding
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  return (
    <div className="fixed inset-0 bg-[#f4f6f5] flex flex-col pt-8 md:pt-12 px-4 z-50 overflow-y-auto"
         style={{
           backgroundImage: 'radial-gradient(circle, #00000015 1.5px, transparent 1.5px)',
           backgroundSize: '24px 24px'
         }}>
      
      <div className="max-w-md w-full mx-auto flex flex-col gap-6 relative min-h-0 pb-8">
        
        {/* Header */}
        <div className="px-2">
          <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tighter leading-[0.9]">
            <div className="text-black italic">SECURE</div>
            <div className="text-action-target italic">THE BAG.</div>
          </h1>
          
          <div className="mt-8 relative">
            <div className="flex justify-between items-center mb-2 px-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black">SYSTEM CONFIG</span>
              <span className="bg-black text-white text-[10px] font-black px-3 py-1 rounded-full uppercase">{phase} / 4</span>
            </div>
            <div className="h-4 border-[3px] border-black rounded-full bg-white overflow-hidden flex">
              <motion.div 
                className="h-full bg-action-target border-r-[3px] border-black"
                animate={{ width: `${(phase / 4) * 100}%` }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            </div>
          </div>
        </div>

        {/* Dynamic Card Area */}
        <div className="bg-white border-[4px] md:border-[6px] border-black rounded-[40px] p-6 md:p-8 shrink-0 flex flex-col shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] overflow-hidden min-h-[360px]">
          <AnimatePresence mode="wait">
             {phase === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-6"
              >
                <div className="self-start px-4 py-1.5 bg-[#c084fc] border-[3px] border-black rounded-full text-white text-[10px] font-black tracking-widest uppercase">
                  STEP 01: INCOMING
                </div>
                
                <div>
                  <h2 className="text-4xl font-black uppercase leading-none tracking-[0em] flex items-center gap-3 italic text-black">
                    <DollarSign className="text-[#c084fc]" size={36} strokeWidth={4} />
                    MONTHLY<br/>TAKE-HOME
                  </h2>
                  <p className="mt-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Target: Your actual after-tax cash.</p>
                </div>

                <div className="relative mt-4">
                  <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                    <span className="text-3xl font-black text-gray-300">$</span>
                  </div>
                  <input 
                    type="number"
                    className="w-full bg-[#f4f6f5] border-[4px] border-black rounded-2xl p-6 pl-14 text-4xl font-black outline-none focus:border-[#c084fc] focus:bg-white transition-colors text-black"
                    placeholder="0.00"
                    value={takeHome}
                    onChange={e => setTakeHome(e.target.value)}
                    autoFocus
                  />
                </div>
              </motion.div>
            )}

            {phase === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-6"
              >
                <div className="self-start px-4 py-1.5 bg-action-bleed border-[3px] border-black rounded-full text-white text-[10px] font-black tracking-widest uppercase">
                  STEP 02: THE BLEED
                </div>
                
                <div>
                  <h2 className="text-4xl font-black uppercase leading-none tracking-[0em] flex items-center gap-3 italic text-black">
                    <Building2 className="text-action-bleed shrink-0" size={32} strokeWidth={3} />
                    TOTAL FIXED<br/>MONTHLY BILLS
                  </h2>
                  <p className="mt-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Rent, Utilities, Debt Minimums.</p>
                </div>

                <div className="relative mt-4">
                  <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                    <span className="text-3xl font-black text-gray-300">$</span>
                  </div>
                  <input 
                    type="number"
                    className="w-full bg-[#f4f6f5] border-[4px] border-action-bleed rounded-2xl p-6 pl-14 text-4xl font-black outline-none focus:border-action-bleed focus:bg-white transition-colors text-black"
                    placeholder="0"
                    value={bills}
                    onChange={e => setBills(e.target.value)}
                    autoFocus
                  />
                </div>
              </motion.div>
            )}

            {phase === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-6"
              >
                <div className="self-start px-4 py-1.5 bg-[#facc15] border-[3px] border-black rounded-full text-black text-[10px] font-black tracking-widest uppercase">
                  STEP 03: FUTURE-PROOF
                </div>
                
                <div>
                  <h2 className="text-4xl font-black uppercase leading-none tracking-[0em] flex items-center gap-3 italic text-black">
                    <TrendingUp className="text-[#10b981] shrink-0" size={36} strokeWidth={4} />
                    MONTHLY<br/>SAVINGS GOAL
                  </h2>
                  <p className="mt-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Pay yourself first. Target ~20%.</p>
                </div>

                <div className="relative mt-4">
                  <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                    <span className="text-3xl font-black text-gray-300">$</span>
                  </div>
                  <input 
                    type="number"
                    className="w-full bg-[#f4f6f5] border-[4px] border-[#facc15] rounded-2xl p-6 pl-14 text-4xl font-black outline-none focus:border-[#facc15] focus:bg-white transition-colors text-black"
                    placeholder="0"
                    value={savingsGoal}
                    onChange={e => setSavingsGoal(e.target.value)}
                    autoFocus
                  />
                  <div className="mt-3 text-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase">Recommended: ${Math.round((parseFloat(takeHome) || 0) * 0.2)}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {phase === 4 && (
              <motion.div 
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-6"
              >
                <div className="self-start px-4 py-1.5 bg-action-target border-[3px] border-black rounded-full text-white text-[10px] font-black tracking-widest uppercase">
                  STEP 04: LOCK TARGET
                </div>
                
                <div>
                  <h2 className="text-4xl font-black uppercase leading-none tracking-[0em] flex items-start gap-3 italic text-black">
                    <Target className="text-action-target mt-1 shrink-0" size={32} strokeWidth={4} />
                    YOUR PRIMARY<br/>VAULT GOAL
                  </h2>
                  <p className="mt-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Name it. Price it. Crush it.</p>
                </div>

                <div className="flex flex-col gap-4 mt-2">
                  <input 
                    type="text"
                    className="w-full bg-[#f4f6f5] border-[4px] border-action-target rounded-2xl p-4 text-xl font-black uppercase outline-none focus:border-action-target focus:bg-white transition-colors text-black placeholder:text-gray-400"
                    placeholder="E.G. DREAM CAR, TRIP..."
                    value={vaultName}
                    onChange={e => setVaultName(e.target.value)}
                    autoFocus
                  />
                  
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="text-xl font-black text-gray-400">$</span>
                    </div>
                    <input 
                      type="number"
                      className="w-full bg-[#f4f6f5] border-[4px] border-black rounded-2xl p-4 pl-10 text-xl font-black outline-none focus:border-action-target focus:bg-white transition-colors text-black placeholder:text-gray-400"
                      placeholder="Target Amount"
                      value={vaultTarget}
                      onChange={e => setVaultTarget(e.target.value)}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-4 pb-8">
           {phase > 1 && (
             <button 
               onClick={() => setPhase(p => p - 1)}
               className="w-16 h-16 shrink-0 flex items-center justify-center border-[4px] border-black rounded-2xl bg-white group hover:bg-gray-50 active:translate-y-1 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
               aria-label="Previous step"
             >
               <ChevronLeft size={32} strokeWidth={4} className="text-black group-hover:-translate-x-1 transition-transform" />
             </button>
           )}
           {phase < 4 ? (
             <button 
               onClick={() => setPhase(p => p + 1)}
               className="flex-1 flex items-center justify-center gap-2 border-[4px] border-black bg-black text-[#facc15] font-black uppercase tracking-widest text-xl rounded-full hover:bg-gray-900 active:translate-y-1 transition-all h-16 shadow-[4px_4px_0px_0px_#facc15] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
             >
               NEXT STEP <ChevronRight strokeWidth={4} size={24} />
             </button>
           ) : (
             <button 
               onClick={handleFinish}
               className="flex-1 flex items-center justify-center gap-2 border-[4px] border-black bg-action-target text-black font-black uppercase tracking-widest text-xl rounded-full hover:brightness-105 active:translate-y-1 transition-all h-16 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px]"
             >
               BOOT SYSTEM <Zap strokeWidth={4} size={24} />
             </button>
           )}
        </div>

      </div>
    </div>
  );
}
