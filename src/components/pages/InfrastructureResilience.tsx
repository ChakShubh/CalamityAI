import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area, CartesianGrid } from 'recharts';
import { Server, Activity, Cpu, Wifi, AlertTriangle, Zap, Terminal, ArrowRight, AlertCircle, TrendingUp } from 'lucide-react';
import { useData, InfraHealth } from '../../context/DataContext';

function PressureGauge({ pressure }: { pressure: number }) {
  const clampedPressure = Math.min(100, Math.max(0, pressure));
  const circumference = 2 * Math.PI * 60;
  const arcLength = circumference * 0.75;
  const offset = arcLength - (clampedPressure / 100) * arcLength;
  const rotation = -225;

  const color = clampedPressure > 75 ? '#f43f5e' : clampedPressure > 50 ? '#f59e0b' : '#06b6d4';
  const label = clampedPressure > 75 ? 'CRITICAL' : clampedPressure > 50 ? 'ELEVATED' : 'NOMINAL';

  return (
    <div className="flex flex-col items-center">
      <svg width="200" height="140" viewBox="0 0 120 85">
        <circle cx="60" cy="65" r="60" fill="none" stroke="rgba(51,65,85,0.2)" strokeWidth="8"
          strokeDasharray={`${arcLength} ${circumference * 0.25}`}
          strokeLinecap="round"
          transform={`rotate(${rotation} 60 65)`}
        />
        <motion.circle
          cx="60" cy="65" r="60" fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${arcLength} ${circumference * 0.25}`}
          strokeLinecap="round"
          transform={`rotate(${rotation} 60 65)`}
          initial={{ strokeDashoffset: arcLength }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 8px ${color}40)` }}
        />
      </svg>
      <div className="-mt-8 text-center">
        <motion.span className="text-3xl font-bold font-mono" style={{ color }}
          key={Math.round(clampedPressure)}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
        >
          {Math.round(clampedPressure)}
        </motion.span>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">System Pressure Index</div>
        <span className="text-[10px] font-mono font-bold mt-1 inline-block px-2 py-0.5 rounded"
          style={{ color, backgroundColor: `${color}15` }}>
          {label}
        </span>
      </div>
    </div>
  );
}

