import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Wallet,
  Shield,
  TrendingUp,
  X,
  Zap,
  Search,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  SlidersHorizontal,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useStore } from "../store/useStore";
import { useShallow } from "zustand/react/shallow";
import { formatCurrency } from "../lib/utils";
import { currencySymbol } from "../lib/currency";
import { toLocalDateKey, calculateDaysUntilPayday, isCashInflow } from "../core/math";
import { OnboardingModal } from "../components/Onboarding";
import { NotificationBell } from "../components/NotificationCenter";
import { BottomSheet } from "../components/BottomSheet";
import { TransactionForm } from "../components/TransactionForm";
import { dueSubscriptionsBeforePayday } from "../store/useStore";

// Categories excluded from "discretionary spend" tallies. Bills + debt payments come from
// pre-reserved money (upcomingBills / debt minimums) — counting them as today's spend
// would double-deduct against the safe-spend allowance.
const HIDDEN_CATEGORIES = new Set([
  "SAVINGS",
  "VAULT_DEPOSIT",
  "PENALTY",
  "VAULT_TRANSFER",
  "VAULT_WITHDRAWAL",
  "BILL_PAYMENT",
  "SUBSCRIPTION_PAYMENT",
  "DEBT_PAYMENT",
]);

// Categories excluded from the Recent Activity feed — purely internal moves only.
// Bills and debt payments should remain visible so users have a paper trail.
const ACTIVITY_HIDDEN = new Set(["VAULT_TRANSFER"]);

const SPEND_CATEGORIES = [
  { key: "FOOD", label: "Food" },
  { key: "TRANSPORT", label: "Transport" },
  { key: "FUN", label: "Fun" },
  { key: "SHOPPING", label: "Shopping" },
  { key: "HEALTH", label: "Health" },
  { key: "HOME", label: "Home" },
  { key: "WORK", label: "Work" },
  { key: "OTHER", label: "Other" },
];

function contrastText(hex?: string): string {
  if (!hex || hex.length < 7) return "text-black";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.45
    ? "text-black"
    : "text-white";
}

function relativeDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Rotating pot colours. Written as complete literal class strings so Tailwind's
// scanner can see them; a template-built class name would be purged from the
// build. Every one takes black text, so they read the same in both themes.
const POT_COLORS = [
  "bg-[#FFD166]",
  "bg-[#7DE2D1]",
  "bg-[#FFADAD]",
  "bg-[#A0C4FF]",
  "bg-[#BDB2FF]",
  "bg-[#CAFFBF]",
];

