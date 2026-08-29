import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Trash2, Plus, Check, X, Edit2, ArrowLeft, ChevronDown, Pause, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Debt, BillQueueItem } from '../store/useStore';
import { useStore } from '../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { formatCurrency } from '../lib/utils';



function Card({ children, badge, badgeColor = 'bg-black', badgeTextColor = 'text-action-primary', defaultOpen = true }: {
  children: React.ReactNode;
  badge: string;
  badgeColor?: string;
  badgeTextColor?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-surface border-4 border-border rounded-3xl shadow-[6px_6px_0px_0px_var(--shadow-color)]">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4"
      >
        <div className={`inline-flex px-3 py-1 ${badgeColor} border-2 border-black rounded-full ${badgeTextColor} text-[10px] font-black tracking-widest uppercase`}>
          {badge}
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ type: 'spring', stiffness: 380, damping: 38 }}>
          <ChevronDown size={16} strokeWidth={2.5} className="text-text-muted" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-5 pb-5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function contrastText(hex?: string): string {
  if (!hex || hex.length < 7) return 'text-black';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.45 ? 'text-black' : 'text-white';
}

export default function Config() {
  const state = useStore(
    useShallow(s => ({
      debts: s.debts,
      hardDailyCap: s.hardDailyCap,
      impulses: s.impulses,
      liquidAssets: s.liquidAssets,
      monthlySavingsGoal: s.monthlySavingsGoal,
      monthlyTakeHome: s.monthlyTakeHome,
      nextPayday: s.nextPayday,
      recurringBills: s.recurringBills,
      stats: s.stats,
      themeColors: s.themeColors,
      setHorizon: s.setHorizon,
      updateBaseline: s.updateBaseline,
      addDebt: s.addDebt,
      updateDebt: s.updateDebt,
      removeDebt: s.removeDebt,
      setImpulses: s.setImpulses,
    })),
  );
  const { setHorizon, updateBaseline, addDebt, updateDebt, removeDebt, setImpulses } = state;
  const captureTxt = contrastText(state.themeColors?.secondary);
  const primaryTxt  = contrastText(state.themeColors?.primary);

  const [isAddingConfigImpulse, setIsAddingConfigImpulse] = useState(false);
  const [newConfigImpulseName, setNewConfigImpulseName] = useState('');

  // Horizon settings state — string so empty field shows blank not "0"
  const [horizonCapital, setHorizonCapital] = useState(() => state.liquidAssets || '');
  const [horizonPayday, setHorizonPayday] = useState(state.nextPayday || '');
  const [horizonSaved, setHorizonSaved] = useState(false);
  const [horizonCap, setHorizonCap] = useState(() => state.hardDailyCap > 0 ? String(state.hardDailyCap) : '');

  // Bill queue state for the Horizon card
  const [configBills, setConfigBills] = useState<{ id: string; name: string; amount: string; dueDay: string; paused: boolean }[]>(
    () => (state.recurringBills || []).map(b => ({ id: b.id, name: b.name, amount: String(b.amount), dueDay: b.dueDay ? String(b.dueDay) : '', paused: !!b.paused }))
  );
  const [newBillName, setNewBillName] = useState('');
  const [newBillAmount, setNewBillAmount] = useState('');
  const [newBillDueDay, setNewBillDueDay] = useState('');
  const [isAddingBill, setIsAddingBill] = useState(false);

  // Sync configBills from store only when the component initialised before data loaded (configBills is empty but store now has bills)
  useEffect(() => {
    if (configBills.length === 0 && (state.recurringBills || []).length > 0) {
      setConfigBills(state.recurringBills.map(b => ({ id: b.id, name: b.name, amount: String(b.amount), dueDay: b.dueDay ? String(b.dueDay) : '', paused: !!b.paused })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.recurringBills]);

  // The payday and balance fields need the same protection as configBills above:
  // both initialise once via useState, so a Config screen that mounted before the
  // store had loaded keeps them blank, and "Save Pay Cycle" then submits those
  // blanks. A blank payday used to read as a new pay cycle and wiped every
  // paid-bill marker, resurrecting bills already ticked off; a blank balance
  // would write liquid assets to zero. Each only fills when its own field is
  // still empty, so neither can overwrite a value the user is editing.
  useEffect(() => {
    if (!horizonPayday && state.nextPayday) setHorizonPayday(state.nextPayday);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.nextPayday]);

  useEffect(() => {
    if (horizonCapital === '' && state.liquidAssets) setHorizonCapital(state.liquidAssets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.liquidAssets]);

  // Monthly Baseline state — string so empty field shows blank not "0"
  const [baselineIncome, setBaselineIncome] = useState(() => state.monthlyTakeHome || '');
  const [baselineSavings, setBaselineSavings] = useState(() => state.monthlySavingsGoal || '');
  const [baselineSaved, setBaselineSaved] = useState(false);

  // Local impulse rate state — avoids per-keypress store updates that stomp cursor
  const [impulseRates, setImpulseRates] = useState<Record<string, string>>(() =>
    Object.fromEntries((state.impulses || []).map(g => [g.id, String(g.taxRate * 100)]))
  );

  // Debt management state
  const [isAddingDebt, setIsAddingDebt] = useState(false);
  const [newDebtName, setNewDebtName] = useState('');
  const [newDebtBalance, setNewDebtBalance] = useState('');
  const [newDebtRate, setNewDebtRate] = useState('');
  const [newDebtMin, setNewDebtMin] = useState('');
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [editDebtFields, setEditDebtFields] = useState<Partial<Omit<Debt, 'id'>>>({});

  return (
    <motion.div className="space-y-6 w-full max-w-3xl mx-auto" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {/* Back + Header + Level */}
      <div>
        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-main transition-colors mb-3"
        >
          <ArrowLeft size={13} strokeWidth={3} />
          Back to Settings
        </Link>
      </div>
      <div>
        <h1 className="text-4xl font-black uppercase tracking-tighter leading-tight italic text-text-main">Finances</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">Income, bills & budget</p>
      </div>

      {/* Stats */}
      <Card badge="TOTAL SAVINGS" badgeColor="bg-action-capture" badgeTextColor={captureTxt}>
        <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mb-2">Total Value Protected</p>
        <div className="text-3xl sm:text-4xl font-black italic text-capture-readable tracking-tighter tabular-nums">
          ${(state.stats.lifetimeCapture || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <p className="text-[10px] font-bold uppercase text-text-muted mt-3">Savings gains & cancelled subscriptions</p>
      </Card>


      {/* Pay Cycle */}
      <Card badge="PAY CYCLE" badgeColor="bg-action-capture" badgeTextColor={captureTxt}>
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Your real bank balance, next payday, and upcoming bills drive your daily limit</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-text-muted block mb-2">Current Bank Balance ($)</label>
              <input
                type="number"
                title="Current Bank Balance"
                min="0"
                value={horizonCapital}
                onFocus={e => e.target.select()}
                onChange={e => setHorizonCapital(e.target.value)}
                className="w-full bg-input border-4 border-black rounded-2xl p-3 font-black text-text-main outline-none focus:border-action-capture transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-text-muted block mb-2">Next Payday</label>
              <input
                type="date"
                title="Next Payday"
                value={horizonPayday}
                onChange={e => setHorizonPayday(e.target.value)}
                className="w-full bg-input border-4 border-black rounded-2xl p-3 font-black text-text-main outline-none focus:border-action-capture transition-colors"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          {/* Bill Queue */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Recurring Bills</label>
              {configBills.length > 0 && (
                <span className="text-[10px] font-black uppercase tracking-widest text-text-main">
                  Total: {formatCurrency(configBills.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0))}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {/* Sort by due day ascending so the user sees the calendar flow naturally.
                  Bills without a due day fall to the bottom — they're still editable. */}
              {[...configBills].sort((a, b) => {
                const da = parseInt(a.dueDay, 10);
                const db = parseInt(b.dueDay, 10);
                const va = isNaN(da) ? 999 : da;
                const vb = isNaN(db) ? 999 : db;
                return va - vb;
              }).map(bill => (
                <div key={bill.id} className={`flex items-center gap-2 bg-input border-4 border-black rounded-2xl px-3 py-2 ${bill.paused ? 'opacity-50' : ''}`}>
                  <input
                    type="text"
                    title="Bill name"
                    value={bill.name}
                    onChange={e => setConfigBills(bills => bills.map(b => b.id === bill.id ? { ...b, name: e.target.value } : b))}
                    className="flex-1 min-w-0 font-black uppercase text-sm text-text-main bg-transparent outline-none"
                  />
                  <div className="flex items-center gap-0.5 shrink-0">
                    <span className="text-[10px] font-black uppercase text-text-muted/60 tracking-widest">Day</span>
                    <input
                      type="number"
                      title="Day of month due (1-31)"
                      min="1"
                      max="31"
                      placeholder="—"
                      value={bill.dueDay}
                      onFocus={e => e.target.select()}
                      onChange={e => {
                        const v = e.target.value;
                        const n = parseInt(v, 10);
                        const clamped = v === '' ? '' : String(Math.min(31, Math.max(1, isNaN(n) ? 1 : n)));
                        setConfigBills(bills => bills.map(b => b.id === bill.id ? { ...b, dueDay: clamped } : b));
                      }}
                      className="w-10 font-black tabular-nums text-sm text-text-main bg-transparent outline-none text-center"
                    />
                  </div>
                  <input
                    type="number"
                    title="Bill amount"
                    min="0"
                    value={bill.amount}
                    onFocus={e => e.target.select()}
                    onChange={e => setConfigBills(bills => bills.map(b => b.id === bill.id ? { ...b, amount: e.target.value } : b))}
                    className="w-20 font-black tabular-nums text-sm text-text-main bg-transparent outline-none text-right shrink-0"
                  />
                  <button
                    type="button"
                    title={bill.paused ? 'Resume bill' : 'Pause bill (hidden from dashboard, not reserved)'}
                    onClick={() => setConfigBills(bills => bills.map(b => b.id === bill.id ? { ...b, paused: !b.paused } : b))}
                    className={`p-1 rounded-lg transition-colors shrink-0 ${bill.paused ? 'text-action-capture hover:bg-action-capture/10' : 'text-text-muted hover:bg-black/5'}`}
                  >
                    {bill.paused ? <Play size={14} strokeWidth={2.5} /> : <Pause size={14} strokeWidth={2.5} />}
                  </button>
                  <button
                    type="button"
                    title="Remove bill"
                    onClick={() => setConfigBills(bills => bills.filter(b => b.id !== bill.id))}
                    className="p-1 text-action-bleed hover:bg-action-bleed/10 rounded-lg transition-colors shrink-0"
                  >
                    <X size={14} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
              {isAddingBill ? (
                <div className="space-y-2">
                  {(() => {
                    const canConfirm = newBillName.trim() && parseFloat(newBillAmount) > 0 && parseInt(newBillDueDay, 10) >= 1 && parseInt(newBillDueDay, 10) <= 31;
                    const confirm = () => {
                      if (!canConfirm) return;
                      setConfigBills(bills => [...bills, { id: crypto.randomUUID(), name: newBillName.trim(), amount: newBillAmount, dueDay: newBillDueDay, paused: false }]);
                      setNewBillName(''); setNewBillAmount(''); setNewBillDueDay(''); setIsAddingBill(false);
                    };
                    return (
                      <>
                        <input
                          autoFocus
                          type="text"
                          placeholder="Bill name"
                          value={newBillName}
                          onChange={e => setNewBillName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') confirm(); }}
                          className="w-full bg-input border-4 border-black rounded-2xl p-2.5 font-black text-sm text-text-main outline-none focus:border-action-capture transition-colors"
                        />
                        <div className="flex gap-2 items-center">
                          <input
                            type="number"
                            min="0"
                            placeholder="Amount $"
                            value={newBillAmount}
                            onFocus={e => e.target.select()}
                            onChange={e => setNewBillAmount(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') confirm(); }}
                            className="flex-1 min-w-0 bg-input border-4 border-black rounded-2xl p-2.5 font-black text-sm text-text-main outline-none focus:border-action-capture transition-colors tabular-nums"
                          />
                          <input
                            type="number"
                            min="1"
                            max="31"
                            placeholder="Day"
                            title="Day of month (1-31)"
                            value={newBillDueDay}
                            onFocus={e => e.target.select()}
                            onChange={e => {
                              const v = e.target.value;
                              if (v === '') return setNewBillDueDay('');
                              const n = parseInt(v, 10);
                              setNewBillDueDay(String(Math.min(31, Math.max(1, isNaN(n) ? 1 : n))));
                            }}
                            onKeyDown={e => { if (e.key === 'Enter') confirm(); }}
                            className="w-16 bg-input border-4 border-black rounded-2xl p-2.5 font-black text-sm text-text-main outline-none focus:border-action-capture transition-colors tabular-nums text-center"
                          />
                          <button
                            type="button"
                            onClick={confirm}
                            disabled={!canConfirm}
                            title="Confirm bill"
                            className={`h-10 w-10 bg-action-capture border-4 border-black rounded-2xl flex items-center justify-center shrink-0 disabled:opacity-40 ${captureTxt}`}
                          >
                            <Check size={14} strokeWidth={3} />
                          </button>
                          <button
                            type="button"
                            title="Cancel"
                            onClick={() => { setIsAddingBill(false); setNewBillName(''); setNewBillAmount(''); setNewBillDueDay(''); }}
                            className="h-10 w-10 bg-surface border-4 border-black rounded-2xl flex items-center justify-center shrink-0"
                          >
                            <X size={14} strokeWidth={3} />
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingBill(true)}
                  className="w-full h-10 border-4 border-dashed border-border rounded-2xl text-[10px] font-black uppercase text-text-muted hover:border-black hover:text-text-main transition-all flex items-center justify-center gap-1"
                >
                  <Plus size={12} strokeWidth={3} /> Add Bill
                </button>
              )}
            </div>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted -mt-1">
            These reload automatically every time you save a new Pay Cycle · no re-entry needed each cycle.
          </p>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-text-muted block mb-2">Hard Daily Cap ($)</label>
            <input
              type="number"
              title="Hard Daily Cap"
              min="0"
              placeholder="No cap"
              value={horizonCap}
              onFocus={e => e.target.select()}
              onChange={e => setHorizonCap(e.target.value)}
              className="w-full bg-input border-4 border-black rounded-2xl p-3 font-black text-text-main outline-none focus:border-action-bleed transition-colors"
            />
            <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-1.5">The absolute maximum you are allowed to burn per day. Any surplus is automatically intercepted.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const parsedBills: BillQueueItem[] = configBills
                .map(b => {
                  const day = parseInt(b.dueDay, 10);
                  return {
                    id: b.id,
                    name: b.name,
                    amount: parseFloat(b.amount) || 0,
                    ...(day >= 1 && day <= 31 ? { dueDay: day } : {}),
                    ...(b.paused ? { paused: true } : {}),
                  };
                })
                .filter(b => b.amount > 0);
              setHorizon(
                parseFloat(String(horizonCapital)) || 0,
                horizonPayday,
                parsedBills.reduce((s, b) => s + b.amount, 0),
                parseFloat(String(horizonCap)) || 0,
                parsedBills
              );
              setHorizonSaved(true);
              setTimeout(() => setHorizonSaved(false), 2000);
            }}
            className={`h-12 px-8 border-4 border-black rounded-full bg-action-capture ${captureTxt} font-black uppercase text-xs tracking-widest shadow-[4px_4px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all flex items-center gap-2`}
          >
            {horizonSaved ? <><Check size={14} /> SAVED</> : 'Save Pay Cycle'}
          </button>
        </div>
      </Card>

      {/* Monthly Baseline (for subscription & savings rate widgets) */}
      <Card badge="MONTHLY BASELINE" badgeColor="bg-action-primary" badgeTextColor={primaryTxt}>
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Monthly income & savings goal · bills are pulled automatically from your Pay Cycle recurring bills</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-text-muted block mb-2">Monthly Take-Home ($)</label>
              <input
                type="number"
                title="Monthly Take-Home"
                min="0"
                value={baselineIncome}
                onFocus={e => e.target.select()}
                onChange={e => setBaselineIncome(e.target.value)}
                className="w-full bg-input border-4 border-black rounded-2xl p-3 font-black text-text-main outline-none focus:border-action-primary transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-text-muted block mb-2">Monthly Savings Goal ($)</label>
              <input
                type="number"
                title="Monthly Savings Goal"
                min="0"
                value={baselineSavings}
                onFocus={e => e.target.select()}
                onChange={e => setBaselineSavings(e.target.value)}
                className="w-full bg-input border-4 border-black rounded-2xl p-3 font-black text-text-main outline-none focus:border-action-primary transition-colors"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              updateBaseline(parseFloat(String(baselineIncome)) || 0, parseFloat(String(baselineSavings)) || 0);
              setBaselineSaved(true);
              setTimeout(() => setBaselineSaved(false), 2000);
            }}
            className={`h-12 px-8 border-4 border-black rounded-full bg-action-primary ${primaryTxt} font-black uppercase text-xs tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all flex items-center gap-2`}
          >
            {baselineSaved ? <><Check size={14} /> SAVED</> : 'Save Baseline'}
          </button>
        </div>
      </Card>

      {/* Debt Management */}
      <Card badge="DEBT MANAGEMENT" badgeColor="bg-action-bleed" badgeTextColor="text-white">
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Manage your debt accounts</p>
          {(state.debts || []).map(debt => (
            <div key={debt.id} className="bg-input border-4 border-black rounded-2xl p-4">
              {editingDebtId === debt.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input title="Debt Name" type="text" value={editDebtFields.name ?? debt.name} onChange={e => setEditDebtFields(f => ({ ...f, name: e.target.value }))} className="col-span-2 bg-surface border-4 border-black rounded-xl p-2 font-black text-sm text-black outline-none" placeholder="Name" />
                    <input title="Balance" type="number" min="0" value={editDebtFields.balance ?? debt.balance} onChange={e => setEditDebtFields(f => ({ ...f, balance: Number(e.target.value) }))} className="bg-surface border-4 border-black rounded-xl p-2 font-black text-sm text-black outline-none" placeholder="Balance" />
                    <input title="Interest Rate" type="number" min="0" value={editDebtFields.interestRate ?? debt.interestRate} onChange={e => setEditDebtFields(f => ({ ...f, interestRate: Number(e.target.value) }))} className="bg-surface border-4 border-black rounded-xl p-2 font-black text-sm text-black outline-none" placeholder="Rate %" />
                    <input title="Min Payment" type="number" min="0" value={editDebtFields.minPayment ?? debt.minPayment} onChange={e => setEditDebtFields(f => ({ ...f, minPayment: Number(e.target.value) }))} className="bg-surface border-4 border-black rounded-xl p-2 font-black text-sm text-black outline-none" placeholder="Min Payment" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { updateDebt(debt.id, editDebtFields); setEditingDebtId(null); setEditDebtFields({}); }} className={`flex items-center gap-1 px-4 h-11 bg-action-capture border-4 border-black rounded-full text-[10px] font-black uppercase ${captureTxt}`}><Check size={12} /> Save</button>
                    <button type="button" onClick={() => { setEditingDebtId(null); setEditDebtFields({}); }} className="flex items-center gap-1 px-4 h-11 bg-surface border-4 border-black rounded-full text-[10px] font-black uppercase"><X size={12} /> Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-black italic uppercase text-sm tracking-tighter text-text-main">{debt.name}</h4>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">${debt.balance.toLocaleString()} @ {debt.interestRate}% · Min ${debt.minPayment}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" aria-label="Edit debt" onClick={() => { setEditingDebtId(debt.id); setEditDebtFields({}); }} className="p-2 hover:bg-black/5 rounded-xl transition-colors"><Edit2 size={14} /></button>
                    <button type="button" aria-label="Delete debt" onClick={() => removeDebt(debt.id)} className="p-2 text-action-bleed hover:bg-action-bleed/10 rounded-xl transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {isAddingDebt ? (
            <div className="space-y-3 bg-input border-4 border-black rounded-2xl p-4">
              <div className="grid grid-cols-2 gap-2">
                <input autoFocus title="Debt Name" type="text" placeholder="Name (e.g. Credit Card A)" value={newDebtName} onChange={e => setNewDebtName(e.target.value)} className="col-span-2 bg-surface border-4 border-black rounded-xl p-2 font-black text-sm text-black outline-none focus:border-action-bleed transition-colors" />
                <input title="Balance" type="number" min="0" placeholder="Balance $" value={newDebtBalance} onChange={e => setNewDebtBalance(e.target.value)} className="bg-surface border-4 border-black rounded-xl p-2 font-black text-sm text-black outline-none" />
                <input title="Interest Rate" type="number" min="0" placeholder="Rate %" value={newDebtRate} onChange={e => setNewDebtRate(e.target.value)} className="bg-surface border-4 border-black rounded-xl p-2 font-black text-sm text-black outline-none" />
                <input title="Min Payment" type="number" min="0" placeholder="Min Payment $" value={newDebtMin} onChange={e => setNewDebtMin(e.target.value)} className="col-span-2 bg-surface border-4 border-black rounded-xl p-2 font-black text-sm text-black outline-none" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsAddingDebt(false)} className="px-4 h-11 bg-surface border-4 border-black rounded-full text-[10px] font-black uppercase">Cancel</button>
                <button
                  type="button"
                  onClick={() => {
                    if (newDebtName.trim() && newDebtBalance && newDebtRate && newDebtMin) {
                      addDebt({ name: newDebtName.trim(), balance: parseFloat(newDebtBalance), interestRate: parseFloat(newDebtRate), minPayment: parseFloat(newDebtMin) });
                      setIsAddingDebt(false); setNewDebtName(''); setNewDebtBalance(''); setNewDebtRate(''); setNewDebtMin('');
                    }
                  }}
                  className="px-4 h-11 bg-black text-action-primary border-4 border-black rounded-full text-[10px] font-black uppercase"
                >
                  Add Debt
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setIsAddingDebt(true)} className="w-full h-12 border-4 border-dashed border-border rounded-2xl text-[10px] font-black uppercase text-text-muted hover:border-action-bleed hover:text-action-bleed transition-all flex items-center justify-center gap-2">
              <Plus size={14} /> Add Debt Account
            </button>
          )}
        </div>
      </Card>

      {/* Habit Tracker */}
      <Card badge="HABIT TRACKER" badgeColor="bg-action-bleed" badgeTextColor="text-white">
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Configure habits and tax rates</p>
          {(state.impulses || []).map(impulse => (
            <div key={impulse.id} className="flex items-center justify-between p-4 bg-input border-4 border-black rounded-2xl">
              <div>
                <h4 className="font-black italic uppercase text-sm tracking-widest text-text-main">{impulse.name}</h4>
                <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Tax Rate: {(impulse.taxRate * 100)}%</p>
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min="0"
                  max="100"
                  title="Tax Rate %"
                  className="w-16 bg-surface border-4 border-black rounded-xl text-center font-black text-sm p-1 text-black outline-none"
                  value={impulseRates[impulse.id] ?? String(impulse.taxRate * 100)}
                  onChange={e => setImpulseRates(r => ({ ...r, [impulse.id]: e.target.value }))}
                  onBlur={e => {
                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                    setImpulses(state.impulses.map(imp => imp.id === impulse.id ? { ...imp, taxRate: val / 100 } : imp));
                    setImpulseRates(r => ({ ...r, [impulse.id]: String(val) }));
                  }}
                />
                <button type="button" aria-label="Delete habit" onClick={() => setImpulses(state.impulses.filter(imp => imp.id !== impulse.id))} className="p-2 text-action-bleed hover:bg-action-bleed/10 rounded-xl transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {isAddingConfigImpulse ? (
            <div className="flex flex-col md:flex-row gap-2">
              <input
                autoFocus
                placeholder="Habit Name"
                className="flex-1 bg-input border-4 border-black rounded-2xl p-3 text-sm font-black uppercase text-black outline-none focus:border-action-bleed transition-colors"
                value={newConfigImpulseName}
                onChange={e => setNewConfigImpulseName(e.target.value)}
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsAddingConfigImpulse(false)} className="px-4 h-12 bg-surface border-4 border-black rounded-2xl text-[10px] font-black uppercase text-text-main">Cancel</button>
                <button
                  type="button"
                  onClick={() => {
                    if (newConfigImpulseName.trim()) {
                      setImpulses([...(state.impulses || []), { id: Math.random().toString(36).substr(2, 9), name: newConfigImpulseName.trim(), taxRate: 0.5 }]);
                      setIsAddingConfigImpulse(false); setNewConfigImpulseName('');
                    }
                  }}
                  className={`px-4 h-12 bg-action-capture border-4 border-black rounded-2xl text-[10px] font-black uppercase ${captureTxt}`}
                >
                  Add
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddingConfigImpulse(true)}
              className="w-full h-12 border-4 border-dashed border-border rounded-2xl text-[10px] font-black uppercase text-text-muted hover:border-action-bleed hover:text-action-bleed transition-all"
            >
              + Add New Habit
            </button>
          )}
        </div>
      </Card>


      {/* Architect Note */}
      <div className="bg-input border-2 border-border rounded-3xl p-5">
        <p className="text-text-muted text-[10px] font-bold uppercase leading-relaxed">
          Your financial data is stored securely in your own private account, protected by row-level security so only you can access it. We never sell your data, and you can export or wipe it anytime.
        </p>
        <div className="flex gap-2 mt-3">
          <span className="bg-action-capture/20 text-capture-readable border-[3px] border-action-capture/30 px-3 py-1 rounded-full text-[10px] font-black uppercase">v2.1.0-STABLE</span>
          <span className="bg-action-primary/20 text-black border-[3px] border-action-primary/30 px-3 py-1 rounded-full text-[10px] font-black uppercase">PRIVATE ACCOUNT</span>
        </div>
      </div>
    </motion.div>
  );
}


