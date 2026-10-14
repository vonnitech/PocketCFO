import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Sun, Moon, X, Eye, EyeOff, LogOut, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { useProLocked } from '../lib/pro';
import { supabase } from '../core/supabase';
import { BrandLogo } from './BrandLogo';
import {
  StackPiggyHomeIcon,
  StackPiggyDailyReviewIcon,
  StackPiggySpendLimitIcon,
  StackPiggyPacingIcon,
  StackPiggySubscriptionsIcon,
  StackPiggySettingsIcon,
  StackPiggyBillSplitIcon,
  StackPiggyTrueCostIcon,
  StackPiggyWishlistIcon,
  StackPiggyDebtPayoffIcon,
  StackPiggySafetyNetIcon,
  StackPiggyFireIcon,
  StackPiggyIncomeIcon,
  StackPiggyMoreIcon,
  StackPiggySpendIcon,
  StackPiggyStatsIcon,
  StackPiggyVaultIcon,
} from './StackPiggyIcons';

// The bottom tabs use a small, consistent visual language: money, logging,
// saving, progress, and tools. Labels stay short enough for a 320px viewport.
type PrimaryTab = {
  path: string;
  icon: React.ElementType;
  label: string;
};

const primaryTabs: PrimaryTab[] = [
  { path: '/',             icon: StackPiggyHomeIcon,  label: 'Home' },
  { path: '/transactions', icon: StackPiggySpendIcon, label: 'Spend' },
  { path: '/vaults',       icon: StackPiggyVaultIcon, label: 'Vaults' },
  { path: '/breakdown',    icon: StackPiggyStatsIcon, label: 'Stats' },
];

const desktopCoreLinks = [
  { path: '/',              icon: StackPiggyHomeIcon, label: 'Dashboard' },
  { path: '/daily',         icon: StackPiggyDailyReviewIcon, label: 'Daily Review' },
  { path: '/transactions',  icon: StackPiggySpendIcon, label: 'Ledger' },
  { path: '/vaults',        icon: StackPiggyVaultIcon, label: 'Vaults' },
  { path: '/breakdown',     icon: StackPiggyStatsIcon, label: 'Breakdown' },
  { path: '/subscriptions', icon: StackPiggySubscriptionsIcon, label: 'Subscriptions' },
  { path: '/limit',         icon: StackPiggySpendLimitIcon, label: 'Spend Limit' },
  { path: '/pacing',        icon: StackPiggyPacingIcon, label: 'Pacing' },
];

// Core screens that are not one of the four tabs.
const manageLinks = [
  { path: '/daily',         icon: StackPiggyDailyReviewIcon, label: 'Daily Review' },
  { path: '/limit',         icon: StackPiggySpendLimitIcon, label: 'Spend Limit' },
  { path: '/pacing',        icon: StackPiggyPacingIcon, label: 'Pacing' },
  { path: '/subscriptions', icon: StackPiggySubscriptionsIcon, label: 'Subscriptions' },
  { path: '/settings',      icon: StackPiggySettingsIcon, label: 'Settings' },
];

// `pro: true` marks a Tool that requires Pro. Bill Splitter (viral acquisition)
// and True Cost (free differentiator) are deliberately left free.
const calculatorTools: { path: string; icon: React.ElementType; label: string; subtitle: string; pro?: boolean }[] = [
  { path: '/split',            icon: StackPiggyBillSplitIcon, label: 'Bill Splitter', subtitle: 'Divide expenses and track who owes what' },
  { path: '/true-cost',        icon: StackPiggyTrueCostIcon, label: 'True Cost', subtitle: 'Calculate the real price of purchases over time' },
  { path: '/debt',             icon: StackPiggyDebtPayoffIcon, label: 'Debt Payoff', subtitle: 'Optimize your avalanche or snowball strategy', pro: true },
  { path: '/safety-net',       icon: StackPiggySafetyNetIcon, label: 'Safety Net', subtitle: 'How long your cash lasts and your target buffer' },
  { path: '/fire',             icon: StackPiggyFireIcon, label: 'FIRE CALCULATOR', subtitle: 'Financial Independence & Early Retirement projection', pro: true },
  { path: '/wishlist',         icon: StackPiggyWishlistIcon, label: 'Wishlist', subtitle: 'Things you want, priced in days of your cleared amount' },
  { path: '/income',           icon: StackPiggyIncomeIcon, label: 'Income Tracker', subtitle: 'Log income milestones & find your FIRE savings rate', pro: true },
];

