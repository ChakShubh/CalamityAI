import { useMemo, useState } from 'react';
import { BrainCircuit, Sparkles, ShieldCheck, MapPin } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { getEventTemporalPhase } from '../../utils/eventPhase';
import masterPolicies from '../../data/master_policy_types.json';
import recommenderModel from '../../data/recommender_model.json';

type MasterPolicy = {
  policy_type: string;
  description: string;
  ideal_for: string;
  primary_covers: string[];
  typical_cover_min: number;
  typical_cover_max: number;
};

type FormState = {
  fullName: string;
  city: string;
  occupancy: 'owner' | 'renter' | 'business';
  age: number;
  annualIncome: number;
  propertyValue: number;
  vehicleValue: number;
  businessAssetValue: number;
  dependents: number;
};

type RecommenderModel = {
  features: string[];
  intercepts: Record<string, number>;
  weights: Record<string, number[]>;
};

const POLICIES = masterPolicies as MasterPolicy[];

const CALAMITY_TO_SIGNAL: Record<string, string> = {
  Hurricane: 'storm',
  Flood: 'flood',
  Earthquake: 'quake',
  Wildfire: 'fire',
  Tsunami: 'flood',
  Blizzard: 'storm',
  Heatwave: 'health',
};

const POLICY_RELEVANCE: Record<string, Record<string, number>> = {
  Homeowners: { storm: 1.3, flood: 1.4, quake: 1.2, fire: 1.2, health: 0.3 },
  Renters: { storm: 1.0, flood: 1.1, quake: 0.9, fire: 1.0, health: 0.25 },
  'Commercial Property': { storm: 1.15, flood: 1.2, quake: 1.25, fire: 1.3, health: 0.35 },
  Auto: { storm: 1.1, flood: 1.25, quake: 0.75, fire: 0.8, health: 0.2 },
  'Flood Premium': { storm: 1.2, flood: 1.55, quake: 0.6, fire: 0.5, health: 0.2 },
  Life: { storm: 0.55, flood: 0.6, quake: 0.75, fire: 0.65, health: 1.1 },
  Health: { storm: 0.5, flood: 0.6, quake: 0.7, fire: 0.7, health: 1.35 },
};

const MODEL = recommenderModel as RecommenderModel;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function sigmoid(x: number) {
  return 1 / (1 + Math.exp(-x));
}

