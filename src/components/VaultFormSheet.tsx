import { useState, useEffect } from 'react';
import { TrendingUp, Target, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { VaultAssetClass } from '../store/useStore';
import { BottomSheet } from './BottomSheet';

const CLASS_OPTIONS: {
  id: VaultAssetClass;
  label: string;
  desc: string;
  icon: React.ElementType;
}[] = [
  {
    id:    'INVESTMENT',
    label: 'Investment',
    desc:  'Brokerage, IRA, index funds · counts toward your FIRE number',
    icon:  TrendingUp,
  },
  {
    id:    'SINKING_FUND',
    label: 'Sinking Fund',
    desc:  'Car, vacation, new phone · planned future spending',
    icon:  Target,
  },
  {
    id:    'CASH_RESERVE',
    label: 'Cash Reserve',
    desc:  'Emergency fund, HYSA · safe yield, excluded from FIRE',
    icon:  ShieldCheck,
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  defaultClass?: VaultAssetClass;
}

export function VaultFormSheet({ open, onClose, defaultClass = 'SINKING_FUND' }: Props) {
  const addVault = useStore(s => s.addVault);

  const [name,       setName]       = useState('');
  const [target,     setTarget]     = useState('');
  const [assetClass, setAssetClass] = useState<VaultAssetClass>(defaultClass);

  useEffect(() => {
    if (open) {
      setName('');
      setTarget('');
      setAssetClass(defaultClass);
    }
  }, [open, defaultClass]);

  const submit = async () => {
    const t = parseFloat(target);
    if (!name.trim() || !t || t <= 0) return;
    await addVault(name.trim(), t, assetClass);
    onClose();
  };

  const disabled = !name.trim() || !target || parseFloat(target) <= 0;

  return (
    <BottomSheet open={open} onClose={onClose} title="NEW VAULT">
      <div className="space-y-5 py-2">

        {/* Type picker */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Vault Type</p>
          <div className="flex flex-col gap-2">
            {CLASS_OPTIONS.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAssetClass(opt.id)}
                className={`flex items-center gap-3 p-3 rounded-2xl border-4 transition-all text-left w-full ${
                  assetClass === opt.id
                    ? 'bg-black border-black'
                    : 'bg-input border-border hover:border-black'
                }`}
              >
                <div className={`w-9 h-9 border-2 border-black rounded-xl flex items-center justify-center shrink-0 ${
                  assetClass === opt.id ? 'bg-action-primary' : 'bg-surface'
                }`}>
                  <opt.icon size={16} strokeWidth={2.5} className="text-black" />
                </div>
                <div>
                  <p className={`text-[11px] font-black uppercase tracking-widest leading-none ${
                    assetClass === opt.id ? 'text-action-primary' : 'text-text-main'
                  }`}>
                    {opt.label}
                  </p>
                  <p className={`text-[10px] font-bold mt-1 leading-snug ${
                    assetClass === opt.id ? 'text-white/50' : 'text-text-muted'
                  }`}>
                    {opt.desc}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Vault Name</p>
          <input
            title="Vault Name"
            placeholder="e.g. EMERGENCY FUND"
            className="w-full bg-input border-4 border-black rounded-2xl p-4 font-black uppercase text-sm text-text-main outline-none focus:border-action-capture transition-colors"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
          />
        </div>

        {/* Target */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Savings Target</p>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-text-muted text-lg pointer-events-none select-none">$</span>
            <input
              type="number"
              min="0"
              title="Target Amount"
              placeholder="0"
              className="w-full bg-input border-4 border-black rounded-2xl pl-9 pr-4 py-4 font-black text-xl text-text-main outline-none focus:border-action-capture transition-colors tabular-nums"
              value={target}
              onChange={e => setTarget(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={disabled}
          className="w-full h-14 border-4 border-black rounded-2xl bg-black text-action-primary font-black uppercase tracking-widest text-[11px] shadow-[4px_4px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[4px_4px_0px_0px_var(--color-action-primary)]"
        >
          Create Vault
        </button>

      </div>
    </BottomSheet>
  );
}
