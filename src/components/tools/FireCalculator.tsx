import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Flame, Target, TrendingUp, RotateCcw, ShieldCheck, Zap, Link as LinkIcon, Anchor, Lock, LockOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';

// ── Constants ────────────────────────────────────────────────────────────────
const R = 0.07 / 12;
const SWR = 25;

// ── Strategy config ──────────────────────────────────────────────────────────
type FireStrategy = 'STANDARD' | 'FAT' | 'LEAN' | 'BARISTA' | 'COAST';

const STRATEGIES: { id: FireStrategy; label: string; tag: string; desc: string }[] = [
  { id: 'STANDARD', label: 'Standard', tag: 'FIRE',         desc: 'Full financial independence · your investments permanently cover 100% of your living expenses forever.' },
  { id: 'FAT',      label: 'Fat',      tag: 'FAT FIRE',     desc: 'Retire with a premium lifestyle. Adds 50% to your annual expenses for comfort, travel, and full flexibility.' },
  { id: 'LEAN',     label: 'Lean',     tag: 'LEAN FIRE',    desc: 'Retire lean. Targets 70% of your stated expenses · ideal for frugal minimalists who want out as early as possible.' },
  { id: 'BARISTA',  label: 'Barista',  tag: 'BARISTA FIRE', desc: 'Semi-retire with part-time work covering some expenses. Your portfolio only needs to replace the rest.' },
  { id: 'COAST',    label: 'Coast',    tag: 'COAST FIRE',   desc: 'Stop saving now and let compounding take over. Calculates the lump sum you need invested today to coast to your FIRE number by 65 with zero future contributions.' },
];

// ── Math helpers ─────────────────────────────────────────────────────────────
function fv(assets: number, monthly: number, months: number): number {
  if (months <= 0) return assets;
  const g = Math.pow(1 + R, months);
  return monthly === 0 ? assets * g : assets * g + monthly * (g - 1) / R;
}

// Month-by-month simulation when income grows over time
function fvWithGrowth(assets: number, monthlyStart: number, months: number, annualGrowth: number): number {
  if (annualGrowth === 0 || months <= 0) return fv(assets, monthlyStart, months);
  let portfolio = assets;
  for (let m = 0; m < months; m++) {
    portfolio = portfolio * (1 + R) + monthlyStart * Math.pow(1 + annualGrowth, m / 12);
  }
  return portfolio;
}

function yearsToFireWithGrowth(assets: number, monthlyStart: number, target: number, annualGrowth: number): number | null {
  if (annualGrowth === 0) return yearsToFire(assets, monthlyStart, target);
  for (let y = 0; y <= 80; y++) {
    if (fvWithGrowth(assets, monthlyStart, y * 12, annualGrowth) >= target) return y;
  }
  return null;
}

function yearsToFire(assets: number, monthly: number, target: number): number | null {
  for (let y = 0; y <= 80; y++) {
    if (fv(assets, monthly, y * 12) >= target) return y;
  }
  return null;
}

