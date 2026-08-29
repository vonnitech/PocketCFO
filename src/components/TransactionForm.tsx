import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useStore } from "../store/useStore";
import { useShallow } from "zustand/react/shallow";
import { formatCurrency } from "../lib/utils";

const CATEGORIES = [
  { key: "FOOD", label: "Food" },
  { key: "TRANSPORT", label: "Transport" },
  { key: "FUN", label: "Fun" },
  { key: "SHOPPING", label: "Shopping" },
  { key: "HEALTH", label: "Health" },
  { key: "HOME", label: "Home" },
  { key: "WORK", label: "Work" },
  { key: "OTHER", label: "Other" },
];

interface Props {
  onClose?: () => void;
  showHeader?: boolean;
}

export function TransactionForm({ onClose, showHeader = true }: Props = {}) {
  const { logSpend, safeSpendLimit } = useStore(
    useShallow((s) => ({
      logSpend: s.logSpend,
      safeSpendLimit: s.safeSpendLimit,
    })),
  );

  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const numAmt = parseFloat(amount) || 0;
  const isOver = numAmt > 0 && numAmt > safeSpendLimit;
  const penalty = isOver ? numAmt * 0.2 : 0;
  const canSubmit = numAmt > 0 && !!category && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    await logSpend(numAmt, merchant.trim() || "GENERAL", category);
    setSuccess(true);
    setAmount("");
    setMerchant("");
    setCategory("");
    setLoading(false);
    setTimeout(() => {
      setSuccess(false);
      onClose?.();
    }, 900);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-3"
    >
      {/* Header row */}
      {(showHeader || success) && (
        <div className="flex items-center justify-between overflow-hidden">
          {showHeader && (
            <p className="text-[10px] font-black uppercase tracking-widest text-text-muted truncate">
              Log a Spend
            </p>
          )}
          <AnimatePresence>
            {success && (
              <motion.span
                key="ok"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="text-[10px] font-black uppercase tracking-widest text-capture-readable shrink-0 ml-2"
              >
                LOGGED ✓
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Amount */}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-text-muted pointer-events-none select-none">
          $
        </span>
        <input
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onFocus={(e) => e.target.select()}
          className="w-full bg-transparent border-4 border-black rounded-2xl px-4 py-3 pl-9 font-mono font-black text-2xl text-text-main outline-none placeholder:text-text-muted/40 focus:bg-input transition-colors tabular-nums"
        />
      </div>

      {/* Merchant */}
      <input
        type="text"
        placeholder="Merchant (optional)"
        value={merchant}
        maxLength={40}
        onChange={(e) => setMerchant(e.target.value)}
        className="w-full bg-transparent border-4 border-black rounded-2xl px-4 py-3 font-mono font-bold text-sm text-text-main outline-none placeholder:text-text-muted/40 focus:bg-input transition-colors tracking-wide truncate"
      />

      {/* Category pills */}
      <div className="space-y-1.5">
        <p
          className={`text-[9px] font-black uppercase tracking-widest ${category ? "text-text-muted" : "text-action-bleed"}`}
        >
          Category required
        </p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setCategory(cat.key)}
              className={`shrink-0 px-3 py-1.5 border-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                category === cat.key
                  ? "bg-black text-action-primary border-black shadow-[2px_2px_0px_0px_var(--color-action-primary)]"
                  : "bg-input border-border text-text-muted hover:border-black hover:text-text-main"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Over-limit warning */}
      {isOver && (
        <div className="flex items-center justify-between bg-action-bleed/10 border-2 border-action-bleed rounded-xl px-4 py-2.5 overflow-hidden">
          <p className="text-[10px] font-black uppercase tracking-widest text-action-bleed truncate">
            Over by {formatCurrency(numAmt - safeSpendLimit)} ·{" "}
            {formatCurrency(penalty)} penalty to savings
          </p>
        </div>
      )}

      {/* Submit */}
      <motion.button
        type="submit"
        disabled={!canSubmit}
        whileTap={{ scale: 0.97 }}
        className="w-full h-12 bg-black border-4 border-black rounded-2xl text-action-primary font-black uppercase text-sm tracking-widest flex items-center justify-center shadow-[3px_3px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[3px_3px_0px_0px_var(--color-action-primary)]"
      >
        {loading ? (
          <span className="animate-pulse">LOGGING…</span>
        ) : (
          "LOG SPEND →"
        )}
      </motion.button>
    </form>
  );
}
