import { useState, useEffect } from 'react';
import { ArrowLeftRight, Wallet } from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatCurrency } from '../lib/utils';
import { BottomSheet } from './BottomSheet';

interface SourceVault {
  id: string;
  name: string;
  current: number;
}

interface Props {
  vault: SourceVault | null;
  onClose: () => void;
}

export function VaultTransferSheet({ vault, onClose }: Props) {
  const transferVaultFunds = useStore(s => s.transferVaultFunds);
  const allVaults          = useStore(s => s.vaults);
  const privacyMode        = useStore(s => s.privacyMode);

  const [amount,      setAmount]      = useState('');
  const [destination, setDestination] = useState('LIQUID');

  const otherVaults = vault ? allVaults.filter(v => v.id !== vault.id) : [];

  useEffect(() => {
    if (vault) {
      setAmount('');
      setDestination('LIQUID');
    }
  }, [vault]);

  const amtNum  = parseFloat(amount) || 0;
  const max     = vault?.current ?? 0;
  const exceeds = amtNum > max;
  const isValid = amtNum > 0 && !exceeds;

  const submit = async () => {
    if (!vault || !isValid) return;
    await transferVaultFunds(vault.id, destination, amtNum);
    onClose();
  };

  const destLabel = destination === 'LIQUID'
    ? 'Liquid Cash'
    : allVaults.find(v => v.id === destination)?.name ?? 'Vault';

  const quickAmounts = max > 0
    ? [0.25, 0.5, 1].map(pct => ({
        label: pct === 1 ? 'All' : `${pct * 100}%`,
        value: Math.floor(max * pct),
      }))
    : [];

  return (
    <BottomSheet open={vault !== null} onClose={onClose} title="MOVE FUNDS">
      <div className="space-y-5 py-2">

        {/* Source vault chip */}
        <div className="flex items-center gap-3 px-4 py-3 bg-input border-4 border-black rounded-2xl">
          <div className="w-9 h-9 bg-black border-2 border-black rounded-xl flex items-center justify-center shrink-0">
            <ArrowLeftRight size={15} strokeWidth={2.5} className="text-action-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted leading-none">Moving from</p>
            <p className="text-sm font-black uppercase tracking-tight text-text-main mt-0.5 truncate">{vault?.name}</p>
          </div>
          <p className="text-[11px] font-black tabular-nums text-text-muted shrink-0">
            {formatCurrency(max, privacyMode)} available
          </p>
        </div>

        {/* Destination */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Destination</p>
          <select
            title="Transfer destination"
            value={destination}
            onChange={e => setDestination(e.target.value)}
            className="w-full bg-input border-4 border-black rounded-2xl px-4 py-3.5 font-black uppercase text-sm text-text-main outline-none focus:border-action-capture transition-colors appearance-none cursor-pointer"
          >
            <option value="LIQUID">↩ Back to Liquid Cash</option>
            {otherVaults.map(v => (
              <option key={v.id} value={v.id}>
                {v.name} · {formatCurrency(v.current, privacyMode)}
              </option>
            ))}
          </select>
        </div>

        {/* Amount input */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Amount</p>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-text-muted text-2xl pointer-events-none select-none">$</span>
            <input
              autoFocus
              type="number"
              min="0"
              title="Transfer amount"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value === '' || parseFloat(e.target.value) >= 0 ? e.target.value : '0')}
              onFocus={e => e.target.select()}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
              className={`w-full bg-input border-4 rounded-2xl pl-10 pr-4 py-4 font-black text-3xl text-text-main outline-none transition-colors tabular-nums ${
                exceeds ? 'border-action-bleed' : 'border-black focus:border-action-capture'
              }`}
            />
          </div>
          {exceeds && (
            <p className="text-[10px] font-black uppercase tracking-widest text-action-bleed mt-1.5">Exceeds vault balance</p>
          )}
        </div>

        {/* Quick-fill buttons */}
        {quickAmounts.length > 0 && (
          <div className="flex gap-2">
            {quickAmounts.map(q => (
              <button
                key={q.label}
                type="button"
                onClick={() => setAmount(q.value.toString())}
                className="flex-1 h-9 border-2 border-border rounded-xl bg-input font-black text-[10px] uppercase tracking-widest text-text-muted hover:border-black hover:text-text-main transition-colors"
              >
                {q.label}
              </button>
            ))}
          </div>
        )}

        {/* Transfer summary */}
        {isValid && (
          <div className="flex items-center gap-2 bg-input border-2 border-border rounded-2xl px-4 py-3">
            <Wallet size={13} strokeWidth={2.5} className="text-text-muted shrink-0" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
              {formatCurrency(amtNum, privacyMode)} → {destLabel}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!isValid}
          className="w-full h-14 border-4 border-black rounded-2xl bg-black text-action-primary font-black uppercase tracking-widest text-[11px] shadow-[4px_4px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[4px_4px_0px_0px_var(--color-action-primary)]"
        >
          Confirm Transfer
        </button>

      </div>
    </BottomSheet>
  );
}
