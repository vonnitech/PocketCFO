import { currencySymbol } from './currency';

// Pure FIRE maths, shared by the FIRE calculator and its tests.
// Annual growth after inflation, in percent. Users can override it; this is the starting value.
export const DEFAULT_REAL_RETURN = 7;
export const SWR = 25;
export const MIN_AGE = 16;
export const MAX_AGE = 100;

export type FireStrategy = 'STANDARD' | 'FAT' | 'LEAN' | 'BARISTA' | 'COAST';

// ── Math helpers ─────────────────────────────────────────────────────────────
// `r` is the monthly growth rate after inflation (annual % / 100 / 12).
export function fv(assets: number, monthly: number, months: number, r: number): number {
  if (months <= 0) return assets;
  if (r === 0) return assets + monthly * months;
  const g = Math.pow(1 + r, months);
  return monthly === 0 ? assets * g : assets * g + monthly * (g - 1) / r;
}

// Month-by-month simulation when income grows over time
export function fvWithGrowth(assets: number, monthlyStart: number, months: number, annualGrowth: number, r: number): number {
  if (annualGrowth === 0 || months <= 0) return fv(assets, monthlyStart, months, r);
  let portfolio = assets;
  for (let m = 0; m < months; m++) {
    portfolio = portfolio * (1 + r) + monthlyStart * Math.pow(1 + annualGrowth, m / 12);
  }
  return portfolio;
}

export function yearsToFireWithGrowth(assets: number, monthlyStart: number, target: number, annualGrowth: number, r: number, maxYears = 80): number | null {
  if (annualGrowth === 0) return yearsToFire(assets, monthlyStart, target, r, maxYears);
  for (let y = 0; y <= maxYears; y++) {
    if (fvWithGrowth(assets, monthlyStart, y * 12, annualGrowth, r) >= target) return y;
  }
  return null;
}

export function yearsToFire(assets: number, monthly: number, target: number, r: number, maxYears = 80): number | null {
  for (let y = 0; y <= maxYears; y++) {
    if (fv(assets, monthly, y * 12, r) >= target) return y;
  }
  return null;
}

export function neededMonthly(assets: number, target: number, months: number, r: number): number {
  if (months <= 0) return Infinity;
  const g = Math.pow(1 + r, months);
  const needed = target - assets * g;
  if (needed <= 0) return 0;
  return r === 0 ? needed / months : needed * r / (g - 1);
}

export function neededMonthlyWithGrowth(
  assets: number,
  target: number,
  months: number,
  annualGrowth: number,
  r: number,
): number {
  if (annualGrowth === 0) return neededMonthly(assets, target, months, r);
  if (months <= 0) return Infinity;

  const assetsAtTarget = fvWithGrowth(assets, 0, months, annualGrowth, r);
  if (assetsAtTarget >= target) return 0;

  const growingContributionFactor = fvWithGrowth(0, 1, months, annualGrowth, r);
  return growingContributionFactor > 0
    ? (target - assetsAtTarget) / growingContributionFactor
    : Infinity;
}

