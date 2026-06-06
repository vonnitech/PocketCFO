import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, CheckCircle2, ArrowRightLeft, ShieldCheck, Zap, AlertCircle, Lock } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { useStore, Impulse } from '../store/useStore';
import { BottomSheet } from '../components/BottomSheet';
import {
  calculateTrueSafeSpend,
  calculateImpulsePenalty,
  calculateDailySurplus,
  calculateDailyDrain,
  calculateTierLimit,
  calculateDangerProgress,
  SPEND_TIERS,
  SpendTierId,
  toLocalDateKey,
} from '../core/math';

type Step = 'RAW_SPEND' | 'HABIT_CHECK' | 'SELECT_HABIT' | 'SUMMARY';

const TIER_LOCK_KEY = 'pocket-cfo-tier-lock-v1';
const BREAK_COUNT_KEY = 'pocket-cfo-tier-breaks-v1';

interface TierLock { tierId: SpendTierId; lockedUntil: string; }

function getBreakCount(): number {
  try { return parseInt(localStorage.getItem(BREAK_COUNT_KEY) ?? '0', 10) || 0; }
  catch { return 0; }
}

function getTierLock(): TierLock | null {
  try {
    const raw = localStorage.getItem(TIER_LOCK_KEY);
    if (!raw) return null;
    const lock: TierLock = JSON.parse(raw);
    if (new Date(lock.lockedUntil) < new Date()) {
      localStorage.removeItem(TIER_LOCK_KEY);
      return null;
    }
    return lock;
  } catch { return null; }
}

