// Regression checks for the journal's recap.
// Run: npx tsx src/lib/journal.check.ts
import { buildRecap, recapLines, recurringWords, isEmptyEntry, type JournalEntry } from './journal';

let failed = 0;
const expect = (name: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
};

const entry = (d: string, note = '', mood: JournalEntry['mood'] = null, noSpend = false): JournalEntry =>
  ({ id: d, entryDate: d, note, mood, noSpend });

// ── what counts as written ──────────────────────────────────────────────────
expect('a blank entry is empty', isEmptyEntry('   ', null, false), true);
expect('a mood alone is an entry', isEmptyEntry('', 'steady', false), false);
expect('a no-spend mark alone is an entry', isEmptyEntry('', null, true), false);
expect('a note alone is an entry', isEmptyEntry('spent on lunch', null, false), false);

// ── the recap stays quiet when there is nothing to say ──────────────────────
expect('no entries, no recap', buildRecap([]), null);
expect('one entry is not a week', buildRecap([entry('2026-10-12', 'takeaway again')]), null);
expect('blank entries do not count towards a recap',
  buildRecap([entry('2026-10-11'), entry('2026-10-12'), entry('2026-10-13')]), null);

// ── counting, and only what was written ─────────────────────────────────────
const week = [
  entry('2026-10-07', 'takeaway again', 'stretched'),
  entry('2026-10-08', 'nothing today', 'steady', true),
  entry('2026-10-09', 'takeaway with friends', 'broke'),
  entry('2026-10-10', '', null, true),
  entry('2026-10-11'),                       // blank, must be ignored
];
const recap = buildRecap(week);
expect('blank days are not counted as written', recap?.daysWritten, 4);
expect('no-spend days are counted', recap?.noSpendDays, 2);
expect('moods are counted', recap?.moodCounts, { steady: 1, stretched: 1, broke: 1 });
expect('a word used on two days is reported', recap?.words.includes('takeaway'), true);

// ── recurring words ─────────────────────────────────────────────────────────
expect('a word used once is not a pattern',
  recurringWords([entry('2026-10-01', 'coffee'), entry('2026-10-02', 'lunch')]), []);
expect('a word repeated within one day is still one day',
  recurringWords([entry('2026-10-01', 'coffee coffee coffee')]), []);
expect('short words are ignored',
  recurringWords([entry('2026-10-01', 'tea and tea'), entry('2026-10-02', 'tea')]), []);
expect('filler words are ignored',
  recurringWords([entry('2026-10-01', 'that was really something'),
                  entry('2026-10-02', 'that was really something')]), ['something']);
expect('case does not split a word',
  recurringWords([entry('2026-10-01', 'Takeaway'), entry('2026-10-02', 'takeaway')]), ['takeaway']);
expect('punctuation does not split a word',
  recurringWords([entry('2026-10-01', 'takeaway.'), entry('2026-10-02', 'takeaway!')]), ['takeaway']);

// ── the sentences ───────────────────────────────────────────────────────────
const lines = recapLines(recap!);
expect('it says how many days were written', lines[0], 'You wrote on 4 days.');
expect('it reports no-spend days', lines.some((l) => l === 'You marked 2 no-spend days.'), true);
expect('it never praises', lines.some((l) => /well done|great|nice|keep it up|proud/i.test(l)), false);
expect('it never advises', lines.some((l) => /you should|try to|consider|why not/i.test(l)), false);

const one = buildRecap([entry('2026-10-01', 'a', 'steady'), entry('2026-10-02', 'b', 'steady')])!;
expect('singular day reads correctly',
  recapLines({ ...one, daysWritten: 1 })[0], 'You wrote on 1 day.');
expect('singular no-spend reads correctly',
  recapLines({ ...one, noSpendDays: 1 }).some((l) => l === 'You marked 1 no-spend day.'), true);

// Whatever someone writes, the recap must not throw and must not invent lines.
let threw = 0;
for (let i = 0; i < 2000; i++) {
  const notes = Array.from({ length: Math.floor(Math.random() * 6) }, (_, j) =>
    entry(`2026-10-${String(j + 1).padStart(2, '0')}`,
      Array.from({ length: Math.floor(Math.random() * 30) },
        () => String.fromCharCode(32 + Math.floor(Math.random() * 95))).join('')));
  try {
    const r = buildRecap(notes);
    if (r) recapLines(r);
  } catch { threw++; }
}
expect('2000 random journals never throw', threw, 0);

console.log(failed === 0 ? '\nALL PASSED' : `\n${failed} FAILED`);
if (failed > 0) process.exit(1);
