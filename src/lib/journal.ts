// A line a day, kept beside that day's number.
//
// Not journalling and not therapy. The job is to make a habit visible: you
// write one line, optionally mark the day as no-spend and pick one of three
// moods, and a week later the app can show you what you yourself said.
//
// Two rules hold the whole thing up:
//
//   Never required, never nagged. An entry written to dismiss a prompt is
//   worthless to read back, so there is no streak, no reminder and no empty-day
//   scolding.
//
//   The recap says only what the user wrote. It counts their own words and
//   markers and nothing else. The moment it starts inferring, it becomes the app
//   telling someone about their life, which is the opposite of the point.
//
// Pure logic only, with no imports, so it can be exercised without a browser.

export const NOTE_MAX_LENGTH = 200;

/** Three chips, nothing finer. A longer scale invites false precision. */
export const MOODS = ['steady', 'stretched', 'broke'] as const;
export type Mood = typeof MOODS[number];

export const MOOD_LABELS: Record<Mood, string> = {
  steady:    'Steady',
  stretched: 'Stretched',
  broke:     'Broke',
};

export interface JournalEntry {
  id: string;
  /** Local calendar day, YYYY-MM-DD. At most one entry per day. */
  entryDate: string;
  note: string;
  mood: Mood | null;
  noSpend: boolean;
}

export function isMood(v: unknown): v is Mood {
  return typeof v === 'string' && (MOODS as readonly string[]).includes(v);
}

/** An entry with nothing in it is not worth storing or showing. */
export function isEmptyEntry(note: string, mood: Mood | null, noSpend: boolean): boolean {
  return !note.trim() && mood === null && !noSpend;
}

// Words too common to be worth reporting back. Deliberately short: the aim is
// to drop filler, not to judge which of someone's words are interesting.
const STOPWORDS = new Set([
  'the', 'and', 'but', 'for', 'was', 'were', 'this', 'that', 'with', 'from',
  'have', 'had', 'has', 'not', 'you', 'your', 'out', 'too', 'got', 'get',
  'just', 'really', 'very', 'some', 'all', 'day', 'today', 'again', 'bit',
  'went', 'being', 'been', 'its', 'about', 'into', 'than', 'then', 'them',
  'they', 'did', 'didn', 'don', 'because', 'what', 'when', 'where', 'would',
  'could', 'should', 'much', 'more', 'less',
]);

/** Words of four letters or more that the user used on more than one day. */
export function recurringWords(entries: JournalEntry[], minDays = 2): string[] {
  const daysByWord = new Map<string, Set<string>>();
  for (const e of entries) {
    const seen = new Set<string>();
    for (const raw of e.note.toLowerCase().split(/[^a-z']+/)) {
      const word = raw.replace(/^'+|'+$/g, '');
      if (word.length < 4 || STOPWORDS.has(word)) continue;
      if (seen.has(word)) continue;        // once per day, so one rant is not a pattern
      seen.add(word);
      const set = daysByWord.get(word) ?? new Set<string>();
      set.add(e.entryDate);
      daysByWord.set(word, set);
    }
  }
  return [...daysByWord.entries()]
    .filter(([, days]) => days.size >= minDays)
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .map(([word]) => word);
}

export interface Recap {
  daysWritten: number;
  noSpendDays: number;
  moodCounts: Record<Mood, number>;
  words: string[];
}

/**
 * Everything the recap is allowed to say, derived purely from the entries.
 *
 * Returns null when there is not enough to be worth showing. A recap of one
 * entry is just that entry repeated back, which reads as the app padding.
 */
export function buildRecap(entries: JournalEntry[], minEntries = 2): Recap | null {
  const written = entries.filter((e) => !isEmptyEntry(e.note, e.mood, e.noSpend));
  if (written.length < minEntries) return null;

  const moodCounts: Record<Mood, number> = { steady: 0, stretched: 0, broke: 0 };
  let noSpendDays = 0;
  for (const e of written) {
    if (e.mood) moodCounts[e.mood] += 1;
    if (e.noSpend) noSpendDays += 1;
  }

  return {
    daysWritten: written.length,
    noSpendDays,
    moodCounts,
    words: recurringWords(written).slice(0, 3),
  };
}

/** Plain sentences, in the user's own terms. No praise and no advice. */
export function recapLines(recap: Recap): string[] {
  const lines: string[] = [];

  lines.push(recap.daysWritten === 1
    ? 'You wrote on 1 day.'
    : `You wrote on ${recap.daysWritten} days.`);

  if (recap.noSpendDays > 0) {
    lines.push(recap.noSpendDays === 1
      ? 'You marked 1 no-spend day.'
      : `You marked ${recap.noSpendDays} no-spend days.`);
  }

  const { steady, stretched, broke } = recap.moodCounts;
  const thin = stretched + broke;
  if (thin > 0 || steady > 0) {
    const parts: string[] = [];
    if (steady > 0)    parts.push(`${steady} steady`);
    if (stretched > 0) parts.push(`${stretched} stretched`);
    if (broke > 0)     parts.push(`${broke} broke`);
    lines.push(`How it felt: ${parts.join(', ')}.`);
  }

  if (recap.words.length === 1) {
    lines.push(`Your notes keep mentioning ${recap.words[0]}.`);
  } else if (recap.words.length > 1) {
    const last = recap.words[recap.words.length - 1];
    const rest = recap.words.slice(0, -1).join(', ');
    lines.push(`Your notes keep mentioning ${rest} and ${last}.`);
  }

  return lines;
}
