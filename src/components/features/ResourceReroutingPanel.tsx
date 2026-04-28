import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRightLeft, ShieldCheck, TrendingDown, AlertTriangle } from 'lucide-react';
import type { DisasterEvent, PolicyHolder } from '../../context/DataContext';
import { buildReroutePlan } from '../../utils/workforceModel';

type Props = Readonly<{
  impactDisaster: DisasterEvent | null;
  managedCities: string[];
  policyHolders: PolicyHolder[];
  disasters: DisasterEvent[];
  onExecute: (message: string) => void;
}>;

export default function ResourceReroutingPanel({
  impactDisaster,
  managedCities,
  policyHolders,
  disasters,
  onExecute,
}: Props) {
  const [dispatchPercent, setDispatchPercent] = useState(80);

  const plan = useMemo(() => {
    if (!impactDisaster) return null;
    return buildReroutePlan(impactDisaster, managedCities, policyHolders, disasters);
  }, [impactDisaster, managedCities, policyHolders, disasters]);

  const simulation = useMemo(() => {
    if (!plan) return null;
    const multiplier = dispatchPercent / 100;
    const rerouted = Math.round(plan.plannedRerouted * multiplier);
    const unmet = Math.max(plan.requiredAgents - rerouted, 0);
    const phasePenaltyFactor = plan.eventPhase === 'active' ? 1.35 : plan.eventPhase === 'pre' ? 1.15 : 0.9;
    const penaltyPerAgent = 1850;
    const penaltyAvoided = Math.round(rerouted * penaltyPerAgent * phasePenaltyFactor);
    const residualRisk = Math.round(unmet * penaltyPerAgent * phasePenaltyFactor);
    const coveragePct = Math.round((rerouted / Math.max(plan.requiredAgents, 1)) * 100);
    return { rerouted, unmet, penaltyAvoided, residualRisk, coveragePct };
  }, [plan, dispatchPercent]);

  if (!plan || !simulation) {
    return (
      <div className="glass rounded-2xl border border-slate-700/50 p-6 bg-gray-900/70 backdrop-blur-md">
        <div className="text-xs uppercase tracking-[0.2em] text-cyan-400 font-bold">Pre-emptive Resource Re-routing</div>
        <div className="mt-4 text-sm text-slate-400">Awaiting active crisis signal...</div>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl border border-cyan-500/25 p-6 bg-gray-900/80 backdrop-blur-md ring-1 ring-cyan-500/20">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-400 font-bold">Pre-emptive Resource Re-routing</div>
          <div className="mt-2 text-slate-100 font-semibold">
            Impact Zone: {plan.impactCity} ({plan.eventLabel})
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Required surge capacity: <span className="text-slate-200 font-mono">{plan.requiredAgents} agents</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 min-w-[260px]">
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-400">Rerouted</div>
            <div className="text-xl font-mono font-bold text-emerald-400">{simulation.rerouted}</div>
          </div>
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-400">Unmet</div>
            <div className="text-xl font-mono font-bold text-rose-400">{simulation.unmet}</div>
          </div>
          <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-3 col-span-2">
            <div className="text-[10px] uppercase tracking-widest text-slate-400">SLA Penalty Avoided</div>
            <div className="text-xl font-mono font-bold text-cyan-300">${simulation.penaltyAvoided.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Dispatch Intensity</span>
          <span className="font-mono text-cyan-300">{dispatchPercent}%</span>
        </div>
        <input
          type="range"
          min={35}
          max={100}
          step={5}
          value={dispatchPercent}
          onChange={(e) => setDispatchPercent(Number(e.target.value))}
          className="w-full mt-2 accent-cyan-500"
        />
        <div className="mt-2 h-2 rounded-full bg-slate-800 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400"
            animate={{ width: `${simulation.coveragePct}%` }}
            transition={{ type: 'spring', stiffness: 90, damping: 18 }}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        {plan.safeZones.map((zone) => {
          const effectiveAllocated = Math.round(zone.allocated * (dispatchPercent / 100));
          return (
            <div key={zone.city} className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-200">{zone.city}</div>
                <div className="text-[10px] uppercase text-slate-500 tracking-widest">{zone.phase}</div>
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Capacity {zone.baseCapacity} · Max transferable {zone.maxAllocatable}
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-800 overflow-hidden">
                <motion.div
                  className="h-full bg-cyan-400"
                  animate={{ width: `${Math.round((effectiveAllocated / Math.max(zone.baseCapacity, 1)) * 100)}%` }}
                  transition={{ type: 'spring', stiffness: 90, damping: 16 }}
                />
              </div>
              <div className="mt-2 text-xs text-cyan-300 font-mono">{effectiveAllocated} agents rerouted</div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={() =>
            onExecute(
              `Countermeasure deployed: rerouted ${simulation.rerouted} agents into ${plan.impactCity}. Estimated SLA penalty avoided $${simulation.penaltyAvoided.toLocaleString()}.`
            )
          }
          className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2"
        >
          <ArrowRightLeft className="w-4 h-4" />
          Execute Re-routing Plan
        </button>
        <div className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Coverage: {simulation.coveragePct}%
        </div>
        <div className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-cyan-300" />
          Residual risk: ${simulation.residualRisk.toLocaleString()}
        </div>
        {simulation.unmet > 0 && (
          <div className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            External reserve still needed: {simulation.unmet} agents
          </div>
        )}
      </div>
    </div>
  );
}
