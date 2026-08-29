import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CalendarDays, Skull, X, ShieldCheck, Plus, Lock } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { isSubscriptionDueBeforePayday, isSubscriptionDueToday, useStore } from '../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { Subscription } from '../store/useStore';
import { useProLocked } from '../lib/pro';
import { executeSubCancel } from '../db';

// Free tier: track up to 3 subscriptions. Existing over-cap subs are grandfathered
// (never removed); only the add action is gated.
const FREE_SUB_CAP = 3;

export default function Subscriptions() {
  const storeState = useStore(
    useShallow(s => ({
      subscriptions: s.subscriptions,
      nextPayday: s.nextPayday,
      privacyMode: s.privacyMode,
      addSubscription: s.addSubscription,
      setSubscriptionUsage: s.setSubscriptionUsage,
      cancelSubscription: s.cancelSubscription,
    })),
  );
  const { privacyMode, addSubscription, setSubscriptionUsage, cancelSubscription } = storeState;
  const state = storeState;
  const proLocked = useProLocked();
  const subCapReached = proLocked && state.subscriptions.length >= FREE_SUB_CAP;

  const totalBleed = useMemo(() => state.subscriptions.reduce((acc, sub) => acc + sub.amount, 0), [state.subscriptions]);
  const reservedBeforePayday = useMemo(
    () => state.subscriptions
      .filter(sub => isSubscriptionDueBeforePayday(sub, state.nextPayday))
      .reduce((acc, sub) => acc + sub.amount, 0),
    [state.subscriptions, state.nextPayday],
  );

  const [subToCancel, setSubToCancel] = useState<Subscription | null>(null);
  const [isAddingSub, setIsAddingSub] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubAmount, setNewSubAmount] = useState('');
  const [newSubBillingDate, setNewSubBillingDate] = useState('');

  const canAddSub = Boolean(
    newSubName.trim() &&
    newSubAmount &&
    parseFloat(newSubAmount) > 0 &&
    newSubBillingDate,
  );

  const setUsage = (id: string, usage: 'Active' | 'Low Use' | 'Idle') => {
    setSubscriptionUsage(id, usage);
  };

  const executeCancelSub = async () => {
    if (!subToCancel) return;
    const sub = subToCancel;
    try {
      await executeSubCancel({ id: sub.id, name: sub.name, monthlyCost: sub.amount, status: 'ACTIVE', dateAdded: Date.now(), dateKilled: null });
    } catch (e) { console.error('Failed to log to IDB', e); }
    await cancelSubscription(sub.id);
    setSubToCancel(null);
  };

  const submitNewSub = () => {
    const amt = parseFloat(newSubAmount);
    if (!canAddSub || !amt || amt <= 0) return;
    addSubscription(newSubName.trim(), amt, newSubBillingDate);
    setIsAddingSub(false);
    setNewSubName('');
    setNewSubAmount('');
    setNewSubBillingDate('');
  };

  const formatBillingDate = (value?: string): string => {
    const key = (value || '').slice(0, 10);
    const [year, month, day] = key.split('-').map(Number);
    if (!year || !month || !day) return 'No date set';
    return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const usageBadge = (usage: string) => {
    if (usage === 'Active') return 'bg-action-capture border-action-capture text-capture-contrast';
    if (usage === 'Low Use') return 'bg-action-primary border-action-primary text-black';
    return 'bg-action-bleed border-action-bleed text-white';
  };

  const cardBorder = (usage: string) => {
    if (usage === 'Idle') return 'border-action-bleed shadow-[6px_6px_0px_0px_var(--color-action-bleed)]';
    if (usage === 'Low Use') return 'border-action-primary shadow-[6px_6px_0px_0px_var(--color-action-primary)]';
    return 'border-border shadow-[6px_6px_0px_0px_var(--shadow-color)]';
  };

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {/* Header */}
      <div>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">
          Subscriptions
        </h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">Bill dates decide when subscriptions reserve cash before payday</p>
      </div>

      {/* Total Bleed */}
      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] overflow-hidden min-h-fit">
        <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Total Monthly Bleed</p>
        <p className="text-4xl font-black italic tracking-tighter text-action-bleed tabular-nums break-all min-w-0">
          -{formatCurrency(totalBleed, privacyMode)}
        </p>
        {state.subscriptions.length > 0 && (
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-1">
            {state.subscriptions.length} subscription{state.subscriptions.length !== 1 ? 's' : ''} active · tracked separately from Bill Queue
          </p>
        )}
        {state.subscriptions.length > 0 && (
          <p className="text-[10px] font-bold uppercase tracking-wide text-action-bleed/80 mt-1 tabular-nums">
            {formatCurrency(reservedBeforePayday, privacyMode)} reserved before payday
          </p>
        )}
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:items-start">
        <AnimatePresence>
          {state.subscriptions.map(sub => (
            <motion.div
              key={sub.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, x: 50 }}
              className={`bg-surface border-4 rounded-3xl p-4 transition-all overflow-hidden ${cardBorder(sub.usage)}`}
            >
              {/* Row 1: name + amount + cancel */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-black italic uppercase tracking-tighter text-text-main truncate pr-1.5">{sub.name}</h3>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
                    {formatCurrency(sub.amount, privacyMode)} / {sub.billingCycle}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted flex items-center gap-1 mt-1">
                    <CalendarDays size={12} strokeWidth={3} />
                    Next bill {formatBillingDate(sub.nextBillingDate)}
                  </p>
                </div>
                <span className="text-xl font-black italic tabular-nums text-text-main shrink-0">
                  {formatCurrency(sub.amount, privacyMode)}
                </span>
                <motion.button
                  type="button"
                  title="Cancel subscription"
                  whileHover={{ rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSubToCancel(sub)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl border-4 border-action-bleed bg-action-bleed/10 text-action-bleed hover:bg-action-bleed hover:text-white transition-all shrink-0"
                >
                  <X size={18} strokeWidth={3} />
                </motion.button>
              </div>

              {/* Row 2: status toggles */}
              {sub.nextBillingDate && (
                <div className={`mb-3 px-3 py-2 border-[3px] rounded-2xl text-[10px] font-black uppercase tracking-widest ${
                  isSubscriptionDueToday(sub)
                    ? 'border-action-bleed bg-action-bleed/10 text-action-bleed'
                    : isSubscriptionDueBeforePayday(sub, state.nextPayday)
                      ? 'border-action-primary bg-action-primary/20 text-text-main'
                      : 'border-border bg-input text-text-muted'
                }`}>
                  {isSubscriptionDueToday(sub)
                    ? `${sub.name} due today · mark paid on dashboard`
                    : isSubscriptionDueBeforePayday(sub, state.nextPayday)
                      ? 'Reserved before payday'
                      : 'Not reserved this pay cycle'}
                </div>
              )}

              <div className="flex gap-2">
                {(['Active', 'Low Use', 'Idle'] as const).map(status => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setUsage(sub.id, status)}
                    className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest border-[3px] rounded-full transition-all ${
                      sub.usage === status
                        ? usageBadge(status)
                        : 'border-black/20 text-text-muted hover:border-black hover:text-text-main'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </motion.div>
          ))}

          {state.subscriptions.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 bg-surface border-4 border-dashed border-action-capture rounded-3xl md:col-span-2"
            >
              <ShieldCheck size={56} className="mx-auto mb-4 text-capture-readable" />
              <h3 className="text-2xl font-black italic uppercase text-capture-readable">All Clear</h3>
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-2">No active subscriptions.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add New */}
        {isAddingSub ? (
          <div className="md:col-span-2 bg-surface border-4 border-action-primary rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-3">
            <input
              autoFocus
              type="text"
              title="Subscription name"
              placeholder="Subscription name"
              className="w-full bg-input border-4 border-black rounded-2xl p-3 font-black uppercase text-sm text-text-main outline-none focus:border-action-primary transition-colors"
              value={newSubName}
              onChange={e => setNewSubName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitNewSub()}
            />
            <div className="flex gap-2">
              <label className="flex-1 min-w-0">
                <span className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-1">Monthly cost</span>
                <input
                  type="number"
                  min="0"
                  title="Monthly cost"
                  placeholder="0.00"
                  className="w-full bg-input border-4 border-black rounded-2xl p-3 font-black text-sm text-text-main outline-none focus:border-action-primary transition-colors tabular-nums"
                  value={newSubAmount}
                  onFocus={e => e.target.select()}
                  onChange={e => setNewSubAmount(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitNewSub()}
                />
              </label>
              <label className="flex-1 min-w-0">
                <span className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-1">Next billing date</span>
                <input
                  type="date"
                  title="Next billing date"
                  className="w-full bg-input border-4 border-black rounded-2xl p-3 font-black text-sm text-text-main outline-none focus:border-action-primary transition-colors"
                  value={newSubBillingDate}
                  onChange={e => setNewSubBillingDate(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitNewSub()}
                />
              </label>
              <button
                type="button"
                onClick={() => { setIsAddingSub(false); setNewSubName(''); setNewSubAmount(''); setNewSubBillingDate(''); }}
                className="h-12 px-5 border-4 border-black rounded-full bg-surface text-text-main font-black uppercase text-xs tracking-widest shadow-[4px_4px_0px_0px_var(--shadow-color)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all shrink-0"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitNewSub}
                disabled={!canAddSub}
                className="h-12 px-5 border-4 border-black rounded-full bg-black text-action-primary font-black uppercase text-xs tracking-widest shadow-[4px_4px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[4px_4px_0px_0px_var(--color-action-primary)]"
              >
                Add
              </button>
            </div>
          </div>
        ) : (
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              if (subCapReached) { window.dispatchEvent(new CustomEvent('pro-upsell', { detail: { feature: 'subscription_cap' } })); return; }
              setIsAddingSub(true);
            }}
            className="md:col-span-2 w-full h-14 border-4 border-black rounded-full bg-black text-action-primary font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
          >
            {subCapReached
              ? <><Lock size={18} strokeWidth={3} /> Add Subscription · Pro</>
              : <><Plus size={18} strokeWidth={3} /> Add Subscription</>}
          </motion.button>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {subToCancel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: -20 }}
              className="bg-surface w-full max-w-md p-7 rounded-3xl border-4 border-action-bleed shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 bg-action-bleed text-white rounded-2xl flex items-center justify-center mb-5 border-[3px] border-black rotate-6">
                <Skull size={32} />
              </div>
              <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-2 text-text-main">Cancel Subscription?</h2>
              <p className="text-[11px] font-bold text-text-muted mb-7 leading-relaxed uppercase tracking-wide">
                Did you actually cancel <span className="text-text-main border-b-[3px] border-action-bleed">{subToCancel.name}</span> in its app settings?
              </p>
              <div className="flex gap-4 w-full">
                <button
                  type="button"
                  onClick={() => setSubToCancel(null)}
                  className="flex-1 h-14 border-4 border-black rounded-full bg-surface font-black text-xs uppercase tracking-widest text-text-main shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
                >
                  Go Back
                </button>
                <button
                  type="button"
                  onClick={executeCancelSub}
                  className="flex-1 h-14 border-4 border-black rounded-full bg-action-bleed font-black text-xs uppercase tracking-widest text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
                >
                  Yes, Kill It
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
