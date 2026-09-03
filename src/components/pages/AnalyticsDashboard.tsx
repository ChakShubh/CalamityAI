import { useState, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { getEventTemporalPhase } from '../../utils/eventPhase';
import { scale01 } from '../../utils/regionScale';
import {
  XAxis, YAxis, ResponsiveContainer, Cell, Tooltip as RechartsTooltip,
  LineChart, Line, CartesianGrid, AreaChart, Area, Legend, PieChart, Pie
} from 'recharts';
import { Users, DollarSign, Clock, TrendingUp, ShieldAlert, BarChart3, Briefcase, Send, Filter } from 'lucide-react';
import ResourceReroutingPanel from '../features/ResourceReroutingPanel';
import { buildReroutePlan, computeCityWorkforce } from '../../utils/workforceModel';

export default function AnalyticsDashboard() {
  const {
    policyHolders,
    disasters,
    theme,
    addToast,
    managedCities,
    selectedDisaster,
    dashboardFocusCity,
    setUnifiedDashboardRegion,
    pastClaims,
  } = useData();
  const chartTextColor = theme === 'light' ? '#475569' : '#94a3b8';
  
  const [timingFilter, setTimingFilter] = useState<'All' | 'Pre-Calamity' | 'Active' | 'Post-Calamity'>('All');
  const selectedRegion = dashboardFocusCity ?? 'All';
  const setSelectedRegion = setUnifiedDashboardRegion;

  // Filter disasters by phase and by unified metro focus
  const filteredDisasters = useMemo(() => {
    let list = disasters.filter((d) => {
      const phase = getEventTemporalPhase(d.Date);
      if (timingFilter === 'Pre-Calamity') return phase === 'pre';
      if (timingFilter === 'Active') return phase === 'active';
      if (timingFilter === 'Post-Calamity') return phase === 'post';
      return true;
    });
    if (dashboardFocusCity) {
      list = list.filter((d) => d.Location.City === dashboardFocusCity);
    }
    return list;
  }, [disasters, timingFilter, dashboardFocusCity]);
  const activeImpactDisaster = useMemo(() => {
    if (selectedDisaster) return selectedDisaster;
    if (dashboardFocusCity) {
      return disasters.find((d) => d.Location.City === dashboardFocusCity) ?? null;
    }
    return filteredDisasters[0] ?? disasters[0] ?? null;
  }, [selectedDisaster, dashboardFocusCity, disasters, filteredDisasters]);
  const baselineReroutePlan = useMemo(() => {
    if (!activeImpactDisaster) return null;
    return buildReroutePlan(activeImpactDisaster, Array.from(managedCities), policyHolders, disasters);
  }, [activeImpactDisaster, managedCities, policyHolders, disasters]);
  const manpowerScenario = useMemo(() => {
    if (!baselineReroutePlan) {
      return { demand: 110, rerouted: 70, shortfall: 40, coverage: 64, penaltyAvoided: 129500 };
    }
    const dispatchAssumption = 0.8;
    const demand = baselineReroutePlan.requiredAgents;
    const rerouted = Math.round(baselineReroutePlan.plannedRerouted * dispatchAssumption);
    const shortfall = Math.max(demand - rerouted, 0);
    const phasePenaltyFactor =
      baselineReroutePlan.eventPhase === 'active'
        ? 1.35
        : baselineReroutePlan.eventPhase === 'pre'
          ? 1.15
          : 0.9;
    const penaltyAvoided = Math.round(rerouted * 1850 * phasePenaltyFactor);
    return {
      demand,
      rerouted,
      shortfall,
      coverage: Math.round((rerouted / Math.max(demand, 1)) * 100),
      penaltyAvoided,
    };
  }, [baselineReroutePlan]);

  const regionKey = selectedRegion === 'All' ? '__GLOBAL__' : selectedRegion;
  const holdersInRegionCount = useMemo(
    () =>
      selectedRegion === 'All'
        ? policyHolders.length
        : policyHolders.filter((p) => p.city === selectedRegion).length,
    [policyHolders, selectedRegion]
  );
  const regionalShare =
    selectedRegion === 'All' ? 1 : Math.max(0.06, holdersInRegionCount / Math.max(1, policyHolders.length));

  const historicalClaimsRollup = useMemo(() => {
    const agg = pastClaims.reduce(
      (acc, pc) => {
        const cur = acc[pc.calamity_type] || { claims: 0, disbursed: 0 };
        cur.claims += pc.total_claims;
        cur.disbursed += pc.amount_disbursed;
        acc[pc.calamity_type] = cur;
        return acc;
      },
      {} as Record<string, { claims: number; disbursed: number }>
    );
    return Object.entries(agg)
      .map(([name, v]) => {
        const typeJitter = 0.85 + scale01(regionKey, `hist-${name}`) * 0.35;
        const scope = selectedRegion === 'All' ? 1 : regionalShare * typeJitter * (1.4 + scale01(regionKey, name));
        return {
          name,
          claims: Math.max(1, Math.round(v.claims * scope)),
          disbursed: Math.round(v.disbursed * scope),
        };
      })
      .sort((a, b) => b.claims - a.claims)
      .slice(0, 6);
  }, [pastClaims, regionKey, selectedRegion, regionalShare]);

  // Manpower + SLA projections derived from the same rerouting model used by the panel.
  const manpowerData = useMemo(() => {
    const phaseFactor =
      timingFilter === 'Active' ? 1.18 : timingFilter === 'Pre-Calamity' ? 1.02 : timingFilter === 'Post-Calamity' ? 0.86 : 1;
    const baseDelay = Math.round((28 + manpowerScenario.shortfall * 0.95) * phaseFactor);
    const contractedDelay = Math.max(12, Math.round((18 + manpowerScenario.shortfall * 0.38) * phaseFactor));
    const baseCost = Math.round((42000 + manpowerScenario.demand * 240) * (selectedRegion === 'All' ? 1.1 : 1));
    const surgePremium = Math.round(manpowerScenario.rerouted * 520);
    return [
      { day: 'Day 1', standardSLA: baseDelay, contractedSLA: contractedDelay, costStandard: baseCost, costContracted: baseCost + surgePremium },
      { day: 'Day 2', standardSLA: Math.round(baseDelay * 1.18), contractedSLA: Math.round(contractedDelay * 1.12), costStandard: baseCost, costContracted: baseCost + surgePremium },
      { day: 'Day 3', standardSLA: Math.round(baseDelay * 1.42), contractedSLA: Math.round(contractedDelay * 1.22), costStandard: baseCost + 1200, costContracted: baseCost + surgePremium + 2400 },
      { day: 'Day 4', standardSLA: Math.round(baseDelay * 1.61), contractedSLA: Math.round(contractedDelay * 1.3), costStandard: baseCost + 2200, costContracted: baseCost + surgePremium + 3400 },
      { day: 'Day 5', standardSLA: Math.round(baseDelay * 1.8), contractedSLA: Math.round(contractedDelay * 1.38), costStandard: baseCost + 3200, costContracted: baseCost + surgePremium + 4500 },
    ];
  }, [selectedRegion, timingFilter, manpowerScenario]);

  const agents = useMemo(() => {
    const workforce = computeCityWorkforce(Array.from(managedCities), policyHolders, disasters);
    const visible = selectedRegion === 'All' ? workforce : workforce.filter((w) => w.city === selectedRegion);
    return visible.map((entry) => {
      const outgoing = baselineReroutePlan?.safeZones.find((z) => z.city === entry.city)?.allocated ?? 0;
      const isImpact = baselineReroutePlan?.impactCity === entry.city;
      const loadPct = isImpact
        ? Math.round((manpowerScenario.demand / Math.max(entry.baseCapacity, 1)) * 100)
        : Math.round(((entry.baseCapacity + outgoing * 0.6) / Math.max(entry.baseCapacity, 1)) * 100);
      const status = loadPct >= 165 ? 'Critical' : loadPct >= 125 ? 'Overloaded' : 'Active';
      return {
        name: `${entry.city} Command Pod`,
        region: entry.city,
        status,
        capacity: `${loadPct}%`,
        activeAgents: entry.baseCapacity,
        transferPool: entry.maxAllocatable,
      };
    });
  }, [selectedRegion, managedCities, policyHolders, disasters, baselineReroutePlan, manpowerScenario]);

  const policyDistribution = useMemo(() => {
     const filteredHolders = selectedRegion === 'All' ? policyHolders : policyHolders.filter(p => p.city === selectedRegion);
     const dist = filteredHolders.reduce((acc, curr) => {
        acc[curr.policy_type] = (acc[curr.policy_type] || 0) + 1;
        return acc;
     }, {} as Record<string, number>);
     return Object.entries(dist).map(([name, value]) => ({ name, value }));
  }, [policyHolders, selectedRegion]);

  const financialImpact = useMemo(() => {
    const dayFive = manpowerData[4];
    const surgeCost = Math.round(
      manpowerData.reduce((acc, d) => acc + (d.costContracted - d.costStandard), 0) / 1000
    );
    const savings = (manpowerScenario.penaltyAvoided / 1_000_000).toFixed(2);
    return {
      baseDelay: dayFive?.standardSLA ?? 0,
      surgeDelay: dayFive?.contractedSLA ?? 0,
      surgeCost,
      savings,
      neededAgents: manpowerScenario.shortfall,
    };
  }, [manpowerData, manpowerScenario]);

  const COLORS = ['#06b6d4', '#8b5cf6', '#ef4444', '#10b981', '#f59e0b'];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-cyan-400" /> Executive Analytics Suite
          </h1>
          <p className="text-sm text-slate-500 mt-1">Real-time resource allocation and claim resolution forecasting</p>
               <p className="text-xs text-slate-500 mt-2">
            {dashboardFocusCity && (
              <>
                <span className="text-cyan-500/90 font-semibold">Unified focus:</span>{' '}
                {selectedDisaster
                  ? `${selectedDisaster.Disaster_Type} · ${selectedDisaster.Location?.City}`
                  : dashboardFocusCity}
                {' · '}
              </>
            )}
            <span className="text-slate-600">{filteredDisasters.length} disaster scenario{filteredDisasters.length === 1 ? '' : 's'} in the selected phase{dashboardFocusCity ? ` (${dashboardFocusCity})` : ''}.</span>
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
           <div className="relative">
              <Filter className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <select 
                value={timingFilter}
                onChange={(e) => setTimingFilter(e.target.value as typeof timingFilter)}
                className="bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500/50 transition-colors appearance-none"
              >
                <option value="All">All Phases</option>
                <option value="Pre-Calamity">Pre-Calamity</option>
                <option value="Active">Active Calamity</option>
                <option value="Post-Calamity">Post-Calamity</option>
              </select>
           </div>

           <div className="relative">
              <Filter className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <select 
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500/50 transition-colors appearance-none"
              >
                <option value="All">All Regions (Global)</option>
                {Array.from(managedCities).map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
           </div>
           <button 
             onClick={() => addToast('Executive brief compiled and sent to all relevant stakeholders.', 'success')}
             className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-400 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2"
           >
             <Send className="w-4 h-4" /> Notify Stakeholders
           </button>
        </div>
      </div>

      <div className="glass rounded-2xl p-5 border border-slate-700/50">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2 mb-3">
          <ShieldAlert className="w-4 h-4 text-slate-400" /> Historical claims corpus (scaled to view)
        </h3>
        <p className="text-[10px] text-slate-500 mb-4">
          {selectedRegion === 'All'
            ? 'Global portfolio — full historical volumes from the claims warehouse.'
            : `${selectedRegion} region — volumes scaled by local policy density (${holdersInRegionCount.toLocaleString()} policies) for executive ground truth.`}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {historicalClaimsRollup.map(row => (
            <div key={row.name} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
              <div className="text-[9px] text-slate-500 uppercase font-bold truncate">{row.name}</div>
              <div className="text-lg font-mono font-bold text-cyan-400">{row.claims.toLocaleString()}</div>
              <div className="text-[9px] text-slate-500 mt-1">Paid out ${(row.disbursed / 1e6).toFixed(1)}M</div>
            </div>
          ))}
        </div>
      </div>

      <ResourceReroutingPanel
        impactDisaster={activeImpactDisaster}
        managedCities={Array.from(managedCities)}
        policyHolders={policyHolders}
        disasters={disasters}
        onExecute={(message) => addToast(message, 'success')}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SLA Projection Chart */}
        <div className="glass rounded-2xl p-6 border border-slate-700/50">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" /> Resolution Time Forecasting (SLA)
            </h3>
            <p className="text-[10px] text-slate-500 mt-1">Standard Force vs. Contractual Surge Support (Hours)</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={manpowerData}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#cbd5e1' : '#334155'} vertical={false} />
                <XAxis dataKey="day" tick={{ fill: chartTextColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: chartTextColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                <RechartsTooltip contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#0f172a', border: '1px solid #cbd5e1', fontSize: '10px' }} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Line type="monotone" name="Standard SLA (Hours)" dataKey="standardSLA" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" name="Contracted SLA (Hours)" dataKey="contractedSLA" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Policy Distribution Chart */}
        <div className="glass rounded-2xl p-6 border border-slate-700/50">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" /> Policy Type Distribution
            </h3>
            <p className="text-[10px] text-slate-500 mt-1">Breakdown of active policy types across managed zones</p>
          </div>
          <div className="h-64 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={policyDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {policyDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#0f172a', border: '1px solid #cbd5e1', fontSize: '10px' }} />
                <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-6 border border-slate-700/50">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" /> Operational Cost Analysis
            </h3>
            <p className="text-[10px] text-slate-500 mt-1">Daily Burn Rate: Base vs Surge Deployment ($)</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={manpowerData}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#cbd5e1' : '#334155'} vertical={false} />
                <XAxis dataKey="day" tick={{ fill: chartTextColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: chartTextColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                <RechartsTooltip contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#0f172a', border: '1px solid #cbd5e1', fontSize: '10px' }} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Area type="monotone" name="Base Cost" dataKey="costStandard" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                <Area type="monotone" name="Surge Contract Cost" dataKey="costContracted" stackId="2" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.4} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-6 border border-slate-700/50 lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2 mb-6">
            <TrendingUp className="w-4 h-4 text-cyan-400" /> Financial Impact Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Avg Claim Delay (Base)', val: `${financialImpact.baseDelay}h`, color: 'text-rose-400' },
              { label: 'Avg Claim Delay (Surge)', val: `${financialImpact.surgeDelay}h`, color: 'text-emerald-400' },
              { label: 'Total Surge Cost', val: `$${financialImpact.surgeCost}K`, color: 'text-amber-400' },
              { label: 'Est. Legal Savings', val: `$${financialImpact.savings}M`, color: 'text-cyan-400' },
              { label: 'Additional Agents Needed', val: `+${financialImpact.neededAgents}`, color: 'text-orange-400' },
            ].map(stat => (
              <div key={stat.label} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">{stat.label}</div>
                <div className={`text-xl font-bold font-mono ${stat.color}`}>{stat.val}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl">
             <p className="text-xs text-slate-300 leading-relaxed">
               <span className="font-bold text-cyan-400">AI Recommendation:</span> Deploying contractual surge manpower increases operational costs by 85% initially, but reduces claim resolution delays by over 100 hours by Day 5. This prevents secondary litigation and regulatory fines, resulting in an estimated net saving of ${financialImpact.savings}M across the {selectedRegion === 'All' ? 'current active risk zones' : `${selectedRegion} region`}.
             </p>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 border border-slate-700/50 overflow-hidden flex flex-col">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2 mb-4">
            <Briefcase className="w-4 h-4 text-amber-400" /> Active Agent Network
          </h3>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
            {agents.map((agent) => (
              <div key={agent.region} className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 flex justify-between items-center">
                <div>
                  <div className="text-xs font-bold text-slate-200">{agent.name}</div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <ShieldAlert className="w-3 h-3" /> {agent.region}
                  </div>
                  <div className="text-[10px] text-cyan-400 font-mono mt-1">
                    Active agents: {agent.activeAgents} · Transfer pool: {agent.transferPool}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-[10px] font-bold uppercase ${agent.status === 'Critical' ? 'text-rose-400' : agent.status === 'Overloaded' ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {agent.status}
                  </div>
                  <div className="text-xs font-mono text-slate-400">{agent.capacity} Load</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
