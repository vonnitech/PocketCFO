import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck, Plus, Edit2, Target, Trash2, RotateCcw,
  AlertTriangle, Check, X, Trophy, ArrowLeftRight, TrendingUp, ChevronDown, Lock,
  ArrowUp, ArrowDown, Eye, EyeOff, SlidersHorizontal,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import type { VaultAssetClass } from '../store/useStore';
import { formatCurrency } from '../lib/utils';
import { currencySymbol } from '../lib/currency';
import { useIsPro } from '../lib/pro';
import { userKey } from '../lib/userScopedStorage';
import { calculateVaultProgress, calculateCurrentMonthDeposits, calculateAvailableToVault } from '../core/math';
import { FundVaultSheet } from '../components/FundVaultSheet';
import { VaultTransferSheet } from '../components/VaultTransferSheet';

// Free tier: up to 3 vaults total (any type). Existing over-cap vaults are
// grandfathered (never deleted); only the create action is gated.
const FREE_VAULT_CAP = 3;

// Per-user Vaults section preferences (order / hidden / collapsed), saved to
// user-scoped localStorage so no DB migration is needed.
type SectionPrefs = { order: VaultAssetClass[]; hidden: VaultAssetClass[]; collapsed: VaultAssetClass[] };
const DEFAULT_SECTION_ORDER: VaultAssetClass[] = ['INVESTMENT', 'SINKING_FUND', 'CASH_RESERVE'];
const SECTION_PREFS_KEY = 'vault-section-prefs';

