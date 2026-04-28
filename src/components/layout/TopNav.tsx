import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Bell, Settings, User, ChevronDown, LogOut, CircleUser as UserCircle, Sun, Moon, CheckCheck, Menu, MapPin, Crosshair } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { getEventTemporalPhase } from '../../utils/eventPhase';

export default function TopNav({ onMenuClick, onLogout }: { onMenuClick: () => void; onLogout: () => void }) {
  const { infraScenario, toasts, removeToast, markAllAsRead, theme, toggleTheme, selectedDisaster, setUnifiedDashboardRegion, addToast } = useData();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const statusStyles: Record<string, { container: string; dot: string; text: string }> = {
    Healthy: { container: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400', text: 'text-emerald-400' },
    Elevated: { container: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400', text: 'text-amber-400' },
    Warning: { container: 'bg-orange-500/10 border-orange-500/20', dot: 'bg-orange-400', text: 'text-orange-400' },
    Critical: { container: 'bg-rose-500/10 border-rose-500/20', dot: 'bg-rose-400', text: 'text-rose-400' },
  };
  const s = statusStyles[infraScenario.status] || statusStyles.Critical;

  const phase = selectedDisaster ? getEventTemporalPhase(selectedDisaster.Date) : null;

  return (
    <header className="glass border-b border-slate-700/30 px-5 py-2.5 flex flex-col gap-2 relative z-50">
      {selectedDisaster && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 -mt-0.5 mb-0.5">
          <Crosshair className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="text-[11px] text-slate-200 font-medium truncate">
            <span className="text-cyan-400/90 uppercase text-[9px] tracking-wider font-bold">{phase}</span>
            {' · '}
            {selectedDisaster.Disaster_Type}
            <MapPin className="w-3 h-3 inline mx-1 text-slate-500 align-middle" />
            {selectedDisaster.Location?.City}
          </span>
          <div className="flex flex-wrap gap-1.5 ml-auto">
            <button
              type="button"
              onClick={() => {
                const c = selectedDisaster.Location?.City;
                if (c) {
                  setUnifiedDashboardRegion(c);
                  addToast(`Filters set to ${c}`, 'info', '/analytics');
                }
              }}
              className="text-[9px] font-bold uppercase tracking-wide px-2 py-1 rounded-md bg-slate-800/80 text-cyan-300 border border-slate-600/50 hover:bg-slate-700/80 transition-colors"
            >
              Sync filters
            </button>
            <Link to="/" className="text-[9px] font-bold uppercase tracking-wide px-2 py-1 rounded-md bg-slate-800/80 text-slate-300 border border-slate-600/50 hover:bg-slate-700/80 transition-colors">
              Map
            </Link>
            <Link to="/analytics" className="text-[9px] font-bold uppercase tracking-wide px-2 py-1 rounded-md bg-slate-800/80 text-amber-300/90 border border-slate-600/50 hover:bg-slate-700/80 transition-colors">
              Analytics
            </Link>
            <Link to="/priority" className="text-[9px] font-bold uppercase tracking-wide px-2 py-1 rounded-md bg-slate-800/80 text-rose-300/90 border border-slate-600/50 hover:bg-slate-700/80 transition-colors">
              Priority
            </Link>
            <Link to="/leakages" className="text-[9px] font-bold uppercase tracking-wide px-2 py-1 rounded-md bg-slate-800/80 text-emerald-300/90 border border-slate-600/50 hover:bg-slate-700/80 transition-colors">
              Leakage
            </Link>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-slate-700/30 transition-colors text-slate-400"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center hidden sm:flex">
          <Shield className="w-4 h-4 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-xs sm:text-sm font-bold tracking-wider text-slate-100 uppercase">Latency Zero</h1>
          <p className="text-[10px] text-slate-500 hidden sm:block">Command Center</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Health Heartbeat */}
        <div className={`flex items-center gap-1.5 ${s.container} border rounded-full px-3 py-1`}>
          <div className={`w-2 h-2 rounded-full ${s.dot} animate-heartbeat`} />
          <span className={`text-[10px] ${s.text} font-mono font-medium`}>
            {infraScenario.status === 'Healthy' ? 'SYSTEMS NOMINAL' : infraScenario.status.toUpperCase()}
          </span>
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            className="relative p-2 rounded-lg hover:bg-slate-700/30 transition-colors"
            onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false); }}
          >
            <Bell className="w-4 h-4 text-slate-400" />
            {toasts.some(t => !t.isRead) && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
            )}
          </button>
          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className={`absolute right-0 top-full mt-2 z-[200] w-80 rounded-xl border shadow-2xl overflow-hidden backdrop-blur-xl ${
                  theme === 'light'
                    ? 'bg-white/95 border-slate-200/90'
                    : 'bg-slate-950/95 border-slate-700/60'
                }`}
              >
                <div className="px-3 py-2 border-b border-slate-700/30 flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-300">Notifications</span>
                  {toasts.length > 0 && (
                    <button onClick={markAllAsRead} className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                      <CheckCheck className="w-3 h-3" /> Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {toasts.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-slate-500">No notifications</div>
                  ) : (
                    toasts.map(t => (
                      <div key={t.id} className={`px-3 py-2 border-b border-slate-700/20 flex items-start gap-2 hover:bg-slate-700/20 transition-colors ${!t.isRead ? 'bg-cyan-500/5' : ''}`}>
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${t.type === 'success' ? 'bg-emerald-400' : t.type === 'warning' ? 'bg-amber-400' : 'bg-rose-400'} ${!t.isRead ? 'animate-pulse' : 'opacity-50'}`} />
                        <span className="text-[11px] text-slate-300 flex-1">{t.message}</span>
                        <button onClick={() => removeToast(t.id)} className="text-slate-600 hover:text-slate-400 text-xs">x</button>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-slate-700/30 transition-colors"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-slate-400" /> : <Moon className="w-4 h-4 text-slate-400" />}
        </button>

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-700/30 transition-colors"
            onClick={() => { setShowProfile(!showProfile); setShowNotifications(false); }}
          >
            <div className="w-7 h-7 rounded-full bg-slate-700/50 border border-slate-600/30 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>
          <AnimatePresence>
            {showProfile && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className={`absolute right-0 top-full mt-2 z-[200] w-56 rounded-xl border shadow-2xl overflow-hidden backdrop-blur-xl ${
                  theme === 'light'
                    ? 'bg-white/95 border-slate-200/90'
                    : 'bg-slate-950/95 border-slate-700/60'
                }`}
              >
                <div className="px-3 py-2 border-b border-slate-700/30">
                  <span className="text-xs font-semibold text-slate-300">Commander</span>
                  <p className="text-[10px] text-slate-500">admin@riskcenter.io</p>
                </div>
                <div className="py-1">
                  <button className="w-full px-3 py-2 flex items-center gap-2 text-xs text-slate-300 hover:bg-slate-700/20 transition-colors">
                    <UserCircle className="w-3.5 h-3.5" /> Profile Settings
                  </button>
                  <button className="w-full px-3 py-2 flex items-center gap-2 text-xs text-slate-300 hover:bg-slate-700/20 transition-colors">
                    <Settings className="w-3.5 h-3.5" /> System Config
                  </button>
                  <div className="border-t border-slate-700/30 my-1" />
                  <button
                    onClick={onLogout}
                    className="w-full px-3 py-2 flex items-center gap-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      </div>
    </header>
  );
}
