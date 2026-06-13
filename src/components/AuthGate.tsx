import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User, UserPlus, LogIn, AlertOctagon, CheckCircle, KeyRound, ArrowLeft } from 'lucide-react';
import { supabase } from '../core/supabase';

// Modes:
//  login   — email + password sign in (+ forgot-password link)
//  signup  — email + password + first name new account
//  reset   — user typed their email and asked us to send a recovery link
//  recover — user clicked the recovery link from the email; set a new password
type Mode = 'login' | 'signup' | 'reset' | 'recover';

interface Props {
  recoveryMode?: boolean;
  onRecoveryDone?: () => void;
}

export function AuthGate({ recoveryMode, onRecoveryDone }: Props) {
  const [mode, setMode]           = useState<Mode>(recoveryMode ? 'recover' : 'login');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [notice, setNotice]       = useState('');

  // If App flips recoveryMode on after mount (e.g. user opens the email link
  // while AuthGate is already up), force the recover view.
  useEffect(() => {
    if (recoveryMode) { setMode('recover'); setError(''); setNotice(''); }
  }, [recoveryMode]);

  const clearMessages = () => { setError(''); setNotice(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearMessages();

    try {
      if (mode === 'login') {
        if (!email.trim() || !password) return;
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;

      } else if (mode === 'signup') {
        if (!email.trim() || !password) return;
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { first_name: firstName.trim() } },
        });
        if (authError) throw authError;
        if (data.user && firstName.trim()) {
          await (supabase.from('profiles') as any)
            .update({ first_name: firstName.trim() })
            .eq('id', data.user.id);
        }
        setNotice('Account created. Check your email to confirm before logging in.');
        setMode('login');
        setPassword('');
        setFirstName('');

      } else if (mode === 'reset') {
        if (!email.trim()) return;
        // The redirect URL must be allow-listed under Supabase Auth → URL Configuration.
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (authError) throw authError;
        // Always show the same generic message regardless of whether the email
        // exists — prevents account enumeration via the reset endpoint.
        setNotice('If an account exists for that email, a reset link is on its way.');
        setPassword('');

      } else if (mode === 'recover') {
        if (!password || password.length < 8) {
          setError('PASSWORD MUST BE AT LEAST 8 CHARACTERS');
          return;
        }
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        setNotice('Password updated. Welcome back.');
        setPassword('');
        // Hand control back to App.tsx — it'll re-evaluate routing and load the app.
        setTimeout(() => onRecoveryDone?.(), 600);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg.toUpperCase());
    } finally {
      setLoading(false);
    }
  };

  const headline =
    mode === 'login'   ? 'Sign In'
    : mode === 'signup' ? 'Create Account'
    : mode === 'reset'  ? 'Reset Password'
    :                     'Set New Password';

  const submitLabel =
    mode === 'login'   ? <><LogIn size={16} strokeWidth={3} /> Sign In</>
    : mode === 'signup' ? <><UserPlus size={16} strokeWidth={3} /> Create Account</>
    : mode === 'reset'  ? <><Mail size={16} strokeWidth={3} /> Send Reset Link</>
    :                     <><KeyRound size={16} strokeWidth={3} /> Update Password</>;

  const showEmail    = mode === 'login' || mode === 'signup' || mode === 'reset';
  const showPassword = mode === 'login' || mode === 'signup' || mode === 'recover';
  const showName     = mode === 'signup';

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
            {headline}
          </h1>

          {mode === 'reset' && (
            <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted leading-snug">
              Enter the email you signed up with. We'll send a link to set a new password.
            </p>
          )}

          {mode === 'recover' && (
            <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted leading-snug">
              Pick a new password. You'll be signed in afterward.
            </p>
          )}

          {/* First Name — signup only */}
          {showName && (
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
          {showEmail && (
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
          )}

          {/* Password */}
          {showPassword && (
            <div className="relative">
              <Lock
                size={14}
                strokeWidth={2.5}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
              />
              {mode === 'login' ? (
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="PASSWORD"
                  required
                  minLength={8}
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearMessages(); }}
                  className="w-full bg-transparent border-4 border-black rounded-2xl px-4 py-3 pl-10 font-mono font-bold text-sm text-text-main outline-none placeholder:text-text-muted/40 focus:bg-surface transition-colors tracking-wide"
                />
              ) : (
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder={mode === 'recover' ? 'NEW PASSWORD' : 'PASSWORD'}
                  required
                  minLength={8}
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearMessages(); }}
                  className="w-full bg-transparent border-4 border-black rounded-2xl px-4 py-3 pl-10 font-mono font-bold text-sm text-text-main outline-none placeholder:text-text-muted/40 focus:bg-surface transition-colors tracking-wide"
                />
              )}
            </div>
          )}

          {/* Forgot password link — only in login mode */}
          {mode === 'login' && (
            <div className="flex justify-end -mt-1">
              <button
                type="button"
                onClick={() => { setMode('reset'); setPassword(''); clearMessages(); }}
                className="text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-main transition-colors"
              >
                Forgot password?
              </button>
            </div>
          )}

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
            {loading ? <span className="animate-pulse">Working...</span> : submitLabel}
          </motion.button>

          {/* Mode toggle */}
          <div className="flex items-center justify-center pt-1 border-t-2 border-border/30">
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => { setMode('signup'); setFirstName(''); clearMessages(); }}
                className="text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-main transition-colors"
              >
                → Create new account
              </button>
            )}
            {mode === 'signup' && (
              <button
                type="button"
                onClick={() => { setMode('login'); setFirstName(''); clearMessages(); }}
                className="text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-main transition-colors"
              >
                ← Back to sign in
              </button>
            )}
            {mode === 'reset' && (
              <button
                type="button"
                onClick={() => { setMode('login'); clearMessages(); }}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-main transition-colors"
              >
                <ArrowLeft size={11} strokeWidth={3} /> Back to sign in
              </button>
            )}
            {mode === 'recover' && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted/60">
                Choose a strong, new password
              </span>
            )}
          </div>
        </form>

        <p className="text-center text-[11px] font-bold uppercase tracking-widest text-text-muted/40 mt-4">
          Your data is encrypted end-to-end.
        </p>
      </motion.div>
    </div>
  );
}
