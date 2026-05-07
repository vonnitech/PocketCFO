import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Numpad } from '../components/Numpad';
import { ShieldAlert, Crosshair } from 'lucide-react';

export const Terminal: React.FC = () => {
  const [currentInput, setCurrentInput] = useState('0');
  const [isGremlinMode, setIsGremlinMode] = useState(false);
  
  // Pulling live data from our engine
  const safeSpendLimit = useStore((state) => state.safeSpendLimit);
  const primaryVaultBalance = useStore((state) => state.primaryVaultBalance);
  const executeGremlinHit = useStore((state) => state.executeGremlinHit);

  const handleTransaction = () => {
    const amount = parseFloat(currentInput);
    if (isNaN(amount) || amount <= 0) return;

    if (isGremlinMode) {
      // Hardcoded 50% penalty for the prototype, normally pulled from user config
      executeGremlinHit(amount, 0.50); 
    } else {
      useStore.getState().logSpend(amount);
    }
    
    setCurrentInput('0');
    setIsGremlinMode(false); // Reset mode after execution
  };

  return (
    <div className="min-h-screen bg-base text-text-main flex flex-col items-center pt-12">
      
      {/* Top Bar: Vault Status */}
      <div className="w-full px-6 flex justify-between items-end border-b-2 border-border pb-4 mb-8">
        <div>
          <p className="text-text-muted text-xs tracking-widest uppercase">Savings Goal</p>
          <p className="font-mono text-xl text-text-main">${primaryVaultBalance.toFixed(2)}</p>
        </div>
        <div className="text-right">
          <p className="text-text-muted text-xs tracking-widest uppercase">Status</p>
          <p className="font-mono text-sm text-action-capture flex items-center gap-1">
            <Crosshair size={14} /> ACTIVE
          </p>
        </div>
      </div>

      {/* Main Display: The Safe Spend Limit */}
      <div className="flex flex-col items-center mb-12">
        <h2 className="text-text-muted uppercase tracking-[0.3em] text-sm mb-2">
          Daily Limit
        </h2>
        <h1 className="text-7xl font-mono text-action-capture">
          ${safeSpendLimit.toFixed(2)}
        </h1>
      </div>

      {/* Live Input Display */}
      <div className="w-full max-w-md px-4 mb-4">
        <div className={`p-4 border-2 flex justify-between items-center bg-surface ${isGremlinMode ? 'border-action-bleed' : 'border-border'}`}>
          <span className="text-text-muted font-mono">Enter Amount</span>
          <span className={`text-4xl font-mono ${isGremlinMode ? 'text-action-bleed' : 'text-text-main'}`}>
            ${currentInput}
          </span>
        </div>
      </div>

      {/* Mode Toggles */}
      <div className="w-full max-w-md px-4 flex gap-4 mb-4">
        <button 
          onClick={() => setIsGremlinMode(false)}
          className={`flex-1 py-3 text-xs tracking-widest border-2 transition-colors ${!isGremlinMode ? 'bg-text-main text-base border-text-main' : 'border-border text-text-muted'}`}
        >
          Normal
        </button>
        <button 
          onClick={() => setIsGremlinMode(true)}
          className={`flex-1 py-3 text-xs tracking-widest border-2 flex items-center justify-center gap-2 transition-colors ${isGremlinMode ? 'bg-action-bleed text-base border-action-bleed' : 'border-border text-action-bleed'}`}
        >
          <ShieldAlert size={16} /> Penalty
        </button>
      </div>

      {/* The Control Interface */}
      <Numpad 
        value={currentInput} 
        onChange={setCurrentInput} 
        onSubmit={handleTransaction}
        isGremlin={isGremlinMode}
        submitLabel={isGremlinMode ? "Submit with Tax" : "Log Transaction"}
      />

    </div>
  );
};
