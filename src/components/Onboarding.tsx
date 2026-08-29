import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, TrendingUp, AlertCircle, User, Receipt, Plus, X, ArrowLeft } from 'lucide-react';
import { supabase } from '../core/supabase';
import { useStore } from '../store/useStore';
import { calculateRawSafeSpend, calculateDaysUntilPayday } from '../core/math';
import { formatCurrency } from '../lib/utils';
import { logProductEvent } from '../core/telemetry';

type Step = 'basics' | 'bills';

interface DraftBill {
  id: string;
  name: string;
  amount: string;
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

  const [step,      setStep]      = useState<Step>('basics');
  const [firstName, setFirstName] = useState(() => existingFirstName || '');
  const [balance,   setBalance]   = useState('');
  const [takeHome,  setTakeHome]  = useState('');
  const [payDay,    setPayDay]    = useState('');
  const [payMonth,  setPayMonth]  = useState('');
  const [payYear,   setPayYear]   = useState('');
  const [bills,     setBills]     = useState<DraftBill[]>([]);
  const [billName,   setBillName]   = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const numBalance  = parseFloat(balance) || 0;
  const numTakeHome = parseFloat(takeHome) || 0;
  const payday = (payDay && payMonth && payYear.length === 4)
    ? `${payYear}-${payMonth.padStart(2, '0')}-${payDay.padStart(2, '0')}`
    : '';
  const resolvedFirstName = firstName.trim() || existingFirstName.trim();
  const canSubmit = numBalance >= 0 && numTakeHome > 0 && !!payday && !!userId && (!askName || !!resolvedFirstName);

  const parsedBills = useMemo(
    () => bills
      .map(b => ({ id: b.id, name: b.name.trim(), amount: parseFloat(b.amount) || 0 }))
      .filter(b => b.amount > 0 && b.name),
    [bills],
  );
  const billsTotal = parsedBills.reduce((s, b) => s + b.amount, 0);

  // Preview runs the same function the store uses to set safeSpendLimit, seeded
  // with the values this form is about to save. That keeps the number on screen
  // identical to the one the dashboard shows a second later, instead of a
  // simplified estimate that would quietly disagree with it.
  const daysUntilPayday = payday ? calculateDaysUntilPayday(payday) : 0;

  const previewSafeSpend = useMemo(() => {
    if (!canSubmit) return 0;
    return calculateRawSafeSpend({
      ...(useStore.getState() as any),
      liquidAssets:    numBalance,
      nextPayday:      payday,
      upcomingBills:   billsTotal,
      fixedBills:      billsTotal,
      fixedBurn:       billsTotal,
      monthlyTakeHome: numTakeHome,
      hardDailyCap:    0,
    });
  }, [canSubmit, numBalance, numTakeHome, payday, billsTotal]);

  const startedRef   = useRef(false);
  const previewedRef = useRef(false);

  useEffect(() => {
    if (hasCompletedOnboarding || startedRef.current) return;
    startedRef.current = true;
    logProductEvent({ type: 'onboarding_started' });
  }, [hasCompletedOnboarding]);

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

    setState({
      firstName:               resolvedFirstName,
      monthlyTakeHome:         numTakeHome,
      isConfigured:            true,
      hasCompletedOnboarding:  true,
    });
    // Properly computes safeSpendLimit, bill queue, and all derived values.
    // Bills collected on step 2 are passed straight through, so the very first
    // Safe-to-Spend figure already reserves the cash to cover them.
    setHorizon(numBalance, payday, 0, 0, parsedBills);

    logProductEvent({
      type: 'activation_completed',
      safeSpend: previewSafeSpend,
      daysUntilPayday,
      billsReserved: billsTotal,
      billCount: parsedBills.length,
    });
  };

  const inputClass =
    'w-full bg-transparent border-4 border-black rounded-2xl px-4 py-3 pl-10 font-mono font-bold text-sm text-text-main outline-none placeholder:text-text-muted/40 focus:bg-input transition-colors';

  const plainInputClass = inputClass.replace('pl-10', 'pl-4');

  const selectClass =
    'w-full bg-transparent border-4 border-black rounded-2xl px-3 py-3 font-mono font-bold text-sm text-text-main outline-none focus:bg-input transition-colors cursor-pointer';

  const submitClass =
    'w-full h-14 bg-black border-4 border-black rounded-2xl text-action-primary font-black uppercase text-sm tracking-widest flex items-center justify-center gap-2 shadow-[3px_3px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[3px_3px_0px_0px_var(--color-action-primary)]';

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4 py-6 overflow-y-auto">
      <motion.div
        className="w-full max-w-sm my-auto"
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <form
          onSubmit={step === 'basics' ? handleContinue : handleSubmit}
          className="bg-surface border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4 overflow-hidden"
        >
          {/* Title + step counter */}
          <div className="overflow-hidden">
            <div className="flex items-baseline justify-between gap-2">
              <h1 className="text-2xl font-black uppercase tracking-tighter italic text-text-main leading-none truncate">
                {step === 'basics' ? 'Set Up Your Account' : 'Your Fixed Bills'}
              </h1>
              <span className="text-[10px] font-black uppercase tracking-widest text-text-muted shrink-0">
                {step === 'basics' ? '1/2' : '2/2'}
              </span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-1">
              {step === 'basics'
                ? 'You can update these any time in Settings.'
                : 'Bills due before your next payday. Add them so your daily number holds back enough to cover them.'}
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
                </div>
              </motion.div>
            ) : (
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
                      <li key={b.id} className="flex items-center gap-2 px-3 py-2.5">
                        <Receipt size={13} strokeWidth={2.5} className="text-text-muted shrink-0" />
                        <span className="flex-1 min-w-0 truncate text-[11px] font-black uppercase tracking-wide text-text-main">
                          {b.name}
                        </span>
                        <span className="font-mono font-bold text-xs text-text-main shrink-0">
                          {formatCurrency(b.amount)}
                        </span>
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
                    className="w-14 self-stretch bg-action-primary border-4 border-black rounded-2xl flex items-center justify-center text-black disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                  >
                    <Plus size={20} strokeWidth={3} />
                  </button>
                </div>

                {/* Safe-to-Spend preview */}
                <div className="bg-action-primary border-4 border-black rounded-2xl px-4 py-3 overflow-hidden">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black/50">
                    Your safe spend per day
                  </p>
                  <p className="text-4xl font-black italic tracking-tighter text-black leading-none mt-0.5 truncate">
                    {formatCurrency(previewSafeSpend)}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mt-1">
                    {parsedBills.length > 0
                      ? 'After holding back ' + formatCurrency(billsTotal) + ' in bills'
                      : 'No bills added yet, so nothing is held back'}
                  </p>
                </div>
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

          {/* Submit */}
          <motion.button
            type="submit"
            disabled={loading || !canSubmit}
            whileTap={{ scale: 0.97 }}
            className={submitClass}
          >
            {loading
              ? <span className="animate-pulse">Saving…</span>
              : step === 'basics' ? 'Next: Your Bills →' : 'Get Started →'
            }
          </motion.button>

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
