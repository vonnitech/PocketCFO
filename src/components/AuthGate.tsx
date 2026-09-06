import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User, UserPlus, LogIn, AlertOctagon, CheckCircle, KeyRound, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../core/supabase';
import { logProductEvent } from '../core/telemetry';

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

// Multicolour Google "G" — kept as an inline SVG so it renders identically in
// light and dark themes (no dependency on a logo asset).
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function AuthGate({ recoveryMode, onRecoveryDone }: Props) {
  const [mode, setMode]           = useState<Mode>(recoveryMode ? 'recover' : 'login');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
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

  useEffect(() => {
    setPasswordVisible(false);
  }, [mode]);

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
        // Logged before the call so a signup that never completes (duplicate email,
        // rejected password) shows as submitted-without-created.
        logProductEvent({ type: 'signup_submitted', method: 'password' });
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { first_name: firstName.trim() } },
        });
        if (authError) throw authError;
        // If email confirmation is disabled, Supabase returns a live session.
        // Create the profile here as a backstop in case the auth trigger did not
        // create it before the app loads onboarding.
        const autoSignedIn = !!data.session;
        if (data.user && autoSignedIn) {
          await (supabase.from('profiles') as any)
            .upsert({
              id: data.user.id,
              first_name: firstName.trim() || null,
            }, { onConflict: 'id' });
        }
        // Supabase returns a live session here whenever email confirmation is
        // off for the project. In that case the user is already signed in and
        // App's auth listener will swap this screen for the app, so bouncing
        // them back to the login form would strand them one step short of their
        // first Safe-to-Spend number. Only hold them when there is no session.
        logProductEvent({ type: 'signup_created', method: 'password', autoSignedIn });
        if (!autoSignedIn) {
          setNotice('Account created. Check your email to confirm before logging in.');
          setMode('login');
          setPassword('');
          setFirstName('');
        }

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

  // OAuth sign-in. On success the browser redirects to Google and back to the app,
  // so we intentionally leave `loading` true (the page is navigating away). We only
  // reset it if the call errors before any redirect happens.
  const handleGoogle = async () => {
    setLoading(true);
    clearMessages();
    try {
      // Intent only: after the redirect a Google signup is indistinguishable from
      // a Google login, so this is recorded when the user is on the signup tab.
      if (mode === 'signup') logProductEvent({ type: 'signup_submitted', method: 'google' });
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (authError) throw authError;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed';
      setError(msg.toUpperCase());
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
            <span className="text-[15px] font-black tracking-tight text-white">Pocket CFO</span>
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
                className="w-full bg-transparent border-4 border-black rounded-2xl px-4 py-3 pl-10 font-mono font-bold text-sm text-text-main outline-none placeholder:text-text-muted focus:bg-surface transition-colors tracking-wide"
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
                className="w-full bg-transparent border-4 border-black rounded-2xl px-4 py-3 pl-10 font-mono font-bold text-sm text-text-main outline-none placeholder:text-text-muted focus:bg-surface transition-colors tracking-wide"
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
                  type={passwordVisible ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="PASSWORD"
                  required
                  minLength={8}
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearMessages(); }}
                  className="w-full bg-transparent border-4 border-black rounded-2xl px-4 py-3 pl-10 pr-12 font-mono font-bold text-sm text-text-main outline-none placeholder:text-text-muted focus:bg-surface transition-colors tracking-wide"
                />
              ) : (
                <input
                  type={passwordVisible ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder={mode === 'recover' ? 'NEW PASSWORD' : 'PASSWORD'}
                  required
                  minLength={8}
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearMessages(); }}
                  className="w-full bg-transparent border-4 border-black rounded-2xl px-4 py-3 pl-10 pr-12 font-mono font-bold text-sm text-text-main outline-none placeholder:text-text-muted focus:bg-surface transition-colors tracking-wide"
                />
              )}
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
            {loading ? <span className="animate-pulse">Working…</span> : submitLabel}
          </motion.button>

          {/* Google OAuth — login & signup only */}
          {(mode === 'login' || mode === 'signup') && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-0.5 bg-border/40" />
                <span className="text-[9px] font-black uppercase tracking-widest text-text-muted">or</span>
                <div className="flex-1 h-0.5 bg-border/40" />
              </div>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                className="w-full h-14 bg-surface border-4 border-black rounded-2xl text-text-main font-black uppercase text-sm tracking-widest flex items-center justify-center gap-2.5 shadow-brutal-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-brutal-sm"
              >
                <GoogleIcon /> Continue with Google
              </button>
            </>
          )}

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
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                Choose a strong, new password
              </span>
            )}
          </div>
        </form>
      </motion.div>
    </div>
  );
}