function TerminalWindow({ scenario }: { scenario: InfraHealth }) {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const initial = [
      `[${new Date().toISOString()}] SYSMON v3.2.1 initialized`,
      `[${new Date().toISOString()}] Region: ${scenario.region}`,
      `[${new Date().toISOString()}] Server Load: ${scenario.server_load}%`,
      `[${new Date().toISOString()}] Bandwidth: ${scenario.bandwidth_utilization}%`,
      `[${new Date().toISOString()}] Adjusters: ${scenario.adjusters_available} available`,
      `[${new Date().toISOString()}] API Latency: ${scenario.api_latency_ms}ms`,
      `[${new Date().toISOString()}] Status: ${scenario.status}`,
    ];
    setLines(initial);

    const interval = setInterval(() => {
      const now = new Date().toISOString();
      const msgs = [
        `HEALTH_CHECK -- node-${Math.floor(Math.random() * 20)}.cluster OK`,
        `METRIC -- cpu_usage=${scenario.server_load + Math.floor(Math.random() * 5 - 2)}% mem=${scenario.bandwidth_utilization + Math.floor(Math.random() * 3)}%`,
        `REQUEST -- /api/v1/claims batch=${Math.floor(Math.random() * 50)} latency=${scenario.api_latency_ms + Math.floor(Math.random() * 20)}ms`,
        `POOL -- adjusters_active=${Math.max(0, scenario.adjusters_available - Math.floor(Math.random() * 5))} queued=${Math.floor(Math.random() * 10)}`,
        `ALERT -- ${scenario.status === 'Critical' ? 'Rate limit threshold approaching' : 'Throughput nominal'}`,
        `SYNC -- replication_lag=${Math.floor(Math.random() * 5)}ms`,
      ];
      const msg = msgs[Math.floor(Math.random() * msgs.length)];
      setLines(prev => [...prev.slice(-20), `[${now}] ${msg}`]);
    }, 2000);

    return () => clearInterval(interval);
  }, [scenario]);

  return (
    <div className="glass-light rounded-xl overflow-hidden h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/30">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
        </div>
        <span className="text-[10px] text-slate-500 font-mono ml-2">sysmon@riskcenter ~</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 font-mono text-[10px] leading-relaxed bg-black/30">
        {lines.map((line, i) => (
          <div key={i} className="text-slate-400">
            {line.includes('ALERT') || line.includes('CRITICAL') ? (
              <span className="text-rose-400">{line}</span>
            ) : line.includes('OK') ? (
              <span className="text-emerald-400">{line}</span>
            ) : (
              <span>{line}</span>
            )}
          </div>
        ))}
        <span className="text-cyan-400 animate-terminal-cursor">_</span>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-light rounded-lg px-3 py-2 border border-slate-700/30">
        <p className="text-[10px] text-slate-400">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-xs font-mono" style={{ color: p.color }}>{p.name}: {p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function InfrastructureResilience() {
  const { infraScenario } = useData();

  // Pressure = ((PredictedSurge / AdjustersAvailable) * 0.7) + ((ServerLoad + (api_latency_ms / 10)) * 0.3)
  const predictedSurge = infraScenario.server_load * 1.2;
  const pressure = useMemo(() => {
    const adjusters = Math.max(1, infraScenario.adjusters_available);
    const surgeComponent = (predictedSurge / adjusters) * 0.7;
    const infraComponent = ((infraScenario.server_load + (infraScenario.api_latency_ms / 10)) / 100) * 0.3;
    return Math.min(100, (surgeComponent + infraComponent) * 100);
  }, [infraScenario, predictedSurge]);

  const barData = [
    { name: 'Server Load', value: infraScenario.server_load, fill: infraScenario.server_load > 80 ? '#f43f5e' : infraScenario.server_load > 50 ? '#f59e0b' : '#06b6d4', desc: 'Current CPU and Memory utilization across core infrastructure.' },
    { name: 'Bandwidth', value: infraScenario.bandwidth_utilization, fill: infraScenario.bandwidth_utilization > 80 ? '#f43f5e' : infraScenario.bandwidth_utilization > 50 ? '#f59e0b' : '#06b6d4', desc: 'Network throughput usage. High values indicate data congestion.' },
    { name: 'Latency (norm)', value: Math.min(100, infraScenario.api_latency_ms / 15), fill: infraScenario.api_latency_ms > 500 ? '#f43f5e' : infraScenario.api_latency_ms > 200 ? '#f59e0b' : '#06b6d4', desc: 'API Response time normalized to 100. Higher means slower performance.' },
    { name: 'DB Conns', value: Math.min(100, infraScenario.server_load * 1.3), fill: infraScenario.server_load > 70 ? '#f43f5e' : '#06b6d4', desc: 'Database connection pool utilization.' },
    { name: 'Queue Depth', value: Math.min(100, infraScenario.api_latency_ms / 10), fill: infraScenario.api_latency_ms > 400 ? '#f43f5e' : '#f59e0b', desc: 'Message queue depth for async processing.' },
  ];

  const forecastData = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => {
       const hour = `T+${i*2}h`;
       const base = infraScenario.server_load;
       const surgeEffect = (predictedSurge - base) * (i / 11);
       return {
         time: hour,
         load: Math.min(100, Math.round(base + surgeEffect + (Math.random() * 10 - 5)))
       };
    });
  }, [infraScenario.server_load, predictedSurge]);


  const orchestrationActions = pressure > 60 ? [
    { label: 'Route Tier-1 to AI Chatbot', desc: 'Offload low-priority claims to automated processing to reduce server load.', icon: <Cpu className="w-4 h-4" /> },
    { label: 'Trigger Cloud Auto-Scaling', desc: `Provision ${Math.max(1, Math.round(predictedSurge / 25))} additional compute nodes to handle the predicted surge.`, icon: <Zap className="w-4 h-4" /> },
    { label: 'Activate Emergency Adjusters', desc: 'Deploy reserve adjuster pool from adjacent regions.', icon: <AlertTriangle className="w-4 h-4" /> },
  ] : [
    { label: 'Optimize Database Indices', desc: 'Run background optimization tasks while load is nominal.', icon: <Server className="w-4 h-4" /> }
  ];

  return (
    <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden pr-2">
      <div className="glass rounded-2xl p-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-semibold tracking-wider uppercase text-slate-300">Infrastructure Resilience</h2>
        </div>
        <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">Scenario: {infraScenario.scenario_id.replace(/_/g, ' ')}</span>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 overflow-y-auto lg:overflow-hidden p-1 custom-scrollbar">
        {/* Left: Gauge + Bar charts */}
        <div className="w-full lg:w-[340px] flex-shrink-0 flex flex-col gap-3">
          {/* Pressure Gauge */}
          <div className="glass rounded-2xl p-4 flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-slate-300 font-semibold uppercase tracking-wider">System Pressure</span>
            </div>
            <PressureGauge pressure={pressure} />
          </div>

          {/* Bar Charts */}
          <div className="glass rounded-2xl p-4 flex-1 min-h-[300px] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Resource Metrics</span>
              </div>
              <div className="group relative">
                <AlertCircle className="w-3 h-3 text-slate-600 cursor-help" />
                <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-900 border border-slate-700 rounded-lg text-[8px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                  Higher values (80+) indicate system stress or critical utilization levels.
                </div>
              </div>
            </div>
            <div className="flex-1 min-h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} barSize={28}>
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} fillOpacity={0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {barData.map(item => (
                <div key={item.name} className="text-[9px] text-slate-500 border-l-2 pl-2 border-slate-700/50">
                  <span className="font-bold text-slate-400 uppercase">{item.name}:</span> {item.desc}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Terminal & Forecast */}
        <div className="flex-1 glass rounded-2xl p-4 flex flex-col min-h-[400px] lg:min-h-0">
          <div className="flex items-center gap-2 mb-3">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-300 font-semibold uppercase tracking-wider">Live System Monitor</span>
            <span className={`text-[10px] font-mono ml-auto px-2 py-0.5 rounded ${
              infraScenario.status === 'Healthy' ? 'bg-emerald-500/10 text-emerald-400' :
              infraScenario.status === 'Elevated' ? 'bg-amber-500/10 text-amber-400' :
              infraScenario.status === 'Warning' ? 'bg-orange-500/10 text-orange-400' :
              'bg-rose-500/10 text-rose-400'
            }`}>
              {infraScenario.status.toUpperCase()}
            </span>
          </div>
          <div className="h-48 min-h-0 mb-4">
            <TerminalWindow scenario={infraScenario} />
          </div>

          <div className="flex items-center gap-2 mb-3 pt-2 border-t border-slate-700/50">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-slate-300 font-semibold uppercase tracking-wider">24h Surge Forecast</span>
          </div>
          <div className="flex-1 min-h-[120px]">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={forecastData}>
                 <defs>
                   <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor={pressure > 60 ? "#f43f5e" : "#06b6d4"} stopOpacity={0.3}/>
                     <stop offset="95%" stopColor={pressure > 60 ? "#f43f5e" : "#06b6d4"} stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                 <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                 <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={30} />
                 <Tooltip content={<CustomTooltip />} />
                 <Area type="monotone" dataKey="load" stroke={pressure > 60 ? "#f43f5e" : "#06b6d4"} fillOpacity={1} fill="url(#colorLoad)" />
               </AreaChart>
             </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Orchestration */}
        <div className="w-full lg:w-[240px] flex-shrink-0 glass rounded-2xl p-4 flex flex-col min-h-[300px] lg:min-h-0">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-slate-300 font-semibold uppercase tracking-wider">AI Mitigation Actions</span>
          </div>

          <div className="mb-4 p-3 bg-slate-900/50 rounded-xl border border-slate-800">
             <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Predicted Surge (24h)</div>
             <div className={`text-2xl font-mono font-bold ${predictedSurge > 80 ? 'text-rose-400' : predictedSurge > 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                +{Math.round(predictedSurge)}% Traffic
             </div>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
            {orchestrationActions.map((action, i) => (
              <motion.div
                key={action.label}
                className={`glass-light rounded-xl p-3 border ${pressure > 60 ? 'border-rose-500/20 hover:bg-rose-500/5' : 'border-emerald-500/20 hover:bg-emerald-500/5'} cursor-pointer transition-all group`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15 }}
                  whileHover={{ x: 4 }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-rose-400">{action.icon}</span>
                    <span className="text-[11px] font-bold text-slate-200 uppercase tracking-tighter">{action.label}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">{action.desc}</p>
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-rose-400 group-hover:text-rose-300">
                    <span>Execute</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </motion.div>
              ))}

              <div className="glass-light rounded-xl p-3 border border-cyan-500/30">
                 <div className="flex items-center gap-2 mb-2 border-b border-slate-700/50 pb-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-tighter">AI Ops Agent</span>
                 </div>
                 <div className="text-[10px] text-slate-300 font-mono mb-2">
                    <span className="text-cyan-400">Agent:</span> High queue depth detected. Would you like me to auto-resolve Tier 1 claims?
                 </div>
                 <button className="w-full py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded text-[9px] font-bold uppercase transition-colors">
                    Enable Auto-Resolve
                 </button>
              </div>
            </div>

          {/* Quick stats */}
          <div className="mt-3 pt-3 border-t border-slate-700/30 space-y-2">
            {[
              { label: 'Adjusters', value: infraScenario.adjusters_available, color: infraScenario.adjusters_available < 20 ? 'text-rose-400' : 'text-emerald-400' },
              { label: 'API Latency', value: `${infraScenario.api_latency_ms}ms`, color: infraScenario.api_latency_ms > 500 ? 'text-rose-400' : infraScenario.api_latency_ms > 200 ? 'text-amber-400' : 'text-emerald-400' },
              { label: 'Server Load', value: `${infraScenario.server_load}%`, color: infraScenario.server_load > 80 ? 'text-rose-400' : infraScenario.server_load > 50 ? 'text-amber-400' : 'text-emerald-400' },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500">{s.label}</span>
                <span className={`text-xs font-mono font-bold ${s.color}`}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
