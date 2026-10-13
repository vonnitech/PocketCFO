// Regression checks for the Bill Splitter maths. Run: npx tsx src/lib/splitMath.check.ts
import { evalAmount, splitEven } from './splitMath';

let failed = 0;
const expect = (name: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
};

// Amount box: what people actually type
const amounts: [string, number][] = [
  ['12+8+5', 25], ['12.50', 12.5], ['10*3', 30], ['100/4', 25], ['2+3*4', 14], ['10-2.5', 7.5], ['20 + 5', 25],
  ['$20', 20], ['R20', 20], ['.5+.5', 1], ['12+', 12], ['abc', 0], ['', 0], ['10/0', 0],
  // Thousands separators and decimal commas used to be cut off ("1,000" read as 1)
  ['1,000', 1000], ['1 000', 1000], ['1,234,567', 1234567], ['1.234.567', 1234567], ['1,234.56', 1234.56], ['1.234,56', 1234.56],
  ['12,50', 12.5], ['12,5', 12.5], ['1 000+500', 1500], ['1,000+12,50', 1012.5],
  // Signs
  ['+12', 12], ['5--3', 8], ['10*-2+30', 10], ['-5', 0], ['10-15', 0],
];
for (const [input, want] of amounts) expect(`amount ${JSON.stringify(input)}`, evalAmount(input), want);

// Even split: shares are whole cents and add back up to the bill exactly
expect('$100 ÷ 3', splitEven(100, 3), { theirShare: 33.33, yourShare: 33.34 });
expect('$90 ÷ 3', splitEven(90, 3), { theirShare: 30, yourShare: 30 });
expect('$0.01 ÷ 3', splitEven(0.01, 3), { theirShare: 0, yourShare: 0.01 });
let bad = 0;
for (let i = 0; i < 20000; i++) {
  const total = (1 + Math.floor(Math.random() * 1e7)) / 100 * [1, 1.1, 1.15, 1.125][i % 4];
  const people = 1 + Math.floor(Math.random() * 12);
  const { theirShare, yourShare } = splitEven(total, people);
  const cents = (n: number) => Math.round(n * 100);
  const wholeCents = Math.abs(theirShare * 100 - cents(theirShare)) < 1e-6 && Math.abs(yourShare * 100 - cents(yourShare)) < 1e-6;
  const addsUp = cents(theirShare) * (people - 1) + cents(yourShare) === cents(total);
  const fair = people === 1 || Math.abs(cents(yourShare) - cents(theirShare)) < people;
  if (!wholeCents || !addsUp || !fair) { bad++; if (bad === 1) console.log('      first bad:', JSON.stringify({ total, people, theirShare, yourShare })); }
}
expect('20000 random even splits add up to the cent', bad, 0);

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
