import { useState } from 'react';
import { NOTE_MAX_LENGTH } from '../lib/paydayNote';
import { writePaydayNote } from '../lib/personalStorage';
import { toLocalDateKey } from '../core/math';

interface Props {
  /** Called whether the note was written or skipped, so the caller can close. */
  onDone: () => void;
}

/**
 * Offered once, right after income is logged.
 *
 * Deliberately skippable with no friction and no second ask. Something written
 * to make a prompt go away is worth nothing to read later, and nagging for it
 * would make the feature a chore rather than a note to yourself.
 */
export function PaydayNotePrompt({ onDone }: Props) {
  const [text, setText] = useState('');
  const remaining = NOTE_MAX_LENGTH - text.length;

  const save = () => {
    writePaydayNote(text, toLocalDateKey(new Date()));
    onDone();
  };

  return (
    <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
      <p className="font-mono text-[10px] font-black uppercase tracking-widest text-text-muted">
        Optional
      </p>
      <h3 className="mt-1 text-xl font-black italic uppercase tracking-tight text-text-main">
        Leave yourself a note
      </h3>
      <p className="mt-2 text-sm font-bold leading-relaxed text-text-muted">
        One line, written now while the money has just landed. You will see it later
        in the cycle when the daily number gets thin.
      </p>

      <label className="sr-only" htmlFor="payday-note">Your note</label>
      <textarea
        id="payday-note"
        autoFocus
        rows={2}
        maxLength={NOTE_MAX_LENGTH}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What this month is for"
        className="mt-4 w-full resize-none rounded-2xl border-[3px] border-border bg-input p-3 text-sm font-bold text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-action-primary"
      />
      <p className="mt-1 text-right font-mono text-[10px] font-bold text-text-muted">
        {remaining} left
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={save}
          disabled={!text.trim()}
          className="dark:bg-action-primary dark:text-primary-contrast dark:border-action-primary dark:shadow-none min-w-0 flex h-14 items-center justify-center gap-2 rounded-2xl border-4 border-black bg-black text-sm font-black uppercase tracking-widest text-action-primary shadow-[4px_4px_0px_0px_var(--color-action-primary)] transition-all hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0px_0px_var(--color-action-primary)]"
        >
          Save note
        </button>
        <button
          type="button"
          onClick={onDone}
          className="min-w-0 flex h-14 items-center justify-center gap-2 rounded-2xl border-4 border-border bg-input text-sm font-black uppercase tracking-widest text-text-main shadow-[4px_4px_0px_0px_var(--shadow-color)] transition-all hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
