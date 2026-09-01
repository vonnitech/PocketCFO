import { useState } from 'react';
import { AlertTriangle, Bell, BellOff, Check, Clock, Send } from 'lucide-react';
import {
  ALL_CATEGORIES,
  CATEGORY_META,
  deliverTest,
  POLICY,
  type NotificationMode,
} from '../core/notifications';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationPrimer } from './NotificationPrimer';

// The Settings card. Also the only route back in for anyone who declined during
// onboarding, which is what makes "ask once and never nag" a workable policy:
// the answer is always changeable, it is just never re-asked unprompted.

const MODES: { id: NotificationMode; label: string; hint: string }[] = [
  { id: 'off',       label: 'Off',            hint: 'Nothing is sent and nothing is recorded. Your existing inbox is kept.' },
  { id: 'important', label: 'Important only', hint: 'Bills, payday, overspend and shortfall risk, account problems.' },
  { id: 'all',       label: 'Helpful too',    hint: 'Adds Daily Review and safe-spend change reminders.' },
];

const hour12 = (h: number): string => {
  const suffix = h < 12 ? 'am' : 'pm';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${suffix}`;
};

export function NotificationSettings() {
  const { prefs, permission, setMode, toggleCategory } = useNotifications();
  const [showPrimer, setShowPrimer] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'sent' | 'failed'>('idle');

  const sendTest = async () => {
    const ok = await deliverTest();
    setTestState(ok ? 'sent' : 'failed');
    setTimeout(() => setTestState('idle'), 4000);
  };

  const muted = prefs.mode === 'off';

  return (
    <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-4">
      <p className="text-[11px] font-black uppercase tracking-[0.25em] text-text-muted/60">Notifications</p>

      {/* ── Permission state ── */}
      {permission === 'unsupported' && (
        <div className="flex items-start gap-2.5 border-4 border-border rounded-2xl bg-input px-3 py-2.5">
          <AlertTriangle size={14} strokeWidth={2.5} className="text-text-muted shrink-0 mt-0.5" />
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted leading-snug">
            This browser cannot show notifications. Alerts still collect in your in-app inbox.
          </p>
        </div>
      )}

      {permission === 'denied' && (
        // No retry button. Once denied, script cannot re-prompt, so offering a
        // button that silently does nothing would be worse than saying so.
        <div className="flex items-start gap-2.5 border-4 border-action-bleed rounded-2xl bg-action-bleed/10 px-3 py-2.5">
          <BellOff size={14} strokeWidth={2.5} className="text-action-bleed shrink-0 mt-0.5" />
          <p className="text-[10px] font-bold uppercase tracking-wide text-action-bleed leading-snug">
            Notifications are blocked for this site. To turn them back on, allow notifications
            for Pocket CFO in your browser settings. Your inbox keeps working either way.
          </p>
        </div>
      )}

      {permission === 'granted' && (
        <div className="flex items-center justify-between gap-3 border-4 border-action-capture rounded-2xl bg-action-capture/10 px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Check size={14} strokeWidth={3} className="text-action-capture shrink-0" />
            <p className="text-[10px] font-black uppercase tracking-wide text-text-main truncate">
              {testState === 'sent'   ? 'Test sent'
               : testState === 'failed' ? 'Could not send test'
               : 'Notifications allowed'}
            </p>
          </div>
          <button
            type="button"
            onClick={sendTest}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 border-2 border-black rounded-xl bg-input text-[10px] font-black uppercase tracking-widest text-text-main hover:bg-surface transition-colors"
          >
            <Send size={11} strokeWidth={3} /> Test
          </button>
        </div>
      )}

      {permission === 'default' && !showPrimer && (
        <button
          type="button"
          onClick={() => setShowPrimer(true)}
          className="w-full flex items-center justify-center gap-2 h-12 border-4 border-black rounded-2xl bg-black text-action-primary font-black uppercase text-[11px] tracking-widest shadow-[3px_3px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
        >
          <Bell size={13} strokeWidth={3} /> Turn On Reminders
        </button>
      )}

      {permission === 'default' && showPrimer && (
        <div className="border-4 border-black rounded-2xl p-4">
          <NotificationPrimer
            onDone={() => setShowPrimer(false)}
            headline="Turn on reminders?"
            subline="Your browser will ask you to confirm. You can change this at any time."
            dismissLabel="Cancel"
          />
        </div>
      )}

      {/* ── Master mode ── */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">What gets sent</p>
        <div className="grid grid-cols-3 gap-2">
          {MODES.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`h-11 px-2 border-4 border-black rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
                prefs.mode === m.id
                  ? 'bg-black text-action-primary shadow-[3px_3px_0px_0px_var(--color-action-primary)]'
                  : 'bg-input text-text-muted hover:text-text-main'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-2 leading-snug">
          {MODES.find(m => m.id === prefs.mode)?.hint}
        </p>
      </div>

      {/* ── Categories ── */}
      <div className={muted ? 'opacity-40 pointer-events-none' : ''}>
        <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Categories</p>
        <ul className="border-4 border-black rounded-2xl divide-y-2 divide-black overflow-hidden">
          {ALL_CATEGORIES.map(category => {
            const meta = CATEGORY_META[category];
            const on = prefs.categories[category] !== false;
            // A helpful category is inert while the mode is "Important only".
            // Shown rather than hidden so the toggle state is never a surprise
            // when the mode changes back.
            const inert = prefs.mode === 'important' && meta.level === 'helpful';
            return (
              <li key={category} className={`flex items-center gap-3 px-3 py-2.5 ${inert ? 'opacity-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-wide text-text-main leading-tight">
                    {meta.label}
                  </p>
                  <p className="text-[10px] font-bold text-text-muted leading-snug mt-0.5">
                    {inert ? 'Muted by "Important only"' : meta.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  aria-pressed={on}
                  className={`shrink-0 min-w-16 px-3 py-2 border-2 border-black rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors ${
                    on ? 'bg-action-capture text-capture-contrast' : 'bg-input text-text-muted'
                  }`}
                >
                  {on ? 'On' : 'Off'}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── The limits, stated plainly ── */}
      <div className="flex items-start gap-2.5 border-2 border-border rounded-2xl bg-input px-3 py-2.5">
        <Clock size={13} strokeWidth={2.5} className="text-text-muted shrink-0 mt-0.5" />
        <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted leading-snug">
          Capped at {POLICY.maxPerDay} a day and {POLICY.maxPerWeek} a week, and silent from{' '}
          {hour12(prefs.quietHours.start)} to {hour12(prefs.quietHours.end)}. Reminders wait{' '}
          {POLICY.defaultCooldownHours} hours before repeating. Risk alerts stay inside those same
          caps, but can come sooner if your position gets materially worse, or if you are still at
          high risk on a new day. Account problems are the only thing exempt from the daily cap.
        </p>
      </div>
    </div>
  );
}
