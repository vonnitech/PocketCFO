import { useState } from 'react';
import { motion } from 'motion/react';
import { Download, Upload, Trash2, Smartphone, RefreshCw, Sun, Moon, User, Trophy, Zap, Medal, Shield } from 'lucide-react';
import BrutalCard from '../components/BrutalCard';
import { INITIAL_STATE } from '../store/useStore';
import { useStore } from '../store/useStore';

export default function Config() {
  const state = useStore();
  const { 
    ghostMode, 
    setGhostMode, 
    theme, 
    setTheme, 
    setState 
  } = state;

  const [isAddingConfigGremlin, setIsAddingConfigGremlin] = useState(false);
  const [newConfigGremlinName, setNewConfigGremlinName] = useState('');

  const exportData = () => {
    const dataStr = JSON.stringify(state, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `pocket_cfo_payload_${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        setState(json);
        alert('Data Restored Successfully.');
      } catch (err) {
        alert('Invalid Data Payload.');
      }
    };
    reader.readAsText(file);
  };

  const resetSystem = () => {
    setState(INITIAL_STATE);
  };

  const rerunOnboarding = () => {
    setState({ isConfigured: false });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  const currentXP = state.stats.experience || 0;
  const progress = (currentXP % 1000) / 10;

  const achievements = [
    { id: '1', title: 'Ghost Buster', desc: 'Kill 3 subscriptions', unlocked: state.stats.leechesKilled >= 3, icon: Zap },
    { id: '2', title: 'Snowball Striker', desc: 'Execute 10 flips', unlocked: state.stats.flipsExecuted >= 10, icon: Shield },
    { id: '3', title: 'Capital King', desc: 'Secure $1,000 in Vaults', unlocked: state.vaults.reduce((acc, v) => acc + v.current, 0) >= 1000, icon: Trophy },
  ];

  return (
    <motion.div 
      className="space-y-12 max-w-4xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
       <motion.header variants={itemVariants} className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter uppercase leading-none">Settings</h1>
          <p className="text-text-muted font-mono mt-2 uppercase tracking-widest text-[10px]">Profile & Preferences</p>
        </div>
        <div className="flex items-center gap-4 bg-surface p-4 rounded-3xl border-4 border-border">
          <div className="w-16 h-16 bg-action-target rounded-xl flex items-center justify-center text-base border-4 border-border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <User size={32} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase text-text-muted italic">User Level</div>
            <div className="text-3xl font-black text-action-target italic tracking-tighter">LVL {state.stats.level}</div>
            <div className="w-32 h-2 bg-surface rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-action-target" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </motion.header>

      {/* PERFORMANCE STATS */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <BrutalCard title="Total Savings" color="bg-action-capture/10" variants={itemVariants}>
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase opacity-60 italic">Total Value Protected</p>
            <div className="text-5xl md:text-7xl font-black text-action-capture italic tracking-tighter leading-none">
              ${(state.stats.lifetimeCapture || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs font-black uppercase text-text-muted mt-4">
               Includes Savings Gains & Cancelled Subscriptions
            </p>
          </div>
        </BrutalCard>

        <BrutalCard title="Achievements" color="bg-action-target/10" variants={itemVariants}>
          <div className="space-y-3">
            {achievements.map((ach) => (
              <div key={ach.id} className={`flex items-center gap-4 p-3 rounded-2xl border-4 transition-all ${ach.unlocked ? 'bg-base border-border text-text-main' : 'bg-transparent border-dashed border-border/30 text-text-main/30 grayscale'}`}>
                <div className={`w-12 h-12 rounded-xl flex flex-shrink-0 items-center justify-center border-4 ${ach.unlocked ? 'bg-action-target border-border text-text-main shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-surface border-transparent'}`}>
                  <ach.icon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-black text-sm uppercase tracking-tighter truncate">{ach.title}</h4>
                  <p className="text-[10px] uppercase font-black opacity-60 truncate">{ach.desc}</p>
                </div>
                {ach.unlocked && (
                  <div className="ml-auto text-action-target mr-2">
                    <Medal size={24} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </BrutalCard>
      </motion.div>

      {/* SYSTEM CONTROLS */}
      <motion.div variants={itemVariants}>
        <h2 className="text-2xl font-black italic tracking-tighter uppercase mb-6">System Controls</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <BrutalCard title="AESTHETIC CONFIG" color="bg-action-capture/10" variants={itemVariants}>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-6 rounded-[28px] bg-surface/20 border border-border/10">
                 <div>
                  <h4 className="font-bold uppercase tracking-tighter flex items-center gap-2">
                    {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />} BASE THEME
                  </h4>
                  <p className="text-[10px] opacity-40 uppercase">Toggle Dark/Light Mode</p>
                </div>
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className={`w-14 h-8 rounded-full flex items-center px-1 transition-all ${theme === 'dark' ? 'bg-action-target' : 'bg-border/20'}`}
                >
                  <motion.div 
                    animate={{ x: theme === 'dark' ? 24 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="w-6 h-6 rounded-full bg-base" 
                  />
                </motion.button>
              </div>

              <div className="space-y-4 px-2">
                <div>
                  <label className="text-[10px] font-black uppercase text-text-muted italic mb-2 block">Primary Color Hex</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color"
                      value={state.themeColors?.primary || '#FFEF00'}
                      onChange={(e) => setState({ themeColors: { ...state.themeColors, primary: e.target.value } })}
                      className="w-12 h-12 p-1 rounded-xl bg-base border-4 border-border cursor-pointer"
                    />
                    <input 
                      type="text"
                      className="flex-1 bg-base border-4 border-border rounded-xl p-3 font-mono text-sm font-bold uppercase"
                      value={state.themeColors?.primary || '#FFEF00'}
                      onChange={(e) => setState({ themeColors: { ...state.themeColors, primary: e.target.value } })}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-text-muted italic mb-2 block">Capture Color (Success) Hex</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color"
                      value={state.themeColors?.secondary || '#00FF41'}
                      onChange={(e) => setState({ themeColors: { ...state.themeColors, secondary: e.target.value } })}
                      className="w-12 h-12 p-1 rounded-xl bg-base border-4 border-border cursor-pointer"
                    />
                    <input 
                      type="text"
                      className="flex-1 bg-base border-4 border-border rounded-xl p-3 font-mono text-sm font-bold uppercase"
                      value={state.themeColors?.secondary || '#00FF41'}
                      onChange={(e) => setState({ themeColors: { ...state.themeColors, secondary: e.target.value } })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </BrutalCard>

        <BrutalCard title="SECURITY & SOVEREIGNTY" color="bg-action-target/10" variants={itemVariants}>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-6 rounded-[28px] bg-surface/20 border border-border/10">
               <div>
                <h4 className="font-bold uppercase tracking-tighter flex items-center gap-2">
                  <Shield size={18} /> GHOST MODE
                </h4>
                <p className="text-[10px] opacity-60 uppercase">Scramble all balances</p>
              </div>
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={() => setGhostMode(!ghostMode)}
                className={`w-14 h-8 rounded-full flex items-center px-1 transition-all ${ghostMode ? 'bg-action-target' : 'bg-border/20'}`}
              >
                <motion.div 
                  animate={{ x: ghostMode ? 24 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="w-6 h-6 rounded-full bg-base shadow-sm" 
                />
              </motion.button>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] uppercase font-black opacity-60 italic mb-2">Offline Payload Management</p>
              <motion.button 
                whileTap={{ scale: 0.98 }}
                onClick={exportData}
                className="w-full h-12 rounded-full bg-surface/20 text-text-main font-bold uppercase text-xs flex items-center justify-center gap-2 border border-border/10 hover:bg-surface/30 transition-all"
              >
                <Download size={20} /> EXPORT SECURE PAYLOAD
              </motion.button>
              
              <motion.label 
                whileTap={{ scale: 0.98 }}
                className="w-full h-12 rounded-full bg-surface/20 text-text-main font-bold uppercase text-xs flex items-center justify-center gap-2 border border-border/10 cursor-pointer hover:bg-surface/30 transition-all"
              >
                <Upload size={20} /> IMPORT EXTERNAL STATE
                <input type="file" className="hidden" accept=".json" onChange={importData} />
              </motion.label>

              <motion.button 
                whileTap={{ scale: 0.98 }}
                onClick={resetSystem}
                className="w-full h-12 rounded-full bg-action-bleed/10 text-action-bleed font-bold uppercase text-xs flex items-center justify-center gap-2 mt-8 border border-action-bleed/20 hover:bg-action-bleed/20 transition-all"
              >
                <Trash2 size={20} /> WIPE CORE SYSTEM
              </motion.button>
            </div>
            
            <div className="pt-4 border-t-2 border-border/10 space-y-4">
              <motion.button 
                whileTap={{ scale: 0.98 }}
                onClick={rerunOnboarding} 
                className="w-full h-12 rounded-full border border-border/20 text-action-target text-xs font-bold uppercase flex items-center justify-center gap-2 hover:bg-action-target/5 transition-all"
              >
                <RefreshCw size={18} /> RE-RUN ONBOARDING
              </motion.button>
              <motion.button 
                whileTap={{ scale: 0.98 }}
                className="w-full h-12 rounded-full border border-border/20 text-text-main text-xs font-bold uppercase flex items-center justify-center gap-2 hover:bg-surface/30 transition-all"
              >
                <Smartphone size={18} /> INSTALL PWA NATIVE
              </motion.button>
            </div>
          </div>
        </BrutalCard>
      </div>

      <BrutalCard title="Habit Tracker" color="bg-action-bleed/10" variants={itemVariants}>
        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase opacity-60 ml-2 mb-4 italic">Configure habits and tax rates</p>
          <div className="grid grid-cols-1 gap-4">
            {(state.gremlins || []).map((gremlin) => (
              <div key={gremlin.id} className="flex items-center justify-between p-4 rounded-3xl bg-surface/20 border-4 border-border">
                <div>
                  <h4 className="font-black italic uppercase text-xs tracking-widest">{gremlin.name}</h4>
                  <p className="text-[8px] opacity-50 uppercase font-black">Tax Rate: {(gremlin.taxRate * 100)}%</p>
                </div>
                <div className="flex gap-2">
                   <input 
                    type="number"
                    className="w-16 bg-surface text-text-main/10 border-2 border-border rounded-lg text-center font-mono text-xs p-1"
                    value={gremlin.taxRate * 100}
                    onChange={(e) => {
                      const rate = parseFloat(e.target.value) / 100;
                      setState({
                        gremlins: state.gremlins.map(g => g.id === gremlin.id ? { ...g, taxRate: rate } : g)
                      });
                    }}
                   />
                   <motion.button 
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      setState({
                        gremlins: state.gremlins.filter(g => g.id !== gremlin.id)
                      });
                    }}
                    className="p-2 text-action-bleed hover:bg-action-bleed/10 rounded-xl"
                   >
                     <Trash2 size={16} />
                   </motion.button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            {isAddingConfigGremlin ? (
               <div className="flex flex-col md:flex-row gap-2">
                 <input 
                   autoFocus
                   placeholder="Habit Name"
                   className="flex-1 bg-base border-2 border-border p-3 rounded-2xl text-xs font-black uppercase"
                   value={newConfigGremlinName}
                   onChange={e => setNewConfigGremlinName(e.target.value)}
                 />
                 <div className="flex gap-2">
                   <motion.button 
                     whileTap={{ scale: 0.95 }}
                     onClick={() => setIsAddingConfigGremlin(false)}
                     className="px-4 py-3 bg-surface rounded-2xl text-[10px] font-black uppercase"
                   >
                     Cancel
                   </motion.button>
                   <motion.button 
                     whileTap={{ scale: 0.95 }}
                     onClick={() => {
                       if (newConfigGremlinName.trim()) {
                         const newGremlin = { id: Math.random().toString(36).substr(2, 9), name: newConfigGremlinName.trim(), taxRate: 0.5 };
                         setState({ gremlins: [...(state.gremlins || []), newGremlin] });
                         setIsAddingConfigGremlin(false);
                         setNewConfigGremlinName('');
                       }
                     }}
                     className="px-4 py-3 bg-action-target text-base rounded-2xl text-[10px] font-black uppercase"
                   >
                     Add
                   </motion.button>
                 </div>
               </div>
            ) : (
               <motion.button 
                 whileTap={{ scale: 0.98 }}
                 onClick={() => setIsAddingConfigGremlin(true)}
                 className="w-full py-3 border-4 border-dashed border-border/20 text-[10px] font-black uppercase hover:border-action-target hover:text-action-target transition-all rounded-2xl"
               >
                 + Add New habit
               </motion.button>
            )}
          </div>
        </div>
      </BrutalCard>

      <BrutalCard title="Interface Settings" color="bg-action-target/10" variants={itemVariants}>
        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase opacity-60 ml-2 mb-4 italic">Configure active modular widgets</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(state.dashboardWidgets || []).map((widget) => (
              <motion.div 
                key={widget.id} 
                variants={itemVariants}
                className="flex items-center justify-between p-4 rounded-3xl bg-surface/20 border-4 border-border"
              >
                <div>
                  <h4 className="font-black italic uppercase text-xs tracking-widest">{widget.id.replace('-', ' ')}</h4>
                  <p className="text-[8px] opacity-50 uppercase font-black">Status: {widget.visible ? 'ACTIVE' : 'OFFLINE'}</p>
                </div>
                <motion.button 
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    setState({
                      dashboardWidgets: state.dashboardWidgets.map(w => w.id === widget.id ? { ...w, visible: !w.visible } : w)
                    });
                  }}
                  className={`w-12 h-6 rounded-full flex items-center px-1 transition-all ${widget.visible ? 'bg-action-target' : 'bg-border/20'}`}
                >
                  <motion.div 
                    animate={{ x: widget.visible ? 24 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="w-4 h-4 rounded-full bg-base" 
                  />
                </motion.button>
              </motion.div>
            ))}
          </div>
        </div>
      </BrutalCard>

      </motion.div>

      <BrutalCard title="Architect's Note" color="bg-surface/10" variants={itemVariants}>
        <div className="p-4 space-y-4">
           <p className="text-text-main/60 text-[10px] font-medium uppercase leading-relaxed">
            Pocket CFO is an entirely offline system. We do not store your financial data on our servers. 
            All extraction via Gemini AI happens in your local session. 
            Maintain your backup JSON payloads to ensure data persistence across devices.
           </p>
           <div className="flex gap-2">
              <span className="bg-action-capture/20 text-action-capture border border-action-capture/20 px-3 py-1 rounded-full text-[10px] font-black uppercase">v2.1.0-STABLE</span>
              <span className="bg-action-target/20 text-action-target border border-action-target/20 px-3 py-1 rounded-full text-[10px] font-black uppercase">LOCAL ONLY</span>
           </div>
        </div>
      </BrutalCard>
    </motion.div>
  );
}
