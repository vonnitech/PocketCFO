import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store/useStore';
import { initDB } from './db';

// Pages
import Dashboard from './pages/Dashboard';
import { TacticalSplitter } from './pages/TacticalSplitter';
import { Audit as SquadAudit } from './pages/Audit';
import { TrueCost } from './pages/TrueCost';
import { DebtDestroyer } from './pages/DebtDestroyer';
import { TacticalCommand } from './pages/TacticalCommand';
import Config from './pages/Config';
import Onboarding from './pages/Onboarding';
import Recon from './pages/Recon';
import Vaults from './pages/Vaults';
import Strategy from './pages/Strategy';
import LeechList from './pages/LeechList';

// Components
import Navigation from './components/Navigation';
import { PageWrapper } from './components/PageWrapper';

function App() {
  const isConfigured = useStore(s => s.isConfigured);
  const theme = useStore(s => s.theme);

  useEffect(() => {
    initDB().then(() => console.log('Terminal Ledger Initialized.'));
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  if (!isConfigured) {
    return <Onboarding />;
  }

  return (
    <Router>
      <div className="min-h-screen bg-base text-text-main font-sans flex flex-col md:flex-row relative">
        <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden opacity-5">
          <div className="pixel-grid absolute inset-0"></div>
        </div>

        <div className="md:w-64 flex-shrink-0 z-50">
          <Navigation />
        </div>
        
        <main className="flex-1 overflow-x-hidden pb-24 md:pb-0 p-4 md:p-8 relative z-10 transition-colors duration-300">
          <div className="max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<PageWrapper><Dashboard /></PageWrapper>} />
              <Route path="/audit" element={<PageWrapper><SquadAudit /></PageWrapper>} />
              <Route path="/split" element={<PageWrapper><TacticalSplitter /></PageWrapper>} />
              <Route path="/true-cost" element={<PageWrapper><TrueCost /></PageWrapper>} />
              <Route path="/debt-destroyer" element={<PageWrapper><DebtDestroyer /></PageWrapper>} />
              <Route path="/tactical-command" element={<PageWrapper><TacticalCommand /></PageWrapper>} />
              <Route path="/recon" element={<PageWrapper><Recon /></PageWrapper>} />
              <Route path="/vaults" element={<PageWrapper><Vaults /></PageWrapper>} />
              <Route path="/strategy" element={<PageWrapper><Strategy /></PageWrapper>} />
              <Route path="/leeches" element={<PageWrapper><LeechList /></PageWrapper>} />
              <Route path="/config" element={<PageWrapper><Config /></PageWrapper>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}

export default App;
