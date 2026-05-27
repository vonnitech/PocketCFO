import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, Shield, TrendingUp, X, Zap, Search, ChevronRight, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { formatCurrency } from '../lib/utils';
import { toLocalDateKey, calculateDaysUntilPayday } from '../core/math';
import { OnboardingModal } from '../components/Onboarding';
import { BottomSheet } from '../components/BottomSheet';
import { TransactionForm } from '../components/TransactionForm';

const HIDDEN_CATEGORIES = new Set(['SAVINGS', 'VAULT_DEPOSIT', 'PENALTY', 'VAULT_TRANSFER', 'VAULT_WITHDRAWAL']);

const SPEND_CATEGORIES = [
  { key: 'FOOD', label: 'Food' },
  { key: 'TRANSPORT', label: 'Transport' },
  { key: 'FUN', label: 'Fun' },
  { key: 'SHOPPING', label: 'Shopping' },
  { key: 'HEALTH', label: 'Health' },
  { key: 'HOME', label: 'Home' },
  { key: 'WORK', label: 'Work' },
  { key: 'OTHER', label: 'Other' },
];

function relativeDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Dashboard() {
  const { safeSpendLimit, liquidAssets, privacyMode, addIncome, vaults, debts, transactions, reconHistory, monthlyTakeHome, fixedBills, monthlySavingsGoal, nextPayday, upcomingBills, hardDailyCap, billQueue, payBillFromQueue, dashboardWidgets, firstName, hasCompletedOnboarding } = useStore();
  const widgetVisible = (id: string) => {
    const w = dashboardWidgets.find(x => x.id === id);
    return w ? w.visible : true;
  };
  const totalVaulted    = vaults.reduce((acc, v) => acc + v.current, 0);
  const investedVaulted = vaults.filter(v => v.asset_class === 'INVESTMENT').reduce((acc, v) => acc + v.current, 0);
  const savedVaulted    = totalVaulted - investedVaulted;
  const totalDebt = debts.reduce((acc, d) => acc + d.balance, 0);
  const netWorth = liquidAssets + totalVaulted - totalDebt;
  const isFirstTime = transactions.length === 0 && reconHistory.length === 0;

  const recentTxs = useMemo(() =>
    transactions
      .filter(tx => !HIDDEN_CATEGORIES.has(tx.category))
      .slice(0, 6),
    [transactions]
  );

  const { last7Days, streak } = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = toLocalDateKey(d);
      const spend = transactions
        .filter(tx => toLocalDateKey(tx.date) === key && !HIDDEN_CATEGORIES.has(tx.category) && tx.category !== 'INCOME' && tx.category !== 'DEBT_PAYMENT')
        .reduce((sum, tx) => sum + tx.amount, 0);
      return {
        key,
        spend,
        label: d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1),
        isToday: i === 6,
      };
    });

    let s = 0;
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (reconHistory.some(e => toLocalDateKey(e.date) === toLocalDateKey(d))) {
        s++;
      } else if (i < 6) {
        break;
      }
    }

    return { last7Days: days, streak: s };
  }, [transactions, reconHistory]);

  const { monthlySpend, monthlyIncome, monthlyBudget, monthlyPct, daysLeft, projectedSpend } = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthTxs = transactions.filter(tx => new Date(tx.date) >= monthStart);
    const spent = monthTxs
      .filter(tx => !HIDDEN_CATEGORIES.has(tx.category) && tx.category !== 'INCOME')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const income = monthTxs
      .filter(tx => tx.category === 'INCOME')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const spendable = Math.max(0, monthlyTakeHome - fixedBills - monthlySavingsGoal);
    const pct = spendable > 0 ? Math.min(100, (spent / spendable) * 100) : 0;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysElapsed = now.getDate();
    const projected = daysElapsed > 0 ? Math.round((spent / daysElapsed) * lastDay) : 0;
    return { monthlySpend: spent, monthlyIncome: income, monthlyBudget: spendable, monthlyPct: pct, daysLeft: lastDay - daysElapsed, projectedSpend: projected };
  }, [transactions, monthlyTakeHome, fixedBills, monthlySavingsGoal]);

  const topCategories = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const byCategory: Record<string, number> = {};
    transactions
      .filter(tx => new Date(tx.date) >= monthStart && !HIDDEN_CATEGORIES.has(tx.category) && tx.category !== 'INCOME')
      .forEach(tx => { byCategory[tx.category] = (byCategory[tx.category] || 0) + tx.amount; });
    const total = Object.values(byCategory).reduce((s, v) => s + v, 0);
    const labelMap = Object.fromEntries(SPEND_CATEGORIES.map(c => [c.key, c.label]));
    return Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, amount], i) => ({
        key, label: labelMap[key] ?? key, amount,
        pct: total > 0 ? (amount / total) * 100 : 0,
        delay: i * 0.06,
      }));
  }, [transactions]);

  const { targetRate, actualRate, actualSaved } = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const saved = transactions
      .filter(tx => new Date(tx.date) >= monthStart && (tx.category === 'VAULT_DEPOSIT' || tx.category === 'SAVINGS'))
      .reduce((sum, tx) => sum + tx.amount, 0);
    const target = monthlyTakeHome > 0 ? (monthlySavingsGoal / monthlyTakeHome) * 100 : 0;
    const actual = monthlyTakeHome > 0 ? (saved / monthlyTakeHome) * 100 : 0;
    return { targetRate: target, actualRate: Math.min(actual, 100), actualSaved: saved };
  }, [transactions, monthlyTakeHome, monthlySavingsGoal]);

  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const [isIncomeMode, setIsIncomeMode] = useState(false);
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeSource, setIncomeSource] = useState('');

  const handleAddIncome = () => {
    const amt = parseFloat(incomeAmount);
    if (!isNaN(amt) && amt > 0) {
      addIncome(amt, incomeSource || 'Extra Income');
      setIsIncomeMode(false);
      setIncomeAmount('');
      setIncomeSource('');
    }
  };

  const loggedToday = reconHistory.some(e => toLocalDateKey(e.date) === toLocalDateKey(new Date()));

  const hardCapSweep = useMemo(() => {
    if (!hardDailyCap || hardDailyCap <= 0 || !nextPayday) return 0;
    const days = calculateDaysUntilPayday(nextPayday);
    const raw = Math.max(0, (liquidAssets - (upcomingBills || 0)) / days);
    return Math.max(0, raw - hardDailyCap);
  }, [hardDailyCap, nextPayday, liquidAssets, upcomingBills]);

  const format = (val: number) => formatCurrency(val, false);
  const maskBal = (val: number) => privacyMode ? '••••••' : formatCurrency(val, false);

  return (
    <>
    <OnboardingModal />
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">
          {(() => {
            const h = new Date().getHours();
            const salutation = h >= 5 && h < 12 ? 'Good morning' : h >= 12 && h < 17 ? 'Good afternoon' : 'Good evening';
            return firstName ? `${salutation}, ${firstName}` : salutation;
          })()}
        </h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Log Spend trigger */}
      {hasCompletedOnboarding && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => setLogSheetOpen(true)}
          className="w-full h-12 flex items-center justify-center gap-2 bg-black border-4 border-black rounded-2xl text-action-primary font-black uppercase tracking-widest text-sm shadow-[4px_4px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
        >
          + LOG SPEND
        </motion.button>
      )}

      {/* Empty state — no balance set yet */}
      {liquidAssets === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-black border-4 border-border rounded-3xl p-6 shadow-[6px_6px_0px_0px_var(--color-action-primary)]"
        >
          <div className="inline-flex px-3 py-1 bg-action-capture border-2 border-black rounded-full text-black text-[10px] font-black tracking-widest uppercase mb-4">
            Welcome
          </div>
          <p className="text-white font-black uppercase text-sm leading-relaxed mb-1">
            Everything is set up.
          </p>
          <p className="text-white/60 text-[11px] font-bold uppercase tracking-wide leading-relaxed">
            Let's start by logging your current balance or creating your first savings vault.
          </p>
          <div className="flex gap-3 mt-5 flex-wrap">
            <Link
              to="/config"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-action-primary border-2 border-black rounded-xl text-black font-black text-[10px] uppercase tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
            >
              Log my balance <ChevronRight size={12} strokeWidth={3} />
            </Link>
            <Link
              to="/vaults"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-surface border-2 border-white/20 rounded-xl text-white font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all"
            >
              Create a vault <ChevronRight size={12} strokeWidth={3} />
            </Link>
          </div>
        </motion.div>
      )}

      {/* Horizon setup banner */}
      {!nextPayday && (
        <Link
          to="/config"
          className="flex items-center gap-4 bg-black border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all group"
        >
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-action-primary mb-0.5">Pay Cycle Not Set</p>
            <p className="text-white font-black uppercase text-sm">Set your bank balance & next payday →</p>
            <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mt-1">Your daily limit can't calculate without it</p>
          </div>
          <ChevronRight size={22} strokeWidth={3} className="text-action-primary shrink-0" />
        </Link>
      )}

      {/* ── Hero Row: Safe Spend (2/3) + Payday Countdown (1/3) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:items-start">
      {/* Safe Spend Hero */}
      {widgetVisible('safe-spend') && <div className="md:col-span-2 bg-surface border-4 border-border rounded-3xl p-6 shadow-[8px_8px_0px_0px_var(--shadow-color)] overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Daily Safe Spend</p>
        </div>
        <div className="flex items-end gap-4 mb-5">
          <div className="w-12 h-12 bg-action-capture border-[3px] border-black shadow-brutal-sm rounded-xl flex items-center justify-center shrink-0">
            <Wallet size={22} strokeWidth={3} className="text-black" />
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-0.5">You can safely spend</p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-5xl font-black italic tracking-tighter leading-none text-text-main tabular-nums break-all min-w-0">
                {maskBal(safeSpendLimit)}
              </span>
              <span className="text-text-muted text-sm font-bold uppercase tracking-widest shrink-0">today</span>
            </div>
          </div>
        </div>
        {!isFirstTime && (() => {
          const todaySpend = last7Days[6]?.spend ?? 0;
          const remaining = safeSpendLimit - todaySpend;
          const pct = safeSpendLimit > 0 ? Math.min(100, (todaySpend / safeSpendLimit) * 100) : 0;
          const barColor = pct >= 100 ? 'bg-action-bleed' : pct >= 80 ? 'bg-action-primary' : 'bg-action-capture';
          return (
            <div className="space-y-2">
              <div className="h-3 bg-input border-2 border-border rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${barColor}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: 'spring', stiffness: 200, damping: 30 }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                <span className="text-text-muted">{format(todaySpend)} spent today</span>
                <span className={remaining < 0 ? 'text-action-bleed font-black' : 'text-action-capture font-black'}>
                  {remaining < 0 ? `${format(Math.abs(remaining))} over` : `${format(remaining)} left`}
                </span>
              </div>
            </div>
          );
        })()}
        {hardCapSweep > 0 && (
          <div className="mt-3 px-3 py-2 bg-black border-2 border-black rounded-xl">
            <p className="font-mono text-[10px] font-black tracking-widest text-emerald-500">
              [SURPLUS INTERCEPTED: +${hardCapSweep.toFixed(2)} TO VAULT]
            </p>
          </div>
        )}
      </div>}

      {/* Payday Countdown */}
      {nextPayday && (() => {
        const days = calculateDaysUntilPayday(nextPayday);
        const paydayDate = new Date(nextPayday + 'T12:00:00');
        const paydayFormatted = paydayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const dots = Math.min(Math.max(days, 0), 12);
        const motivation =
          days === 0 ? 'Income hits today · log it now' :
          days === 1 ? 'Almost there · hold strong' :
          days <= 3 ? 'Finish line in sight · stay sharp' :
          days <= 7 ? 'Midpoint · watch your daily limit' :
          'Long stretch · trust the system';

        return (
          <div className={`border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--color-action-primary)] ${days === 0 ? 'bg-action-capture' : 'bg-black'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${days === 0 ? 'text-black/60' : 'text-white/60'}`}>
                  {days === 0 ? 'Payday' : 'Payday In'}
                </p>
                <div className="flex items-baseline gap-2">
                  {days === 0
                    ? <span className="text-4xl font-black italic tracking-tighter text-black leading-none">Today</span>
                    : <>
                        <span className="text-5xl font-black italic tracking-tighter text-action-primary tabular-nums leading-none">{days}</span>
                        <span className="text-[16px] font-black uppercase text-white/60">{days === 1 ? 'day' : 'days'}</span>
                      </>
                  }
                </div>
                <p className={`text-[10px] font-bold uppercase tracking-widest mt-2 ${days === 0 ? 'text-black/50' : 'text-white/40'}`}>
                  {paydayFormatted}
                </p>
                <p className={`text-[11px] font-bold uppercase tracking-wider mt-3 leading-tight ${days === 0 ? 'text-black/70' : 'text-white/50'}`}>
                  {motivation}
                </p>
              </div>
              {dots > 2 && (
                <div className="grid grid-cols-4 gap-1 shrink-0 pt-1">
                  {Array.from({ length: dots }, (_, i) => (
                    <div key={i} className={`w-3 h-3 rounded-sm ${i === 0 ? 'bg-action-primary' : 'bg-white/10'}`} />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}
      </div>

      {/* Bill Queue */}
      {widgetVisible('alert') && nextPayday && billQueue && billQueue.length > 0 && (
        <div className="bg-surface border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <div className="flex items-center justify-between mb-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-black border-2 border-black rounded-full text-action-primary text-[10px] font-black tracking-widest uppercase">
              BILL QUEUE
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">
              {format(billQueue.reduce((s, b) => s + b.amount, 0))} outstanding
            </span>
          </div>
          <div className="space-y-2">
            {billQueue.map(bill => (
              <button
                key={bill.id}
                type="button"
                onClick={() => payBillFromQueue(bill.id)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-input border-4 border-black rounded-2xl hover:border-action-capture hover:bg-action-capture/10 transition-all group"
              >
                <div className="w-5 h-5 rounded-md border-[3px] border-black bg-surface group-hover:bg-action-capture group-hover:border-black transition-all shrink-0" />
                <span className="font-black uppercase text-sm text-text-main flex-1 text-left truncate">{bill.name}</span>
                <span className="font-black tabular-nums text-sm text-text-main shrink-0">{format(bill.amount)}</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mt-3">
            Tap a bill to mark it paid · removes it from your upcoming total
          </p>
        </div>
      )}

      {/* Pillars */}
      {widgetVisible('vault-status') && <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] overflow-hidden min-h-fit">
          <div className="flex justify-between items-start mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Vaulted</p>
            <Shield size={18} className="text-action-capture shrink-0" strokeWidth={2.5} />
          </div>
          <p className="text-2xl font-black italic tracking-tighter text-text-main tabular-nums break-all min-w-0">{maskBal(totalVaulted)}</p>
          {totalVaulted > 0 && investedVaulted > 0 && savedVaulted > 0 ? (
            <div className="mt-2 space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-action-primary">{maskBal(investedVaulted)} invested</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">{maskBal(savedVaulted)} saved</p>
            </div>
          ) : (
            <p className="text-[11px] text-text-muted mt-2 font-bold uppercase tracking-wide">
              {investedVaulted > 0 ? 'Investments' : 'Goals & reserves'}
            </p>
          )}
        </div>

        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] overflow-hidden min-h-fit">
          <div className="flex justify-between items-start mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Spendable</p>
            <TrendingUp size={18} className="text-action-capture shrink-0" strokeWidth={2.5} />
          </div>
          <p className="text-2xl font-black italic tracking-tighter text-text-main tabular-nums break-all min-w-0">{maskBal(liquidAssets)}</p>
          {upcomingBills > 0 ? (
            <div className="mt-2 space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-action-bleed/80 tabular-nums">−{maskBal(upcomingBills)} bills reserved</p>
              <p className="text-[10px] font-black uppercase tracking-wide text-action-capture tabular-nums">{maskBal(Math.max(0, liquidAssets - upcomingBills))} free</p>
            </div>
          ) : (
            <p className="text-[11px] text-text-muted mt-2 font-bold uppercase tracking-wide">Available cash</p>
          )}
        </div>
      </div>}

      {/* ── Body Grid: 2-col masonry ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:items-start">

      {/* Net Worth */}
      {!isFirstTime && (liquidAssets > 0 || totalVaulted > 0 || totalDebt > 0) && (
        <div className="md:col-span-2 bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Net Worth</p>
            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border-2 border-black ${netWorth >= 0 ? 'bg-action-capture text-black' : 'bg-action-bleed text-white'}`}>
              {netWorth >= 0 ? 'Positive' : 'Negative'}
            </span>
          </div>
          <p className={`text-4xl font-black italic tracking-tighter tabular-nums break-all min-w-0 mb-4 ${netWorth >= 0 ? 'text-text-main' : 'text-action-bleed'}`}>
            {privacyMode ? '••••••' : (netWorth >= 0 ? '' : '-') + formatCurrency(Math.abs(netWorth), false)}
          </p>
          <div className="grid grid-cols-3 gap-2 pt-3 border-t-2 border-border/30">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Cash</p>
              <p className="font-black text-sm text-text-main tabular-nums">{maskBal(liquidAssets)}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-action-capture">Vaulted</p>
              <p className="font-black text-sm text-action-capture tabular-nums">+{maskBal(totalVaulted)}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-action-bleed">Debt</p>
              <p className="font-black text-sm text-action-bleed tabular-nums">{totalDebt > 0 ? `-${maskBal(totalDebt)}` : maskBal(0)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Net Cash Flow */}
      {!isFirstTime && monthlyIncome > 0 && (() => {
        const netFlow = monthlyIncome - monthlySpend;
        const isPositive = netFlow >= 0;
        return (
          <div className={`border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] ${isPositive ? 'bg-surface' : 'bg-action-bleed/5'}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Net Cash Flow</p>
              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border-2 border-current ${isPositive ? 'text-action-capture' : 'text-action-bleed'}`}>
                {isPositive ? 'Surplus' : 'Deficit'}
              </span>
            </div>
            <p className={`text-4xl font-black italic tracking-tighter tabular-nums break-all min-w-0 ${isPositive ? 'text-action-capture' : 'text-action-bleed'}`}>
              {isPositive ? '+' : '-'}{format(Math.abs(netFlow))}
            </p>
            <div className="flex gap-5 mt-3 pt-3 border-t-2 border-border/30">
              <div className="flex items-center gap-1.5">
                <ArrowDownLeft size={13} strokeWidth={2.5} className="text-action-capture shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted">{format(monthlyIncome)} in</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ArrowUpRight size={13} strokeWidth={2.5} className="text-action-bleed shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted">{format(monthlySpend)} out</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Monthly Budget Progress */}
      {!isFirstTime && monthlyBudget > 0 && (
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Monthly Budget</p>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-widest ${monthlyPct >= 90 ? 'text-action-bleed' : monthlyPct >= 70 ? 'text-action-primary' : 'text-action-capture'}`}>
                {monthlyPct.toFixed(0)}%
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted">{daysLeft}d left</span>
            </div>
          </div>
          <div className="h-3 bg-input border-2 border-border rounded-full overflow-hidden mb-2">
            <motion.div
              className={`h-full rounded-full ${monthlyPct >= 90 ? 'bg-action-bleed' : monthlyPct >= 70 ? 'bg-action-primary' : 'bg-action-capture'}`}
              initial={{ width: 0 }}
              animate={{ width: `${monthlyPct}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 30 }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wide text-text-muted">
            <span>{format(monthlySpend)} spent</span>
            <span>{format(monthlyBudget)} budget</span>
          </div>
          {projectedSpend > 0 && (
            <div className="flex justify-between text-[10px] mt-2 pt-2 border-t-2 border-border/30">
              <span className="font-bold uppercase tracking-wide text-text-muted">Month-end pace</span>
              <span className={`font-black uppercase tracking-widest ${projectedSpend > monthlyBudget ? 'text-action-bleed' : 'text-action-capture'}`}>
                ~{format(projectedSpend)} {projectedSpend > monthlyBudget ? '· over' : '· on track'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Savings Rate */}
      {!isFirstTime && monthlyTakeHome > 0 && (
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Savings Rate</p>
            <div className={`px-2.5 py-1 rounded-full border-2 border-black text-[11px] font-black uppercase tracking-widest ${
              actualRate >= 20 ? 'bg-action-capture text-black' :
              actualRate >= 10 ? 'bg-action-primary text-black' :
              'bg-action-bleed text-white'
            }`}>
              {actualRate >= 20 ? 'On Track' : actualRate >= 10 ? 'Getting There' : 'Build It Up'}
            </div>
          </div>
          <div className="flex items-end gap-5 mb-4">
            <div>
              <span className="text-4xl font-black italic tracking-tighter text-text-main tabular-nums">
                {actualRate.toFixed(1)}%
              </span>
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-1">
                {format(actualSaved)} saved this month
              </p>
            </div>
            <div className="mb-1 text-right flex-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Target</span>
              <p className="text-lg font-black italic tracking-tighter text-text-muted">{targetRate.toFixed(1)}%</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="h-3 bg-input border-2 border-border rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${
                  actualRate >= 20 ? 'bg-action-capture' :
                  actualRate >= 10 ? 'bg-action-primary' :
                  'bg-action-bleed'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${actualRate}%` }}
                transition={{ type: 'spring', stiffness: 200, damping: 30 }}
              />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
              Aim for 20%+ · target line shows your goal
            </p>
          </div>
        </div>
      )}

      {/* 7-Day Trend + Streak */}
      {widgetVisible('momentum') && !isFirstTime && (
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">7-Day Trend</p>
            {streak > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-action-primary border-2 border-black rounded-full">
                <span className="text-[11px] font-black uppercase tracking-widest text-black">{streak}d streak</span>
              </div>
            )}
          </div>
          <div className="flex items-end gap-1.5 h-16">
            {last7Days.map(day => {
              const ratio = safeSpendLimit > 0 ? day.spend / safeSpendLimit : 0;
              const barH = Math.max(4, Math.min(100, ratio * 100));
              const barColor = day.spend === 0
                ? 'bg-border'
                : ratio <= 1 ? 'bg-action-capture' : ratio <= 1.3 ? 'bg-action-primary' : 'bg-action-bleed';
              return (
                <div key={day.key} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end h-13">
                    <motion.div
                      className={`w-full rounded-t ${barColor} ${day.isToday ? 'ring-2 ring-black ring-offset-1' : ''}`}
                      initial={{ height: 0 }}
                      animate={{ height: `${barH}%` }}
                      transition={{ type: 'spring', stiffness: 200, damping: 28 }}
                    />
                  </div>
                  <span className={`text-[11px] font-bold uppercase ${day.isToday ? 'text-text-main font-black' : 'text-text-muted'}`}>
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t-2 border-border/30">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-action-capture" />
              <span className="text-[11px] font-bold uppercase text-text-muted">Under</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-action-primary" />
              <span className="text-[11px] font-bold uppercase text-text-muted">Near</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-action-bleed" />
              <span className="text-[11px] font-bold uppercase text-text-muted">Over</span>
            </div>
          </div>
        </div>
      )}

      {/* First-time welcome */}
      {isFirstTime && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="md:col-span-2 bg-black border-4 border-border rounded-3xl p-6 shadow-[6px_6px_0px_0px_var(--color-action-primary)]"
        >
          <div className="inline-flex px-3 py-1 bg-action-primary border-2 border-action-primary rounded-full text-black text-[10px] font-black tracking-widest uppercase mb-4">
            YOUR FIRST MOVE
          </div>
          <p className="text-white text-sm font-black uppercase leading-relaxed mb-5">
            Your daily limit is live. Now build the habit · log what you spend each day in Daily Log.
          </p>
          <div className="space-y-2">
            {[
              { to: '/recon', icon: Search, label: 'Daily Log', sub: 'Log today\'s spending · do this every day' },
              { to: '/vaults', icon: Shield, label: 'Create a Vault', sub: 'Set a savings goal (emergency fund, trip, etc.)' },
              { to: '/subscriptions', icon: X, label: 'Cancel a Subscription', sub: 'Find subscriptions you forgot about' },
            ].map(({ to, icon: Icon, label, sub }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 p-3 bg-surface/10 hover:bg-surface/20 border-[3px] border-white/20 hover:border-white/40 rounded-2xl transition-all group"
              >
                <Icon size={16} strokeWidth={3} className="text-action-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[11px] font-black uppercase tracking-widest">{label}</p>
                  <p className="text-white/50 text-[10px] font-black uppercase truncate">{sub}</p>
                </div>
                <ChevronRight size={14} strokeWidth={3} className="text-white/30 group-hover:text-white/60 transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* Top Categories */}
      {!isFirstTime && topCategories.length > 0 && (
        <div className="md:col-span-2 bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Where It Went</p>
            <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted">This Month</span>
          </div>
          <div className="space-y-3">
            {topCategories.map(cat => (
              <div key={cat.key}>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-text-main">{cat.label}</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[11px] font-bold uppercase text-text-muted">{cat.pct.toFixed(0)}%</span>
                    <span className="text-xs font-black tabular-nums text-text-main">{format(cat.amount)}</span>
                  </div>
                </div>
                <div className="h-2 bg-input border border-border rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-action-capture"
                    initial={{ width: 0 }}
                    animate={{ width: `${cat.pct}%` }}
                    transition={{ type: 'spring', stiffness: 220, damping: 32, delay: cat.delay }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Streak nudge */}
      {!isFirstTime && !loggedToday && streak > 0 && (
        <Link
          to="/recon"
          className="md:col-span-2 flex items-center gap-4 bg-action-primary border-4 border-black rounded-[28px] p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1.5 hover:translate-y-1.5 transition-all group"
        >
          <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shrink-0">
            <Zap size={18} strokeWidth={3} className="text-action-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-black">{streak}-day streak at risk</p>
            <p className="text-xs font-black uppercase text-black/60">Log today to keep it alive</p>
          </div>
          <ChevronRight size={18} strokeWidth={3} className="text-black shrink-0" />
        </Link>
      )}

      </div>{/* end body grid */}

      {/* Actions */}
      <div className="flex gap-4 flex-wrap">
        <button
          type="button"
          onClick={() => setIsIncomeMode(true)}
          className="flex-1 min-w-35 flex items-center justify-center gap-2 border-4 border-black bg-action-capture text-black font-black uppercase tracking-widest text-sm rounded-full h-14 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all whitespace-nowrap"
        >
          ADD INCOME
        </button>
        <Link
          to="/transactions"
          className="flex-1 min-w-25 flex items-center justify-center border-4 border-border bg-surface text-text-main font-black uppercase tracking-widest text-sm rounded-full h-14 shadow-[4px_4px_0px_0px_var(--shadow-color)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
        >
          HISTORY
        </Link>
        <Link
          to="/vaults"
          className="flex-1 min-w-25 flex items-center justify-center border-4 border-border bg-surface text-text-main font-black uppercase tracking-widest text-sm rounded-full h-14 shadow-[4px_4px_0px_0px_var(--shadow-color)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
        >
          SAVINGS
        </Link>
      </div>

      {/* Recent Activity */}
      {recentTxs.length > 0 && (
        <div className="bg-surface border-4 border-border rounded-3xl overflow-hidden shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Recent Activity</p>
            <Link to="/transactions" className="text-[10px] font-black uppercase tracking-widest text-text-main hover:text-action-capture transition-colors flex items-center gap-1">
              All <ChevronRight size={12} strokeWidth={3} />
            </Link>
          </div>
          <div className="divide-y-2 divide-border/40">
            {recentTxs.map(tx => {
              const isIncome = tx.category === 'INCOME';
              const isDebt = tx.category === 'DEBT_PAYMENT';
              return (
                <div key={tx.id} className="flex items-center gap-3 px-5 py-3">
                  <div className={`w-8 h-8 rounded-xl border-2 border-border flex items-center justify-center shrink-0 ${isIncome ? 'bg-action-capture border-black' : isDebt ? 'bg-action-primary border-black' : tx.isFlip ? 'bg-action-bleed border-black' : 'bg-input'}`}>
                    {isIncome
                      ? <ArrowDownLeft size={13} strokeWidth={2.5} className="text-black" />
                      : <ArrowUpRight size={13} strokeWidth={2.5} className={tx.isFlip ? 'text-white' : 'text-text-main'} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black uppercase tracking-wider text-text-main truncate">
                      {tx.merchant}
                    </p>
                    <p className="text-[10px] font-bold uppercase text-text-muted">{relativeDate(tx.date)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-black italic tabular-nums ${isIncome ? 'text-action-capture' : tx.isFlip ? 'text-action-bleed' : 'text-text-main'}`}>
                      {isIncome ? '+' : '-'}{format(tx.amount)}
                    </p>
                    {tx.isFlip && tx.flipAmount > 0 && (
                      <p className="text-[11px] font-bold uppercase text-action-bleed">{format(tx.flipAmount)} taxed</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </motion.div>

      {/* Log Spend Bottom Sheet */}
      <BottomSheet open={logSheetOpen} onClose={() => setLogSheetOpen(false)} title="Log a Spend">
        <TransactionForm onClose={() => setLogSheetOpen(false)} />
      </BottomSheet>

      {/* Add Income Modal */}
      <AnimatePresence>
        {isIncomeMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 50, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="bg-surface border-4 border-border rounded-3xl p-6 w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-3xl font-black italic tracking-tighter uppercase text-text-main">Add Income</h2>
                <button type="button" title="Close" onClick={() => setIsIncomeMode(false)} className="text-text-muted hover:text-text-main transition-colors">
                  <X size={24} />
                </button>
              </div>

              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-4">
                Adds to your liquid capital · raises your daily limit immediately
              </p>

              <div className="relative mb-3">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <span className="text-2xl font-black text-text-muted">$</span>
                </div>
                <input
                  type="number"
                  title="Income Amount"
                  className="w-full bg-input border-4 border-black rounded-2xl p-5 pl-12 text-3xl font-black outline-none focus:border-action-capture transition-colors text-text-main"
                  placeholder="0.00"
                  value={incomeAmount}
                  onChange={e => setIncomeAmount(e.target.value)}
                  onFocus={e => e.target.select()}
                  autoFocus
                />
              </div>

              <input
                type="text"
                title="Income Source"
                className="w-full bg-input border-4 border-black rounded-2xl p-4 text-sm font-black outline-none focus:border-action-capture transition-colors text-text-main mb-5 uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal placeholder:font-normal placeholder:text-text-muted"
                placeholder="Source (e.g. Gift from parents)"
                value={incomeSource}
                onChange={e => setIncomeSource(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddIncome()}
              />

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsIncomeMode(false)}
                  className="flex-1 h-14 border-4 border-border rounded-full bg-surface text-text-main font-black uppercase tracking-widest text-sm transition-all shadow-[4px_4px_0px_0px_var(--shadow-color)] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddIncome}
                  disabled={!incomeAmount || parseFloat(incomeAmount) <= 0}
                  className="flex-1 h-14 border-4 border-black rounded-full bg-action-capture text-black font-black uppercase tracking-widest text-sm transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 disabled:opacity-40"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
