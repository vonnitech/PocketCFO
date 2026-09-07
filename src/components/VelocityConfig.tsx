import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useStore } from '../store/useStore';
import { currencySymbol } from '../lib/currency';
import {
  calculatePacedAllowance,
  PACE_MODELS,
  SURPLUS_ROUTES,
  type VelocityConfig as VelocityConfigShape,
} from '../core/velocity';
import { calculateDaysUntilPayday, calculateDailyDrain, calculateFlatSafeSpend, toLocalDateKey } from '../core/math';
import { isSinkingFund } from '../core/vaults';
import { Link } from 'react-router-dom';

export function VelocityConfig() {
  const state = useStore();
  const { velocityConfig, setVelocityConfig, nextPayday, vaults, transactions, privacyMode } = state;

  // The store's safeSpendLimit is already paced. Reshaping that again would
  // trim a trimmed number, so this screen derives the baseline itself.
  const flatBaseline = calculateFlatSafeSpend(state);

  // Local draft so the slider and radios stay responsive. Writing on every
  // change would fire a Supabase update per slider pixel.
  const [draft, setDraft] = useState<VelocityConfigShape>(velocityConfig);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(velocityConfig);

  // Whole dollars, no cents. These cells are a third of a row and the app
  // already settled this on the dashboard pillars: a shrunken true number beats
  // a truncated one.
  const fmt = (v: number) =>
    privacyMode ? '••••' : `${currencySymbol()}${Math.round(Math.abs(v)).toLocaleString()}`;
  const cellSize = (t: string) =>
    t.length <= 4 ? 'text-xl' : t.length <= 7 ? 'text-lg' : 'text-base';

  const daysLeft = nextPayday ? calculateDaysUntilPayday(nextPayday) : 0;
  const paced = useMemo(
    () => calculatePacedAllowance(flatBaseline, daysLeft, draft),
    [flatBaseline, daysLeft, draft],
  );

  const todayKey = toLocalDateKey(new Date());
  const spentToday = useMemo(
    () => calculateDailyDrain(transactions.filter(t => toLocalDateKey(t.date) === todayKey)),
    [transactions, todayKey],
  );

  const cap = paced.todayRate;
  const pct = cap > 0 ? Math.min(100, (spentToday / cap) * 100) : 0;
  const over = cap > 0 && spentToday > cap;

  const sinkingFunds = vaults.filter(isSinkingFund);
  const trimMax = Math.max(5, Math.floor(flatBaseline * 0.5));

  const save = async () => {
    setSaving(true);
    await setVelocityConfig(draft);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const patch = (p: Partial<VelocityConfigShape>) => setDraft(d => ({ ...d, ...p }));

  const cells = [
    { k: 'Flat', v: paced.currentDailyBaseline },
    { k: 'Weekday', v: paced.weekdayRate },
    { k: 'Weekend', v: paced.weekendRate },
  ];

  return (
    <div className="space-y-5">
      {/* ── A. Current daily baseline ── */}
      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex px-3 py-1 bg-action-capture border-2 border-black rounded-full text-capture-contrast text-[10px] font-black tracking-widest uppercase">
            Daily Baseline
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted shrink-0">
            {daysLeft} day{daysLeft === 1 ? '' : 's'} to payday
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {cells.map(cell => (
            <div key={cell.k} className="bg-input border-2 border-border rounded-2xl px-3 py-2.5 min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted">{cell.k}</p>
              <p className={`${cellSize(fmt(cell.v))} font-black italic tracking-tighter text-text-main tabular-nums leading-none mt-1`}>
                {fmt(cell.v)}
              </p>
            </div>
          ))}
        </div>

        {paced.note && (
          <p className="text-[10px] font-bold uppercase tracking-widest text-action-bleed">{paced.note}</p>
        )}

        <div className="space-y-2.5">
          <div className="h-5 bg-input border-[3px] border-black rounded-lg overflow-hidden">
            <motion.div
              className={`h-full ${over ? 'bg-action-bleed' : 'bg-action-capture'}`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 30 }}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
              {fmt(spentToday)} spent
            </span>
            <span
              className={`px-2.5 py-1 border-2 border-black rounded-lg text-[11px] font-black uppercase tracking-widest shrink-0 ${
                over ? 'bg-action-bleed text-white' : 'bg-action-capture text-capture-contrast'
              }`}
            >
              {over ? `${fmt(spentToday - cap)} over` : `${fmt(cap - spentToday)} left`}
            </span>
          </div>
        </div>
      </div>

      {/* ── B. Pace distribution model ── */}
      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-4">
        <div className="inline-flex px-3 py-1 bg-black border-2 border-black rounded-full text-action-primary text-[10px] font-black tracking-widest uppercase">
          Pace Model
        </div>

        <div className="space-y-3">
          {PACE_MODELS.map(m => {
            const active = draft.paceModel === m.id;
            return (
              <motion.button
                key={m.id}
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => patch({ paceModel: m.id })}
                className={`w-full text-left border-4 rounded-2xl px-4 py-3 transition-all ${
                  active
                    ? 'bg-black border-black text-action-primary shadow-[4px_4px_0px_0px_var(--color-action-primary)]'
                    : 'bg-input border-border text-text-main hover:border-black'
                }`}
              >
                <p className="text-[11px] font-black uppercase tracking-widest leading-none">{m.label}</p>
                <p className={`text-[10px] font-bold uppercase tracking-wide mt-1.5 leading-snug ${active ? 'text-action-primary/60' : 'text-text-muted'}`}>
                  {m.blurb}
                </p>
              </motion.button>
            );
          })}
        </div>

        <div className={draft.paceModel === 'FLAT' ? 'opacity-40 pointer-events-none' : ''}>
          <div className="flex justify-between items-baseline gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
              Weekday Trim
            </span>
            <span className="text-lg font-black italic tracking-tighter text-text-main tabular-nums">
              {currencySymbol()}{Math.round(Math.min(draft.weekdayTrim, trimMax)).toLocaleString()}
              <span className="text-[10px] font-bold not-italic tracking-widest text-text-muted"> / day</span>
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={trimMax}
            step={1}
            value={Math.min(draft.weekdayTrim, trimMax)}
            onChange={e => patch({ weekdayTrim: Number(e.target.value) })}
            aria-label="Weekday capital trim"
            className="w-full accent-[var(--color-action-primary)]"
          />
          {draft.paceModel === 'WEEKEND_LOADED' && paced.appliedTrim > 0 && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex-1 min-w-0 bg-input border-2 border-border rounded-xl px-3 py-2">
                  <span className="block text-[9px] font-bold uppercase tracking-widest text-text-muted">Weekdays</span>
                  <span className="block text-base font-black italic tracking-tighter text-text-main tabular-nums">
                    {fmt(paced.weekdayRate)}
                  </span>
                </span>
                <span className="flex-1 min-w-0 bg-action-capture/10 border-2 border-action-capture rounded-xl px-3 py-2">
                  <span className="block text-[9px] font-bold uppercase tracking-widest text-text-muted">Weekends</span>
                  <span className="block text-base font-black italic tracking-tighter text-capture-readable tabular-nums">
                    {fmt(paced.weekendRate)}
                  </span>
                </span>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted leading-snug">
                {fmt(paced.appliedTrim * paced.weekdaysRemaining)} moved from{' '}
                {paced.weekdaysRemaining} weekday{paced.weekdaysRemaining === 1 ? '' : 's'} to{' '}
                {paced.weekendDaysRemaining} weekend day{paced.weekendDaysRemaining === 1 ? '' : 's'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── C. End-of-day surplus routing ── */}
      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-4">
        <div className="inline-flex px-3 py-1 bg-black border-2 border-black rounded-full text-action-primary text-[10px] font-black tracking-widest uppercase">
          Surplus Routing
        </div>

        <div className="space-y-3">
          {SURPLUS_ROUTES.map(r => {
            const active = draft.surplusRouting === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => patch({ surplusRouting: r.id })}
                className={`w-full text-left border-4 rounded-2xl px-4 py-3 transition-all ${
                  active
                    ? 'bg-action-primary border-black text-primary-contrast shadow-[4px_4px_0px_0px_var(--shadow-color)]'
                    : 'bg-input border-border text-text-main hover:border-black'
                }`}
              >
                <p className="text-[11px] font-black uppercase tracking-widest leading-none">{r.label}</p>
                <p className={`text-[10px] font-bold uppercase tracking-wide mt-1.5 leading-snug ${active ? 'text-primary-contrast/60' : 'text-text-muted'}`}>
                  {r.blurb}
                </p>
              </button>
            );
          })}
        </div>

        {draft.surplusRouting === 'SWEEP_VAULT' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
              Destination Sinking Fund
            </p>
            {sinkingFunds.length > 0 ? (
              <select
                value={draft.sweepTargetVaultId ?? ''}
                onChange={e => patch({ sweepTargetVaultId: e.target.value || null })}
                aria-label="Destination sinking fund"
                className="w-full bg-input border-4 border-border rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-text-main outline-none focus:border-black transition-colors"
              >
                <option value="">Select a vault</option>
                {sinkingFunds.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            ) : (
              <Link
                to="/vaults"
                className="flex items-center justify-between gap-3 bg-input border-2 border-dashed border-border rounded-2xl p-4 hover:border-black transition-colors"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                  No sinking funds yet
                </span>
                <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-text-main">
                  Create one →
                </span>
              </Link>
            )}
          </motion.div>
        )}
      </div>

      {/* ── D. Save ── */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={save}
        disabled={!dirty || saving || (draft.surplusRouting === 'SWEEP_VAULT' && !draft.sweepTargetVaultId)}
        className="w-full h-14 border-4 border-black rounded-full bg-black text-action-primary font-black uppercase tracking-widest text-sm shadow-[4px_4px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[4px_4px_0px_0px_var(--color-action-primary)]"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Pacing Configuration'}
      </motion.button>

      {draft.surplusRouting === 'SWEEP_VAULT' && !draft.sweepTargetVaultId && (
        <p className="text-[10px] font-bold uppercase tracking-widest text-action-bleed text-center">
          {sinkingFunds.length > 0
            ? 'Pick a destination vault to save'
            : 'Sweeping needs a sinking fund to send money to'}
        </p>
      )}
    </div>
  );
}
