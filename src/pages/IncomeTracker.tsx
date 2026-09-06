import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, Plus, Trash2, ChevronDown, Link as LinkIcon, Zap, Target, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { currencySymbol } from '../lib/currency';
import { PreviewChip } from '../components/PreviewChip';
import { ProAction } from '../components/ProAction';

// ── Math helpers ──────────────────────────────────────────────────────────────
const R = 0.07 / 12;

function fv(assets: number, monthly: number, months: number): number {
  if (months <= 0) return assets;
  const g = Math.pow(1 + R, months);
  return monthly === 0 ? assets * g : assets * g + monthly * (g - 1) / R;
}

function neededMonthly(assets: number, target: number, months: number): number {
  if (months <= 0) return Infinity;
  const g = Math.pow(1 + R, months);
  const needed = target - assets * g;
  if (needed <= 0) return 0;
  return needed * R / (g - 1);
}

function yearsToFire(assets: number, monthly: number, target: number): number | null {
  for (let y = 0; y <= 80; y++) {
    if (fv(assets, monthly, y * 12) >= target) return y;
  }
  return null;
}

function fmt(n: number): string {
  const s = currencySymbol();
  if (n >= 1_000_000) return `${s}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${s}${(n / 1_000).toFixed(0)}K`;
  return `${s}${n.toFixed(0)}`;
}

function fmtFull(n: number): string {
  return '$' + Math.round(n).toLocaleString();
}

// ── Income Step Chart ─────────────────────────────────────────────────────────
const CVW = 400;
const CVH = 140;
const CPAD = { t: 12, r: 12, b: 24, l: 52 };
const CPW = CVW - CPAD.l - CPAD.r;
const CPH = CVH - CPAD.t - CPAD.b;

