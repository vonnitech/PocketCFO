import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, TrendingUp, AlertCircle, User, Receipt, Plus, X, ArrowLeft } from 'lucide-react';
import { supabase } from '../core/supabase';
import { useStore } from '../store/useStore';
import { calculateTrueSafeSpend, calculateDaysUntilPayday, billKey } from '../core/math';
import { formatCurrency } from '../lib/utils';
import { CURRENCIES, guessCurrency } from '../lib/currency';
import { logProductEvent } from '../core/telemetry';
import { NotificationPrimer } from './NotificationPrimer';
import { getPrefs, initForUser, permissionState } from '../core/notifications';
import { COLOR_THEMES, findPreset } from '../core/themes';
import { useIsPro } from '../lib/pro';

// 'colour' is the free plan's one colour pick. It comes after the Safe-to-Spend
// number on purpose: personalising is a reward for finishing setup, and putting
// it first would stand between a new user and the number the app is for.
//
// 'notify' is the permission ask, and it is deliberately LAST. Asking before the
// user has seen a Safe-to-Spend figure is asking a stranger for their attention;
// asking after it is asking someone who has just been shown something useful.
// It is also skipped outright whenever the answer is already known, so nobody
// gets a step that cannot do anything.
type Step = 'basics' | 'bills' | 'colour' | 'notify';

interface DraftBill {
  id: string;
  name: string;
  amount: string;
  /**
   * Already paid this cycle.
   *
   * Signing up mid-month, rent and the car are usually already out of the
   * account. Reserving them anyway deducts the same money twice: once in
   * reality and once as a hold, which is why a new user could enter a healthy
   * balance and be handed a daily number hundreds below the truth.
   *
   * These bills still go into recurringBills, because they recur. They are
   * seeded into paidBillKeys so this cycle's queue skips them and next cycle
   * picks them up normally.
   */
  paid?: boolean;
}

