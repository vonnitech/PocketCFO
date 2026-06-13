import { useState } from 'react';
import { motion } from 'motion/react';
import { Wallet, TrendingUp, AlertCircle, User } from 'lucide-react';
import { supabase } from '../core/supabase';
import { useStore } from '../store/useStore';

export function OnboardingModal() {
  const hasCompletedOnboarding = useStore(s => s.hasCompletedOnboarding);
  const userId                 = useStore(s => s.userId);
  const setState               = useStore(s => s.setState);
  const setHorizon             = useStore(s => s.setHorizon);

  // Name is usually captured at signup and loaded into the store. Only ask for it
  // here if it's genuinely missing (e.g. OAuth signups), so we never ask twice.
  const existingFirstName = useStore(s => s.firstName);
  const askName = !existingFirstName?.trim();

  const [firstName, setFirstName] = useState(() => existingFirstName || '');
  const [balance,   setBalance]   = useState('');
  const [takeHome,  setTakeHome]  = useState('');
  const [payDay,    setPayDay]    = useState('');
  const [payMonth, setPayMonth] = useState('');
  const [payYear,  setPayYear]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  if (hasCompletedOnboarding) return null;

  const numBalance  = parseFloat(balance) || 0;
  const numTakeHome = parseFloat(takeHome) || 0;
  const payday = (payDay && payMonth && payYear.length === 4)
    ? `${payYear}-${payMonth.padStart(2, '0')}-${payDay.padStart(2, '0')}`
    : '';
  const canSubmit = numBalance >= 0 && numTakeHome > 0 && !!payday && !!userId;

  const daysInMonth = (month: string, year: string): number => {
    if (!month) return 31;
    return new Date(parseInt(year) || new Date().getFullYear(), parseInt(month), 0).getDate();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError('');

    const { error: dbError } = await (supabase.from('profiles') as any).update({
      first_name:               firstName.trim() || null,
      liquid_assets:            numBalance,
      monthly_take_home:        numTakeHome,
      next_payday:              payday,
      is_configured:            true,
      has_completed_onboarding: true,
    }).eq('id', userId);

    if (dbError) {
      setError('Could not save your details. Please try again.');
      setLoading(false);
      return;
    }

    setState({
      firstName:               firstName.trim(),
      monthlyTakeHome:         numTakeHome,
      isConfigured:            true,
      hasCompletedOnboarding:  true,
    });
    // Properly computes safeSpendLimit, bill queue, and all derived values
    setHorizon(numBalance, payday, 0, 0, []);
  };

  const inputClass =
    'w-full bg-transparent border-4 border-black rounded-2xl px-4 py-3 pl-10 font-mono font-bold text-sm text-text-main outline-none placeholder:text-text-muted/40 focus:bg-input transition-colors';

  const selectClass =
    'w-full bg-transparent border-4 border-black rounded-2xl px-3 py-3 font-mono font-bold text-sm text-text-main outline-none focus:bg-input transition-colors cursor-pointer';

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-surface border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4 overflow-hidden"
        >
          {/* Title */}
          <div className="overflow-hidden">
            <h1 className="text-2xl font-black uppercase tracking-tighter italic text-text-main leading-none truncate">
              Set Up Your Account
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-1 truncate">
              You can update these any time in Settings.
            </p>
          </div>

          {/* First Name — only shown if not already captured at signup */}
          {askName && (
            <div className="overflow-hidden">
              <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-1.5">
                Your First Name
              </label>
              <div className="relative">
                <User size={14} strokeWidth={2.5}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input
                  type="text"
                  autoComplete="given-name"
                  placeholder="e.g. Alex"
                  autoFocus
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* Current Bank Balance */}
          <div className="overflow-hidden">
            <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-1.5">
              Current Bank Balance
            </label>
            <div className="relative">
              <Wallet size={14} strokeWidth={2.5}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                required
                autoFocus={!askName}
                value={balance}
                onChange={e => setBalance(e.target.value)}
                onFocus={e => e.target.select()}
                className={inputClass}
              />
            </div>
          </div>

          {/* Monthly Take-Home Pay */}
          <div className="overflow-hidden">
            <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-1.5">
              Monthly Take-Home Pay
            </label>
            <div className="relative">
              <TrendingUp size={14} strokeWidth={2.5}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                type="number"
                min="1"
                step="0.01"
                placeholder="0.00"
                required
                value={takeHome}
                onChange={e => setTakeHome(e.target.value)}
                onFocus={e => e.target.select()}
                className={inputClass}
              />
            </div>
          </div>

          {/* Next Payday */}
          <div className="overflow-hidden">
            <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-1.5">
              Next Payday
            </label>
            <div className="grid grid-cols-3 gap-2">
              <select title="Day" value={payDay} onChange={e => setPayDay(e.target.value)} className={selectClass}>
                <option value="">Day</option>
                {Array.from({ length: daysInMonth(payMonth, payYear) }, (_, i) => (
                  <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
                ))}
              </select>
              <select title="Month" value={payMonth} onChange={e => {
                setPayMonth(e.target.value);
                const max = daysInMonth(e.target.value, payYear);
                if (parseInt(payDay) > max) setPayDay(String(max));
              }} className={selectClass}>
                <option value="">Month</option>
                {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                  <option key={i} value={String(i + 1)}>{m}</option>
                ))}
              </select>
              <select title="Year" value={payYear} onChange={e => setPayYear(e.target.value)} className={selectClass}>
                <option value="">Year</option>
                {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() + i).map(y => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-action-bleed/10 border-2 border-action-bleed rounded-2xl px-3 py-2.5 overflow-hidden">
              <AlertCircle size={13} strokeWidth={2.5} className="text-action-bleed shrink-0 mt-0.5" />
              <p className="text-[10px] font-black uppercase tracking-wide text-action-bleed leading-tight min-w-0">
                {error}
              </p>
            </div>
          )}

          {/* Submit */}
          <motion.button
            type="submit"
            disabled={loading || !canSubmit}
            whileTap={{ scale: 0.97 }}
            className="w-full h-14 bg-black border-4 border-black rounded-2xl text-action-primary font-black uppercase text-sm tracking-widest flex items-center justify-center gap-2 shadow-[3px_3px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[3px_3px_0px_0px_var(--color-action-primary)]"
          >
            {loading
              ? <span className="animate-pulse">Saving...</span>
              : 'Get Started →'
            }
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
