import React, { useState, useMemo } from 'react';
import { Numpad } from '../components/Numpad';
import { Users, CheckCircle2, Trash2, Plus, Pencil, Check, X } from 'lucide-react';
import { useStore, IouEntry } from '../store/useStore';
import { saveSplitTransaction } from '../db';
import { SplitTransaction, CustomSplitPreset } from '../types/split';
import { calculateTacticalSplit } from '../core/math';

export const TacticalSplitter: React.FC = () => {
  const {
    squad,
    addSplitTransaction, safeSpendLimit,
    customSplitPresets, saveSplitPreset, deleteSplitPreset,
    addSquadMember, updateSquadMember, removeSquadMember,
    iouLedger, collectIou, appendIouEntries,
  } = useStore();

  const [currentInput, setCurrentInput] = useState('0');
  const [activeMembers, setActiveMembers] = useState<Set<string>>(
    new Set(squad.filter(m => m.isActive).map(m => m.id))
  );
  const [receiptMode, setReceiptMode] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [receiptSnapshot, setReceiptSnapshot] = useState<{ bill: number; base: number; flip: number; total: number } | null>(null);

  // Squad management state
  const [manageMode, setManageMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);

  // Preset state
  const [presetNameInput, setPresetNameInput] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  const totalBill = parseFloat(currentInput) || 0;
  // +1 for "You" (always included)
  const totalPeople = activeMembers.size + 1;

  const metrics = useMemo(() => {
    return calculateTacticalSplit(totalBill, totalPeople);
  }, [totalBill, totalPeople]);

  const toggleMember = (id: string) => {
    setActivePresetId(null);
    setActiveMembers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const confirmEdit = () => {
    if (editingId && editingName.trim()) {
      updateSquadMember(editingId, editingName);
    }
    setEditingId(null);
    setEditingName('');
  };

  const confirmAdd = () => {
    if (newMemberName.trim()) {
      addSquadMember(newMemberName);
      setNewMemberName('');
      setShowAddInput(false);
    }
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
      participantIds: Array.from(activeMembers),
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
      totalBill,
      participants: squad.filter(m => activeMembers.has(m.id)),
      breakdown: metrics,
      personalDeduction: metrics.baseSharePerPerson,
      personalFlipCaptured: metrics.flipObligationPerPerson,
      isSettled: false,
    };
    try {
      addSplitTransaction(splitData);
      const iouEntries: IouEntry[] = squad
        .filter(m => activeMembers.has(m.id))
        .map(m => ({
          id: crypto.randomUUID(),
          memberName: m.name,
          memberId: m.id,
          amount: metrics.baseSharePerPerson,
          splitId: splitData.id,
          date: splitData.timestamp,
        }));
      if (iouEntries.length > 0) appendIouEntries(iouEntries);
      await saveSplitTransaction(splitData, safeSpendLimit - metrics.totalHitPerPerson);
      setReceiptSnapshot({
        bill: totalBill,
        base: metrics.baseSharePerPerson,
        flip: metrics.flipObligationPerPerson,
        total: metrics.totalHitPerPerson,
      });
      setReceiptMode(true);
      setCurrentInput('0');
    } catch (error) {
      console.error('Split Failed:', error);
    } finally {
      setExecuting(false);
    }
  };

  if (receiptMode && receiptSnapshot) {
    const s = receiptSnapshot;
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">Fair Share</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">Split complete</p>
        </div>
        <div className="bg-surface border-4 border-action-capture rounded-3xl p-6 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={24} className="text-action-capture" strokeWidth={3} />
            <h2 className="text-xl font-black italic uppercase tracking-tighter text-text-main">Split Done</h2>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-input border-4 border-black rounded-2xl p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-1">Total Bill</p>
              <p className="text-lg sm:text-xl font-black italic text-text-main tabular-nums">${s.bill.toFixed(2)}</p>
            </div>
            <div className="bg-action-capture border-4 border-black rounded-2xl p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-black/60 mb-1">Your Share</p>
              <p className="text-lg sm:text-xl font-black italic text-text-main tabular-nums">${s.base.toFixed(2)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-input border-4 border-black rounded-2xl p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-1">Vault Capture</p>
              <p className="text-lg sm:text-xl font-black italic text-text-main tabular-nums">${s.flip.toFixed(2)}</p>
            </div>
            <div className="bg-action-primary border-4 border-black rounded-2xl p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-black/60 mb-1">Total Hit</p>
              <p className="text-lg sm:text-xl font-black italic text-text-main tabular-nums">${s.total.toFixed(2)}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => { setReceiptMode(false); setReceiptSnapshot(null); }}
            className="w-full h-14 border-4 border-black rounded-full bg-black text-action-primary font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
          >
            DONE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">Fair Share</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">Split bills with the squad</p>
      </div>

      {/* Amount + Breakdown */}
      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-4">
        <div className="flex justify-between items-end gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Total Bill</p>
            <span className="text-4xl sm:text-5xl font-black italic tracking-tighter text-text-main tabular-nums">${currentInput}</span>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{totalPeople} people</p>
            <p className="text-xl sm:text-2xl font-black italic text-text-main tabular-nums">${metrics.totalHitPerPerson.toFixed(2)} each</p>
          </div>
        </div>

        {totalBill > 0 && (
          <div className="flex gap-3 pt-2 border-t-2 border-border">
            <div className="flex-1 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted leading-tight">Base</p>
              <p className="font-black text-text-main tabular-nums">${metrics.baseSharePerPerson.toFixed(2)}</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted leading-tight">Vault</p>
              <p className="font-black text-text-main tabular-nums">${metrics.flipObligationPerPerson.toFixed(2)}</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted leading-tight">Each Total</p>
              <p className="font-black text-text-main tabular-nums">${metrics.totalHitPerPerson.toFixed(2)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Squad */}
      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
        <div className="flex justify-between items-center mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-action-capture border-2 border-black rounded-full text-black text-[10px] font-black tracking-widest uppercase">
            <Users size={11} strokeWidth={3} /> THE SQUAD
          </div>
          <button
            type="button"
            onClick={() => { setManageMode(!manageMode); setEditingId(null); setShowAddInput(false); }}
            className={`text-[10px] font-black uppercase px-3 py-1 border-2 rounded-full transition-all ${manageMode ? 'bg-black text-white border-black' : 'border-black text-text-main hover:bg-input'}`}
          >
            {manageMode ? 'DONE' : 'MANAGE'}
          </button>
        </div>

        {/* Member list */}
        <div className="space-y-2">
          {/* You (always in) */}
          <div className="flex items-center gap-3 px-4 py-3 bg-action-capture border-4 border-black rounded-2xl">
            <div className="w-8 h-8 bg-black rounded-xl flex items-center justify-center">
              <span className="text-[10px] font-black text-action-primary">YOU</span>
            </div>
            <span className="font-black uppercase text-black flex-1">You</span>
            <span className="text-[11px] font-black uppercase tracking-widest text-black/50">HOST</span>
          </div>

          {squad.map(member => {
            const isActive = activeMembers.has(member.id);
            const isEditing = editingId === member.id;

            if (manageMode) {
              return (
                <div key={member.id} className="flex items-center gap-3 px-4 py-3 bg-input border-4 border-black rounded-2xl">
                  {isEditing ? (
                    <>
                      <input
                        autoFocus
                        type="text"
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && confirmEdit()}
                        className="flex-1 bg-surface border-[3px] border-action-capture rounded-xl px-3 py-1.5 font-black uppercase text-sm outline-none text-text-main"
                      />
                      <button type="button" onClick={confirmEdit} className="w-8 h-8 bg-action-capture border-[3px] border-black rounded-xl flex items-center justify-center">
                        <Check size={14} strokeWidth={3} />
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="w-8 h-8 border-[3px] border-black rounded-xl flex items-center justify-center">
                        <X size={14} strokeWidth={3} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="font-black uppercase text-text-main flex-1">{member.name}</span>
                      <button type="button" onClick={() => startEdit(member.id, member.name)} className="w-8 h-8 border-[3px] border-black rounded-xl flex items-center justify-center hover:bg-surface transition-colors">
                        <Pencil size={13} strokeWidth={3} />
                      </button>
                      <button type="button" onClick={() => removeSquadMember(member.id)} className="w-8 h-8 border-[3px] border-black rounded-xl flex items-center justify-center hover:bg-action-bleed hover:text-white hover:border-action-bleed transition-colors">
                        <Trash2 size={13} strokeWidth={3} />
                      </button>
                    </>
                  )}
                </div>
              );
            }

            return (
              <button
                type="button"
                key={member.id}
                onClick={() => toggleMember(member.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 border-4 rounded-2xl transition-all
                  ${isActive ? 'bg-surface border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]' : 'bg-transparent border-border text-text-muted hover:border-black/50'}
                `}
              >
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isActive ? 'bg-action-capture border-black' : 'border-border bg-surface'}`}>
                  {isActive && <Check size={11} strokeWidth={3} />}
                </div>
                <span className={`font-black uppercase text-sm flex-1 text-left ${isActive ? 'text-text-main' : 'text-text-muted'}`}>{member.name}</span>
                {isActive && <span className="text-[11px] font-bold uppercase tracking-widest text-text-muted">${metrics.totalHitPerPerson.toFixed(2)}</span>}
              </button>
            );
          })}

          {/* Add new member */}
          {manageMode && (
            showAddInput ? (
              <div className="flex items-center gap-3 px-4 py-3 bg-input border-4 border-action-capture rounded-2xl">
                <input
                  autoFocus
                  type="text"
                  placeholder="NAME"
                  value={newMemberName}
                  onChange={e => setNewMemberName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && confirmAdd()}
                  className="flex-1 bg-surface border-2 border-black rounded-xl px-3 py-1.5 font-black uppercase text-sm outline-none text-text-main focus:border-action-capture"
                />
                <button type="button" onClick={confirmAdd} className="w-8 h-8 bg-action-capture border-2 border-black rounded-xl flex items-center justify-center">
                  <Check size={14} strokeWidth={3} />
                </button>
                <button type="button" onClick={() => { setShowAddInput(false); setNewMemberName(''); }} className="w-8 h-8 border-2 border-black rounded-xl flex items-center justify-center">
                  <X size={14} strokeWidth={3} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddInput(true)}
                className="w-full flex items-center gap-3 px-4 py-3 border-4 border-dashed border-border rounded-2xl hover:border-black transition-colors"
              >
                <Plus size={16} strokeWidth={3} className="text-text-muted" />
                <span className="font-bold uppercase text-sm text-text-muted">Add Person</span>
              </button>
            )
          )}
        </div>

        {/* Saved Groups */}
        {!manageMode && (
          <div className="mt-4 space-y-3">
            {customSplitPresets.length > 0 && (
              <div className="pt-4 border-t-2 border-border">
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3">Saved Groups</p>
                <div className="flex flex-wrap gap-2">
                  {customSplitPresets.map(preset => (
                    <div key={preset.id} className="relative group">
                      <button
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className={`px-3 py-1 border-2 font-black text-xs uppercase rounded-full transition-all
                          ${activePresetId === preset.id ? 'bg-action-capture border-black text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]' : 'bg-surface border-black text-text-main hover:bg-input'}
                        `}
                      >
                        {preset.name} <span className="opacity-40">({preset.participantIds.length + 1})</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${preset.name} group`}
                        onClick={e => { e.stopPropagation(); deleteSplitPreset(preset.id); }}
                        className="absolute -right-1.5 -top-1.5 w-5 h-5 rounded-full bg-surface border-2 border-black flex items-center justify-center text-text-muted hover:text-action-bleed opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={9} strokeWidth={3} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isSavingPreset ? (
              <div className="pt-3 border-t-2 border-border space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Name this group</p>
                <div className="flex gap-3">
                  <input
                    autoFocus
                    type="text"
                    placeholder="e.g. DINNER CREW"
                    className="flex-1 bg-input border-4 border-black rounded-2xl px-4 py-2.5 font-black uppercase text-sm outline-none focus:border-action-capture transition-colors text-text-main"
                    value={presetNameInput}
                    onChange={e => setPresetNameInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSavePreset()}
                  />
                  <button type="button" onClick={handleSavePreset} className="px-5 h-12 border-4 border-black rounded-2xl bg-action-capture text-black font-black uppercase text-xs">SAVE</button>
                </div>
                <button type="button" onClick={() => setIsSavingPreset(false)} className="text-[10px] uppercase font-bold text-text-muted underline">CANCEL</button>
              </div>
            ) : (
              activeMembers.size > 0 && (
                <button
                  type="button"
                  onClick={() => setIsSavingPreset(true)}
                  className="text-[10px] font-bold uppercase border-b-2 border-black text-text-main hover:text-action-capture transition-colors"
                >
                  SAVE THIS GROUP
                </button>
              )
            )}
          </div>
        )}
      </div>

      {/* Numpad */}
      <div className="bg-surface border-4 border-border rounded-3xl overflow-hidden shadow-[6px_6px_0px_0px_var(--shadow-color)]">
        <Numpad value={currentInput} onChange={setCurrentInput} onSubmit={executeSplit} submitLabel="Complete Split" />
      </div>

      {/* IOU Ledger */}
      {iouLedger && iouLedger.length > 0 && (
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <div className="flex items-center justify-between mb-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-action-primary border-2 border-black rounded-full text-black text-[10px] font-black tracking-widest uppercase">
              IOU LEDGER
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">
              {iouLedger.length} outstanding
            </span>
          </div>
          <div className="space-y-2">
            {iouLedger.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 px-4 py-3 bg-input border-4 border-black rounded-2xl">
                <div className="flex-1 min-w-0">
                  <p className="font-black uppercase text-sm text-text-main">{entry.memberName}</p>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
                    Owes · {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <span className="font-black tabular-nums text-text-main shrink-0">${entry.amount.toFixed(2)}</span>
                <button
                  type="button"
                  onClick={() => collectIou(entry.id)}
                  className="shrink-0 px-3 h-11 border-[3px] border-black rounded-full bg-action-capture text-black font-black uppercase text-[10px] tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
                >
                  [COLLECTED]
                </button>
              </div>
            ))}
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mt-3">
            Tap [COLLECTED] when a squad member pays you back · credits your liquid balance
          </p>
        </div>
      )}
    </div>
  );
};

