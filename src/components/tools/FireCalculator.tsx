import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Flame, Target, TrendingUp, RotateCcw, ShieldCheck, Zap, Link as LinkIcon, Anchor, Lock, LockOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { userKey } from '../../lib/userScopedStorage';
import { currencySymbol } from '../../lib/currency';
import { computeFire, summaryRows, fmt, fmtFull, clampPct, DEFAULT_REAL_RETURN, MIN_AGE, MAX_AGE, type FireStrategy } from '../../lib/fireMath';
import { amountFitClass, amountTextSize } from '../../lib/amountDisplay';
import { PreviewChip } from '../PreviewChip';
import { ProAction } from '../ProAction';

// ── Constants ────────────────────────────────────────────────────────────────
// Annual growth after inflation, in percent. Users can override it; this is the starting value.

// ── Strategy config ──────────────────────────────────────────────────────────

const STRATEGIES: { id: FireStrategy; label: string; tag: string; desc: string }[] = [
  { id: 'STANDARD', label: 'Standard', tag: 'FIRE',         desc: 'Full financial independence · your investments permanently cover 100% of your living expenses forever.' },
  { id: 'FAT',      label: 'Fat',      tag: 'FAT FIRE',     desc: 'Retire with a premium lifestyle. Adds 50% to your annual expenses for comfort, travel, and full flexibility.' },
  { id: 'LEAN',     label: 'Lean',     tag: 'LEAN FIRE',    desc: 'Retire lean. Targets 70% of your stated expenses · ideal for frugal minimalists who want out as early as possible.' },
  { id: 'BARISTA',  label: 'Barista',  tag: 'BARISTA FIRE', desc: 'Semi-retire with part-time work covering some expenses. Your portfolio only needs to replace the rest.' },
  { id: 'COAST',    label: 'Coast',    tag: 'COAST FIRE',   desc: 'Stop saving now and let compounding take over. Calculates the lump sum you need invested today to coast to your FIRE number by 65 with zero future contributions.' },
];

// Calculates the next stepping-stone milestone above the current balance.
// Steps scale with magnitude so milestones always feel close enough to chase.
function nextMilestone(current: number): number {
  if (current < 0) return 0;
  const step =
    current < 10_000    ? 1_000 :
    current < 100_000   ? 10_000 :
    current < 1_000_000 ? 100_000 :
                          250_000;
  const next = Math.ceil((current + 1) / step) * step;
  return next;
}

// ── SVG Chart ────────────────────────────────────────────────────────────────
const VW = 400;
const VH = 180;
const PAD = { t: 14, r: 16, b: 28, l: 52 };
const PW = VW - PAD.l - PAD.r;
const PH = VH - PAD.t - PAD.b;

interface ChartProps {
  data: { age: number; value: number }[];
  fireNumber: number;
  targetAge: number;
  currentAge: number;
  fireAge: number | null;
}

function FireChart({ data, fireNumber, targetAge, currentAge, fireAge }: ChartProps) {
  const maxVal = Math.max(fireNumber * 1.3, data[data.length - 1].value * 1.05, 1);
  const totalYears = data.length - 1;

  const px = (i: number) => PAD.l + (i / Math.max(totalYears, 1)) * PW;
  const py = (v: number) => PAD.t + PH * (1 - Math.min(v / maxVal, 1));

  const linePts = data.map((d, i) => `${px(i).toFixed(1)},${py(d.value).toFixed(1)}`).join(' ');
  const areaPath = `M ${linePts} L ${px(totalYears).toFixed(1)},${(PAD.t + PH).toFixed(1)} L ${PAD.l},${(PAD.t + PH).toFixed(1)} Z`;

  const fireY = py(fireNumber).toFixed(1);
  const targetI = Math.min(targetAge - currentAge, totalYears);
  const targetX = px(targetI).toFixed(1);

  const yLabels = [
    { val: 0, y: py(0) },
    { val: fireNumber / 2, y: py(fireNumber / 2) },
    { val: fireNumber, y: py(fireNumber) },
  ];

  const xLabels = [
    { label: String(currentAge), x: px(0) },
    { label: String(targetAge), x: px(targetI) },
    ...(totalYears > targetI + 4 ? [{ label: String(currentAge + totalYears), x: px(totalYears) }] : []),
  ];

  const crossI = data.findIndex(d => d.value >= fireNumber);
  const crossX = crossI >= 0 ? px(crossI) : null;

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full h-auto" aria-label="FIRE trajectory chart">
      <path d={areaPath} fill="var(--color-action-capture)" fillOpacity="0.12" />
      <line x1={PAD.l} y1={fireY} x2={VW - PAD.r} y2={fireY}
        stroke="var(--color-action-primary)" strokeWidth="1.5" strokeDasharray="5,4" />
      <line x1={targetX} y1={PAD.t} x2={targetX} y2={PAD.t + PH}
        stroke="currentColor" strokeWidth="1" strokeDasharray="4,3" opacity="0.2" />
      <polyline points={linePts} fill="none" stroke="var(--color-action-capture)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {crossX !== null && (
        <circle cx={crossX} cy={fireY} r="5" fill="var(--color-action-primary)" stroke="var(--color-border)" strokeWidth="2" />
      )}
      {yLabels.map(({ val, y }) => (
        <text key={val} x={PAD.l - 6} y={y + 4} textAnchor="end"
          fontSize="8" fontFamily="monospace" fontWeight="bold" fill="var(--color-text-muted)">
          {fmt(val)}
        </text>
      ))}
      {xLabels.map(({ label, x }) => (
        <text key={label} x={x} y={VH - 4} textAnchor="middle"
          fontSize="9" fontFamily="monospace" fontWeight="bold" fill="var(--color-text-muted)">
          {label}
        </text>
      ))}
      {crossX !== null && fireAge !== null && (() => {
        const nearEdge = crossI >= 0 && crossI <= 3;
        return (
          <text
            x={nearEdge ? Number(crossX) + 8 : Number(crossX)}
            y={Number(fireY) - 9}
            textAnchor={nearEdge ? 'start' : 'middle'}
            fontSize="8" fontFamily="monospace" fontWeight="bold" fill="var(--color-primary-readable)"
          >
            {currentAge + fireAge}
          </text>
        );
      })()}
    </svg>
  );
}

