import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Terminal, ShieldCheck, PieChart, Zap, Compass, Settings, Search, Users, Calculator, Sun, Moon, Scissors, MoreHorizontal, X, Eye, EyeOff, TrendingUp, LogOut, Flame, Receipt, DollarSign, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { useIsPro } from '../lib/pro';
import { supabase } from '../core/supabase';
import { BrandLogo } from './BrandLogo';

const coreTools = [
  { path: '/',              icon: Terminal,    label: 'Dashboard',    shortLabel: 'Home' },
  { path: '/recon',         icon: Search,      label: 'Daily Review', shortLabel: 'Review' },
  { path: '/vaults',        icon: ShieldCheck, label: 'Vaults',       shortLabel: 'Vaults' },
  { path: '/transactions',  icon: Receipt,     label: 'Ledger',       shortLabel: 'Ledger' },
  { path: '/breakdown',     icon: PieChart,    label: 'Audit Log',    shortLabel: 'Stats' },
  { path: '/subscriptions', icon: Scissors,    label: 'Subscriptions', shortLabel: 'Subs' },
];

// `pro: true` marks a Tool that requires Pro. Bill Splitter (viral acquisition)
// and True Cost (free differentiator) are deliberately left free.
const calculatorTools: { path: string; icon: React.ElementType; label: string; subtitle: string; pro?: boolean }[] = [
  { path: '/split',            icon: Users,        label: 'Bill Splitter',   subtitle: 'Divide expenses and track who owes what' },
  { path: '/true-cost',        icon: Calculator,   label: 'True Cost',       subtitle: 'Calculate the real price of purchases over time' },
  { path: '/debt-destroyer',   icon: Zap,          label: 'Debt Payoff',     subtitle: 'Optimize your avalanche or snowball strategy', pro: true },
  { path: '/tactical-command', icon: Compass,      label: 'Safety Net',      subtitle: 'How long your cash lasts and your target buffer' },
  { path: '/compound-growth',  icon: TrendingUp,   label: 'Wealth Growth',   subtitle: 'Project your long-term net worth' },
  { path: '/fire',             icon: Flame,        label: 'FIRE CALCULATOR', subtitle: 'Financial Independence & Early Retirement projection', pro: true },
  { path: '/income',           icon: DollarSign,   label: 'Income Tracker',  subtitle: 'Log income milestones & find your FIRE savings rate', pro: true },
];

const mobilePrimary = [coreTools[0], coreTools[1], coreTools[2], coreTools[4]];

function NavItem({ path, icon: Icon, label, accent, locked }: {
  path: string; icon: React.ElementType; label: string; shortLabel?: string; accent?: boolean; locked?: boolean;
}) {
  return (
    <NavLink
      to={path}
      className={({ isActive }) =>
        `relative flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all duration-150
        ${isActive
          ? accent
            ? 'bg-action-primary border-black text-black'
            : 'bg-action-capture border-black text-capture-contrast'
          : 'border-transparent text-text-muted hover:bg-input hover:text-text-main hover:border-border'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={16} strokeWidth={isActive ? 3 : 2} className="shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-wider leading-none">{label}</span>
          {locked && (
            <span className="ml-auto inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest opacity-70">
              <Lock size={10} strokeWidth={3} className="shrink-0" />
              Preview
            </span>
          )}
          {isActive && (
            <div className="absolute -left-5 top-1/2 -translate-y-1/2 w-1.5 h-5 bg-action-capture border-2 border-l-0 border-black rounded-r-full" />
          )}
        </>
      )}
    </NavLink>
  );
}

function SheetLink({ path, icon: Icon, label, onClick }: {
  path: string; icon: React.ElementType; label: string; accent?: boolean; onClick: () => void;
}) {
  return (
    <NavLink
      to={path}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 transition-all
        ${isActive
          ? 'bg-black border-black text-action-primary'
          : 'bg-input border-transparent hover:border-border text-text-main'
        }`
      }
    >
      <Icon size={15} strokeWidth={2.5} className="shrink-0" />
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </NavLink>
  );
}

