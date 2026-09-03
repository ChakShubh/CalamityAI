import { NavLink } from 'react-router-dom';
import { Radio, FlaskConical, Server, ChevronLeft, ChevronRight, Newspaper, BarChart3, ShieldAlert, ClipboardList, BrainCircuit } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const sections = [
  {
    title: 'Intelligence',
    links: [
      { to: '/', icon: Radio, label: 'Live Intelligence' },
      { to: '/news', icon: Newspaper, label: 'News Analytics Hub' },
    ]
  },
  {
    title: 'Simulation',
    links: [
      { to: '/simulator', icon: FlaskConical, label: 'Crisis Simulator' },
      { to: '/infrastructure', icon: Server, label: 'Infrastructure Resilience' },
    ]
  },
  {
    title: 'Operations',
    links: [
      { to: '/analytics', icon: BarChart3, label: 'Executive Operations Suite' },
      { to: '/priority', icon: ClipboardList, label: 'High Priority Cases' },
      { to: '/leakages', icon: ShieldAlert, label: 'Leakage Control' },
    ]
  },
  {
    title: 'Predictions',
    links: [
      { to: '/recommender', icon: BrainCircuit, label: 'Policy Recommender' },
    ]
  }
];

export default function Sidebar({ mobileOpen, setMobileOpen }: { mobileOpen: boolean; setMobileOpen: (o: boolean) => void }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-[70] 
        glass border-r border-slate-700/30 flex flex-col py-3 transition-all duration-300
        ${mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
        ${collapsed ? 'lg:w-14' : 'lg:w-48'}
      `}>
        <div className="flex items-center justify-between px-4 mb-4 lg:hidden">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Navigation</span>
          <button onClick={() => setMobileOpen(false)} className="text-slate-500">x</button>
        </div>
      <nav className="flex-1 space-y-4 px-2 overflow-y-auto custom-scrollbar">
        {sections.map(section => (
          <div key={section.title} className="space-y-1">
            {!collapsed && (
              <h3 className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 opacity-60">
                {section.title}
              </h3>
            )}
            {section.links.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 group ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                      : 'text-slate-400 hover:bg-slate-700/30 hover:text-slate-200 border border-transparent'
                  }`
                }
              >
                <link.icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span className="truncate">{link.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mx-2 p-1.5 rounded-lg hover:bg-slate-700/30 transition-colors text-slate-500 hover:text-slate-300"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
    </>
  );
}
