import { NavLink } from 'react-router-dom';
import { Gauge, Receipt, Landmark, PieChart } from 'lucide-react';

// The four tabs that live in the floating bar. Everything else is reached from
// the menu button in TopHeader, which owns the More sheet.
//
// Icon rule for the whole app: every icon is a physical instrument or a literal
// action, never an abstract concept. Gauge (not LayoutDashboard) because the
// Dashboard's job is to show one reading, not to describe its own layout.
//
// Second rule: keep the icons within one optical density range. Every glyph here
// is 2-6 elements. Lucide's Vault reads better in isolation but has ten, so at
// tab size it renders as a smudge beside two-stroke Gauge, and a set with one
// dense outlier stops looking like it was drawn by one hand.
const primaryTabs = [
  { path: '/',             icon: Gauge,    label: 'Dashboard' },
  { path: '/transactions', icon: Receipt,  label: 'Spend' },
  { path: '/vaults',       icon: Landmark, label: 'Vaults' },
  { path: '/breakdown',    icon: PieChart, label: 'Breakdown' },
];

export default function Navigation() {
  return (
    // The outer bar spans the viewport so it can centre the pill, but it must
    // not swallow taps on the page behind it, hence pointer-events-none here
    // and pointer-events-auto on the pill itself.
    <nav className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 nav-pb-safe pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md flex items-stretch gap-1 bg-surface border-[3px] border-border rounded-full shadow-[4px_4px_0px_0px_var(--shadow-color)] px-1.5 py-1.5 transition-colors duration-300">
        {primaryTabs.map(tab => (
          <NavLink
            key={tab.path}
            to={tab.path}
            // Without `end`, "/" matches every route and Dashboard would read
            // as the active tab on every screen.
            end={tab.path === '/'}
            className={({ isActive }) =>
              `flex-1 min-w-0 flex flex-col items-center justify-center gap-1 h-14 rounded-full border-2 transition-colors duration-150
              ${isActive
                ? 'bg-action-primary border-black text-primary-contrast'
                : 'border-transparent text-text-muted hover:text-text-main'
              }`
            }
          >
            {/* Larger and lighter beats small and heavy: a 3px stroke on a 19px
                glyph is 16% of its width, which closes the counters and turns
                shapes into blobs. Weight is constant across states so the icon
                does not swell on select — the yellow pill carries that already,
                which is also why these children no longer need `isActive`. */}
            <tab.icon size={22} strokeWidth={2} className="shrink-0" />
            <span className="text-[9px] font-black uppercase tracking-wider leading-tight text-center px-0.5">
              {tab.label}
            </span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