function IncomeChart({ points }: { points: { date: string; amount: number }[] }) {
  if (points.length < 2) return null;

  const maxAmt = Math.max(...points.map(p => p.amount)) * 1.15;
  const dates = points.map(p => new Date(p.date).getTime());
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];
  const span = maxDate - minDate || 1;

  const px = (d: string) => CPAD.l + ((new Date(d).getTime() - minDate) / span) * CPW;
  const py = (v: number) => CPAD.t + CPH * (1 - v / maxAmt);

  // Build step path: for each point, go horizontal then vertical
  let pathD = `M ${px(points[0].date).toFixed(1)},${py(points[0].amount).toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const x = px(points[i].date).toFixed(1);
    const y = py(points[i].amount).toFixed(1);
    const prevY = py(points[i - 1].amount).toFixed(1);
    pathD += ` L ${x},${prevY} L ${x},${y}`;
  }
  // Extend to right edge
  const lastX = (CPAD.l + CPW).toFixed(1);
  const lastY = py(points[points.length - 1].amount).toFixed(1);
  pathD += ` L ${lastX},${lastY}`;

  const areaD = pathD + ` L ${lastX},${(CPAD.t + CPH).toFixed(1)} L ${CPAD.l},${(CPAD.t + CPH).toFixed(1)} Z`;

  const yLabels = [0, maxAmt * 0.5, maxAmt * 0.9].map(v => ({ v, y: py(v) }));

  return (
    <svg viewBox={`0 0 ${CVW} ${CVH}`} className="w-full h-auto" aria-label="Income history chart">
      <path d={areaD} fill="var(--color-action-capture)" fillOpacity="0.12" />
      <path d={pathD} fill="none" stroke="var(--color-action-capture)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map(p => (
        <circle key={p.date} cx={px(p.date)} cy={py(p.amount)} r="4"
          fill="var(--color-action-capture)" stroke="var(--color-border)" strokeWidth="2" />
      ))}
      {yLabels.map(({ v, y }) => (
        <text key={v} x={CPAD.l - 6} y={y + 4} textAnchor="end"
          fontSize="8" fontFamily="monospace" fontWeight="bold" fill="var(--color-text-muted)">
          {fmt(v)}
        </text>
      ))}
      {points.map((p, i) => i === 0 || i === points.length - 1 ? (
        <text key={p.date} x={px(p.date)} y={CVH - 4} textAnchor="middle"
          fontSize="8" fontFamily="monospace" fontWeight="bold" fill="var(--color-text-muted)">
          {p.date.slice(0, 7)}
        </text>
      ) : null)}
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
const LABEL_PRESETS = ['Promotion', 'New Job', 'Side Hustle', 'Raise', 'Bonus', 'Freelance', 'Business'];

export default function IncomeTracker() {
  const allVaults          = useStore(s => s.vaults);
  const monthlyTakeHome    = useStore(s => s.monthlyTakeHome);
  const monthlySavingsGoal = useStore(s => s.monthlySavingsGoal);
  const incomeHistory      = useStore(s => s.incomeHistory);
  const addIncomeEntry     = useStore(s => s.addIncomeEntry);
  const removeIncomeEntry  = useStore(s => s.removeIncomeEntry);
  const fireConfig         = useStore(s => s.fireConfig);
  const privacyMode        = useStore(s => s.privacyMode);
  const isConfigured       = useStore(s => s.isConfigured);

  const investmentVaults = allVaults.filter(v => v.asset_class === 'INVESTMENT');
  const totalInvested    = investmentVaults.reduce((s, v) => s + v.current, 0);

  const currentRate = monthlyTakeHome > 0 ? (monthlySavingsGoal / monthlyTakeHome) * 100 : 0;

  // FIRE context
  const fireAnnualExpenses = fireConfig ? (parseFloat(fireConfig.annualExpenses) || 0) : monthlyTakeHome * 12;
  const fireNumber         = fireAnnualExpenses * 25;
  const fireTargetAge      = fireConfig ? (parseInt(fireConfig.targetAge) || 60) : 60;
  const fireCurrentAge     = fireConfig ? (parseInt(fireConfig.currentAge) || 30) : 30;
  const fireYears          = Math.max(1, fireTargetAge - fireCurrentAge);

  const neededMo      = neededMonthly(totalInvested, fireNumber, fireYears * 12);
  const neededRate    = monthlyTakeHome > 0 && isFinite(neededMo)
    ? Math.min(100, (neededMo / monthlyTakeHome) * 100)
    : 0;

  // Form state
  const [showForm, setShowForm]   = useState(false);
  const [formAmount, setFormAmount] = useState('');
  const [formLabel, setFormLabel]   = useState('');
  const [formDate, setFormDate]     = useState(() => new Date().toISOString().slice(0, 10));
  const [simRate, setSimRate]       = useState(() => Math.round(Math.max(currentRate, 1)));

  // Simulation
  const simMonthly   = (simRate / 100) * monthlyTakeHome;
  const simYears     = yearsToFire(totalInvested, simMonthly, fireNumber);
  const simFIREAge   = simYears !== null ? fireCurrentAge + simYears : null;
  const simOnTrack   = isFinite(neededMo) && simMonthly >= neededMo;

  // Income chart: history entries + today's income as final point
  const chartPoints = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const pts = [...incomeHistory.map(e => ({ date: e.date, amount: e.amount }))];
    if (monthlyTakeHome > 0 && (pts.length === 0 || pts[pts.length - 1].date !== today)) {
      pts.push({ date: today, amount: monthlyTakeHome });
    }
    return pts.sort((a, b) => a.date.localeCompare(b.date));
  }, [incomeHistory, monthlyTakeHome]);

  // Growth stats
  const firstAmount   = chartPoints.length >= 2 ? chartPoints[0].amount : 0;
  const totalGrowthPct = firstAmount > 0 ? ((monthlyTakeHome - firstAmount) / firstAmount) * 100 : 0;

  const mask = (v: number) => privacyMode ? '••••••' : fmtFull(v);

  const handleSubmit = async () => {
    const amount = parseFloat(formAmount);
    if (!amount || !formLabel.trim() || !formDate) return;
    await addIncomeEntry(amount, formLabel.trim(), formDate);
    setFormAmount('');
    setFormLabel('');
    setShowForm(false);
  };

  if (!isConfigured) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">Income Tracker</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">Income growth · savings rate lab</p>
        </div>
        <div className="bg-surface border-4 border-border rounded-3xl p-6 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-4">
          <TrendingUp size={32} className="text-capture-readable" strokeWidth={2.5} />
          <p className="font-black uppercase text-sm text-text-main">Set up your income to unlock the savings rate lab.</p>
          <Link to="/config" className="flex items-center justify-between px-4 py-3 bg-black border-4 border-black rounded-2xl text-action-primary font-black uppercase text-[11px] tracking-widest shadow-brutal-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all">
            Configure income & savings
            <LinkIcon size={13} strokeWidth={2.5} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">Income Tracker</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">
          Income growth · savings rate lab
          {!fireConfig && (
            <span className="ml-2 text-action-primary"> · <Link to="/fire" className="underline underline-offset-2">lock a FIRE strategy</Link> for full projections</span>
          )}
        </p>
        <div className="mt-2"><PreviewChip /></div>
      </div>

      {/* Snapshot */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-black border-4 border-black rounded-3xl p-4 col-span-1 shadow-[4px_4px_0px_0px_var(--color-action-capture)]">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/50 mb-2">Monthly Income</p>
          <p className="text-2xl font-black italic tracking-tighter text-action-primary tabular-nums leading-none">{mask(monthlyTakeHome)}</p>
          {chartPoints.length >= 2 && totalGrowthPct > 0 && (
            <p className="text-[9px] font-black uppercase tracking-wide text-capture-readable mt-1.5">+{totalGrowthPct.toFixed(0)}% since start</p>
          )}
        </div>
        <div className={`border-4 rounded-3xl p-4 ${currentRate >= neededRate && neededRate > 0 ? 'border-action-capture bg-action-capture/5' : 'border-border bg-surface'} shadow-[4px_4px_0px_0px_var(--shadow-color)]`}>
          <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted mb-2">Saving Now</p>
          <p className="text-2xl font-black italic tracking-tighter text-text-main tabular-nums leading-none">{currentRate.toFixed(0)}%</p>
          <p className="text-[9px] font-bold uppercase tracking-wide text-text-muted mt-1.5">{mask(monthlySavingsGoal)}/mo</p>
        </div>
        <div className={`border-4 rounded-3xl p-4 ${neededRate > 0 ? 'border-border bg-surface' : 'border-border bg-surface'} shadow-[4px_4px_0px_0px_var(--shadow-color)]`}>
          <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted mb-2">FIRE Rate</p>
          <p className={`text-2xl font-black italic tracking-tighter tabular-nums leading-none ${neededRate > 0 ? 'text-action-primary' : 'text-text-muted'}`}>
            {neededRate > 0 ? `${neededRate.toFixed(0)}%` : '—'}
          </p>
          <p className="text-[9px] font-bold uppercase tracking-wide text-text-muted mt-1.5">
            {neededRate > 0 ? `${mask(neededMo)}/mo needed` : 'Set FIRE target'}
          </p>
        </div>
      </div>

      {/* Income History Chart */}
      {chartPoints.length >= 2 && (
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Income Growth</p>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded-full bg-action-capture" />
              <span className="text-[9px] font-bold uppercase tracking-wide text-text-muted">Monthly take-home</span>
            </div>
          </div>
          <IncomeChart points={chartPoints} />
        </div>
      )}

      {/* Savings Rate Lab */}
      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-action-primary border-2 border-black rounded-xl flex items-center justify-center shrink-0">
            <BarChart3 size={14} strokeWidth={2.5} className="text-black" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Savings Rate Lab</p>
        </div>

        <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted -mt-2">
          Slide to simulate different savings rates → see how your FIRE date moves
        </p>

        {/* Rate display */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-5xl font-black italic tracking-tighter text-text-main tabular-nums leading-none">{simRate}%</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-1">{mask(Math.round(simMonthly))}/mo saved</p>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-black italic tracking-tighter tabular-nums leading-none ${simOnTrack ? 'text-capture-readable' : 'text-action-bleed'}`}>
              {simFIREAge !== null ? `Age ${simFIREAge}` : '80+'}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-1">
              {simYears !== null ? `FIRE in ${simYears}y` : 'extend horizon'}
            </p>
          </div>
        </div>

        {/* Slider */}
        <div className="relative">
          <input
            type="range"
            min={0}
            max={80}
            step={1}
            value={simRate}
            onChange={e => setSimRate(parseInt(e.target.value))}
            title="Savings rate simulator"
            className="w-full h-4 rounded-full appearance-none cursor-pointer accent-action-capture bg-input border-2 border-border"
          />
          {/* Marker lines */}
          <div className="relative mt-2 h-4">
            {/* Current rate marker */}
            <div
              className="absolute -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${Math.min(100, (currentRate / 80) * 100)}%` }}
            >
              <div className="w-px h-3 bg-action-capture" />
              <span className="text-[8px] font-black uppercase tracking-wide text-capture-readable whitespace-nowrap">now</span>
            </div>
            {/* FIRE rate marker */}
            {neededRate > 0 && neededRate <= 80 && (
              <div
                className="absolute -translate-x-1/2 flex flex-col items-center"
                style={{ left: `${Math.min(100, (neededRate / 80) * 100)}%` }}
              >
                <div className="w-px h-3 bg-action-primary" />
                <span className="text-[8px] font-black uppercase tracking-wide text-action-primary whitespace-nowrap">FIRE</span>
              </div>
            )}
          </div>
        </div>

        {/* Scenario insight */}
        <div className={`px-4 py-3 rounded-2xl border-2 ${simOnTrack ? 'bg-action-capture/10 border-action-capture/40' : 'bg-action-bleed/10 border-action-bleed/40'}`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-main leading-snug">
            {simOnTrack
              ? simYears !== null && simYears < fireYears
                ? `At ${simRate}% you hit FIRE ${fireYears - simYears} years ahead of your target age ${fireTargetAge}.`
                : `At ${simRate}% you're on track for FIRE by age ${fireTargetAge}.`
              : neededRate > 80
              ? `FIRE requires a very high savings rate. Increase income or extend your timeline.`
              : `Saving ${simRate}% isn't enough. Bump to ${Math.ceil(neededRate)}% (${mask(Math.ceil(neededMo))}/mo) to hit FIRE by ${fireTargetAge}.`
            }
          </p>
        </div>

        {/* Quick scenario pills */}
        <div className="flex gap-2 flex-wrap">
          {[10, 20, 30, 40, 50].map(rate => (
            <button
              key={rate}
              type="button"
              onClick={() => setSimRate(rate)}
              className={`px-3 py-1.5 rounded-full border-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                simRate === rate
                  ? 'bg-black border-black text-action-primary'
                  : 'bg-input border-border text-text-muted hover:border-black hover:text-text-main'
              }`}
            >
              {rate}%
            </button>
          ))}
        </div>
      </div>

      {/* Milestone Log */}
      {incomeHistory.length > 0 && (
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Income Milestones</p>
          <div className="space-y-2">
            {[...incomeHistory].reverse().map(entry => (
              <div key={entry.id} className="flex items-center gap-3 px-4 py-3 bg-input border-4 border-black rounded-2xl">
                <div className="w-8 h-8 bg-black rounded-xl flex items-center justify-center shrink-0">
                  <Zap size={14} strokeWidth={2.5} className="text-capture-readable" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-wider text-text-main truncate">{entry.label}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-text-muted">{entry.date} · {mask(entry.amount)}/mo</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeIncomeEntry(entry.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl border-2 border-transparent text-text-muted hover:bg-action-bleed/10 hover:text-action-bleed hover:border-action-bleed/20 transition-colors shrink-0"
                >
                  <Trash2 size={13} strokeWidth={2.5} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Milestone Form */}
      <div className="bg-surface border-4 border-border rounded-3xl overflow-hidden shadow-[6px_6px_0px_0px_var(--shadow-color)]">
        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-input transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-black border-2 border-black rounded-xl flex items-center justify-center shrink-0">
              <Plus size={15} strokeWidth={3} className="text-action-primary" />
            </div>
            <span className="text-[11px] font-black uppercase tracking-widest text-text-main">Log Income Milestone</span>
          </div>
          <motion.div animate={{ rotate: showForm ? 180 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
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
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 space-y-4 border-t-4 border-border">
                {/* Date */}
                <div className="pt-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5">Date</p>
                  <input
                    type="date"
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full bg-input border-4 border-black rounded-2xl py-3 px-4 font-black text-text-main outline-none focus:border-action-capture transition-colors"
                  />
                </div>

                {/* Monthly amount */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5">Monthly Take-Home at That Time</p>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-text-muted pointer-events-none text-lg">{currencySymbol()}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={formAmount}
                      onChange={e => setFormAmount(e.target.value)}
                      onFocus={e => e.target.select()}
                      placeholder="e.g. 8000"
                      className="w-full bg-input border-4 border-black rounded-2xl py-3 pr-4 pl-9 font-black text-xl text-text-main outline-none focus:border-action-capture transition-colors tabular-nums placeholder:text-text-muted"
                    />
                  </div>
                </div>

                {/* Label */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5">Label</p>
                  <div className="flex gap-2 flex-wrap mb-2">
                    {LABEL_PRESETS.map(l => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setFormLabel(l)}
                        className={`px-3 py-1 rounded-full border-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                          formLabel === l
                            ? 'bg-black border-black text-action-primary'
                            : 'bg-input border-border text-text-muted hover:border-black hover:text-text-main'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={formLabel}
                    onChange={e => setFormLabel(e.target.value)}
                    placeholder="Or type a custom label"
                    className="w-full bg-input border-4 border-black rounded-2xl py-3 px-4 font-black text-text-main outline-none focus:border-action-capture transition-colors placeholder:text-text-muted text-sm"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 h-12 border-4 border-border rounded-2xl text-text-muted font-black uppercase tracking-widest text-[11px] hover:bg-input transition-colors"
                  >
                    Cancel
                  </button>
                  <ProAction feature="income_milestone">
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!formAmount || !formLabel.trim() || !formDate}
                      className="flex-1 h-12 border-4 border-black rounded-2xl bg-black text-action-capture font-black uppercase tracking-widest text-[11px] shadow-[4px_4px_0px_0px_var(--color-action-capture)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[4px_4px_0px_0px_var(--color-action-capture)]"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Target size={14} strokeWidth={3} />
                        Log Milestone
                      </div>
                    </button>
                  </ProAction>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