// ── Input Field ──────────────────────────────────────────────────────────────
function Field({ label, prefix, value, onChange, integer }: {
  label: string; prefix?: string; value: string; onChange: (v: string) => void; integer?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5">{label}</p>
      <div className="relative">
        {prefix && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-text-muted pointer-events-none select-none text-lg">
            {prefix}
          </span>
        )}
        <input
          type="number"
          title={label}
          inputMode={integer ? 'numeric' : 'decimal'}
          min="0"
          value={value}
          onChange={e => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
          onFocus={e => e.target.select()}
          className={`w-full bg-input border-4 border-black rounded-2xl py-3 pr-4 font-black text-xl text-text-main outline-none focus:border-action-capture transition-colors tabular-nums ${prefix ? 'pl-9' : 'pl-4'}`}
        />
      </div>
    </div>
  );
}

// ── Live Data Badge ──────────────────────────────────────────────────────────
function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-action-capture border-2 border-black rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
      <span className="text-[9px] font-black uppercase tracking-widest text-black">Live</span>
    </span>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
const DEFAULTS = { currentAge: '28', targetAge: '45', annualExpenses: '40000', partTimeIncome: '20000', externalInvestments: '', realReturn: '' };
const SS_BASE = 'pocket-cfo-fire-inputs-v1';