export default function Dashboard() {
  const {
    safeSpendLimit,
    liquidAssets,
    privacyMode,
    addIncome,
    vaults,
    debts,
    transactions,
    reconHistory,
    monthlyTakeHome,
    fixedBills,
    monthlySavingsGoal,
    nextPayday,
    upcomingBills,
    hardDailyCap,
    billQueue,
    payBillFromQueue,
    subscriptions,
    paySubscription,
    dashboardWidgets,
    firstName,
    hasCompletedOnboarding,
    themeColors,
  } = useStore(
    useShallow((s) => ({
      safeSpendLimit: s.safeSpendLimit,
      liquidAssets: s.liquidAssets,
      privacyMode: s.privacyMode,
      addIncome: s.addIncome,
      vaults: s.vaults,
      debts: s.debts,
      transactions: s.transactions,
      reconHistory: s.reconHistory,
      monthlyTakeHome: s.monthlyTakeHome,
      fixedBills: s.fixedBills,
      monthlySavingsGoal: s.monthlySavingsGoal,
      nextPayday: s.nextPayday,
      upcomingBills: s.upcomingBills,
      hardDailyCap: s.hardDailyCap,
      billQueue: s.billQueue,
      payBillFromQueue: s.payBillFromQueue,
      subscriptions: s.subscriptions,
      paySubscription: s.paySubscription,
      dashboardWidgets: s.dashboardWidgets,
      firstName: s.firstName,
      hasCompletedOnboarding: s.hasCompletedOnboarding,
      themeColors: s.themeColors,
    })),
  );
  const captureTxt = contrastText(themeColors?.secondary);
  // Only an explicit `false` hides a widget. A record with a missing or malformed
  // `visible` flag reads as shown: silently hiding the app's headline number
  // because of a bad row is a far worse failure than showing a card someone
  // deliberately turned off.
  const widgetVisible = (id: string) => {
    const w = dashboardWidgets.find((x) => x.id === id);
    return w?.visible !== false;
  };
  const totalVaulted = vaults.reduce((acc, v) => acc + v.current, 0);
  // Discretionary money the user is free to spend, kept visually separate from
  // the long-term money that is meant to sit still.
  const discretionaryPots = vaults.filter(
    (v) => v.asset_class === "SINKING_FUND",
  );
  const longTermReserves = vaults.filter(
    (v) => v.asset_class !== "SINKING_FUND",
  );
  const longTermTotal = longTermReserves.reduce((acc, v) => acc + v.current, 0);
  const totalDebt = debts.reduce((acc, d) => acc + d.balance, 0);
  const netWorth = liquidAssets + totalVaulted - totalDebt;
  const isFirstTime = transactions.length === 0 && reconHistory.length === 0;
  const subscriptionQueue = useMemo(
    () => dueSubscriptionsBeforePayday(subscriptions, nextPayday),
    [subscriptions, nextPayday],
  );
  const billQueueTotal = useMemo(
    () => billQueue.reduce((sum, bill) => sum + bill.amount, 0),
    [billQueue],
  );
  const subscriptionQueueTotal = useMemo(
    () => subscriptionQueue.reduce((sum, sub) => sum + sub.amount, 0),
    [subscriptionQueue],
  );
  const obligationTotal = billQueueTotal + subscriptionQueueTotal;

  const recentTxs = useMemo(
    () =>
      transactions
        .filter((tx) => !ACTIVITY_HIDDEN.has(tx.category))
        .slice(0, 3),
    [transactions],
  );

  const { last7Days, streak } = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = toLocalDateKey(d);
      const spend = transactions
        .filter(
          (tx) =>
            toLocalDateKey(tx.date) === key &&
            !HIDDEN_CATEGORIES.has(tx.category) &&
            tx.category !== "INCOME" &&
            tx.category !== "DEBT_PAYMENT",
        )
        .reduce((sum, tx) => sum + tx.amount, 0);
      return {
        key,
        spend,
        label: d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1),
        isToday: i === 6,
      };
    });

    let s = 0;
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (
        reconHistory.some((e) => toLocalDateKey(e.date) === toLocalDateKey(d))
      ) {
        s++;
      } else if (i < 6) {
        break;
      }
    }

    return { last7Days: days, streak: s };
  }, [transactions, reconHistory]);

  const { monthlySpend, monthlyIncome, monthlyBudget, monthlyPct } =
    useMemo(() => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthTxs = transactions.filter(
        (tx) => new Date(tx.date) >= monthStart,
      );
      const spent = monthTxs
        .filter(
          (tx) =>
            !HIDDEN_CATEGORIES.has(tx.category) && tx.category !== "INCOME",
        )
        .reduce((sum, tx) => sum + tx.amount, 0);
      const income = monthTxs
        .filter((tx) => tx.category === "INCOME")
        .reduce((sum, tx) => sum + tx.amount, 0);
      const spendable = Math.max(
        0,
        monthlyTakeHome - fixedBills - monthlySavingsGoal,
      );
      const pct = spendable > 0 ? Math.min(100, (spent / spendable) * 100) : 0;
      const lastDay = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
      ).getDate();
      const daysElapsed = now.getDate();
      const projected =
        daysElapsed > 0 ? Math.round((spent / daysElapsed) * lastDay) : 0;
      return {
        monthlySpend: spent,
        monthlyIncome: income,
        monthlyBudget: spendable,
        monthlyPct: pct,
        daysLeft: lastDay - daysElapsed,
        projectedSpend: projected,
      };
    }, [transactions, monthlyTakeHome, fixedBills, monthlySavingsGoal]);

  const topCategories = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const byCategory: Record<string, number> = {};
    transactions
      .filter(
        (tx) =>
          new Date(tx.date) >= monthStart &&
          !HIDDEN_CATEGORIES.has(tx.category) &&
          tx.category !== "INCOME",
      )
      .forEach((tx) => {
        byCategory[tx.category] = (byCategory[tx.category] || 0) + tx.amount;
      });
    const total = Object.values(byCategory).reduce((s, v) => s + v, 0);
    const labelMap = Object.fromEntries(
      SPEND_CATEGORIES.map((c) => [c.key, c.label]),
    );
    return Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, amount], i) => ({
        key,
        label: labelMap[key] ?? key,
        amount,
        pct: total > 0 ? (amount / total) * 100 : 0,
        delay: i * 0.06,
      }));
  }, [transactions]);

  const { actualRate } = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const saved = transactions
      .filter(
        (tx) =>
          new Date(tx.date) >= monthStart &&
          (tx.category === "VAULT_DEPOSIT" || tx.category === "SAVINGS"),
      )
      .reduce((sum, tx) => sum + tx.amount, 0);
    const target =
      monthlyTakeHome > 0 ? (monthlySavingsGoal / monthlyTakeHome) * 100 : 0;
    const actual = monthlyTakeHome > 0 ? (saved / monthlyTakeHome) * 100 : 0;
    return {
      targetRate: target,
      actualRate: Math.min(actual, 100),
      actualSaved: saved,
    };
  }, [transactions, monthlyTakeHome, monthlySavingsGoal]);

  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const [isIncomeMode, setIsIncomeMode] = useState(false);
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeSource, setIncomeSource] = useState("");

  const handleAddIncome = () => {
    const amt = parseFloat(incomeAmount);
    if (!isNaN(amt) && amt > 0) {
      addIncome(amt, incomeSource || "Extra Income");
      setIsIncomeMode(false);
      setIncomeAmount("");
      setIncomeSource("");
    }
  };

  const loggedToday = reconHistory.some(
    (e) => toLocalDateKey(e.date) === toLocalDateKey(new Date()),
  );

  const hardCapSweep = useMemo(() => {
    if (!hardDailyCap || hardDailyCap <= 0 || !nextPayday) return 0;
    const days = calculateDaysUntilPayday(nextPayday);
    // Match calculateRawSafeSpend: obligations due before payday are always reserved
    const raw = Math.max(0, (liquidAssets - (upcomingBills || 0)) / days);
    return Math.max(0, raw - hardDailyCap);
  }, [hardDailyCap, nextPayday, liquidAssets, upcomingBills]);

  const format = (val: number) => formatCurrency(val, false);
  const maskBal = (val: number) =>
    privacyMode ? "••••••" : formatCurrency(val, false);
  // Whole-dollar (no cents) for tight summary stat cells — keeps the true amount,
  // just trims the noise so it fits on mobile instead of truncating.
  const fmtWhole = (val: number) =>
    `${currencySymbol()}${Math.round(Math.abs(val)).toLocaleString()}`;

  // Today's position against the daily number. Hoisted out of the hero card so
  // the card can respond to being over, not just the meter buried inside it.
  const todaySpend     = last7Days[6]?.spend ?? 0;
  const spendRemaining = safeSpendLimit - todaySpend;
  const spendPct       = safeSpendLimit > 0
    ? Math.min(100, (todaySpend / safeSpendLimit) * 100)
    : 0;
  const isOverToday    = !isFirstTime && spendRemaining < 0;
  const hasSpentToday  = todaySpend > 0.005;

  // The half-width pillars carry six-figure balances. `break-all` "handled"
  // the overflow by splitting them mid-digit ($427,701.0 / 0), which reads as
  // a rendering fault rather than a number. fmtWhole already exists for exactly
  // this ("tight summary stat cells... so it fits on mobile"); it just was not
  // wired up here. Privacy masking has to survive the switch, hence the wrapper.
  const maskWhole = (val: number) => (privacyMode ? "••••••" : fmtWhole(val));
  const pillarSize = (text: string) =>
    text.length <= 8 ? "text-2xl" : text.length <= 11 ? "text-xl" : "text-lg";
  const spendableText = maskWhole(liquidAssets);

  // Same treatment for the headline figures that sit at text-4xl. Cents are
  // kept here, unlike the pillars, because net worth is a figure people read
  // precisely rather than at a glance.
  const bigSize = (text: string) =>
    text.length <= 10 ? "text-4xl" : text.length <= 13 ? "text-3xl" : "text-2xl";
  const netWorthText = privacyMode
    ? "••••••"
    : (netWorth >= 0 ? "" : "-") + formatCurrency(Math.abs(netWorth), false);

  // Sized off the rendered string, so a four-figure amount steps down instead
  // of running into the edge of the card.
  const heroAmount = maskBal(safeSpendLimit);
  const heroSize =
    heroAmount.length <= 7 ? "text-6xl md:text-7xl"
    : heroAmount.length <= 9 ? "text-5xl md:text-6xl"
    : "text-4xl md:text-5xl";
  const spendBarColor  =
    spendPct >= 100 ? "bg-action-bleed"
    : spendPct >= 80 ? "bg-action-primary"
    : "bg-action-capture";

  if (!hasCompletedOnboarding) {
    return (
      <>
        <OnboardingModal />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">
              Finish Setup
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">
              Your dashboard unlocks after onboarding
            </p>
          </div>
          <div className="bg-black border-4 border-border rounded-3xl p-6 shadow-[6px_6px_0px_0px_var(--color-action-primary)]">
            <div className="inline-flex px-3 py-1 bg-action-primary border-2 border-black rounded-full text-black text-[10px] font-black tracking-widest uppercase mb-4">
              Setup Required
            </div>
            <p className="text-white font-black uppercase text-sm leading-relaxed">
              Add your balance, take-home pay, payday, and fixed bills to
              calculate your first daily limit.
            </p>
          </div>
        </motion.div>
      </>
    );
  }

  return (
    <>
      <OnboardingModal />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">
            {(() => {
              const h = new Date().getHours();
              const salutation =
                h >= 5 && h < 12
                  ? "Good morning"
                  : h >= 12 && h < 17
                    ? "Good afternoon"
                    : "Good evening";
              return firstName ? `${salutation}, ${firstName}` : salutation;
            })()}
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          </div>
          <NotificationBell />
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
            <div className="inline-flex px-3 py-1 bg-action-capture border-2 border-black rounded-full text-capture-contrast text-[10px] font-black tracking-widest uppercase mb-4">
              Welcome
            </div>
            <p className="text-white font-black uppercase text-sm leading-relaxed mb-1">
              Everything is set up.
            </p>
            <p className="text-white/60 text-[11px] font-bold uppercase tracking-wide leading-relaxed">
              Let's start by logging your current balance or creating your first
              savings vault.
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
              <p className="text-[10px] font-black uppercase tracking-widest text-action-primary mb-0.5">
                Pay Cycle Not Set
              </p>
              <p className="text-white font-black uppercase text-sm">
                Set your bank balance & next payday →
              </p>
              <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mt-1">
                Your daily limit can't calculate without it
              </p>
            </div>
            <ChevronRight
              size={22}
              strokeWidth={3}
              className="text-action-primary shrink-0"
            />
          </Link>
        )}

        {/* ── Hero Row: Safe Spend (2/3) + Payday Countdown (1/3) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:items-start">
          {/* Safe Spend Hero */}
          {widgetVisible("safe-spend") && (
            <div
              className={`md:col-span-2 bg-surface border-4 rounded-3xl p-6 shadow-[8px_8px_0px_0px_var(--shadow-color)] overflow-hidden transition-colors duration-300 ${
                isOverToday ? "border-action-bleed" : "border-border"
              }`}
            >
              {/* "today" lives in the label, not beside the number. Next to a
                  four-figure amount it had nowhere to sit and wrapped onto its
                  own line, where it read as a stray heading rather than the end
                  of the sentence. */}
              <div className="flex items-center gap-2 mb-1.5">
                <Wallet size={13} strokeWidth={3} className="text-text-muted shrink-0" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                  Cleared to spend today
                </p>
              </div>

              {/* The number. `break-all` is gone: it split currency figures
                  mid-digit ("£1,2 / 34.56"). Length-based sizing replaces it. */}
              <p className={`${heroSize} font-black italic tracking-tighter leading-[0.9] text-text-main tabular-nums mb-5`}>
                {heroAmount}
              </p>

              {/* Before anything is spent, "left" is the same figure as the one
                  above it and the meter is an empty grey slab. Both are noise,
                  so the quiet state gets one line instead. */}
              {!isFirstTime && !hasSpentToday && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                  Nothing spent yet
                </p>
              )}

              {!isFirstTime && hasSpentToday && (
                <div className="space-y-2.5">
                  {/* Meter in the house language: hard black border, squared
                      corners, thick enough to read without looking. */}
                  <div className="h-5 bg-input border-[3px] border-black rounded-lg overflow-hidden">
                    <motion.div
                      className={`h-full ${spendBarColor}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${spendPct}%` }}
                      transition={{ type: "spring", stiffness: 200, damping: 30 }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                      {format(todaySpend)} spent
                    </span>
                    {/* Promoted out of 10px grey text into a chip. This is the
                        figure someone actually checks mid-afternoon. */}
                    <span
                      className={`px-2.5 py-1 border-2 border-black rounded-lg text-[11px] font-black uppercase tracking-widest shrink-0 ${
                        isOverToday
                          ? "bg-action-bleed text-white"
                          : "bg-action-capture text-capture-contrast"
                      }`}
                    >
                      {isOverToday
                        ? `${format(Math.abs(spendRemaining))} over`
                        : `${format(spendRemaining)} left`}
                    </span>
                  </div>
                </div>
              )}
              {hardCapSweep > 0 && (
                <div className="mt-3 px-3 py-2 bg-black border-2 border-black rounded-xl">
                  <p className="font-mono text-[10px] font-black tracking-widest text-emerald-500">
                    [SURPLUS INTERCEPTED: +{format(hardCapSweep)} TO VAULT]
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Payday Countdown */}
          {nextPayday &&
            (() => {
              const days = calculateDaysUntilPayday(nextPayday);
              const paydayDate = new Date(nextPayday + "T12:00:00");
              const paydayFormatted = paydayDate.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
              const dots = Math.min(Math.max(days, 0), 12);
              const motivation =
                days === 0
                  ? "Income hits today · log it now"
                  : days === 1
                    ? "Almost there · hold strong"
                    : days <= 3
                      ? "Finish line in sight · stay sharp"
                      : days <= 7
                        ? "Midpoint · watch your daily limit"
                        : "Long stretch · trust the system";

              return (
                <div
                  className={`border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--color-action-primary)] ${days === 0 ? "bg-action-capture" : "bg-black"} ${!widgetVisible("safe-spend") ? "md:col-span-3" : ""}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${days === 0 ? "text-black/60" : "text-white/60"}`}
                      >
                        {days === 0 ? "Payday" : "Payday In"}
                      </p>
                      <div className="flex items-baseline gap-2">
                        {days === 0 ? (
                          <span className="text-4xl font-black italic tracking-tighter text-black leading-none">
                            Today
                          </span>
                        ) : (
                          <>
                            <span className="text-5xl font-black italic tracking-tighter text-action-primary tabular-nums leading-none">
                              {days}
                            </span>
                            <span className="text-[16px] font-black uppercase text-white/60">
                              {days === 1 ? "day" : "days"}
                            </span>
                          </>
                        )}
                      </div>
                      <p
                        className={`text-[10px] font-bold uppercase tracking-widest mt-2 ${days === 0 ? "text-black/50" : "text-white/40"}`}
                      >
                        {paydayFormatted}
                      </p>
                      <p
                        className={`text-[11px] font-bold uppercase tracking-wider mt-3 leading-tight ${days === 0 ? "text-black/70" : "text-white/50"}`}
                      >
                        {motivation}
                      </p>
                    </div>
                    {dots > 2 && (
                      <div className="grid grid-cols-4 gap-1 shrink-0 pt-1">
                        {Array.from({ length: dots }, (_, i) => (
                          <div
                            key={i}
                            className={`w-3 h-3 rounded-sm ${i === 0 ? "bg-action-primary" : "bg-white/10"}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
        </div>

        {/* Bill Queue */}
        {widgetVisible("alert") &&
          nextPayday &&
          obligationTotal > 0 &&
          (() => {
            const today = new Date();
            const startOfToday = new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate(),
            );
            // Days until a bill's dueDay, anchored to the CURRENT PAY CYCLE rather than
            // the calendar month. The cycle runs (nextPayday − 1 month) .. nextPayday, so
            // when payday is late in the month a bill due "the 1st" is next month's 1st
            // (upcoming), not this month's 1st (which would read as wrongly overdue).
            // Negative = overdue, 0 = due today, positive = upcoming.
            const daysUntil = (dueDay?: number): number | null => {
              if (!dueDay || dueDay < 1 || dueDay > 31) return null;
              const [ny, nm, nd] = nextPayday.split("-").map(Number); // nm is 1-based
              const cycleStart = new Date(ny, nm - 2, nd); // one month before next payday
              const yr = cycleStart.getFullYear();
              // JS Date handles month overflow (monthIdx 12 → next January), so this is
              // safe to call with cycleStart.getMonth() + 1.
              const placeInMonth = (monthIdx: number) => {
                const dim = new Date(yr, monthIdx + 1, 0).getDate();
                return new Date(
                  yr,
                  monthIdx,
                  Math.min(dueDay, dim),
                  0,
                  0,
                  0,
                  0,
                );
              };
              let due = placeInMonth(cycleStart.getMonth());
              if (due < cycleStart)
                due = placeInMonth(cycleStart.getMonth() + 1); // roll into next month
              return Math.round(
                (due.getTime() - startOfToday.getTime()) / 86_400_000,
              );
            };
            const daysUntilDate = (value?: string): number | null => {
              const key = (value || "").slice(0, 10);
              const [year, month, day] = key.split("-").map(Number);
              if (!year || !month || !day) return null;
              const due = new Date(year, month - 1, day, 0, 0, 0, 0);
              return Math.round(
                (due.getTime() - startOfToday.getTime()) / 86_400_000,
              );
            };
            const dueDateLabel = (value?: string): string => {
              const key = (value || "").slice(0, 10);
              const [year, month, day] = key.split("-").map(Number);
              if (!year || !month || !day) return "Date set";
              return new Date(year, month - 1, day).toLocaleDateString(
                "en-US",
                { month: "short", day: "numeric" },
              );
            };
            const sortedBills = [...billQueue].sort((a, b) => {
              const da = daysUntil(a.dueDay);
              const db = daysUntil(b.dueDay);
              if (da === null && db === null) return 0;
              if (da === null) return 1;
              if (db === null) return -1;
              return da - db;
            });
            const sortedSubscriptions = [...subscriptionQueue].sort((a, b) => {
              const da = daysUntilDate(a.nextBillingDate);
              const db = daysUntilDate(b.nextBillingDate);
              if (da === null && db === null) return 0;
              if (da === null) return 1;
              if (db === null) return -1;
              return da - db;
            });

            return (
              <div className="bg-surface border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
                <div className="flex items-center justify-between mb-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-black border-2 border-black rounded-full text-action-primary text-[10px] font-black tracking-widest uppercase">
                    OBLIGATION QUEUE
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">
                    {format(obligationTotal)}{" "}
                    outstanding
                  </span>
                </div>
                <div className="space-y-2">
                  {sortedBills.map((bill) => {
                    const d = daysUntil(bill.dueDay);
                    const isOverdue = d !== null && d < 0;
                    const isUrgent = d !== null && d >= 0 && d <= 3;
                    const dueLabel =
                      d === null
                        ? null
                        : isOverdue
                          ? `${Math.abs(d)}d overdue`
                          : d === 0
                            ? "Due today"
                            : `Due in ${d}d`;
                    const dueColor = isOverdue
                      ? "bg-action-bleed text-white border-action-bleed"
                      : isUrgent
                        ? "bg-action-primary text-primary-contrast border-black"
                        : "bg-input text-text-muted border-border";
                    return (
                      <button
                        key={bill.id}
                        type="button"
                        onClick={() => payBillFromQueue(bill.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 bg-input border-4 rounded-2xl hover:bg-action-capture/10 transition-all group ${isOverdue ? "border-action-bleed" : "border-black hover:border-action-capture"}`}
                      >
                        <div className="w-5 h-5 rounded-md border-[3px] border-black bg-surface group-hover:bg-action-capture group-hover:border-black transition-all shrink-0" />
                        <span className="font-black uppercase text-sm text-text-main flex-1 text-left truncate">
                          {bill.name}
                        </span>
                        {dueLabel && (
                          <span
                            className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border-2 ${dueColor} shrink-0`}
                          >
                            {dueLabel}
                          </span>
                        )}
                        <span className="font-black tabular-nums text-sm text-text-main shrink-0">
                          {format(bill.amount)}
                        </span>
                      </button>
                    );
                  })}
                  {sortedSubscriptions.map((sub) => {
                    const d = daysUntilDate(sub.nextBillingDate);
                    const isOverdue = d !== null && d < 0;
                    const isUrgent = d !== null && d >= 0 && d <= 3;
                    const dueLabel =
                      d === null
                        ? dueDateLabel(sub.nextBillingDate)
                        : isOverdue
                          ? `${Math.abs(d)}d overdue`
                          : d === 0
                            ? "Due today"
                            : `Due ${dueDateLabel(sub.nextBillingDate)}`;
                    const dueColor = isOverdue
                      ? "bg-action-bleed text-white border-action-bleed"
                      : isUrgent
                        ? "bg-action-primary text-primary-contrast border-black"
                        : "bg-input text-text-muted border-border";
                    const actionTitle =
                      d === 0
                        ? `${sub.name} due today · mark paid`
                        : `${sub.name} due ${dueDateLabel(sub.nextBillingDate)} · mark paid`;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        title={actionTitle}
                        onClick={() => paySubscription(sub.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 bg-input border-4 rounded-2xl hover:bg-action-capture/10 transition-all group ${isOverdue ? "border-action-bleed" : "border-black hover:border-action-capture"}`}
                      >
                        <div className="w-5 h-5 rounded-md border-[3px] border-black bg-action-primary/30 group-hover:bg-action-capture group-hover:border-black transition-all shrink-0" />
                        <span className="font-black uppercase text-sm text-text-main flex-1 text-left truncate">
                          {sub.name}
                        </span>
                        <span
                          className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border-2 ${dueColor} shrink-0`}
                        >
                          {dueLabel}
                        </span>
                        <span className="font-black tabular-nums text-sm text-text-main shrink-0">
                          {format(sub.amount)}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mt-3">
                  Tap an obligation to mark it paid · removes it from your
                  upcoming total
                </p>
              </div>
            );
          })()}

        {/* Pillars */}
        {widgetVisible("vault-status") && (
          <div className="grid grid-cols-2 gap-4">
            {/* Long-term money is deliberately quiet: thin border, muted type,
                no hard shadow. It is handled in the background, so it should not
                compete with the discretionary pots below. */}
            <div className="bg-surface border-2 border-border/50 rounded-3xl p-5 overflow-hidden min-h-fit">
              <div className="flex justify-between items-start mb-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Long-Term Reserves
                </p>
                <Shield
                  size={18}
                  className="text-text-muted shrink-0"
                  strokeWidth={2}
                />
              </div>
              <p className={`${pillarSize(maskWhole(longTermTotal))} font-black italic tracking-tighter text-text-muted tabular-nums`}>
                {maskWhole(longTermTotal)}
              </p>
              <p className="text-[11px] text-text-muted/70 mt-2 font-bold uppercase tracking-wide">
                Investments and reserves
              </p>
            </div>

            <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] overflow-hidden min-h-fit">
              <div className="flex justify-between items-start mb-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Spendable
                </p>
                <TrendingUp
                  size={18}
                  className="text-capture-readable shrink-0"
                  strokeWidth={2.5}
                />
              </div>
              <p className={`${pillarSize(spendableText)} font-black italic tracking-tighter text-text-main tabular-nums`}>
                {spendableText}
              </p>
              {upcomingBills > 0 ? (
                liquidAssets >= upcomingBills ? (
                  <div className="mt-2 space-y-0.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-action-bleed/80 tabular-nums">
                      −{maskWhole(upcomingBills)} reserved
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-wide text-capture-readable tabular-nums">
                      {maskWhole(Math.max(0, liquidAssets - upcomingBills))} free
                    </p>
                  </div>
                ) : (
                  <div className="mt-2 space-y-0.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-action-bleed/80 tabular-nums">
                      {maskWhole(upcomingBills)} due before payday
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-wide text-action-bleed tabular-nums">
                      {maskWhole(upcomingBills - liquidAssets)} short
                    </p>
                  </div>
                )
              ) : (
                <p className="text-[11px] text-text-muted mt-2 font-bold uppercase tracking-wide">
                  Available cash
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Sinking Funds ── */}
        {discretionaryPots.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3">
              Sinking Funds
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {discretionaryPots.map((pot, i) => {
                const pct =
                  pot.target > 0
                    ? Math.min(100, (pot.current / pot.target) * 100)
                    : 0;
                return (
                  <Link
                    key={pot.id}
                    to="/vaults"
                    className={`${POT_COLORS[i % POT_COLORS.length]} border-[3px] border-black rounded-3xl p-4 shadow-[4px_4px_0px_0px_var(--shadow-color)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all overflow-hidden`}
                  >
                    <p className="text-[10px] font-black uppercase tracking-widest text-black/60 truncate">
                      {pot.name}
                    </p>
                    <p className="text-2xl font-black italic tracking-tighter text-black tabular-nums mt-1">
                      {maskWhole(pot.current)}
                    </p>
                    {/* Meter only means something against a target. */}
                    {pot.target > 0 && (
                      <>
                        <div className="h-3 bg-black/10 border-2 border-black rounded-full overflow-hidden mt-3">
                          <motion.div
                            className="h-full bg-black"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ type: "spring", stiffness: 200, damping: 30 }}
                          />
                        </div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-black/60 mt-1.5 tabular-nums">
                          {pct.toFixed(0)}% of {maskWhole(pot.target)}
                        </p>
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Body Grid: 2-col masonry ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:items-start">
          {/* Net Worth */}
          {!isFirstTime &&
            (liquidAssets > 0 || totalVaulted > 0 || totalDebt > 0) && (
              <div className="md:col-span-2 bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    Net Worth
                  </p>
                  <span
                    className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border-2 border-black ${netWorth >= 0 ? `bg-action-capture ${captureTxt}` : "bg-action-bleed text-white"}`}
                  >
                    {netWorth >= 0 ? "Positive" : "Negative"}
                  </span>
                </div>
                <p
                  className={`${bigSize(netWorthText)} font-black italic tracking-tighter tabular-nums mb-4 ${netWorth >= 0 ? "text-text-main" : "text-action-bleed"}`}
                >
                  {netWorthText}
                </p>
                <div className="grid grid-cols-3 gap-2 pt-3 border-t-2 border-border/30">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted">
                      Cash
                    </p>
                    <p className="font-black text-sm text-text-main tabular-nums">
                      {maskBal(liquidAssets)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-capture-readable">
                      Vaulted
                    </p>
                    <p className="font-black text-sm text-text-main tabular-nums">
                      +{maskBal(totalVaulted)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-action-bleed">
                      Debt
                    </p>
                    <p className="font-black text-sm text-action-bleed tabular-nums">
                      {totalDebt > 0 ? `-${maskBal(totalDebt)}` : maskBal(0)}
                    </p>
                  </div>
                </div>
              </div>
            )}

          {/* Month at a Glance — net flow, budget pace, savings rate compressed into one strip */}
          {!isFirstTime &&
            (monthlyIncome > 0 || monthlyBudget > 0 || monthlyTakeHome > 0) &&
            (() => {
              const netFlow = monthlyIncome - monthlySpend;
              const netPositive = netFlow >= 0;
              const showNetFlow = monthlyIncome > 0;
              const showBudget = monthlyBudget > 0;
              const showSavings = monthlyTakeHome > 0;
              const netClass = netPositive
                ? "text-text-main"
                : "text-action-bleed";
              const budgetClass =
                monthlyPct >= 90
                  ? "text-action-bleed"
                  : monthlyPct >= 70
                    ? "text-action-primary"
                    : "text-text-main";
              const savingsClass =
                actualRate >= 20
                  ? "text-text-main"
                  : actualRate >= 10
                    ? "text-action-primary"
                    : "text-action-bleed";
              return (
                <div className="md:col-span-2 bg-surface border-4 border-border rounded-3xl p-4 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
                  <div className="grid grid-cols-3 gap-3">
                    {/* Net Flow */}
                    <div
                      className={`min-w-0 ${showBudget || showSavings ? "border-r-2 border-black dark:border-white pr-3" : ""}`}
                    >
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-wide leading-tight min-h-[2.2em]">
                        Net Flow
                      </p>
                      <p
                        className={`text-sm sm:text-xl font-black tabular-nums mt-0.5 truncate ${netClass}`}
                      >
                        {showNetFlow
                          ? `${netPositive ? "+" : "−"}${fmtWhole(netFlow)}`
                          : "—"}
                      </p>
                    </div>

                    {/* Budget Spent */}
                    <div
                      className={`min-w-0 ${showSavings ? "border-r-2 border-black dark:border-white pr-3" : ""}`}
                    >
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-wide leading-tight min-h-[2.2em]">
                        Budget Spent
                      </p>
                      <p
                        className={`text-sm sm:text-xl font-black tabular-nums mt-0.5 truncate ${budgetClass}`}
                      >
                        {showBudget ? `${monthlyPct.toFixed(0)}%` : "—"}
                      </p>
                    </div>

                    {/* Savings Rate */}
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-wide leading-tight min-h-[2.2em]">
                        Savings Rate
                      </p>
                      <p
                        className={`text-sm sm:text-xl font-black tabular-nums mt-0.5 truncate ${savingsClass}`}
                      >
                        {showSavings ? `${actualRate.toFixed(1)}%` : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

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
                Your daily limit is live. Now build the habit · log purchases
                from the dashboard, then close the day with Daily Review.
              </p>
              <div className="space-y-2">
                {[
                  {
                    to: "/recon",
                    icon: Search,
                    label: "Daily Review",
                    sub: "Review today's spend and catch anything missed",
                  },
                  {
                    to: "/vaults",
                    icon: Shield,
                    label: "Create a Vault",
                    sub: "Set a savings goal (emergency fund, trip, etc.)",
                  },
                  {
                    to: "/subscriptions",
                    icon: X,
                    label: "Cancel a Subscription",
                    sub: "Find subscriptions you forgot about",
                  },
                ].map(({ to, icon: Icon, label, sub }) => (
                  <Link
                    key={to}
                    to={to}
                    className="flex items-center gap-3 p-3 bg-surface/10 hover:bg-surface/20 border-[3px] border-white/20 hover:border-white/40 rounded-2xl transition-all group"
                  >
                    <Icon
                      size={16}
                      strokeWidth={3}
                      className="text-action-primary shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-[11px] font-black uppercase tracking-widest">
                        {label}
                      </p>
                      <p className="text-white/50 text-[10px] font-black uppercase truncate">
                        {sub}
                      </p>
                    </div>
                    <ChevronRight
                      size={14}
                      strokeWidth={3}
                      className="text-white/30 group-hover:text-white/60 transition-colors shrink-0"
                    />
                  </Link>
                ))}
              </div>
            </motion.div>
          )}

          {/* Top Categories */}
          {!isFirstTime && topCategories.length > 0 && (
            <div className="md:col-span-2 bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Where It Went
                </p>
                <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
                  This Month
                </span>
              </div>
              <div className="space-y-3">
                {topCategories.map((cat) => (
                  <div key={cat.key}>
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-text-main">
                        {cat.label}
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-[11px] font-bold uppercase text-text-muted">
                          {cat.pct.toFixed(0)}%
                        </span>
                        <span className="text-xs font-black tabular-nums text-text-main">
                          {format(cat.amount)}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-input border border-border rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-action-capture"
                        initial={{ width: 0 }}
                        animate={{ width: `${cat.pct}%` }}
                        transition={{
                          type: "spring",
                          stiffness: 220,
                          damping: 32,
                          delay: cat.delay,
                        }}
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
                <Zap
                  size={18}
                  strokeWidth={3}
                  className="text-action-primary"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-black">
                  {streak}-day streak at risk
                </p>
                <p className="text-xs font-black uppercase text-black/60">
                  Review today to keep it alive
                </p>
              </div>
              <ChevronRight
                size={18}
                strokeWidth={3}
                className="text-black shrink-0"
              />
            </Link>
          )}
        </div>
        {/* end body grid */}

        {/* Actions */}
        <div className="flex gap-4 flex-wrap">
          <button
            type="button"
            onClick={() => setIsIncomeMode(true)}
            className="flex-1 min-w-35 flex items-center justify-center gap-2 border-4 border-black bg-action-capture text-capture-contrast font-black uppercase tracking-widest text-sm rounded-full h-14 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all whitespace-nowrap"
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
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Recent Activity
              </p>
              <Link
                to="/transactions"
                className="text-[10px] font-black uppercase tracking-widest text-text-main hover:text-capture-readable transition-colors flex items-center gap-1"
              >
                All <ChevronRight size={12} strokeWidth={3} />
              </Link>
            </div>
            <div className="divide-y-2 divide-border/40">
              {recentTxs.map((tx) => {
                // A vault withdrawal raises the cash balance just as income does,
                // so it takes the inflow arrow, the "+" sign and the inflow colour.
                // Testing for "INCOME" alone showed withdrawals as money leaving.
                const isIncome = isCashInflow(tx.category);
                const isDebt = tx.category === "DEBT_PAYMENT";
                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <div
                      className={`w-8 h-8 rounded-xl border-2 border-border flex items-center justify-center shrink-0 ${isIncome ? "bg-action-capture border-black" : isDebt ? "bg-action-primary border-black" : tx.isFlip ? "bg-action-bleed border-black" : "bg-input"}`}
                    >
                      {isIncome ? (
                        <ArrowDownLeft
                          size={13}
                          strokeWidth={2.5}
                          className="text-black"
                        />
                      ) : (
                        <ArrowUpRight
                          size={13}
                          strokeWidth={2.5}
                          className={
                            tx.isFlip ? "text-white" : "text-text-main"
                          }
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black uppercase tracking-wider text-text-main truncate">
                        {tx.merchant}
                      </p>
                      <p className="text-[10px] font-bold uppercase text-text-muted">
                        {relativeDate(tx.date)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-sm font-black italic tabular-nums ${isIncome ? "text-capture-readable" : tx.isFlip ? "text-action-bleed" : "text-text-main"}`}
                      >
                        {isIncome ? "+" : "-"}
                        {format(tx.amount)}
                      </p>
                      {tx.isFlip && tx.flipAmount > 0 && (
                        <p className="text-[11px] font-bold uppercase text-action-bleed">
                          {format(tx.flipAmount)} taxed
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Long dashboard? Jump straight to the widget toggles to trim the scroll. */}
        <Link
          to="/settings#dashboard-widgets"
          className="flex items-center justify-center gap-1.5 py-3 text-[11px] font-bold uppercase tracking-widest text-text-muted hover:text-text-main transition-colors"
        >
          <SlidersHorizontal size={12} strokeWidth={2.5} /> Customize dashboard
        </Link>
      </motion.div>

      {/* Log Spend Bottom Sheet */}
      <BottomSheet
        open={logSheetOpen}
        onClose={() => setLogSheetOpen(false)}
        title="Log a Spend"
      >
        <TransactionForm
          onClose={() => setLogSheetOpen(false)}
          showHeader={false}
        />
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
                <h2 className="text-3xl font-black italic tracking-tighter uppercase text-text-main">
                  Add Income
                </h2>
                <button
                  type="button"
                  title="Close"
                  aria-label="Close"
                  onClick={() => setIsIncomeMode(false)}
                  className="text-text-muted hover:text-text-main transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-4">
                Adds to your liquid capital · raises your daily limit
                immediately
              </p>

              <div className="relative mb-3">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <span className="text-2xl font-black text-text-muted">
                    {currencySymbol()}
                  </span>
                </div>
                <input
                  type="number"
                  title="Income Amount"
                  className="w-full bg-input border-4 border-black rounded-2xl p-5 pl-12 text-3xl font-black outline-none focus:border-action-capture transition-colors text-text-main"
                  placeholder="0.00"
                  value={incomeAmount}
                  onChange={(e) => setIncomeAmount(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  autoFocus
                />
              </div>

              <input
                type="text"
                title="Income Source"
                className="w-full bg-input border-4 border-black rounded-2xl p-4 text-sm font-black outline-none focus:border-action-capture transition-colors text-text-main mb-5 uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal placeholder:font-normal placeholder:text-text-muted"
                placeholder="Source (e.g. Gift from parents)"
                value={incomeSource}
                onChange={(e) => setIncomeSource(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddIncome()}
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
                  className="flex-1 h-14 border-4 border-black rounded-full bg-action-capture text-capture-contrast font-black uppercase tracking-widest text-sm transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 disabled:opacity-40"
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
