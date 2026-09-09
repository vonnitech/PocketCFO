import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, CheckCircle2, ArrowRightLeft, ShieldCheck, Zap } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { currencySymbol } from '../lib/currency';
import { useStore } from '../store/useStore';
import {
  calculateTrueSafeSpend,
  calculateDailySurplus,
  calculateDailyDrain,
  calculateTierLimit,
  calculateDangerProgress,
  SPEND_TIERS,
  toLocalDateKey,
} from '../core/math';

type Step = 'RAW_SPEND' | 'WORTH_IT_CHECK' | 'SUMMARY';

// How the day's unplanned spending felt in hindsight. Only 'SKIP' opens the
// offset module; the other two are acknowledgements and move straight to the
// summary.
type WorthIt = 'LOVED' | 'GOOD' | 'SKIP';

const WORTH_IT_OPTIONS: { id: WorthIt; label: string }[] = [
  { id: 'LOVED', label: 'Worth it' },
  { id: 'GOOD',  label: 'Neutral' },
  { id: 'SKIP',  label: 'Regret' },
];

const CATEGORIES = [
  { key: 'FOOD', label: 'Food' },
  { key: 'TRANSPORT', label: 'Transport' },
  { key: 'FUN', label: 'Fun' },
  { key: 'SHOPPING', label: 'Shopping' },
  { key: 'HEALTH', label: 'Health' },
  { key: 'HOME', label: 'Home' },
  { key: 'WORK', label: 'Work' },
  { key: 'OTHER', label: 'Other' },
];

const SPEND_LOG_EXCLUDED_CATEGORIES = new Set([
  'SAVINGS',
  'VAULT_DEPOSIT',
  'DEBT_PAYMENT',
  'BILL_PAYMENT',
  'SUBSCRIPTION_PAYMENT',
  'INCOME',
  'VAULT_TRANSFER',
  'VAULT_WITHDRAWAL',
  'PENALTY',
]);

