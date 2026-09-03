import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Circle, Tooltip, useMap } from 'react-leaflet';
import { motion } from 'framer-motion';
import { 
  FlaskConical, Flame, Clock, Globe, Users, 
  ShieldAlert, Droplets, 
  BrainCircuit, Wind, Activity, ZapOff, Thermometer, History, Eye
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { holderDisplayLatLng, fieldTeamLandPositions } from '../../utils/holderMapCoords';
import { getEventTemporalPhase } from '../../utils/eventPhase';
import { 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, Cell, PieChart, Pie, AreaChart, Area
} from 'recharts';

const MAP_STYLES = {
  dark: { label: 'Dark', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png' },
  standard: { label: 'Standard', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png' },
  satellite: { label: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' }
};

const LABEL_LAYER = "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png";

function MapSync({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 8);
  }, [map, lat, lng]);
  return null;
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function MapControl({ active, onChange }: { active: string; onChange: (s: string) => void }) {
  return (
    <div className="absolute bottom-3 right-3 z-[1000] glass-light rounded-lg p-1 flex gap-1 border border-slate-700/50 backdrop-blur-md">
      {Object.entries(MAP_STYLES).map(([key, val]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-2 py-1 rounded text-[8px] font-bold uppercase transition-all ${
            active === key ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-500 hover:text-slate-300 border border-transparent'
          }`}
        >
          {val.label}
        </button>
      ))}
    </div>
  );
}

export default function CrisisSimulator() {
  const { selectedDisaster, disasters, policyHolders, pastClaims, theme, setSelectedDisaster, setGlobalRegion, llmData, managedCities } = useData();
  const [intensity, setIntensity] = useState(1.5);
  const [duration, setDuration] = useState(24);
  const [reach, setReach] = useState(1.0);
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'pre' | 'active' | 'post'>('all');
  
  const [styleHist, setStyleHist] = useState(theme === 'light' ? 'standard' : 'dark');
  const [styleSim, setStyleSim] = useState(theme === 'light' ? 'standard' : 'dark');
  const [styleLive, setStyleLive] = useState(theme === 'light' ? 'standard' : 'dark');

  // Sync default map style with global theme
  useEffect(() => {
    setStyleHist(theme === 'light' ? 'standard' : 'dark');
    setStyleSim(theme === 'light' ? 'standard' : 'dark');
    setStyleLive(theme === 'light' ? 'standard' : 'dark');
  }, [theme]);

  const activeDisasterIds = useMemo(() => {
    const riskNews = llmData.filter(n => n.category === 'news_alert' && managedCities.has(n.city));
    
    return disasters.filter(d => {
      const cityNews = riskNews.filter(n => n.city === d.Location.City);
      if (cityNews.length === 0) return false;
      
      return cityNews.some(n => {
        const content = (n.title + ' ' + n.text).toLowerCase();
        const type = d.Disaster_Type.toLowerCase();
        if (type.includes('earthquake') && (content.includes('seismic') || content.includes('quake'))) return true;
        if (type.includes('hurricane') && (content.includes('wind') || content.includes('storm') || content.includes('hurricane'))) return true;
        if (type.includes('flood') && (content.includes('rain') || content.includes('water') || content.includes('flood'))) return true;
        if (type.includes('wildfire') && (content.includes('fire') || content.includes('smoke') || content.includes('wildfire'))) return true;
        return true; 
      });
    }).map(d => d.Disaster_ID);
  }, [llmData, disasters, managedCities]);

  const filteredDisasters = useMemo(() => {
    const filtered = disasters.filter(d => activeDisasterIds.includes(d.Disaster_ID));
    return filtered.length > 0 ? filtered : disasters.filter(d => managedCities.has(d.Location.City));
  }, [disasters, activeDisasterIds, managedCities]);

  const timelineDisasters = useMemo(() => {
    const scoped = filteredDisasters.filter((d) => managedCities.has(d.Location.City));
    if (timelineFilter === 'all') return scoped;
    return scoped.filter((d) => getEventTemporalPhase(d.Date) === timelineFilter);
  }, [filteredDisasters, managedCities, timelineFilter]);

  const dropdownDisasters = timelineDisasters;

  // Automatically select the most relevant disaster based on live news alerts
  useEffect(() => {
    const isCurrentValid = selectedDisaster && dropdownDisasters.some(d => d.Disaster_ID === selectedDisaster.Disaster_ID);
    if (dropdownDisasters.length > 0 && !isCurrentValid) {
      setSelectedDisaster(dropdownDisasters[0]);
    } else if (dropdownDisasters.length === 0 && selectedDisaster) {
      setSelectedDisaster(null);
    }
  }, [dropdownDisasters, selectedDisaster, setSelectedDisaster]);

  const disaster = selectedDisaster || dropdownDisasters[0] || filteredDisasters[0] || disasters[0];
  const baseMag = disaster.Magnitude;

  const historicalRadiusKm = useMemo(() => baseMag * 3, [baseMag]);
  const currentRadiusKm = useMemo(() => baseMag * 4, [baseMag]);
  /** Reduced impact footprint multiplier for a tighter/less inflated ring. */
  const dynamicRadiusKm = useMemo(() => {
    return (baseMag * intensity) * (1 + duration / 100) * reach * 3.65;
  }, [baseMag, intensity, duration, reach]);

  const simRedKm = dynamicRadiusKm * 0.3;
  const simYellowKm = dynamicRadiusKm;

  const fieldTeams = useMemo(() => {
    return fieldTeamLandPositions(
      disaster.Location.City,
      disaster.Location.Latitude,
      disaster.Location.Longitude,
      12,
      intensity,
      reach
    );
  }, [disaster.Location.City, disaster.Location.Latitude, disaster.Location.Longitude, intensity, reach]);

  const effectiveSeverity = useMemo(() => {
    const score = baseMag * intensity;
    if (score < 5) return 'low';
    if (score < 8) return 'medium';
    if (score < 11) return 'high';
    return 'critical';
  }, [baseMag, intensity]);

  const historicalData = useMemo(() => {
    return (
      pastClaims.find(
        (c) =>
          c.calamity_type === disaster.Disaster_Type &&
          String(c.severity).toLowerCase() === effectiveSeverity
      ) || pastClaims[0]
    );
  }, [disaster, effectiveSeverity, pastClaims]);

  /** Use same display coordinates as the map so “in the ring” matches what you see. */
  const holdersInZone = useMemo(() => {
    const { Latitude: lat0, Longitude: lng0 } = disaster.Location;
    return policyHolders.filter((p) => {
      const [lat, lng] = holderDisplayLatLng(p);
      return getDistance(lat0, lng0, lat, lng) <= simYellowKm;
    });
  }, [policyHolders, disaster, simYellowKm]);

  const cascadingRisks = useMemo(() => {
    const type = disaster.Disaster_Type.toLowerCase();
    if (type.includes('flood') || type.includes('rain')) {
      return [
        { icon: <Droplets className="w-4 h-4 text-blue-400" />, label: 'Water Damage', prob: Math.min(100, 85 + (duration/4)) },
        { icon: <ZapOff className="w-4 h-4 text-amber-400" />, label: 'Grid Failure', prob: Math.min(100, 45 + (duration/6)) },
        { icon: <Activity className="w-4 h-4 text-rose-400" />, label: 'Mold Risk', prob: Math.min(100, 60 + (duration/2)) }
      ];
    } else if (type.includes('storm') || type.includes('wind') || type.includes('hurricane')) {
      return [
        { icon: <Wind className="w-4 h-4 text-cyan-400" />, label: 'Roof Damage', prob: Math.min(100, 90 + (duration/10)) },
        { icon: <ZapOff className="w-4 h-4 text-amber-400" />, label: 'Power Loss', prob: Math.min(100, 75 + (duration/8)) },
        { icon: <ShieldAlert className="w-4 h-4 text-rose-400" />, label: 'Debris Impact', prob: Math.min(100, 50 + (duration/5)) }
      ];
    } else {
      return [
        { icon: <Thermometer className="w-4 h-4 text-orange-400" />, label: 'Structural', prob: Math.min(100, 40 + (duration/12)) },
        { icon: <Activity className="w-4 h-4 text-emerald-400" />, label: 'Supply Chain', prob: Math.min(100, 30 + (duration/4)) },
        { icon: <Users className="w-4 h-4 text-cyan-400" />, label: 'Evacuation', prob: Math.min(100, 65 + (duration/10)) }
      ];
    }
  }, [disaster, duration]);

  const predictions = useMemo(() => {
    const totalPolicies = historicalData.total_policies;
    const propAffected = historicalData.affected_individuals / totalPolicies;
    const propClaims = historicalData.total_claims / totalPolicies;
    const exposed = holdersInZone.length;

    const durationFactor = 1 + duration / 48;
    /** Shared exposure stress: footprint (exposed) × intensity × reach × time escalation */
    const stress = intensity * reach * durationFactor;

    // Surge can exceed 100% vs baseline when scenario is extreme (no artificial cap).
    const surge = Math.round((intensity * baseMag * 10 + duration / 2) * durationFactor * 0.8);

    const rawAffected = Math.round(exposed * propAffected * stress);
    const rawClaims = Math.round(exposed * propClaims * stress);
    // Claims are a subset of harmed/exposed population; affected should track reach like claims.
    const claims = Math.min(exposed, Math.max(0, rawClaims));
    let affected = Math.min(exposed, Math.max(0, rawAffected));
    if (claims > affected) affected = Math.min(exposed, claims);

    const avgClaim = ((historicalData.amount_applied / historicalData.total_claims) || 12000) * (1 + duration / 100);
    const loss = claims * avgClaim;

    // Readiness falls with surge / intensity / reach (no hard floor at 5%).
    const readiness = Math.max(
      0,
      Math.min(100, Math.round(100 / (1 + surge / 95 + (intensity - 0.5) * 0.12 + (reach - 1) * 0.14)))
    );

    const readinessBase = readiness;

    return {
      surge,
      exposed,
      affected,
      claims,
      loss,
      readiness: readinessBase,
      history: Array.from({ length: 12 }).map((_, i) => ({
        time: `T-${11 - i}h`,
        loss: (loss / 12) * (i + 1) * (0.8 + Math.random() * 0.4),
        readiness: Math.max(0, Math.min(100, Math.round(readinessBase + (i - 5.5) * 1.2))),
      })),
    };
  }, [holdersInZone, historicalData, intensity, baseMag, duration, reach]);

  const center: [number, number] = [disaster.Location.Latitude, disaster.Location.Longitude];
  const chartTextColor = theme === 'light' ? '#475569' : '#94a3b8';

  /** Every policy inside the dynamic ring is drawn (distance uses raw coords; map uses display coords). */
  const holdersForSimMap = useMemo(() => holdersInZone, [holdersInZone]);

  const pieData = useMemo(() => {
    if (predictions.exposed === 0) {
      return [{ name: 'No policies in ring', value: 1, color: '#334155' }];
    }
    return [
      { name: 'Modeled impact', value: predictions.affected, color: '#f43f5e' },
      {
        name: 'Exposed (other)',
        value: Math.max(0, predictions.exposed - predictions.affected),
        color: theme === 'light' ? '#e2e8f0' : '#1e293b',
      },
    ];
  }, [predictions.affected, predictions.exposed, theme]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 overflow-visible pr-0 md:pr-2">
      {/* Sidebar: Controls & Live Summary */}
      <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-3 h-auto lg:h-full lg:overflow-y-auto custom-scrollbar">
        <div className="glass rounded-xl p-4 border border-slate-700/30">
          <div className="flex items-center justify-between mb-3">
             <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
               <FlaskConical className="w-3.5 h-3.5 text-cyan-400" /> Scenario Control
             </h2>
             <span className="text-[8px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded font-mono">SIM_v2.4</span>
          </div>
          
          <select
            value={timelineFilter}
            onChange={(e) => setTimelineFilter(e.target.value as 'all' | 'pre' | 'active' | 'post')}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-[11px] text-slate-300 mb-2 outline-none focus:border-cyan-500/50 transition-colors"
          >
            <option value="all">All Timeline</option>
            <option value="pre">Upcoming (forecast)</option>
            <option value="active">Ongoing (in window)</option>
            <option value="post">Past (occurred)</option>
          </select>

          <select 
            value={dropdownDisasters.length > 0 ? disaster.Disaster_ID : ''} 
            onChange={(e) => {
              if (!e.target.value) return;
              const d = dropdownDisasters.find((x) => x.Disaster_ID === parseInt(e.target.value, 10)) || null;
              setSelectedDisaster(d);
              if (d?.Location?.City) setGlobalRegion(d.Location.City);
              else setGlobalRegion('All');
            }}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-[11px] text-slate-200 mb-4 outline-none focus:border-cyan-500/50 transition-colors"
          >
            {dropdownDisasters.length === 0 && (
              <option value="">No events in selected timeline</option>
            )}
            {dropdownDisasters.map(d => (
              <option key={d.Disaster_ID} value={d.Disaster_ID}>{d.Disaster_Type} • {d.Location.City}</option>
            ))}
          </select>

          <div className="space-y-4">
            {[
              { label: 'Intensity', icon: <Flame className="w-3.5 h-3.5 text-rose-400" />, value: intensity, setter: setIntensity, min: 0.5, max: 5, step: 0.1, unit: 'x', color: 'bg-rose-500' },
              { label: 'Duration', icon: <Clock className="w-3.5 h-3.5 text-amber-400" />, value: duration, setter: setDuration, min: 1, max: 96, step: 1, unit: 'h', color: 'bg-amber-500' },
              { label: 'Reach', icon: <Globe className="w-3.5 h-3.5 text-cyan-400" />, value: reach, setter: setReach, min: 0.5, max: 3, step: 0.1, unit: 'x', color: 'bg-cyan-500' },
            ].map(s => (
              <div key={s.label}>
                <div className="flex items-center justify-between mb-1.5 text-[10px]">
                  <span className="text-slate-400 font-bold uppercase flex items-center gap-1.5">{s.icon} {s.label}</span>
                  <span className="font-mono text-slate-200">{s.value}{s.unit}</span>
                </div>
                <input type="range" min={s.min} max={s.max} step={s.step} value={s.value} onChange={e => s.setter(parseFloat(e.target.value))} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-xl p-4 border border-cyan-500/10 flex flex-col gap-4">
           <div className="flex items-center gap-2">
             <Activity className="w-3.5 h-3.5 text-emerald-400" />
             <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Real-time Projections</span>
           </div>
           
           <p className="text-[8px] text-slate-500 leading-snug">
             Inside dynamic ring: <span className="font-mono text-slate-400">{predictions.exposed}</span> policies
             exposed · impact & claims scale from this footprint (not the full portfolio).
           </p>
           <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Predicted Surge', val: `${predictions.surge}%`, color: 'text-rose-400' },
                { label: 'Est. Claims', val: predictions.claims, color: 'text-amber-400' },
                { label: 'Affected Pop', val: predictions.affected, color: 'text-cyan-400' },
                { label: 'Readiness', val: `${predictions.readiness.toFixed(0)}%`, color: 'text-emerald-400' },
              ].map(k => (
                <div key={k.label} className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
                   <div className="text-[8px] text-slate-500 uppercase font-bold">{k.label}</div>
                   <div className={`text-lg font-bold font-mono ${k.color}`}>{k.val}</div>
                </div>
              ))}
           </div>

           <div className="h-28 w-full min-h-[112px]">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={predictions.history}>
                    <defs>
                       <linearGradient id="colorLoss" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                       </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="loss" stroke="#06b6d4" fillOpacity={1} fill="url(#colorLoss)" />
                    <RechartsTooltip contentStyle={{backgroundColor: theme === 'light' ? '#fff' : '#0f172a', border: '1px solid #cbd5e1', fontSize: '10px', color: chartTextColor}} />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>

      {/* Main Simulation View - 3 Map Concept */}
      <div className="flex-1 flex flex-col gap-3 min-h-0">
        <div className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-3 min-h-0">
          
          {/* Map 1: Historical Data */}
          <div className="glass rounded-xl overflow-hidden relative border border-slate-700/30 h-[250px] xl:h-full group">
            <div className="absolute top-3 left-3 z-[1000] glass-light px-2 py-1 rounded text-[8px] text-slate-400 font-bold uppercase flex items-center gap-2 border border-slate-700/30 backdrop-blur-md">
               <History className="w-3 h-3" /> Historical Baseline
            </div>
            <MapControl active={styleHist} onChange={setStyleHist} />
            <MapContainer center={center} zoom={8} className="w-full h-full" zoomControl={false}>
               <MapSync lat={center[0]} lng={center[1]} />
               <TileLayer url={MAP_STYLES[styleHist as keyof typeof MAP_STYLES].url} />
               {styleHist === 'satellite' && <TileLayer url={LABEL_LAYER} />}
               <Circle center={center} radius={historicalRadiusKm * 1000} pathOptions={{ color: '#94a3b8', fillOpacity: 0.1, weight: 1.5, dashArray: '5 5' }} />
               {pastClaims.filter(pc => pc.calamity_type === disaster.Disaster_Type).slice(0, 5).map((pc, i) => {
                 const ang = (i / 5) * Math.PI * 2 + disaster.Disaster_ID * 0.03;
                 const r = 0.035;
                 return (
                   <Circle key={`${pc.calamity_type}-${pc.severity}-${i}`} center={[center[0] + Math.cos(ang) * r, center[1] + Math.sin(ang) * r]} radius={1500} pathOptions={{ color: '#64748b', fillOpacity: 0.3 }} />
                 );
               })}
            </MapContainer>
          </div>

          {/* Map 2: Predictive Simulation (Master) */}
          <div className="glass rounded-xl overflow-hidden relative border border-cyan-500/30 h-[350px] xl:h-full shadow-[0_0_20px_rgba(6,182,212,0.1)]">
            <div className="absolute top-3 left-3 z-[1000] glass-light px-3 py-1 rounded-lg text-[9px] text-cyan-400 font-bold uppercase flex items-center gap-2 border border-cyan-500/30 backdrop-blur-md ring-1 ring-cyan-500/20">
               <ShieldAlert className="w-3 h-3 animate-pulse" /> Simulation Sandbox
            </div>
            <MapControl active={styleSim} onChange={setStyleSim} />
            <MapContainer center={center} zoom={8} className="w-full h-full" zoomControl={false}>
               <MapSync lat={center[0]} lng={center[1]} />
               <TileLayer url={MAP_STYLES[styleSim as keyof typeof MAP_STYLES].url} />
               {styleSim === 'satellite' && <TileLayer url={LABEL_LAYER} />}
               <Circle center={center} radius={simYellowKm * 1000} pathOptions={{ color: '#06b6d4', fillOpacity: 0.05, weight: 1, dashArray: '10 5' }} />
               <Circle center={center} radius={simRedKm * 1000} pathOptions={{ color: '#f43f5e', fillOpacity: 0.1, weight: 1.5, dashArray: '10 5' }} />
               {holdersForSimMap.map((p) => {
                 const [lat, lng] = holderDisplayLatLng(p);
                 return (
                   <Circle
                     key={p.policy_id ?? p.name}
                     center={[lat, lng]}
                     radius={520}
                     pathOptions={{
                       color: '#f8fafc',
                       weight: 1.5,
                       fillColor: '#22d3ee',
                       fillOpacity: 0.72,
                       opacity: 1,
                     }}
                   >
                     <Tooltip><span className="text-[9px] font-mono">{p.name}</span></Tooltip>
                   </Circle>
                 );
               })}
            </MapContainer>
          </div>

          {/* Map 3: Current Live View */}
          <div className="glass rounded-xl overflow-hidden relative border border-emerald-500/20 h-[250px] xl:h-full">
            <div className="absolute top-3 left-3 z-[1000] glass-light px-2 py-1.5 rounded border border-emerald-500/20 backdrop-blur-md max-w-[min(100%,14rem)]">
               <div className="text-[8px] text-emerald-400 font-bold uppercase flex items-center gap-2">
                 <Eye className="w-3 h-3 shrink-0" /> Live Operational View
               </div>
               <p className="text-[7px] text-slate-500 normal-case font-normal leading-tight mt-1">
                 <span className="text-emerald-400 font-mono">●</span> Green = field teams staged <strong>toward inland</strong> from the epicenter (never seaward); ring = current ops footprint.
               </p>
            </div>
            <MapControl active={styleLive} onChange={setStyleLive} />
            <MapContainer center={center} zoom={8} className="w-full h-full" zoomControl={false}>
               <MapSync lat={center[0]} lng={center[1]} />
               <TileLayer url={MAP_STYLES[styleLive as keyof typeof MAP_STYLES].url} />
               {styleLive === 'satellite' && <TileLayer url={LABEL_LAYER} />}
               <Circle center={center} radius={currentRadiusKm * 1000} pathOptions={{ color: '#10b981', fillOpacity: 0.1, weight: 1.5, dashArray: '5 5' }} />
               {fieldTeams.map((team) => (
                 <Circle key={team.id} center={[team.lat, team.lng]} radius={1000} pathOptions={{ color: '#10b981', fillOpacity: 0.8, weight: 2 }} />
               ))}
            </MapContainer>
          </div>

        </div>

        {/* Dynamic Analytics & Risk Panel */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 min-h-0">
          <div className="glass rounded-xl p-4 border border-slate-700/30 flex flex-col min-h-[250px]">
             <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                   <BrainCircuit className="w-3.5 h-3.5 text-purple-400" /> Cascading Linkage
                </h3>
                <span className="text-[9px] text-purple-400 font-bold">{disaster.Disaster_Type} Model</span>
             </div>
             
             <div className="flex-1 flex flex-col justify-around gap-4 px-2">
                {cascadingRisks.map((risk, i) => (
                   <div key={i} className="flex items-center gap-4 group">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center group-hover:border-purple-500/50 transition-all">
                         {risk.icon}
                      </div>
                      <div className="flex-1">
                         <div className="flex justify-between mb-1">
                            <span className="text-[10px] text-slate-200 font-bold">{risk.label}</span>
                            <span className="text-[10px] text-purple-400 font-mono">{risk.prob}%</span>
                         </div>
                         <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }} 
                              animate={{ width: `${risk.prob}%` }} 
                              className="h-full bg-purple-500" 
                              transition={{ duration: 1, delay: i * 0.2 }}
                            />
                         </div>
                      </div>
                   </div>
                ))}
             </div>
          </div>

          <div className="glass rounded-xl p-3 border border-slate-700/30 h-auto xl:h-auto flex flex-col md:flex-row gap-4 overflow-hidden min-h-[160px]">
             <div className="flex-1 flex flex-col min-w-0">
                <span className="text-[8px] text-slate-500 uppercase font-bold mb-0.5">Impact Segmentation</span>
                <span className="text-[7px] text-slate-600 normal-case font-normal leading-tight block mb-1">
                  Only policies inside the <strong>current</strong> dynamic ring; modeled impact vs remainder there (not all book).
                </span>
                <div className="flex-1">
                   <ResponsiveContainer width="100%" height="100%" minHeight={80}>
                      <PieChart>
                         <Pie data={pieData} innerRadius={22} outerRadius={32} paddingAngle={4} dataKey="value" stroke="none">
                            {pieData.map((e, i) => <Cell key={i} fill={e.color} fillOpacity={0.8} />)}
                         </Pie>
                         <RechartsTooltip />
                      </PieChart>
                   </ResponsiveContainer>
                </div>
             </div>
             
             <div className="w-[1px] bg-slate-800 hidden md:block" />
             
             <div className="flex-[2] flex flex-col min-w-0">
                <span className="text-[8px] text-slate-500 uppercase font-bold mb-1">Readiness Drift (Live)</span>
                <div className="flex-1">
                   <ResponsiveContainer width="100%" height="100%" minHeight={80}>
                      <AreaChart data={predictions.history}>
                         <Area type="monotone" dataKey="readiness" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.1} />
                         <RechartsTooltip contentStyle={{backgroundColor: theme === 'light' ? '#fff' : '#0f172a', border: '1px solid #cbd5e1', fontSize: '10px', color: chartTextColor}} />
                      </AreaChart>
                   </ResponsiveContainer>
                </div>
             </div>

             <div className="w-[1px] bg-slate-800 hidden md:block" />

             <div className="flex-1 flex flex-col justify-center gap-2 min-w-0">
                <div>
                   <div className="text-[8px] text-slate-500 uppercase flex justify-between">
                      <span>Est. Loss</span>
                      <span className="text-emerald-400 font-mono">${(predictions.loss/1000).toFixed(0)}K</span>
                   </div>
                   <div className="w-full h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                      <motion.div initial={{width: 0}} animate={{width: '70%'}} className="h-full bg-emerald-500" />
                   </div>
                </div>
                <div>
                   <div className="text-[8px] text-slate-500 uppercase flex justify-between">
                      <span>Readiness</span>
                      <span className="text-amber-400 font-mono">{predictions.readiness.toFixed(0)}%</span>
                   </div>
                   <div className="w-full h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                      <motion.div initial={{width: 0}} animate={{width: `${predictions.readiness}%`}} className="h-full bg-amber-500" />
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
