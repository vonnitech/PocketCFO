import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Settings, ClipboardCheck, Split, Hourglass, Sun, Moon, Repeat, Menu, X, Eye, EyeOff, TrendingUp, TrendingDown, LogOut, Flame, Banknote, Lock, LifeBuoy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { useProLocked } from '../lib/pro';
import { supabase } from '../core/supabase';
import { BrandLogo } from './BrandLogo';

// Core screens that are not one of the four tabs in the bottom bar.
// Icon rule for the whole app: every icon is a physical instrument or a literal
// action, never an abstract concept. Search promised a search box that isn't
// there; Scissors named the action you might take rather than the thing itself.
const manageLinks = [
  { path: '/recon',         icon: ClipboardCheck, label: 'Daily Review' },
  { path: '/subscriptions', icon: Repeat,         label: 'Subscriptions' },
  { path: '/settings',      icon: Settings,       label: 'Settings' },
];

// `pro: true` marks a Tool that requires Pro. Bill Splitter (viral acquisition)
// and True Cost (free differentiator) are deliberately left free.
const calculatorTools: { path: string; icon: React.ElementType; label: string; subtitle: string; pro?: boolean }[] = [
  { path: '/split',            icon: Split,        label: 'Bill Splitter',   subtitle: 'Divide expenses and track who owes what' },
  { path: '/true-cost',        icon: Hourglass,    label: 'True Cost',       subtitle: 'Calculate the real price of purchases over time' },
  { path: '/debt-destroyer',   icon: TrendingDown, label: 'Debt Payoff',     subtitle: 'Optimize your avalanche or snowball strategy', pro: true },
  { path: '/tactical-command', icon: LifeBuoy,     label: 'Safety Net',      subtitle: 'How long your cash lasts and your target buffer' },
  { path: '/compound-growth',  icon: TrendingUp,   label: 'Wealth Growth',   subtitle: 'Project your long-term net worth' },
  { path: '/fire',             icon: Flame,        label: 'FIRE CALCULATOR', subtitle: 'Financial Independence & Early Retirement projection', pro: true },
  { path: '/income',           icon: Banknote,     label: 'Income Tracker',  subtitle: 'Log income milestones & find your FIRE savings rate', pro: true },
];

function SheetLink({ path, icon: Icon, label, onClick }: {
  path: string; icon: React.ElementType; label: string; onClick: () => void;
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
      <Icon size={15} strokeWidth={2} className="shrink-0" />
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
          {/* Weight 2, not 2.5: these sit on light cards, where a heavy stroke
              bloats hardest and the glyph stops reading as a shape.

              The idle colour is theme-split because yellow only works on one of
              the two card backgrounds. #facc15 on the light card (#E5E3DE) is
              1.2:1 — effectively invisible — while on the dark card (#242424) it
              is 10.4:1. So light mode uses text-main (14.8:1) and dark mode keeps
              the brand yellow. Either way yellow now means "selected" rather than
              being the default state. */}
          <Icon size={18} strokeWidth={2} className={`shrink-0 ${isActive ? 'text-primary-contrast' : 'text-text-main dark:text-action-primary'}`} />
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

// Top bookend: brand on the left, the menu that holds everything outside the
// four bottom tabs on the right. It owns the More sheet so the trigger and the
// sheet stay in one file rather than sharing state across the layout.
export default function TopHeader() {
  const { theme, setTheme, privacyMode, togglePrivacyMode } = useStore(
    useShallow(s => ({
      theme: s.theme,
      setTheme: s.setTheme,
      privacyMode: s.privacyMode,
      togglePrivacyMode: s.togglePrivacyMode,
    })),
  );
  const proLocked = useProLocked();
  const [moreOpen, setMoreOpen] = useState(false);
  const close = () => setMoreOpen(false);
  const signOut = () => supabase.auth.signOut();

  return (
    <>
      <header className="shrink-0 z-50 w-full flex justify-between items-center gap-3 px-4 pb-4 header-pt-safe bg-base border-b-[3px] border-border transition-colors duration-300">
        <BrandLogo />

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-label="Open menu"
          className="shrink-0 w-11 h-11 flex items-center justify-center bg-surface border-[3px] border-border rounded-xl text-text-main shadow-[3px_3px_0px_0px_var(--shadow-color)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
        >
          <Menu size={18} strokeWidth={3} />
        </button>
      </header>

      {/* ── More Sheet ── */}
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-60 bg-black/40"
              onClick={close}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="fixed bottom-0 left-0 right-0 z-70 bg-surface border-t-[3px] border-border rounded-t-3xl px-5 pt-4 sheet-pb-safe max-h-[90vh] overflow-y-auto"
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
              <div className="flex flex-col gap-2 mb-4">
                {manageLinks.map(item => (
                  <SheetLink key={item.path} path={item.path} icon={item.icon} label={item.label} onClick={close} />
                ))}
              </div>

              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-text-muted/50 mb-2">Tools</p>
              <div className="flex flex-col gap-2 mb-5">
                {calculatorTools.map(item => (
                  <ToolSheetLink key={item.path} path={item.path} icon={item.icon} label={item.label} subtitle={item.subtitle} onClick={close} locked={!!item.pro && proLocked} />
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
                    title="Toggle theme"
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