export default function DailyLog() {
  // Full-store subscription is intentional here: calculateTrueSafeSpend(state)
  // below needs the complete AppState, so a narrowed selector would not help.
  const state = useStore();
  const { privacyMode, reconHistory, nextPayday, submitReconEntry, vaults, velocityConfig } = state;

  const [step, setStep] = useState<Step>('RAW_SPEND');
  const [rawSpend, setRawSpend] = useState('');
  const [worthIt, setWorthIt] = useState<WorthIt | null>(null);
  const [offsetInput, setOffsetInput] = useState('');
  // Held apart from offsetInput on purpose: the money only counts once Send is
  // pressed, so typing a figure and backing out costs nothing.
  const [offsetAmount, setOffsetAmount] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [catchUpCategory, setCatchUpCategory] = useState('');

  // Tier selection and its hold moved to /velocity, which is where the other
  // control over the daily number lives. Read-only here.
  const selectedTierId = state.tierLock.tierId;
  const activeTier = SPEND_TIERS.find(t => t.id === selectedTierId) ?? SPEND_TIERS[1];

  const todayKey = toLocalDateKey(new Date());
  const todayLabel = new Date().toLocaleDateString();
  const alreadyDoneToday = reconHistory.some(entry => toLocalDateKey(entry.date) === todayKey);

  const safeSpendLimit = useMemo(() => calculateTrueSafeSpend(state), [state]);
  const tierLimit = useMemo(() => calculateTierLimit(safeSpendLimit, activeTier.multiplier), [safeSpendLimit, activeTier]);

  const transactionsToday = useMemo(() => {
    return state.transactions.filter(t => toLocalDateKey(t.date) === todayKey);
  }, [state.transactions, todayKey]);

  const recordedDailyDrain = useMemo(() => calculateDailyDrain(transactionsToday), [transactionsToday]);
  const spendLoggedToday = useMemo(() => {
    return transactionsToday
      .filter(tx => !SPEND_LOG_EXCLUDED_CATEGORIES.has(tx.category))
      .reduce((acc, tx) => acc + tx.amount, 0);
  }, [transactionsToday]);
  const capturedToday = useMemo(() => {
    return transactionsToday
      .reduce((acc, tx) => acc + tx.flipAmount, 0);
  }, [transactionsToday]);
  const totalCashMovedToday = spendLoggedToday + capturedToday;
  const displayRawSpend = rawSpend === '' ? recordedDailyDrain.toString() : rawSpend;
  const spendAmount = parseFloat(displayRawSpend || '0');
  const catchUpSpend = Math.max(0, spendAmount - recordedDailyDrain);
  const hasValidReviewedSpend = Number.isFinite(spendAmount) && spendAmount >= 0;
  const hasVault = vaults.length > 0;

  // Balancing out moves cash into savings, so unlike the old impulse tax it is
  // not a drain on the day. Surplus and the danger meter track spending only.
  const totalDrain = spendAmount;

  // Velocity surplus routing. Only SWEEP_VAULT collapses the choice, because it
  // is the only route where submitReconEntry overrides what the buttons say: it
  // forces a stash regardless of which one is pressed, so offering "Roll Over"
  // would be a lie. Both ROLL_* routes leave the cash liquid, which is what the
  // existing Roll Over button already does, so the Stash option stays available
  // and only the label changes.
  //
  // Deliberately not collapsing on ROLL_TOMORROW: that is the default value for
  // every account that has never opened Velocity, so treating it as an explicit
  // choice would silently remove Stash It from users who never asked for that.
  const sweepVault = velocityConfig?.surplusRouting === 'SWEEP_VAULT' && velocityConfig.sweepTargetVaultId
    ? vaults.find(v => v.id === velocityConfig.sweepTargetVaultId) ?? null
    : null;
  const autoSweep = velocityConfig?.surplusRouting === 'SWEEP_VAULT' && !!sweepVault;
  const rollLabel = velocityConfig?.surplusRouting === 'ROLL_WEEKEND'
    ? 'Roll to Weekend Runway'
    : 'Roll to Tomorrow';

  const parsedOffset = parseFloat(offsetInput || '0');
  const canOffset = hasVault && Number.isFinite(parsedOffset) && parsedOffset > 0;
  // vaults[0] is where submitReconEntry credits the money, so name it rather
  // than promising a vault the user may not have set as their first one.
  const offsetDestination = vaults[0]?.name ?? '';
  const surplus = useMemo(() => calculateDailySurplus(safeSpendLimit, totalDrain), [safeSpendLimit, totalDrain]);
  const dangerProgress = useMemo(() => calculateDangerProgress(totalDrain, tierLimit), [totalDrain, tierLimit]);
  const needsCatchUpCategory = catchUpSpend > 0.005;
  const canCloseReview = !needsCatchUpCategory || !!catchUpCategory;
  const effectiveLimit = tierLimit > 0 ? tierLimit : safeSpendLimit;
  const remaining = effectiveLimit - recordedDailyDrain;
  const pulsePercent = effectiveLimit > 0 ? Math.min(100, (recordedDailyDrain / effectiveLimit) * 100) : 0;
  const pulseColor = recordedDailyDrain > effectiveLimit ? 'bg-action-bleed' : pulsePercent > 80 ? 'bg-action-primary' : 'bg-action-capture';
  const pulseStatus = recordedDailyDrain > effectiveLimit ? 'Over' : pulsePercent > 80 ? 'Near Limit' : 'On Track';
  const pulseStatusColor = recordedDailyDrain > effectiveLimit ? 'bg-action-bleed text-white' : pulsePercent > 80 ? 'bg-action-primary text-black' : 'bg-action-capture text-capture-contrast';

  const pastDays = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (i + 1));
      const key = toLocalDateKey(d);
      const label = i === 0
        ? 'Yesterday'
        : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      return { key, label, entry: reconHistory.find(e => toLocalDateKey(e.date) === key) };
    });
  }, [reconHistory]);

  const dangerColor =
    dangerProgress < 60 ? 'bg-action-capture' :
    dangerProgress < 85 ? 'bg-action-primary' :
    'bg-action-bleed';

