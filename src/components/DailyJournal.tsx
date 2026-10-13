import { useEffect, useState } from 'react';
import { BookOpen, Check } from 'lucide-react';
import { useStore } from '../store/useStore';
import { toLocalDateKey } from '../core/math';
import {
  MOODS, MOOD_LABELS, NOTE_MAX_LENGTH, buildRecap, recapLines,
  type JournalEntry, type Mood,
} from '../lib/journal';
import { fetchJournal, saveJournalEntry } from '../core/personalData';

/**
 * Today's line, with the week read back underneath it.
 *
 * Sits on Daily Review next to the day's figures, because the point is the
 * habit beside the number rather than a separate diary nobody opens.
 *
 * Nothing here is required. There is no streak, no reminder, and no remark
 * about days left blank. An entry written to make a prompt go away tells you
 * nothing when you read it back a fortnight later.
 */
export function DailyJournal() {
  const userId = useStore((s) => s.userId);
  const today = toLocalDateKey(new Date());

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [note, setNote] = useState('');
  const [mood, setMood] = useState<Mood | null>(null);
  const [noSpend, setNoSpend] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void fetchJournal(userId).then((rows) => {
      if (cancelled) return;
      setEntries(rows);
      const mine = rows.find((r) => r.entryDate === today);
      if (mine) { setNote(mine.note); setMood(mine.mood); setNoSpend(mine.noSpend); }
    });
    return () => { cancelled = true; };
  }, [userId, today]);

  if (!userId) return null;

  const save = async () => {
    setSaving(true);
    const ok = await saveJournalEntry(userId, today, note, mood, noSpend);
    setSaving(false);
    if (!ok) return;
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setEntries(await fetchJournal(userId));
  };

  // Only the last seven days feed the recap. A longer window turns a week you
  // can still remember into a report about a stranger.
  const recentDays = entries.filter((e) => {
    const [y, m, d] = e.entryDate.split('-').map(Number);
    if (!y || !m || !d) return false;
    const diff = (Date.now() - new Date(y, m - 1, d).getTime()) / 86_400_000;
    return diff >= 0 && diff < 7;
  });
  const recap = buildRecap(recentDays);

  return (
    <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
      <div className="flex items-center gap-2">
        <BookOpen size={16} strokeWidth={3} aria-hidden="true" className="text-text-muted" />
        <p className="font-mono text-[10px] font-black uppercase tracking-widest text-text-muted">
          Today's note
        </p>
      </div>

      <label className="sr-only" htmlFor="journal-note">A line about today</label>
      <textarea
        id="journal-note"
        rows={2}
        maxLength={NOTE_MAX_LENGTH}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What happened with money today"
        className="mt-3 w-full resize-none rounded-2xl border-[3px] border-border bg-input p-3 text-sm font-bold text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-action-primary"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {MOODS.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mood === m}
            onClick={() => setMood(mood === m ? null : m)}
            className={`rounded-full border-2 border-black px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-widest transition-colors ${
              mood === m ? 'bg-action-primary text-black' : 'bg-input text-text-muted'
            }`}
          >
            {MOOD_LABELS[m]}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={noSpend}
          onClick={() => setNoSpend(!noSpend)}
          className={`inline-flex items-center gap-1.5 rounded-full border-2 border-black px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-widest transition-colors ${
            noSpend ? 'bg-action-capture text-capture-contrast' : 'bg-input text-text-muted'
          }`}
        >
          {noSpend && <Check size={12} strokeWidth={4} />} No-spend day
        </button>
      </div>

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="dark:bg-action-primary dark:text-primary-contrast dark:border-action-primary dark:shadow-none mt-4 flex h-12 w-full items-center justify-center rounded-2xl border-4 border-black bg-black text-[11px] font-black uppercase tracking-widest text-action-primary shadow-[4px_4px_0px_0px_var(--color-action-primary)] transition-all hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 disabled:opacity-50"
      >
        {saved ? 'Saved' : saving ? 'Saving' : 'Save note'}
      </button>

      {/* Built only from what the user wrote. It counts their own words and
          markers; it never infers a mood or a cause from the numbers. */}
      {recap && (
        <div className="mt-5 border-t-2 border-border pt-4">
          <p className="font-mono text-[10px] font-black uppercase tracking-widest text-text-muted">
            Your last 7 days
          </p>
          <ul className="mt-2 space-y-1">
            {recapLines(recap).map((line) => (
              <li key={line} className="text-sm font-bold leading-relaxed text-text-main">
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