export function OnboardingModal() {
  const hasCompletedOnboarding = useStore(s => s.hasCompletedOnboarding);
  const userId                 = useStore(s => s.userId);
  const setState               = useStore(s => s.setState);
  const setHorizon             = useStore(s => s.setHorizon);

  // Name is usually captured at signup and loaded into the store. Only ask for it
  // here if it's genuinely missing (e.g. OAuth signups), so we never ask twice.
  const existingFirstName = useStore(s => s.firstName);
  const askName = !existingFirstName?.trim();

  // "Re-run onboarding" in Settings reopens this for an account that already has
  // a setup. Finishing saves the balance, payday and the bill list wholesale, so
  // a re-run starts from what is saved: otherwise an untouched bills step would
  // replace every saved bill with none. A new account has nothing saved, so
  // every field starts blank exactly as before.
  const [saved] = useState(() => {
    const s = useStore.getState();
    const [y, m, d] = (s.nextPayday || '').slice(0, 10).split('-');
    const paidKeys = new Set(s.paidBillKeys || []);
    return {
      // An account that already finished setup. Its colours were picked then,
      // and changing them belongs to Settings, where the free-plan and Pro rules
      // apply, so a re-run skips the colour step instead of offering a re-pick.
      isRerun:  s.isConfigured,
      balance:  s.isConfigured ? String(s.liquidAssets ?? '') : '',
      takeHome: s.monthlyTakeHome > 0 ? String(s.monthlyTakeHome) : '',
      payDay:   d ? String(Number(d)) : '',
      payMonth: m ? String(Number(m)) : '',
      payYear:  y && y.length === 4 ? y : '',
      bills: (s.recurringBills || []).map(b => ({
        id: b.id, name: b.name, amount: String(b.amount), paid: paidKeys.has(billKey(b)),
      })) as DraftBill[],
      // Due day and paused are not edited here, so they are carried through.
      billsById: new Map((s.recurringBills || []).map(b => [b.id, b])),
    };
  });

  const [step,      setStep]      = useState<Step>('basics');
  const [firstName, setFirstName] = useState(() => existingFirstName || '');
  const [balance,   setBalance]   = useState(saved.balance);
  const [takeHome,  setTakeHome]  = useState(saved.takeHome);
  const [payDay,    setPayDay]    = useState(saved.payDay);
  const [payMonth,  setPayMonth]  = useState(saved.payMonth);
  const [payYear,   setPayYear]   = useState(saved.payYear);
  const [bills,     setBills]     = useState<DraftBill[]>(saved.bills);
  const [billName,   setBillName]   = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const pickTheme = useStore(s => s.pickTheme);
  const isPro     = useIsPro();
  // Starts on whatever is already applied, which for a new account is Original.
  const [colourPick, setColourPick] = useState(() => {
    const tc = useStore.getState().themeColors;
    return findPreset(tc?.primary, tc?.secondary)?.id ?? 'default';
  });
  // What was applied on arrival. Leaving the pick on it applies nothing, so a
  // re-run keeps a flipped pairing or custom Pro colours instead of resetting
  // them to the preset (or to Original, for custom colours with no preset).
  const [initialColourPick] = useState(colourPick);

  const numBalance  = parseFloat(balance) || 0;
  const numTakeHome = parseFloat(takeHome) || 0;
  const payday = (payDay && payMonth && payYear.length === 4)
    ? `${payYear}-${payMonth.padStart(2, '0')}-${payDay.padStart(2, '0')}`
    : '';
  const resolvedFirstName = firstName.trim() || existingFirstName.trim();
  // A payday that has already happened is not a next payday. It used to be
  // accepted, and the days-until-payday floor of 1 then spread the whole
  // balance over a single day, which produced a wildly inflated first number.
  const paydayInPast = (() => {
    if (!payday) return false;
    const [y, m, d] = payday.split('-').map(Number);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return new Date(y, m - 1, d).getTime() <= today.getTime();
  })();
  const canSubmit = numBalance >= 0 && numTakeHome > 0 && !!payday && !paydayInPast && !!userId && (!askName || !!resolvedFirstName);

  // Said under a disabled Next button, so a grey button always comes with the
  // reason it is grey. Lists only what is still missing, in form order.
  const missingHint = (() => {
    // Said in red right under the date instead, where the problem is.
    if (paydayInPast) return '';
    const missing: string[] = [];
    if (askName && !resolvedFirstName) missing.push('your first name');
    if (balance.trim() === '') missing.push('your bank balance');
    if (numTakeHome <= 0) missing.push('your take-home pay');
    if (!payday) missing.push('your next payday');
    if (missing.length === 0) return '';
    const list = missing.length === 1
      ? missing[0]
      : missing.slice(0, -1).join(', ') + ' and ' + missing[missing.length - 1];
    return 'Add ' + list + ' to continue.';
  })();

  const currency    = useStore(s => s.currency);
  const setCurrency = useStore(s => s.setCurrency);

  const parsedBills = useMemo(
    () => bills
      .map(b => ({ id: b.id, name: b.name.trim(), amount: parseFloat(b.amount) || 0, paid: !!b.paid }))
      .filter(b => b.amount > 0 && b.name),
    [bills],
  );
  // Only unpaid bills are held back. The full total is still shown, so the user
  // can see what was and was not reserved.
  const billsTotal = parsedBills.reduce((s, b) => s + (b.paid ? 0 : b.amount), 0);
  const billsAllTotal = parsedBills.reduce((s, b) => s + b.amount, 0);

  // Preview runs the same function the store uses to set safeSpendLimit, seeded
  // with the values this form is about to save. That keeps the number on screen
  // identical to the one the dashboard shows a second later, instead of a
  // simplified estimate that would quietly disagree with it.
  const daysUntilPayday = payday ? calculateDaysUntilPayday(payday) : 0;

  // Mirrors what setHorizon stores, field for field. Bills ticked as paid are
  // out of the cash already, so they leave upcomingBills, but they still recur
  // every month, so they stay in fixedBills, which feeds the monthly budget.
  // The preview used to drop paid bills from both, which made the setup number
  // higher than the dashboard showed a second later (720 against 503 with rent
  // ticked off). calculateTrueSafeSpend is the same function the dashboard hero
  // uses, so tier and pacing are applied here too.
  const previewSafeSpend = useMemo(() => {
    if (!canSubmit) return 0;
    return calculateTrueSafeSpend({
      ...(useStore.getState() as any),
      liquidAssets:    numBalance,
      nextPayday:      payday,
      upcomingBills:   billsTotal,
      fixedBills:      billsAllTotal,
      fixedBurn:       billsAllTotal,
      monthlyTakeHome: numTakeHome,
      hardDailyCap:    0,
    });
  }, [canSubmit, numBalance, numTakeHome, payday, billsTotal, billsAllTotal]);

  // The figure is the lower of a pay-based and a balance-based daily amount.
  // With a large balance and a smaller pay it can look as if the balance was
  // ignored, so the preview names which one set the number.
  const cashDaily = daysUntilPayday > 0 ? Math.max(0, numBalance - billsTotal) / daysUntilPayday : 0;
  const limitedByPay = previewSafeSpend > 0 && previewSafeSpend < cashDaily - 0.005;

  // Decided once, on mount, so the flow cannot grow or lose a step underneath
  // the user. There is nothing to ask if the browser has no support, if the
  // answer is already granted or denied (a denial cannot be re-prompted from
  // script), or if this account has been asked on this device before.
  const [askNotifications] = useState(() => {
    initForUser(useStore.getState().userId);
    return permissionState() === 'default' && getPrefs().primer === 'unasked';
  });
  const colourSteps = saved.isRerun ? 0 : 1;
  const totalSteps = 2 + colourSteps + (askNotifications ? 1 : 0);
  const stepNumber = step === 'basics' ? 1 : step === 'bills' ? 2 : step === 'colour' ? 3 : 3 + colourSteps;

  const startedRef   = useRef(false);
  const previewedRef = useRef(false);

  useEffect(() => {
    if (hasCompletedOnboarding || startedRef.current) return;
    startedRef.current = true;
    logProductEvent({ type: 'onboarding_started' });
  }, [hasCompletedOnboarding]);

  // Every new profile starts on the database default, USD, so someone in
  // Johannesburg saw dollar signs until they found the setting. Guess from the
  // device once, at the start of setup, and only while the account is still on
  // that untouched default. The picker on the first step can override it.
  const currencyGuessedRef = useRef(false);
  useEffect(() => {
    if (hasCompletedOnboarding || currencyGuessedRef.current || !userId) return;
    currencyGuessedRef.current = true;
    if (currency !== 'USD') return;
    const guess = guessCurrency();
    if (guess !== 'USD') void setCurrency(guess);
  }, [hasCompletedOnboarding, userId, currency, setCurrency]);

  useEffect(() => {
    if (existingFirstName.trim() && !firstName.trim()) {
      setFirstName(existingFirstName);
    }
  }, [existingFirstName, firstName]);

  // The first time a real number is on screen is the moment the product has
  // proved itself, so it is logged separately from finishing setup.
  useEffect(() => {
    if (step !== 'bills' || previewedRef.current || previewSafeSpend <= 0) return;
    previewedRef.current = true;
    logProductEvent({
      type: 'safe_spend_previewed',
      safeSpend: previewSafeSpend,
      daysUntilPayday,
      billsReserved: billsTotal,
    });
  }, [step, previewSafeSpend, daysUntilPayday, billsTotal]);

  if (hasCompletedOnboarding) return null;

  const daysInMonth = (month: string, year: string): number => {
    if (!month) return 31;
    return new Date(parseInt(year) || new Date().getFullYear(), parseInt(month), 0).getDate();
  };

  const addBill = () => {
    const amount = parseFloat(billAmount) || 0;
    if (!billName.trim() || amount <= 0) return;
    setBills(prev => [...prev, { id: crypto.randomUUID(), name: billName.trim(), amount: billAmount }]);
    setBillName('');
    setBillAmount('');
  };

  const removeBill = (id: string) => setBills(prev => prev.filter(b => b.id !== id));

  const togglePaid = (id: string) =>
    setBills(prev => prev.map(b => (b.id === id ? { ...b, paid: !b.paid } : b)));

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    logProductEvent({ type: 'onboarding_step', step: 'basics' });
    setStep('bills');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError('');

    logProductEvent({ type: 'onboarding_step', step: 'bills', billCount: parsedBills.length });

    const { error: dbError } = await (supabase.from('profiles') as any).upsert({
      id:                       userId,
      first_name:               resolvedFirstName || null,
      liquid_assets:            numBalance,
      monthly_take_home:        numTakeHome,
      next_payday:              payday,
      is_configured:            true,
      has_completed_onboarding: true,
    }, { onConflict: 'id' });

    if (dbError) {
      console.error('[onboarding] profile upsert failed', dbError);
      setError(dbError.message || 'Could not save your details. Please try again.');
      setLoading(false);
      return;
    }

    // `hasCompletedOnboarding` is deliberately NOT set here: the colour step
    // (and possibly the notification ask) still follows, and flipping it
    // unmounts this modal (see the guard at the top of the component). The
    // profile row is already marked complete, so abandoning a later step costs
    // the user nothing but that step.
    setState({
      firstName:               resolvedFirstName,
      monthlyTakeHome:         numTakeHome,
      isConfigured:            true,
    });
    // Properly computes safeSpendLimit, bill queue, and all derived values.
    // Bills collected on step 2 are passed straight through, so the very first
    // Safe-to-Spend figure already reserves the cash to cover them.
    // Must land before setHorizon: it reads paidBillKeys off the store and
    // derives this cycle's queue as recurringBills minus those keys. Safe here
    // because there is no stored payday yet, so setHorizon does not treat this
    // as a new cycle and does not clear them.
    setState({
      paidBillKeys: parsedBills
        .filter(b => b.paid)
        .map(b => billKey({ name: b.name, amount: b.amount })),
    });

    // Deferred: the colour step (and maybe the reminders ask) still has to show.
    // Without this, setHorizon marks onboarding complete locally, the modal
    // unmounts and both steps are silently skipped. finishOnboarding sets it.
    // The daily cap is left undefined so a re-run keeps the saved one (a new
    // account's is 0 either way), and saved bills keep the fields this form
    // does not show.
    setHorizon(
      numBalance, payday, 0, undefined,
      parsedBills.map(b => ({ ...saved.billsById.get(b.id), ...b })),
      { deferOnboardingComplete: true },
    );

    logProductEvent({
      type: 'activation_completed',
      safeSpend: previewSafeSpend,
      daysUntilPayday,
      billsReserved: billsTotal,
      billCount: parsedBills.length,
    });

    setLoading(false);
    if (!saved.isRerun) setStep('colour');
    else if (askNotifications) setStep('notify');
    else finishOnboarding();
  };

  // Live preview only. The store, the profile row and the free pick are not
  // touched until the user confirms.
  const previewColour = (themeId: string) => {
    const preset = COLOR_THEMES.find(t => t.id === themeId);
    if (!preset) return;
    setColourPick(themeId);
    document.documentElement.style.setProperty('--color-action-primary', preset.primary);
    document.documentElement.style.setProperty('--color-action-capture', preset.capture);
  };

  const handleColour = async (e: React.FormEvent) => {
    e.preventDefault();
    if (colourPick === initialColourPick) {
      if (askNotifications) setStep('notify');
      else finishOnboarding();
      return;
    }
    setLoading(true);
    // Choosing Original spends nothing: the pick stays open for later, in
    // Settings. A new account has no pick yet, so any other preset becomes it.
    const outcome = await pickTheme(colourPick, { isPro, context: 'onboarding' });
    if (outcome.kind !== 'apply') {
      // Only reachable for an account that already used its pick and swap
      // before finishing setup. Put back what it is entitled to and move on.
      const tc = useStore.getState().themeColors;
      if (tc?.primary) document.documentElement.style.setProperty('--color-action-primary', tc.primary);
      if (tc?.secondary) document.documentElement.style.setProperty('--color-action-capture', tc.secondary);
    }
    setLoading(false);
    if (askNotifications) setStep('notify');
    else finishOnboarding();
  };

  // Both answers to the primer land here. Declining is a complete, valid way to
  // finish setup, so it is not treated as a skip or held against the user.
  const finishOnboarding = () => {
    setState({ hasCompletedOnboarding: true });
  };

  const inputClass =
    'w-full bg-transparent border-4 border-black rounded-2xl px-4 py-3 pl-10 font-mono font-bold text-sm text-text-main outline-none placeholder:text-text-muted focus:bg-input transition-colors';

  const plainInputClass = inputClass.replace('pl-10', 'pl-4');

  const selectClass =
    'w-full bg-transparent border-4 border-black rounded-2xl px-3 py-3 font-mono font-bold text-sm text-text-main outline-none focus:bg-input transition-colors cursor-pointer';

  const submitClass =
    'w-full h-14 bg-action-primary border-4 border-black rounded-2xl text-primary-contrast font-black uppercase text-sm tracking-widest flex items-center justify-center gap-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]';

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4 py-6 overflow-y-auto">
      <motion.div
        className="w-full max-w-sm my-auto"
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <form
          onSubmit={
            step === 'basics' ? handleContinue
            : step === 'bills' ? handleSubmit
            : step === 'colour' ? handleColour
            : (e: React.FormEvent) => e.preventDefault()
          }
          className="bg-surface border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4 overflow-hidden"
        >
          {/* Title + step counter */}
          <div className="overflow-hidden">
            <div className="flex items-baseline justify-between gap-2">
              <h1 className="text-2xl font-black uppercase tracking-tighter italic text-text-main leading-tight truncate">
                {step === 'basics' ? 'Set up your account'
                  : step === 'bills' ? 'Your bills'
                  : step === 'colour' ? 'Make it yours'
                  : "You're all set"}
              </h1>
              <span className="text-[10px] font-black uppercase tracking-widest text-text-muted shrink-0">
                {stepNumber}/{totalSteps}
              </span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-1">
              {step === 'basics'
                ? 'You can update these any time in Settings.'
                : step === 'bills'
                  ? "Bills due before your next payday. Add them so they are committed before today's amount is cleared."
                  : step === 'colour'
                    ? 'Pick one colour pairing to keep for free.'
                    : 'One last thing, and it is optional.'}
            </p>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {step === 'basics' ? (
              <motion.div
                key="basics"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                {/* First Name - only shown if not already captured at signup */}
                {askName && (
                  <div className="overflow-hidden">
                    <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-1.5">
                      Your First Name
                    </label>
                    <div className="relative">
                      <User size={14} strokeWidth={2.5}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                      <input
                        type="text"
                        autoComplete="given-name"
                        placeholder="e.g. Alex"
                        autoFocus
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}

                {/* Current Bank Balance */}
                <div className="overflow-hidden">
                  <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-1.5">
                    Current Bank Balance
                  </label>
                  <div className="relative">
                    <Wallet size={14} strokeWidth={2.5}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      required
                      autoFocus={!askName}
                      value={balance}
                      onChange={e => setBalance(e.target.value)}
                      onFocus={e => e.target.select()}
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Monthly Take-Home Pay */}
                <div className="overflow-hidden">
                  <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-1.5">
                    Monthly Take-Home Pay
                  </label>
                  <div className="relative">
                    <TrendingUp size={14} strokeWidth={2.5}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      placeholder="0.00"
                      required
                      value={takeHome}
                      onChange={e => setTakeHome(e.target.value)}
                      onFocus={e => e.target.select()}
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Next Payday */}
                <div className="overflow-hidden">
                  <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-1.5">
                    Next Payday
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <select title="Day" value={payDay} onChange={e => setPayDay(e.target.value)} className={selectClass}>
                      <option value="">Day</option>
                      {Array.from({ length: daysInMonth(payMonth, payYear) }, (_, i) => (
                        <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
                      ))}
                    </select>
                    <select title="Month" value={payMonth} onChange={e => {
                      setPayMonth(e.target.value);
                      const max = daysInMonth(e.target.value, payYear);
                      if (parseInt(payDay) > max) setPayDay(String(max));
                    }} className={selectClass}>
                      <option value="">Month</option>
                      {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                        <option key={i} value={String(i + 1)}>{m}</option>
                      ))}
                    </select>
                    <select title="Year" value={payYear} onChange={e => setPayYear(e.target.value)} className={selectClass}>
                      <option value="">Year</option>
                      {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() + i).map(y => (
                        <option key={y} value={String(y)}>{y}</option>
                      ))}
                    </select>
                  </div>
                  {paydayInPast && (
                    <p className="mt-1.5 text-[10px] font-black uppercase tracking-wide text-action-bleed">
                      That date has passed. Pick your next payday.
                    </p>
                  )}
                </div>

                {/* Currency. Pre-set from the device; shown so a wrong guess
                    is one tap to fix rather than a hunt through Settings. */}
                <div className="flex items-center justify-between gap-3 overflow-hidden">
                  <span className="text-[11px] font-black uppercase tracking-widest text-text-muted shrink-0">
                    Currency
                  </span>
                  <select
                    title="Currency"
                    value={currency}
                    onChange={e => void setCurrency(e.target.value)}
                    className="min-w-0 max-w-[65%] bg-transparent border-2 border-border rounded-xl px-2 py-1.5 font-mono font-bold text-xs text-text-main outline-none focus:bg-input cursor-pointer"
                  >
                    {CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>{c.code} · {c.name}</option>
                    ))}
                  </select>
                </div>
              </motion.div>
            ) : step === 'bills' ? (
              <motion.div
                key="bills"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                {/* Bills added so far */}
                {parsedBills.length > 0 && (
                  <ul className="border-4 border-black rounded-2xl divide-y-2 divide-black overflow-hidden">
                    {parsedBills.map(b => (
                      <li key={b.id} className={`flex items-center gap-2 px-3 py-2.5 ${b.paid ? 'bg-input' : ''}`}>
                        <Receipt size={13} strokeWidth={2.5} className="text-text-muted shrink-0" />
                        <span className={`flex-1 min-w-0 truncate text-[11px] font-black uppercase tracking-wide ${b.paid ? 'text-text-muted line-through' : 'text-text-main'}`}>
                          {b.name}
                        </span>
                        {/* Amount before the Paid toggle, not after it. With the
                            amount last, a longer figure (R 6 500,00 against
                            R 399,00) pushed each row's toggle to a different
                            spot, so the column of Paid buttons zig-zagged. */}
                        <span className={`font-mono font-bold text-xs shrink-0 tabular-nums text-right ${b.paid ? 'text-text-muted line-through' : 'text-text-main'}`}>
                          {formatCurrency(b.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePaid(b.id)}
                          aria-pressed={!!b.paid}
                          className={`shrink-0 w-[4.75rem] py-1 border-2 rounded-full text-[9px] font-black uppercase tracking-wider text-center transition-all ${
                            b.paid
                              ? 'bg-action-capture border-black text-capture-contrast'
                              : 'border-border text-text-muted hover:border-black hover:text-text-main'
                          }`}
                        >
                          {/* A bare "Paid" read as a status, so every bill looked
                              paid. The off state now names the action. Fixed
                              width so both states line up. */}
                          {b.paid ? 'Paid' : 'Mark paid'}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeBill(b.id)}
                          aria-label={'Remove ' + b.name}
                          className="shrink-0 text-text-muted hover:text-action-bleed transition-colors"
                        >
                          <X size={14} strokeWidth={3} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Add a bill */}
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <div className="space-y-2 min-w-0">
                    <input
                      type="text"
                      placeholder="Bill name, e.g. Rent"
                      autoFocus
                      value={billName}
                      onChange={e => setBillName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addBill(); } }}
                      className={plainInputClass}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={billAmount}
                      onChange={e => setBillAmount(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addBill(); } }}
                      onFocus={e => e.target.select()}
                      className={plainInputClass}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addBill}
                    disabled={!billName.trim() || (parseFloat(billAmount) || 0) <= 0}
                    aria-label="Add bill"
                    className="w-14 self-stretch bg-action-primary border-4 border-black rounded-2xl flex items-center justify-center text-primary-contrast disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                  >
                    <Plus size={20} strokeWidth={3} />
                  </button>
                </div>

                {/* Safe-to-Spend preview */}
                <div className="bg-action-primary border-4 border-black rounded-2xl px-4 py-3 overflow-hidden">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary-contrast/50">
                    Cleared Today
                  </p>
                  <p className="text-4xl font-black italic tracking-tighter text-primary-contrast leading-tight mt-0.5 truncate">
                    {formatCurrency(previewSafeSpend)}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary-contrast/40 mt-1">
                    {parsedBills.length === 0
                      ? 'No bills added yet, so nothing is held back'
                      : billsAllTotal > billsTotal
                        // Names both figures. Without it, entering 2,100 of bills
                        // and seeing only part of it held back looks like a
                        // miscalculation rather than the paid ones being skipped.
                        ? 'Holding back ' + formatCurrency(billsTotal) + ' · ' + formatCurrency(billsAllTotal - billsTotal) + ' already paid'
                        : 'After holding back ' + formatCurrency(billsTotal) + ' in bills'}
                  </p>
                  {previewSafeSpend > 0 && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mt-1">
                      {limitedByPay
                        ? 'Set by your monthly pay. Your balance covers more, and the rest stays put.'
                        : 'Set by your balance until payday.'}
                    </p>
                  )}
                </div>
              </motion.div>
            ) : step === 'colour' ? (
              <motion.div
                key="colour"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.18 }}
                className="space-y-3"
              >
                {/* Tapping previews live on the app behind the modal; nothing
                    is saved until the button below is pressed. */}
                {/* The list scrolls. The fade at the bottom edge says there is
                    more below; without it the grid looked like the full set. */}
                <div className="relative">
                <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1 -mr-1 pt-1 pb-6">
                  {COLOR_THEMES.map(t => {
                    const selected = t.id === colourPick;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => previewColour(t.id)}
                        aria-pressed={selected}
                        className={`relative swatch-${t.id} flex flex-col items-center gap-1 p-2 rounded-xl border-4 transition-all ${selected ? 'border-black shadow-brutal-sm bg-input' : 'border-transparent hover:border-border'}`}
                      >
                        <div className="flex gap-0.5">
                          <div className="swatch-dot-primary w-4 h-4 rounded-full border-2 border-black/30" />
                          <div className="swatch-dot-capture w-4 h-4 rounded-full border-2 border-black/30" />
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-wide leading-tight text-center text-text-muted">
                          {t.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-surface to-transparent" />
                </div>
                <p className="text-[11px] font-bold text-text-muted leading-snug">
                  Scroll for more pairings. Original is always yours too, and you can swap your pick once in Settings. Pro unlocks every pairing.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="notify"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                {/* The number is repeated here on purpose. The ask lands better
                    next to the thing it protects than next to a form. */}
                <div className="bg-action-capture border-4 border-black rounded-2xl px-4 py-3 overflow-hidden">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-capture-contrast/60">
                    Cleared Today
                  </p>
                  <p className="text-3xl font-black italic tracking-tighter text-capture-contrast leading-tight mt-0.5 truncate">
                    {formatCurrency(previewSafeSpend)}
                  </p>
                </div>

                <NotificationPrimer
                  onDone={finishOnboarding}
                  headline="Want pay-cycle reminders?"
                  subline="We can tell you when a bill is about to land, when your pay arrives, and when spending goes past what's cleared."
                  dismissLabel="No thanks, take me in"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-action-bleed/10 border-2 border-action-bleed rounded-2xl px-3 py-2.5 overflow-hidden">
              <AlertCircle size={13} strokeWidth={2.5} className="text-action-bleed shrink-0 mt-0.5" />
              <p className="text-[10px] font-black uppercase tracking-wide text-action-bleed leading-tight min-w-0">
                {error}
              </p>
            </div>
          )}

          {/* Submit. The notify step drives itself through the primer's own
              buttons, so the form's control is hidden there rather than
              competing with them. */}
          {step !== 'notify' && (
            <motion.button
              type="submit"
              disabled={loading || (step !== 'colour' && !canSubmit)}
              whileTap={{ scale: 0.97 }}
              className={submitClass}
            >
              {loading
                ? <span className="animate-pulse">Saving…</span>
                : step === 'basics' ? 'Next: Your Bills →'
                : step === 'bills' ? 'Get Started →'
                : colourPick === 'default' ? 'Keep Original →' : 'Make It Mine →'
              }
            </motion.button>
          )}

          {/* Why the button is grey. Without this a disabled Next gave no clue
              which field was holding it back. */}
          {(step === 'basics' || step === 'bills') && !loading && !canSubmit && missingHint && (
            <p role="status" className="text-center text-[10px] font-bold uppercase tracking-wide text-text-muted leading-snug -mt-1">
              {missingHint}
            </p>
          )}

          {step === 'bills' && (
            <button
              type="button"
              onClick={() => setStep('basics')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-main transition-colors disabled:opacity-40"
            >
              <ArrowLeft size={12} strokeWidth={3} />
              Back
            </button>
          )}
        </form>
      </motion.div>
    </div>
  );
}
