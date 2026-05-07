import React, { useState, useMemo } from 'react';
import { Numpad } from '../components/Numpad';
import { Users, CheckCircle2, Trash2, Heart } from 'lucide-react';
import { useStore } from '../store/useStore';
import { saveSplitTransaction } from '../db';
import { SplitTransaction, CustomSplitPreset } from '../types/split';

export const TacticalSplitter: React.FC = () => {
  const { squad, addSplitTransaction, safeSpendLimit, customSplitPresets, saveSplitPreset, deleteSplitPreset } = useStore();
  const [currentInput, setCurrentInput] = useState('0');
  const [activeMembers, setActiveMembers] = useState<Set<string>>(new Set(squad.filter(m => m.isActive).map(m => m.id)));
  const [receiptMode, setReceiptMode] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // The Calculation Core
  const totalBill = parseFloat(currentInput) || 0;
  const memberCount = activeMembers.size + 1; 
  
  const metrics = useMemo(() => {
    if (totalBill === 0) return { base: 0, flip: 0, hit: 0 };
    const baseShare = totalBill / memberCount;
    const flipObligation = baseShare * 0.20;
    return {
      base: baseShare,
      flip: flipObligation,
      hit: baseShare + flipObligation
    };
  }, [totalBill, memberCount]);

  const toggleMember = (id: string) => {
    setActivePresetId(null);
    setActiveMembers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyPreset = (preset: CustomSplitPreset) => {
    setActiveMembers(new Set(preset.participantIds));
    setActivePresetId(preset.id);
  };

  const handleSavePreset = () => {
    if (!presetNameInput.trim()) return;
    const newPreset: CustomSplitPreset = {
      id: crypto.randomUUID(),
      name: presetNameInput.trim().toUpperCase(),
      participantIds: Array.from(activeMembers)
    };
    saveSplitPreset(newPreset);
    setPresetNameInput('');
    setIsSavingPreset(false);
    setActivePresetId(newPreset.id);
  };

  const executeSplit = async () => {
    if (totalBill <= 0 || executing) return;
    setExecuting(true);

    const activePreset = customSplitPresets.find(p => p.id === activePresetId);

    const splitData: SplitTransaction = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      presetUsed: activePreset ? activePreset.name : 'CUSTOM',
      totalBill: totalBill,
      participants: squad.filter(m => activeMembers.has(m.id)),
      breakdown: {
        activeMemberCount: memberCount,
        baseSharePerPerson: metrics.base,
        flipObligationPerPerson: metrics.flip,
        totalHitPerPerson: metrics.hit,
      },
      personalDeduction: metrics.hit,
      personalFlipCaptured: metrics.flip,
      isSettled: false,
    };

    try {
      addSplitTransaction(splitData);
      const safeSpendAfter = safeSpendLimit - metrics.hit;
      await saveSplitTransaction(splitData, safeSpendAfter);
      setReceiptMode(true);
      setCurrentInput('0');
    } catch (error) {
      console.error('Split Failed:', error);
    } finally {
      setExecuting(false);
    }
  };

  if (receiptMode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-base">
        <div className="card-brutal max-w-sm w-full p-8 bg-surface border-border">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-8 flex items-center gap-2">
            <CheckCircle2 size={24} className="text-action-capture" /> Split Successful
          </h2>
          
          <div className="space-y-8 mb-12">
            <div className="border-l-4 border-border pl-4">
              <p className="text-text-muted uppercase text-[10px] font-black tracking-widest mb-1">Total Shared</p>
              <p className="text-4xl font-black italic tracking-tighter">${totalBill.toFixed(2)}</p>
            </div>

            <div className="bg-action-capture/10 border-2 border-action-capture p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-action-capture mb-2 flex items-center gap-2">
                <Heart size={12} className="fill-action-capture" /> SAVINGS CAPTURED
              </p>
              <p className="text-3xl font-black italic tracking-tighter text-black">+${metrics.flip.toFixed(2)}</p>
              <p className="text-[10px] text-black/60 font-medium uppercase mt-2">Automatically saved for you.</p>
            </div>
          </div>

          <button 
            onClick={() => setReceiptMode(false)}
            className="w-full btn-brutal bg-black text-white"
          >
            DONE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 max-w-5xl mx-auto py-8">
      
      {/* Top Readout */}
      <header className="border-b-4 border-border pb-8">
        <div className="flex items-center gap-2 mb-2 text-text-muted font-bold tracking-widest uppercase text-xs">
          <Users size={16} /> THE FAIR SHARE
        </div>
        <div className="flex justify-between items-end">
          <span className="text-7xl md:text-9xl font-black italic tracking-tighter leading-none">
            ${currentInput}
          </span>
          <div className="text-right">
            <p className="text-text-muted text-[10px] font-black uppercase tracking-widest">Your Portion</p>
            <p className="text-3xl font-black italic tracking-tighter">
              -${metrics.hit.toFixed(2)}
            </p>
          </div>
        </div>
      </header>

      {/* The Squad Selection */}
      <section className="space-y-6">
        <div className="flex justify-between items-center border-l-8 border-action-capture pl-4">
          <div>
            <h3 className="text-xl font-black italic uppercase tracking-tighter">THE SQUAD</h3>
            <p className="text-text-muted text-[10px] font-bold uppercase tracking-widest">Who are we splitting with?</p>
          </div>
          {!isSavingPreset && (
            <button 
              onClick={() => setIsSavingPreset(true)}
              className="text-[10px] font-black uppercase border-b-2 border-current hover:text-action-capture transition-colors"
            >
              SAVE GROUP
            </button>
          )}
        </div>

        {isSavingPreset && (
          <div className="card-brutal border-action-capture bg-action-capture/5 animate-in zoom-in-95 duration-200">
            <p className="text-xs font-black uppercase tracking-widest mb-4">Name this group</p>
            <div className="flex gap-4">
              <input 
                autoFocus
                type="text" 
                placeholder="e.g. Dinner Crew"
                className="flex-1 bg-surface border-4 border-border p-4 font-black italic text-xl uppercase outline-none focus:border-action-capture transition-colors"
                value={presetNameInput}
                onChange={(e) => setPresetNameInput(e.target.value)}
              />
              <button 
                onClick={handleSavePreset}
                className="btn-brutal bg-action-capture text-black"
              >
                SAVE
              </button>
            </div>
            <button onClick={() => setIsSavingPreset(false)} className="text-[10px] uppercase font-bold text-text-muted mt-4 underline underline-offset-4">CANCEL</button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border-4 border-action-capture bg-action-capture text-black p-4 h-28 flex flex-col justify-center items-center relative shadow-brutal">
            <span className="text-[10px] font-black uppercase mb-1">HOST</span>
            <span className="text-2xl font-black italic tracking-tighter">Main User</span>
          </div>
          
          {squad.map((member, idx) => {
            const isActive = activeMembers.has(member.id);
            return (
              <button
                key={member.id}
                onClick={() => toggleMember(member.id)}
                className={`border-4 h-28 flex flex-col items-center justify-center transition-all p-4 relative
                  ${isActive 
                    ? 'border-border bg-surface shadow-brutal' 
                    : 'border-border/10 bg-transparent text-text-muted hover:border-border'
                  }
                `}
              >
                <span className="text-[10px] font-bold uppercase mb-1 opacity-50">Member 0{idx + 1}</span>
                <span className="text-2xl font-black italic tracking-tighter uppercase">{member.name}</span>
                {isActive && <div className="absolute top-0 right-0 w-3 h-3 bg-action-capture border-l-2 border-b-2 border-black"></div>}
              </button>
            );
          })}
        </div>
      </section>

      {/* Preset List */}
      {customSplitPresets.length > 0 && (
        <section className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted border-b-2 border-border/10 pb-2">Saved Groups</p>
          <div className="flex flex-wrap gap-3">
            {customSplitPresets.map((preset) => (
              <div key={preset.id} className="relative group">
                <button
                  onClick={() => applyPreset(preset)}
                  className={`px-6 py-3 border-2 font-black italic text-xs uppercase tracking-tight transition-all
                    ${activePresetId === preset.id 
                      ? 'bg-action-capture border-black shadow-brutal-sm -translate-x-1 -translate-y-1' 
                      : 'bg-surface border-border hover:border-black'
                    }
                  `}
                >
                  {preset.name} <span className="ml-2 font-mono text-[10px] opacity-40">({preset.participantIds.length + 1})</span>
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteSplitPreset(preset.id); }}
                  className="absolute -right-2 -top-2 w-6 h-6 rounded-full bg-base border-2 border-border flex items-center justify-center text-text-muted hover:text-action-bleed hover:border-action-bleed opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Input */}
      <section className="pt-12 pb-24">
        <div className="card-brutal border-border p-0 overflow-hidden">
          <Numpad 
            value={currentInput} 
            onChange={setCurrentInput} 
            onSubmit={executeSplit}
            submitLabel="Complete Split"
          />
        </div>
      </section>

    </div>
  );
};
