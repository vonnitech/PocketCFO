import { useState, useEffect } from 'react';
import { Wallet, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatCurrency } from '../lib/utils';
import { BottomSheet } from './BottomSheet';

interface Props {
  vaultId: string | null;
  vaultName: string;
  onClose: () => void;
}

export function FundVaultSheet({ vaultId, vaultName, onClose }: Props) {
  const addFundsToVault = useStore(s => s.addFundsToVault);
  const liquidAssets    = useStore(s => s.liquidAssets);
  const privacyMode     = useStore(s => s.privacyMode);

  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (vaultId) setAmount('');
  }, [vaultId]);

  const amtNum  = parseFloat(amount) || 0;
  const exceeds = amtNum > liquidAssets;
  const isValid = amtNum > 0 && !exceeds;

  const submit = async () => {
    if (!vaultId || !isValid) return;
    await addFundsToVault(vaultId, amtNum);
    onClose();
  };

  const quickAmounts = liquidAssets > 0
    ? [0.25, 0.5, 1].map(pct => ({ label: pct === 1 ? 'All' : `${pct * 100}%`, value: Math.floor(liquidAssets * pct) }))
    : [];

  return (
    <BottomSheet open={vaultId !== null} onClose={onClose} title="FUND VAULT">
      <div className="space-y-5 py-2">

        {/* Destination */}
        <div className="flex items-center gap-3 px-4 py-3 bg-input border-4 border-black rounded-2xl">
          <div className="w-9 h-9 bg-action-capture border-2 border-black rounded-xl flex items-center justify-center shrink-0">
            <ShieldCheck size={16} strokeWidth={2.5} className="text-black" />
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted leading-none">Funding</p>
            <p className="text-sm font-black uppercase tracking-tight text-text-main mt-0.5">{vaultName}</p>
          </div>
        </div>

        {/* Amount input */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Transfer Amount</p>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-text-muted text-2xl pointer-events-none select-none">$</span>
            <input
              autoFocus
              type="number"
              min="0"
              title="Amount to transfer"
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

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-text-muted">
              <Wallet size={10} strokeWidth={2.5} />
              Available: {formatCurrency(liquidAssets, privacyMode)}
            </div>
            {exceeds && (
              <p className="text-[10px] font-black uppercase tracking-widest text-action-bleed">Exceeds balance</p>
            )}
          </div>
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

        <button
          type="button"
          onClick={submit}
          disabled={!isValid}
          className="w-full h-14 border-4 border-black rounded-2xl bg-action-capture text-black font-black uppercase tracking-widest text-[11px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        >
          Fund Vault
        </button>

      </div>
    </BottomSheet>
  );
}
