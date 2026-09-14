import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { CircleGauge, Receipt, LockKeyhole, PieChart, Ellipsis, Settings, ClipboardCheck, Split, Hourglass, Sun, Moon, Repeat, X, Eye, EyeOff, TrendingUp, TrendingDown, LogOut, Flame, Banknote, Lock, LifeBuoy, SlidersHorizontal, Percent } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { useProLocked } from '../lib/pro';
import { supabase } from '../core/supabase';
import { BrandLogo } from './BrandLogo';

// The four tabs that live in the floating bar. The fifth slot opens the menu
// holding everything else, so every destination sits in the same thumb zone and
// the sheet rises from the edge its trigger is on.
//
// Icon rule for the whole app: every icon is a physical instrument or a literal
// action, never an abstract concept. CircleGauge (not LayoutDashboard, not House)
// because Home's job is to show one reading, not to describe its own layout or
// restate its label. The enclosed variant over plain Gauge: an open arc floats
// inside a round pill, a closed dial with a hub sits in it.
//
// Second rule: keep the icons within one optical density range — every glyph in
// this bar is 2-3 elements. Landmark carried the right meaning for Vaults but has
// six, four of them near-identical columns that mush together at 22px; LockKeyhole
// says the same thing in three. Lucide's Vault has ten and is unusable here. One
// dense outlier is enough to stop a set looking like it was drawn by one hand.
//
// Ellipsis, not Menu, on the overflow slot: a hamburger promises a drawer sliding
// in from the edge it sits on. This opens a bottom sheet, and three dots is the
// platform glyph for exactly that.
// Labels are short on purpose. Budget per slot, after the bar padding, the
// four gaps, each tab border and the label padding:
//
//   320px (iPhone SE, the constraint):  ~45px
//   448px (max-w-md, the widest state): ~78px
//
// Size any new label against 45px, not 78. 'Dashboard' and 'Breakdown' at
// font-black 9px overrun even the 78px case, which is why they ellipsised, and
// the truncated one was whichever tab was active.
const primaryTabs = [
  { path: '/',             icon: CircleGauge, label: 'Home' },
  { path: '/transactions', icon: Receipt,     label: 'Spend' },
  { path: '/vaults',       icon: LockKeyhole, label: 'Vaults' },
  { path: '/breakdown',    icon: PieChart,    label: 'Stats' },
];

const desktopCoreLinks = [
  { path: '/',              icon: CircleGauge,      label: 'Dashboard' },
  { path: '/recon',         icon: ClipboardCheck,   label: 'Daily Review' },
  { path: '/transactions',  icon: Receipt,           label: 'Ledger' },
  { path: '/vaults',        icon: LockKeyhole,       label: 'Vaults' },
  { path: '/breakdown',     icon: PieChart,          label: 'Audit Log' },
  { path: '/subscriptions', icon: Repeat,            label: 'Subscriptions' },
  { path: '/limit',         icon: Percent,           label: 'Spend Limit' },
  { path: '/pacing',        icon: SlidersHorizontal, label: 'Pacing' },
];

// Core screens that are not one of the four tabs.
const manageLinks = [
  { path: '/recon',         icon: ClipboardCheck,    label: 'Daily Review' },
  { path: '/limit',         icon: Percent,           label: 'Spend Limit' },
  { path: '/pacing',        icon: SlidersHorizontal, label: 'Pacing' },
  { path: '/subscriptions', icon: Repeat,            label: 'Subscriptions' },
  { path: '/settings',      icon: Settings,          label: 'Settings' },
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
      <Icon size={17} strokeWidth={2} className="shrink-0" />
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
          <Icon size={18} strokeWidth={2} className={`shrink-0 ${isActive ? 'text-primary-contrast' : 'text-text-main'}`} />
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
            <DesktopNavItem path="/settings" icon={Settings} label="Settings" />
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
              {/* Larger and lighter beats small and heavy: a 3px stroke on a 19px
                  glyph is 16% of its width, which closes the counters and turns
                  shapes into blobs. Weight is constant across states so the icon
                  does not swell on select — the yellow pill carries that already. */}
              <tab.icon size={22} strokeWidth={2} className="shrink-0" />
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
            <Ellipsis size={22} strokeWidth={2} className="shrink-0" />
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
