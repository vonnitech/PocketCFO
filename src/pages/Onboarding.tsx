import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { ChevronRight, ChevronLeft, Wallet, CalendarDays, Receipt, Zap, ArrowRight, Scissors, ShieldCheck, Plus, X, Check } from 'lucide-react';
import { calculateDaysUntilPayday } from '../core/math';

function contrastText(hex?: string): string {
  if (!hex || hex.length < 7) return 'text-black';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.45 ? 'text-black' : 'text-white';
}

export default function Onboarding() {
  const setHorizon = useStore(s => s.setHorizon);
  const themeColors = useStore(s => s.themeColors);
  const captureTxt = contrastText(themeColors?.secondary);
  const [phase, setPhase] = useState(0);

  const [capital, setCapital] = useState('');
  const [payday, setPayday] = useState('');
  const [billItems, setBillItems] = useState<{ id: string; name: string; amount: string }[]>([]);
  const [newBillName, setNewBillName] = useState('');
  const [newBillAmount, setNewBillAmount] = useState('');
  const [isAddingBill, setIsAddingBill] = useState(false);

  const numCapital = parseFloat(capital) || 0;
  const numBills = billItems.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);
  const daysUntil = payday ? calculateDaysUntilPayday(payday) : 1;
  const previewDailyLimit = numCapital > 0 && payday
    ? Math.max(0, (numCapital - numBills) / daysUntil)
    : 0;

  const confirmAddBill = () => {
    if (newBillName.trim() && parseFloat(newBillAmount) > 0) {
      setBillItems(prev => [...prev, { id: crypto.randomUUID(), name: newBillName.trim(), amount: newBillAmount }]);
      setNewBillName('');
      setNewBillAmount('');
      setIsAddingBill(false);
    }
  };

  const handleFinish = () => {
    const parsedBills = billItems
      .map(b => ({ id: b.id, name: b.name, amount: parseFloat(b.amount) || 0 }))
      .filter(b => b.amount > 0 && b.name.trim());
    setHorizon(numCapital, payday, 0, 0, parsedBills);
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  const progressPhase = phase >= 1 && phase <= 3 ? phase : 0;

  /* ── PHASE 0: PITCH ── */
  if (phase === 0) {
    return (
      <div className="fixed inset-0 bg-base dot-bg z-50 flex flex-col overflow-y-auto px-5 pt-10 pb-8">
        <div className="max-w-md w-full mx-auto flex flex-col gap-5 flex-1">

          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="self-start px-3 py-1 bg-black border-2 border-black rounded-full text-action-primary text-[10px] font-black tracking-widest uppercase"
          >
            POCKET CFO
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
          >
            <h1 className="font-black uppercase italic tracking-tighter leading-[0.85] text-text-main text-[clamp(52px,14vw,80px)]">
              STOP<br />
              GUESSING.
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.94, rotate: -1 }}
            animate={{ opacity: 1, scale: 1, rotate: -1 }}
            transition={{ delay: 0.18, type: 'spring', stiffness: 220, damping: 22 }}
            className="bg-action-primary border-4 border-border rounded-3xl p-6 shadow-[6px_6px_0px_0px_var(--shadow-color)] flex items-center gap-5"
          >
            <div className="bg-black border-4 border-black rounded-2xl p-4 shrink-0">
              <Wallet size={32} strokeWidth={3} className="text-action-primary" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-black/50">Your safe spend today</p>
              <p className="text-5xl font-black italic tracking-tighter text-text-main leading-none">$47.23</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mt-1">Tied to your real bank balance</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="bg-surface border-4 border-border rounded-3xl divide-y-2 divide-border shadow-[6px_6px_0px_0px_var(--shadow-color)]"
          >
            {[
              { icon: Zap, color: 'bg-action-bleed', text: 'Spend less today?', sub: 'Tomorrow\'s limit rises automatically' },
              { icon: ShieldCheck, color: 'bg-action-capture', text: 'Surplus left over?', sub: 'Stash it in a vault toward real goals' },
              { icon: Scissors, color: 'bg-action-primary', text: 'Leaking money?', sub: 'Kill dead subscriptions in seconds' },
            ].map(({ icon: Icon, color, text, sub }) => (
              <div key={text} className="flex items-center gap-4 px-5 py-4">
                <div className={`w-9 h-9 ${color} border-2 border-black rounded-xl flex items-center justify-center shrink-0`}>
                  <Icon size={15} strokeWidth={3} className="text-text-main" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-text-main">{text}</p>
                  <p className="text-[10px] font-bold uppercase text-text-muted">{sub}</p>
                </div>
              </div>
            ))}
          </motion.div>

          <div className="flex-1" />

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38 }}
            className="space-y-3"
          >
            <button
              type="button"
              onClick={() => setPhase(1)}
              className="w-full h-16 flex items-center justify-center gap-3 border-4 border-black bg-black text-action-primary font-black uppercase tracking-widest text-xl rounded-full shadow-[4px_4px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
            >
              BEGIN SETUP <ArrowRight strokeWidth={4} size={22} />
            </button>
            <p className="text-center text-text-muted text-[10px] font-bold uppercase tracking-widest">
              60 seconds · free · your data stays on this device
            </p>
          </motion.div>

        </div>
      </div>
    );
  }

  /* ── PHASES 1–4: SETUP ── */
  return (
    <div className="fixed inset-0 bg-base dot-bg flex flex-col pt-8 md:pt-12 px-4 z-50 overflow-y-auto">
      <div className="max-w-md w-full mx-auto flex flex-col gap-6 relative min-h-0 pb-8">

        {phase >= 1 && phase <= 3 && (
          <div className="px-2">
            <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tighter leading-[0.9]">
              <div className="text-text-main italic">LOCK IN</div>
              <div className="text-capture-readable italic">YOUR HORIZON.</div>
            </h1>
            <div className="mt-8">
              <div className="flex justify-between items-center mb-2 px-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">HORIZON SETUP</span>
                <span className="bg-black text-white text-[10px] font-black px-3 py-1 rounded-full uppercase">{phase} / 3</span>
              </div>
              <div className="h-3 border-2 border-black rounded-full bg-input overflow-hidden flex">
                <motion.div
                  className="h-full bg-action-capture border-r-2 border-black"
                  animate={{ width: `${(progressPhase / 3) * 100}%` }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              </div>
            </div>
          </div>
        )}

        <div className={`bg-surface border-4 border-black rounded-3xl p-6 md:p-8 shrink-0 flex flex-col shadow-[6px_6px_0px_0px_var(--shadow-color)] overflow-hidden ${phase === 4 ? 'min-h-120' : 'min-h-90'}`}>
          <AnimatePresence mode="wait">

            {/* ── PHASE 1: BANK BALANCE ── */}
            {phase === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-6">
                <div className="self-start px-3 py-1 bg-black border-2 border-action-primary rounded-full text-action-primary text-[10px] font-black tracking-widest uppercase">
                  STEP 01: LIQUID CAPITAL
                </div>
                <div>
                  <h2 className="text-4xl font-black uppercase leading-none tracking-tight flex items-center gap-3 italic text-text-main">
                    <Wallet className="text-action-primary shrink-0" size={32} strokeWidth={3} />
                    CURRENT<br />BANK BALANCE
                  </h2>
                  <p className="mt-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Check your banking app. A rough estimate works · you can update it anytime in Settings.</p>
                </div>
                <div className="relative mt-4">
                  <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                    <span className="text-3xl font-black text-text-muted">$</span>
                  </div>
                  <input
                    type="number" title="Current Bank Balance" placeholder="0"
                    className="w-full bg-input border-4 border-black rounded-2xl p-6 pl-14 text-4xl font-black outline-none focus:border-action-primary focus:bg-surface transition-colors text-text-main"
                    value={capital} onChange={e => setCapital(e.target.value)} onFocus={e => e.target.select()} autoFocus
                  />
                </div>
              </motion.div>
            )}

            {/* ── PHASE 2: NEXT PAYDAY ── */}
            {phase === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-6">
                <div className="self-start px-3 py-1 bg-action-bleed border-2 border-black rounded-full text-white text-[10px] font-black tracking-widest uppercase">
                  STEP 02: THE DEADLINE
                </div>
                <div>
                  <h2 className="text-4xl font-black uppercase leading-none tracking-tight flex items-center gap-3 italic text-text-main">
                    <CalendarDays className="text-action-bleed shrink-0" size={32} strokeWidth={3} />
                    NEXT<br />PAYDAY
                  </h2>
                  <p className="mt-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">The date your next paycheck hits. This is your survival horizon.</p>
                </div>
                <div className="mt-4">
                  <input
                    type="date" title="Next Payday"
                    className="w-full bg-input border-4 border-action-bleed rounded-2xl p-6 text-2xl font-black outline-none focus:bg-surface transition-colors text-text-main"
                    value={payday} onChange={e => setPayday(e.target.value)} autoFocus
                    min={new Date().toISOString().split('T')[0]}
                  />
                  {payday && (
                    <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-widest text-text-muted">
                      {daysUntil} day{daysUntil !== 1 ? 's' : ''} until payday
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── PHASE 3: UPCOMING BILLS ── */}
            {phase === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-5">
                <div className="self-start px-3 py-1 bg-black border-2 border-action-primary rounded-full text-action-primary text-[10px] font-black tracking-widest uppercase">
                  STEP 03: THE BLEED
                </div>
                <div>
                  <h2 className="text-4xl font-black uppercase leading-none tracking-tight flex items-center gap-3 italic text-text-main">
                    <Receipt className="text-capture-readable shrink-0" size={32} strokeWidth={4} />
                    BILLS DUE<br />BEFORE PAYDAY
                  </h2>
                  <p className="mt-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    List anything due in the next {daysUntil} day{daysUntil !== 1 ? 's' : ''} · rent, minimums, subscriptions. Skip if nothing is due.
                  </p>
                </div>

                <div className="space-y-2">
                  {billItems.map(bill => (
                    <div key={bill.id} className="flex items-center gap-2 bg-input border-4 border-black rounded-2xl px-4 py-3">
                      <span className="font-black uppercase text-sm text-text-main flex-1 truncate">{bill.name}</span>
                      <span className="font-black tabular-nums text-sm text-text-main shrink-0">${parseFloat(bill.amount).toFixed(2)}</span>
                      <button
                        type="button"
                        title="Remove bill"
                        onClick={() => setBillItems(prev => prev.filter(b => b.id !== bill.id))}
                        className="p-1 text-action-bleed hover:bg-action-bleed/10 rounded-lg transition-colors shrink-0"
                      >
                        <X size={14} strokeWidth={2.5} />
                      </button>
                    </div>
                  ))}

                  {isAddingBill ? (
                    <div className="flex gap-2 items-center">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Bill name"
                        value={newBillName}
                        onChange={e => setNewBillName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && confirmAddBill()}
                        className="flex-1 bg-input border-4 border-black rounded-2xl p-3 font-black text-sm text-text-main outline-none focus:border-action-primary transition-colors"
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder="$0"
                        value={newBillAmount}
                        onChange={e => setNewBillAmount(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && confirmAddBill()}
                        className="w-24 bg-input border-4 border-black rounded-2xl p-3 font-black text-sm text-text-main outline-none focus:border-action-primary transition-colors"
                      />
                      <button
                        type="button"
                        title="Confirm bill"
                        onClick={confirmAddBill}
                        className="h-11 w-11 bg-action-capture border-4 border-black rounded-2xl flex items-center justify-center shrink-0"
                      >
                        <Check size={14} strokeWidth={3} />
                      </button>
                      <button
                        type="button"
                        title="Cancel"
                        onClick={() => { setIsAddingBill(false); setNewBillName(''); setNewBillAmount(''); }}
                        className="h-11 w-11 bg-surface border-4 border-black rounded-2xl flex items-center justify-center shrink-0"
                      >
                        <X size={14} strokeWidth={3} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsAddingBill(true)}
                      className="w-full h-12 border-4 border-dashed border-border rounded-2xl text-[10px] font-black uppercase text-text-muted hover:border-black hover:text-text-main transition-all flex items-center justify-center gap-1.5"
                    >
                      <Plus size={13} strokeWidth={3} /> Add a Bill
                    </button>
                  )}
                </div>

                {numBills > 0 && (
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Total bills</span>
                    <span className="font-black tabular-nums text-text-main">${numBills.toFixed(2)}</span>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── PHASE 4: LAUNCH PREVIEW ── */}
            {phase === 4 && (
              <motion.div key="launch" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col gap-5 flex-1">
                <div className="self-start px-3 py-1 bg-action-capture border-2 border-black rounded-full text-capture-contrast text-[10px] font-black tracking-widest uppercase">
                  SYSTEM ARMED
                </div>
                <h2 className="text-4xl font-black uppercase leading-[0.9] tracking-tighter italic text-text-main">
                  HORIZON<br />LOCKED IN.
                </h2>
                <div className="space-y-3 flex-1">
                  <div className="bg-action-capture border-4 border-black rounded-3xl p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <p className={`text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1 ${captureTxt}`}>Your safe-to-spend today</p>
                    <p className={`text-5xl font-black italic tracking-tighter tabular-nums ${captureTxt}`}>${previewDailyLimit.toFixed(2)}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-input border-4 border-black rounded-2xl p-4">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-1">Balance</p>
                      <p className="text-lg font-black italic text-text-main tabular-nums truncate">${numCapital.toFixed(0)}</p>
                    </div>
                    <div className="bg-input border-4 border-black rounded-2xl p-4">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-1">Bills</p>
                      <p className="text-lg font-black italic text-text-main tabular-nums truncate">${numBills.toFixed(0)}</p>
                    </div>
                    <div className="bg-input border-4 border-black rounded-2xl p-4">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-1">Days</p>
                      <p className="text-lg font-black italic text-text-main">{daysUntil}</p>
                    </div>
                  </div>
                  <div className="border-2 border-border rounded-2xl p-4 bg-surface">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-1">How it works</p>
                    <p className="text-sm font-bold text-text-main leading-relaxed">
                      Spend less today → tomorrow's limit <span className="text-capture-readable font-black">rises</span>. Spend more → it drops. The formula adjusts every day until payday.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex gap-4 pb-8">
          {phase > 1 && phase < 4 && (
            <button
              type="button"
              onClick={() => setPhase(p => p - 1)}
              className="w-16 h-16 shrink-0 flex items-center justify-center border-4 border-border rounded-2xl bg-surface group transition-all shadow-[4px_4px_0px_0px_var(--shadow-color)] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
              aria-label="Previous step"
            >
              <ChevronLeft size={32} strokeWidth={4} className="text-text-main group-hover:-translate-x-1 transition-transform" />
            </button>
          )}

          {phase >= 1 && phase < 3 && (
            <button
              type="button"
              onClick={() => setPhase(p => p + 1)}
              disabled={phase === 1 && numCapital <= 0}
              className="flex-1 flex items-center justify-center gap-2 border-4 border-black bg-black text-action-primary font-black uppercase tracking-widest text-xl rounded-full h-16 shadow-[4px_4px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[4px_4px_0px_0px_var(--color-action-primary)]"
            >
              NEXT STEP <ChevronRight strokeWidth={4} size={24} />
            </button>
          )}

          {phase === 3 && (
            <button
              type="button"
              onClick={() => setPhase(4)}
              disabled={!payday}
              className="flex-1 flex items-center justify-center gap-2 border-4 border-black bg-action-capture text-capture-contrast font-black uppercase tracking-widest text-xl rounded-full h-16 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            >
              CALCULATE <Zap strokeWidth={4} size={24} />
            </button>
          )}

          {phase === 4 && (
            <button
              type="button"
              onClick={handleFinish}
              className="flex-1 flex items-center justify-center gap-2 border-4 border-black bg-black text-action-primary font-black uppercase tracking-widest text-xl rounded-full h-16 shadow-[4px_4px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
            >
              LAUNCH <Zap strokeWidth={4} size={24} />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
