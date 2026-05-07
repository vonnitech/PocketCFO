import { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Plus, Edit2 } from 'lucide-react';
import BrutalCard from '../components/BrutalCard';
import { useStore } from '../store/useStore';
import { formatCurrency } from '../lib/utils';

import { calculateVaultProgress } from '../core/math';

export default function Vaults() {
  const state = useStore();
  const { vaults, setState, updateState, ghostMode } = state;

  const [isAddingVault, setIsAddingVault] = useState(false);
  const [newVaultName, setNewVaultName] = useState('');
  const [newVaultTarget, setNewVaultTarget] = useState('');
  const [injectAmounts, setInjectAmounts] = useState<Record<string, string>>({});
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [editingTargetValue, setEditingTargetValue] = useState<string>('');

  const submitAddVault = () => {
    if (newVaultName && newVaultTarget) {
      const newVault = {
        id: Date.now().toString(),
        name: newVaultName,
        target: parseFloat(newVaultTarget),
        current: 0
      };
      setState({ vaults: [...vaults, newVault] });
      setIsAddingVault(false);
      setNewVaultName('');
      setNewVaultTarget('');
    }
  };

  const handleInject = (id: string, amount: number) => {
    const targetVault = vaults.find(v => v.id === id);
    updateState((prev: any) => {
      const newTx = {
        id: 'vtx_' + Date.now().toString(),
        merchant: targetVault ? `VAULT: ${targetVault.name}` : 'VAULT_DEPOSIT',
        amount: amount,
        category: 'SAVINGS',
        date: new Date().toISOString(),
        isFlip: false,
        flipAmount: 0
      };

      return {
        ...prev,
        liquidAssets: prev.liquidAssets - amount,
        primaryVaultBalance: prev.primaryVaultBalance + amount,
        vaults: prev.vaults.map((v: any) => v.id === id ? { ...v, current: v.current + amount } : v),
        transactions: [newTx, ...prev.transactions]
      };
    });
  };

  const updateTarget = (id: string, newTarget: number) => {
    updateState(prev => ({
      ...prev,
      vaults: prev.vaults.map(v => v.id === id ? { ...v, target: newTarget } : v)
    }));
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter uppercase glow-green">Vaults</h1>
          <p className="text-text-muted font-mono mt-2 uppercase tracking-widest text-[10px]">Savings & Goals</p>
        </div>
        {isAddingVault ? (
           <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
             <input 
               autoFocus
               placeholder="VAULT NAME"
               className="bg-base border-4 border-border p-2 font-black uppercase text-xs rounded-xl outline-none"
               value={newVaultName}
               onChange={e => setNewVaultName(e.target.value)}
             />
             <input 
               type="number"
               placeholder="TARGET$"
               className="bg-base border-4 border-border p-2 font-black text-xs rounded-xl outline-none"
               value={newVaultTarget}
               onChange={e => setNewVaultTarget(e.target.value)}
             />
             <div className="flex gap-2">
               <button onClick={() => setIsAddingVault(false)} className="px-4 py-2 bg-surface text-text-main border-2 border-border rounded-xl font-black text-xs uppercase hover:bg-border transition-colors">Cancel</button>
               <button onClick={submitAddVault} className="px-4 py-2 bg-border text-text-main rounded-xl font-black text-xs uppercase hover:bg-action-capture hover:text-base transition-colors">Add</button>
             </div>
           </div>
        ) : (
          <button onClick={() => setIsAddingVault(true)} className="px-6 py-3 bg-action-capture text-black font-black uppercase italic tracking-tighter border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center gap-2">
            <Plus size={20} />
            New Vault
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {vaults.map((vault) => {
          const progress = calculateVaultProgress(vault.current, vault.target);
          return (
            <BrutalCard key={vault.id} color="bg-base">
              <div className="space-y-6">
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 bg-black flex items-center justify-center text-action-capture rounded-xl border-4 border-border">
                    <ShieldCheck size={28} />
                  </div>
                  <div className="text-right">
                    <h3 className="text-2xl font-black uppercase tracking-tighter italic">{vault.name}</h3>
                    {editingTargetId === vault.id ? (
                      <div className="flex items-center gap-2 mt-1 justify-end">
                        <input 
                          type="number" 
                          className="w-24 bg-surface text-text-main border border-border rounded text-[10px] p-1 font-mono outline-none text-right"
                          value={editingTargetValue}
                          onChange={(e) => setEditingTargetValue(e.target.value)}
                          onBlur={() => {
                            updateTarget(vault.id, parseFloat(editingTargetValue) || vault.target);
                            setEditingTargetId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              updateTarget(vault.id, parseFloat(editingTargetValue) || vault.target);
                              setEditingTargetId(null);
                            }
                          }}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <p 
                        onClick={() => {
                          setEditingTargetId(vault.id);
                          setEditingTargetValue(vault.target.toString());
                        }}
                        className="text-[10px] font-mono font-bold text-text-muted uppercase cursor-pointer hover:text-text-main transition-colors flex items-center justify-end gap-1"
                        title="Click to edit target"
                      >
                        Target: {formatCurrency(vault.target, ghostMode)} <Edit2 size={10} />
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                   <div className="flex justify-between text-[10px] font-mono font-bold uppercase">
                    <span>Goal Progress</span>
                    <span>{progress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-12 bg-surface border-4 border-black p-1 relative rounded-xl overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, progress)}%` }}
                      className={`h-full bg-action-capture rounded-lg ${progress >= 100 ? 'animate-pulse' : ''}`}
                    />
                    {progress >= 100 && (
                      <div className="absolute inset-0 flex items-center justify-center mix-blend-difference text-white font-black uppercase italic tracking-widest text-xs">
                        Goal Achieved
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center bg-surface/20 p-4 border-4 border-border rounded-2xl">
                  <div>
                    <p className="text-[8px] font-mono text-text-muted uppercase font-black">Currently Stored</p>
                    <p className="text-xl font-black italic">{formatCurrency(vault.current, ghostMode)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-mono text-text-muted uppercase font-black">Remaining</p>
                    <p className="text-xl font-black text-action-bleed italic">{formatCurrency(Math.max(0, vault.target - vault.current), ghostMode)}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input 
                    type="number"
                    placeholder="$ AMT"
                    value={injectAmounts[vault.id] || ''}
                    onChange={(e) => setInjectAmounts({...injectAmounts, [vault.id]: e.target.value})}
                    className="w-24 bg-surface border-2 border-border text-text-main rounded-xl p-2 font-mono text-xs outline-none text-center"
                  />
                  <button 
                    onClick={() => {
                      const amt = parseFloat(injectAmounts[vault.id] || '0');
                      if (amt > 0) handleInject(vault.id, amt);
                      setInjectAmounts({...injectAmounts, [vault.id]: ''});
                    }}
                    className="btn-brutal flex-1 py-3 text-xs text-action-capture shadow-brutal-green hover:bg-border"
                  >
                    Add Funds
                  </button>
                </div>
              </div>
            </BrutalCard>
          );
        })}
      </div>

      <BrutalCard title="Projection" color="bg-action-target">
        <div className="flex flex-col md:flex-row items-center gap-6 text-black font-medium">
          <div className="text-4xl font-black italic uppercase tracking-tighter md:w-1/3 leading-none">
            Secure your future.
          </div>
          <div className="text-[10px] font-mono font-bold leading-relaxed flex-1 uppercase">
            Total Savings across {vaults.length} Vaults: 
            <span className="text-3xl block font-black text-black mt-1 italic">
              {formatCurrency(vaults.reduce((acc, v) => acc + v.current, 0), ghostMode)}
            </span>
            <p className="mt-2 opacity-70">
              Consistent saving will help you reach your goals faster.
            </p>
          </div>
        </div>
      </BrutalCard>
    </div>
  );
}
