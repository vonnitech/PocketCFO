import React, { useState, useMemo } from 'react';
import { Users, CheckCircle2, Trash2, Plus, Pencil, Check, X, Send } from 'lucide-react';
import { useStore, IouEntry } from '../store/useStore';
import { saveSplitTransaction } from '../db';
import { SplitTransaction, CustomSplitPreset } from '../types/split';
import { calculateTacticalSplit, UNIVERSAL_FLIP_RATE } from '../core/math';
import { formatCurrency } from '../lib/utils';
import { currencySymbol } from '../lib/currency';

// Mini-calculator for the per-person fields: type "12+8+5" and it sums. Supports
// + - * / and decimals, evaluated safely with no eval() (the app's CSP blocks it).
function evalAmount(expr: string): number {
  if (!expr) return 0;
  const tokens = expr.match(/(\d+\.?\d*|\.\d+|[+\-*/])/g);
  if (!tokens) return 0;
  // Pass 1: resolve * and / left-to-right.
  const pass1: (number | string)[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '*' || t === '/') {
      const prev = (pass1.pop() as number) ?? 0;
      const next = parseFloat(tokens[++i] ?? '0') || 0;
      pass1.push(t === '*' ? prev * next : (next === 0 ? 0 : prev / next));
    } else if (t === '+' || t === '-') {
      pass1.push(t);
    } else {
      pass1.push(parseFloat(t) || 0);
    }
  }
  // Pass 2: resolve + and -.
  let result = typeof pass1[0] === 'number' ? (pass1[0] as number) : 0;
  for (let i = 1; i < pass1.length; i += 2) {
    const op = pass1[i];
    const val = (pass1[i + 1] as number) ?? 0;
    if (op === '+') result += val;
    else if (op === '-') result -= val;
  }
  return isNaN(result) ? 0 : result;
}

