import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck, Plus, Edit2, Target, Trash2, RotateCcw,
  AlertTriangle, Check, X, Trophy, ArrowLeftRight, TrendingUp,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import type { VaultAssetClass } from '../store/useStore';
import { formatCurrency } from '../lib/utils';
import { calculateVaultProgress, calculateCurrentMonthDeposits } from '../core/math';
import { VaultFormSheet } from '../components/VaultFormSheet';
import { FundVaultSheet } from '../components/FundVaultSheet';
import { VaultTransferSheet } from '../components/VaultTransferSheet';

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
    renameVault,
    deleteVault,
    restoreVault,
    permanentlyDeleteVault,
  } = useStore();

  // Sheet triggers
  const [formOpen,        setFormOpen]        = useState(false);
  const [formDefaultClass, setFormDefaultClass] = useState<VaultAssetClass>('SINKING_FUND');
  const [fundingVault,    setFundingVault]    = useState<{ id: string; name: string } | null>(null);

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
    setFormDefaultClass(cls);
    setFormOpen(true);
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

  const currentMonthDeposits = useMemo(() => calculateCurrentMonthDeposits(transactions), [transactions]);
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
          <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-1">Total Vaulted</p>
          <p className="text-2xl font-black italic tabular-nums text-text-main leading-none">
            {formatCurrency(totalVaulted, privacyMode)}
          </p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted/60 mt-1">Across all vaults</p>
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
            { label: 'Invested',      value: investmentTotal, accent: 'text-action-primary', note: 'FIRE input' },
            { label: 'Sinking Funds', value: sinkingTotal,    accent: 'text-action-capture', note: null },
            { label: 'Cash Reserve',  value: cashTotal,       accent: 'text-text-muted',     note: null },
          ].map(stat => (
            <div key={stat.label} className="bg-surface border-4 border-border rounded-2xl p-3 shadow-[4px_4px_0px_0px_var(--shadow-color)]">
              <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-1">{stat.label}</p>
              <p className={`text-base font-black italic tabular-nums ${stat.accent}`}>{formatCurrency(stat.value, privacyMode)}</p>
              {stat.note && <p className="text-[8px] font-bold uppercase tracking-widest text-text-muted/60 mt-0.5">{stat.note}</p>}
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
      {vaults.length > 0 && GROUPS.map(group => {
        const grouped    = vaults.filter(v => (v.asset_class ?? 'SINKING_FUND') === group.id);
        const groupTotal = grouped.reduce((s, v) => s + v.current, 0);

        return (
          <div key={group.id} className="space-y-4">

            {/* Section header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 ${group.iconBg} border-4 border-black rounded-xl flex items-center justify-center shrink-0`}>
                  <group.icon size={15} strokeWidth={2.5} className={group.iconText} />
                </div>
                <div>
                  <p className="text-[13px] font-black uppercase tracking-widest text-text-main leading-none">{group.label}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-0.5">{group.desc}</p>
                </div>
              </div>
              {grouped.length > 0 && (
                <div className="text-right">
                  <p className="text-sm font-black italic text-text-main tabular-nums">{formatCurrency(groupTotal, privacyMode)}</p>
                  <p className="text-[9px] font-bold uppercase text-text-muted">{grouped.length} vault{grouped.length !== 1 ? 's' : ''}</p>
                </div>
              )}
            </div>

            {/* Cards grid */}
            {grouped.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {grouped.map(vault => {
                  const progress   = calculateVaultProgress(vault.current, vault.target);
                  const isComplete = progress >= 100;
                  const remaining  = Math.max(0, vault.target - vault.current);

                  const milestone = progress >= 75 && progress < 100 ? { label: 'Almost There!', bg: 'bg-action-primary', text: 'text-black' }
                    : progress >= 50 && progress < 75 ? { label: 'Halfway There!', bg: 'bg-action-capture', text: 'text-black' }
                    : progress >= 25 && progress < 50 ? { label: 'Good Start', bg: 'bg-input', text: 'text-text-main' }
                    : null;

                  return (
                    <div
                      key={vault.id}
                      className={`bg-surface border-4 rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] ${isComplete ? group.borderActive : 'border-border'}`}
                    >
                      {/* Completion banner */}
                      {isComplete && (
                        <div className="flex items-center gap-2 bg-action-primary border-[3px] border-black rounded-2xl px-4 py-2 mb-4 shadow-brutal-sm">
                          <Trophy size={16} strokeWidth={3} className="text-black shrink-0" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-black">Goal Achieved</span>
                        </div>
                      )}
                      {!isComplete && milestone && (
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 ${milestone.bg} border-2 border-black rounded-full ${milestone.text} text-[10px] font-black tracking-widest uppercase mb-3`}>
                          {progress.toFixed(0)}% · {milestone.label}
                        </div>
                      )}

                      {/* Card header */}
                      <div className="flex items-start gap-3 mb-4">
                        <div className={`w-12 h-12 border-4 border-black rounded-xl flex items-center justify-center shrink-0 ${group.iconBg}`}>
                          {isComplete
                            ? <Trophy size={22} strokeWidth={3} className="text-black" />
                            : <group.icon size={22} strokeWidth={3} className={group.iconText} />
                          }
                        </div>

                        <div className="flex-1 min-w-0">
                          {editingNameId === vault.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                autoFocus
                                title="Vault Name"
                                className="flex-1 min-w-0 bg-input border-[3px] border-black rounded-lg p-1.5 font-black uppercase text-sm text-text-main outline-none focus:border-action-capture transition-colors"
                                value={editingNameValue}
                                onChange={e => setEditingNameValue(e.target.value)}
                                onBlur={() => commitRename(vault.id, vault.name)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') commitRename(vault.id, vault.name);
                                  if (e.key === 'Escape') setEditingNameId(null);
                                }}
                              />
                              <button type="button" aria-label="Save name" onClick={() => commitRename(vault.id, vault.name)} className="shrink-0 w-7 h-7 flex items-center justify-center bg-action-capture border-2 border-black rounded-lg">
                                <Check size={13} strokeWidth={3} />
                              </button>
                              <button type="button" aria-label="Cancel" onClick={() => setEditingNameId(null)} className="shrink-0 w-7 h-7 flex items-center justify-center bg-surface border-2 border-black rounded-lg">
                                <X size={13} strokeWidth={3} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-xl font-black italic uppercase tracking-tighter text-text-main overflow-hidden text-ellipsis leading-snug">{vault.name}</h3>
                              <button
                                type="button"
                                aria-label="Rename vault"
                                onClick={() => { setEditingNameId(vault.id); setEditingNameValue(vault.name); }}
                                className="shrink-0 opacity-40 hover:opacity-100 transition-opacity"
                              >
                                <Edit2 size={13} strokeWidth={2.5} />
                              </button>
                            </div>
                          )}

                          {editingTargetId === vault.id ? (
                            <input
                              type="number"
                              min="0"
                              autoFocus
                              title="Target Amount"
                              className="w-24 bg-input border-[3px] border-black rounded-lg text-[10px] p-1 font-black outline-none text-right mt-0.5"
                              value={editingTargetValue}
                              onChange={e => setEditingTargetValue(e.target.value)}
                              onBlur={() => { updateTarget(vault.id, parseFloat(editingTargetValue) || vault.target); setEditingTargetId(null); }}
                              onKeyDown={e => { if (e.key === 'Enter') { updateTarget(vault.id, parseFloat(editingTargetValue) || vault.target); setEditingTargetId(null); } }}
                            />
                          ) : (
                            <p
                              onClick={() => { setEditingTargetId(vault.id); setEditingTargetValue(vault.target.toString()); }}
                              className="text-[10px] font-bold uppercase tracking-wide text-text-muted cursor-pointer hover:text-text-main flex items-center gap-1 mt-0.5"
                            >
                              Target: {formatCurrency(vault.target, privacyMode)} <Edit2 size={9} />
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          aria-label="Delete vault"
                          onClick={() => setDeletingVaultId(vault.id)}
                          className="shrink-0 w-11 h-11 flex items-center justify-center border-[3px] border-black rounded-xl bg-surface opacity-40 hover:opacity-100 hover:bg-action-bleed hover:border-action-bleed hover:text-white transition-all"
                        >
                          <Trash2 size={15} strokeWidth={2.5} />
                        </button>
                      </div>

                      {/* Progress bar */}
                      <div className="mb-4">
                        <div className="flex justify-between items-end text-[10px] mb-1.5">
                          <span className="font-bold uppercase tracking-wide text-text-muted">
                            {formatCurrency(vault.current, privacyMode)}
                            {!isComplete && <span className="text-text-muted/50"> / {formatCurrency(vault.target, privacyMode)}</span>}
                          </span>
                          <span className={`font-black uppercase tracking-widest ${isComplete ? 'text-action-primary' : 'text-text-main'}`}>
                            {Math.min(100, progress).toFixed(1)}%
                          </span>
                        </div>
                        <div className="relative w-full h-3 bg-input border-2 border-black rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, progress)}%` }}
                            className={`h-full ${group.barColor}`}
                          />
                          <div className="absolute top-0 bottom-0 left-1/4 w-px bg-black/20" />
                          <div className="absolute top-0 bottom-0 left-1/2 w-px bg-black/20" />
                          <div className="absolute top-0 bottom-0 left-3/4 w-px bg-black/20" />
                        </div>
                        {!isComplete && remaining > 0 && (
                          <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted mt-1">
                            {formatCurrency(remaining, privacyMode)} to go
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFundingVault({ id: vault.id, name: vault.name })}
                          className="flex-1 h-10 border-4 border-black rounded-2xl bg-action-capture text-black font-black uppercase text-xs tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
                        >
                          Fund
                        </button>
                        <button
                          type="button"
                          title="Move funds"
                          onClick={() => setTransferVault({ id: vault.id, name: vault.name, current: vault.current })}
                          className="w-10 h-10 flex items-center justify-center border-4 border-black rounded-2xl bg-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all opacity-60 hover:opacity-100"
                        >
                          <ArrowLeftRight size={15} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Empty section */
              <div className="flex items-center gap-3 bg-input border-2 border-dashed border-border rounded-2xl p-4">
                <div className={`w-8 h-8 ${group.iconBg} border-2 border-black/20 rounded-xl flex items-center justify-center shrink-0 opacity-40`}>
                  <group.icon size={14} strokeWidth={2.5} className={group.iconText} />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted flex-1">{group.emptyHint}</p>
                <button
                  type="button"
                  onClick={() => openCreate(group.id)}
                  className="shrink-0 flex items-center gap-1 h-8 px-3 border-2 border-black rounded-xl bg-surface font-black text-[10px] uppercase tracking-widest text-text-main hover:bg-input transition-colors"
                >
                  <Plus size={12} strokeWidth={3} /> Add
                </button>
              </div>
            )}
          </div>
        );
      })}

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

      {/* ── Sticky bottom CTA ─────────────────────────────────────────────────── */}
      <div className="sticky bottom-0 z-20 pt-4 pb-2 bg-linear-to-t from-base to-transparent">
        <button
          type="button"
          onClick={() => openCreate()}
          className="w-full h-14 flex items-center justify-center gap-2.5 bg-black border-4 border-black rounded-2xl text-action-primary font-black uppercase tracking-widest text-[11px] shadow-[6px_6px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
        >
          <Plus size={18} strokeWidth={3} /> Create New Vault
        </button>
      </div>

      {/* ── Sheet components ──────────────────────────────────────────────────── */}
      <VaultFormSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        defaultClass={formDefaultClass}
      />
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