export default function Recon() {
  const state = useStore();
  const { privacyMode, impulses, reconHistory, setState, nextPayday, submitReconEntry } = state;

  const [step, setStep] = useState<Step>('RAW_SPEND');
  const [rawSpend, setRawSpend] = useState('');
  const [selectedImpulseId, setSelectedImpulseId] = useState<string | null>(null);
  const [impulseSpend, setImpulseSpend] = useState('');
  const [completed, setCompleted] = useState(false);
  const [isAddingImpulse, setIsAddingImpulse] = useState(false);
  const [newImpulseName, setNewImpulseName] = useState('');
  const [tierLock, setTierLock] = useState<TierLock | null>(() => getTierLock());
  const isLocked = tierLock !== null;
  const [_selectedTierId, setSelectedTierId] = useState<SpendTierId>(() => getTierLock()?.tierId ?? 'TIGHT');
  const selectedTierId: SpendTierId = tierLock?.tierId ?? _selectedTierId;
  const [showConfession, setShowConfession] = useState(false);
  const [breakCount, setBreakCount] = useState(() => getBreakCount());

  const daysLeft = tierLock
    ? Math.max(0, Math.ceil((new Date(tierLock.lockedUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const lockTier = (days: number) => {
    const lockedUntil = new Date(Date.now() + days * 86400000).toISOString();
    const lock: TierLock = { tierId: selectedTierId, lockedUntil };
    localStorage.setItem(TIER_LOCK_KEY, JSON.stringify(lock));
    setTierLock(lock);
  };

  const confirmUnlock = () => {
    const next = getBreakCount() + 1;
    localStorage.setItem(BREAK_COUNT_KEY, String(next));
    setBreakCount(next);
    localStorage.removeItem(TIER_LOCK_KEY);
    setTierLock(null);
    setShowConfession(false);
  };

  const activeTier = SPEND_TIERS.find(t => t.id === selectedTierId)!;

  const submitNewImpulse = () => {
    if (newImpulseName.trim()) {
      const newImpulse: Impulse = { id: Math.random().toString(36).substr(2, 9), name: newImpulseName.trim(), taxRate: 0.5 };
      setState({ impulses: [...impulses, newImpulse] });
    }
    setIsAddingImpulse(false);
    setNewImpulseName('');
  };

  const todayKey = toLocalDateKey(new Date());
  const todayLabel = new Date().toLocaleDateString();
  const alreadyDoneToday = reconHistory.some(entry => toLocalDateKey(entry.date) === todayKey);

  const safeSpendLimit = useMemo(() => calculateTrueSafeSpend(state), [state]);
  const tierLimit = useMemo(() => calculateTierLimit(safeSpendLimit, activeTier.multiplier), [safeSpendLimit, activeTier]);

  const transactionsToday = useMemo(() => {
    return state.transactions.filter(t => toLocalDateKey(t.date) === todayKey);
  }, [state.transactions, todayKey]);

  const recordedDailyDrain = useMemo(() => calculateDailyDrain(transactionsToday), [transactionsToday]);
  const displayRawSpend = rawSpend === '' ? recordedDailyDrain.toString() : rawSpend;
  const spendAmount = parseFloat(displayRawSpend || '0');

  const taxAmount = useMemo(() => {
    if (!selectedImpulseId || !impulseSpend) return 0;
    const impulse = impulses.find(g => g.id === selectedImpulseId);
    return impulse ? calculateImpulsePenalty(parseFloat(impulseSpend), impulse.taxRate) : 0;
  }, [selectedImpulseId, impulseSpend, impulses]);

  const totalDrain = spendAmount + taxAmount;
  const surplus = useMemo(() => calculateDailySurplus(safeSpendLimit, totalDrain), [safeSpendLimit, totalDrain]);
  const dangerProgress = useMemo(() => calculateDangerProgress(totalDrain, tierLimit), [totalDrain, tierLimit]);
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

  const handleAction = (action: 'roll' | 'stash') => {
    submitReconEntry({
      rawSpend:       parseFloat(displayRawSpend),
      action,
      impulseId:      selectedImpulseId,
      impulseSpend:   parseFloat(impulseSpend || '0'),
      taxAmount,
      surplus,
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
          <h1 className="text-4xl font-black uppercase tracking-tighter leading-tight italic text-text-main">Daily Log</h1>
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
                <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-0.5">Logged Today</p>
                <p className="text-2xl font-black italic tracking-tighter text-text-main tabular-nums">{formatCurrency(recordedDailyDrain, privacyMode)}</p>
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
              <span className="text-text-muted">{formatCurrency(recordedDailyDrain, privacyMode)} logged</span>
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
                <span className="text-text-muted">Total Spent</span>
                <span className="text-text-main">{formatCurrency(todayEntry.rawSpend, privacyMode)}</span>
              </div>
              {todayEntry.taxAmount > 0 && (
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest border-b-2 border-border pb-2">
                  <span className="text-text-muted">Impulse Tax</span>
                  <span className="text-action-bleed">{formatCurrency(todayEntry.taxAmount, privacyMode)}</span>
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
        <h1 className="text-4xl font-black uppercase tracking-tighter leading-tight italic text-text-main">Daily Log</h1>
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
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-0.5">Logged Today</p>
              <p className="text-2xl font-black italic tracking-tighter text-text-main tabular-nums">{formatCurrency(recordedDailyDrain, privacyMode)}</p>
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
            <span className="text-text-muted">{formatCurrency(recordedDailyDrain, privacyMode)} logged</span>
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

            {/* Tier Selector */}
            <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
              <div className="inline-flex px-3 py-1 bg-black border-2 border-action-primary rounded-full text-action-primary text-[10px] font-black tracking-widest uppercase mb-4">
                CHOOSE YOUR CHALLENGE
              </div>

              {!isLocked ? (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {SPEND_TIERS.map(tier => (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setSelectedTierId(tier.id)}
                        className={`flex items-center justify-center p-3 border-4 rounded-2xl transition-all
                          ${selectedTierId === tier.id
                            ? `${tier.color} border-black shadow-brutal-sm ${tier.textColor}`
                            : 'bg-input border-border text-text-muted hover:border-black'
                          }`}
                      >
                        <span className="font-black text-xs uppercase">{tier.label}</span>
                      </button>
                    ))}
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Lock in for</p>
                    <div className="flex gap-2">
                      {[7, 14, 30].map(days => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => lockTier(days)}
                          className="flex-1 h-10 bg-input border-2 border-border rounded-xl text-[10px] font-black uppercase tracking-widest text-text-muted hover:border-black hover:text-text-main transition-all"
                        >
                          {days}d
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="border-4 border-black bg-black rounded-2xl p-4 mb-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Lock size={12} strokeWidth={2.5} className="text-action-primary shrink-0" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-action-primary">Active Lock</p>
                    </div>
                    <p className="text-2xl font-black italic uppercase text-action-primary leading-none mb-1">
                      {activeTier.label} Mode
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                      Until {new Date(tierLock!.lockedUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                    <div className="mt-3 pt-3 border-t-2 border-white/10 flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Remaining</p>
                      <p className="text-sm font-black text-white">{daysLeft} day{daysLeft !== 1 ? 's' : ''}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowConfession(true)}
                    className="w-full h-9 border-2 border-border rounded-xl text-[10px] font-black uppercase tracking-widest text-text-muted hover:border-action-bleed hover:text-action-bleed transition-colors"
                  >
                    Break Lock
                  </button>
                </>
              )}

              {breakCount > 0 && (
                <p className="text-[9px] font-black uppercase tracking-widest text-text-muted/50 text-center mt-3">
                  Broke early {breakCount}×
                </p>
              )}

              <div className="mt-4 flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Today's Tier Limit</span>
                <span className="font-black text-xl text-text-main">
                  {formatCurrency(tierLimit, privacyMode)}
                </span>
              </div>
            </div>

            {/* Spend Input + Danger Meter */}
            <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-4">
              <div className="inline-flex px-3 py-1 bg-black border-2 border-black rounded-full text-action-primary text-[10px] font-black tracking-widest uppercase">
                TODAY'S SPENDING
              </div>

              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-3xl font-black text-text-muted pointer-events-none">$</span>
                <input
                  autoFocus
                  type="number"
                  min="0"
                  title="Total Spent Today"
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

              {/* Danger Meter */}
              <div>
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-2">
                  <span className="text-text-muted">Danger Meter</span>
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
                disabled={!displayRawSpend || displayRawSpend === '0'}
                onClick={() => setStep('HABIT_CHECK')}
                className="w-full h-14 border-4 border-black rounded-full bg-black text-action-primary font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-40"
              >
                Continue <ChevronRight size={20} strokeWidth={3} />
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 2: HABIT CHECK ── */}
        {step === 'HABIT_CHECK' && (
          <motion.div key="habit-check" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-5">
              <div className="inline-flex px-3 py-1 bg-action-bleed border-2 border-black rounded-full text-white text-[10px] font-black tracking-widest uppercase">
                HABIT CHECK
              </div>
              <div className="flex justify-center py-4">
                <div className="p-6 rounded-full bg-action-bleed/10 border-4 border-action-bleed text-action-bleed">
                  <AlertCircle size={56} strokeWidth={2.5} />
                </div>
              </div>
              <h3 className="text-2xl font-black italic text-center uppercase tracking-tight text-text-main px-4">
                Any impulse or habit spending today?
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setStep('SUMMARY')}
                  className="h-16 border-4 border-border rounded-full font-black uppercase tracking-widest text-lg bg-surface text-text-main hover:bg-action-capture hover:text-capture-contrast transition-all shadow-[4px_4px_0px_0px_var(--shadow-color)] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
                >
                  No
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setStep('SELECT_HABIT')}
                  className="h-16 border-4 border-black rounded-full font-black uppercase tracking-widest text-lg bg-action-bleed text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
                >
                  Yes
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── STEP 3: SELECT HABIT ── */}
        {step === 'SELECT_HABIT' && (
          <motion.div key="select-habit" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-5">
              <div className="inline-flex px-3 py-1 bg-action-bleed border-2 border-black rounded-full text-white text-[10px] font-black tracking-widest uppercase">
                SELECT HABIT
              </div>
              <div className="space-y-2">
                {impulses.length > 0 ? impulses.map(g => (
                  <button
                    type="button"
                    key={g.id}
                    onClick={() => setSelectedImpulseId(g.id)}
                    className={`w-full p-4 rounded-2xl border-4 transition-all flex justify-between items-center ${
                      selectedImpulseId === g.id ? 'border-action-bleed bg-action-bleed text-white' : 'border-black bg-input text-text-main hover:border-action-bleed'
                    }`}
                  >
                    <span className="font-black italic uppercase">{g.name}</span>
                    <span className="font-black text-[10px] uppercase tracking-widest">{(g.taxRate * 100)}% tax</span>
                  </button>
                )) : (
                  <div className="text-center py-8 border-4 border-dashed border-black/20 rounded-3xl space-y-3 px-4">
                    <Zap size={40} className="mx-auto opacity-20" />
                    <p className="font-black italic uppercase text-text-main text-lg">No bad habits set up yet</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted leading-relaxed">
                      A habit is a spending pattern you want to break · like Starbucks or takeout. Add one here and give it a penalty rate. Every time you confess to spending on it, that % gets sent to your vault.
                    </p>
                    {isAddingImpulse ? (
                      <div className="flex gap-2 justify-center max-w-xs mx-auto px-4">
                        <input
                          autoFocus
                          className="flex-1 bg-input border-4 border-black rounded-2xl p-2 text-center text-xs font-black uppercase outline-none focus:border-action-bleed"
                          placeholder="Habit Name"
                          value={newImpulseName}
                          onChange={e => setNewImpulseName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && submitNewImpulse()}
                        />
                        <button type="button" onClick={submitNewImpulse} className="px-4 py-2 bg-black text-action-primary rounded-2xl font-black text-xs uppercase border-4 border-black">ADD</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setIsAddingImpulse(true)} className="px-6 py-2 bg-black text-action-primary border-4 border-black text-[10px] font-black uppercase rounded-full">
                        + Quick Add
                      </button>
                    )}
                  </div>
                )}
              </div>

              {selectedImpulseId && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-center text-text-muted">Amount spent on this habit</p>
                  <input
                    type="number"
                    title="Amount Spent on Habit"
                    placeholder="0.00"
                    value={impulseSpend}
                    onChange={e => setImpulseSpend(e.target.value)}
                    className="w-full bg-input border-4 border-action-bleed rounded-2xl p-4 text-3xl font-black italic outline-none text-center focus:bg-surface transition-colors text-text-main"
                  />
                  {taxAmount > 0 && (
                    <div className="flex justify-between bg-action-bleed/10 border-4 border-action-bleed rounded-2xl px-4 py-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-action-bleed">Impulse Tax</span>
                      <span className="font-black text-action-bleed">{formatCurrency(taxAmount, privacyMode)}</span>
                    </div>
                  )}
                </motion.div>
              )}

              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                disabled={!selectedImpulseId || !impulseSpend}
                onClick={() => setStep('SUMMARY')}
                className="w-full h-14 border-4 border-black rounded-full bg-black text-action-primary font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-40"
              >
                Apply Penalty <ChevronRight size={20} strokeWidth={3} />
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 4: SUMMARY ── */}
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
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Total Spent</span>
                  <span className="font-black text-text-main">-{formatCurrency(spendAmount, privacyMode)}</span>
                </div>
                {taxAmount > 0 && (
                  <div className="flex justify-between items-center border-b-2 border-border pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-action-bleed">Impulse Tax</span>
                    <span className="font-black text-action-bleed">-{formatCurrency(taxAmount, privacyMode)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 gap-2">
                  <span className="text-sm font-black italic uppercase text-text-main shrink-0">Surplus</span>
                  <span className={`text-2xl sm:text-3xl font-black italic tabular-nums text-right ${surplus >= 0 ? 'text-capture-readable' : 'text-action-bleed'}`}>
                    {formatCurrency(Math.abs(surplus), privacyMode)}
                    <span className="text-base ml-1">{surplus >= 0 ? 'left' : 'over'}</span>
                  </span>
                </div>
              </div>

              {surplus > 0 ? (
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-center text-black/60">What to do with the surplus?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleAction('roll')}
                      className="flex flex-col items-center gap-2 p-5 border-4 border-border rounded-3xl bg-surface text-text-main transition-all shadow-[4px_4px_0px_0px_var(--shadow-color)] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
                    >
                      <ArrowRightLeft size={28} strokeWidth={3} />
                      <span className="font-black uppercase text-[10px]">Roll Over</span>
                      <span className="text-[11px] font-bold text-text-muted uppercase">Limit auto-adjusts</span>
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleAction('stash')}
                      className="flex flex-col items-center gap-2 p-5 bg-black text-action-primary border-4 border-black rounded-3xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
                    >
                      <ShieldCheck size={28} strokeWidth={3} />
                      <span className="font-black uppercase text-[10px]">Stash It</span>
                      <span className="text-[11px] font-black text-action-primary/60 uppercase">Move to vault</span>
                    </motion.button>
                  </div>
                </div>
              ) : (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleAction('roll')}
                  className="w-full h-14 border-4 border-black rounded-full bg-black text-action-primary font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
                >
                  Log & Close Day
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomSheet open={showConfession} onClose={() => setShowConfession(false)} title="COMMITMENT BREACH">
        <div className="space-y-5 py-2">
          <div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-text-main leading-tight">
              You committed to {activeTier.label} mode.
            </h2>
            <p className="text-[12px] font-bold text-text-muted mt-2 leading-relaxed uppercase tracking-wide">
              {daysLeft} day{daysLeft !== 1 ? 's' : ''} left on your lock. You're about to break it.
            </p>
          </div>

          {breakCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-action-bleed/10 border-2 border-action-bleed/30 rounded-xl">
              <p className="text-[10px] font-black uppercase tracking-widest text-action-bleed">
                You've broken early {breakCount}× before.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowConfession(false)}
            className="w-full h-12 bg-black border-4 border-black rounded-2xl text-action-primary font-black uppercase tracking-widest text-[11px] shadow-[4px_4px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
          >
            Stay strong · keep the lock
          </button>

          <button
            type="button"
            onClick={confirmUnlock}
            className="w-full h-10 border-2 border-action-bleed/40 rounded-2xl text-action-bleed font-black uppercase tracking-widest text-[10px] hover:bg-action-bleed/10 transition-colors"
          >
            Yes, I'm giving up
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
