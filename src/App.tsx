import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useData } from './context/DataContext';
import { AnimatePresence, motion } from 'framer-motion';
import { DataProvider } from './context/DataContext';
import TopNav from './components/layout/TopNav';
import Sidebar from './components/layout/Sidebar';
import TickerTape from './components/layout/TickerTape';
import SkeletonLoader from './components/layout/SkeletonLoader';
import ToastContainer from './components/layout/ToastContainer';
import LiveIntelligence from './components/pages/LiveIntelligence';
import CrisisSimulator from './components/pages/CrisisSimulator';
import InfrastructureResilience from './components/pages/InfrastructureResilience';

import NewsAnalytics from './components/pages/NewsAnalytics';
import AnalyticsDashboard from './components/pages/AnalyticsDashboard';
import LeakageDashboard from './components/pages/LeakageDashboard';
import HighPriorityDashboard from './components/pages/HighPriorityDashboard';
import PolicyRecommender from './components/pages/PolicyRecommender';
import LoginPage from './components/pages/LoginPage';

function PageWrapper({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  if (loading) return <SkeletonLoader />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="flex-1 flex flex-col gap-3 min-h-0 p-2 md:p-3 md:pr-5 overflow-y-auto custom-scrollbar"
    >
      {children}
    </motion.div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageWrapper><LiveIntelligence /></PageWrapper>} />
        <Route path="/simulator" element={<PageWrapper><CrisisSimulator /></PageWrapper>} />
        <Route path="/infrastructure" element={<PageWrapper><InfrastructureResilience /></PageWrapper>} />
        <Route path="/news" element={<PageWrapper><NewsAnalytics /></PageWrapper>} />
        <Route path="/analytics" element={<PageWrapper><AnalyticsDashboard /></PageWrapper>} />
        <Route path="/recommender" element={<PageWrapper><PolicyRecommender /></PageWrapper>} />
        <Route path="/leakages" element={<PageWrapper><LeakageDashboard /></PageWrapper>} />
        <Route path="/priority" element={<PageWrapper><HighPriorityDashboard /></PageWrapper>} />
      </Routes>
    </AnimatePresence>
  );
}

function MainLayout({ onLogout }: { onLogout: () => void }) {
  const { theme } = useData();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden transition-colors duration-300 ${theme === 'light' ? 'light-theme bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-200'}`}>
      <TopNav onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)} onLogout={onLogout} />
      <div className="flex-1 flex min-h-0 overflow-visible relative">
        <Sidebar mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
        <main className="flex-1 flex flex-col min-h-0 relative overflow-y-auto custom-scrollbar">
          <div className="flex-1 flex flex-col min-h-0">
            <AnimatedRoutes />
        </div>
          <TickerTape />
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('lz_auth') === '1';
  });

  const handleLogin = () => {
    localStorage.setItem('lz_auth', '1');
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('lz_auth');
    setIsAuthenticated(false);
  };

  return (
    <DataProvider>
      <BrowserRouter>
        <Routes>
          {!isAuthenticated ? (
            <>
              <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
          ) : (
            <>
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="/*" element={<MainLayout onLogout={handleLogout} />} />
            </>
          )}
        </Routes>
      </BrowserRouter>
    </DataProvider>
  );
}
