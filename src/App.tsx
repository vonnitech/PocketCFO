import { lazy, Suspense, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useStore, INITIAL_STATE } from './store/useStore';
import { initDB } from './db';
import { supabase, isSupabaseConfigured } from './core/supabase';
import { setTelemetryUser } from './core/telemetry';
import { useIdleLock } from './hooks/useIdleLock';
import { AuthGate } from './components/AuthGate';
import { ScreenLock } from './components/ScreenLock';
import { FeatureTour, useFeatureTour } from './components/FeatureTour';
import { PaydayBanner } from './components/PaydayBanner';
import { runPaydayCheck } from './core/lifecycle';

// Pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const TacticalSplitter = lazy(() =>
  import('./pages/TacticalSplitter').then(module => ({ default: module.TacticalSplitter }))
);
const TrueCost = lazy(() =>
  import('./pages/TrueCost').then(module => ({ default: module.TrueCost }))
);
const DebtDestroyer = lazy(() =>
  import('./pages/DebtDestroyer').then(module => ({ default: module.DebtDestroyer }))
);
const TacticalCommand = lazy(() =>
  import('./pages/TacticalCommand').then(module => ({ default: module.TacticalCommand }))
);
const Config = lazy(() => import('./pages/Config'));
const Settings = lazy(() => import('./pages/Settings'));
const Recon = lazy(() => import('./pages/Recon'));
const Vaults = lazy(() => import('./pages/Vaults'));
const ActiveSubs = lazy(() => import('./pages/ActiveSubs'));
const CompoundGrowth = lazy(() =>
  import('./pages/CompoundGrowth').then(module => ({ default: module.CompoundGrowth }))
);
const Fire = lazy(() => import('./pages/Fire'));
const IncomeTracker = lazy(() => import('./pages/IncomeTracker'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Breakdown = lazy(() =>
  import('./pages/Audit').then(module => ({ default: module.Audit }))
);

// Components
const Navigation = lazy(() => import('./components/Navigation'));
import { PageWrapper } from './components/PageWrapper';

function RouteFallback() {
  return (
    <div className="min-h-[320px] flex items-center justify-center">
      <div className="bg-surface border-4 border-border rounded-4xl px-6 py-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Loading Screen</p>
      </div>
    </div>
  );
}


function NavigationFallback() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t-[4px] border-black md:relative md:border-t-0 md:bg-transparent px-2 pt-1 pb-2 md:p-6 h-[68px] md:h-screen flex flex-col transition-colors duration-300">
      <div className="md:hidden flex gap-1.5 overflow-x-auto no-scrollbar items-end pb-0.5">
        <div className="w-12 h-14 border-[3px] border-black rounded-2xl bg-surface" />
        <div className="w-12 h-14 border-[3px] border-black/20 rounded-2xl bg-surface" />
        <div className="w-12 h-14 border-[3px] border-black/20 rounded-2xl bg-surface" />
        <div className="w-px h-10 bg-black/20 self-center" />
        <div className="w-12 h-14 border-[3px] border-black/20 rounded-2xl bg-surface" />
        <div className="w-12 h-14 border-[3px] border-black/20 rounded-2xl bg-surface" />
      </div>

      <div className="hidden md:flex flex-col gap-4 flex-1">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black tracking-[0.3em] uppercase text-text-main">Pocket CFO</p>
        </div>

        <div className="flex flex-col flex-1 gap-3">
          <div className="space-y-2">
            <div className="h-3 w-12 rounded bg-black/10" />
            <div className="h-14 rounded-2xl border-4 border-black bg-surface shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" />
            <div className="h-14 rounded-2xl border-4 border-black/10 bg-surface" />
            <div className="h-14 rounded-2xl border-4 border-black/10 bg-surface" />
          </div>

          <div className="space-y-2">
            <div className="h-3 w-14 rounded bg-black/10" />
            <div className="h-14 rounded-2xl border-4 border-black/10 bg-surface" />
            <div className="h-14 rounded-2xl border-4 border-black/10 bg-surface" />
          </div>

          <div className="mt-auto h-14 rounded-2xl border-4 border-black/10 bg-surface" />
        </div>
      </div>
    </div>
  );
}

function SyncFallback() {
  return (
    <div className="fixed inset-0 bg-base dot-bg flex items-center justify-center font-mono">
      <div className="bg-surface border-4 border-black rounded-3xl px-6 py-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-text-muted animate-pulse">
          SYNCING DATA...
        </p>
      </div>
    </div>
  );
}