function loadSectionPrefs(): SectionPrefs {
  const fallback: SectionPrefs = { order: [...DEFAULT_SECTION_ORDER], hidden: [], collapsed: [] };
  try {
    const raw = localStorage.getItem(userKey(SECTION_PREFS_KEY));
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<SectionPrefs>;
    const valid = (arr: unknown): VaultAssetClass[] =>
      (Array.isArray(arr) ? arr : []).filter((id): id is VaultAssetClass => DEFAULT_SECTION_ORDER.includes(id as VaultAssetClass));
    const order = valid(p.order);
    return {
      order: [...order, ...DEFAULT_SECTION_ORDER.filter(id => !order.includes(id))],
      hidden: valid(p.hidden),
      collapsed: valid(p.collapsed),
    };
  } catch {
    return fallback;
  }
}

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
    upcomingBills,
    monthlySavingsGoal,
    transactions,
    nextPayday,
    renameVault,
    deleteVault,
    restoreVault,
    permanentlyDeleteVault,
    addVault,
  } = useStore();
  const isPro = useIsPro();
  const vaultCapReached = !isPro && vaults.length >= FREE_VAULT_CAP;

  // Section customization (order / hidden / collapsed), persisted per user.
  const [sectionPrefs, setSectionPrefs] = useState<SectionPrefs>(loadSectionPrefs);
  const [showCustomize, setShowCustomize] = useState(false);
  useEffect(() => {
    try { localStorage.setItem(userKey(SECTION_PREFS_KEY), JSON.stringify(sectionPrefs)); } catch { /* ignore */ }
  }, [sectionPrefs]);
  const toggleCollapsed = (id: VaultAssetClass) =>
    setSectionPrefs(p => ({ ...p, collapsed: p.collapsed.includes(id) ? p.collapsed.filter(x => x !== id) : [...p.collapsed, id] }));
  const toggleHidden = (id: VaultAssetClass) =>
    setSectionPrefs(p => ({ ...p, hidden: p.hidden.includes(id) ? p.hidden.filter(x => x !== id) : [...p.hidden, id] }));
  const moveSection = (id: VaultAssetClass, dir: -1 | 1) =>
    setSectionPrefs(p => {
      const i = p.order.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.order.length) return p;
      const order = [...p.order];
      [order[i], order[j]] = [order[j], order[i]];
      return { ...p, order };
    });

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

  // Restore is gated: a free user at the cap can't restore back over 3 active vaults.
  const [showRestoreLimitModal, setShowRestoreLimitModal] = useState(false);
  const handleRestore = (id: string) => {
    if (!isPro && vaults.length >= FREE_VAULT_CAP) { setShowRestoreLimitModal(true); return; }
    restoreVault(id);
  };
  const handleCloseRestoreModal = () => setShowRestoreLimitModal(false);

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
  const availableToVault      = calculateAvailableToVault(liquidAssets, upcomingBills);
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">Vaults</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">Savings goals &amp; asset management</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCustomize(v => !v)}
          className={`shrink-0 mt-1 flex items-center gap-1.5 h-9 px-3 border-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${showCustomize ? 'bg-action-primary border-black text-black' : 'bg-surface border-border text-text-muted hover:border-black hover:text-text-main'}`}
        >
          <SlidersHorizontal size={12} strokeWidth={3} /> Customize
        </button>
      </div>

      {/* Customize sections: reorder + show/hide the three vault categories */}
      {showCustomize && (
        <div className="bg-surface border-4 border-border rounded-3xl p-4 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-2">
          <p className="label-xs mb-1">Customize Sections · reorder and show/hide</p>
          {sectionPrefs.order.map((id, i) => {
            const g = GROUPS.find(x => x.id === id);
            if (!g) return null;
            const hidden = sectionPrefs.hidden.includes(id);
            return (
              <div key={id} className="flex items-center gap-2 bg-input border-2 border-border rounded-2xl p-2.5">
                <div className={`w-7 h-7 ${g.iconBg} border-2 border-black rounded-lg flex items-center justify-center shrink-0 ${hidden ? 'opacity-40' : ''}`}>
                  <g.icon size={13} strokeWidth={2.5} className={g.iconText} />
                </div>
                <span className={`flex-1 text-[11px] font-black uppercase tracking-widest ${hidden ? 'text-text-muted/50' : 'text-text-main'}`}>{g.label}</span>
                <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => moveSection(id, -1)} className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-black bg-surface disabled:opacity-30 hover:bg-input transition-colors">
                  <ArrowUp size={13} strokeWidth={3} />
                </button>
                <button type="button" aria-label="Move down" disabled={i === sectionPrefs.order.length - 1} onClick={() => moveSection(id, 1)} className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-black bg-surface disabled:opacity-30 hover:bg-input transition-colors">
                  <ArrowDown size={13} strokeWidth={3} />
                </button>
                <button type="button" aria-label={hidden ? 'Show section' : 'Hide section'} onClick={() => toggleHidden(id)} className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-black bg-surface hover:bg-input transition-colors">
                  {hidden ? <EyeOff size={13} strokeWidth={3} className="text-text-muted" /> : <Eye size={13} strokeWidth={3} />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats: Total Vaulted (accent hero) / Monthly Goal / Available to Vault.
          Mobile: Total full-width, Goal + Available half-width below. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Total Vaulted — accent hero */}
        <div className="col-span-2 sm:col-span-1 bg-action-primary border-4 border-black rounded-2xl p-4 shadow-brutal">
          <p className="text-[10px] font-black uppercase tracking-widest text-black/60 mb-1">Total Vaulted</p>
          <p className="text-3xl sm:text-2xl font-black italic tabular-nums text-black leading-none">
            {formatCurrency(totalVaulted, privacyMode)}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-black/50 mt-1">Across all vaults</p>
        </div>

        {/* Monthly Goal */}
        <div className="bg-surface border-4 border-border rounded-2xl p-4 shadow-[4px_4px_0px_0px_var(--shadow-color)]">
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1">Monthly Goal</p>
          <p className="text-xl font-black italic tabular-nums text-text-main leading-none">
            {formatCurrency(monthlySavingsGoal, privacyMode)}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1">
            {monthlySavingsGoal > 0 ? (goalPct >= 100 ? 'Goal complete' : `${goalPct.toFixed(0)}% done`) : 'Set in config'}
          </p>
        </div>

        {/* Available to Vault */}
        <div className="bg-surface border-4 border-border rounded-2xl p-4 shadow-[4px_4px_0px_0px_var(--shadow-color)]">
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1">Available to Vault</p>
          <p className="text-xl font-black italic tabular-nums text-capture-readable leading-none">
            {formatCurrency(availableToVault, privacyMode)}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1">
            {monthlySavingsGoal > 0 && remainingToGoal > 0 ? `${formatCurrency(remainingToGoal, privacyMode)} to hit goal` : 'Ready to distribute'}
          </p>
        </div>
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
            <div key={vault.id} className={`relative group bg-surface border-4 rounded-2xl p-4 shadow-[4px_4px_0px_0px_var(--shadow-color)] ${isComplete ? group.borderActive : 'border-border'}`}>
              {/* Delete — revealed on card hover so it never steals width from the name */}
              <button type="button" aria-label="Delete vault" onClick={() => setDeletingVaultId(vault.id)} className="absolute top-2.5 right-2.5 w-7 h-7 flex items-center justify-center rounded-lg bg-surface/70 opacity-0 group-hover:opacity-100 hover:text-action-bleed transition-all">
                <Trash2 size={13} strokeWidth={2.5} />
              </button>
              {/* Header: icon beside the name; name gets the full remaining width */}
              <div className="flex items-start gap-2.5 mb-3">
                <div className={`w-9 h-9 border-[3px] border-black rounded-xl flex items-center justify-center shrink-0 ${group.iconBg}`}>
                  {isComplete ? <Trophy size={16} strokeWidth={3} className="text-black" /> : <group.icon size={16} strokeWidth={3} className={group.iconText} />}
                </div>
                <div className="flex-1 min-w-0 pr-7">
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
                    <div className="flex items-start gap-1.5">
                      <h3 className="flex-1 min-w-0 text-[1rem] font-black italic uppercase tracking-tighter text-text-main line-clamp-2 leading-tight pr-1.5">{vault.name}</h3>
                      <button type="button" aria-label="Rename vault" onClick={() => { setEditingNameId(vault.id); setEditingNameValue(vault.name); }} className="shrink-0 mt-0.5 opacity-30 hover:opacity-100 transition-opacity">
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
              </div>
              {/* Progress bar */}
              <div className="mb-3">
                <div className="w-full h-2 bg-input border-2 border-black rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, progress)}%` }} className={`h-full ${group.barColor}`} />
                </div>
                <div className="flex justify-between items-baseline mt-1">
                  <span className="text-[9px] font-bold text-text-muted tabular-nums">{formatCurrency(vault.current, privacyMode)}</span>
                  {!isComplete && (
                    <span className="text-[9px] font-black text-text-muted tabular-nums">{Math.min(100, progress).toFixed(0)}%</span>
                  )}
                  {isComplete && <span className="text-[9px] font-black text-capture-readable uppercase tracking-widest">Goal Achieved</span>}
                </div>
              </div>
              {/* Actions */}
              <div className="flex gap-2">
                <button type="button" onClick={() => setFundingVault({ id: vault.id, name: vault.name })}
                  className="flex-1 h-9 border-[3px] border-black rounded-xl bg-action-capture text-capture-contrast font-black uppercase text-[11px] tracking-widest shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-px hover:translate-y-px transition-all">
                  Fund
                </button>
                <button type="button" title="Move funds" aria-label="Move funds" onClick={() => setTransferVault({ id: vault.id, name: vault.name, current: vault.current })}
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
          const collapsed  = sectionPrefs.collapsed.includes(group.id);
          return (
            <div key={group.id} className="space-y-3">
              {/* Section header — click to collapse/expand */}
              <button type="button" onClick={() => toggleCollapsed(group.id)} className="w-full flex items-center gap-2.5 text-left">
                <div className={`w-8 h-8 ${group.iconBg} border-[3px] border-black rounded-xl flex items-center justify-center shrink-0`}>
                  <group.icon size={14} strokeWidth={2.5} className={group.iconText} />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-black uppercase tracking-widest text-text-main leading-none">{group.label}</p>
                  {grouped.length > 0 && <p className="text-[9px] font-bold text-text-muted tabular-nums mt-0.5">{formatCurrency(groupTotal, privacyMode)}</p>}
                </div>
                <ChevronDown size={16} strokeWidth={3} className={`ml-auto shrink-0 text-text-muted transition-transform ${collapsed ? '-rotate-90' : ''}`} />
              </button>
              {!collapsed && (grouped.length > 0 ? (
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
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
              ))}
            </div>
          );
        };

        // Render in the user's chosen order, skipping hidden categories.
        const orderedVisible = sectionPrefs.order
          .map(id => GROUPS.find(g => g.id === id))
          .filter((g): g is typeof GROUPS[0] => !!g && !sectionPrefs.hidden.includes(g.id));

        return <>{orderedVisible.map(g => renderGroup(g))}</>;
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
              <div key={vault.id} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-input border-2 border-border rounded-2xl p-4">
                <div className="flex-1 min-w-0">
                  <p className="font-black italic uppercase tracking-tighter text-text-muted line-through line-clamp-2 pr-1.5">{vault.name}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
                    {formatCurrency(vault.current, privacyMode)} stored · Target {formatCurrency(vault.target, privacyMode)}
                  </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => handleRestore(vault.id)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 h-11 px-3 border-[3px] border-black rounded-full bg-action-capture text-capture-contrast font-black uppercase text-[10px] tracking-widest shadow-brutal-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
                  >
                    <RotateCcw size={12} strokeWidth={3} /> Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => setPermanentDeleteId(vault.id)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 h-11 px-3 border-[3px] border-black rounded-full bg-surface text-action-bleed font-black uppercase text-[10px] tracking-widest shadow-brutal-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
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
          onClick={() => {
            if (vaultCapReached) { window.dispatchEvent(new CustomEvent('pro-upsell', { detail: { feature: 'vault_cap' } })); return; }
            setShowForm(v => !v);
          }}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-input transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-black border-[3px] border-black rounded-xl flex items-center justify-center shrink-0">
              <Plus size={15} strokeWidth={3} className="text-action-primary" />
            </div>
            <span className="text-[11px] font-black uppercase tracking-widest text-text-main">Create New Vault</span>
            {vaultCapReached && (
              <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted">Pro for more</span>
            )}
          </div>
          {vaultCapReached ? (
            <Lock size={15} strokeWidth={3} className="text-text-muted shrink-0" />
          ) : (
            <motion.div animate={{ rotate: showForm ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={16} strokeWidth={2.5} className="text-text-muted" />
            </motion.div>
          )}
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
              <div className="px-5 pb-5 pt-4 space-y-5 border-t-2 border-border">

                {/* Type picker — 3-up card selector (one row on desktop) */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Vault Type</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {CLASS_OPTIONS.map(opt => {
                      const selected = formClass === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setFormClass(opt.id)}
                          className={`relative flex items-center sm:flex-col sm:items-start gap-3 sm:gap-2.5 p-3 rounded-2xl border-[3px] text-left transition-all ${
                            selected
                              ? 'bg-black border-black shadow-[3px_3px_0px_0px_var(--color-action-primary)]'
                              : 'bg-input border-border hover:border-black'
                          }`}
                        >
                          <div className={`w-9 h-9 border-2 border-black rounded-xl flex items-center justify-center shrink-0 ${selected ? 'bg-action-primary' : 'bg-surface'}`}>
                            <opt.icon size={16} strokeWidth={2.5} className="text-black" />
                          </div>
                          <div className="min-w-0">
                            <p className={`text-[11px] font-black uppercase tracking-widest leading-none ${selected ? 'text-action-primary' : 'text-text-main'}`}>{opt.label}</p>
                            <p className={`text-[9px] font-bold mt-1 leading-snug ${selected ? 'text-white/50' : 'text-text-muted'}`}>{opt.desc}</p>
                          </div>
                          {selected && (
                            <span className="absolute top-2 right-2 w-4 h-4 bg-action-primary border-2 border-black rounded-full hidden sm:flex items-center justify-center">
                              <Check size={9} strokeWidth={4} className="text-black" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Name + Target — paired on desktop to keep the form compact */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Vault Name</p>
                    <input
                      title="Vault Name"
                      placeholder="e.g. EMERGENCY FUND"
                      className="w-full h-16 bg-input border-4 border-black rounded-2xl px-4 font-black uppercase text-sm text-text-main outline-none focus:border-action-capture transition-colors"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && submitForm()}
                    />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Savings Target</p>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-text-muted text-lg pointer-events-none select-none">{currencySymbol()}</span>
                      <input
                        type="number"
                        min="0"
                        title="Target Amount"
                        placeholder="0"
                        className="w-full h-16 bg-input border-4 border-black rounded-2xl pl-9 pr-4 font-black text-xl text-text-main outline-none focus:border-action-capture transition-colors tabular-nums"
                        value={formTarget}
                        onChange={e => setFormTarget(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && submitForm()}
                      />
                    </div>
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

      {/* ── Restore blocked: free user already at the active-vault cap ──────────── */}
      {showRestoreLimitModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border-4 border-border rounded-3xl p-7 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-sm w-full">
            <div className="w-12 h-12 bg-action-primary border-4 border-black rounded-2xl flex items-center justify-center mb-4 mx-auto">
              <Lock size={22} strokeWidth={3} className="text-black" />
            </div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-text-main text-center mb-2">Vault Limit Reached</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted text-center mb-5">
              Free keeps {FREE_VAULT_CAP} active vaults. Restore this one with Pro, or trash an active vault first to make room.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={handleCloseRestoreModal} className="flex-1 h-12 border-4 border-border rounded-full bg-surface text-text-main font-black text-sm uppercase tracking-widest shadow-[4px_4px_0px_0px_var(--shadow-color)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all">Got it</button>
              <Link to="/settings#pro" onClick={handleCloseRestoreModal} className="flex-1 h-12 flex items-center justify-center border-4 border-black rounded-full bg-action-primary text-black font-black text-sm uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all">Get Pro</Link>
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
