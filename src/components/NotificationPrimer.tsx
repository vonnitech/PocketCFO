import { useState } from 'react';
import { BellRing, Check, Clock, ShieldCheck, TrendingDown } from 'lucide-react';
import { motion } from 'motion/react';
import { useNotifications } from '../hooks/useNotifications';
import { POLICY, type PermissionState } from '../core/notifications';

// The soft pre-prompt.
//
// The browser gives an origin exactly one permission prompt, and a denial is
// effectively permanent (the user has to dig into site settings to undo it). So
// the real prompt is never fired speculatively. This card asks first, in plain
// language, and only a click on "Turn on reminders" spends the one shot.
//
// The restraint contract is stated up front rather than buried in Settings,
// because "at most one a day" is the actual reason a person says yes to a
// finance app asking for notifications.

interface Props {
  // Called after the user answers, either way. `permission` is 'default' when
  // they dismissed the browser prompt without choosing.
  onDone: (answer: 'accepted' | 'dismissed', permission: PermissionState) => void;
  // Onboarding shows the value line above the ask; Settings does not need it.
  headline?: string;
  subline?: string;
  dismissLabel?: string;
}

export function NotificationPrimer({
  onDone,
  headline = 'Want payday-safe reminders?',
  subline = 'Pocket CFO can tell you when a bill is about to land, when your pay arrives, and when today has gone over. Nothing else.',
  dismissLabel = 'Not now',
}: Props) {
  const { askPermission, answerPrimer } = useNotifications();
  const [busy, setBusy] = useState(false);

  const allow = async () => {
    if (busy) return;
    setBusy(true);
    // Fired straight from this click so the browser accepts it as a user
    // gesture. Anything async before this point can invalidate the gesture.
    const result = await askPermission();
    answerPrimer('accepted');
    setBusy(false);
    onDone('accepted', result);
  };

  const decline = () => {
    if (busy) return;
    // Recorded the same way as an accept, which is what stops the primer from
    // ever appearing on its own again. Settings remains the way back in.
    answerPrimer('dismissed');
    onDone('dismissed', 'default');
  };

  const promises = [
    { icon: Clock,       text: `At most ${POLICY.maxPerDay} a day and ${POLICY.maxPerWeek} a week` },
    { icon: ShieldCheck, text: 'Silent between 9pm and 8am' },
    { icon: Check,       text: 'Only about your money, never about the app' },
    { icon: TrendingDown, text: 'Sooner only if things worsen or stay risky' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 bg-action-primary border-4 border-black rounded-xl flex items-center justify-center shrink-0">
          <BellRing size={19} strokeWidth={3} className="text-black" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-black uppercase tracking-tighter italic text-text-main leading-none">
            {headline}
          </h2>
          <p className="text-[11px] font-bold text-text-muted leading-snug mt-1.5">
            {subline}
          </p>
        </div>
      </div>

      {/* The contract. This is the part that earns the yes. */}
      <ul className="border-4 border-black rounded-2xl divide-y-2 divide-black overflow-hidden">
        {promises.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2.5 px-3 py-2.5">
            <Icon size={13} strokeWidth={2.5} className="text-action-capture shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-wide text-text-main leading-tight">
              {text}
            </span>
          </li>
        ))}
      </ul>

      <div className="space-y-2">
        <motion.button
          type="button"
          onClick={allow}
          disabled={busy}
          whileTap={{ scale: 0.97 }}
          className="w-full h-14 bg-black border-4 border-black rounded-2xl text-action-primary font-black uppercase text-sm tracking-widest flex items-center justify-center gap-2 shadow-[3px_3px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-40"
        >
          {busy ? <span className="animate-pulse">Waiting…</span> : 'Turn On Reminders'}
        </motion.button>
        <button
          type="button"
          onClick={decline}
          disabled={busy}
          className="w-full h-11 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-main transition-colors disabled:opacity-40"
        >
          {dismissLabel}
        </button>
      </div>
    </div>
  );
}
