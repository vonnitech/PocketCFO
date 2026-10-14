import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trash2, PiggyBank } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../store/useStore';
import { formatCurrency } from '../lib/utils';
import { currencySymbol } from '../lib/currency';
import { toLocalDateKey } from '../core/math';
import {
  daysOfCleared, describeDays, daysSince,
  NAME_MAX_LENGTH, REASON_MAX_LENGTH,
  type WishlistItem,
} from '../lib/wishlist';
import {
  fetchWishlist, addWishlistItem, setWishlistState, removeWishlistItem,
} from '../core/personalData';

/**
 * A holding list for things you want, priced in days of your own cleared amount.
 *
 * Deliberately not a shopping tool: no links, no images, no prices fetched from
 * anywhere. Writing the thing down and seeing what it costs in days is the
 * entire mechanism.
 *
 * There is no total, anywhere. The sum of what you want is a guilt number and
 * the sum of what you dropped is a vanity one, and neither describes something
 * that happened. The obvious "helpful" addition here is the one to refuse.
 */
export default function Wishlist() {
  const navigate = useNavigate();
  const { userId, safeSpendLimit, privacyMode, addVault } = useStore(
    useShallow((s) => ({
      userId:         s.userId,
      safeSpendLimit: s.safeSpendLimit,
      privacyMode:    s.privacyMode,
      addVault:       s.addVault,
    })),
  );

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void fetchWishlist(userId).then((rows) => { if (!cancelled) setItems(rows); });
    return () => { cancelled = true; };
  }, [userId]);

  const wanted  = useMemo(() => items.filter((i) => i.state === 'wanted'), [items]);
  const decided = useMemo(() => items.filter((i) => i.state !== 'wanted'), [items]);

  const money = (v: number) => formatCurrency(v, privacyMode);

  const submit = async () => {
    const value = parseFloat(amount);
    if (!userId || !name.trim() || !Number.isFinite(value) || value <= 0) return;
    const created = await addWishlistItem(
      userId,
      name.trim().slice(0, NAME_MAX_LENGTH),
      value,
      reason.trim().slice(0, REASON_MAX_LENGTH) || undefined,
      toLocalDateKey(new Date()),
    );
    // The row is the source of truth, so the list only grows once the write has
    // succeeded. Adding locally first would show an item that is not there.
    if (!created) return;
    setItems([created, ...items]);
    setName(''); setAmount(''); setReason(''); setAdding(false);
  };

  const setState = async (id: string, state: WishlistItem['state']) => {
    if (!userId) return;
    setItems(items.map((i) => (i.id === id ? { ...i, state } : i)));
    await setWishlistState(userId, id, state);
  };

  const remove = async (id: string) => {
    if (!userId) return;
    setItems(items.filter((i) => i.id !== id));
    await removeWishlistItem(userId, id);
  };

  // Turning a want into a plan. The vault is the thing the app already knows how
  // to fill, so this hands the item over rather than inventing a second way to
  // save for something.
  const saveForIt = async (item: WishlistItem) => {
    await addVault(item.name, item.amount, 'SINKING_FUND');
    await setState(item.id, 'bought');
    navigate('/vaults');
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">
          Wishlist
        </h1>
        <p className="mt-1.5 text-[10px] font-bold uppercase tracking-widest text-text-muted">
          Things you want, priced in days
        </p>
      </div>

      {/* ── add ───────────────────────────────────────────────────────────── */}
      {adding ? (
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-3">
          <input
            autoFocus
            value={name}
            maxLength={NAME_MAX_LENGTH}
            onChange={(e) => setName(e.target.value)}
            placeholder="What is it"
            className="w-full rounded-2xl border-[3px] border-border bg-input p-3 text-sm font-black uppercase tracking-wide text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-action-primary"
          />
          <div className="flex items-center gap-2 rounded-2xl border-[3px] border-border bg-input px-3">
            <span className="font-black text-text-muted">{currencySymbol()}</span>
            <input
              value={amount}
              inputMode="decimal"
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="min-w-0 flex-1 bg-transparent py-3 text-sm font-black text-text-main placeholder:text-text-muted/60 focus:outline-none"
            />
          </div>
          <input
            value={reason}
            maxLength={REASON_MAX_LENGTH}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why you want it (optional)"
            className="w-full rounded-2xl border-[3px] border-border bg-input p-3 text-sm font-bold text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-action-primary"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void submit()}
              className="dark:bg-action-primary dark:text-primary-contrast dark:border-action-primary dark:shadow-none flex h-12 items-center justify-center rounded-2xl border-4 border-black bg-black text-[11px] font-black uppercase tracking-widest text-action-primary shadow-[4px_4px_0px_0px_var(--color-action-primary)] transition-all hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5"
            >
              Add to list
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setName(''); setAmount(''); setReason(''); }}
              className="flex h-12 items-center justify-center rounded-2xl border-4 border-border bg-input text-[11px] font-black uppercase tracking-widest text-text-main"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-4 border-dashed border-border text-[10px] font-black uppercase tracking-widest text-text-muted transition-colors hover:text-text-main"
        >
          <Plus size={14} strokeWidth={3} /> Add something you want
        </button>
      )}

      {/* ── wanted ────────────────────────────────────────────────────────── */}
      {wanted.length === 0 && !adding && (
        <div className="bg-surface border-4 border-border rounded-3xl p-10 shadow-[6px_6px_0px_0px_var(--shadow-color)] text-center">
          <p className="text-xl font-black italic uppercase text-text-main">Nothing on the list</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-text-muted">
            Write something down instead of buying it today
          </p>
        </div>
      )}

      {wanted.map((item) => {
        const lens = describeDays(daysOfCleared(item.amount, safeSpendLimit));
        const sat  = daysSince(item.addedOn);
        return (
          <div
            key={item.id}
            className="bg-surface border-4 border-border rounded-2xl p-4 shadow-[4px_4px_0px_0px_var(--shadow-color)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-black uppercase italic tracking-tight text-text-main break-words">
                  {item.name}
                </h3>
                {item.reason && (
                  <p className="mt-1 text-xs font-bold text-text-muted break-words">{item.reason}</p>
                )}
              </div>
              <p className="shrink-0 font-black italic text-text-main">{money(item.amount)}</p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {lens && (
                <span className="inline-flex rounded-full border-2 border-black bg-action-primary px-3 py-1 font-mono text-[10px] font-black uppercase tracking-widest text-black">
                  {lens}
                </span>
              )}
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-muted">
                {sat === 0 ? 'Added today' : sat === 1 ? 'Waiting 1 day' : `Waiting ${sat} days`}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => void saveForIt(item)}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border-[3px] border-border bg-input text-[10px] font-black uppercase tracking-widest text-text-main"
              >
                <PiggyBank size={13} strokeWidth={3} /> Save for it
              </button>
              <button
                type="button"
                onClick={() => void setState(item.id, 'bought')}
                className="flex h-10 items-center justify-center rounded-xl border-[3px] border-border bg-input text-[10px] font-black uppercase tracking-widest text-text-main"
              >
                Got it
              </button>
              {/* No praise here. Dropping something is ordinary, not a win. */}
              <button
                type="button"
                onClick={() => void setState(item.id, 'dropped')}
                className="flex h-10 items-center justify-center rounded-xl border-[3px] border-border bg-input text-[10px] font-black uppercase tracking-widest text-text-muted"
              >
                Dropped
              </button>
            </div>
          </div>
        );
      })}

      {/* ── decided ───────────────────────────────────────────────────────── */}
      {decided.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="font-mono text-[10px] font-black uppercase tracking-widest text-text-muted">
            Decided
          </p>
          {decided.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-2xl border-[3px] border-border bg-input px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-black uppercase tracking-wide text-text-muted">
                  {item.name}
                </p>
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-text-muted">
                  {item.state === 'bought' ? 'Got it' : 'Dropped'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-mono text-xs font-bold text-text-muted">{money(item.amount)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => void remove(item.id)}
                  className="text-text-muted transition-colors hover:text-action-bleed"
                >
                  <Trash2 size={15} strokeWidth={3} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="pt-2 text-center text-[10px] font-bold uppercase tracking-widest text-text-muted">
        Saved to your account.{' '}
        <Link to="/vaults" className="underline">Vaults</Link> is where saving for something happens.
      </p>
    </section>
  );
}