export function fmt(n: number): string {
  const s = currencySymbol();
  if (n > 0 && n < 1) return `<${s}1`;
  if (n >= 1_000_000_000_000) return `${s}${(n / 1_000_000_000_000).toFixed(2)}T`;
  if (n >= 1_000_000_000) return `${s}${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${s}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${s}${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `${s}${parseFloat((n / 1_000).toFixed(1))}K`;
  return `${s}${n.toFixed(0)}`;
}

// Strips non-numeric characters and stops the value at `max`, so the box always shows the rate in use
export function clampPct(raw: string, max: number): string {
  const v = raw.replace(/[^0-9.]/g, '');
  return parseFloat(v) > max ? String(max) : v;
}

export function fmtFull(n: number): string {
  if (n > 0 && n < 1) return `<${currencySymbol()}1`;
  return currencySymbol() + Math.round(n).toLocaleString();
}

export function targetProgress(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, (current / target) * 100));
}

// Rounds down to the nearest 1-2-5 step (100, 200, 500, 1000, ...) so what-if amounts read as round numbers
export function niceStep(n: number): number {
  if (n <= 100) return 100;
  const mag = Math.pow(10, Math.floor(Math.log10(n)));
  const lead = n / mag;
  return (lead >= 5 ? 5 : lead >= 2 ? 2 : 1) * mag;
}

export interface FireInputs {
  ca: string;
  ta: string;
  ae: string;
  ptIncome: string;
  strategy: FireStrategy;
  totalVaulted: number;
  monthlyContrib: number;
  incomeGrowthRate: number;
  r: number;
}

export function computeFire({ ca, ta, ae, ptIncome, strategy, totalVaulted, monthlyContrib, incomeGrowthRate, r }: FireInputs) {
  const currentAge     = parseInt(ca) || 0;
  const annualExpenses = parseFloat(ae) || 0;
  if (currentAge <= 0 || annualExpenses <= 0) return null;
  if (currentAge < MIN_AGE || currentAge >= MAX_AGE) return null;
  // Projections stop at MAX_AGE; a FIRE age beyond it is not a useful answer
  const horizon = MAX_AGE - currentAge;

  const partIncome        = parseFloat(ptIncome) || 0;
  const effectiveExpenses = strategy === 'FAT'
    ? annualExpenses * 1.5
    : strategy === 'LEAN'
    ? annualExpenses * 0.7
    : strategy === 'BARISTA'
    ? Math.max(0, annualExpenses - partIncome)
    : annualExpenses;

  // Part-time income covers everything, so there is no portfolio target to project towards
  if (strategy === 'BARISTA' && effectiveExpenses <= 0) return null;

  const fireNumber = effectiveExpenses * SWR;

  // ── Coast FIRE ───────────────────────────────────────────────────────────
  if (strategy === 'COAST') {
    // Coasting means letting investments grow until 65, so there is nothing to coast towards at 65+
    if (currentAge >= 65) return null;
    const yearsTo65    = 65 - currentAge;
    const coastFactor  = Math.pow(1 + r, yearsTo65 * 12);
    const coastNumber  = fireNumber / coastFactor;
    const onCoast      = totalVaulted >= coastNumber;
    const projAtTarget = fv(totalVaulted, 0, yearsTo65 * 12, r);
    const surplus      = onCoast ? projAtTarget - fireNumber : 0;
    const shortfall    = onCoast ? 0 : coastNumber - totalVaulted;
    const progressPct  = targetProgress(totalVaulted, coastNumber);
    const projPct      = targetProgress(projAtTarget, fireNumber);
    const coastYTF     = yearsToFire(totalVaulted, 0, fireNumber, r, horizon);

    const displayYears = Math.min(horizon, yearsTo65 + 5);
    const chartData = Array.from({ length: displayYears + 1 }, (_, i) => ({
      age:   currentAge + i,
      value: fv(totalVaulted, 0, i * 12, r),
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
      reqMonthlyFlat:   null as number | null,
      whatIf:           null as { bump: number; fireAge: number; yearsSooner: number | null } | null,
      chartData,
      currentAge,
      targetAge:        65,
      yearsToFIRE:      coastYTF,
    };
  }

  // ── Standard / Fat / Lean / Barista ─────────────────────────────────────
  const targetAge = parseInt(ta) || 0;
  if (targetAge <= currentAge || targetAge > MAX_AGE) return null;

  const yearsToTarget = targetAge - currentAge;
  const projAtTarget  = fvWithGrowth(totalVaulted, monthlyContrib, yearsToTarget * 12, incomeGrowthRate, r);
  const progressPct   = targetProgress(totalVaulted, fireNumber);
  const projPct       = targetProgress(projAtTarget, fireNumber);
  const onTrack       = projAtTarget >= fireNumber;
  const yearsToFIRE   = yearsToFireWithGrowth(totalVaulted, monthlyContrib, fireNumber, incomeGrowthRate, r, horizon);
  const fireAge       = yearsToFIRE !== null ? currentAge + yearsToFIRE : null;
  const reqMonthly    = neededMonthlyWithGrowth(
    totalVaulted,
    fireNumber,
    yearsToTarget * 12,
    incomeGrowthRate,
    r,
  );
  const reqMonthlyFlat = neededMonthly(totalVaulted, fireNumber, yearsToTarget * 12, r);

  // What-if: the effect of saving a round amount more each month
  const whatIfBump    = niceStep(monthlyContrib * 0.5);
  const whatIfYears   = yearsToFireWithGrowth(totalVaulted, monthlyContrib + whatIfBump, fireNumber, incomeGrowthRate, r, horizon);
  const whatIf = whatIfYears !== null && (yearsToFIRE === null || whatIfYears < yearsToFIRE)
    ? { bump: whatIfBump, fireAge: currentAge + whatIfYears, yearsSooner: yearsToFIRE !== null ? yearsToFIRE - whatIfYears : null }
    : null;
  const surplus       = onTrack ? projAtTarget - fireNumber : 0;

  const displayYears = Math.min(horizon, Math.max(yearsToTarget + 12, yearsToFIRE ? yearsToFIRE + 5 : yearsToTarget + 20, 20));
  const chartData = Array.from({ length: displayYears + 1 }, (_, i) => ({
    age:   currentAge + i,
    value: fvWithGrowth(totalVaulted, monthlyContrib, i * 12, incomeGrowthRate, r),
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
    reqMonthlyFlat,
    whatIf,
    surplus,
    shortfall:        0,
    chartData,
    currentAge,
    targetAge,
    yearsToFIRE,
  };
}

export type FireResult = NonNullable<ReturnType<typeof computeFire>>;

// Label/value rows for the verdict panel (non-Coast strategies)
export function summaryRows(c: FireResult, monthlyContrib: number, incomeGrowthRate: number) {
  const growthPct = `${parseFloat((incomeGrowthRate * 100).toFixed(2))}%`;
  const req = c.reqMonthly ?? 0;
  const growing = incomeGrowthRate > 0;
  const rows: { label: string; value: string; accent?: string }[] = [
    req === 0
      ? { label: 'Needed', value: 'Nothing more' }
      : { label: growing ? 'Needed from' : 'Needed', value: `${fmtFull(req)}/mo${growing ? `, +${growthPct}/yr` : ''}` },
  ];
  if (growing && req > 0 && c.reqMonthlyFlat !== null) rows.push({ label: 'Or flat', value: `${fmtFull(c.reqMonthlyFlat)}/mo` });
  rows.push({ label: 'You save', value: `${fmtFull(monthlyContrib)}/mo${growing ? `, +${growthPct}/yr` : ''}` });
  if (!c.onTrack) rows.push({ label: 'Short by', value: `${fmtFull(req - monthlyContrib)}/mo`, accent: 'text-action-bleed' });
  else if (!growing && monthlyContrib > req) rows.push({ label: 'Spare', value: `${fmtFull(monthlyContrib - req)}/mo`, accent: 'text-capture-readable' });
  if (c.whatIf) rows.push({
    label: `+${fmtFull(c.whatIf.bump)}/mo`,
    value: c.whatIf.yearsSooner !== null
      ? `Age ${c.whatIf.fireAge} · ${c.whatIf.yearsSooner} ${c.whatIf.yearsSooner === 1 ? 'yr' : 'yrs'} sooner`
      : `FIRE at ${c.whatIf.fireAge}`,
    accent: 'text-primary-readable',
  });
  return rows;
}