export default function PolicyRecommender() {
  const { pastClaims, disasters, policyHolders, managedCities, theme } = useData();

  const [form, setForm] = useState<FormState>({
    fullName: '',
    city: 'Mumbai',
    occupancy: 'owner',
    age: 34,
    annualIncome: 120000,
    propertyValue: 300000,
    vehicleValue: 80000,
    businessAssetValue: 250000,
    dependents: 2,
  });

  const cityOptions = useMemo(() => Array.from(managedCities).sort(), [managedCities]);

  const claimStatsByCalamity = useMemo(() => {
    const grouped = new Map<string, { rows: number; claimRate: number; avgLoss: number; affectedRate: number }>();
    for (const row of pastClaims) {
      const key = row.calamity_type;
      const cur = grouped.get(key) || { rows: 0, claimRate: 0, avgLoss: 0, affectedRate: 0 };
      const claimRate = row.total_claims / Math.max(1, row.total_policies);
      const avgLoss = row.amount_applied / Math.max(1, row.total_claims);
      const affectedRate = row.affected_individuals / Math.max(1, row.total_policies);
      cur.rows += 1;
      cur.claimRate += claimRate;
      cur.avgLoss += avgLoss;
      cur.affectedRate += affectedRate;
      grouped.set(key, cur);
    }
    const out = new Map<string, { claimRate: number; avgLoss: number; affectedRate: number }>();
    grouped.forEach((v, k) => {
      out.set(k, {
        claimRate: v.claimRate / v.rows,
        avgLoss: v.avgLoss / v.rows,
        affectedRate: v.affectedRate / v.rows,
      });
    });
    return out;
  }, [pastClaims]);

  const cityActivity = useMemo(() => {
    const rows = disasters.filter((d) => d.Location.City === form.city);
    const phaseWeight = (phase: 'pre' | 'active' | 'post') => {
      if (phase === 'active') return 1.25;
      if (phase === 'pre') return 0.9;
      return 0.55;
    };
    const signals = { storm: 0, flood: 0, quake: 0, fire: 0, health: 0 };
    for (const d of rows) {
      const phase = getEventTemporalPhase(d.Date);
      const signal = CALAMITY_TO_SIGNAL[d.Disaster_Type] || 'storm';
      signals[signal as keyof typeof signals] += phaseWeight(phase) * d.Magnitude;
    }
    return signals;
  }, [disasters, form.city]);

  const policyPriors = useMemo(() => {
    const rows = policyHolders.filter((p) => p.city === form.city);
    const total = Math.max(1, rows.length);
    const dist: Record<string, number> = {};
    rows.forEach((p) => {
      dist[p.policy_type] = (dist[p.policy_type] || 0) + 1;
    });
    Object.keys(dist).forEach((k) => {
      dist[k] = dist[k] / total;
    });
    return dist;
  }, [policyHolders, form.city]);

  const recommendations = useMemo(() => {
    const commonFeatureVector = {
      hazard_storm: clamp(cityActivity.storm / 8, 0, 2),
      hazard_flood: clamp(cityActivity.flood / 8, 0, 2),
      hazard_quake: clamp(cityActivity.quake / 8, 0, 2),
      hazard_fire: clamp(cityActivity.fire / 8, 0, 2),
      hazard_health: clamp(cityActivity.health / 8, 0, 2),
      fit_owner: form.occupancy === 'owner' ? 1 : 0,
      fit_renter: form.occupancy === 'renter' ? 1 : 0,
      fit_business: form.occupancy === 'business' ? 1 : 0,
      age_norm: clamp(form.age / 100, 0, 1.2),
      income_norm: clamp(form.annualIncome / 500000, 0, 2),
      property_norm: clamp(form.propertyValue / 2000000, 0, 2),
      vehicle_norm: clamp(form.vehicleValue / 300000, 0, 2),
      business_norm: clamp(form.businessAssetValue / 3000000, 0, 2),
      dependents_norm: clamp(form.dependents / 6, 0, 1),
    };

    const scored = POLICIES.map((p) => {
      const rel = POLICY_RELEVANCE[p.policy_type] || {};
      const hazardRaw =
        (cityActivity.storm || 0) * (rel.storm || 0) +
        (cityActivity.flood || 0) * (rel.flood || 0) +
        (cityActivity.quake || 0) * (rel.quake || 0) +
        (cityActivity.fire || 0) * (rel.fire || 0) +
        (cityActivity.health || 0) * (rel.health || 0);

      let customerFit = 0.5;
      if (p.policy_type === 'Homeowners' && form.occupancy === 'owner') customerFit += 0.45;
      if (p.policy_type === 'Renters' && form.occupancy === 'renter') customerFit += 0.5;
      if (p.policy_type === 'Commercial Property' && form.occupancy === 'business') customerFit += 0.55;
      if (p.policy_type === 'Auto' && form.vehicleValue > 15000) customerFit += 0.35;
      if (p.policy_type === 'Life') customerFit += clamp((form.dependents * 0.12) + (form.annualIncome / 600000), 0, 0.6);
      if (p.policy_type === 'Health') customerFit += clamp((form.age / 120) + (form.dependents * 0.08), 0, 0.5);
      if (p.policy_type === 'Flood Premium' && ['Mumbai', 'Jakarta', 'Miami'].includes(form.city)) customerFit += 0.42;

      const prior = policyPriors[p.policy_type] ?? 0.03;
      const hazardNorm = clamp(hazardRaw / 16, 0, 1.6);
      const algoScore = 0.34 * hazardNorm + 0.28 * customerFit + 0.38 * clamp(prior * 3, 0, 1.4);

      // ML probability from exported Python logistic model (frontend inference)
      const featureInput: Record<string, number> = {
        ...commonFeatureVector,
        city_prior: clamp(prior * 2.8, 0, 1.6),
      };
      const w = MODEL.weights[p.policy_type];
      const b = MODEL.intercepts[p.policy_type] ?? 0;
      let z = b;
      if (w && w.length === MODEL.features.length) {
        for (let i = 0; i < MODEL.features.length; i++) {
          z += (featureInput[MODEL.features[i] as keyof typeof featureInput] ?? 0) * w[i];
        }
      }
      const mlProb = sigmoid(z);
      const score = 0.35 * algoScore + 0.65 * mlProb;

      const coverBase =
        p.policy_type === 'Homeowners' ? form.propertyValue * 0.9 :
        p.policy_type === 'Renters' ? form.propertyValue * 0.32 :
        p.policy_type === 'Commercial Property' ? form.businessAssetValue * 0.95 :
        p.policy_type === 'Auto' ? form.vehicleValue * 0.92 :
        p.policy_type === 'Flood Premium' ? form.propertyValue * 0.58 :
        p.policy_type === 'Life' ? form.annualIncome * (6.4 + form.dependents * 0.65) :
        form.annualIncome * 0.6 + form.dependents * 22000 + form.age * 1200;

      const lossAnchor = Array.from(claimStatsByCalamity.values()).reduce((a, b) => Math.max(a, b.avgLoss), 0) || 12000;
      const riskMultiplier = clamp(0.9 + hazardNorm * 0.35 + (lossAnchor / 220000), 0.9, 1.45);
      const recommendedCover = clamp(
        Math.round(coverBase * riskMultiplier),
        p.typical_cover_min,
        p.typical_cover_max
      );

      return {
        ...p,
        score,
        confidence: Math.round(clamp(score, 0.05, 0.98) * 100),
        recommendedCover,
        rationale: `Hybrid model: Python-trained logistic score + claims/activity heuristics`,
      };
    }).sort((a, b) => b.score - a.score);

    return scored;
  }, [cityActivity, claimStatsByCalamity, form, policyPriors]);

  const top = recommendations.slice(0, 3);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <BrainCircuit className="w-7 h-7 text-cyan-400" /> New Customer Policy Recommender
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            ML-style scoring using historical `past_claims` signals and live regional hazard activity.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass rounded-2xl border border-slate-700/40 p-5 lg:col-span-1 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Customer Profile</h3>
          <div className="text-[10px] uppercase tracking-wider text-cyan-400 font-semibold pt-1">Identity & Region</div>
          <div className="text-[10px] uppercase tracking-wider text-cyan-700 font-semibold pt-1">Full Name</div>
          <input className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="Full name" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
          <div className="text-[10px] uppercase tracking-wider text-cyan-700 font-semibold pt-1">City</div>
          <select className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}>
            {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="text-[10px] uppercase tracking-wider text-cyan-700 font-semibold pt-1">Occupancy</div>
          <select className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" value={form.occupancy} onChange={(e) => setForm((f) => ({ ...f, occupancy: e.target.value as FormState['occupancy'] }))}>
            <option value="owner">Owner Occupied</option>
            <option value="renter">Renter</option>
            <option value="business">Business Premise</option>
          </select>
          <div className="text-[10px] uppercase tracking-wider text-cyan-400 font-semibold pt-1">Demographics</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-[10px] uppercase tracking-wider text-cyan-700 font-semibold pt-1">Age</div>
            <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" value={form.age} onChange={(e) => setForm((f) => ({ ...f, age: Number(e.target.value) || 0 }))} placeholder="Age" />
            <div className="text-[10px] uppercase tracking-wider text-cyan-700 font-semibold pt-1">Number of Dependents</div>
            <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" value={form.dependents} onChange={(e) => setForm((f) => ({ ...f, dependents: Number(e.target.value) || 0 }))} placeholder="Dependents" />
          </div>
          <div className="text-[10px] uppercase tracking-wider text-cyan-700 font-semibold pt-1">Annual income</div>
          <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" value={form.annualIncome} onChange={(e) => setForm((f) => ({ ...f, annualIncome: Number(e.target.value) || 0 }))} placeholder="Annual income" />
          <div className="text-[10px] uppercase tracking-wider text-cyan-700 font-semibold pt-1">Property value</div>
          <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" value={form.propertyValue} onChange={(e) => setForm((f) => ({ ...f, propertyValue: Number(e.target.value) || 0 }))} placeholder="Property value" />
          <div className="text-[10px] uppercase tracking-wider text-cyan-700 font-semibold pt-1">Vehicle value</div>
          <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" value={form.vehicleValue} onChange={(e) => setForm((f) => ({ ...f, vehicleValue: Number(e.target.value) || 0 }))} placeholder="Vehicle value" />
          <div className="text-[10px] uppercase tracking-wider text-cyan-700 font-semibold pt-1">Business asset value</div>
          <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm" value={form.businessAssetValue} onChange={(e) => setForm((f) => ({ ...f, businessAssetValue: Number(e.target.value) || 0 }))} placeholder="Business asset value" />
        </div>

        <div className="glass rounded-2xl border border-slate-700/40 p-5 lg:col-span-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Top Recommendations</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {top.map((r, idx) => (
              <div key={r.policy_type} className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
                <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Rank #{idx + 1}</div>
                <div className="font-bold text-cyan-300">{r.policy_type}</div>
                <div className="text-xs text-slate-400 mt-1">{r.description}</div>
                <div className="mt-3 text-xs flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Confidence: <strong>{r.confidence}%</strong></span>
                </div>
                <div className="mt-1 text-xs">
                  Suggested Cover: <span className="font-mono text-emerald-400">${r.recommendedCover.toLocaleString()}</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">{r.rationale}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 rounded-xl border border-slate-700 bg-slate-900/30 text-xs text-slate-400 flex items-start gap-2">
            <MapPin className="w-4 h-4 text-cyan-400 mt-0.5" />
            <span>
              Region activity model: {form.city} currently has weighted hazard factors
              {' '}
              <span className="font-mono">storm {cityActivity.storm.toFixed(2)}</span>,{' '}
              <span className="font-mono">flood {cityActivity.flood.toFixed(2)}</span>,{' '}
              <span className="font-mono">quake {cityActivity.quake.toFixed(2)}</span>,{' '}
              <span className="font-mono">fire {cityActivity.fire.toFixed(2)}</span>.
            </span>
          </div>
          <div className="mt-3 p-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 text-xs text-slate-300">
            <div className="font-semibold text-cyan-300 mb-1">How predictions are carried out</div>
            <div>
              1) A Python-trained multinomial logistic model (exported coefficients) scores policy propensity. <br />
              2) Heuristic risk scoring from `past_claims` + live regional activity refines ranking and cover. <br />
              3) Final confidence and cover are calibrated to master policy cover bands.
            </div>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl border border-slate-700/40 p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" /> Master Policy Type Document
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {POLICIES.map((p) => (
            <div key={p.policy_type} className="rounded-xl border border-slate-700 bg-slate-900/35 p-4">
              <div className="font-bold text-slate-200">{p.policy_type}</div>
              <div className="text-xs text-slate-400 mt-1">{p.description}</div>
              <div className="text-xs text-slate-500 mt-2">Ideal for: {p.ideal_for}</div>
              <div className="text-xs text-slate-500 mt-1">
                Typical cover band: <span className="font-mono">${p.typical_cover_min.toLocaleString()} - ${p.typical_cover_max.toLocaleString()}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {p.primary_covers.map((c) => (
                  <span key={c} className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-300">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
