import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Eye, EyeOff, Sun, Moon, SlidersHorizontal, ChevronRight, Lock, LockOpen,
  Download, Upload, Trash2, Smartphone, RefreshCw, Zap, Trophy, Shield, Medal,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore, INITIAL_STATE } from '../store/useStore';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { supabase } from '../core/supabase';
import { calculateTrueSafeSpend } from '../core/math';

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

const COLOR_THEMES = [
  { id: 'default',           name: 'Original',           primary: '#facc15', capture: '#00CC55' },
  { id: 'sky-kelly',         name: 'Sky & Kelly',         primary: '#4BBFD4', capture: '#2EAA5C' },
  { id: 'pink-sky',          name: 'Pink & Sky',          primary: '#FF5C9E', capture: '#4BBFD4' },
  { id: 'blush-orange',      name: 'Blush & Orange',      primary: '#F9A7B2', capture: '#FF7A3A' },
  { id: 'lavender-purple',   name: 'Lavender & Purple',   primary: '#B8A8D8', capture: '#7733BB' },
  { id: 'blue-yellow',       name: 'Blue & Sunshine',     primary: '#4455CC', capture: '#FFD600' },
  { id: 'pool-poppy',        name: 'Pool & Poppy',        primary: '#00AACC', capture: '#FF3344' },
  { id: 'lime-royal',        name: 'Lime & Royal',        primary: '#88CC22', capture: '#3355CC' },
  { id: 'orange-royal',      name: 'Orange & Royal',      primary: '#FF8800', capture: '#3355CC' },
  { id: 'turquoise-teal',    name: 'Turquoise & Teal',    primary: '#22CCBB', capture: '#007799' },
  { id: 'ballet-cherry',     name: 'Ballet & Cherry',     primary: '#F5A0B8', capture: '#CC1133' },
  { id: 'ballet-navy',       name: 'Ballet & Navy',       primary: '#F5A0B8', capture: '#1E3A8A' },
  { id: 'bubblegum',         name: 'Bubblegum',           primary: '#EDC2CB', capture: '#57798F' },
  { id: 'coral-lemon',       name: 'Coral & Lemon',       primary: '#FF5960', capture: '#FFE783' },
  { id: 'midnight-ocean',    name: 'Midnight Ocean',      primary: '#122C4F', capture: '#5B88B2' },
  { id: 'blue-choc',         name: 'Blue & Choc',         primary: '#7CA7EB', capture: '#402924' },
  { id: 'saffron-steel',     name: 'Saffron & Steel',     primary: '#E8C547', capture: '#4F7CAC' },
  { id: 'hot-magenta',       name: 'Hot Magenta',         primary: '#FF006E', capture: '#FFD60A' },
  { id: 'cyprus-jade',       name: 'Cyprus & Jade',       primary: '#004643', capture: '#ABD1C6' },
  { id: 'hibiscus-cola',     name: 'Hibiscus Cola',       primary: '#E0A4B0', capture: '#7C0116' },
  { id: 'cobalt-butter',     name: 'Cobalt & Butter',     primary: '#0F52BB', capture: '#FFFF9A' },
  { id: 'sunlit-wine',       name: 'Sunlit Wine',         primary: '#F4E7AF', capture: '#551424' },
  { id: 'raspberry-lemon',   name: 'Raspberry Lemon',     primary: '#C8154B', capture: '#FFF8B6' },
  { id: 'yam-tide',          name: 'Yam & High Tide',     primary: '#EA9216', capture: '#313841' },
  { id: 'chili-flare',       name: 'Chili Flare',         primary: '#FFD9A1', capture: '#BE2717' },
  { id: 'sunny-spark',       name: 'Sunny Spark',         primary: '#DE4818', capture: '#ECDC80' },
  { id: 'retro-earth',       name: 'Retro Earth',         primary: '#ED5351', capture: '#1C180A' },
  { id: 'deep-roots',        name: 'Deep Roots',          primary: '#FB884C', capture: '#3A1A0A' },
  { id: 'sweet-ocean',       name: 'Sweet Ocean',         primary: '#F8C6F2', capture: '#01006C' },
  { id: 'deep-mariner',      name: 'Deep Mariner',        primary: '#014770', capture: '#E9E5D2' },
  { id: 'blush-abyss',       name: 'Blush Abyss',         primary: '#F5D0D0', capture: '#4A0011' },
  { id: 'gold-vintage',      name: 'Gold Vintage',        primary: '#A77E16', capture: '#1A2800' },
  { id: 'amber-flamingo',    name: 'Amber & Flamingo',    primary: '#FFBF00', capture: '#F0563A' },
  { id: 'barley-orange',     name: 'Barley & Orange',     primary: '#FFF4CC', capture: '#FF8C00' },
  { id: 'avocado-chiffon',   name: 'Avocado & Chiffon',   primary: '#568203', capture: '#FFF8B9' },
  { id: 'olive-foliage',     name: 'Olive & Foliage',     primary: '#D2DB76', capture: '#2D371D' },
  { id: 'butter-crumble',    name: 'Butter Crumble',      primary: '#F2E6B3', capture: '#4B2E21' },
  { id: 'matcha-honey',      name: 'Matcha Honey',        primary: '#9CA764', capture: '#F1E8C7' },
  { id: 'strawberry-matcha', name: 'Strawberry Matcha',   primary: '#F9D1D9', capture: '#838F58' },
  { id: 'cherry-blossom',    name: 'Cherry Blossom',      primary: '#FAFFC7', capture: '#F8A8B9' },
  { id: 'blush-butter',      name: 'Blush & Butter',      primary: '#E36887', capture: '#F3D98F' },
];