export const TacticalSplitter: React.FC = () => {
  const {
    squad,
    addSplitTransaction, safeSpendLimit,
    customSplitPresets, saveSplitPreset, deleteSplitPreset,
    addSquadMember, updateSquadMember, removeSquadMember,
    iouLedger, collectIou, appendIouEntries, themeColors, currency,
  } = useStore();
  const sym = currencySymbol(currency);
  const money = (n: number) => formatCurrency(n);
  const captureTxt = (() => {
    const hex = themeColors?.secondary;
    if (!hex || hex.length < 7) return 'text-black';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.45 ? 'text-black' : 'text-white';
  })();

  const [currentInput, setCurrentInput] = useState('');
  const [splitMode, setSplitMode] = useState<'even' | 'custom'>('even');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [tipPct, setTipPct] = useState(0);
  const [tipCustomOpen, setTipCustomOpen] = useState(false);
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
  const isCustom = splitMode === 'custom';

  // Tip is a % of the bill, split proportionally (everyone's share scales by the same
  // multiplier). grandTotal is what actually gets paid to the restaurant.
  const tipMult    = 1 + (tipPct || 0) / 100;
  const grandTotal = totalBill * tipMult;
  const tipAmount  = grandTotal - totalBill;

  const customOwed = (id: string) => evalAmount(customAmounts[id] ?? '');

  // Even mode: grand total ÷ people. Custom mode: each member owes the amount you typed
  // (scaled by tip); YOUR share is whatever's left, and your flip is 20% of that.
  const metrics = useMemo(() => {
    if (!isCustom) return calculateTacticalSplit(grandTotal, totalPeople);
    const others = squad
      .filter(m => activeMembers.has(m.id))
      .reduce((s, m) => s + evalAmount(customAmounts[m.id] ?? ''), 0) * tipMult;
    const yourShare = Math.max(0, grandTotal - others);
    const flip = yourShare * UNIVERSAL_FLIP_RATE;
    return {
      activeMemberCount: totalPeople,
      baseSharePerPerson: yourShare,
      flipObligationPerPerson: flip,
      totalHitPerPerson: yourShare + flip,
    };
  }, [isCustom, grandTotal, tipMult, totalPeople, activeMembers, customAmounts, squad]);

  const othersTotal = isCustom
    ? squad.filter(m => activeMembers.has(m.id)).reduce((s, m) => s + customOwed(m.id), 0) * tipMult
    : metrics.baseSharePerPerson * activeMembers.size;
  // Data-entry guard: in custom mode the assigned amounts can't exceed the bill.
  const overBill = isCustom && grandTotal > 0 && othersTotal > grandTotal + 0.005;

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

  // Send a payment request via the device share sheet (Venmo, WhatsApp, SMS, etc.).
  // Falls back to copying the message if the browser has no share support.
  const requestPayment = async (entry: IouEntry) => {
    const msg = `Hey ${entry.memberName}! Your share of the split comes to ${money(entry.amount)}. Send it my way whenever you can 💸`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Payment request', text: msg });
        return;
      }
    } catch {
      return; // user dismissed the share sheet
    }
    try {
      await navigator.clipboard.writeText(msg);
      alert('Request copied. Paste it into Venmo, WhatsApp, or a text.');
    } catch {
      alert(msg);
    }
  };

  const executeSplit = async () => {
    if (totalBill <= 0 || executing || overBill) return;
    setExecuting(true);
    const activePreset = customSplitPresets.find(p => p.id === activePresetId);
    const splitData: SplitTransaction = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      presetUsed: activePreset ? activePreset.name : 'CUSTOM',
      // grandTotal = bill + tip — the real amount you front to the restaurant.
      totalBill: grandTotal,
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
          amount: isCustom ? customOwed(m.id) * tipMult : metrics.baseSharePerPerson,
          splitId: splitData.id,
          date: splitData.timestamp,
        }))
        .filter(e => e.amount > 0);
      if (iouEntries.length > 0) appendIouEntries(iouEntries);
      await saveSplitTransaction(splitData, safeSpendLimit - metrics.totalHitPerPerson);
      setReceiptSnapshot({
        bill: grandTotal,
        base: metrics.baseSharePerPerson,
        flip: metrics.flipObligationPerPerson,
        total: metrics.totalHitPerPerson,
      });
      setReceiptMode(true);
      setCurrentInput('');
      setCustomAmounts({});
      setTipPct(0);
      setTipCustomOpen(false);
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
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">Bill Splitter</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">Split complete</p>
        </div>
        <div className="bg-surface border-4 border-action-capture rounded-3xl p-6 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={24} className="text-capture-readable" strokeWidth={3} />
            <h2 className="text-xl font-black italic uppercase tracking-tighter text-text-main">Split Done</h2>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-input border-4 border-black rounded-2xl p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-1">Total Bill</p>
              <p className="text-lg sm:text-xl font-black italic text-text-main tabular-nums">{money(s.bill)}</p>
            </div>
            <div className="bg-action-capture border-4 border-black rounded-2xl p-4">
              <p className={`text-[11px] font-bold uppercase tracking-widest opacity-60 mb-1 ${captureTxt}`}>Your Share</p>
              <p className={`text-lg sm:text-xl font-black italic tabular-nums ${captureTxt}`}>{money(s.base)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-input border-4 border-black rounded-2xl p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-1">Your Vault</p>
              <p className="text-lg sm:text-xl font-black italic text-capture-readable tabular-nums">+{money(s.flip)}</p>
            </div>
            <div className="bg-action-primary border-4 border-black rounded-2xl p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-black/60 mb-1">Total Hit</p>
              <p className="text-lg sm:text-xl font-black italic text-text-main tabular-nums">{money(s.total)}</p>
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
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">Bill Splitter</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">Split bills with the squad</p>
      </div>

      {/* Amount + Breakdown */}
      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-4">
        {/* Even / Custom toggle */}
        <div className="flex gap-1 p-1 bg-input border-2 border-border rounded-full">
          {(['even', 'custom'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => setSplitMode(mode)}
              className={`flex-1 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                splitMode === mode
                  ? 'bg-black text-action-primary shadow-[2px_2px_0px_0px_var(--color-action-primary)]'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              {mode === 'even' ? 'Even Split' : 'Custom'}
            </button>
          ))}
        </div>

        <div className="flex justify-between items-end gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Total Bill</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl sm:text-5xl font-black italic tracking-tighter text-text-main shrink-0">{sym}</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                placeholder="0"
                aria-label="Total bill amount"
                value={currentInput}
                onChange={e => setCurrentInput(e.target.value)}
                onFocus={e => e.target.select()}
                className="w-full min-w-0 bg-transparent text-4xl sm:text-5xl font-black italic tracking-tighter text-text-main tabular-nums outline-none placeholder:text-text-muted/30 pl-0.5"
              />
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{isCustom ? 'Your Share' : `${totalPeople} people`}</p>
            <p className="text-xl sm:text-2xl font-black italic text-text-main tabular-nums">{money(metrics.baseSharePerPerson)}{isCustom ? '' : ' each'}</p>
          </div>
        </div>

        {/* Tip */}
        <div className="pt-2 border-t-2 border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
              Tip{tipPct > 0 ? ` · +${money(tipAmount)}` : ''}
            </p>
            {tipPct > 0 && (
              <p className="text-[10px] font-black uppercase tracking-widest text-text-main tabular-nums">Total {money(grandTotal)}</p>
            )}
          </div>
          <div className="flex gap-1.5">
            {[0, 10, 15, 20].map(p => (
              <button
                key={p}
                type="button"
                onClick={() => { setTipPct(p); setTipCustomOpen(false); }}
                className={`flex-1 h-9 border-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  !tipCustomOpen && tipPct === p
                    ? 'bg-action-capture border-black text-capture-contrast'
                    : 'border-border bg-input text-text-muted hover:border-black'
                }`}
              >
                {p === 0 ? 'None' : `${p}%`}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTipCustomOpen(o => !o)}
              className={`flex-1 h-9 border-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                tipCustomOpen ? 'bg-action-capture border-black text-capture-contrast' : 'border-border bg-input text-text-muted hover:border-black'
              }`}
            >
              Custom
            </button>
          </div>
          {tipCustomOpen && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                min="0"
                inputMode="decimal"
                placeholder="Tip %"
                aria-label="Custom tip percent"
                value={tipPct ? String(tipPct) : ''}
                onChange={e => setTipPct(Math.max(0, parseFloat(e.target.value) || 0))}
                onFocus={e => e.target.select()}
                className="w-24 bg-input border-2 border-black rounded-xl px-3 py-1.5 font-black tabular-nums text-sm text-text-main outline-none focus:border-action-capture"
              />
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">% tip</span>
            </div>
          )}
        </div>

        {totalBill > 0 && (
          <div className="flex gap-3 pt-2 border-t-2 border-border">
            <div className="flex-1 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted leading-tight">{isCustom ? 'Others Owe' : 'They Owe'}</p>
              <p className="font-black text-text-main tabular-nums">{money(isCustom ? othersTotal : metrics.baseSharePerPerson)}</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wide text-capture-readable leading-tight">Your Vault</p>
              <p className="font-black text-capture-readable tabular-nums">+{money(metrics.flipObligationPerPerson)}</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted leading-tight">Your Total</p>
              <p className="font-black text-text-main tabular-nums">{money(metrics.totalHitPerPerson)}</p>
            </div>
          </div>
        )}

        {overBill && (
          <p className="text-[10px] font-black uppercase tracking-widest text-action-bleed text-center">
            Assigned ({money(othersTotal)}) exceeds the bill. Adjust amounts.
          </p>
        )}
      </div>

      {/* Squad */}
      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
        <div className="flex justify-between items-center mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-action-capture border-2 border-black rounded-full text-capture-contrast text-[10px] font-black tracking-widest uppercase">
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
            <span className="font-black uppercase text-capture-contrast flex-1">You</span>
            {isCustom && totalBill > 0 ? (
              <span className="text-[11px] font-black tabular-nums text-capture-contrast">{money(metrics.baseSharePerPerson)}</span>
            ) : (
              <span className="text-[11px] font-black uppercase tracking-widest text-capture-contrast opacity-50">HOST</span>
            )}
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
                      <button type="button" aria-label="Save name" onClick={confirmEdit} className="w-8 h-8 bg-action-capture border-[3px] border-black rounded-xl flex items-center justify-center">
                        <Check size={14} strokeWidth={3} />
                      </button>
                      <button type="button" aria-label="Cancel edit" onClick={() => setEditingId(null)} className="w-8 h-8 border-[3px] border-black rounded-xl flex items-center justify-center">
                        <X size={14} strokeWidth={3} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="font-black uppercase text-text-main flex-1">{member.name}</span>
                      <button type="button" aria-label={`Edit ${member.name}`} onClick={() => startEdit(member.id, member.name)} className="w-8 h-8 border-[3px] border-black rounded-xl flex items-center justify-center hover:bg-surface transition-colors">
                        <Pencil size={13} strokeWidth={3} />
                      </button>
                      <button type="button" aria-label={`Remove ${member.name}`} onClick={() => removeSquadMember(member.id)} className="w-8 h-8 border-[3px] border-black rounded-xl flex items-center justify-center hover:bg-action-bleed hover:text-white hover:border-action-bleed transition-colors">
                        <Trash2 size={13} strokeWidth={3} />
                      </button>
                    </>
                  )}
                </div>
              );
            }

            // Custom mode: row holds a toggle (left) + an amount input (right). Can't nest
            // an <input> inside the toggle <button>, so this row isn't a single button.
            if (isCustom) {
              return (
                <div
                  key={member.id}
                  className={`w-full flex items-center gap-3 px-4 py-3 border-4 rounded-2xl transition-all
                    ${isActive ? 'bg-surface border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]' : 'bg-transparent border-border hover:border-black/50'}
                  `}
                >
                  <button type="button" onClick={() => toggleMember(member.id)} className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-all ${isActive ? 'bg-action-capture border-black' : 'border-border bg-surface'}`}>
                      {isActive && <Check size={11} strokeWidth={3} />}
                    </div>
                    <span className={`font-black uppercase text-sm text-left truncate ${isActive ? 'text-text-main' : 'text-text-muted'}`}>{member.name}</span>
                  </button>
                  {isActive && (
                    <div className="flex flex-col items-end shrink-0">
                      <div className="flex items-center gap-1">
                        <span className="text-text-muted font-black text-sm">{sym}</span>
                        <input
                          type="text"
                          inputMode="text"
                          placeholder="0 or 12+8"
                          aria-label={`Amount ${member.name} owes. Type a number or a sum like 12+8`}
                          title={`Amount ${member.name} owes. You can type a sum like 12+8+5`}
                          value={customAmounts[member.id] ?? ''}
                          onChange={e => setCustomAmounts(prev => ({ ...prev, [member.id]: e.target.value }))}
                          onFocus={e => e.target.select()}
                          className="w-28 bg-input border-2 border-black rounded-xl px-2 py-1.5 font-black tabular-nums text-sm text-text-main text-right outline-none focus:border-action-capture"
                        />
                      </div>
                      {/* Reserve the line height always so rows stay even whether or not a sum shows */}
                      <span className="text-[9px] font-black tabular-nums text-capture-readable h-3 leading-3 mt-0.5">
                        {/[+\-*/]/.test(customAmounts[member.id] ?? '') ? `= ${money(customOwed(member.id))}` : ''}
                      </span>
                    </div>
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
                {isActive && <span className="text-[11px] font-bold uppercase tracking-widest text-text-muted">{money(metrics.baseSharePerPerson)}</span>}
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
                          ${activePresetId === preset.id ? 'bg-action-capture border-black text-capture-contrast shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]' : 'bg-surface border-black text-text-main hover:bg-input'}
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
                  <button type="button" onClick={handleSavePreset} className="px-5 h-12 border-4 border-black rounded-2xl bg-action-capture text-capture-contrast font-black uppercase text-xs">SAVE</button>
                </div>
                <button type="button" onClick={() => setIsSavingPreset(false)} className="text-[10px] uppercase font-bold text-text-muted underline">CANCEL</button>
              </div>
            ) : (
              activeMembers.size > 0 && (
                <button
                  type="button"
                  onClick={() => setIsSavingPreset(true)}
                  className="text-[10px] font-bold uppercase border-b-2 border-black text-text-main hover:text-capture-readable transition-colors"
                >
                  SAVE THIS GROUP
                </button>
              )
            )}
          </div>
        )}
      </div>

      {/* Complete Split */}
      <button
        type="button"
        onClick={executeSplit}
        disabled={totalBill <= 0 || executing || overBill}
        className="w-full h-16 border-4 border-black rounded-3xl bg-black text-action-primary font-black uppercase tracking-widest text-sm shadow-[6px_6px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-40 disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[6px_6px_0px_0px_var(--color-action-primary)]"
      >
        {executing ? 'Splitting…' : 'Complete Split'}
      </button>

      {/* IOU Ledger */}
      {iouLedger && iouLedger.length > 0 && (
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <div className="flex items-center justify-between mb-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-black border-2 border-action-primary rounded-full text-action-primary text-[10px] font-black tracking-widest uppercase">
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
                <span className="font-black tabular-nums text-text-main shrink-0">{money(entry.amount)}</span>
                <button
                  type="button"
                  title={`Request ${money(entry.amount)} from ${entry.memberName}`}
                  aria-label={`Request payment from ${entry.memberName}`}
                  onClick={() => requestPayment(entry)}
                  className="shrink-0 w-11 h-11 border-[3px] border-black rounded-full bg-surface text-text-main flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
                >
                  <Send size={14} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={() => collectIou(entry.id)}
                  className="shrink-0 px-3 h-11 border-[3px] border-black rounded-full bg-action-capture text-capture-contrast font-black uppercase text-[10px] tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
                >
                  Collected
                </button>
              </div>
            ))}
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mt-3">
            Tap Collected once someone pays you back. It adds the amount to your balance.
          </p>
        </div>
      )}
    </div>
  );
};

