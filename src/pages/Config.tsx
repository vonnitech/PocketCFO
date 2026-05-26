import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { motion } from 'motion/react';
import { Download, Upload, Trash2, Smartphone, RefreshCw, Sun, Moon, User, Trophy, Zap, Medal, Shield, Plus, Check, X, Edit2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { INITIAL_STATE, Debt, BillQueueItem } from '../store/useStore';
import { useStore } from '../store/useStore';
import { supabase } from '../core/supabase';
import { calculateTrueSafeSpend } from '../core/math';

const buildImportedState = (payload: unknown) => {
  const json = (payload && typeof payload === 'object') ? payload as Record<string, any> : {};

  const built = {
    ...INITIAL_STATE,
    ...json,
    salary: {
      ...INITIAL_STATE.salary,
      ...(json.salary && typeof json.salary === 'object' ? json.salary : {}),
    },
    stats: {
      ...INITIAL_STATE.stats,
      ...(json.stats && typeof json.stats === 'object' ? json.stats : {}),
    },
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

  // Recalculate derived budget value so the dashboard never starts with a stale zero
  built.safeSpendLimit = calculateTrueSafeSpend(built as any);

  return built;
};

const DEFAULT_PRIMARY = '#facc15';
const DEFAULT_CAPTURE = '#00CC55';
const isValidHex = (v: string) => /^#[0-9A-Fa-f]{6}$/.test(v);
const safeHex = (v: string | undefined, fallback: string) =>
  v && isValidHex(v) ? v : fallback;

function Card({ children, badge, badgeColor = 'bg-black', badgeTextColor = 'text-action-primary' }: { children: React.ReactNode; badge: string; badgeColor?: string; badgeTextColor?: string }) {
  return (
    <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
      <div className={`inline-flex px-3 py-1 ${badgeColor} border-2 border-black rounded-full ${badgeTextColor} text-[10px] font-black tracking-widest uppercase mb-4`}>
        {badge}
      </div>
      {children}
    </div>
  );
}

export default function Config() {
  const state = useStore();
  const { privacyMode, setPrivacyMode, theme, setTheme, setState, setHorizon, updateBaseline, addDebt, updateDebt, removeDebt, setImpulses } = state;


  const { isInstallable, isInstalled, install } = usePWAInstall();

  const [isAddingConfigImpulse, setIsAddingConfigImpulse] = useState(false);
  const [newConfigImpulseName, setNewConfigImpulseName] = useState('');

  // Horizon settings state — string so empty field shows blank not "0"
  const [horizonCapital, setHorizonCapital] = useState(() => state.liquidAssets || '');
  const [horizonPayday, setHorizonPayday] = useState(state.nextPayday || '');
  const [horizonSaved, setHorizonSaved] = useState(false);
  const [horizonCap, setHorizonCap] = useState(() => state.hardDailyCap > 0 ? String(state.hardDailyCap) : '');

  // Bill queue state for the Horizon card
  const [configBills, setConfigBills] = useState<{ id: string; name: string; amount: string }[]>(
    () => (state.recurringBills || []).map(b => ({ id: b.id, name: b.name, amount: String(b.amount) }))
  );
  const [newBillName, setNewBillName] = useState('');
  const [newBillAmount, setNewBillAmount] = useState('');
  const [isAddingBill, setIsAddingBill] = useState(false);

  // Monthly Baseline state — string so empty field shows blank not "0"
  const [baselineIncome, setBaselineIncome] = useState(() => state.monthlyTakeHome || '');
  const [baselineSavings, setBaselineSavings] = useState(() => state.monthlySavingsGoal || '');
  const [baselineSaved, setBaselineSaved] = useState(false);

  // Local color state — avoids per-keypress store updates breaking the color picker
  const [primaryColor, setPrimaryColor] = useState(() => safeHex(state.themeColors?.primary, DEFAULT_PRIMARY));
  const [captureColor, setCaptureColor] = useState(() => safeHex(state.themeColors?.secondary, DEFAULT_CAPTURE));

  // Local impulse rate state — avoids per-keypress store updates that stomp cursor
  const [impulseRates, setImpulseRates] = useState<Record<string, string>>(() =>
    Object.fromEntries((state.impulses || []).map(g => [g.id, String(g.taxRate * 100)]))
  );

  // Debt management state
  const [isAddingDebt, setIsAddingDebt] = useState(false);
  const [newDebtName, setNewDebtName] = useState('');
  const [newDebtBalance, setNewDebtBalance] = useState('');
  const [newDebtRate, setNewDebtRate] = useState('');
  const [newDebtMin, setNewDebtMin] = useState('');
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [editDebtFields, setEditDebtFields] = useState<Partial<Omit<Debt, 'id'>>>({});

  const [wiping,   setWiping]   = useState(false);
  const [wipeArmed, setWipeArmed] = useState(false);
  const wipeTimerRef = { current: 0 as ReturnType<typeof setTimeout> };

  const armWipe = () => {
    setWipeArmed(true);
    wipeTimerRef.current = setTimeout(() => setWipeArmed(false), 10000);
  };

  const handleWipe = async () => {
    clearTimeout(wipeTimerRef.current);
    setWipeArmed(false);
    const userId = state.userId;
    if (!userId) return;
    setWiping(true);

    await Promise.all([
      (supabase.from('transactions')  as any).delete().eq('user_id', userId),
      (supabase.from('vaults')        as any).delete().eq('user_id', userId),
      (supabase.from('debts')         as any).delete().eq('user_id', userId),
      (supabase.from('subscriptions') as any).delete().eq('user_id', userId),
    ]);

    await (supabase.from('profiles') as any).update({
      liquid_assets:            0,
      monthly_take_home:        0,
      fixed_bills:              0,
      monthly_savings_goal:     0,
      next_payday:              null,
      upcoming_bills:           0,
      hard_daily_cap:           0,
      has_completed_onboarding: false,
      is_configured:            false,
    }).eq('id', userId);

    setState({
      ...INITIAL_STATE,
      userId,
      dataLoaded: true,
    });
    setWiping(false);
  };

  const exportData = () => {
    const dataStr = JSON.stringify(state, null, 2);
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
      }
      catch { alert('Invalid Data Payload.'); }
    };
    reader.readAsText(file);
  };

  const [firstName, setFirstName]       = useState(state.firstName || '');
  const [firstNameSaved, setFirstNameSaved] = useState(false);

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

  const currentXP = state.stats.experience || 0;
  const progress = (currentXP % 1000) / 10;

  const achievements = [
    { id: '1', title: 'Sub Slayer', desc: 'Cancel 3 subscriptions', unlocked: state.stats.subscriptionsCancelled >= 3, icon: Zap },
    { id: '2', title: 'Snowball Striker', desc: 'Execute 10 flips', unlocked: state.stats.flipsExecuted >= 10, icon: Shield },
    { id: '3', title: 'Capital King', desc: 'Secure $1,000 in Vaults', unlocked: state.vaults.reduce((acc, v) => acc + v.current, 0) >= 1000, icon: Trophy },
  ];

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {/* Back + Header + Level */}
      <div>
        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-main transition-colors mb-3"
        >
          <ArrowLeft size={13} strokeWidth={3} />
          Back to Settings
        </Link>
      </div>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter leading-tight italic text-text-main">Finances</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">Income, bills & budget</p>
        </div>
        <div className="flex items-center gap-4 bg-surface border-4 border-black rounded-3xl p-4 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <div className="w-14 h-14 bg-action-primary border-4 border-black rounded-xl flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <User size={28} strokeWidth={3} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted">User Level</div>
            <div className="text-3xl font-black italic text-text-main">LVL {state.stats.level}</div>
            <div className="w-28 h-2 bg-input rounded-full mt-1 overflow-hidden border border-border">
              <div className="h-full bg-action-capture" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* First Name */}
      <div className="bg-surface border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
        <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-2">
          Your First Name
        </label>
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
        <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-2">
          Shows in your dashboard greeting
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card badge="TOTAL SAVINGS" badgeColor="bg-action-capture" badgeTextColor="text-text-main">
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mb-2">Total Value Protected</p>
          <div className="text-3xl sm:text-4xl font-black italic text-action-capture tracking-tighter tabular-nums">
            ${(state.stats.lifetimeCapture || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[10px] font-bold uppercase text-text-muted mt-3">Savings gains & cancelled subscriptions</p>
        </Card>

        <Card badge="ACHIEVEMENTS" badgeColor="bg-action-primary" badgeTextColor="text-text-main">
          <div className="space-y-3">
            {achievements.map(ach => (
              <div key={ach.id} className={`flex items-center gap-4 p-3 rounded-2xl border-4 transition-all ${ach.unlocked ? 'bg-input border-black' : 'bg-transparent border-dashed border-black/20 opacity-40'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 border-black ${ach.unlocked ? 'bg-action-primary' : 'bg-input'}`}>
                  <ach.icon size={16} strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-sm uppercase tracking-tighter text-text-main truncate">{ach.title}</h4>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted truncate">{ach.desc}</p>
                </div>
                {ach.unlocked && <Medal size={22} className="text-action-primary ml-auto" strokeWidth={2.5} />}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* System Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card badge="AESTHETIC CONFIG" badgeColor="bg-[#c084fc]" badgeTextColor="text-white">
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-input border-4 border-black rounded-2xl">
              <div className="w-9 h-9 rounded-xl bg-surface border-2 border-black flex items-center justify-center shrink-0">
                {theme === 'dark' ? <Moon size={15} strokeWidth={2.5} /> : <Sun size={15} strokeWidth={2.5} />}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-black uppercase tracking-tighter text-text-main text-sm">Base Theme</h4>
                <p className="text-[10px] font-bold uppercase text-text-muted">Toggle dark/light mode</p>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={`w-14 h-8 rounded-full flex items-center px-1 transition-all border-2 border-black shrink-0 ${theme === 'dark' ? 'bg-action-capture' : 'bg-input'}`}
              >
                <motion.div animate={{ x: theme === 'dark' ? 24 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} className="w-5 h-5 rounded-full bg-surface border-2 border-black" />
              </motion.button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-text-muted">Accent Colors</span>
                <button
                  type="button"
                  onClick={() => {
                    setPrimaryColor(DEFAULT_PRIMARY);
                    setCaptureColor(DEFAULT_CAPTURE);
                    setState({ themeColors: { primary: DEFAULT_PRIMARY, secondary: DEFAULT_CAPTURE } });
                  }}
                  className="text-[11px] font-black uppercase tracking-widest text-text-muted hover:text-text-main transition-colors"
                >
                  Reset defaults
                </button>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wide text-text-muted mb-2 block">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    title="Primary Color Picker"
                    value={isValidHex(primaryColor) ? primaryColor : DEFAULT_PRIMARY}
                    onChange={e => {
                      setPrimaryColor(e.target.value);
                      setState({ themeColors: { ...state.themeColors, primary: e.target.value } });
                    }}
                    className="w-12 h-10 p-1 rounded-xl bg-input border-4 border-black cursor-pointer"
                  />
                  <input
                    type="text"
                    title="Primary Color Hex"
                    className="flex-1 bg-input border-4 border-black rounded-xl p-2 font-black text-sm uppercase text-text-main outline-none"
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    onBlur={e => {
                      const raw = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                      if (isValidHex(raw)) {
                        setPrimaryColor(raw);
                        setState({ themeColors: { ...state.themeColors, primary: raw } });
                      } else {
                        setPrimaryColor(state.themeColors?.primary && isValidHex(state.themeColors.primary) ? state.themeColors.primary : DEFAULT_PRIMARY);
                      }
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wide text-text-muted mb-2 block">Capture Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    title="Capture Color Picker"
                    value={isValidHex(captureColor) ? captureColor : DEFAULT_CAPTURE}
                    onChange={e => {
                      setCaptureColor(e.target.value);
                      setState({ themeColors: { ...state.themeColors, secondary: e.target.value } });
                    }}
                    className="w-12 h-10 p-1 rounded-xl bg-input border-4 border-black cursor-pointer"
                  />
                  <input
                    type="text"
                    title="Capture Color Hex"
                    className="flex-1 bg-input border-4 border-black rounded-xl p-2 font-black text-sm uppercase text-text-main outline-none"
                    value={captureColor}
                    onChange={e => setCaptureColor(e.target.value)}
                    onBlur={e => {
                      const raw = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                      if (isValidHex(raw)) {
                        setCaptureColor(raw);
                        setState({ themeColors: { ...state.themeColors, secondary: raw } });
                      } else {
                        setCaptureColor(state.themeColors?.secondary && isValidHex(state.themeColors.secondary) ? state.themeColors.secondary : DEFAULT_CAPTURE);
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card badge="SECURITY & DATA" badgeColor="bg-action-bleed" badgeTextColor="text-white">
          <div className="space-y-4">

            <div className="flex items-center gap-3 p-4 bg-input border-4 border-black rounded-2xl">
              <div className="w-9 h-9 rounded-xl bg-surface border-2 border-black flex items-center justify-center shrink-0">
                <Shield size={15} strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-black uppercase tracking-tighter text-text-main text-sm">Privacy Mode</h4>
                <p className="text-[10px] font-bold uppercase text-text-muted">Mask all balances</p>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setPrivacyMode(!privacyMode)}
                className={`w-14 h-8 rounded-full flex items-center px-1 transition-all border-2 border-black shrink-0 ${privacyMode ? 'bg-action-capture' : 'bg-input'}`}
              >
                <motion.div animate={{ x: privacyMode ? 24 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} className="w-5 h-5 rounded-full bg-surface border-2 border-black" />
              </motion.button>
            </div>

            <button type="button" onClick={exportData} className="w-full h-12 border-4 border-black rounded-full bg-surface text-text-main font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-input transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1">
              <Download size={16} /> EXPORT PAYLOAD
            </button>
            <motion.label className="w-full h-12 border-4 border-black rounded-full bg-surface text-text-main font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 cursor-pointer hover:bg-input transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1">
              <Upload size={16} /> IMPORT STATE
              <input type="file" title="Import JSON State" className="hidden" accept=".json" onChange={importData} />
            </motion.label>
            {wipeArmed ? (
              <button type="button" onClick={handleWipe} disabled={wiping} className="w-full h-12 border-4 border-action-bleed rounded-full bg-action-bleed text-white font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 mt-2 transition-all animate-pulse">
                <Trash2 size={16} /> TAP AGAIN TO CONFIRM
              </button>
            ) : (
              <button type="button" onClick={armWipe} disabled={wiping} className="w-full h-12 border-4 border-action-bleed rounded-full bg-action-bleed/10 text-action-bleed font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 mt-2 hover:bg-action-bleed/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <Trash2 size={16} /> {wiping ? 'WIPING...' : 'WIPE SYSTEM'}
              </button>
            )}
            <button type="button" onClick={() => setState({ isConfigured: false })} className="w-full h-12 border-4 border-black rounded-full bg-surface text-text-main font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-input transition-all">
              <RefreshCw size={16} /> RE-RUN ONBOARDING
            </button>
            {isInstalled ? (
              <div className="w-full h-12 border-4 border-action-capture rounded-full bg-action-capture/10 text-action-capture font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2">
                <Smartphone size={16} /> INSTALLED
              </div>
            ) : (
              <button
                type="button"
                onClick={install}
                disabled={!isInstallable}
                className="w-full h-12 border-4 border-black rounded-full bg-surface text-text-main font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-input transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Smartphone size={16} /> {isInstallable ? 'INSTALL PWA' : 'INSTALL PWA (USE CHROME)'}
              </button>
            )}
          </div>
        </Card>
      </div>

      {/* Pay Cycle */}
      <Card badge="PAY CYCLE" badgeColor="bg-action-capture" badgeTextColor="text-text-main">
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Your real bank balance, next payday, and upcoming bills drive your daily limit</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-text-muted block mb-2">Current Bank Balance ($)</label>
              <input
                type="number"
                title="Current Bank Balance"
                min="0"
                value={horizonCapital}
                onFocus={e => e.target.select()}
                onChange={e => setHorizonCapital(e.target.value)}
                className="w-full bg-input border-4 border-black rounded-2xl p-3 font-black text-text-main outline-none focus:border-action-capture transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-text-muted block mb-2">Next Payday</label>
              <input
                type="date"
                title="Next Payday"
                value={horizonPayday}
                onChange={e => setHorizonPayday(e.target.value)}
                className="w-full bg-input border-4 border-black rounded-2xl p-3 font-black text-text-main outline-none focus:border-action-capture transition-colors"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          {/* Bill Queue */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Recurring Bills</label>
              {configBills.length > 0 && (
                <span className="text-[10px] font-black uppercase tracking-widest text-text-main">
                  Total: ${configBills.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0).toFixed(2)}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {configBills.map(bill => (
                <div key={bill.id} className="flex items-center gap-2 bg-input border-4 border-black rounded-2xl px-3 py-2.5">
                  <span className="font-black uppercase text-sm text-text-main flex-1 truncate">{bill.name}</span>
                  <span className="font-black tabular-nums text-sm text-text-main shrink-0">${parseFloat(bill.amount).toFixed(2)}</span>
                  <button
                    type="button"
                    title="Remove bill"
                    onClick={() => setConfigBills(bills => bills.filter(b => b.id !== bill.id))}
                    className="p-1 text-action-bleed hover:bg-action-bleed/10 rounded-lg transition-colors shrink-0"
                  >
                    <X size={14} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
              {isAddingBill ? (
                <div className="space-y-2">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Bill name"
                    value={newBillName}
                    onChange={e => setNewBillName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newBillName.trim() && parseFloat(newBillAmount) > 0) {
                        setConfigBills(bills => [...bills, { id: crypto.randomUUID(), name: newBillName.trim(), amount: newBillAmount }]);
                        setNewBillName(''); setNewBillAmount(''); setIsAddingBill(false);
                      }
                    }}
                    className="w-full bg-input border-4 border-black rounded-2xl p-2.5 font-black text-sm text-text-main outline-none focus:border-action-capture transition-colors"
                  />
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      min="0"
                      placeholder="Amount $"
                      value={newBillAmount}
                      onFocus={e => e.target.select()}
                      onChange={e => setNewBillAmount(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newBillName.trim() && parseFloat(newBillAmount) > 0) {
                          setConfigBills(bills => [...bills, { id: crypto.randomUUID(), name: newBillName.trim(), amount: newBillAmount }]);
                          setNewBillName(''); setNewBillAmount(''); setIsAddingBill(false);
                        }
                      }}
                      className="flex-1 min-w-0 bg-input border-4 border-black rounded-2xl p-2.5 font-black text-sm text-text-main outline-none focus:border-action-capture transition-colors tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newBillName.trim() && parseFloat(newBillAmount) > 0) {
                          setConfigBills(bills => [...bills, { id: crypto.randomUUID(), name: newBillName.trim(), amount: newBillAmount }]);
                          setNewBillName(''); setNewBillAmount(''); setIsAddingBill(false);
                        }
                      }}
                      title="Confirm bill"
                      className="h-10 w-10 bg-action-capture border-4 border-black rounded-2xl flex items-center justify-center shrink-0"
                    >
                      <Check size={14} strokeWidth={3} />
                    </button>
                    <button
                      type="button"
                      title="Cancel"
                      onClick={() => { setIsAddingBill(false); setNewBillName(''); setNewBillAmount(''); }}
                      className="h-10 w-10 bg-surface border-4 border-black rounded-2xl flex items-center justify-center shrink-0"
                    >
                      <X size={14} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingBill(true)}
                  className="w-full h-10 border-4 border-dashed border-border rounded-2xl text-[10px] font-black uppercase text-text-muted hover:border-black hover:text-text-main transition-all flex items-center justify-center gap-1"
                >
                  <Plus size={12} strokeWidth={3} /> Add Bill
                </button>
              )}
            </div>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted -mt-1">
            These reload automatically every time you save a new Pay Cycle · no re-entry needed each cycle.
          </p>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-text-muted block mb-2">Hard Daily Cap ($)</label>
            <input
              type="number"
              title="Hard Daily Cap"
              min="0"
              placeholder="No cap"
              value={horizonCap}
              onFocus={e => e.target.select()}
              onChange={e => setHorizonCap(e.target.value)}
              className="w-full bg-input border-4 border-black rounded-2xl p-3 font-black text-text-main outline-none focus:border-action-bleed transition-colors"
            />
            <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-1.5">The absolute maximum you are allowed to burn per day. Any surplus is automatically intercepted.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const parsedBills: BillQueueItem[] = configBills
                .map(b => ({ id: b.id, name: b.name, amount: parseFloat(b.amount) || 0 }))
                .filter(b => b.amount > 0);
              setHorizon(
                parseFloat(String(horizonCapital)) || 0,
                horizonPayday,
                parsedBills.reduce((s, b) => s + b.amount, 0),
                parseFloat(String(horizonCap)) || 0,
                parsedBills
              );
              setHorizonSaved(true);
              setTimeout(() => setHorizonSaved(false), 2000);
            }}
            className="h-12 px-8 border-4 border-black rounded-full bg-action-capture text-black font-black uppercase text-xs tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all flex items-center gap-2"
          >
            {horizonSaved ? <><Check size={14} /> SAVED</> : 'Save Pay Cycle'}
          </button>
        </div>
      </Card>

      {/* Monthly Baseline (for subscription & savings rate widgets) */}
      <Card badge="MONTHLY BASELINE" badgeColor="bg-[#c084fc]" badgeTextColor="text-white">
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Monthly income & savings goal · bills are pulled automatically from your Pay Cycle recurring bills</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-text-muted block mb-2">Monthly Take-Home ($)</label>
              <input
                type="number"
                title="Monthly Take-Home"
                min="0"
                value={baselineIncome}
                onFocus={e => e.target.select()}
                onChange={e => setBaselineIncome(e.target.value)}
                className="w-full bg-input border-4 border-black rounded-2xl p-3 font-black text-text-main outline-none focus:border-[#c084fc] transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-text-muted block mb-2">Monthly Savings Goal ($)</label>
              <input
                type="number"
                title="Monthly Savings Goal"
                min="0"
                value={baselineSavings}
                onFocus={e => e.target.select()}
                onChange={e => setBaselineSavings(e.target.value)}
                className="w-full bg-input border-4 border-black rounded-2xl p-3 font-black text-text-main outline-none focus:border-[#c084fc] transition-colors"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              updateBaseline(parseFloat(String(baselineIncome)) || 0, parseFloat(String(baselineSavings)) || 0);
              setBaselineSaved(true);
              setTimeout(() => setBaselineSaved(false), 2000);
            }}
            className="h-12 px-8 border-4 border-black rounded-full bg-[#c084fc] text-white font-black uppercase text-xs tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all flex items-center gap-2"
          >
            {baselineSaved ? <><Check size={14} /> SAVED</> : 'Save Baseline'}
          </button>
        </div>
      </Card>

      {/* Debt Management */}
      <Card badge="DEBT MANAGEMENT" badgeColor="bg-action-bleed" badgeTextColor="text-white">
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Manage your debt accounts</p>
          {(state.debts || []).map(debt => (
            <div key={debt.id} className="bg-input border-4 border-black rounded-2xl p-4">
              {editingDebtId === debt.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input title="Debt Name" type="text" value={editDebtFields.name ?? debt.name} onChange={e => setEditDebtFields(f => ({ ...f, name: e.target.value }))} className="col-span-2 bg-surface border-4 border-black rounded-xl p-2 font-black text-sm text-black outline-none" placeholder="Name" />
                    <input title="Balance" type="number" min="0" value={editDebtFields.balance ?? debt.balance} onChange={e => setEditDebtFields(f => ({ ...f, balance: Number(e.target.value) }))} className="bg-surface border-4 border-black rounded-xl p-2 font-black text-sm text-black outline-none" placeholder="Balance" />
                    <input title="Interest Rate" type="number" min="0" value={editDebtFields.interestRate ?? debt.interestRate} onChange={e => setEditDebtFields(f => ({ ...f, interestRate: Number(e.target.value) }))} className="bg-surface border-4 border-black rounded-xl p-2 font-black text-sm text-black outline-none" placeholder="Rate %" />
                    <input title="Min Payment" type="number" min="0" value={editDebtFields.minPayment ?? debt.minPayment} onChange={e => setEditDebtFields(f => ({ ...f, minPayment: Number(e.target.value) }))} className="bg-surface border-4 border-black rounded-xl p-2 font-black text-sm text-black outline-none" placeholder="Min Payment" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { updateDebt(debt.id, editDebtFields); setEditingDebtId(null); setEditDebtFields({}); }} className="flex items-center gap-1 px-4 h-11 bg-action-capture border-4 border-black rounded-full text-[10px] font-black uppercase"><Check size={12} /> Save</button>
                    <button type="button" onClick={() => { setEditingDebtId(null); setEditDebtFields({}); }} className="flex items-center gap-1 px-4 h-11 bg-surface border-4 border-black rounded-full text-[10px] font-black uppercase"><X size={12} /> Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-black italic uppercase text-sm tracking-tighter text-text-main">{debt.name}</h4>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">${debt.balance.toLocaleString()} @ {debt.interestRate}% · Min ${debt.minPayment}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" aria-label="Edit debt" onClick={() => { setEditingDebtId(debt.id); setEditDebtFields({}); }} className="p-2 hover:bg-black/5 rounded-xl transition-colors"><Edit2 size={14} /></button>
                    <button type="button" aria-label="Delete debt" onClick={() => removeDebt(debt.id)} className="p-2 text-action-bleed hover:bg-action-bleed/10 rounded-xl transition-colors"><Trash2 size={14} /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {isAddingDebt ? (
            <div className="space-y-3 bg-input border-4 border-black rounded-2xl p-4">
              <div className="grid grid-cols-2 gap-2">
                <input autoFocus title="Debt Name" type="text" placeholder="Name (e.g. Credit Card A)" value={newDebtName} onChange={e => setNewDebtName(e.target.value)} className="col-span-2 bg-surface border-4 border-black rounded-xl p-2 font-black text-sm text-black outline-none focus:border-action-bleed transition-colors" />
                <input title="Balance" type="number" min="0" placeholder="Balance $" value={newDebtBalance} onChange={e => setNewDebtBalance(e.target.value)} className="bg-surface border-4 border-black rounded-xl p-2 font-black text-sm text-black outline-none" />
                <input title="Interest Rate" type="number" min="0" placeholder="Rate %" value={newDebtRate} onChange={e => setNewDebtRate(e.target.value)} className="bg-surface border-4 border-black rounded-xl p-2 font-black text-sm text-black outline-none" />
                <input title="Min Payment" type="number" min="0" placeholder="Min Payment $" value={newDebtMin} onChange={e => setNewDebtMin(e.target.value)} className="col-span-2 bg-surface border-4 border-black rounded-xl p-2 font-black text-sm text-black outline-none" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsAddingDebt(false)} className="px-4 h-11 bg-surface border-4 border-black rounded-full text-[10px] font-black uppercase">Cancel</button>
                <button
                  type="button"
                  onClick={() => {
                    if (newDebtName.trim() && newDebtBalance && newDebtRate && newDebtMin) {
                      addDebt({ name: newDebtName.trim(), balance: parseFloat(newDebtBalance), interestRate: parseFloat(newDebtRate), minPayment: parseFloat(newDebtMin) });
                      setIsAddingDebt(false); setNewDebtName(''); setNewDebtBalance(''); setNewDebtRate(''); setNewDebtMin('');
                    }
                  }}
                  className="px-4 h-11 bg-black text-action-primary border-4 border-black rounded-full text-[10px] font-black uppercase"
                >
                  Add Debt
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setIsAddingDebt(true)} className="w-full h-12 border-4 border-dashed border-border rounded-2xl text-[10px] font-black uppercase text-text-muted hover:border-action-bleed hover:text-action-bleed transition-all flex items-center justify-center gap-2">
              <Plus size={14} /> Add Debt Account
            </button>
          )}
        </div>
      </Card>

      {/* Habit Tracker */}
      <Card badge="HABIT TRACKER" badgeColor="bg-action-bleed" badgeTextColor="text-white">
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Configure habits and tax rates</p>
          {(state.impulses || []).map(impulse => (
            <div key={impulse.id} className="flex items-center justify-between p-4 bg-input border-4 border-black rounded-2xl">
              <div>
                <h4 className="font-black italic uppercase text-sm tracking-widest text-text-main">{impulse.name}</h4>
                <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Tax Rate: {(impulse.taxRate * 100)}%</p>
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min="0"
                  max="100"
                  title="Tax Rate %"
                  className="w-16 bg-surface border-4 border-black rounded-xl text-center font-black text-sm p-1 text-black outline-none"
                  value={impulseRates[impulse.id] ?? String(impulse.taxRate * 100)}
                  onChange={e => setImpulseRates(r => ({ ...r, [impulse.id]: e.target.value }))}
                  onBlur={e => {
                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                    setImpulses(state.impulses.map(imp => imp.id === impulse.id ? { ...imp, taxRate: val / 100 } : imp));
                    setImpulseRates(r => ({ ...r, [impulse.id]: String(val) }));
                  }}
                />
                <button type="button" aria-label="Delete habit" onClick={() => setImpulses(state.impulses.filter(imp => imp.id !== impulse.id))} className="p-2 text-action-bleed hover:bg-action-bleed/10 rounded-xl transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {isAddingConfigImpulse ? (
            <div className="flex flex-col md:flex-row gap-2">
              <input
                autoFocus
                placeholder="Habit Name"
                className="flex-1 bg-input border-4 border-black rounded-2xl p-3 text-sm font-black uppercase text-black outline-none focus:border-action-bleed transition-colors"
                value={newConfigImpulseName}
                onChange={e => setNewConfigImpulseName(e.target.value)}
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsAddingConfigImpulse(false)} className="px-4 h-12 bg-surface border-4 border-black rounded-2xl text-[10px] font-black uppercase text-text-main">Cancel</button>
                <button
                  type="button"
                  onClick={() => {
                    if (newConfigImpulseName.trim()) {
                      setImpulses([...(state.impulses || []), { id: Math.random().toString(36).substr(2, 9), name: newConfigImpulseName.trim(), taxRate: 0.5 }]);
                      setIsAddingConfigImpulse(false); setNewConfigImpulseName('');
                    }
                  }}
                  className="px-4 h-12 bg-action-capture border-4 border-black rounded-2xl text-[10px] font-black uppercase text-text-main"
                >
                  Add
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddingConfigImpulse(true)}
              className="w-full h-12 border-4 border-dashed border-border rounded-2xl text-[10px] font-black uppercase text-text-muted hover:border-action-bleed hover:text-action-bleed transition-all"
            >
              + Add New Habit
            </button>
          )}
        </div>
      </Card>

      {/* Interface Widgets */}
      <Card badge="INTERFACE SETTINGS" badgeColor="bg-action-primary" badgeTextColor="text-text-main">
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Configure active widgets</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(state.dashboardWidgets || []).map(widget => (
              <div key={widget.id} className="flex items-center gap-3 p-4 bg-input border-4 border-black rounded-2xl">
                <div className="flex-1 min-w-0">
                  <h4 className="font-black italic uppercase text-xs tracking-widest text-text-main">{widget.id.replace('-', ' ')}</h4>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">{widget.visible ? 'Active' : 'Hidden'}</p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setState({ dashboardWidgets: state.dashboardWidgets.map(w => w.id === widget.id ? { ...w, visible: !w.visible } : w) })}
                  className={`w-12 h-6 rounded-full flex items-center px-1 transition-all border-2 border-black shrink-0 ${widget.visible ? 'bg-action-capture' : 'bg-input'}`}
                >
                  <motion.div animate={{ x: widget.visible ? 24 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} className="w-3 h-3 rounded-full bg-surface border-2 border-black" />
                </motion.button>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Architect Note */}
      <div className="bg-input border-2 border-border rounded-3xl p-5">
        <p className="text-text-muted text-[10px] font-bold uppercase leading-relaxed">
          Pocket CFO is local-first. We do not store your financial data on our servers. Your data stays on this device unless you export it yourself.
        </p>
        <div className="flex gap-2 mt-3">
          <span className="bg-action-capture/20 text-action-capture border-[3px] border-action-capture/30 px-3 py-1 rounded-full text-[10px] font-black uppercase">v2.1.0-STABLE</span>
          <span className="bg-action-primary/20 text-black border-[3px] border-action-primary/30 px-3 py-1 rounded-full text-[10px] font-black uppercase">LOCAL ONLY</span>
        </div>
      </div>
    </motion.div>
  );
}