const WIDGET_META = [
  { id: 'safe-spend',   label: 'Daily Safe Spend', description: 'Your main spending limit hero card' },
  { id: 'vault-status', label: 'Savings Overview',  description: 'Vaulted & spendable balance pillars' },
  { id: 'momentum',     label: '7-Day Trend',       description: 'Daily spending bar chart + streak' },
  { id: 'alert',        label: 'Bill Queue',        description: 'Upcoming bills checklist' },
];

export default function Settings() {
  const state = useStore();
  const { theme, setTheme, privacyMode, togglePrivacyMode, dashboardWidgets, updateDashboardWidgets, lockEnabled, setState, setThemeColors } = state;
  const { isInstallable, isInstalled, install } = usePWAInstall();

  const toggleWidget = (id: string) => {
    updateDashboardWidgets(dashboardWidgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w));
  };
  const isWidgetVisible = (id: string) => {
    const w = dashboardWidgets.find(x => x.id === id);
    return w ? w.visible : true;
  };

  const [primaryColor, setPrimaryColor] = useState(() => safeHex(state.themeColors?.primary, DEFAULT_PRIMARY));
  const [captureColor, setCaptureColor] = useState(() => safeHex(state.themeColors?.secondary, DEFAULT_CAPTURE));

  const [wiping, setWiping] = useState(false);
  const [wipeArmed, setWipeArmed] = useState(false);
  const wipeTimerRef = useRef<ReturnType<typeof setTimeout>>(0 as unknown as ReturnType<typeof setTimeout>);

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
      liquid_assets: 0, monthly_take_home: 0, fixed_bills: 0,
      monthly_savings_goal: 0, next_payday: null, upcoming_bills: 0,
      hard_daily_cap: 0, has_completed_onboarding: false, is_configured: false,
    }).eq('id', userId);
    setState({ ...INITIAL_STATE, userId, dataLoaded: true });
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
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">
          Settings
        </h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">
          Display, security & app preferences
        </p>
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
                PIN lock when app is backgrounded · default PIN: 1234
              </p>
            </div>
            <button
              type="button"
              onClick={() => setState({ lockEnabled: !lockEnabled })}
              className={`flex items-center justify-center gap-2 min-w-20 px-4 py-2.5 border-4 border-black rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-brutal-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 shrink-0 ${lockEnabled ? 'bg-black text-action-primary' : 'bg-input text-text-main'}`}
            >
              {lockEnabled ? <Lock size={13} strokeWidth={2.5} /> : <LockOpen size={13} strokeWidth={2.5} />}
              {lockEnabled ? 'On' : 'Off'}
            </button>
          </div>

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

        {/* Dashboard Widgets */}
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <div className="flex items-center gap-2 mb-4">
            <SlidersHorizontal size={14} strokeWidth={2.5} className="text-text-muted shrink-0" />
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-text-muted/60">Dashboard Widgets</p>
          </div>
          <div className="space-y-3">
            {WIDGET_META.map((widget, i) => {
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

      {/* Accent Colors */}
      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-text-muted/60">Accent Colors</p>
          <button
            type="button"
            onClick={() => { setPrimaryColor(DEFAULT_PRIMARY); setCaptureColor(DEFAULT_CAPTURE); setThemeColors(DEFAULT_PRIMARY, DEFAULT_CAPTURE); }}
            className="text-[11px] font-black uppercase tracking-widest text-text-muted hover:text-text-main transition-colors"
          >
            Reset defaults
          </button>
        </div>
        <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-10 gap-1.5 mb-4">
          {COLOR_THEMES.map(t => {
            const isActive = primaryColor === t.primary && captureColor === t.capture;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => { setPrimaryColor(t.primary); setCaptureColor(t.capture); setThemeColors(t.primary, t.capture); }}
                className={`swatch-${t.id} flex flex-col items-center gap-1 p-2 rounded-xl border-4 transition-all ${isActive ? 'border-black shadow-brutal-sm' : 'border-transparent hover:border-border'}`}
              >
                <div className="flex gap-0.5">
                  <div className="swatch-dot-primary w-4 h-4 rounded-full border border-black/20" />
                  <div className="swatch-dot-capture w-4 h-4 rounded-full border border-black/20" />
                </div>
                <span className="text-[8px] font-black uppercase tracking-wide text-text-muted leading-tight text-center line-clamp-1">{t.name}</span>
              </button>
            );
          })}
        </div>
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:items-start">
        {/* Achievements */}
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-text-muted/60 mb-4">Achievements</p>
          <div className="space-y-3">
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
        <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)]">
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-text-muted/60 mb-4">Data & Security</p>
          <div className="space-y-3">
            <button type="button" onClick={exportData}
              className="w-full h-12 border-4 border-black rounded-full bg-surface text-text-main font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-input transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1">
              <Download size={16} /> EXPORT PAYLOAD
            </button>
            <motion.label className="w-full h-12 border-4 border-black rounded-full bg-surface text-text-main font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 cursor-pointer hover:bg-input transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1">
              <Upload size={16} /> IMPORT STATE
              <input type="file" title="Import JSON State" className="hidden" accept=".json" onChange={importData} />
            </motion.label>
            {isInstalled ? (
              <div className="w-full h-12 border-4 border-action-capture rounded-full bg-action-capture/10 text-action-capture font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2">
                <Smartphone size={16} /> INSTALLED
              </div>
            ) : (
              <button type="button" onClick={install} disabled={!isInstallable}
                className="w-full h-12 border-4 border-black rounded-full bg-surface text-text-main font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-input transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                <Smartphone size={16} /> {isInstallable ? 'INSTALL PWA' : 'INSTALL PWA (USE CHROME)'}
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
                <Trash2 size={16} /> {wiping ? 'WIPING...' : 'WIPE SYSTEM'}
              </button>
            )}
          </div>
        </div>
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
    </motion.div>
  );
}
