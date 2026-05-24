import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User, UserPlus, LogIn, AlertOctagon, CheckCircle } from 'lucide-react';
import { supabase } from '../core/supabase';

type Mode = 'login' | 'signup';

export function AuthGate() {
  const [mode, setMode]           = useState<Mode>('login');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [notice, setNotice]       = useState('');

  const clearMessages = () => { setError(''); setNotice(''); };
  const passwordAutoComplete = mode === 'login' ? 'current-password' : 'new-password';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    clearMessages();

    try {
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        // App.tsx onAuthStateChange listener handles routing on success
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { first_name: firstName.trim() } },
        });
        if (authError) throw authError;
        // Persist first_name to the profile row the trigger just created
        if (data.user && firstName.trim()) {
          await (supabase.from('profiles') as any)
            .update({ first_name: firstName.trim() })
            .eq('id', data.user.id);
        }
        setNotice('Account created. Check your email to confirm before logging in.');
        setMode('login');
        setPassword('');
        setFirstName('');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg.toUpperCase());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-9999 bg-base dot-bg flex flex-col items-center justify-center px-4 font-mono">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="bg-black border-4 border-black rounded-3xl px-5 py-4 mb-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[15px] font-black tracking-tight text-white">PocketCFO</span>
            <div className="w-2 h-2 rounded-full bg-action-primary animate-pulse" />
          </div>
          <p className="text-[11px] font-bold text-white/50 leading-relaxed">
            Log in to manage your finances or create a new account.
          </p>
        </div>

        {/* Auth form */}
        <form
          onSubmit={handleSubmit}
          className="bg-surface border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4"
        >
          <h1 className="text-2xl font-black uppercase tracking-tighter italic text-text-main leading-none">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h1>

          {/* First Name — signup only */}
          {mode === 'signup' && (
            <div className="relative">
              <User
                size={14}
                strokeWidth={2.5}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
              />
              <input
                type="text"
                autoComplete="given-name"
                placeholder="FIRST NAME"
                value={firstName}
                onChange={e => { setFirstName(e.target.value); clearMessages(); }}
                className="w-full bg-transparent border-4 border-black rounded-2xl px-4 py-3 pl-10 font-mono font-bold text-sm text-text-main outline-none placeholder:text-text-muted/40 focus:bg-surface transition-colors tracking-wide"
              />
            </div>
          )}

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
              className="w-full bg-transparent border-4 border-black rounded-2xl px-4 py-3 pl-10 font-mono font-bold text-sm text-text-main outline-none placeholder:text-text-muted/40 focus:bg-surface transition-colors tracking-wide"
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
              type="password"
              autoComplete={passwordAutoComplete}
              placeholder="PASSWORD"
              required
              minLength={8}
              value={password}
              onChange={e => { setPassword(e.target.value); clearMessages(); }}
              className="w-full bg-transparent border-4 border-black rounded-2xl px-4 py-3 pl-10 font-mono font-bold text-sm text-text-main outline-none placeholder:text-text-muted/40 focus:bg-surface transition-colors tracking-wide"
            />
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
                <CheckCircle size={13} className="text-action-capture shrink-0 mt-0.5" strokeWidth={2.5} />
                <p className="text-[10px] font-black uppercase tracking-wider text-action-capture leading-tight">{notice}</p>
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
              ? <span className="animate-pulse">Signing in...</span>
              : mode === 'login'
                ? <><LogIn size={16} strokeWidth={3} /> Sign In</>
                : <><UserPlus size={16} strokeWidth={3} /> Create Account</>
            }
          </motion.button>

          {/* Mode toggle */}
          <div className="flex items-center justify-center pt-1 border-t-2 border-border/30">
            <button
              type="button"
              onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setFirstName(''); clearMessages(); }}
              className="text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-main transition-colors"
            >
              {mode === 'login' ? '→ Create new account' : '← Back to sign in'}
            </button>
          </div>
        </form>

        <p className="text-center text-[11px] font-bold uppercase tracking-widest text-text-muted/40 mt-4">
          Your data is encrypted end-to-end.
        </p>
      </motion.div>
    </div>
  );
}