function DesktopNavItem({ path, icon: Icon, label, locked }: {
  path: string; icon: React.ElementType; label: string; locked?: boolean;
}) {
  return (
    <NavLink
      to={path}
      end={path === '/'}
      className={({ isActive }) =>
        `relative flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-colors duration-150 ${
          isActive
            ? 'bg-action-primary border-black text-primary-contrast'
            : 'border-transparent text-text-muted hover:bg-input hover:text-text-main hover:border-border'
        }`
      }
    >
      <Icon size={20} className="shrink-0" />
      <span className="min-w-0 truncate text-[11px] font-bold uppercase tracking-wider leading-none">{label}</span>
      {locked && (
        <span className="ml-auto inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest opacity-70">
          <Lock size={10} strokeWidth={3} /> Preview
        </span>
      )}
    </NavLink>
  );
}

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
      <Icon size={22} className="shrink-0" />
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
        `flex items-center gap-3 px-4 py-3 rounded-2xl border-4 dark:border transition-all ${
          isActive
            ? 'bg-action-primary border-black'
            : 'bg-input border-transparent hover:border-border'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* Neutral idle icons keep the yellow fill reserved for selection. */}
          <Icon size={26} className={`shrink-0 ${isActive ? 'text-primary-contrast' : 'text-text-main'}`} />
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
  const proLocked = useProLocked();
  const [moreOpen, setMoreOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const close = () => setMoreOpen(false);
  const signOut = () => supabase.auth.signOut();

  // Read once on mount and keep it current, so signing into a different account
  // without a reload does not leave a stale address above the Sign Out button.
  useEffect(() => {
    let live = true;
    supabase.auth.getSession().then(({ data }) => {
      if (live) setEmail(data.session?.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => { live = false; sub.subscription.unsubscribe(); };
  }, []);

  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `flex-1 min-w-0 flex flex-col items-center justify-center gap-1 h-14 rounded-2xl border-2 transition-colors duration-150
    ${isActive
      ? 'bg-action-primary border-black text-primary-contrast'
      : 'border-transparent text-text-muted hover:text-text-main'
    }`;

  const tabLabel = 'w-full truncate text-[8px] min-[360px]:text-[9px] font-black uppercase tracking-normal min-[360px]:tracking-wide sm:tracking-wider leading-tight text-center dark:text-[8px] min-[360px]:dark:text-[9px] sm:dark:text-[11px] dark:normal-case dark:font-semibold dark:tracking-normal';

  return (
    <>
      <aside className="hidden md:flex h-screen w-64 flex-col bg-surface border-r-[3px] border-border px-4 py-5 transition-colors duration-300">
        <div className="mb-7 px-1">
          <BrandLogo />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto no-scrollbar">
          <section className="flex flex-col gap-0.5">
            <p className="px-3 mb-1.5 text-[11px] font-black uppercase tracking-[0.25em] text-text-muted/50">Core</p>
            {desktopCoreLinks.map(item => <DesktopNavItem key={item.path} {...item} />)}
          </section>

          <div className="h-px shrink-0 bg-border opacity-30 mx-1" />

          <section className="flex flex-col gap-0.5">
            <p className="px-3 mb-1.5 text-[11px] font-black uppercase tracking-[0.25em] text-text-muted/50">Tools</p>
            {calculatorTools.map(item => (
              <DesktopNavItem
                key={item.path}
                path={item.path}
                icon={item.icon}
                label={item.label}
                locked={!!item.pro && proLocked}
              />
            ))}
          </section>

          <div className="mt-auto pt-4 border-t-2 border-border/30 space-y-1">
            <div className="flex gap-1.5 mb-1.5">
              <button
                type="button"
                title={privacyMode ? 'Disable privacy mode' : 'Enable privacy mode'}
                onClick={() => togglePrivacyMode()}
                className={`flex-1 h-9 flex items-center justify-center gap-1.5 border-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-colors ${privacyMode ? 'bg-action-bleed border-action-bleed text-white' : 'border-border bg-input text-text-muted hover:text-text-main'}`}
              >
                {privacyMode ? <EyeOff size={13} /> : <Eye size={13} />}
                {privacyMode ? 'Hidden' : 'Privacy'}
              </button>
              <button
                type="button"
                title="Toggle theme"
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="flex-1 h-9 flex items-center justify-center gap-1.5 border-2 border-border bg-input rounded-xl text-[9px] font-black uppercase tracking-wider text-text-muted hover:text-text-main transition-colors"
              >
                {theme === 'light' ? <Moon size={13} /> : <Sun size={13} />}
                {theme === 'light' ? 'Dark' : 'Light'}
              </button>
            </div>
            <DesktopNavItem path="/settings" icon={StackPiggySettingsIcon} label="Settings" />
            {email && <p className="px-3 pt-2 text-[10px] font-bold text-text-muted truncate" title={email}>{email}</p>}
            <button
              type="button"
              onClick={signOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 border-transparent text-text-muted hover:bg-action-bleed/10 hover:text-action-bleed hover:border-action-bleed/30 transition-colors"
            >
              <LogOut size={16} strokeWidth={2} />
              <span className="text-[11px] font-bold uppercase tracking-wider leading-none">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* The outer bar spans the viewport so it can centre the pill, but it must
          not swallow taps on the page behind it, hence pointer-events-none here
          and pointer-events-auto on the pill itself. */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex md:hidden justify-center px-2 min-[360px]:px-4 nav-pb-safe pointer-events-none">
        <div className="app-navigation pointer-events-auto w-full max-w-md flex items-stretch gap-0.5 bg-surface border-[3px] border-border rounded-3xl shadow-[4px_4px_0px_0px_var(--shadow-color)] px-1.5 py-1.5 transition-colors duration-300">
          {primaryTabs.map(tab => (
            <NavLink
              key={tab.path}
              to={tab.path}
              // Without `end`, "/" matches every route and Dashboard would read
              // as the active tab on every screen.
              end={tab.path === '/'}
              className={tabClass}
            >
              <tab.icon size={24} className="shrink-0" />
              <span className={tabLabel}>{tab.label}</span>
            </NavLink>
          ))}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="Open menu"
            aria-expanded={moreOpen}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 h-14 rounded-2xl border-2 transition-colors duration-150 ${
              moreOpen
                ? 'bg-action-primary border-black text-primary-contrast'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            <StackPiggyMoreIcon size={24} className="shrink-0" />
            <span className={tabLabel}>More</span>
          </button>
        </div>
      </nav>

      {/* ── More Sheet ── */}
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
              className="fixed bottom-0 left-0 right-0 z-70 bg-surface border-t-[3px] border-border dark:border-t rounded-t-3xl px-5 pt-4 sheet-pb-safe md:hidden max-h-[90vh] overflow-y-auto"
            >
              {/* Drag handle */}
              <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />

              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <img src="/stackpiggy-mark.svg" alt="" width={24} height={24} className="w-6 h-6 shrink-0" />
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

              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-text-muted mb-2">Manage</p>
              <div className="flex flex-col gap-2 mb-4">
                {manageLinks.map(item => (
                  <SheetLink key={item.path} path={item.path} icon={item.icon} label={item.label} onClick={close} />
                ))}
              </div>

              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-text-muted mb-2">Tools</p>
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

              {email && (
                <div className="mt-4 px-1 min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Signed in as</p>
                  <p className="text-[11px] font-bold text-text-main truncate mt-0.5" title={email}>{email}</p>
                </div>
              )}

              <button
                type="button"
                onClick={signOut}
                className="w-full flex items-center justify-center gap-2 h-12 border-2 border-action-bleed/30 rounded-2xl text-action-bleed bg-action-bleed/10 font-black uppercase text-[11px] tracking-widest mt-3 hover:bg-action-bleed/20 transition-colors"
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
