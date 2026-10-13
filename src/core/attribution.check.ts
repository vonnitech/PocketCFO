// Regression checks for campaign parameter parsing.
// Run: npx tsx src/core/attribution.check.ts
import { parseUtm, hasCampaign, MAX_VALUE_LENGTH } from './attribution';

let failed = 0;
const expect = (name: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
};

// ── the ordinary case ───────────────────────────────────────────────────────
expect('a full campaign link',
  parseUtm('?utm_source=pinterest&utm_medium=social&utm_campaign=launch'),
  { utm_source: 'pinterest', utm_medium: 'social', utm_campaign: 'launch' });

expect('a leading ? is optional',
  parseUtm('utm_source=pinterest'), { utm_source: 'pinterest' });

expect('all five are recognised',
  Object.keys(parseUtm('?utm_source=a&utm_medium=b&utm_campaign=c&utm_content=d&utm_term=e')).sort(),
  ['utm_campaign', 'utm_content', 'utm_medium', 'utm_source', 'utm_term']);

// ── nothing to record ───────────────────────────────────────────────────────
expect('a bare url yields nothing', parseUtm(''), {});
expect('unrelated parameters are ignored', parseUtm('?ref=twitter&id=7'), {});
expect('an empty value is not a campaign', parseUtm('?utm_source='), {});
expect('whitespace is not a campaign', parseUtm('?utm_source=%20%20'), {});

// This is the one that matters: an empty record must not be mistaken for a
// visit, or storing it would make a later real campaign look like a return.
expect('no campaign is reported as none', hasCampaign(parseUtm('?ref=x')), false);
expect('a campaign is reported as one', hasCampaign(parseUtm('?utm_source=x')), true);
expect('a date alone is not a campaign', hasCampaign({ landedOn: '2026-10-13' }), false);

// ── hostile and awkward input ───────────────────────────────────────────────
expect('values are trimmed', parseUtm('?utm_source=%20pinterest%20'), { utm_source: 'pinterest' });
expect('encoded characters survive', parseUtm('?utm_campaign=spring%20sale'), { utm_campaign: 'spring sale' });
expect('a repeated key takes the first', parseUtm('?utm_source=a&utm_source=b'), { utm_source: 'a' });

const long = 'x'.repeat(500);
const capped = parseUtm(`?utm_campaign=${long}`).utm_campaign ?? '';
expect('an overlong value is capped', capped.length, MAX_VALUE_LENGTH);

// Anything can be put in a link, so parsing must never throw.
let threw = 0;
const nasty = ['?utm_source=%', '?%%%', '?utm_source=<script>', '?utm_source=a%00b',
               '?=&=&=', '?utm_source[]=a', '&&&', '?utm_source=' + '&'.repeat(100)];
for (const s of nasty) {
  try { parseUtm(s); } catch { threw++; }
}
expect('malformed query strings never throw', threw, 0);

let randomThrew = 0;
for (let i = 0; i < 2000; i++) {
  const junk = Array.from({ length: Math.floor(Math.random() * 40) },
    () => String.fromCharCode(32 + Math.floor(Math.random() * 95))).join('');
  try { parseUtm(junk); } catch { randomThrew++; }
}
expect('2000 random query strings never throw', randomThrew, 0);

console.log(failed === 0 ? '\nALL PASSED' : `\n${failed} FAILED`);
if (failed > 0) process.exit(1);