const chooseWorthIt = (id: WorthIt) => {
    setWorthIt(id);
    if (id === 'SKIP') return;
    setOffsetInput('');
    setOffsetAmount(0);
    setStep('SUMMARY');
  };

  const applyOffset = () => {
    if (!canOffset) return;
    setOffsetAmount(parsedOffset);
    setStep('SUMMARY');
  };

  const handleAction = (action: 'roll' | 'stash') => {
    if (action === 'stash' && !hasVault) return;
    submitReconEntry({
      rawSpend:       parseFloat(displayRawSpend),
      action,
      impulseId:      null,
      impulseSpend:   0,
      // Reuses the store's existing tax_amount slot, which already debits liquid
      // assets and credits the vault. Same cash movement, no penalty framing,
      // and no database migration.
      taxAmount:      offsetAmount,
      surplus,
      catchUpCategory: needsCatchUpCategory ? catchUpCategory : undefined,
      tierId:         selectedTierId,
      tierMultiplier: activeTier.multiplier,
      tierLimit,
    });
    setCompleted(true);
  };


  if (alreadyDoneToday || completed) {
    const todayEntry = reconHistory.find(e => toLocalDateKey(e.date) === todayKey);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter leading-tight italic text-text-main">Daily Review</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">Review complete · {todayLabel}</p>
        </div>

        {/* Today's Pulse — completed view */}
        {nextPayday && safeSpendLimit > 0 && (
          <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Today's Pulse</p>
              <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border-2 border-black ${pulseStatusColor}`}>
                {pulseStatus}
              </span>
            </div>
            <div className="flex items-end gap-4 mb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-0.5">Daily Limit</p>
                <p className="text-2xl font-black italic tracking-tighter text-text-main tabular-nums">{formatCurrency(effectiveLimit, privacyMode)}</p>
              </div>
              <div className="flex-1 text-right">
                <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-0.5">Spend Logged Today</p>
                <p className="text-2xl font-black italic tracking-tighter text-text-main tabular-nums">{formatCurrency(spendLoggedToday, privacyMode)}</p>
              </div>
            </div>
            {capturedToday > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-input border-2 border-border rounded-2xl px-3 py-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-capture-readable">Captured</p>
                  <p className="text-sm font-black tabular-nums text-capture-readable">+{formatCurrency(capturedToday, privacyMode)}</p>
                </div>
                <div className="bg-input border-2 border-border rounded-2xl px-3 py-2 text-right">
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Total Cash Moved</p>
                  <p className="text-sm font-black tabular-nums text-text-main">{formatCurrency(totalCashMovedToday, privacyMode)}</p>
                </div>
              </div>
            )}
            <div className="h-3 bg-input border-2 border-border rounded-full overflow-hidden mb-1.5">
              <motion.div
                className={`h-full rounded-full ${pulseColor}`}
                initial={{ width: 0 }}
                animate={{ width: `${pulsePercent}%` }}
                transition={{ type: 'spring', stiffness: 200, damping: 30 }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
              <span className="text-text-muted">{formatCurrency(spendLoggedToday, privacyMode)} spend logged</span>
              <span className={remaining < 0 ? 'text-action-bleed font-black' : 'text-capture-readable font-black'}>
                {remaining < 0 ? `${formatCurrency(Math.abs(remaining), privacyMode)} over` : `${formatCurrency(remaining, privacyMode)} remaining`}
              </span>
            </div>
          </div>
        )}

        <div className="bg-surface border-4 border-action-capture rounded-3xl p-6 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-action-capture border-4 border-black flex items-center justify-center">
              <CheckCircle2 size={32} className="text-text-main" strokeWidth={3} />
            </div>
            <div>
              <h2 className="text-2xl font-black italic tracking-tighter uppercase text-text-main">Review Complete</h2>
              {todayEntry && (
                <div className={`inline-flex px-3 py-1 mt-1 ${SPEND_TIERS.find(t => t.id === todayEntry.tier)?.color || 'bg-gray-200'} border-[3px] border-black rounded-full text-[11px] font-black uppercase tracking-widest`}>
                  {todayEntry.tier} MODE · {(todayEntry.tierMultiplier * 100).toFixed(0)}%
                </div>
              )}
            </div>
          </div>

          {todayEntry && (
            <div className="space-y-3">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest border-b-2 border-border pb-2">
                <span className="text-text-muted">Tier Limit</span>
                <span className="text-text-main">{formatCurrency(todayEntry.tierLimit, privacyMode)}</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest border-b-2 border-border pb-2">
                <span className="text-text-muted">Reviewed Spend</span>
                <span className="text-text-main">{formatCurrency(todayEntry.rawSpend, privacyMode)}</span>
              </div>
              {todayEntry.taxAmount > 0 && (
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest border-b-2 border-border pb-2 gap-2">
                  <span className="text-text-muted">Captured → Vault</span>
                  <span className="text-capture-readable">+{formatCurrency(todayEntry.taxAmount, privacyMode)}</span>
                </div>
              )}
              {todayEntry.taxAmount > 0 && (
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest border-b-2 border-border pb-2">
                  <span className="text-text-muted">Total Cash Moved Today</span>
                  <span className="text-text-main">{formatCurrency(todayEntry.rawSpend + todayEntry.taxAmount, privacyMode)}</span>
                </div>
              )}
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                <span className="text-text-muted">Surplus {todayEntry.action === 'stash' ? '→ Vault' : '→ Rolled Over'}</span>
                <span className="text-capture-readable">{formatCurrency(todayEntry.surplus, privacyMode)}</span>
              </div>
            </div>
          )}

        </div>

        {/* Past 6 days */}
        {pastDays.some(d => d.entry) && (
          <div className="bg-surface border-4 border-border rounded-3xl overflow-hidden shadow-[6px_6px_0px_0px_var(--shadow-color)]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted px-5 pt-4 pb-2">Recent Log History</p>
            <div className="divide-y-[3px] divide-black/5">
              {pastDays.map(day => (
                <div key={day.key} className="flex items-center gap-3 px-5 py-3">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${day.entry ? 'bg-action-capture' : 'bg-black/10'}`} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-text-main flex-1">{day.label}</span>
                  {day.entry ? (
                    <>
                      <div className={`px-2 py-0.5 rounded-full border-[2px] border-black text-[8px] font-black uppercase ${SPEND_TIERS.find(t => t.id === day.entry!.tier)?.color ?? 'bg-gray-100'}`}>
                        {day.entry.tier}
                      </div>
                      <span className="text-[10px] font-black tabular-nums text-text-main">{formatCurrency(day.entry.rawSpend, privacyMode)}</span>
                      <span className={`text-[10px] font-black tabular-nums ${day.entry.surplus > 0 ? 'text-capture-readable' : 'text-action-bleed'}`}>
                        {day.entry.surplus > 0 ? '+' : ''}{formatCurrency(day.entry.surplus, privacyMode)}
                      </span>
                    </>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Missed</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      <div>
        <h1 className="text-4xl font-black uppercase tracking-tighter leading-tight italic text-text-main">Daily Review</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">{todayLabel}</p>
      </div>

      {/* Today's Pulse — always visible in active flow */}
      {nextPayday && safeSpendLimit > 0 && (
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Today's Pulse</p>
            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border-2 border-black ${pulseStatusColor}`}>
              {pulseStatus}
            </span>
          </div>
            <div className="flex items-end gap-4 mb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-0.5">Daily Limit</p>
                <p className="text-2xl font-black italic tracking-tighter text-text-main tabular-nums">{formatCurrency(safeSpendLimit, privacyMode)}</p>
              </div>
              <div className="flex-1 text-right">
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-0.5">Spend Logged Today</p>
              <p className="text-2xl font-black italic tracking-tighter text-text-main tabular-nums">{formatCurrency(spendLoggedToday, privacyMode)}</p>
            </div>
          </div>
          <div className="h-3 bg-input border-2 border-border rounded-full overflow-hidden mb-1.5">
            <motion.div
              className={`h-full rounded-full ${pulseColor}`}
              initial={{ width: 0 }}
              animate={{ width: `${pulsePercent}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 30 }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
            <span className="text-text-muted">{formatCurrency(spendLoggedToday, privacyMode)} spend logged</span>
            <span className={remaining < 0 ? 'text-action-bleed font-black' : 'text-capture-readable font-black'}>
              {remaining < 0 ? `${formatCurrency(Math.abs(remaining), privacyMode)} over` : `${formatCurrency(remaining, privacyMode)} remaining`}
            </span>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">

        {/* ── STEP 1: RAW SPEND ── */}
        {step === 'RAW_SPEND' && (
          <motion.div key="raw-spend" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">

            {/* Spend Input + Today's Usage */}
            <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-4">
              <div className="inline-flex px-3 py-1 bg-black border-2 border-black rounded-full text-action-primary text-[10px] font-black tracking-widest uppercase">
                REVIEW TODAY'S SPENDING
              </div>

              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-3xl font-black text-text-muted pointer-events-none">{currencySymbol()}</span>
                <input
                  autoFocus
                  type="number"
                  min="0"
                  title="Reviewed Total Spent Today"
                  className="w-full bg-input border-4 border-black rounded-2xl p-5 pl-12 text-3xl font-black italic outline-none text-center focus:border-action-primary focus:bg-surface transition-colors text-text-main"
                  placeholder="0.00"
                  value={displayRawSpend}
                  onFocus={e => e.target.select()}
                  onChange={e => setRawSpend(e.target.value === '' || parseFloat(e.target.value) >= 0 ? e.target.value : '0')}
                />
              </div>
              {rawSpend === '' && recordedDailyDrain > 0 && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted text-center -mt-1">
                  Pre-filled from today's logged transactions · edit if needed
                </p>
              )}
              {catchUpSpend > 0.005 && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-capture-readable text-center -mt-1">
                  Adds {formatCurrency(catchUpSpend, privacyMode)} as a catch-up transaction
                </p>
              )}

              {/* Today's usage against the tier limit */}
              <div>
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-2">
                  <span className="text-text-muted">Today's Usage</span>
                  <span className={dangerProgress >= 100 ? 'text-action-bleed' : 'text-text-main'}>{dangerProgress.toFixed(0)}%</span>
                </div>
                <div className="h-5 bg-input border-4 border-black rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full ${dangerColor} border-r-[3px] border-black`}
                    animate={{ width: `${Math.min(100, dangerProgress)}%` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                </div>
                {dangerProgress >= 100 && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[10px] font-black uppercase tracking-widest text-action-bleed mt-2 flex items-center gap-1"
                  >
                    <Zap size={10} /> OVER TIER LIMIT
                  </motion.p>
                )}
              </div>

              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                disabled={!hasValidReviewedSpend}
                onClick={() => setStep('WORTH_IT_CHECK')}
                className="w-full h-14 border-4 border-black rounded-full bg-black text-action-primary font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-40"
              >
                Continue <ChevronRight size={20} strokeWidth={3} />
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 2: WORTH IT CHECK ── */}
        {step === 'WORTH_IT_CHECK' && (
          <motion.div key="worth-it" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-5">
              <div className="inline-flex px-3 py-1 bg-action-capture border-2 border-black rounded-full text-capture-contrast text-[10px] font-black tracking-widest uppercase">
                WORTH IT?
              </div>

              <h3 className="text-2xl font-black italic text-center uppercase tracking-tight text-text-main px-2 leading-tight">
                Any unplanned spending today? Was it worth it?
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {WORTH_IT_OPTIONS.map(opt => {
                  const active = worthIt === opt.id;
                  return (
                    <motion.button
                      key={opt.id}
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => chooseWorthIt(opt.id)}
                      className={`flex sm:flex-col items-center justify-center gap-2 sm:gap-1.5 h-16 sm:h-24 px-3 border-4 rounded-3xl font-black uppercase tracking-widest text-[11px] transition-all shadow-[4px_4px_0px_0px_var(--shadow-color)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 ${
                        active
                          ? 'border-black bg-black text-action-primary'
                          : 'border-border bg-surface text-text-main hover:border-black'
                      }`}
                    >
                      <span className="text-center leading-tight">{opt.label}</span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Offset — only for the spend they would take back */}
              {worthIt === 'SKIP' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3 border-t-4 border-border pt-5"
                >
                  <div>
                    <p className="text-lg font-black italic uppercase tracking-tight text-text-main leading-tight">
                      Offset this regret.
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1 leading-relaxed">
                      Capture cash to your vault.
                    </p>
                  </div>

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-text-muted pointer-events-none select-none text-2xl">
                      {currencySymbol()}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      title="Amount to capture to your vault"
                      placeholder="0.00"
                      value={offsetInput}
                      onChange={e => setOffsetInput(e.target.value)}
                      onFocus={e => e.target.select()}
                      className="w-full bg-input border-4 border-action-capture rounded-2xl py-4 pr-4 pl-11 text-3xl font-black italic outline-none text-center focus:bg-surface transition-colors text-text-main tabular-nums"
                    />
                  </div>

                  {hasVault ? (
                    <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted text-center">
                      Goes to {offsetDestination}
                    </p>
                  ) : (
                    <p className="text-[9px] font-black uppercase tracking-widest text-action-bleed text-center">
                      Set up a vault first to capture
                    </p>
                  )}

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    disabled={!canOffset}
                    onClick={applyOffset}
                    className="w-full h-14 border-4 border-black rounded-full bg-action-capture text-capture-contrast font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:translate-x-0 disabled:translate-y-0"
                  >
                    Capture to Vault <ChevronRight size={20} strokeWidth={3} />
                  </motion.button>

                  <button
                    type="button"
                    onClick={() => { setOffsetInput(''); setOffsetAmount(0); setStep('SUMMARY'); }}
                    className="w-full h-10 border-2 border-border rounded-2xl text-text-muted font-black uppercase tracking-widest text-[10px] hover:text-text-main hover:border-black transition-colors"
                  >
                    Not this time
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── STEP 3: SUMMARY ── */}
        {step === 'SUMMARY' && (
          <motion.div key="summary" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="bg-action-primary border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="inline-flex px-3 py-1 bg-black border-2 border-black rounded-full text-action-primary text-[10px] font-black tracking-widest uppercase">
                  DAILY SUMMARY
                </div>
                <div className={`inline-flex px-3 py-1 ${activeTier.color} border-2 border-black rounded-full ${activeTier.textColor} text-[10px] font-black uppercase tracking-widest`}>
                  {activeTier.label}
                </div>
              </div>

              {/* Danger meter recap */}
              <div>
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-2 text-black gap-2">
                  <span className="opacity-60 shrink-0">Tier Usage</span>
                  <span className="text-right tabular-nums">{dangerProgress.toFixed(0)}% of {formatCurrency(tierLimit, privacyMode)} limit</span>
                </div>
                <div className="h-3 bg-black/10 border-2 border-black rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full ${dangerColor} transition-all`}
                    animate={{ width: `${Math.min(100, dangerProgress)}%` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                </div>
              </div>

              {/* Numbers */}
              <div className="bg-surface border-4 border-border rounded-3xl p-4 space-y-2">
                <div className="flex justify-between items-center border-b-2 border-border pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Daily Budget</span>
                  <span className="font-black text-text-main">{formatCurrency(safeSpendLimit, privacyMode)}</span>
                </div>
                <div className="flex justify-between items-center border-b-2 border-border pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Reviewed Spend</span>
                  <span className="font-black text-text-main">-{formatCurrency(spendAmount, privacyMode)}</span>
                </div>
                {offsetAmount > 0 && (
                  <div className="flex justify-between items-center border-b-2 border-border pb-2 gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-capture-readable shrink-0">Captured</span>
                    <span className="font-black text-capture-readable tabular-nums text-right">
                      +{formatCurrency(offsetAmount, privacyMode)}
                      <span className="block text-[9px] font-bold uppercase tracking-widest text-text-muted">
                        to {offsetDestination || 'your vault'}
                      </span>
                    </span>
                  </div>
                )}
                {offsetAmount > 0 && (
                  <div className="flex justify-between items-center border-b-2 border-border pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Total Cash Moved Today</span>
                    <span className="font-black text-text-main">-{formatCurrency(spendAmount + offsetAmount, privacyMode)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 gap-2">
                  <span className="text-sm font-black italic uppercase text-text-main shrink-0">Surplus</span>
                  <span className={`text-2xl sm:text-3xl font-black italic tabular-nums text-right ${surplus >= 0 ? 'text-capture-readable' : 'text-action-bleed'}`}>
                    {formatCurrency(Math.abs(surplus), privacyMode)}
                    {' '}
                    <span className="text-base">{surplus >= 0 ? 'left' : 'over'}</span>
                  </span>
                </div>
              </div>

              {needsCatchUpCategory && (
                <div className="bg-surface border-4 border-border rounded-3xl p-4 space-y-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-main">
                      What category was the missing spend?
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1">
                      {formatCurrency(catchUpSpend, privacyMode)} will be added as a catch-up transaction
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setCatchUpCategory(cat.key)}
                        className={`shrink-0 px-3 py-1.5 border-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                          catchUpCategory === cat.key
                            ? 'bg-black text-action-primary border-black shadow-[2px_2px_0px_0px_var(--color-action-primary)]'
                            : 'bg-input border-border text-text-muted hover:border-black hover:text-text-main'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  {!catchUpCategory && (
                    <p className="text-[9px] font-black uppercase tracking-widest text-action-bleed">
                      Category required for missing spend
                    </p>
                  )}
                </div>
              )}

              {surplus > 0 && autoSweep ? (
                // Routing already decided in Velocity, so the review confirms
                // rather than asks.
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-center text-black/60">
                    Surplus sweeps automatically
                  </p>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    disabled={!canCloseReview}
                    onClick={() => handleAction('stash')}
                    className="w-full h-16 flex flex-col items-center justify-center gap-1 bg-black text-action-primary border-4 border-black rounded-3xl shadow-[4px_4px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[4px_4px_0px_0px_var(--color-action-primary)]"
                  >
                    <span className="font-black uppercase text-[11px] tracking-widest px-3 text-center leading-tight">
                      Sweep to {sweepVault?.name ?? 'Vault'}
                    </span>
                    <span className="text-[10px] font-bold text-action-primary/60 uppercase tracking-wide">
                      {formatCurrency(surplus, privacyMode)}
                    </span>
                  </motion.button>
                </div>
              ) : surplus > 0 ? (
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-center text-black/60">What to do with the surplus?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      disabled={!canCloseReview}
                      onClick={() => handleAction('roll')}
                      className="flex flex-col items-center gap-2 p-5 border-4 border-border rounded-3xl bg-surface text-text-main transition-all shadow-[4px_4px_0px_0px_var(--shadow-color)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-[4px_4px_0px_0px_var(--shadow-color)] disabled:translate-x-0 disabled:translate-y-0"
                    >
                      <ArrowRightLeft size={28} strokeWidth={3} />
                      <span className="font-black uppercase text-[10px] text-center leading-tight px-1">{rollLabel}</span>
                      <span className="text-[11px] font-bold text-text-muted uppercase">Limit auto-adjusts</span>
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      disabled={!canCloseReview || !hasVault}
                      onClick={() => handleAction('stash')}
                      className="flex flex-col items-center gap-2 p-5 bg-black text-action-primary border-4 border-black rounded-3xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] disabled:translate-x-0 disabled:translate-y-0"
                    >
                      <ShieldCheck size={28} strokeWidth={3} />
                      <span className="font-black uppercase text-[10px]">Stash It</span>
                      <span className="text-[11px] font-black text-action-primary/60 uppercase">
                        {hasVault ? 'Move to vault' : 'Create a vault first'}
                      </span>
                    </motion.button>
                  </div>
                </div>
              ) : (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  disabled={!canCloseReview}
                  onClick={() => handleAction('roll')}
                  className="w-full h-14 border-4 border-black rounded-full bg-black text-action-primary font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] disabled:translate-x-0 disabled:translate-y-0"
                >
                  Log & Close Day
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
