import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Skull, X, ShieldCheck, Plus } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { useStore } from '../store/useStore';
import { Subscription } from '../store/useStore';
import { executeSubCancel } from '../db';

export default function ActiveSubs() {
  const storeState = useStore();
  const { privacyMode, addSubscription, setSubscriptionUsage, cancelSubscription } = storeState;
  const state = storeState;

  const totalBleed = useMemo(() => state.subscriptions.reduce((acc, sub) => acc + sub.amount, 0), [state.subscriptions]);

  const [subToCancel, setSubToCancel] = useState<Subscription | null>(null);
  const [isAddingSub, setIsAddingSub] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubAmount, setNewSubAmount] = useState('');

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
    if (!newSubName.trim() || !amt || amt <= 0) return;
    addSubscription(newSubName.trim(), amt);
    setIsAddingSub(false);
    setNewSubName('');
    setNewSubAmount('');
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
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">Monitor & cancel inactive subscriptions</p>
      </div>

      {/* Total Bleed */}
      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] overflow-hidden min-h-fit">
        <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Total Monthly Bleed</p>
        <p className="text-4xl font-black italic tracking-tighter text-action-bleed tabular-nums break-all min-w-0">
          -{formatCurrency(totalBleed, privacyMode)}
        </p>
        {state.subscriptions.length > 0 && (
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-1">
            {state.subscriptions.length} subscription{state.subscriptions.length !== 1 ? 's' : ''} active
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
                  <h3 className="text-lg font-black italic uppercase tracking-tighter text-text-main truncate">{sub.name}</h3>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
                    {formatCurrency(sub.amount, privacyMode)} / {sub.billingCycle}
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
              <input
                type="number"
                min="0"
                title="Monthly cost"
                placeholder="Monthly cost $"
                className="flex-1 min-w-0 bg-input border-4 border-black rounded-2xl p-3 font-black text-sm text-text-main outline-none focus:border-action-primary transition-colors tabular-nums"
                value={newSubAmount}
                onFocus={e => e.target.select()}
                onChange={e => setNewSubAmount(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitNewSub()}
              />
              <button
                type="button"
                onClick={() => { setIsAddingSub(false); setNewSubName(''); setNewSubAmount(''); }}
                className="h-12 px-5 border-4 border-black rounded-full bg-surface text-text-main font-black uppercase text-xs tracking-widest shadow-[4px_4px_0px_0px_var(--shadow-color)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all shrink-0"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitNewSub}
                disabled={!newSubName.trim() || !newSubAmount || parseFloat(newSubAmount) <= 0}
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
            onClick={() => setIsAddingSub(true)}
            className="md:col-span-2 w-full h-14 border-4 border-black rounded-full bg-black text-action-primary font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
          >
            <Plus size={18} strokeWidth={3} /> ADD SUBSCRIPTION
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
