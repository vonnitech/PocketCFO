import { useEffect, useState } from 'react';
import { Quote } from 'lucide-react';
import { shouldSurfaceNote, type PaydayNote } from '../lib/paydayNote';
import { readPaydayNote } from '../lib/personalStorage';

interface Props {
  spendRemaining: number;
  dailyLimit: number;
}

/**
 * Shows the line the user wrote on payday, late in the cycle when the day has
 * gone thin.
 *
 * It is presented as their own words and nothing else: no heading telling them
 * what to feel, no figure beside it, no prompt to act. The whole value is that
 * it is a message from the version of them who had money, and adding commentary
 * would turn it into the app talking.
 */
export function PaydayNoteCard({ spendRemaining, dailyLimit }: Props) {
  const [note, setNote] = useState<PaydayNote | null>(null);

  // Read on mount rather than at module load, so signing in as a different user
  // picks up their note and not the previous one's.
  useEffect(() => { setNote(readPaydayNote()); }, []);

  if (!note) return null;
  if (!shouldSurfaceNote(spendRemaining, dailyLimit)) return null;

  return (
    <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
      <div className="flex items-start gap-3">
        <Quote
          size={18}
          strokeWidth={3}
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-text-muted"
        />
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-black uppercase tracking-widest text-text-muted">
            You wrote this on payday
          </p>
          <p className="mt-2 text-base font-bold leading-relaxed text-text-main break-words">
            {note.text}
          </p>
        </div>
      </div>
    </div>
  );
}
