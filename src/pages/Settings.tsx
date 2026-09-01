import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Eye, EyeOff, Sun, Moon, SlidersHorizontal, ChevronRight, Lock, LockOpen,
  Trash2, Smartphone, RefreshCw, Zap, Trophy, Shield, Medal,
  User, Check, ChevronDown, FileDown, FileUp, Fingerprint,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore, INITIAL_STATE } from '../store/useStore';
import { COLOR_THEMES, FREE_THEME_IDS } from '../core/themes';
import { DASHBOARD_WIDGETS } from '../core/widgets';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { supabase } from '../core/supabase';
import { calculateTrueSafeSpend } from '../core/math';
import type { ImportPayload } from '../components/ImportMapperModal';
import { SetPinModal } from '../components/SetPinModal';
import { NotificationSettings } from '../components/NotificationSettings';
import { BillQueueItem } from '../store/useStore';
import {
  isPlatformAuthenticatorAvailable, hasEnrolledCredential,
  enrollCredential, clearEnrolledCredential,
} from '../lib/webauthn';
import { logSecurityEvent, logProductEvent } from '../core/telemetry';
import { clearUserLocalData } from '../lib/userScopedStorage';
import { clearSnapshot, cancelQueuedSnapshotSave } from '../db/storage';
import { CURRENCIES } from '../lib/currency';
import { useIsPro, useProLocked, refreshProStatus } from '../lib/pro';
import { PRICING } from '../lib/pricing';
import { ProAction } from '../components/ProAction';

// The importer statically pulls in xlsx + papaparse. Lazy-load it so those
// libraries only download when the user actually opens the import flow, not on
// every Settings visit. (Export functions are dynamically imported per-click below.)
const ImportMapperModal = lazy(() =>
  import('../components/ImportMapperModal').then(m => ({ default: m.ImportMapperModal })),
);

const DEFAULT_PRIMARY = '#facc15';
const DEFAULT_CAPTURE = '#00CC55';
const isValidHex = (v: string) => /^#[0-9A-Fa-f]{6}$/.test(v);
const safeHex = (v: string | undefined, fallback: string) => v && isValidHex(v) ? v : fallback;

const buildImportedState = (payload: unknown) => {
  const json = (payload && typeof payload === 'object') ? payload as Record<string, any> : {};
  const built = {
    ...INITIAL_STATE,
    ...json,
    salary: { ...INITIAL_STATE.salary, ...(json.salary && typeof json.salary === 'object' ? json.salary : {}) },
    stats: { ...INITIAL_STATE.stats, ...(json.stats && typeof json.stats === 'object' ? json.stats : {}) },
    transactions: Array.isArray(json.transactions) ? json.transactions : INITIAL_STATE.transactions,
    subscriptions: Array.isArray(json.subscriptions) ? json.subscriptions : INITIAL_STATE.subscriptions,
    vaults: Array.isArray(json.vaults) ? json.vaults : INITIAL_STATE.vaults,
    deletedVaults: Array.isArray(json.deletedVaults) ? json.deletedVaults : INITIAL_STATE.deletedVaults,
    debts: Array.isArray(json.debts) ? json.debts : INITIAL_STATE.debts,
    dashboardWidgets: Array.isArray(json.dashboardWidgets) ? json.dashboardWidgets : INITIAL_STATE.dashboardWidgets,
    impulses: Array.isArray(json.impulses) ? json.impulses : Array.isArray(json.gremlins) ? json.gremlins : INITIAL_STATE.impulses,
    reconHistory: Array.isArray(json.reconHistory) ? json.reconHistory : INITIAL_STATE.reconHistory,
    squad: Array.isArray(json.squad) ? json.squad : INITIAL_STATE.squad,
    splitHistory: Array.isArray(json.splitHistory) ? json.splitHistory : INITIAL_STATE.splitHistory,
    customSplitPresets: Array.isArray(json.customSplitPresets) ? json.customSplitPresets : INITIAL_STATE.customSplitPresets,
  };
  built.safeSpendLimit = calculateTrueSafeSpend(built as any);
  return built;
};


