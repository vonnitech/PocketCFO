import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, UserPlus, LogIn, AlertOctagon, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../core/supabase';

type Mode = 'login' | 'signup';

interface LoginProps {
  onAuthenticated: () => void;
}

export function Login({ onAuthenticated }: LoginProps) {
  const [mode, setMode]       = useState<Mode>('login');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [notice, setNotice]   = useState(''); // e.g. "Check your email to confirm"

  // Auto-detect existing session (page refresh while logged in)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) onAuthenticated();
    });
  }, [onAuthenticated]);

  const clearMessages = () => { setError(''); setNotice(''); };

  useEffect(() => {
    setPasswordVisible(false);
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    clearMessages();

    try {
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        onAuthenticated();
      } else {
        const { error: authError } = await supabase.auth.signUp({ email: email.trim(), password });
        if (authError) throw authError;
        setNotice('Account created. Check your email to confirm before logging in.');
        setMode('login');
        setPassword('');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg.toUpperCase());
    } finally {
      setLoading(false);
    }
  };

  const inputBase =
    'w-full bg-transparent border-4 border-black rounded-2xl px-4 py-3 font-mono font-bold text-sm text-text-main outline-none placeholder:text-text-muted focus:bg-surface transition-colors tracking-wide';

  return (
    <div className="fixed inset-0 z-9999 bg-base dot-bg flex flex-col items-center justify-center px-4 font-mono">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >

        {/* Terminal header panel */}
        <div className="bg-black border-4 border-black rounded-3xl p-5 mb-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/10">
            <span className="text-[11px] font-black tracking-[0.3em] uppercase text-white/40">
              POCKET_CFO :: AUTH_TERMINAL
            </span>
            <div className="w-2 h-2 rounded-full bg-action-primary animate-pulse" />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[11px] font-bold tracking-widest uppercase text-white/30">STATUS</span>
              <span className="text-[10px] font-black tracking-widest uppercase text-capture-readable">
                {loading ? 'AUTHENTICATING…' : 'AWAITING_CREDENTIALS'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[11px] font-bold tracking-widest uppercase text-white/30">PROTOCOL</span>
              <span className="text-[10px] font-black tracking-widest uppercase text-white/60">SUPABASE / JWT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[11px] font-bold tracking-widest uppercase text-white/30">MODE</span>
              <span className="text-[10px] font-black tracking-widest uppercase text-action-primary">
                {mode === 'login' ? 'SIGN_IN' : 'CREATE_ACCOUNT'}
              </span>
            </div>
          </div>
        </div>

        {/* Auth form */}
        <form
          onSubmit={handleSubmit}
          className="bg-surface border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4"
        >
          <h1 className="text-2xl font-black uppercase tracking-tighter italic text-text-main leading-none">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h1>

          {/* Email */}
          <div className="relative">
            <Mail
              size={14}
              strokeWidth={2.5}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
            />
            <input
              type="email"
              autoComplete="email"
              placeholder="EMAIL ADDRESS"
              required
              value={email}
              onChange={e => { setEmail(e.target.value); clearMessages(); }}
              className={`${inputBase} pl-10`}
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock
              size={14}
              strokeWidth={2.5}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
            />
            <input
              type={passwordVisible ? 'text' : 'password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="PASSWORD"
              required
              minLength={8}
              value={password}
              onChange={e => { setPassword(e.target.value); clearMessages(); }}
              className={`${inputBase} pl-10 pr-12`}
            />
            {password && (
              <button
                type="button"
                aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                title={passwordVisible ? 'Hide password' : 'Show password'}
                onMouseDown={e => e.preventDefault()}
                onClick={() => setPasswordVisible(visible => !visible)}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-xl border-2 border-black bg-surface text-text-muted hover:text-text-main hover:bg-action-primary transition-colors flex items-center justify-center"
              >
                {passwordVisible ? <EyeOff size={15} strokeWidth={2.7} /> : <Eye size={15} strokeWidth={2.7} />}
              </button>
            )}
          </div>

          {/* Error / notice */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-2 bg-action-bleed/10 border-2 border-action-bleed rounded-2xl px-3 py-2.5"
              >
                <AlertOctagon size={13} className="text-action-bleed shrink-0 mt-0.5" strokeWidth={2.5} />
                <p className="text-[10px] font-black uppercase tracking-wider text-action-bleed leading-tight">{error}</p>
              </motion.div>
            )}
            {notice && (
              <motion.div
                key="notice"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-2 bg-action-capture/10 border-2 border-action-capture rounded-2xl px-3 py-2.5"
              >
                <CheckCircle size={13} className="text-capture-readable shrink-0 mt-0.5" strokeWidth={2.5} />
                <p className="text-[10px] font-black uppercase tracking-wider text-capture-readable leading-tight">{notice}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <motion.button
            type="submit"
            disabled={loading}
            whileTap={{ scale: 0.97 }}
            className="w-full h-14 bg-black border-4 border-black rounded-2xl text-action-primary font-black uppercase text-sm tracking-widest flex items-center justify-center gap-2.5 shadow-brutal-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-brutal-sm"
          >
            {loading
              ? <span className="animate-pulse">PROCESSING…</span>
              : mode === 'login'
                ? <><LogIn size={16} strokeWidth={3} /> AUTHENTICATE</>
                : <><UserPlus size={16} strokeWidth={3} /> ENLIST</>
            }
          </motion.button>

          {/* Mode toggle */}
          <div className="flex items-center justify-center pt-1 border-t-2 border-border/30">
            <button
              type="button"
              onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); clearMessages(); }}
              className="text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-main transition-colors"
            >
              {mode === 'login' ? '→ Create new account' : '← Back to sign in'}
            </button>
          </div>
        </form>

        <p className="text-center text-[11px] font-bold uppercase tracking-widest text-text-muted mt-4">
          Your data is yours · encrypted end-to-end.
        </p>
      </motion.div>
    </div>
  );
}