function neededMonthly(assets: number, target: number, months: number): number {
  if (months <= 0) return Infinity;
  const g = Math.pow(1 + R, months);
  const needed = target - assets * g;
  if (needed <= 0) return 0;
  return needed * R / (g - 1);
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtFull(n: number): string {
  return '$' + Math.round(n).toLocaleString();
}

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
            fontSize="8" fontFamily="monospace" fontWeight="bold" fill="var(--color-action-primary)"
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
const DEFAULTS = { currentAge: '28', targetAge: '45', annualExpenses: '40000', partTimeIncome: '20000', externalInvestments: '' };
const SS_KEY = 'pocket-cfo-fire-inputs-v1';

function loadSaved(): typeof DEFAULTS & { strategy: FireStrategy } {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (raw) return { ...DEFAULTS, strategy: 'STANDARD', ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS, strategy: 'STANDARD' };
}

function saveField(key: string, value: string) {
  try {
    const cur = JSON.parse(sessionStorage.getItem(SS_KEY) ?? '{}');
    sessionStorage.setItem(SS_KEY, JSON.stringify({ ...cur, [key]: value }));
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
    sessionStorage.removeItem(SS_KEY);
    setCaRaw(DEFAULTS.currentAge);
    setTaRaw(DEFAULTS.targetAge);
    setAeRaw(DEFAULTS.annualExpenses);
    setPtIncomeRaw(DEFAULTS.partTimeIncome);
    setStrategyRaw('STANDARD');
    setMonthlyOverride('');
    setIncomeGrowthRaw('');
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

  const calc = useMemo(() => {
    const currentAge     = parseInt(ca) || 0;
    const annualExpenses = parseFloat(ae) || 0;
    if (currentAge <= 0 || annualExpenses <= 0) return null;

    const partIncome        = parseFloat(ptIncome) || 0;
    const effectiveExpenses = strategy === 'FAT'
      ? annualExpenses * 1.5
      : strategy === 'LEAN'
      ? annualExpenses * 0.7
      : strategy === 'BARISTA'
      ? Math.max(0, annualExpenses - partIncome)
      : annualExpenses;

    const fireNumber = effectiveExpenses * SWR;

    // ── Coast FIRE ───────────────────────────────────────────────────────────
    if (strategy === 'COAST') {
      const yearsTo65    = Math.max(1, 65 - currentAge);
      const coastFactor  = Math.pow(1 + R, yearsTo65 * 12);
      const coastNumber  = fireNumber / coastFactor;
      const onCoast      = totalVaulted >= coastNumber;
      const projAtTarget = fv(totalVaulted, 0, yearsTo65 * 12);
      const surplus      = onCoast ? projAtTarget - fireNumber : 0;
      const shortfall    = onCoast ? 0 : coastNumber - totalVaulted;
      const progressPct  = coastNumber > 0 ? (totalVaulted / coastNumber) * 100 : 0;
      const projPct      = Math.min(100, (projAtTarget / fireNumber) * 100);
      const coastYTF     = yearsToFire(totalVaulted, 0, fireNumber);

      const displayYears = yearsTo65 + 5;
      const chartData = Array.from({ length: displayYears + 1 }, (_, i) => ({
        age:   currentAge + i,
        value: fv(totalVaulted, 0, i * 12),
      }));

      return {
        isCoast:          true as const,
        fireNumber,
        coastNumber,
        effectiveExpenses,
        onTrack:          onCoast,
        surplus,
        shortfall,
        progressPct,
        projAtTarget,
        projPct,
        fireAge:          coastYTF !== null ? currentAge + coastYTF : null,
        reqMonthly:       null as number | null,
        chartData,
        currentAge,
        targetAge:        65,
        yearsToFIRE:      coastYTF,
      };
    }

    // ── Standard / Fat / Lean / Barista ─────────────────────────────────────
    const targetAge = parseInt(ta) || 0;
    if (targetAge <= currentAge) return null;

    const yearsToTarget = targetAge - currentAge;
    const projAtTarget  = fvWithGrowth(totalVaulted, monthlyContrib, yearsToTarget * 12, incomeGrowthRate);
    const progressPct   = fireNumber > 0 ? (totalVaulted / fireNumber) * 100 : 0;
    const projPct       = fireNumber > 0 ? (projAtTarget / fireNumber) * 100 : 0;
    const onTrack       = projAtTarget >= fireNumber;
    const yearsToFIRE   = yearsToFireWithGrowth(totalVaulted, monthlyContrib, fireNumber, incomeGrowthRate);
    const fireAge       = yearsToFIRE !== null ? currentAge + yearsToFIRE : null;
    const reqMonthly    = neededMonthly(totalVaulted, fireNumber, yearsToTarget * 12);
    const surplus       = onTrack ? projAtTarget - fireNumber : 0;

    const displayYears = Math.min(80, Math.max(yearsToTarget + 12, yearsToFIRE ? yearsToFIRE + 5 : yearsToTarget + 20, 20));
    const chartData = Array.from({ length: displayYears + 1 }, (_, i) => ({
      age:   currentAge + i,
      value: fvWithGrowth(totalVaulted, monthlyContrib, i * 12, incomeGrowthRate),
    }));

    return {
      isCoast:          false as const,
      fireNumber,
      coastNumber:      0,
      effectiveExpenses,
      projAtTarget,
      progressPct,
      projPct,
      onTrack,
      fireAge,
      reqMonthly,
      surplus,
      shortfall:        0,
      chartData,
      currentAge,
      targetAge,
      yearsToFIRE,
    };
  }, [ca, ta, ae, strategy, ptIncome, totalVaulted, monthlyContrib, incomeGrowthRate]);

  // ── Setup prompt ─────────────────────────────────────────────────────────
  if (!isConfigured || (totalVaulted === 0 && monthlySavingsGoal === 0)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">
            FIRE CALCULATOR
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">
            Financial Independence · 4% Safe Withdrawal · 7% Real Return
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">
            FIRE CALCULATOR
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">
            {currentStrategy.tag} · {strategy === 'COAST' ? '7% Growth · No Contributions' : '7% Growth · 4% SWR · 25× Rule'}
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
        </div>
        <div className="flex items-center gap-1.5 shrink-0 mt-1">
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
        <div className="bg-black border-4 border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_var(--color-action-primary)]">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">
                {calc.isCoast ? 'Your Coast Number' : 'Your FIRE Number'}
              </p>
              <p className="text-5xl md:text-6xl font-black italic tracking-tighter text-action-primary leading-none tabular-nums">
                {fmtFull(calc.isCoast ? calc.coastNumber : calc.fireNumber)}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mt-2">
                {calc.isCoast
                  ? `Invest this today · grows to ${fmt(calc.fireNumber)} by 65`
                  : `Annual expenses × 25 · retire at ${calc.targetAge}`}
              </p>
            </div>
            <div className="w-12 h-12 bg-action-primary border-4 border-black rounded-2xl flex items-center justify-center shrink-0 shadow-brutal-sm">
              {strategy === 'COAST'
                ? <Anchor size={22} strokeWidth={3} className="text-black" />
                : <Flame size={22} strokeWidth={3} className="text-black" />
              }
            </div>
          </div>

          {/* Next milestone — psychological stepping stone */}
          {(() => {
            const milestone = nextMilestone(totalVaulted);
            const toGo = Math.max(0, milestone - totalVaulted);
            return milestone < calc.fireNumber && (
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-action-primary">
                  Next Milestone · {fmtFull(milestone)}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/50 tabular-nums">
                  {fmtFull(toGo)} to go
                </span>
              </div>
            );
          })()}

          <div className="space-y-2">
            <div className="flex justify-between items-baseline text-[10px] font-bold uppercase tracking-wide">
              <span className="text-white/50">Today · {fmtFull(totalVaulted)}</span>
              <span className="text-action-primary font-black tabular-nums">{calc.progressPct.toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-white/10 border-2 border-white/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-action-capture"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, calc.progressPct)}%` }}
                transition={{ type: 'spring', stiffness: 180, damping: 28 }}
              />
            </div>
            {calc.projPct > calc.progressPct && (
              <>
                <div className="flex justify-between items-baseline text-[10px] font-bold uppercase tracking-wide pt-1">
                  <span className="text-white/40">
                    {calc.isCoast
                      ? `At 65 · ${fmtFull(calc.projAtTarget)}`
                      : `At ${calc.targetAge} · ${fmtFull(calc.projAtTarget)}`}
                  </span>
                  <span className={`font-black tabular-nums ${calc.onTrack ? 'text-capture-readable' : 'text-action-bleed'}`}>
                    {calc.projPct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${calc.onTrack ? 'bg-action-capture' : 'bg-action-bleed/60'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, calc.projPct)}%` }}
                    transition={{ type: 'spring', stiffness: 180, damping: 28, delay: 0.1 }}
                  />
                </div>
              </>
            )}
          </div>

        </div>
      )}

      {/* Live Data */}
      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted/60">From Your Profile</p>
          <LiveBadge />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-input border-4 border-black rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <ShieldCheck size={12} strokeWidth={2.5} className="text-capture-readable shrink-0" />
              <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Investments</p>
            </div>
            <p className="text-2xl font-black italic tracking-tighter text-text-main tabular-nums">{fmtFull(totalVaulted)}</p>
            <p className="text-[9px] font-bold uppercase tracking-wide text-text-muted mt-1">
              {vaults.length} investment vault{vaults.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="bg-input border-4 border-black rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Zap size={12} strokeWidth={2.5} className="text-action-primary shrink-0" />
              <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">
                {monthlyOverride !== '' ? 'Override' : monthlySavingsGoal > 0 ? 'Savings Goal' : 'Est. Savings'}
              </p>
            </div>
            <p className={`text-2xl font-black italic tracking-tighter tabular-nums ${monthlyOverride !== '' ? 'text-action-primary' : 'text-text-main'}`}>{fmtFull(monthlyContrib)}</p>
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
        <p className="text-[10px] font-black uppercase tracking-widest text-text-muted/60">Your Numbers</p>

        {/* Strategy Selector */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Strategy</p>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {STRATEGIES.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStrategy(s.id)}
                className={`shrink-0 px-3 py-1.5 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest transition-all ${
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

        <div className="grid grid-cols-2 gap-3">
          <Field label="Current Age" value={ca} onChange={setCa} integer />
          {strategy === 'COAST' ? (
            <div className="flex flex-col justify-center items-center bg-input border-4 border-black/20 rounded-2xl px-3 py-2 gap-0.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Target Age</p>
              <p className="text-2xl font-black italic text-text-main">65</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted/50">locked</p>
            </div>
          ) : (
            <Field label="Target Retire Age" value={ta} onChange={setTa} integer />
          )}
        </div>

        <Field label="Annual Expenses in Retirement" prefix="$" value={ae} onChange={setAe} />

        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5">Existing Investments (Outside App)</p>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-text-muted pointer-events-none select-none text-lg">$</span>
            <input
              type="number"
              title="Existing investments outside the app"
              inputMode="decimal"
              min="0"
              value={externalInvestmentsRaw}
              placeholder="0"
              onChange={e => setExternalInvestments(e.target.value.replace(/[^0-9.]/g, ''))}
              onFocus={e => e.target.select()}
              className="w-full bg-input border-4 border-black rounded-2xl py-3 pr-4 pl-9 font-black text-xl text-text-main outline-none focus:border-action-capture transition-colors tabular-nums placeholder:text-text-muted/40"
            />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-1.5">
            401(k), IRA, brokerage, crypto — anything not tracked in your app vaults
            {externalInvestments > 0 && ` · combined starting balance: ${fmtFull(totalVaulted)}`}
          </p>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5">Monthly Vault Contribution</p>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-text-muted pointer-events-none select-none text-lg">$</span>
            <input
              type="number"
              title="Monthly vault contribution override"
              inputMode="decimal"
              min="0"
              value={monthlyOverride}
              placeholder={String(Math.round(monthlyContribBase))}
              onChange={e => setMonthlyOverride(e.target.value.replace(/[^0-9.]/g, ''))}
              onFocus={e => e.target.select()}
              className="w-full bg-input border-4 border-black rounded-2xl py-3 pr-4 pl-9 font-black text-xl text-text-main outline-none focus:border-action-capture transition-colors tabular-nums placeholder:text-text-muted/40"
            />
          </div>
          {monthlyOverride !== '' && Math.round(parseFloat(monthlyOverride)) !== Math.round(monthlyContribBase) && (
            <p className="text-[10px] font-bold uppercase tracking-wide text-action-primary mt-1.5">
              Overriding profile goal of {fmtFull(monthlyContribBase)}/mo
            </p>
          )}
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5">Annual Income Growth Rate</p>
          <div className="relative">
            <input
              type="number"
              title="Annual income growth rate"
              inputMode="decimal"
              min="0"
              max="100"
              value={incomeGrowthRaw}
              placeholder="0"
              onChange={e => setIncomeGrowthRaw(e.target.value.replace(/[^0-9.]/g, ''))}
              onFocus={e => e.target.select()}
              className="w-full bg-input border-4 border-black rounded-2xl py-3 pr-9 pl-4 font-black text-xl text-text-main outline-none focus:border-action-capture transition-colors tabular-nums placeholder:text-text-muted/40"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-text-muted pointer-events-none text-lg">%</span>
          </div>
          {incomeGrowthRate > 0 && (
            <p className="text-[10px] font-bold uppercase tracking-wide text-action-primary mt-1.5">
              Contributions compound {incomeGrowthRaw}%/yr — projections grow faster over time
            </p>
          )}
        </div>

        {strategy === 'BARISTA' && (
          <Field label="Expected Part-Time Income (annual)" prefix="$" value={ptIncome} onChange={setPtIncome} />
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
          <button
            type="button"
            onClick={handleLockIn}
            className="w-full h-12 flex items-center justify-center gap-2 border-4 border-black rounded-2xl bg-black text-capture-readable font-black uppercase tracking-widest text-[11px] shadow-[4px_4px_0px_0px_var(--color-action-capture)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
          >
            <Lock size={14} strokeWidth={3} />
            {fireConfig ? 'Update Locked Strategy' : 'Lock In Strategy'}
          </button>
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
            <p className="text-[10px] font-black uppercase tracking-widest text-text-muted/60">
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
        <div className="grid grid-cols-3 gap-3">
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
              value: calc.fireAge !== null ? String(calc.fireAge) : '80+',
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
              label: calc.onTrack ? 'Min / Mo' : 'Need / Mo',
              value: calc.reqMonthly !== null && isFinite(calc.reqMonthly) ? fmt(calc.reqMonthly) : '—',
              sub: calc.onTrack
                ? (monthlyContrib >= (calc.reqMonthly ?? 0)
                    ? `saving ${fmt(monthlyContrib)} · ${fmt(monthlyContrib - (calc.reqMonthly ?? 0))} above min`
                    : `saving ${fmt(monthlyContrib)} now · growth makes up the gap`)
                : `${fmt((calc.reqMonthly ?? 0) - monthlyContrib)} more than now`,
              accent: calc.onTrack ? 'text-capture-readable' : 'text-action-bleed',
            },
          ]).map(s => (
            <div key={s.label} className="bg-surface border-4 border-border rounded-2xl p-4 shadow-[4px_4px_0px_0px_var(--shadow-color)]">
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mb-1">{s.label}</p>
              <p className={`text-xl font-black italic tracking-tighter tabular-nums ${s.accent}`}>{s.value}</p>
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
              <p className="text-[9px] font-black uppercase tracking-widest text-text-muted/60 mb-1">{currentStrategy.tag}</p>
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
              ) : calc.onTrack ? (
                <>
                  <p className="font-black uppercase text-sm tracking-tight text-text-main leading-snug">
                    {calc.fireAge !== null && calc.fireAge < calc.targetAge
                      ? `Based on your vault deposits, you'll hit FIRE at age ${calc.fireAge} · ${calc.targetAge - calc.fireAge} years ahead of schedule.`
                      : `Based on your vault deposits, you're on track to retire at ${calc.targetAge} with a ${fmt(calc.surplus)} surplus.`
                    }
                  </p>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted mt-1.5">
                    {calc.reqMonthly !== null && isFinite(calc.reqMonthly)
                      ? (monthlyContrib >= calc.reqMonthly
                          ? `Flat minimum needed: ${fmtFull(calc.reqMonthly)}/mo · you're saving ${fmtFull(monthlyContrib)}/mo · ${fmtFull(monthlyContrib - calc.reqMonthly)} above minimum.`
                          : `You're saving ${fmtFull(monthlyContrib)}/mo today · less than the ${fmtFull(calc.reqMonthly)}/mo flat minimum, but your income growth scales your contributions enough to clear the goal.`)
                      : `Keep your ${fmtFull(monthlyContrib)}/mo savings rate consistent · compounding does the heavy lifting from here.`
                    }
                  </p>
                </>
              ) : (
                <>
                  <p className="font-black uppercase text-sm tracking-tight text-text-main leading-snug">
                    {calc.fireAge !== null
                      ? `Based on your vault deposits, you'll reach FIRE at age ${calc.fireAge} · ${calc.fireAge - calc.targetAge} years past your target.`
                      : `At your current savings rate, you won't reach FIRE within 80 years.`
                    }
                  </p>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted mt-1.5">
                    {calc.reqMonthly !== null && isFinite(calc.reqMonthly)
                      ? `To retire by ${calc.targetAge}, vault ${fmtFull(calc.reqMonthly)}/mo · ${fmtFull(calc.reqMonthly - monthlyContrib)} more than your current goal.`
                      : `Your target age is too close given your starting assets · extend your horizon or increase contributions.`
                    }
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {!calc && (
        <div className="text-center py-12 bg-surface border-4 border-dashed border-border rounded-3xl">
          <Flame size={40} className="mx-auto mb-3 text-action-primary opacity-60" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Enter your age and retirement target to calculate your FIRE trajectory.</p>
        </div>
      )}
    </div>
  );
}
