import { motion } from 'motion/react';
import { Eye, EyeOff, Sun, Moon, SlidersHorizontal, ChevronRight, Lock, LockOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';

const WIDGET_META: { id: string; label: string; description: string }[] = [
  { id: 'safe-spend', label: 'Daily Safe Spend', description: 'Your main spending limit hero card' },
  { id: 'vault-status', label: 'Savings Overview', description: 'Vaulted & spendable balance pillars' },
  { id: 'momentum', label: '7-Day Trend', description: 'Daily spending bar chart + streak' },
  { id: 'alert', label: 'Bill Queue', description: 'Upcoming bills checklist' },
];

export default function Settings() {
  const { theme, setTheme, privacyMode, togglePrivacyMode, dashboardWidgets, updateDashboardWidgets, lockEnabled, setState } = useStore();

  const toggleWidget = (id: string) => {
    const updated = dashboardWidgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
    updateDashboardWidgets(updated);
  };

  const isWidgetVisible = (id: string) => {
    const w = dashboardWidgets.find(x => x.id === id);
    return w ? w.visible : true;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight italic text-text-main">
          Settings
        </h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">
          Display preferences & dashboard layout
        </p>
      </div>

      {/* Display */}
      <div className="bg-surface border-4 border-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_var(--shadow-color)] space-y-3">
        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-text-muted/60 mb-1">Display</p>

        {/* Privacy Mode */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black uppercase tracking-widest text-text-main">Privacy Mode</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mt-0.5">
              Masks total balances with ••••••
            </p>
          </div>
          <button
            type="button"
            onClick={() => togglePrivacyMode()}
            className={`flex items-center justify-center gap-2 min-w-20 px-4 py-2.5 border-4 border-black rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-brutal-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 shrink-0 ${
              privacyMode
                ? 'bg-action-bleed text-white'
                : 'bg-input text-text-main'
            }`}
          >
            {privacyMode ? <EyeOff size={13} strokeWidth={2.5} /> : <Eye size={13} strokeWidth={2.5} />}
            {privacyMode ? 'On' : 'Off'}
          </button>
        </div>

        <div className="h-px bg-border opacity-30" />

        {/* PIN Lock */}
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
            className={`flex items-center justify-center gap-2 min-w-20 px-4 py-2.5 border-4 border-black rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-brutal-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 shrink-0 ${
              lockEnabled ? 'bg-black text-action-primary' : 'bg-input text-text-main'
            }`}
          >
            {lockEnabled ? <Lock size={13} strokeWidth={2.5} /> : <LockOpen size={13} strokeWidth={2.5} />}
            {lockEnabled ? 'On' : 'Off'}
          </button>
        </div>

        <div className="h-px bg-border opacity-30" />

        {/* Theme */}
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
                    onClick={() => toggleWidget(widget.id)}
                    className={`w-12 h-6 rounded-full border-[3px] border-black relative transition-colors shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                      visible ? 'bg-action-capture' : 'bg-input'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-black border-[2px] border-black transition-all ${
                        visible ? 'left-[calc(100%-18px)]' : 'left-0.5'
                      }`}
                    />
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
