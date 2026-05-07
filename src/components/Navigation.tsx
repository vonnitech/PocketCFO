import { NavLink } from 'react-router-dom';
import { Terminal, Shield, List, Target, Settings, Search, Users, Calculator, Sun, Moon } from 'lucide-react';
import { useStore } from '../store/useStore';

const combatTools = [
  { path: '/', icon: Terminal, label: 'Overview' },
  { path: '/split', icon: Users, label: 'Fair Share' },
  { path: '/true-cost', icon: Calculator, label: 'Reality Check' },
  { path: '/debt-destroyer', icon: Target, label: 'Debt Free' },
  { path: '/tactical-command', icon: Target, label: 'Horizon' },
];

const intelTools = [
  { path: '/recon', icon: Search, label: 'Daily Focus' },
  { path: '/vaults', icon: Shield, label: 'Vaults' },
  { path: '/audit', icon: List, label: 'Audit Log' },
  { path: '/strategy', icon: Target, label: 'Planner' },
  { path: '/leeches', icon: Shield, label: 'Leeches' },
  { path: '/config', icon: Settings, label: 'Settings' },
];

export default function Navigation() {
  const { theme, setTheme } = useStore();

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t-2 border-border md:relative md:border-t-0 md:bg-transparent p-2 md:p-6 h-24 md:h-screen flex flex-col transition-colors duration-300">
      {/* Mobile: Horizontal Block Matrix */}
      <div className="md:hidden flex gap-2 overflow-x-auto no-scrollbar scroll-smooth">
        <button 
          onClick={toggleTheme}
          className="flex-shrink-0 flex items-center justify-center w-14 h-14 border-4 border-black transition-all bg-surface text-text-main"
        >
          {theme === 'light' ? <Moon size={24} /> : <Sun size={24} />}
        </button>
        {[...combatTools, ...intelTools].map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex-shrink-0 flex items-center justify-center w-14 h-14 border-4 transition-all
              ${isActive 
                ? 'bg-action-capture border-black text-black shadow-[4px_4px_0px_0px_currentColor]' 
                : 'bg-surface border-border text-text-muted hover:text-text-main'
              }
            `}
          >
            <item.icon size={24} strokeWidth={3} />
          </NavLink>
        ))}
      </div>

      {/* Desktop: Modern Stack */}
      <div className="hidden md:flex flex-col gap-8 flex-1">
        <div className="flex items-center justify-between px-4">
          <p className="text-[10px] text-text-muted tracking-[0.4em] font-black uppercase">Pocket CFO</p>
          <button 
            onClick={toggleTheme}
            className="p-2 border-2 border-border hover:bg-surface transition-all active:translate-y-1 active:shadow-none shadow-[2px_2px_0px_0px_currentColor]"
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>

        <div className="py-2">
          <p className="text-[12px] text-text-muted tracking-[0.4em] font-black mb-4 px-4 uppercase">Actions</p>
          <div className="flex flex-col gap-2">
            {combatTools.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `
                  flex items-center gap-4 p-4 border-4 transition-all group relative
                  ${isActive 
                    ? 'bg-action-capture border-border text-black shadow-[4px_4px_0px_0px_currentColor]' 
                    : 'bg-surface border-border text-text-muted hover:text-text-main'
                  }
                `}
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={20} strokeWidth={3} />
                    <span className="text-xs font-black uppercase tracking-widest">{item.label}</span>
                    {isActive && <div className="absolute -left-[16px] top-1/2 -translate-y-1/2 w-2 h-8 bg-action-capture border-2 border-black"></div>}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>

        <div className="py-2">
          <p className="text-[12px] text-text-muted tracking-[0.4em] font-black mb-4 px-4 uppercase">Analysis</p>
          <div className="flex flex-col gap-2">
            {intelTools.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `
                  flex items-center gap-4 p-4 border-4 transition-all group relative
                  ${isActive 
                    ? 'bg-action-target border-border text-black shadow-[4px_4px_0px_0px_currentColor]' 
                    : 'bg-surface border-border text-text-muted hover:text-text-main'
                  }
                `}
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={20} strokeWidth={3} />
                    <span className="text-xs font-black uppercase tracking-widest">{item.label}</span>
                    {isActive && <div className="absolute -left-[16px] top-1/2 -translate-y-1/2 w-2 h-8 bg-action-target border-2 border-black"></div>}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