function loadSaved(): typeof DEFAULTS & { strategy: FireStrategy } {
  try {
    const raw = sessionStorage.getItem(userKey(SS_BASE));
    if (raw) return { ...DEFAULTS, strategy: 'STANDARD', ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS, strategy: 'STANDARD' };
}

function saveField(key: string, value: string) {
  try {
    const k = userKey(SS_BASE);
    const cur = JSON.parse(sessionStorage.getItem(k) ?? '{}');
    sessionStorage.setItem(k, JSON.stringify({ ...cur, [key]: value }));
  } catch {}
}

export function FireCalculator() {
  const allVaults      = useStore(s => s.vaults);
  const vaults         = allVaults.filter(v => v.asset_class === 'INVESTMENT');
  const vaultsTotal    = vaults.reduce((sum, v) => sum + v.current, 0);
  const monthlySavingsGoal = useStore(s => s.monthlySavingsGoal);
  const monthlyTakeHome    = useStore(s => s.monthlyTakeHome);
  const fixedBills         = useStore(s => s.fixedBills);
  const isConfigured       = useStore(s => s.isConfigured);
  const fireConfig         = useStore(s => s.fireConfig);
  const saveFireConfig     = useStore(s => s.saveFireConfig);
  const clearFireConfig    = useStore(s => s.clearFireConfig);

  const monthlyContribBase = monthlySavingsGoal > 0
    ? monthlySavingsGoal
    : Math.max(0, monthlyTakeHome - fixedBills) * 0.2;

  const [monthlyOverride, setMonthlyOverride] = useState('');
  const [incomeGrowthRaw, setIncomeGrowthRaw] = useState('');
  const [externalInvestmentsRaw, setExternalInvestmentsRaw] = useState(() => loadSaved().externalInvestments ?? '');
  const setExternalInvestments = (v: string) => { setExternalInvestmentsRaw(v); saveField('externalInvestments', v); };
  const externalInvestments = parseFloat(externalInvestmentsRaw) || 0;
  const totalVaulted = vaultsTotal + externalInvestments;
  const monthlyContrib   = monthlyOverride !== '' ? (parseFloat(monthlyOverride) || 0) : monthlyContribBase;
  const incomeGrowthRate = incomeGrowthRaw !== '' ? (parseFloat(incomeGrowthRaw) || 0) / 100 : 0;
  const [realReturnRaw, setRealReturnRaw] = useState(() => clampPct(loadSaved().realReturn ?? '', 20));
  const setRealReturn = (v: string) => { setRealReturnRaw(v); saveField('realReturn', v); };
  const realReturnPct = realReturnRaw !== '' ? Math.min(20, parseFloat(realReturnRaw) || 0) : DEFAULT_REAL_RETURN;
  const r = realReturnPct / 100 / 12;
  const returnLabel = `${parseFloat(realReturnPct.toFixed(2))}%`;

  // Init from Supabase fireConfig first, then sessionStorage, then defaults
  const [ca, setCaRaw]           = useState(() => useStore.getState().fireConfig?.currentAge    ?? loadSaved().currentAge);
  const [ta, setTaRaw]           = useState(() => useStore.getState().fireConfig?.targetAge     ?? loadSaved().targetAge);
  const [ae, setAeRaw]           = useState(() => useStore.getState().fireConfig?.annualExpenses ?? loadSaved().annualExpenses);
  const [ptIncome, setPtIncomeRaw] = useState(() => useStore.getState().fireConfig?.partTimeIncome ?? loadSaved().partTimeIncome);
  const [strategy, setStrategyRaw] = useState<FireStrategy>(() => (useStore.getState().fireConfig?.strategy as FireStrategy) ?? loadSaved().strategy);

  const setCa      = (v: string) => { setCaRaw(v);      saveField('currentAge',    v); };
  const setTa      = (v: string) => { setTaRaw(v);      saveField('targetAge',     v); };
  const setAe      = (v: string) => { setAeRaw(v);      saveField('annualExpenses', v); };
  const setPtIncome = (v: string) => { setPtIncomeRaw(v); saveField('partTimeIncome', v); };
  const setStrategy = (v: FireStrategy) => { setStrategyRaw(v); saveField('strategy', v); };

  const reset = () => {
    sessionStorage.removeItem(userKey(SS_BASE));
    setCaRaw(DEFAULTS.currentAge);
    setTaRaw(DEFAULTS.targetAge);
    setAeRaw(DEFAULTS.annualExpenses);
    setPtIncomeRaw(DEFAULTS.partTimeIncome);
    setStrategyRaw('STANDARD');
    setMonthlyOverride('');
    setIncomeGrowthRaw('');
    setRealReturnRaw('');
  };

  const handleLockIn = () => {
    saveFireConfig({
      strategy,
      currentAge: ca,
      targetAge: ta,
      annualExpenses: ae,
      partTimeIncome: ptIncome,
      lockedAt: new Date().toISOString(),
    });
  };

  // True if current form state matches the saved lock
  const isDirty = !fireConfig || (
    fireConfig.strategy !== strategy ||
    fireConfig.currentAge !== ca ||
    fireConfig.targetAge !== ta ||
    fireConfig.annualExpenses !== ae ||
    fireConfig.partTimeIncome !== ptIncome
  );

  const currentStrategy = STRATEGIES.find(s => s.id === strategy)!;

  const calc = useMemo(
    () => computeFire({ ca, ta, ae, ptIncome, strategy, totalVaulted, monthlyContrib, incomeGrowthRate, r }),
    [ca, ta, ae, strategy, ptIncome, totalVaulted, monthlyContrib, incomeGrowthRate, r],
  );

  const growthPct = `${parseFloat((incomeGrowthRate * 100).toFixed(2))}%`;

  // Label/value rows for the verdict panel (non-Coast strategies)
  const investedText = fmtFull(totalVaulted);
  const contributionText = fmtFull(monthlyContrib);

  // ── Setup prompt ─────────────────────────────────────────────────────────
  if (!isConfigured || (totalVaulted === 0 && monthlySavingsGoal === 0)) {
    return (
      <div className="min-w-0 space-y-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">
            FIRE CALCULATOR
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">
            Financial Independence · 4% Safe Withdrawal · {returnLabel} Real Return
          </p>
        </div>
        <div className="bg-surface border-4 border-border rounded-3xl p-6 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-4">
          <Flame size={32} className="text-action-primary" strokeWidth={2.5} />
          <p className="font-black uppercase text-sm text-text-main leading-snug">
            Connect your financial data to unlock FIRE projections.
          </p>
          <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
            This calculator reads your vault balances and savings goal directly from your profile · no double entry needed.
          </p>
          <div className="flex flex-col gap-2">
            <Link to="/config" className="flex items-center justify-between px-4 py-3 bg-black border-4 border-black rounded-2xl text-action-primary font-black uppercase text-[11px] tracking-widest shadow-brutal-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all">
              Set up income & savings goal
              <LinkIcon size={13} strokeWidth={2.5} />
            </Link>
            <Link to="/vaults" className="flex items-center justify-between px-4 py-3 bg-input border-4 border-border rounded-2xl text-text-main font-black uppercase text-[11px] tracking-widest hover:bg-surface transition-colors">
              Create a savings vault
              <LinkIcon size={13} strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      {/* Header */}
      <div className="flex min-w-0 flex-col gap-3 min-[520px]:grid min-[520px]:grid-cols-[minmax(0,1fr)_auto] min-[520px]:items-start">
        <div className="min-w-0">
          <h1 className="text-3xl min-[420px]:text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">
            FIRE CALCULATOR
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">
            {currentStrategy.tag} · {strategy === 'COAST' ? `${returnLabel} Growth · No Contributions` : `${returnLabel} Growth · 4% SWR · 25× Rule`}
          </p>
          {fireConfig && !isDirty && (
            <div className="flex items-center gap-1.5 mt-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-action-capture border-2 border-black rounded-full">
                <Lock size={10} strokeWidth={3} className="text-black shrink-0" />
                <span className="text-[9px] font-black uppercase tracking-widest text-black">
                  {STRATEGIES.find(s => s.id === fireConfig.strategy)?.tag ?? fireConfig.strategy} locked
                </span>
              </div>
            </div>
          )}
          {fireConfig && isDirty && (
            <div className="flex items-center gap-1.5 mt-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-action-primary/20 border-2 border-action-primary/40 rounded-full">
                <LockOpen size={10} strokeWidth={3} className="text-text-muted shrink-0" />
                <span className="text-[9px] font-black uppercase tracking-widest text-text-muted">unsaved changes</span>
              </div>
            </div>
          )}
          <div className="mt-2"><PreviewChip /></div>
        </div>
        <div className="flex items-center gap-1.5 self-end shrink-0 min-[520px]:mt-1">
          {fireConfig && (
            <button
              type="button"
              title="Clear locked strategy"
              onClick={clearFireConfig}
              className="w-9 h-9 flex items-center justify-center border-2 border-border rounded-xl text-text-muted hover:bg-action-bleed/10 hover:text-action-bleed hover:border-action-bleed/30 transition-colors"
            >
              <LockOpen size={14} strokeWidth={2.5} />
            </button>
          )}
          <button
            type="button"
            title="Reset to defaults"
            onClick={reset}
            className="w-9 h-9 flex items-center justify-center border-2 border-border rounded-xl text-text-muted hover:bg-input hover:text-text-main transition-colors"
          >
            <RotateCcw size={15} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Hero */}
      {calc && (
        <div className="relative min-w-0 bg-black border-4 border-black rounded-3xl p-4 min-[420px]:p-6 shadow-[6px_6px_0px_0px_var(--color-action-primary)]">
          <div className="mb-4 min-w-0">
            <div className="mb-1 flex items-start justify-between gap-3">
              <p className="min-w-0 text-[9px] min-[420px]:text-[10px] font-bold uppercase tracking-wide min-[420px]:tracking-widest text-white/50 mb-1">
                {calc.isCoast ? 'Your Coast Number' : 'Your FIRE Number'}
              </p>
              <div className="w-9 h-9 min-[420px]:w-10 min-[420px]:h-10 -mt-1 bg-action-primary border-[3px] border-black rounded-xl flex items-center justify-center shadow-brutal-sm shrink-0">
                {strategy === 'COAST'
                  ? <Anchor size={19} strokeWidth={3} className="text-black" />
                  : <Flame size={19} strokeWidth={3} className="text-black" />
                }
              </div>
            </div>
            <p className={`${amountFitClass} ${amountTextSize(fmtFull(calc.isCoast ? calc.coastNumber : calc.fireNumber), 'hero')} font-black italic tracking-tighter text-action-primary tabular-nums`}>
              {fmtFull(calc.isCoast ? calc.coastNumber : calc.fireNumber)}
            </p>
            <p className="max-w-full text-[10px] font-bold uppercase tracking-wide text-white/40 mt-2 leading-relaxed">
              {calc.isCoast
                ? `Invest this today · grows to ${fmt(calc.fireNumber)} by 65`
                : `Annual expenses × 25 · retire at ${calc.targetAge}`}
            </p>
          </div>

          {/* Next milestone: psychological stepping stone */}
          {(() => {
            const milestone = nextMilestone(totalVaulted);
            const toGo = Math.max(0, milestone - totalVaulted);
            const milestoneText = fmtFull(milestone);
            const toGoText = fmtFull(toGo);
            return !calc.onTrack && milestone < calc.fireNumber && (
              <div className="mb-3 flex min-w-0 flex-col gap-1 min-[420px]:grid min-[420px]:grid-cols-[minmax(0,1fr)_auto] min-[420px]:items-baseline min-[420px]:gap-2 overflow-hidden">
                <span className="min-w-0 text-[10px] font-bold uppercase tracking-widest text-action-primary">
                  Next Portfolio Milestone · {milestoneText.length > 12 ? fmt(milestone) : milestoneText}
                </span>
                <span className="max-w-full whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-white/50 tabular-nums">
                  {toGoText.length > 12 ? fmt(toGo) : toGoText} to go
                </span>
              </div>
            );
          })()}

          <div className="space-y-2">
            <div className="flex min-w-0 flex-col gap-1 min-[420px]:flex-row min-[420px]:justify-between min-[420px]:items-baseline text-[10px] font-bold uppercase tracking-wide">
              <span className="min-w-0 text-white/50 leading-relaxed">
                {calc.isCoast ? 'Projected at 65' : `Plan at ${calc.targetAge}`} · {fmtFull(calc.projAtTarget)}
              </span>
              <span className={`shrink-0 whitespace-nowrap font-black tabular-nums ${calc.onTrack ? 'text-capture-readable' : 'text-action-bleed'}`}>
                {calc.onTrack ? 'Goal reached' : `${calc.projPct.toFixed(1)}%`}
              </span>
            </div>
            <div className="h-3 bg-white/10 border-2 border-white/20 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${calc.onTrack ? 'bg-action-capture' : 'bg-action-bleed/60'}`}
                initial={{ width: 0 }}
                animate={{ width: `${calc.projPct}%` }}
                transition={{ type: 'spring', stiffness: 180, damping: 28 }}
              />
            </div>
          </div>

        </div>
      )}

      {/* Live Data */}
      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">From Your Profile</p>
          <LiveBadge />
        </div>

        <div className="grid min-w-0 grid-cols-1 min-[420px]:grid-cols-2 gap-3">
          <div className="min-w-0 overflow-hidden bg-input border-4 border-black rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <ShieldCheck size={12} strokeWidth={2.5} className="text-capture-readable shrink-0" />
              <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Investments</p>
            </div>
            <p className={`${amountFitClass} ${amountTextSize(investedText)} font-black italic tracking-tighter text-text-main tabular-nums`}>{investedText}</p>
            <p className="text-[9px] font-bold uppercase tracking-wide text-text-muted mt-1">
              {vaults.length === 0 && externalInvestments > 0
                ? 'Entered manually'
                : `${vaults.length} investment vault${vaults.length !== 1 ? 's' : ''}${externalInvestments > 0 ? ` + ${fmtFull(externalInvestments)} entered manually` : ''}`}
            </p>
          </div>

          <div className="min-w-0 overflow-hidden bg-input border-4 border-black rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Zap size={12} strokeWidth={2.5} className="text-primary-readable shrink-0" />
              <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">
                {monthlyOverride !== '' ? 'Override' : monthlySavingsGoal > 0 ? 'Savings Goal' : 'Est. Savings'}
              </p>
            </div>
            <p className={`${amountFitClass} ${amountTextSize(contributionText)} font-black italic tracking-tighter tabular-nums ${monthlyOverride !== '' ? 'text-primary-readable' : 'text-text-main'}`}>{contributionText}</p>
            <p className="text-[9px] font-bold uppercase tracking-wide text-text-muted mt-1">per month</p>
          </div>
        </div>

        {vaults.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {vaults.map(v => {
              const pct = totalVaulted > 0 ? (v.current / totalVaulted) * 100 : 0;
              return (
                <div key={v.id} className="flex items-center gap-2">
                  <div className="h-1.5 bg-input border border-border rounded-full flex-1 overflow-hidden">
                    <motion.div
                      className="h-full bg-action-capture rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ type: 'spring', stiffness: 200, damping: 30 }}
                    />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wide text-text-muted shrink-0 w-24 text-right truncate">{v.name}: {fmt(v.current)}</span>
                </div>
              );
            })}
          </div>
        )}

        {monthlySavingsGoal === 0 && (
          <Link to="/config" className="flex items-center justify-between mt-3 px-3 py-2 bg-action-primary/10 border-2 border-action-primary/30 rounded-xl">
            <p className="text-[10px] font-black uppercase tracking-widest text-text-main">Set a savings goal for better accuracy</p>
            <LinkIcon size={11} strokeWidth={2.5} className="text-text-muted shrink-0" />
          </Link>
        )}
      </div>

      {/* User Inputs */}
      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Your Numbers</p>

        {/* Strategy Selector */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Strategy</p>
          <div className="grid grid-cols-2 min-[380px]:grid-cols-3 sm:grid-cols-5 gap-1.5">
            {STRATEGIES.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStrategy(s.id)}
                className={`min-w-0 overflow-hidden whitespace-nowrap text-ellipsis px-2 py-2 rounded-xl border-2 text-[9px] min-[420px]:text-[10px] font-black uppercase tracking-wide transition-all ${
                  strategy === s.id
                    ? 'bg-black border-black text-action-primary'
                    : 'bg-input border-border text-text-muted hover:border-black hover:text-text-main'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 min-[420px]:grid-cols-2 gap-3">
          <Field label="Current Age" value={ca} onChange={setCa} integer />
          {strategy === 'COAST' ? (
            <div className="flex flex-col justify-center items-center bg-input border-4 border-black/20 rounded-2xl px-3 py-2 gap-0.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Target Age</p>
              <p className="text-2xl font-black italic text-text-main">65</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted">locked</p>
            </div>
          ) : (
            <Field label="Target Retire Age" value={ta} onChange={setTa} integer />
          )}
        </div>

        <Field label="Annual Expenses in Retirement" prefix={currencySymbol()} value={ae} onChange={setAe} />

        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5">Existing Investments (Outside App)</p>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-text-muted pointer-events-none select-none text-lg">{currencySymbol()}</span>
            <input
              type="number"
              title="Existing investments outside the app"
              inputMode="decimal"
              min="0"
              value={externalInvestmentsRaw}
              placeholder="0"
              onChange={e => setExternalInvestments(e.target.value.replace(/[^0-9.]/g, ''))}
              onFocus={e => e.target.select()}
              className="w-full bg-input border-4 border-black rounded-2xl py-3 pr-4 pl-9 font-black text-xl text-text-main outline-none focus:border-action-capture transition-colors tabular-nums placeholder:text-text-muted"
            />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-1.5">
            {vaults.length > 0 && externalInvestments > 0
              ? `Total with your vaults: ${fmtFull(totalVaulted)}`
              : 'Retirement, tax-free, brokerage, crypto · anything outside your vaults'}
          </p>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5">Monthly Vault Contribution</p>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-text-muted pointer-events-none select-none text-lg">{currencySymbol()}</span>
            <input
              type="number"
              title="Monthly vault contribution override"
              inputMode="decimal"
              min="0"
              value={monthlyOverride}
              placeholder={String(Math.round(monthlyContribBase))}
              onChange={e => setMonthlyOverride(e.target.value.replace(/[^0-9.]/g, ''))}
              onFocus={e => e.target.select()}
              className="w-full bg-input border-4 border-black rounded-2xl py-3 pr-4 pl-9 font-black text-xl text-text-main outline-none focus:border-action-capture transition-colors tabular-nums placeholder:text-text-muted"
            />
          </div>
          {monthlyOverride !== '' && Math.round(parseFloat(monthlyOverride)) !== Math.round(monthlyContribBase) && (
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary-readable mt-1.5">
              Overriding profile goal of {fmtFull(monthlyContribBase)}/mo
            </p>
          )}
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5">Annual Contribution Increase</p>
          <div className="relative">
            <input
              type="number"
              title="Annual contribution increase"
              inputMode="decimal"
              min="0"
              max="20"
              value={incomeGrowthRaw}
              placeholder="0"
              onChange={e => setIncomeGrowthRaw(clampPct(e.target.value, 20))}
              onFocus={e => e.target.select()}
              className="w-full bg-input border-4 border-black rounded-2xl py-3 pr-9 pl-4 font-black text-xl text-text-main outline-none focus:border-action-capture transition-colors tabular-nums placeholder:text-text-muted"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-text-muted pointer-events-none text-lg">%</span>
          </div>
          <p className={`text-[10px] font-bold uppercase tracking-wide mt-1.5 ${incomeGrowthRate > 0.05 ? 'text-primary-readable' : 'text-text-muted'}`}>
            {incomeGrowthRate === 0
              ? 'On top of inflation · 0 keeps it flat in today\'s money'
              : incomeGrowthRate > 0.05
              ? `High · ${growthPct} a year on top of inflation, every year`
              : `Grows ${growthPct} a year on top of inflation`}
          </p>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5">Investment Growth After Inflation (Yearly)</p>
          <div className="relative">
            <input
              type="number"
              title="Investment growth after inflation (yearly)"
              inputMode="decimal"
              min="0"
              max="20"
              value={realReturnRaw}
              placeholder={String(DEFAULT_REAL_RETURN)}
              onChange={e => setRealReturn(clampPct(e.target.value, 20))}
              onFocus={e => e.target.select()}
              className="w-full bg-input border-4 border-black rounded-2xl py-3 pr-9 pl-4 font-black text-xl text-text-main outline-none focus:border-action-capture transition-colors tabular-nums placeholder:text-text-muted"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-text-muted pointer-events-none text-lg">%</span>
          </div>
          <p className={`text-[10px] font-bold uppercase tracking-wide mt-1.5 ${realReturnPct > 8 ? 'text-primary-readable' : 'text-text-muted'}`}>
            {realReturnPct > 8
              ? 'High · most portfolios have earned less over long periods'
              : 'Shares about 7% · balanced fund about 4-5%'}
          </p>
        </div>

        {strategy === 'BARISTA' && (
          <Field label="Expected Part-Time Income (annual)" prefix={currencySymbol()} value={ptIncome} onChange={setPtIncome} />
        )}

        {(strategy === 'FAT' || strategy === 'LEAN' || strategy === 'BARISTA') && calc && (
          <div className="flex items-center justify-between px-3 py-2 bg-input border-2 border-border rounded-xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
              {strategy === 'BARISTA' ? 'Portfolio covers' : 'Adjusted expenses'}
            </p>
            <p className="text-[11px] font-black text-text-main tabular-nums">{fmtFull(calc.effectiveExpenses)}/yr</p>
          </div>
        )}

        {/* Lock In Strategy */}
        {isDirty ? (
          <ProAction feature="fire_lock">
            <button
              type="button"
              onClick={handleLockIn}
              className="w-full h-12 flex items-center justify-center gap-2 border-4 border-black rounded-2xl bg-black text-action-capture font-black uppercase tracking-widest text-[11px] shadow-[4px_4px_0px_0px_var(--color-action-capture)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
            >
              <Lock size={14} strokeWidth={3} />
              {fireConfig ? 'Update Locked Strategy' : 'Lock In Strategy'}
            </button>
          </ProAction>
        ) : (
          <div className="w-full h-12 flex items-center justify-center gap-2 border-4 border-action-capture/40 rounded-2xl bg-action-capture/10 text-capture-readable font-black uppercase tracking-widest text-[11px]">
            <Lock size={14} strokeWidth={3} />
            Strategy Locked
          </div>
        )}
      </div>

      {/* Chart */}
      {calc && calc.chartData.length > 1 && (
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">
              {strategy === 'COAST' ? 'Growth to 65 · No Contributions' : 'Portfolio Trajectory'}
            </p>
            <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-wide">
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 rounded-full bg-action-capture" />
                <span className="text-text-muted">Growth</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 rounded-full bg-action-primary" />
                <span className="text-text-muted">FIRE</span>
              </div>
            </div>
          </div>
          <FireChart
            data={calc.chartData}
            fireNumber={calc.fireNumber}
            targetAge={calc.targetAge}
            currentAge={calc.currentAge}
            fireAge={calc.yearsToFIRE}
          />
        </div>
      )}

      {/* Stats Row */}
      {calc && (
        <div className="grid min-w-0 grid-cols-1 min-[480px]:grid-cols-3 gap-3">
          {(calc.isCoast ? [
            {
              label: 'Coast #',
              value: fmt(calc.coastNumber),
              sub: 'needed today',
              accent: calc.onTrack ? 'text-capture-readable' : 'text-action-bleed',
            },
            {
              label: 'Vaults Now',
              value: fmt(totalVaulted),
              sub: `${calc.progressPct.toFixed(0)}% to coast`,
              accent: calc.onTrack ? 'text-capture-readable' : 'text-action-bleed',
            },
            {
              label: calc.onTrack ? 'At 65' : 'Shortfall',
              value: calc.onTrack ? fmt(calc.projAtTarget) : fmt(calc.shortfall),
              sub: calc.onTrack ? `+${fmt(calc.surplus)} surplus` : 'to add today',
              accent: calc.onTrack ? 'text-capture-readable' : 'text-action-bleed',
            },
          ] : [
            {
              label: 'FIRE Age',
              value: calc.fireAge !== null ? String(calc.fireAge) : `${MAX_AGE}+`,
              sub: calc.fireAge !== null ? `in ${calc.fireAge - calc.currentAge}y` : 'increase savings',
              accent: calc.onTrack ? 'text-capture-readable' : 'text-action-bleed',
            },
            {
              label: 'At Target',
              value: fmt(calc.projAtTarget),
              sub: calc.onTrack ? `+${fmt(calc.surplus)} surplus` : `${fmt(calc.fireNumber - calc.projAtTarget)} short`,
              accent: calc.onTrack ? 'text-capture-readable' : 'text-action-bleed',
            },
            {
              label: incomeGrowthRate > 0 && calc.reqMonthly ? 'Starting / Mo' : 'Required / Mo',
              value: calc.reqMonthly !== null && isFinite(calc.reqMonthly) ? fmt(calc.reqMonthly) : 'N/A',
              sub: incomeGrowthRate > 0 && calc.reqMonthly && calc.reqMonthlyFlat !== null && isFinite(calc.reqMonthly)
                ? `rising ${growthPct} a year · or ${fmt(calc.reqMonthlyFlat)}/mo flat`
                : calc.onTrack
                ? (calc.reqMonthly === 0
                    ? `${fmt(monthlyContrib)} monthly plan · no minimum needed`
                    : `${fmt(monthlyContrib)} monthly plan · ${fmt(Math.max(0, monthlyContrib - (calc.reqMonthly ?? 0)))} above minimum`)
                : `${fmt((calc.reqMonthly ?? 0) - monthlyContrib)} more than now`,
              accent: calc.onTrack ? 'text-capture-readable' : 'text-action-bleed',
            },
          ]).map(s => (
            <div key={s.label} className="min-w-0 overflow-hidden bg-surface border-4 border-border rounded-2xl p-4 shadow-[4px_4px_0px_0px_var(--shadow-color)]">
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mb-1">{s.label}</p>
              <p className={`${amountFitClass} ${amountTextSize(s.value)} font-black italic tracking-tighter tabular-nums ${s.accent}`}>{s.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-0.5 leading-tight">{s.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Verdict */}
      {calc && (
        <div className={`border-4 rounded-3xl p-5 ${calc.onTrack ? 'border-action-capture bg-action-capture/5' : 'border-action-bleed bg-action-bleed/5'}`}>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-2xl border-4 border-black flex items-center justify-center shrink-0 ${calc.onTrack ? 'bg-action-capture' : 'bg-action-bleed'}`}>
              {calc.onTrack
                ? <Target size={18} strokeWidth={3} className="text-black" />
                : <TrendingUp size={18} strokeWidth={3} className="text-white" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-1">{currentStrategy.tag}</p>
              <p className="text-[10px] font-bold text-text-muted leading-relaxed mb-2.5">{currentStrategy.desc}</p>

              {calc.isCoast ? (
                <>
                  <p className="font-black uppercase text-sm tracking-tight text-text-main leading-snug">
                    {calc.onTrack
                      ? `Your ${fmtFull(totalVaulted)} will compound to ${fmt(calc.projAtTarget)} by age 65 · ${fmt(calc.surplus)} above your FIRE target.`
                      : `You need ${fmtFull(calc.coastNumber)} invested today to coast to retirement at 65. You're ${fmtFull(calc.shortfall)} short.`
                    }
                  </p>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted mt-1.5">
                    {calc.onTrack
                      ? 'Coast FIRE achieved · no more contributions needed · let it ride.'
                      : `Add ${fmtFull(calc.shortfall)} to your vaults to hit your coast number, then stop contributing.`
                    }
                  </p>
                </>
              ) : (
                <>
                  <p className="font-black uppercase text-sm tracking-tight text-text-main leading-snug">
                    {calc.onTrack
                      ? (calc.fireAge !== null && calc.fireAge < calc.targetAge
                          ? `FIRE at age ${calc.fireAge} · ${calc.targetAge - calc.fireAge} years ahead of your target.`
                          : `On track to retire at ${calc.targetAge} with a ${fmt(calc.surplus)} surplus.`)
                      : (calc.fireAge !== null
                          ? `FIRE at age ${calc.fireAge} · ${calc.fireAge - calc.targetAge} years past your target.`
                          : `At this rate you won't reach FIRE before age ${MAX_AGE}.`)
                    }
                  </p>
                  {calc.reqMonthly !== null && isFinite(calc.reqMonthly) ? (
                    <dl className="mt-3 border-t-2 border-border/15">
                      {summaryRows(calc, monthlyContrib, incomeGrowthRate).map(row => (
                        <div key={row.label} className="flex items-baseline justify-between gap-3 py-1.5 border-b-2 border-border/15">
                          <dt className="text-[10px] font-bold uppercase tracking-widest text-text-muted shrink-0">{row.label}</dt>
                          <dd className={`text-[12px] font-black uppercase tracking-tight tabular-nums text-right ${row.accent ?? 'text-text-main'}`}>{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted mt-1.5">
                      Your target age is too close for your starting balance · move it later or contribute more.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {!calc && (
        <div className="text-center py-12 bg-surface border-4 border-dashed border-border rounded-3xl">
          <Flame size={40} className="mx-auto mb-3 text-action-primary opacity-60" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            {(parseInt(ca) || 0) > 0 && ((parseInt(ca) || 0) < MIN_AGE || (parseInt(ca) || 0) >= MAX_AGE)
              ? `Current age needs to be between ${MIN_AGE} and ${MAX_AGE - 1}.`
              : strategy !== 'COAST' && (parseInt(ta) || 0) > MAX_AGE
              ? `Target retire age can be at most ${MAX_AGE}.`
              : strategy === 'BARISTA' && (parseFloat(ae) || 0) > 0 && (parseFloat(ptIncome) || 0) >= (parseFloat(ae) || 0)
              ? `Your part-time income (${fmtFull(parseFloat(ptIncome))}/yr) covers all your expenses (${fmtFull(parseFloat(ae))}/yr), so you don't need investments for Barista FIRE while that work continues. Switch to Standard to plan for stopping work completely.`
              : strategy === 'COAST' && (parseInt(ca) || 0) >= 65
              ? 'Coast FIRE is for people under 65 · pick another strategy.'
              : strategy !== 'COAST' && (parseInt(ca) || 0) > 0 && (parseInt(ta) || 0) > 0 && parseInt(ta) <= parseInt(ca)
              ? 'Your target retire age needs to be later than your current age.'
              : 'Enter your age and retirement target to calculate your FIRE trajectory.'}
          </p>
        </div>
      )}
    </div>
  );
}