export default function Settings() {
  const state = useStore();
  const { theme, setTheme, privacyMode, togglePrivacyMode, dashboardWidgets, updateDashboardWidgets, lockEnabled, pinHash, setState, setThemeColors } = state;
  const navigate = useNavigate();
  const isPro = useIsPro();
  // Separate from `isPro` on purpose. `isPro` decides WHICH billing panel to show,
  // where defaulting to the pricing view during load is the safe error. `proLocked`
  // decides whether to draw a lock, and there the safe error is the opposite: never
  // stamp locks on a paying customer's themes while their status is still loading.
  const proLocked = useProLocked();

  // Kick off LemonSqueezy Checkout for a plan (the /api/checkout function builds
  // the hosted checkout; we just redirect to it).
  const startCheckout = async (plan: 'monthly' | 'annual' | 'lifetime') => {
    // Logged before the network call so the funnel captures intent even when
    // checkout creation fails or the user abandons the LemonSqueezy page.
    logProductEvent({ type: 'payment_intent', plan });
    try {
      // The function reads the buyer from this token, so it is the whole
      // request identity; the body only carries the plan.
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ plan }),
      });
      const { url, error } = await res.json();
      if (url) window.location.href = url;
      else alert(error || 'Could not start checkout. Billing may not be configured yet.');
    } catch {
      alert('Could not start checkout. Billing may not be configured yet.');
    }
  };

  // After returning from LemonSqueezy (redirect_url = /settings?pro=success),
  // re-read the entitlement so the unlock reflects once the webhook has run.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('pro') === 'success') {
      refreshProStatus();
      window.history.replaceState({}, '', '/settings#pro');
    }
  }, []);

  // Open the LemonSqueezy Customer Portal (manage / cancel / receipts).
  const openBillingPortal = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
      });
      const { url, error } = await res.json();
      if (url) window.location.href = url;
      else alert(error || 'No billing account found.');
    } catch {
      alert('Could not open the billing portal.');
    }
  };

  // PIN modal: 'create' the first time a user turns lock ON, 'change' when they
  // tap the rotate-PIN button later. Closed when null.
  const [pinModal, setPinModal] = useState<'create' | 'change' | null>(null);
  const handleLockToggle = () => {
    if (lockEnabled) {
      // Turning OFF — wipe the PIN material so re-enabling forces a fresh setup.
      // Also drop any enrolled biometric credential since it's tied to the lock.
      if (state.userId) clearEnrolledCredential(state.userId);
      setState({ lockEnabled: false, pinHash: '', pinSalt: '' });
    } else {
      // Turning ON — require a PIN first. The modal sets lockEnabled=true on success.
      setPinModal('create');
    }
  };

  // Biometric enrollment state — async check on mount, refresh after enroll/clear
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnrolled,  setBioEnrolled]  = useState(false);
  const [bioBusy,      setBioBusy]      = useState(false);
  const [bioError,     setBioError]     = useState('');
  useEffect(() => {
    let cancelled = false;
    isPlatformAuthenticatorAvailable().then(v => { if (!cancelled) setBioAvailable(v); });
    if (state.userId) setBioEnrolled(hasEnrolledCredential(state.userId));
    return () => { cancelled = true; };
  }, [state.userId, lockEnabled, pinHash]);

  const toggleBiometrics = async () => {
    if (!state.userId) return;
    setBioError('');
    setBioBusy(true);
    try {
      if (bioEnrolled) {
        clearEnrolledCredential(state.userId);
        setBioEnrolled(false);
      } else {
        await enrollCredential(state.userId, state.firstName || 'Pocket CFO');
        setBioEnrolled(true);
        logSecurityEvent({ type: 'webauthn.enrolled' });
      }
    } catch (err) {
      setBioError((err as Error).message || 'Biometric enrollment failed');
    } finally {
      setBioBusy(false);
    }
  };
  const { isInstallable, isInstalled, install } = usePWAInstall();

  const toggleWidget = (id: string) => {
    // A widget the stored array has never seen reads as visible (see isWidgetVisible),
    // so its first toggle has to ADD it as hidden. Mapping alone would match nothing,
    // write the array back unchanged, and leave the switch stuck on forever.
    const exists = dashboardWidgets.some(w => w.id === id);
    updateDashboardWidgets(
      exists
        // `visible: w.visible === false` both flips the flag and normalizes a
        // malformed value, which a plain `!w.visible` would not.
        ? dashboardWidgets.map(w => w.id === id ? { ...w, visible: w.visible === false } : w)
        : [...dashboardWidgets, { id, visible: false }],
    );
  };
  // Mirrors Dashboard's widgetVisible: only an explicit `false` counts as hidden.
  const isWidgetVisible = (id: string) => {
    const w = dashboardWidgets.find(x => x.id === id);
    return w?.visible !== false;
  };

  // Deep-link support: when arriving via /settings#dashboard-widgets (the
  // "Customize dashboard" shortcut), scroll the matching section into view once
  // the lazy-loaded page has rendered.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const t = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => clearTimeout(t);
  }, []);

  const [primaryColor, setPrimaryColor] = useState(() => safeHex(state.themeColors?.primary, DEFAULT_PRIMARY));
  const [captureColor, setCaptureColor] = useState(() => safeHex(state.themeColors?.secondary, DEFAULT_CAPTURE));

  // Export / Import state
  const [importOpen, setImportOpen] = useState(false);
  const snapshot = () => ({
    firstName:      state.firstName || '',
    liquidAssets:   state.liquidAssets,
    safeSpendLimit: state.safeSpendLimit,
    upcomingBills:  state.upcomingBills,
    transactions:   state.transactions,
    vaults:         state.vaults,
    debts:          state.debts,
    subscriptions:  state.subscriptions,
  });

  // Export libraries are loaded on demand. Wrap the dynamic import + generation so a
  // failed chunk load (e.g. offline) or a generation error surfaces to the user
  // instead of becoming a silent unhandled rejection.
  const runExport = async (fn: (mod: typeof import('../core/export')) => void | Promise<void>) => {
    try {
      const mod = await import('../core/export');
      await fn(mod);
    } catch (err) {
      console.error('[PocketCFO] export failed', err);
      alert('Export failed. Please try again.');
    }
  };
  // The modal and its parser (xlsx/papaparse) are no longer precached by the
  // service worker, so fetch them before rendering. Letting lazy() do it means a
  // failed load throws during render and trips the app-level ErrorBoundary;
  // resolving it here turns the offline case into the same readable message the
  // export buttons give. Once loaded, the lazy() below hits a warm module cache.
  const openImport = async () => {
    try {
      await import('../components/ImportMapperModal');
      setImportOpen(true);
    } catch (err) {
      console.error('[PocketCFO] import module failed to load', err);
      alert('Import needs a connection the first time you use it. Please try again online.');
    }
  };

  const handleImport = (payload: ImportPayload) => {
    state.massImportTransactions(payload.transactions);

    // Merge any newly-detected recurring bills into the existing template, deduping
    // by (lowercase name + amount) so re-importing doesn't double-add the same bills.
    if (payload.recurringBills.length > 0) {
      const existing = state.recurringBills || [];
      const seen = new Set(existing.map(b => `${b.name.toLowerCase()}|${b.amount.toFixed(2)}`));
      const additions: BillQueueItem[] = [];
      for (const b of payload.recurringBills) {
        const key = `${b.name.toLowerCase()}|${b.amount.toFixed(2)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        additions.push({ id: crypto.randomUUID(), name: b.name, amount: b.amount, dueDay: b.dueDay });
      }
      if (additions.length > 0) {
        const next = [...existing, ...additions];
        const total = next.reduce((s, b) => s + b.amount, 0);
        // Re-save the current pay cycle with the augmented bill list so the queue + math sync.
        state.setHorizon(state.liquidAssets, state.nextPayday, total, state.hardDailyCap, next);
      }
    }

    // Recurring income → offer to set the user's monthly take-home if they don't have one,
    // or if the detected amount is meaningfully higher than what's saved.
    if (payload.recurringIncome > 0) {
      const current = state.monthlyTakeHome || 0;
      if (payload.recurringIncome > current) {
        state.updateBaseline(payload.recurringIncome, state.monthlySavingsGoal || 0);
      }
    }
  };
  const [accentOpen, setAccentOpen] = useState(false);

  const [firstName, setFirstName] = useState(state.firstName || '');
  const [firstNameSaved, setFirstNameSaved] = useState(false);
  const xpProgress = ((state.stats.experience || 0) % 1000) / 10;
  const xpBarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    xpBarRef.current?.style.setProperty('--bar-fill', `${xpProgress}%`);
  }, [xpProgress]);

  const saveFirstName = async () => {
    const userId = state.userId;
    if (!userId) return;
    await (supabase.from('profiles') as any)
      .update({ first_name: firstName.trim() || null })
      .eq('id', userId);
    setState({ firstName: firstName.trim() } as any);
    setFirstNameSaved(true);
    setTimeout(() => setFirstNameSaved(false), 2000);
  };

  const [wiping, setWiping] = useState(false);
  const [wipeArmed, setWipeArmed] = useState(false);
  const wipeTimerRef = useRef<ReturnType<typeof setTimeout>>(0 as unknown as ReturnType<typeof setTimeout>);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountArmed, setDeleteAccountArmed] = useState(false);
  const deleteAccountTimerRef = useRef<ReturnType<typeof setTimeout>>(0 as unknown as ReturnType<typeof setTimeout>);

  const armWipe = () => {
    setWipeArmed(true);
    wipeTimerRef.current = setTimeout(() => setWipeArmed(false), 10000);
  };

  const armDeleteAccount = () => {
    setDeleteAccountArmed(true);
    deleteAccountTimerRef.current = setTimeout(() => setDeleteAccountArmed(false), 10000);
  };

  const handleWipe = async () => {
    clearTimeout(wipeTimerRef.current);
    setWipeArmed(false);
    const userId = state.userId;
    if (!userId) return;
    const preservedFirstName = state.firstName;
    setWiping(true);
    await Promise.all([
      (supabase.from('transactions')  as any).delete().eq('user_id', userId),
      (supabase.from('vaults')        as any).delete().eq('user_id', userId),
      (supabase.from('debts')         as any).delete().eq('user_id', userId),
      (supabase.from('subscriptions') as any).delete().eq('user_id', userId),
      (supabase.from('recon_history') as any).delete().eq('user_id', userId),
    ]);
    const wipeProfilePayload: Record<string, unknown> = {
      liquid_assets: 0, monthly_take_home: 0, fixed_bills: 0,
      monthly_savings_goal: 0, next_payday: null, payday_anchor_day: null, upcoming_bills: 0,
      hard_daily_cap: 0, has_completed_onboarding: false, is_configured: false,
    };
    let { error: wipeProfileError } = await (supabase.from('profiles') as any).update(wipeProfilePayload).eq('id', userId);
    if (wipeProfileError?.code === '42703' && /payday_anchor_day/i.test(wipeProfileError.message || '')) {
      delete wipeProfilePayload.payday_anchor_day;
      ({ error: wipeProfileError } = await (supabase.from('profiles') as any).update(wipeProfilePayload).eq('id', userId));
    }
    if (wipeProfileError) console.error('[wipe] profile reset failed:', wipeProfileError);
    // Clear browser-local tool state too (FIRE inputs, recon locks, bill-queue
    // cache, tour flag) so the wipe is a true reset — not just the cloud rows.
    clearUserLocalData(userId);
    // Same for the offline snapshot — a wipe that leaves the old numbers in
    // IndexedDB would hand them straight back on the next cold start.
    cancelQueuedSnapshotSave();
    await clearSnapshot(userId);
    setState({
      ...INITIAL_STATE,
      userId,
      firstName: preservedFirstName,
      dataLoaded: true,
      dataFresh: true,
      allTransactionsLoaded: true,
    });
    navigate('/', { replace: true });
    setWiping(false);
  };

  const handleDeleteAccount = async () => {
    clearTimeout(deleteAccountTimerRef.current);
    setDeleteAccountArmed(false);
    const userId = state.userId;
    if (!userId) return;

    setDeletingAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
      });
      const raw = await res.text();
      const body = (() => {
        try {
          return raw ? JSON.parse(raw) as { error?: string } : {};
        } catch {
          return {};
        }
      })();
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Account deletion API is not running. Restart the dev server or use the deployed app.');
        }
        throw new Error(body.error || 'Could not delete account');
      }

      clearUserLocalData(userId);
      cancelQueuedSnapshotSave();
      await clearSnapshot(userId);
      await supabase.auth.signOut();
      setState({ ...INITIAL_STATE });
    } catch (err) {
      console.error('[PocketCFO] delete account failed', err);
      alert((err as Error).message || 'Could not delete account. Please try again.');
      setDeletingAccount(false);
    }
  };

  const exportData = () => {
    // Strip security material — the PIN hash + salt are device-local secrets
    // and have no business sitting in a backup file the user might share.
    const { pinHash: _ph, pinSalt: _ps, ...safeState } = state as any;
    void _ph; void _ps;
    const dataStr = JSON.stringify(safeState, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const a = document.createElement('a');
    a.setAttribute('href', dataUri);
    a.setAttribute('download', `pocket_cfo_payload_${new Date().toISOString().split('T')[0]}.json`);
    a.click();
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const json = JSON.parse(e.target?.result as string);
        setState(buildImportedState(json));
        alert('Data Restored Successfully.');
      } catch { alert('Invalid Data Payload.'); }
    };
    reader.readAsText(file);
  };

  const achievements = [
    { id: '1', title: 'Sub Slayer',      desc: 'Cancel 3 subscriptions', unlocked: state.stats.subscriptionsCancelled >= 3, icon: Zap    },
    { id: '2', title: 'Snowball Striker', desc: 'Execute 10 flips',       unlocked: state.stats.flipsExecuted >= 10,          icon: Shield },
    { id: '3', title: 'Capital King',     desc: 'Secure $1,000 in Vaults', unlocked: state.vaults.reduce((acc, v) => acc + v.current, 0) >= 1000, icon: Trophy },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 w-full max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">
          Settings
        </h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">
          Display, security & app preferences
        </p>
      </div>

      {/* Profile */}
      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-text-muted/60 mb-4">Profile</p>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 bg-action-primary border-4 border-black rounded-xl flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] shrink-0">
            <User size={26} strokeWidth={3} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">User Level</div>
            <div className="text-2xl font-black italic text-text-main">LVL {state.stats.level}</div>
            <div className="w-full h-2 bg-input rounded-full mt-1 overflow-hidden border border-border">
              <div ref={xpBarRef} className="h-full bg-action-capture bar-fill" />
            </div>
          </div>
        </div>
        <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-2">Your First Name</label>
        <div className="flex gap-3">
          <input
            type="text"
            autoComplete="given-name"
            placeholder="e.g. Alex"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveFirstName()}
            className="flex-1 bg-input border-4 border-black rounded-2xl px-4 py-3 font-mono font-bold text-sm text-text-main outline-none focus:border-action-capture transition-colors"
          />
          <button
            type="button"
            onClick={saveFirstName}
            className="h-12 px-6 border-4 border-black rounded-2xl bg-black text-action-primary font-black uppercase text-xs tracking-widest flex items-center gap-2 shadow-[3px_3px_0px_0px_var(--color-action-primary)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
          >
            {firstNameSaved ? <><Check size={13} /> Saved</> : 'Save'}
          </button>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-2">Shows in your dashboard greeting</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:items-start">
        {/* Display */}
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-3">
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-text-muted/60 mb-1">Display</p>

          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black uppercase tracking-widest text-text-main">Privacy Mode</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-0.5">Masks total balances with ••••••</p>
            </div>
            <button
              type="button"
              onClick={() => togglePrivacyMode()}
              className={`flex items-center justify-center gap-2 min-w-20 px-4 py-2.5 border-4 border-black rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-brutal-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 shrink-0 ${privacyMode ? 'bg-action-bleed text-white' : 'bg-input text-text-main'}`}
            >
              {privacyMode ? <EyeOff size={13} strokeWidth={2.5} /> : <Eye size={13} strokeWidth={2.5} />}
              {privacyMode ? 'On' : 'Off'}
            </button>
          </div>

          <div className="h-px bg-border opacity-30" />

          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black uppercase tracking-widest text-text-main">Screen Lock</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-0.5">
                4-digit PIN required when app is backgrounded
              </p>
            </div>
            <button
              type="button"
              onClick={handleLockToggle}
              className={`flex items-center justify-center gap-2 min-w-20 px-4 py-2.5 border-4 border-black rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-brutal-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 shrink-0 ${lockEnabled ? 'bg-black text-action-primary' : 'bg-input text-text-main'}`}
            >
              {lockEnabled ? <Lock size={13} strokeWidth={2.5} /> : <LockOpen size={13} strokeWidth={2.5} />}
              {lockEnabled ? 'On' : 'Off'}
            </button>
          </div>

          {lockEnabled && pinHash && (
            <button
              type="button"
              onClick={() => setPinModal('change')}
              className="w-full h-10 border-2 border-border rounded-2xl bg-input text-text-muted font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:border-black hover:text-text-main transition-all"
            >
              <Lock size={12} strokeWidth={2.5} /> Change PIN
            </button>
          )}

          {/* Biometric unlock — gated on having an active PIN-protected session */}
          {lockEnabled && pinHash && bioAvailable && (
            <>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black uppercase tracking-widest text-text-main flex items-center gap-1.5">
                    <Fingerprint size={14} strokeWidth={2.5} /> Biometric Unlock
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-0.5">
                    Touch ID / Face ID instead of typing the PIN
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleBiometrics}
                  disabled={bioBusy}
                  className={`flex items-center justify-center gap-2 min-w-20 px-4 py-2.5 border-4 border-black rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-brutal-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 shrink-0 disabled:opacity-40 ${bioEnrolled ? 'bg-action-capture text-capture-contrast' : 'bg-input text-text-main'}`}
                >
                  {bioBusy ? '…' : bioEnrolled ? 'On' : 'Off'}
                </button>
              </div>
              {bioError && (
                <p className="text-[10px] font-black uppercase tracking-widest text-action-bleed">
                  {bioError}
                </p>
              )}
            </>
          )}

          <div className="h-px bg-border opacity-30" />

          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black uppercase tracking-widest text-text-main">Theme</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-0.5">
                {theme === 'light' ? 'Light mode active' : 'Dark mode active'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="flex items-center justify-center gap-2 min-w-20 px-4 py-2.5 bg-input border-4 border-black rounded-2xl font-black uppercase text-[10px] tracking-widest text-text-main transition-all shadow-brutal-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 shrink-0"
            >
              {theme === 'light' ? <Moon size={13} strokeWidth={2.5} /> : <Sun size={13} strokeWidth={2.5} />}
              {theme === 'light' ? 'Dark' : 'Light'}
            </button>
          </div>
        </div>

        {/* Notifications */}
        <NotificationSettings />

        {/* Pro tier — three-tier pricing, state driven by the LemonSqueezy webhook */}
        <div id="pro" className="scroll-mt-20 bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <div className="flex items-center gap-2 mb-4">
            <Lock size={14} strokeWidth={2.5} className="text-text-muted shrink-0" />
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-text-muted/60">Pocket CFO Pro</p>
          </div>
          {!isPro ? (
            <>
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mb-3">
                FIRE, Income Tracker, and Debt Payoff are free previews. Pro unlocks saving and full actions.
              </p>

              {/* Annual — the hero */}
              <button type="button" onClick={() => startCheckout('annual')}
                className="w-full text-left bg-action-primary border-4 border-black rounded-2xl p-4 flex items-center justify-between shadow-brutal mb-3 hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all">
                <div>
                  <div className="text-lg font-black text-black tabular-nums">{PRICING.annual.price}<span className="text-sm font-bold">/yr</span></div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-black/70">{PRICING.annual.sub}</div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest bg-black text-action-primary px-3 py-1 rounded-full">Best value</span>
              </button>

              {/* Monthly + Lifetime — quieter */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <button type="button" onClick={() => startCheckout('monthly')}
                  className="text-left bg-input border-2 border-black rounded-2xl p-4 hover:border-black hover:bg-surface transition-colors">
                  <div className="text-[1rem] font-black text-text-main tabular-nums">{PRICING.monthly.price}<span className="text-xs font-bold">/mo</span></div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{PRICING.monthly.sub}</div>
                </button>
                <button type="button" onClick={() => startCheckout('lifetime')}
                  className="text-left bg-input border-2 border-black rounded-2xl p-4 hover:border-black hover:bg-surface transition-colors">
                  <div className="text-[1rem] font-black text-text-main tabular-nums">{PRICING.lifetime.price}<span className="text-xs font-bold"> once</span></div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{PRICING.lifetime.sub}</div>
                </button>
              </div>

              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted/60">No bank login · Cancel anytime</p>
            </>
          ) : (
            <>
              <div className="bg-action-capture/10 border-4 border-action-capture rounded-2xl p-4 mb-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-action-capture border-4 border-black flex items-center justify-center shrink-0">
                  <Check size={18} strokeWidth={3} className="text-black" />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-tight text-text-main">Pro is active</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">All tools, themes, and unlimited vaults unlocked</p>
                </div>
              </div>
              <button type="button" onClick={openBillingPortal}
                className="w-full h-12 border-4 border-black rounded-2xl bg-surface text-text-main font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-input transition-all shadow-brutal-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5">
                Manage billing
              </button>
            </>
          )}
        </div>

        {/* Dashboard Widgets */}
        <div id="dashboard-widgets" className="scroll-mt-20 bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <div className="flex items-center gap-2 mb-4">
            <SlidersHorizontal size={14} strokeWidth={2.5} className="text-text-muted shrink-0" />
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-text-muted/60">Dashboard Widgets</p>
          </div>
          <div className="space-y-3">
            {DASHBOARD_WIDGETS.map((widget, i) => {
              const visible = isWidgetVisible(widget.id);
              return (
                <div key={widget.id}>
                  {i > 0 && <div className="h-px bg-border opacity-30 mb-3" />}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black uppercase tracking-widest text-text-main">{widget.label}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-0.5">{widget.description}</p>
                    </div>
                    <button
                      type="button"
                      title={`${visible ? 'Hide' : 'Show'} ${widget.label}`}
                      onClick={() => toggleWidget(widget.id)}
                      className={`w-12 h-6 rounded-full border-[3px] border-black relative transition-colors shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${visible ? 'bg-action-capture' : 'bg-input'}`}
                    >
                      <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-black border-2 border-black transition-all ${visible ? 'left-[calc(100%-18px)]' : 'left-0.5'}`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-text-muted mt-4 pt-4 border-t-2 border-border/30">
            Hidden widgets are saved to your profile · toggle anytime.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:items-stretch">
        {/* Achievements */}
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] flex flex-col">
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-text-muted/60 mb-4">Achievements</p>
          <div className="space-y-3 flex-1">
            {achievements.map(ach => (
              <div key={ach.id} className={`flex items-center gap-4 p-3 rounded-2xl border-4 transition-all ${ach.unlocked ? 'bg-input border-black' : 'bg-transparent border-dashed border-black/20 opacity-40'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 border-black shrink-0 ${ach.unlocked ? 'bg-action-primary' : 'bg-input'}`}>
                  <ach.icon size={16} strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-sm uppercase tracking-tighter text-text-main truncate">{ach.title}</h4>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted truncate">{ach.desc}</p>
                </div>
                {ach.unlocked && <Medal size={22} className="text-action-primary ml-auto shrink-0" strokeWidth={2.5} />}
              </div>
            ))}
          </div>
        </div>

        {/* Data & Security */}
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] flex flex-col">
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-text-muted/60 mb-4">Data & Security</p>
          <div className="space-y-3 flex-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-text-muted/60">Export</p>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => runExport(m => m.exportLedgerCSV(state.transactions))}
                className="h-12 border-4 border-black rounded-2xl bg-surface text-text-main font-black uppercase text-[10px] tracking-widest flex flex-col items-center justify-center gap-0.5 hover:bg-input transition-all shadow-brutal-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5">
                <FileDown size={14} /> CSV
              </button>
              <button type="button" onClick={() => runExport(m => m.exportWorkbookXLSX(snapshot()))}
                className="h-12 border-4 border-black rounded-2xl bg-surface text-text-main font-black uppercase text-[10px] tracking-widest flex flex-col items-center justify-center gap-0.5 hover:bg-input transition-all shadow-brutal-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5">
                <FileDown size={14} /> XLSX
              </button>
              <ProAction feature="export_pdf">
                <button type="button" onClick={() => runExport(m => m.exportReportPDF(snapshot()))}
                  className="h-12 border-4 border-black rounded-2xl bg-surface text-text-main font-black uppercase text-[10px] tracking-widest flex flex-col items-center justify-center gap-0.5 hover:bg-input transition-all shadow-brutal-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5">
                  <FileDown size={14} /> PDF
                </button>
              </ProAction>
            </div>

            <p className="text-[9px] font-black uppercase tracking-widest text-text-muted/60 mt-2">Import</p>
            <ProAction feature="import">
              <button type="button" onClick={openImport}
                className="w-full h-12 border-4 border-black rounded-full bg-surface text-text-main font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-input transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1">
                <FileUp size={16} /> IMPORT STATEMENT (CSV / XLSX)
              </button>
            </ProAction>

            <details className="border-2 border-border rounded-2xl px-3 py-2">
              <summary className="text-[10px] font-black uppercase tracking-widest text-text-muted cursor-pointer">JSON Backup (Legacy)</summary>
              <div className="mt-2 space-y-2">
                <button type="button" onClick={exportData}
                  className="w-full h-9 border-2 border-border rounded-full bg-input text-text-muted font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:text-text-main transition-all">
                  <FileDown size={12} /> Export JSON
                </button>
                <motion.label className="w-full h-9 border-2 border-border rounded-full bg-input text-text-muted font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 cursor-pointer hover:text-text-main transition-all">
                  <FileUp size={12} /> Import JSON
                  <input type="file" title="Import JSON State" className="hidden" accept=".json" onChange={importData} />
                </motion.label>
              </div>
            </details>
            {isInstalled ? (
              <div className="w-full h-12 border-4 border-action-capture rounded-full bg-action-capture/10 text-capture-readable font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2">
                <Smartphone size={16} /> PWA INSTALLED
              </div>
            ) : (
              <button type="button" onClick={install} disabled={!isInstallable}
                className="w-full h-12 border-4 border-black rounded-full bg-surface text-text-main font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-input transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                <Smartphone size={16} /> {isInstallable ? 'INSTALL PWA' : 'ON iOS: SHARE → ADD TO HOME SCREEN'}
              </button>
            )}
            <button type="button" onClick={() => setState({ isConfigured: false } as any)}
              className="w-full h-12 border-4 border-black rounded-full bg-surface text-text-main font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-input transition-all">
              <RefreshCw size={16} /> RE-RUN ONBOARDING
            </button>
            {wipeArmed ? (
              <button type="button" onClick={handleWipe} disabled={wiping}
                className="w-full h-12 border-4 border-action-bleed rounded-full bg-action-bleed text-white font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all animate-pulse">
                <Trash2 size={16} /> TAP AGAIN TO CONFIRM
              </button>
            ) : (
              <button type="button" onClick={armWipe} disabled={wiping}
                className="w-full h-12 border-4 border-action-bleed rounded-full bg-action-bleed/10 text-action-bleed font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-action-bleed/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <Trash2 size={16} /> {wiping ? 'WIPING…' : 'WIPE SYSTEM'}
              </button>
            )}
            <p className="text-[9px] font-black uppercase tracking-widest text-text-muted/60 mt-2">Account</p>
            {deleteAccountArmed ? (
              <button type="button" onClick={handleDeleteAccount} disabled={deletingAccount}
                className="w-full h-12 border-4 border-action-bleed rounded-full bg-action-bleed text-white font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all animate-pulse disabled:opacity-60 disabled:cursor-not-allowed">
                <Trash2 size={16} /> {deletingAccount ? 'DELETING...' : 'DELETE FOREVER'}
              </button>
            ) : (
              <button type="button" onClick={armDeleteAccount} disabled={deletingAccount}
                className="w-full h-12 border-4 border-action-bleed rounded-full bg-surface text-action-bleed font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-action-bleed/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <Trash2 size={16} /> {deletingAccount ? 'DELETING...' : 'DELETE ACCOUNT'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Currency */}
      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-text-muted/60 mb-3">Currency</p>
        <label htmlFor="currency-select" className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Display Currency</label>
        <div className="relative">
          <select
            id="currency-select"
            value={state.currency}
            onChange={e => state.setCurrency(e.target.value)}
            title="Display currency"
            className="w-full appearance-none bg-input border-4 border-black rounded-2xl pl-4 pr-11 py-3 font-black text-sm text-text-main outline-none focus:border-action-capture cursor-pointer"
          >
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>{c.code} · {c.name}</option>
            ))}
          </select>
          <ChevronDown size={16} strokeWidth={2.5} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-2">
          Sets how amounts are shown across the app. No conversion. Enter amounts in your own currency.
        </p>
      </div>

      {/* Accent Colors — collapsible */}
      <div className="bg-surface border-4 border-border rounded-3xl shadow-[6px_6px_0px_0px_var(--shadow-color)]">
        <button
          type="button"
          onClick={() => setAccentOpen(o => !o)}
          className="w-full flex items-center justify-between gap-3 px-5 py-4"
        >
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-text-muted/60">Accent Colors</p>
          <motion.div animate={{ rotate: accentOpen ? 180 : 0 }} transition={{ type: 'spring', stiffness: 380, damping: 38 }}>
            <ChevronDown size={16} strokeWidth={2.5} className="text-text-muted" />
          </motion.div>
        </button>
        <AnimatePresence initial={false}>
          {accentOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              style={{ overflow: 'hidden' }}
            >
              <div className="px-5 pb-5">
                <div className="flex justify-end mb-3">
                  <button
                    type="button"
                    onClick={() => { setPrimaryColor(DEFAULT_PRIMARY); setCaptureColor(DEFAULT_CAPTURE); setThemeColors(DEFAULT_PRIMARY, DEFAULT_CAPTURE); }}
                    className="text-[11px] font-black uppercase tracking-widest text-text-muted hover:text-text-main transition-colors"
                  >
                    Reset defaults
                  </button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4 mb-4">
                  {COLOR_THEMES.map(t => {
                    const isActive = primaryColor === t.primary && captureColor === t.capture;
                    const locked = proLocked && !FREE_THEME_IDS.has(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          if (locked) { window.dispatchEvent(new CustomEvent('pro-upsell', { detail: { feature: 'theme' } })); return; }
                          setPrimaryColor(t.primary); setCaptureColor(t.capture); setThemeColors(t.primary, t.capture);
                        }}
                        className={`relative swatch-${t.id} flex flex-col items-center gap-1.5 p-3 rounded-xl border-4 transition-all ${isActive ? 'border-black shadow-brutal-sm' : 'border-transparent hover:border-border'}`}
                      >
                        <div className={`flex gap-1 ${locked ? 'opacity-40' : ''}`}>
                          <div className="swatch-dot-primary w-5 h-5 rounded-full border-2 border-black/30" />
                          <div className="swatch-dot-capture w-5 h-5 rounded-full border-2 border-black/30" />
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-wide leading-tight text-center ${locked ? 'text-text-muted/50' : 'text-text-muted'}`}>{t.name}</span>
                        {locked && (
                          <div className="absolute top-1 right-1 text-text-muted"><Lock size={10} strokeWidth={3} /></div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {isPro ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wide text-text-muted mb-2 block">Primary Color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" title="Primary Color Picker"
                        value={isValidHex(primaryColor) ? primaryColor : DEFAULT_PRIMARY}
                        onChange={e => { setPrimaryColor(e.target.value); setState({ themeColors: { ...state.themeColors, primary: e.target.value } }); }}
                        className="w-12 h-10 p-1 rounded-xl bg-input border-4 border-black cursor-pointer" />
                      <input type="text" title="Primary Color Hex"
                        className="flex-1 bg-input border-4 border-black rounded-xl p-2 font-black text-sm uppercase text-text-main outline-none"
                        value={primaryColor}
                        onChange={e => setPrimaryColor(e.target.value)}
                        onBlur={e => {
                          const raw = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                          if (isValidHex(raw)) { setPrimaryColor(raw); setThemeColors(raw, captureColor); }
                          else { setPrimaryColor(safeHex(state.themeColors?.primary, DEFAULT_PRIMARY)); }
                        }} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wide text-text-muted mb-2 block">Capture Color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" title="Capture Color Picker"
                        value={isValidHex(captureColor) ? captureColor : DEFAULT_CAPTURE}
                        onChange={e => { setCaptureColor(e.target.value); setState({ themeColors: { ...state.themeColors, secondary: e.target.value } }); }}
                        className="w-12 h-10 p-1 rounded-xl bg-input border-4 border-black cursor-pointer" />
                      <input type="text" title="Capture Color Hex"
                        className="flex-1 bg-input border-4 border-black rounded-xl p-2 font-black text-sm uppercase text-text-main outline-none"
                        value={captureColor}
                        onChange={e => setCaptureColor(e.target.value)}
                        onBlur={e => {
                          const raw = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                          if (isValidHex(raw)) { setCaptureColor(raw); setThemeColors(primaryColor, raw); }
                          else { setCaptureColor(safeHex(state.themeColors?.secondary, DEFAULT_CAPTURE)); }
                        }} />
                    </div>
                  </div>
                </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('pro-upsell', { detail: { feature: 'theme_studio' } }))}
                    className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border-4 border-dashed border-border text-text-muted hover:border-black hover:text-text-main transition-colors"
                  >
                    <Lock size={14} strokeWidth={3} />
                    <span className="text-[11px] font-black uppercase tracking-widest">Custom Theme Studio · Pro</span>
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Financial Config link */}
      <Link
        to="/config"
        className="flex items-center gap-4 bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all group"
      >
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-0.5">Financial Configuration</p>
          <p className="text-sm font-black uppercase tracking-widest text-text-main">Income, Bills & Budget →</p>
        </div>
        <ChevronRight size={18} strokeWidth={3} className="text-text-muted group-hover:text-text-main transition-colors shrink-0" />
      </Link>

      {importOpen && (
        <Suspense fallback={null}>
          <ImportMapperModal open={importOpen} onClose={() => setImportOpen(false)} onImport={handleImport} />
        </Suspense>
      )}
      <SetPinModal open={pinModal !== null} mode={pinModal ?? 'create'} onClose={() => setPinModal(null)} />
    </motion.div>
  );
}