function ToolSheetLink({ path, icon: Icon, label, subtitle, onClick, locked }: {
  path: string; icon: React.ElementType; label: string; subtitle: string; onClick: () => void; locked?: boolean;
}) {
  return (
    <NavLink
      to={path}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-2xl border-4 transition-all ${
          isActive
            ? 'bg-action-primary border-black'
            : 'bg-input border-transparent hover:border-border'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={18} strokeWidth={2.5} className={`shrink-0 ${isActive ? 'text-primary-contrast' : 'text-action-primary'}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-[11px] font-black uppercase tracking-widest leading-none ${isActive ? 'text-primary-contrast' : 'text-text-main'}`}>{label}</p>
            <p className={`text-[10px] font-bold mt-1 leading-snug ${isActive ? 'text-primary-contrast/60' : 'text-text-muted'}`}>
              {locked ? `Pro preview · ${subtitle}` : subtitle}
            </p>
          </div>
          {locked && <Lock size={14} strokeWidth={3} className={`shrink-0 ${isActive ? 'text-primary-contrast/70' : 'text-text-muted'}`} />}
        </>
      )}
    </NavLink>
  );
}

export default function Navigation() {
  const { theme, setTheme, privacyMode, togglePrivacyMode } = useStore(
    useShallow(s => ({
      theme: s.theme,
      setTheme: s.setTheme,
      privacyMode: s.privacyMode,
      togglePrivacyMode: s.togglePrivacyMode,
    })),
  );
  const isPro = useIsPro();
  const [moreOpen, setMoreOpen] = useState(false);
  const close = () => setMoreOpen(false);
  const signOut = () => supabase.auth.signOut();

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <nav className="hidden md:flex flex-col h-screen bg-surface border-r-4 border-border px-4 py-5 transition-colors duration-300">

        {/* Brand */}
        <div className="mb-7 px-1">
          <BrandLogo />
        </div>

        <div className="flex flex-col flex-1 overflow-y-auto no-scrollbar gap-5">
          {/* Core nav */}
          <div className="flex flex-col gap-0.5">
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-text-muted/50 px-3 mb-1.5">Core</p>
            {coreTools.map(item => <NavItem key={item.path} {...item} />)}
          </div>

          <div className="h-px bg-border opacity-30 mx-1" />

          {/* Tools nav */}
          <div className="flex flex-col gap-0.5">
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-text-muted/50 px-3 mb-1.5">Tools</p>
            {calculatorTools.map(item => <NavItem key={item.path} path={item.path} icon={item.icon} label={item.label} accent locked={!!item.pro && !isPro} />)}
          </div>

          {/* Settings + Sign out */}
          <div className="mt-auto pt-4 border-t-2 border-border/30 space-y-1">
            {/* Quick toggles — privacy + theme */}
            <div className="flex gap-1.5 mb-1.5">
              <button
                type="button"
                title={privacyMode ? 'Disable privacy mode' : 'Enable privacy mode'}
                onClick={() => togglePrivacyMode()}
                className={`flex-1 h-9 flex items-center justify-center gap-1.5 border-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${privacyMode ? 'bg-action-bleed border-action-bleed text-white' : 'border-border bg-input text-text-muted hover:text-text-main hover:border-black'}`}
              >
                {privacyMode ? <EyeOff size={13} strokeWidth={2.5} /> : <Eye size={13} strokeWidth={2.5} />}
                <span>{privacyMode ? 'Hidden' : 'Privacy'}</span>
              </button>
              <button
                type="button"
                title="Toggle theme"
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="flex-1 h-9 flex items-center justify-center gap-1.5 border-2 border-border bg-input rounded-xl text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-main hover:border-black transition-all"
              >
                {theme === 'light' ? <Moon size={13} strokeWidth={2.5} /> : <Sun size={13} strokeWidth={2.5} />}
                <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
              </button>
            </div>
            <NavItem path="/settings" icon={Settings} label="Settings" />
            <button
              type="button"
              onClick={signOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 border-transparent text-text-muted hover:bg-action-bleed/10 hover:text-action-bleed hover:border-action-bleed/30 transition-all duration-150"
            >
              <LogOut size={16} strokeWidth={2} className="shrink-0" />
              <span className="text-[11px] font-bold uppercase tracking-wider leading-none">Sign Out</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobile Bottom Bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-surface border-t-[3px] border-border px-2 pt-2 nav-pb-safe transition-colors duration-300">
        <div className="flex gap-1 items-stretch">
          {mobilePrimary.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-1.5 h-16 border-2 rounded-xl transition-all
                ${isActive
                  ? 'bg-black border-black text-action-primary shadow-[2px_2px_0px_0px_rgba(0,0,0,0.4)]'
                  : 'border-transparent text-text-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={20} strokeWidth={isActive ? 3 : 2} />
                  <span className="text-[11px] font-bold uppercase leading-none">{item.shortLabel ?? item.label}</span>
                </>
              )}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1.5 h-16 border-2 border-transparent rounded-xl text-text-muted hover:text-text-main transition-all"
          >
            <MoreHorizontal size={20} strokeWidth={2} />
            <span className="text-[11px] font-bold uppercase leading-none">More</span>
          </button>
        </div>
      </nav>

      {/* ── Mobile More Sheet ── */}
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-60 bg-black/40 md:hidden"
              onClick={close}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="fixed bottom-0 left-0 right-0 z-70 bg-surface border-t-[3px] border-border rounded-t-3xl px-5 pt-4 sheet-pb-safe md:hidden max-h-[90vh] overflow-y-auto"
            >
              {/* Drag handle */}
              <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />

              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-action-primary border-2 border-black rounded-md flex items-center justify-center">
                    <span className="text-black text-[10px] font-black">$</span>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-main">More</p>
                </div>
                <button
                  type="button"
                  title="Close"
                  onClick={close}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-border"
                >
                  <X size={13} strokeWidth={2.5} />
                </button>
              </div>

              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-text-muted/50 mb-2">Manage</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <SheetLink path="/breakdown"     icon={PieChart}  label="Audit Log"      onClick={close} />
                <SheetLink path="/transactions"  icon={Receipt}   label="Ledger"         onClick={close} />
                <SheetLink path="/subscriptions" icon={Scissors}  label="Subscriptions"  onClick={close} />
                <SheetLink path="/settings"      icon={Settings}  label="Settings"       onClick={close} />
              </div>

              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-text-muted/50 mb-2">Tools</p>
              <div className="flex flex-col gap-2 mb-5">
                {calculatorTools.map(item => (
                  <ToolSheetLink key={item.path} path={item.path} icon={item.icon} label={item.label} subtitle={item.subtitle} onClick={close} locked={!!item.pro && !isPro} />
                ))}
              </div>

              <div className="flex items-center justify-between border-t-2 border-border/30 pt-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Display</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title={privacyMode ? 'Disable privacy mode' : 'Enable privacy mode'}
                    onClick={() => togglePrivacyMode()}
                    className={`w-8 h-8 border-2 rounded-lg flex items-center justify-center transition-all ${privacyMode ? 'bg-action-bleed border-action-bleed text-white' : 'border-border bg-input hover:bg-surface'}`}
                  >
                    {privacyMode ? <EyeOff size={13} strokeWidth={2.5} /> : <Eye size={13} strokeWidth={2.5} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                    className="w-8 h-8 border-2 border-border rounded-lg bg-input flex items-center justify-center hover:bg-surface transition-colors"
                  >
                    {theme === 'light' ? <Moon size={13} strokeWidth={2.5} /> : <Sun size={13} strokeWidth={2.5} />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={signOut}
                className="w-full flex items-center justify-center gap-2 h-12 border-2 border-action-bleed/30 rounded-2xl text-action-bleed bg-action-bleed/10 font-black uppercase text-[11px] tracking-widest mt-4 hover:bg-action-bleed/20 transition-colors"
              >
                <LogOut size={14} strokeWidth={2.5} />
                Sign Out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