function withPageWrapper(element: React.ReactNode) {
  return (
    <PageWrapper>
      <Suspense fallback={<RouteFallback />}>
        {element}
      </Suspense>
    </PageWrapper>
  );
}

function App() {
  const dataLoaded            = useStore(s => s.dataLoaded);
  const fetchUserData         = useStore(s => s.fetchUserData);
  const theme                 = useStore(s => s.theme);
  const themeColors           = useStore(s => s.themeColors);
  const hasCompletedOnboarding = useStore(s => s.hasCompletedOnboarding);
  const isNewUser             = useStore(s => s.transactions.length === 0 && s.reconHistory.length === 0);
  const { visible: tourVisible, dismiss: dismissTour } = useFeatureTour();

  const [session, setSession]           = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  // Set by Supabase when the user clicks a password-reset email link — even
  // though a (temporary) session is established, we should NOT show the main
  // app until they've actually set a new password.
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    initDB();
  }, []);

  // Lock screen when app is backgrounded
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && useStore.getState().lockEnabled) {
        useStore.getState().setState({ isLocked: true });
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  // Lock after 5 minutes of pointer/keyboard inactivity (complements the visibility check above)
  useIdleLock();

  // Payday lifecycle: run on mount and each time app comes to foreground
  useEffect(() => {
    runPaydayCheck(useStore.getState() as any);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        runPaydayCheck(useStore.getState() as any);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Also run after initial data load (mount fires before Supabase data arrives)
  useEffect(() => {
    if (dataLoaded) runPaydayCheck(useStore.getState() as any);
  }, [dataLoaded]);

  // Establish session on mount and subscribe to auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setTelemetryUser(s?.user?.id ?? null);
      if (!s) setSessionLoaded(true);
      // Only wipe on an explicit sign-out — not on INITIAL_SESSION or TOKEN_REFRESHED
      // events that may fire with null before Supabase loads the stored session.
      // Wiping on INITIAL_SESSION was causing hasCompletedOnboarding to reset,
      // hiding the LOG SPEND button on every page load.
      if (event === 'SIGNED_OUT') {
        useStore.getState().setState({ ...INITIAL_STATE });
        setRecoveryMode(false);
      }
      // PASSWORD_RECOVERY fires when Supabase processes the recovery link's
      // hash from the URL. We pin the UI to the "set new password" view until
      // the user actually finishes the update.
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Populate store from Supabase whenever the authenticated user changes
  useEffect(() => {
    if (session?.user?.id) {
      fetchUserData(session.user.id);
    }
  }, [session?.user?.id, fetchUserData]);

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    // Boost a color's brightness proportionally when it's too dark for dark mode
    const boostForDark = (hex: string): string => {
      if (theme !== 'dark') return hex;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const toLinear = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
      const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
      if (L >= 0.18) return hex;
      const scale = Math.sqrt(0.22 / Math.max(L, 0.001));
      const ch = (v: number) => Math.min(255, Math.round(v * scale)).toString(16).padStart(2, '0');
      return `#${ch(r)}${ch(g)}${ch(b)}`;
    };

    const contrastFor = (hex: string): string => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.45 ? '#000000' : '#ffffff';
    };

    // Darken a color that's too light to read as text on a light surface
    const readableOnLight = (hex: string): string => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (lum <= 0.35) return hex;
      const scale = 0.3 / lum;
      const ch = (v: number) => Math.round(v * scale).toString(16).padStart(2, '0');
      return `#${ch(r)}${ch(g)}${ch(b)}`;
    };

    const primary = themeColors?.primary || '#facc15';
    const secondary = themeColors?.secondary || '#00CC55';

    {
      const p = boostForDark(primary);
      document.documentElement.style.setProperty('--color-action-primary', p);
      document.documentElement.style.setProperty('--primary-contrast', contrastFor(p));
      document.documentElement.style.setProperty('--primary-readable', readableOnLight(p));
    }
    {
      const boosted = boostForDark(secondary);
      document.documentElement.style.setProperty('--color-action-capture', boosted);
      document.documentElement.style.setProperty('--capture-contrast', contrastFor(boosted));
      document.documentElement.style.setProperty('--capture-readable', readableOnLight(boosted));
      if (theme === 'dark') {
        const r = parseInt(boosted.slice(1, 3), 16);
        const g = parseInt(boosted.slice(3, 5), 16);
        const b = parseInt(boosted.slice(5, 7), 16);
        document.documentElement.style.setProperty('--shadow-color', `rgba(${r}, ${g}, ${b}, 0.22)`);
      } else {
        document.documentElement.style.removeProperty('--shadow-color');
      }
    }
  }, [themeColors, theme]);

  // Supabase env vars missing — show setup instructions
  if (!isSupabaseConfigured) {
    return (
      <div className="fixed inset-0 bg-base dot-bg flex items-center justify-center px-4 font-mono">
        <div className="w-full max-w-sm bg-surface border-4 border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4">
          <div className="inline-flex px-3 py-1 bg-action-bleed border-2 border-black rounded-full text-white text-[10px] font-black tracking-widest uppercase">
            SETUP REQUIRED
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tighter italic text-text-main leading-tight">
            Connect Supabase
          </h1>
          <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted leading-relaxed">
            Create a <span className="text-text-main">.env.local</span> file in the project root with your Supabase credentials:
          </p>
          <div className="bg-black rounded-2xl p-4 space-y-1">
            <p className="text-[11px] font-mono text-capture-readable">VITE_SUPABASE_URL=https://your-project.supabase.co</p>
            <p className="text-[11px] font-mono text-capture-readable">VITE_SUPABASE_ANON_KEY=your-anon-key</p>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
            Find these in: Supabase Dashboard → Project Settings → API
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
            Then restart the dev server.
          </p>
        </div>
      </div>
    );
  }

  // Waiting for initial session check
  if (!sessionLoaded) return <SyncFallback />;

  // No authenticated session OR mid-recovery → show login/signup gate.
  // In recovery mode AuthGate locks into "set new password" until the
  // updateUser call completes and we toggle recoveryMode back to false.
  if (!session || recoveryMode) {
    return (
      <ErrorBoundary>
        <AuthGate recoveryMode={recoveryMode} onRecoveryDone={() => setRecoveryMode(false)} />
      </ErrorBoundary>
    );
  }

  // Session established but Supabase data not yet loaded
  if (!dataLoaded) return <SyncFallback />;

  return (
    <ErrorBoundary>
      <ScreenLock />
      <AnimatePresence>
        {hasCompletedOnboarding && tourVisible && isNewUser && (
          <FeatureTour onDismiss={dismissTour} />
        )}
      </AnimatePresence>
      <Router>
        <PaydayBanner />
        <div className="h-screen bg-base dot-bg text-text-main font-sans flex flex-col md:flex-row overflow-hidden relative">
          <div className="md:w-64 shrink-0 z-50">
            <Suspense fallback={<NavigationFallback />}>
              <Navigation />
            </Suspense>
          </div>

          <main className="flex-1 overflow-y-auto overflow-x-hidden main-pb-safe md:pb-0 p-4 pt-4 md:p-8 relative">
            <div className="max-w-4xl mx-auto">
              <Routes>
                <Route path="/"                element={withPageWrapper(<Dashboard />)} />
                <Route path="/audit"           element={withPageWrapper(<Breakdown />)} />
                <Route path="/split"           element={withPageWrapper(<TacticalSplitter />)} />
                <Route path="/true-cost"       element={withPageWrapper(<TrueCost />)} />
                <Route path="/debt-destroyer"  element={withPageWrapper(<DebtDestroyer />)} />
                <Route path="/tactical-command" element={withPageWrapper(<TacticalCommand />)} />
                <Route path="/recon"           element={withPageWrapper(<Recon />)} />
                <Route path="/vaults"          element={withPageWrapper(<Vaults />)} />
                <Route path="/subscriptions"   element={withPageWrapper(<ActiveSubs />)} />
                <Route path="/compound-growth" element={withPageWrapper(<CompoundGrowth />)} />
                <Route path="/fire"            element={withPageWrapper(<Fire />)} />
                <Route path="/income"          element={withPageWrapper(<IncomeTracker />)} />
                <Route path="/transactions"    element={withPageWrapper(<Transactions />)} />
                <Route path="/breakdown"      element={withPageWrapper(<Breakdown />)} />
                <Route path="/config"          element={withPageWrapper(<Config />)} />
                <Route path="/settings"        element={withPageWrapper(<Settings />)} />
                <Route path="*"                element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </main>
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
