import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck, Plus, Edit2, Target, Trash2, RotateCcw,
  AlertTriangle, Check, X, Trophy, ArrowLeftRight, TrendingUp, ChevronDown,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import type { VaultAssetClass } from '../store/useStore';
import { formatCurrency } from '../lib/utils';
import { calculateVaultProgress, calculateCurrentMonthDeposits } from '../core/math';
import { FundVaultSheet } from '../components/FundVaultSheet';
import { VaultTransferSheet } from '../components/VaultTransferSheet';

const CLASS_OPTIONS: { id: VaultAssetClass; label: string; desc: string; icon: React.ElementType }[] = [
  { id: 'INVESTMENT',   label: 'Investment',   desc: 'Brokerage, IRA, index funds · counts toward your FIRE number', icon: TrendingUp },
  { id: 'SINKING_FUND', label: 'Sinking Fund', desc: 'Car, vacation, new phone · planned future spending',           icon: Target },
  { id: 'CASH_RESERVE', label: 'Cash Reserve', desc: 'Emergency fund, HYSA · safe yield, excluded from FIRE',        icon: ShieldCheck },
];

// ── Group config ──────────────────────────────────────────────────────────────

const GROUPS: {
  id: VaultAssetClass;
  label: string;
  desc: string;
  emptyHint: string;
  icon: React.ElementType;
  iconBg: string;
  iconText: string;
  barColor: string;
  borderActive: string;
}[] = [
  {
    id:           'INVESTMENT',
    label:        'Investments',
    desc:         'Counted in FIRE projections · long-term market growth',
    emptyHint:    'No investments yet. Set up an index fund or brokerage vault.',
    icon:         TrendingUp,
    iconBg:       'bg-action-primary',
    iconText:     'text-black',
    barColor:     'bg-action-primary',
    borderActive: 'border-action-primary',
  },
  {
    id:           'SINKING_FUND',
    label:        'Sinking Funds',
    desc:         'Short-term goals · planned future spending',
    emptyHint:    'No sinking funds yet. Planning a trip or a big purchase?',
    icon:         Target,
    iconBg:       'bg-action-capture',
    iconText:     'text-black',
    barColor:     'bg-action-capture',
    borderActive: 'border-action-capture',
  },
  {
    id:           'CASH_RESERVE',
    label:        'Cash Reserves',
    desc:         'Emergency funds · safe yield accounts',
    emptyHint:    'No cash reserve yet. An emergency fund is your first line of defence.',
    icon:         ShieldCheck,
    iconBg:       'bg-input',
    iconText:     'text-text-muted',
    barColor:     'bg-action-capture',
    borderActive: 'border-border',
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function Vaults() {
  const {
    vaults,
    deletedVaults,
    updateState,
    privacyMode,
    liquidAssets,
    monthlySavingsGoal,
    transactions,
    nextPayday,
    renameVault,
    deleteVault,
    restoreVault,
    permanentlyDeleteVault,
    addVault,
  } = useStore();

  // Inline create form
  const [showForm,   setShowForm]   = useState(false);
  const [formName,   setFormName]   = useState('');
  const [formTarget, setFormTarget] = useState('');
  const [formClass,  setFormClass]  = useState<VaultAssetClass>('SINKING_FUND');

  // Fund / Transfer sheets
  const [fundingVault, setFundingVault] = useState<{ id: string; name: string } | null>(null);

  // Inline editing
  const [editingTargetId,    setEditingTargetId]    = useState<string | null>(null);
  const [editingTargetValue, setEditingTargetValue] = useState('');
  const [editingNameId,      setEditingNameId]      = useState<string | null>(null);
  const [editingNameValue,   setEditingNameValue]   = useState('');

  // Delete
  const [deletingVaultId,   setDeletingVaultId]   = useState<string | null>(null);
  const [permanentDeleteId, setPermanentDeleteId] = useState<string | null>(null);

  // Transfer sheet
  const [transferVault, setTransferVault] = useState<{ id: string; name: string; current: number } | null>(null);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const openCreate = (cls: VaultAssetClass = 'SINKING_FUND') => {
    setFormClass(cls);
    setFormName('');
    setFormTarget('');
    setShowForm(true);
    setTimeout(() => document.getElementById('vault-create-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const submitForm = async () => {
    const t = parseFloat(formTarget);
    if (!formName.trim() || !t || t <= 0) return;
    await addVault(formName.trim(), t, formClass);
    setShowForm(false);
    setFormName('');
    setFormTarget('');
  };

  const updateTarget = (id: string, val: number) => {
    updateState(prev => ({
      ...prev,
      vaults: prev.vaults.map(v => v.id === id ? { ...v, target: val } : v),
    }));
  };

  const commitRename = (id: string, current: string) => {
    const trimmed = editingNameValue.trim();
    if (trimmed && trimmed !== current) renameVault(id, trimmed);
    setEditingNameId(null);
  };


  // ── Derived ──────────────────────────────────────────────────────────────────

  const safeDeleted           = deletedVaults || [];
  const investmentTotal       = vaults.filter(v => v.asset_class === 'INVESTMENT').reduce((s, v) => s + v.current, 0);
  const sinkingTotal          = vaults.filter(v => v.asset_class === 'SINKING_FUND').reduce((s, v) => s + v.current, 0);
  const cashTotal             = vaults.filter(v => v.asset_class === 'CASH_RESERVE').reduce((s, v) => s + v.current, 0);
  const totalVaulted          = investmentTotal + sinkingTotal + cashTotal;
  const vaultBeingDeleted     = vaults.find(v => v.id === deletingVaultId);
  const vaultBeingPermDeleted = safeDeleted.find(v => v.id === permanentDeleteId);

  const currentMonthDeposits = useMemo(() => calculateCurrentMonthDeposits(transactions, nextPayday), [transactions, nextPayday]);
  const goalPct = monthlySavingsGoal > 0
    ? Math.min(100, (currentMonthDeposits / monthlySavingsGoal) * 100)
    : 0;
  const remainingToGoal = Math.max(0, monthlySavingsGoal - currentMonthDeposits);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-32 md:pb-6">

      {/* Header */}
      <div>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">Vaults</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">Savings goals &amp; asset management</p>
      </div>

      {/* Top summary: Total Vaulted + Monthly Goal Pacing */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total Vaulted */}
        <div className="bg-surface border-4 border-border rounded-2xl p-4 shadow-[4px_4px_0px_0px_var(--shadow-color)]">
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1">Total Vaulted</p>
          <p className="text-2xl font-black italic tabular-nums text-text-main leading-none">
            {formatCurrency(totalVaulted, privacyMode)}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1">Across all vaults</p>
        </div>

        {/* Monthly Savings Goal + Progress */}
        <div className="bg-black border-4 border-black rounded-2xl p-4 shadow-[4px_4px_0px_0px_var(--color-action-primary)]">
          <p className="text-[9px] font-black uppercase tracking-widest text-white/50 mb-1">Monthly Goal</p>
          <p className="text-2xl font-black italic tabular-nums text-action-primary leading-none">
            {formatCurrency(monthlySavingsGoal, privacyMode)}
          </p>
          {monthlySavingsGoal > 0 ? (
            <div className="mt-3">
              <div className="w-full h-2 bg-white/10 border border-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${goalPct}%` }}
                  className="h-full bg-action-primary"
                />
              </div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mt-1.5">
                {goalPct >= 100 ? 'Goal complete!' : `${goalPct.toFixed(0)}% deposited this month`}
              </p>
            </div>
          ) : (
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mt-2">Set in config</p>
          )}
        </div>
      </div>

      {/* Category breakdown strip */}
      {vaults.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Invested',  value: investmentTotal, dot: 'bg-action-primary', note: 'FIRE input' },
            { label: 'Sinking',   value: sinkingTotal,    dot: 'bg-action-capture', note: null },
            { label: 'Reserve',   value: cashTotal,       dot: 'bg-border',         note: null },
          ].map(stat => (
            <div key={stat.label} className="bg-surface border-4 border-border rounded-2xl p-3 shadow-[4px_4px_0px_0px_var(--shadow-color)]">
              <div className="flex items-center gap-1.5 mb-1">
                <div className={`w-2 h-2 rounded-full ${stat.dot} border border-black/20 shrink-0`} />
                <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">{stat.label}</p>
              </div>
              <p className="text-base font-black italic tabular-nums text-text-main">{formatCurrency(stat.value, privacyMode)}</p>
              {stat.note && <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-0.5">{stat.note}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Available to Vault — staging area right above vault cards */}
      <div className="bg-black border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--color-action-capture)]">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">Available to Vault</p>
        <p className="text-5xl font-black italic tracking-tighter text-action-primary tabular-nums leading-none">
          {formatCurrency(liquidAssets, privacyMode)}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mt-2">
          {monthlySavingsGoal > 0 && remainingToGoal > 0
            ? `${formatCurrency(remainingToGoal, privacyMode)} more to reach your monthly goal`
            : 'Distribute across your vaults below'
          }
        </p>
      </div>

      {/* Empty state — no vaults at all */}
      {vaults.length === 0 && (
        <div className="bg-surface border-4 border-border rounded-3xl p-10 shadow-[6px_6px_0px_0px_var(--shadow-color)] flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 bg-input border-[3px] border-border rounded-2xl flex items-center justify-center">
            <ShieldCheck size={32} strokeWidth={2} className="text-text-muted" />
          </div>
          <div>
            <p className="font-black uppercase text-xl italic text-text-main">No Vaults Yet</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1">Create savings goals to start capturing money</p>
          </div>
        </div>
      )}

      {/* Grouped sections */}
      {vaults.length > 0 && (() => {
        const renderVaultCard = (vault: typeof vaults[0], group: typeof GROUPS[0]) => {
          const progress   = calculateVaultProgress(vault.current, vault.target);
          const isComplete = progress >= 100;
          return (
            <div key={vault.id} className={`bg-surface border-4 rounded-2xl p-4 shadow-[4px_4px_0px_0px_var(--shadow-color)] ${isComplete ? group.borderActive : 'border-border'}`}>
              {/* Header row */}
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`w-9 h-9 border-[3px] border-black rounded-xl flex items-center justify-center shrink-0 ${group.iconBg}`}>
                  {isComplete ? <Trophy size={16} strokeWidth={3} className="text-black" /> : <group.icon size={16} strokeWidth={3} className={group.iconText} />}
                </div>
                <div className="flex-1 min-w-0">
                  {editingNameId === vault.id ? (
                    <div className="flex items-center gap-1">
                      <input autoFocus title="Vault Name"
                        className="flex-1 min-w-0 bg-input border-[3px] border-black rounded-lg p-1 font-black uppercase text-sm text-text-main outline-none focus:border-action-capture transition-colors"
                        value={editingNameValue} onChange={e => setEditingNameValue(e.target.value)}
                        onBlur={() => commitRename(vault.id, vault.name)}
                        onKeyDown={e => { if (e.key === 'Enter') commitRename(vault.id, vault.name); if (e.key === 'Escape') setEditingNameId(null); }}
                      />
                      <button type="button" aria-label="Save name" onClick={() => commitRename(vault.id, vault.name)} className="shrink-0 w-7 h-7 flex items-center justify-center bg-action-capture border-2 border-black rounded-lg"><Check size={12} strokeWidth={3} /></button>
                      <button type="button" aria-label="Cancel" onClick={() => setEditingNameId(null)} className="shrink-0 w-7 h-7 flex items-center justify-center bg-surface border-2 border-black rounded-lg"><X size={12} strokeWidth={3} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-base font-black italic uppercase tracking-tighter text-text-main truncate leading-none">{vault.name}</h3>
                      <button type="button" aria-label="Rename vault" onClick={() => { setEditingNameId(vault.id); setEditingNameValue(vault.name); }} className="shrink-0 opacity-30 hover:opacity-100 transition-opacity">
                        <Edit2 size={11} strokeWidth={2.5} />
                      </button>
                    </div>
                  )}
                  {editingTargetId === vault.id ? (
                    <input type="number" min="0" autoFocus title="Target Amount"
                      className="w-24 bg-input border-[3px] border-black rounded-lg text-[10px] p-1 font-black outline-none text-right mt-0.5"
                      value={editingTargetValue} onChange={e => setEditingTargetValue(e.target.value)}
                      onBlur={() => { updateTarget(vault.id, parseFloat(editingTargetValue) || vault.target); setEditingTargetId(null); }}
                      onKeyDown={e => { if (e.key === 'Enter') { updateTarget(vault.id, parseFloat(editingTargetValue) || vault.target); setEditingTargetId(null); } }}
                    />
                  ) : (
                    <p onClick={() => { setEditingTargetId(vault.id); setEditingTargetValue(vault.target.toString()); }}
                      className="text-[9px] font-bold text-text-muted/60 cursor-pointer hover:text-text-muted flex items-center gap-0.5 mt-0.5 tabular-nums">
                      {formatCurrency(vault.target, privacyMode)} <Edit2 size={8} />
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-xs font-black tabular-nums ${isComplete ? 'text-action-capture' : 'text-text-muted'}`}>{Math.min(100, progress).toFixed(0)}%</span>
                  <button type="button" aria-label="Delete vault" onClick={() => setDeletingVaultId(vault.id)} className="w-7 h-7 flex items-center justify-center rounded-lg opacity-0 hover:opacity-100 hover:text-action-bleed transition-all">
                    <Trash2 size={13} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
              {/* Progress bar */}
              <div className="mb-3">
                <div className="w-full h-2 bg-input border-2 border-black rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, progress)}%` }} className={`h-full ${group.barColor}`} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] font-bold text-text-muted tabular-nums">{formatCurrency(vault.current, privacyMode)}</span>
                  {!isComplete && <span className="text-[9px] font-bold text-text-muted/50 tabular-nums">of {formatCurrency(vault.target, privacyMode)}</span>}
                  {isComplete && <span className="text-[9px] font-black text-action-capture uppercase tracking-widest">Goal Achieved</span>}
                </div>
              </div>
              {/* Actions */}
              <div className="flex gap-2">
                <button type="button" onClick={() => setFundingVault({ id: vault.id, name: vault.name })}
                  className="flex-1 h-9 border-[3px] border-black rounded-xl bg-action-capture text-black font-black uppercase text-[11px] tracking-widest shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-px hover:translate-y-px transition-all">
                  Fund
                </button>
                <button type="button" title="Move funds" onClick={() => setTransferVault({ id: vault.id, name: vault.name, current: vault.current })}
                  className="w-9 h-9 flex items-center justify-center border-[3px] border-black rounded-xl bg-surface shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-px hover:translate-y-px transition-all opacity-50 hover:opacity-100">
                  <ArrowLeftRight size={13} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          );
        };

        const renderGroup = (group: typeof GROUPS[0]) => {
          const grouped    = vaults.filter(v => (v.asset_class ?? 'SINKING_FUND') === group.id);
          const groupTotal = grouped.reduce((s, v) => s + v.current, 0);
          return (
            <div key={group.id} className="space-y-3">
              {/* Section header */}
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 ${group.iconBg} border-[3px] border-black rounded-xl flex items-center justify-center shrink-0`}>
                  <group.icon size={14} strokeWidth={2.5} className={group.iconText} />
                </div>
                <div>
                  <p className="text-[12px] font-black uppercase tracking-widest text-text-main leading-none">{group.label}</p>
                  {grouped.length > 0 && <p className="text-[9px] font-bold text-text-muted tabular-nums mt-0.5">{formatCurrency(groupTotal, privacyMode)}</p>}
                </div>
              </div>
              {grouped.length > 0 ? (
                <div className={`grid gap-3 ${grouped.length > 1 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                  {grouped.map(v => renderVaultCard(v, group))}
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-input border-2 border-dashed border-border rounded-2xl p-4">
                  <div className={`w-8 h-8 ${group.iconBg} border-2 border-black/20 rounded-xl flex items-center justify-center shrink-0 opacity-40`}>
                    <group.icon size={14} strokeWidth={2.5} className={group.iconText} />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted flex-1">{group.emptyHint}</p>
                  <button type="button" onClick={() => openCreate(group.id)} className="shrink-0 flex items-center gap-1 h-8 px-3 border-2 border-black rounded-xl bg-surface font-black text-[10px] uppercase tracking-widest text-text-main hover:bg-input transition-colors">
                    <Plus size={12} strokeWidth={3} /> Add
                  </button>
                </div>
              )}
            </div>
          );
        };

        return (
          <>
            {/* Investments + Sinking Funds side by side on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {renderGroup(GROUPS[0])}
              {renderGroup(GROUPS[1])}
            </div>
            {/* Cash Reserves full width */}
            {renderGroup(GROUPS[2])}
          </>
        );
      })()}

      {/* Trash */}
      {safeDeleted.length > 0 && (
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <div className="flex items-center gap-3 mb-4">
            <div className="inline-flex px-3 py-1 bg-input border-2 border-border rounded-full text-text-muted text-[10px] font-black tracking-widest uppercase">TRASH</div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
              {safeDeleted.length} vault{safeDeleted.length !== 1 ? 's' : ''} · restore or remove permanently
            </p>
          </div>
          <div className="space-y-3">
            {safeDeleted.map(vault => (
              <div key={vault.id} className="flex items-center gap-3 bg-input border-2 border-border rounded-2xl p-4">
                <div className="flex-1 min-w-0">
                  <p className="font-black italic uppercase tracking-tighter text-text-muted line-through truncate">{vault.name}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
                    {formatCurrency(vault.current, privacyMode)} stored · Target {formatCurrency(vault.target, privacyMode)}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => restoreVault(vault.id)}
                    className="flex items-center gap-1.5 h-11 px-3 border-[3px] border-black rounded-full bg-action-capture text-black font-black uppercase text-[10px] tracking-widest shadow-brutal-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
                  >
                    <RotateCcw size={12} strokeWidth={3} /> Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => setPermanentDeleteId(vault.id)}
                    className="flex items-center gap-1.5 h-11 px-3 border-[3px] border-black rounded-full bg-surface text-action-bleed font-black uppercase text-[10px] tracking-widest shadow-brutal-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
                  >
                    <Trash2 size={12} strokeWidth={3} /> Delete Forever
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Inline Create Vault form ──────────────────────────────────────────── */}
      <div id="vault-create-form" className="bg-surface border-4 border-border rounded-3xl overflow-hidden shadow-[6px_6px_0px_0px_var(--shadow-color)]">
        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-input transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-black border-[3px] border-black rounded-xl flex items-center justify-center shrink-0">
              <Plus size={15} strokeWidth={3} className="text-action-primary" />
            </div>
            <span className="text-[11px] font-black uppercase tracking-widest text-text-main">Create New Vault</span>
          </div>
          <motion.div animate={{ rotate: showForm ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={16} strokeWidth={2.5} className="text-text-muted" />
          </motion.div>
        </button>

        <AnimatePresence initial={false}>
          {showForm && (
            <motion.div
              key="form"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 pt-1 space-y-4 border-t-2 border-border">

                {/* Type picker */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2 mt-3">Vault Type</p>
                  <div className="flex flex-col gap-2">
                    {CLASS_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFormClass(opt.id)}
                        className={`flex items-center gap-3 p-3 rounded-2xl border-4 transition-all text-left w-full ${
                          formClass === opt.id ? 'bg-black border-black' : 'bg-input border-border hover:border-black'
                        }`}
                      >
                        <div className={`w-9 h-9 border-2 border-black rounded-xl flex items-center justify-center shrink-0 ${formClass === opt.id ? 'bg-action-primary' : 'bg-surface'}`}>
                          <opt.icon size={16} strokeWidth={2.5} className="text-black" />
                        </div>
                        <div>
                          <p className={`text-[11px] font-black uppercase tracking-widest leading-none ${formClass === opt.id ? 'text-action-primary' : 'text-text-main'}`}>{opt.label}</p>
                          <p className={`text-[10px] font-bold mt-1 leading-snug ${formClass === opt.id ? 'text-white/50' : 'text-text-muted'}`}>{opt.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Vault Name</p>
                  <input
                    title="Vault Name"
                    placeholder="e.g. EMERGENCY FUND"
                    className="w-full bg-input border-4 border-black rounded-2xl p-4 font-black uppercase text-sm text-text-main outline-none focus:border-action-capture transition-colors"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitForm()}
                  />
                </div>

                {/* Target */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Savings Target</p>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-text-muted text-lg pointer-events-none select-none">$</span>
                    <input
                      type="number"
                      min="0"
                      title="Target Amount"
                      placeholder="0"
                      className="w-full bg-input border-4 border-black rounded-2xl pl-9 pr-4 py-4 font-black text-xl text-text-main outline-none focus:border-action-capture transition-colors tabular-nums"
                      value={formTarget}
                      onChange={e => setFormTarget(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && submitForm()}
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="h-14 px-5 border-4 border-border rounded-2xl bg-input text-text-muted font-black uppercase tracking-widest text-[11px] hover:bg-surface transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitForm}
                    disabled={!formName.trim() || !formTarget || parseFloat(formTarget) <= 0}
                    className="flex-1 h-14 border-4 border-black rounded-2xl bg-black text-action-primary font-black uppercase tracking-widest text-[11px] shadow-[4px_4px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[4px_4px_0px_0px_var(--color-action-primary)]"
                  >
                    Create Vault
                  </button>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Sheet components ──────────────────────────────────────────────────── */}
      <FundVaultSheet
        vaultId={fundingVault?.id ?? null}
        vaultName={fundingVault?.name ?? ''}
        onClose={() => setFundingVault(null)}
      />
      <VaultTransferSheet
        vault={transferVault}
        onClose={() => setTransferVault(null)}
      />

      {/* ── Soft Delete Confirm ───────────────────────────────────────────────── */}
      {deletingVaultId && vaultBeingDeleted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface border-4 border-border rounded-3xl p-7 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-sm w-full">
            <div className="w-12 h-12 bg-action-primary border-4 border-black rounded-2xl flex items-center justify-center mb-4 mx-auto">
              <AlertTriangle size={24} strokeWidth={3} className="text-text-main" />
            </div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-text-main text-center mb-2">Move to Trash?</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted text-center mb-1">"{vaultBeingDeleted.name}"</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted text-center mb-5">
              This vault will be moved to trash. You can restore it anytime.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeletingVaultId(null)} className="flex-1 h-12 border-4 border-border rounded-full bg-surface text-text-main font-black text-sm uppercase tracking-widest shadow-[4px_4px_0px_0px_var(--shadow-color)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all">Cancel</button>
              <button type="button" onClick={() => { deleteVault(deletingVaultId); setDeletingVaultId(null); }} className="flex-1 h-12 border-4 border-action-bleed rounded-full bg-action-bleed text-white font-black text-sm uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all">Move to Trash</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Permanent Delete Confirm ──────────────────────────────────────────── */}
      {permanentDeleteId && vaultBeingPermDeleted && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border-4 border-action-bleed rounded-3xl p-7 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-sm w-full">
            <div className="w-12 h-12 bg-action-bleed border-4 border-black rounded-2xl flex items-center justify-center mb-4 mx-auto">
              <Trash2 size={24} strokeWidth={3} className="text-white" />
            </div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-action-bleed text-center mb-2">Delete Forever?</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted text-center mb-1">"{vaultBeingPermDeleted.name}"</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted text-center mb-5">
              {vaultBeingPermDeleted.current > 0
                ? `This cannot be undone. ${formatCurrency(vaultBeingPermDeleted.current, privacyMode)} stored will be permanently lost.`
                : 'This cannot be undone. The vault record will be erased.'
              }
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setPermanentDeleteId(null)} className="flex-1 h-12 border-4 border-border rounded-full bg-surface text-text-main font-black text-sm uppercase tracking-widest shadow-[4px_4px_0px_0px_var(--shadow-color)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all">Cancel</button>
              <button type="button" onClick={() => { permanentlyDeleteVault(permanentDeleteId); setPermanentDeleteId(null); }} className="flex-1 h-12 border-4 border-black rounded-full bg-black text-action-bleed font-black text-sm uppercase tracking-widest shadow-[4px_4px_0px_0px_#FF4D4D] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all">Delete Forever</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
