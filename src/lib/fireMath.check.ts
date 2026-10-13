// Regression checks for the FIRE calculator maths. Run: npx tsx src/lib/fireMath.check.ts
import { computeFire, summaryRows, fmt, fv, fvWithGrowth, neededMonthly, type FireInputs } from './fireMath';

let failed = 0;
const expect = (name: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
};
const close = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

const base: FireInputs = {
  ca: '29', ta: '65', ae: '240000', ptIncome: '0', strategy: 'STANDARD',
  totalVaulted: 4, monthlyContrib: 3000, incomeGrowthRate: 0, r: 0.10 / 12,
};

// Bug 1: the summary cards rounded thousands to a whole K ($1,426 showed as "$1K")
expect('fmt keeps one decimal under 10K: 1,426', fmt(1426), '$1.4K');
expect('fmt keeps one decimal under 10K: 1,574', fmt(1574), '$1.6K');
expect('fmt drops a trailing .0', fmt(3000), '$3K');
expect('fmt whole K from 10K up', fmt(25400), '$25K');

// Bug 2: Coast FIRE at 65+ pretended there was 1 year left
expect('Coast at age 70 gives no result', computeFire({ ...base, ca: '70', strategy: 'COAST' }), null);
expect('Coast at age 65 gives no result', computeFire({ ...base, ca: '65', strategy: 'COAST' }), null);
expect('Coast at age 64 still works', computeFire({ ...base, ca: '64', strategy: 'COAST' })?.targetAge, 65);

// Barista: part-time income covering all expenses used to show a $0 FIRE number and "FIRE at your current age"
expect('Barista fully covered gives no result', computeFire({ ...base, strategy: 'BARISTA', ae: '20000', ptIncome: '30000' }), null);
expect('Barista exactly covered gives no result', computeFire({ ...base, strategy: 'BARISTA', ae: '20000', ptIncome: '20000' }), null);
expect('Barista partly covered still works', computeFire({ ...base, strategy: 'BARISTA', ae: '20000', ptIncome: '15000' })?.fireNumber, 125000);

// Ages past 100 and nonsense ages: age 99 used to report "FIRE at age 127"
const old = computeFire({ ...base, ca: '99', ta: '100', ae: '40000', totalVaulted: 0, monthlyContrib: 1000, r: 0.07 / 12 });
expect('age 99 never reports FIRE past 100', old?.fireAge ?? null, null);
expect('current age under 16 gives no result', computeFire({ ...base, ca: '1', ta: '2' }), null);
expect('target age over 100 gives no result', computeFire({ ...base, ta: '150' }), null);
expect('target age 100 still works', computeFire({ ...base, ta: '100' })?.targetAge, 100);
expect('Coast under 16 gives no result', computeFire({ ...base, ca: '10', strategy: 'COAST' }), null);

// Already covered: "Needed from $0/mo, +20%/yr" should read as nothing more needed
const rich = computeFire({ ...base, totalVaulted: 1e9, incomeGrowthRate: 0.2 })!;
expect('nothing-needed row reads plainly', summaryRows(rich, 3000, 0.2)[0], { label: 'Needed', value: 'Nothing more' });
expect('no "or flat" row when nothing is needed', summaryRows(rich, 3000, 0.2).some(r => r.label === 'Or flat'), false);

// Known-good figures (fire-calc.com: $12,620,428 at 65, FIRE at 58)
const ref = computeFire(base)!;
expect('matches fire-calc.com balance at 65', Math.round(ref.projAtTarget), 12620428);
expect('matches fire-calc.com FIRE age', ref.fireAge, 58);

// Invariants over random inputs
let bad = 0;
for (let i = 0; i < 2000; i++) {
  const age = 18 + Math.floor(Math.random() * 60);
  const inp: FireInputs = {
    ...base,
    ca: String(age), ta: String(Math.min(100, age + 1 + Math.floor(Math.random() * 50))),
    ae: String(Math.round(1000 + Math.random() * 500000)),
    totalVaulted: Math.random() * 2e6,
    monthlyContrib: Math.random() * 20000,
    incomeGrowthRate: Math.random() < 0.5 ? 0 : Math.random() * 0.2,
    r: (Math.random() * 20) / 100 / 12,
  };
  const c = computeFire(inp)!;
  if (c.fireAge !== null && c.fireAge > 100) { bad++; continue; }
  const months = (c.targetAge - c.currentAge) * 12;
  const ok =
    c.onTrack === (c.fireAge !== null && c.fireAge <= c.targetAge) &&
    (c.onTrack || (c.reqMonthly ?? 0) > inp.monthlyContrib) &&
    (!(c.reqMonthly! > 0) || close(fvWithGrowth(inp.totalVaulted, c.reqMonthly!, months, inp.incomeGrowthRate, inp.r), c.fireNumber)) &&
    (!(c.reqMonthlyFlat! > 0) || close(fv(inp.totalVaulted, c.reqMonthlyFlat!, months, inp.r), c.fireNumber)) &&
    (inp.incomeGrowthRate !== 0 || close(c.reqMonthly!, neededMonthly(inp.totalVaulted, c.fireNumber, months, inp.r))) &&
    (!c.whatIf || c.whatIf.yearsSooner === null || c.whatIf.yearsSooner > 0);
  if (!ok) { bad++; if (bad === 1) console.log('      first bad input:', JSON.stringify(inp)); }
}
expect('2000 random scenarios stay consistent', bad, 0);

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
