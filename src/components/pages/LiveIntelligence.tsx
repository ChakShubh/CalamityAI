import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Circle, useMap, Tooltip, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radio, AlertTriangle, MapPin, ShieldAlert, FileWarning,
  Send, Layers, X, BrainCircuit, Filter, BarChart3, Newspaper,
  TrendingUp, AlertCircle, Users, Info, Activity, Clock, ChevronRight,
  ClipboardList, Wallet, Truck, Globe, ArrowRight, History as HistoryIcon, FileText
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { getEventTemporalPhase } from '../../utils/eventPhase';
import { formatIntelTime } from '../../utils/formatIntelTime';
import { CITY_COORDS, type DemoCity } from '../../constants/demoGeography';
import { EXPOSURE_RADIUS_KM_PER_MAGNITUDE } from '../../constants/exposureModel';
import MultiModalIngestionModal from '../features/MultiModalIngestionModal';
import {
  BarChart, Bar, XAxis, ResponsiveContainer, Cell,
  Tooltip as RechartsTooltip, Radar, RadarChart, PolarGrid,
  PolarAngleAxis
} from 'recharts';

function isCalamityCategory(category: string | undefined): boolean {
  return category === 'news_alert' || category === 'early_warning';
}

function getFeedItemPhase(topic: { isPostEvent?: boolean; predicted_time?: string; timestamp: string }): 'pre' | 'active' | 'post' {
  if (topic.predicted_time) return getEventTemporalPhase(topic.predicted_time);
  return getEventTemporalPhase(topic.timestamp);
}

/** Phase for a feed card: one linked chain is one logical event (active if any stage is active). */
function getAggregatedFeedPhase(topic: { reports?: any[]; isPostEvent?: boolean; predicted_time?: string; timestamp: string }): 'pre' | 'active' | 'post' {
  const reps = topic.reports?.length ? topic.reports : [topic];
  const phases = reps.map((r: any) => getFeedItemPhase(r));
  if (phases.includes('active')) return 'active';
  if (phases.includes('pre')) return 'pre';
  return 'post';
}

const METRIC_HINTS: Record<string, string> = {
  surge: 'Estimated change in claim volume versus normal operations for the area you are viewing—higher means a sharper spike in expected filings.',
  loss: 'Rough monetary exposure from projected or realised claims (severity × count), not audited financials.',
  severity: 'Average indicative severity per claim used for stress modelling; actual settlements vary by policy.',
  pop: 'Policyholders modelled inside the combined hazard footprint for the selected scenario or region.',
  readiness: 'How prepared internal ops, reserves, and partner capacity look against the current surge signal (higher is better).',
  claims: 'Count of new or in-flight claims expected in the near window based on exposure and hazard intensity.',
};

function MetricHint({ hintKey, label }: { hintKey: string; label: string }) {
  const text = METRIC_HINTS[hintKey];
  if (!text) return null;
  return (
    <div className="relative inline-flex shrink-0 group/hint overflow-visible">
      <div className="p-0.5 rounded-md text-slate-500 hover:text-cyan-400 hover:bg-slate-800/80 transition-colors cursor-help border-0 bg-transparent">
        <Info className="w-3 h-3" />
      </div>
      <div
        role="tooltip"
        className="absolute z-[2000] bottom-full left-1/2 -translate-x-1/2 mb-3 w-[240px] p-3 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-700 text-[11px] text-slate-200 shadow-2xl opacity-0 invisible group-hover/hint:opacity-100 group-hover/hint:visible transition-all duration-200 leading-relaxed text-left font-normal normal-case tracking-normal border-cyan-500/40 pointer-events-none"
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">{label}</span>
          </div>
          <div className="px-1">{text}</div>
        </div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900/95" />
      </div>
    </div>
  );
}

function MapUpdater({ lat, lng, region }: { lat?: number; lng?: number, region?: string }) {
  const { policyHolders } = useData();
  const map = useMap();
  useEffect(() => {
    if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
      map.setView([lat, lng], 8);
    } else if (region && region !== 'All') {
      const ph = policyHolders.find(p => p.city === region);
      if (ph) {
        map.setView([ph.latitude, ph.longitude], 8);
      }
    }
  }, [map, lat, lng, region, policyHolders]);
  return null;
}

const MAP_STYLES = {
  dark: { label: 'Dark', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png' },
  standard: { label: 'Standard', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png' },
  satellite: { label: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' }
};

const LABEL_LAYER = "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png";

function stableImpactScore(id: number, title: string): string {
  let h = id >>> 0;
  for (let i = 0; i < title.length; i++) h = (Math.imul(h, 33) + title.charCodeAt(i)) >>> 0;
  return (4 + (h % 60) / 10).toFixed(1);
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return 999999;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function NewsModal({ item, onClose, onProtocolActivated }: { item: any, onClose: () => void, onProtocolActivated?: () => void }) {
  const { addToast } = useData();
  if (!item) return null;
  const impact = item.impactScore || 5;
  const intelPast = Boolean(item.isPostEvent) || getFeedItemPhase(item) === 'post';

  const handleActivateProtocol = () => {
    addToast(`CRITICAL: Broadcasting emergency alerts to all policyholders in ${item.city}...`, 'warning');
    setTimeout(() => addToast(`Field units in ${item.city} have been put on high alert.`, 'success'), 1000);
    setTimeout(() => addToast(`Automated reserve review triggered for regional claim surge.`, 'info'), 2000);
    if (onProtocolActivated) {
      onProtocolActivated();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glass w-full max-w-2xl rounded-3xl border border-slate-700/50 overflow-hidden shadow-2xl"
      >
        <div className="p-6 flex flex-col gap-6">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl ${isCalamityCategory(item.category) ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                {isCalamityCategory(item.category) ? <AlertTriangle className="w-6 h-6" /> : <Newspaper className="w-6 h-6" />}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100">{item.title}</h2>
                <p className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                  <MapPin className="w-3 h-3" /> {item.city} • <Clock className="w-3 h-3" /> {formatIntelTime(item.timestamp)}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Impact Score</div>
              <div className="text-2xl font-bold text-rose-400 font-mono">{impact}/10</div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2">
                <div className="h-full bg-rose-500" style={{ width: `${impact * 10}%` }} />
              </div>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Managed Status</div>
              <div className="text-sm font-bold text-cyan-400 flex items-center gap-2 mt-1">
                {item.isManaged ? <><ShieldAlert className="w-4 h-4" /> Operational Area</> : <><Globe className="w-4 h-4 text-slate-500" /> External Region</>}
              </div>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Source Analysis</div>
              <div className="text-sm font-bold text-slate-200 mt-1">{item.source || 'News Watch'}</div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Info className="w-3.5 h-3.5" /> Intelligence Report
            </h3>
            <p className="text-sm text-slate-200 leading-relaxed bg-slate-900/30 p-4 rounded-2xl border border-slate-800/50">
              {item.intelNarrative || item.text || "Detailed analysis pending neural link synchronization..."}
            </p>
            {item.text && item.intelNarrative && (
              <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-800/50 pt-3">
                <span className="text-slate-400 font-semibold">Wire copy: </span>
                {item.text}
              </p>
            )}
          </div>

          <div className="bg-cyan-500/5 border border-cyan-500/20 p-4 rounded-2xl space-y-2">
            <h3 className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
              <BrainCircuit className="w-3.5 h-3.5" /> Neural Link Prediction
            </h3>
            <p className="text-[11px] text-slate-400 italic">
              "Ollama-v3 model suggests a potential {(impact * 12).toFixed(0)}% surge in regional claims over the next 48 hours. Recommend proactive mobilization of regional adjusters in {item.city}."
            </p>
          </div>

          <div className="flex gap-3 mt-2">
            <button onClick={onClose} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold uppercase transition-all">Back to List</button>
            {item.isManaged && isCalamityCategory(item.category) && !intelPast && (
              <button
                onClick={handleActivateProtocol}
                className="flex-[2] py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 px-8"
              >
                <AlertTriangle className="w-4 h-4" /> Activate Crisis Protocol
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function TopicModal({ topic, onClose, onSelectReport }: { topic: any, onClose: () => void, onSelectReport: (item: any) => void }) {
  if (!topic) return null;

  return (
    <div className="fixed inset-0 z-[2500] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass w-full max-w-lg rounded-3xl border border-slate-700/50 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/30">
          <div className="min-w-0 pr-2">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400 shrink-0" /> Topic: {topic.title}
            </h2>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">
              {topic.reportCount} Verified Reports in {topic.city}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1 mb-1">Calamity Intelligence Log</h3>
          {topic.reports.map((report: any, idx: number) => (
            <div
              key={`${report.id}-${idx}`}
              onClick={() => onSelectReport(report)}
              className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-cyan-500/30 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Activity className="w-3 h-3" /> Report #{topic.reports.length - idx}
                </span>
                <span className="text-[9px] text-slate-500 font-mono">{formatIntelTime(report.timestamp)}</span>
              </div>
              <p className="text-xs text-slate-300 line-clamp-3 mb-3 leading-relaxed">{report.intelNarrative || report.text}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-[8px] px-1.5 py-0.5 bg-slate-800 rounded text-slate-400 font-mono">{report.source || 'Intel Hub'}</div>
                  {isCalamityCategory(report.category) && (
                    <div className="text-[8px] px-1.5 py-0.5 bg-rose-500/10 text-rose-400 rounded font-bold uppercase tracking-tighter">Verified Alert</div>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[9px] font-bold text-cyan-500/0 group-hover:text-cyan-500 transition-all">
                  <span>Full Intelligence</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-slate-900/50 border-t border-slate-800">
          <button onClick={onClose} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold uppercase transition-all">Close Intelligence Report</button>
        </div>
      </motion.div>
    </div>
  );
}

function IncidentFeed({ phaseFilter, setPhaseFilter, aggregatedNews, onSelectCard, onOpenTopic }: {
  phaseFilter: 'all' | 'pre' | 'active' | 'post';
  setPhaseFilter: (p: 'all' | 'pre' | 'active' | 'post') => void;
  aggregatedNews: any[];
  onSelectCard: (t: any) => void;
  onOpenTopic: (t: any) => void;
}) {
  const { selectedDisaster, managedCities, globalRegion, disasters, setUnifiedDashboardRegion } = useData();
  const [countryFilter, setCountryFilter] = useState('All');

  const canonicalScenarioByCity = useMemo(() => {
    const scoped = disasters.filter((d) => managedCities.has(d.Location.City));
    const byCity = new Map<string, typeof scoped>();
    for (const d of scoped) {
      const city = d.Location.City;
      if (!byCity.has(city)) byCity.set(city, []);
      byCity.get(city)!.push(d);
    }
    const phaseWeight = (d: (typeof scoped)[number]) => {
      const p = getEventTemporalPhase(d.Date);
      if (p === 'active') return 3;
      if (p === 'pre') return 2;
      return 1;
    };
    const closeness = (d: (typeof scoped)[number]) => -Math.abs(new Date(d.Date).getTime() - Date.now());
    const out = new Map<string, (typeof scoped)[number]>();
    for (const [city, arr] of byCity.entries()) {
      const pick = arr.reduce((best, cur) => {
        const wb = phaseWeight(best);
        const wc = phaseWeight(cur);
        if (wc !== wb) return wc > wb ? cur : best;
        const tb = closeness(best);
        const tc = closeness(cur);
        if (tc !== tb) return tc > tb ? cur : best;
        return cur.Magnitude >= best.Magnitude ? cur : best;
      });
      out.set(city, pick);
    }
    return out;
  }, [disasters, managedCities]);

  const itemMatchesScenarioType = (item: any, scenario: any) => {
    if (!scenario) return true;
    const text = `${item.title || ''} ${item.text || ''}`.toLowerCase();
    const type = String(scenario.Disaster_Type || '').toLowerCase();
    if (type.includes('earthquake')) return /seismic|quake|earthquake/.test(text);
    if (type.includes('hurricane')) return /hurricane|storm|cyclone|wind/.test(text);
    if (type.includes('flood')) return /flood|rain|water|monsoon|surge/.test(text);
    if (type.includes('wildfire')) return /wildfire|fire|smoke|bushfire/.test(text);
    return true;
  };

  const countries = useMemo(() => {
    const set = new Set<string>();
    aggregatedNews.forEach((item: any) => {
      if (item.isManaged && isCalamityCategory(item.category) && item.country) set.add(item.country);
    });
    return Array.from(set).sort();
  }, [aggregatedNews]);

  const citiesInCountry = useMemo(() => {
    const set = new Set<string>();
    aggregatedNews.forEach((item: any) => {
      if (item.isManaged && isCalamityCategory(item.category) && (countryFilter === 'All' || item.country === countryFilter)) {
        set.add(item.city);
      }
    });
    return Array.from(set).sort();
  }, [aggregatedNews, countryFilter]);

  const getEventDate = (item: any) => {
    // Priority 1: Check for a scenario that matches both city AND disaster type
    const scenario = Array.from(canonicalScenarioByCity.values()).find(
      s => s.Location.City === item.city && itemMatchesScenarioType(item, s)
    );
    if (scenario) return scenario.Date;
    
    // Priority 2: A specific predicted time in the news report
    if (item.predicted_time) return item.predicted_time;
    
    // Fallback: The report's own timestamp
    return item.timestamp;
  };

  const topicPhase = (item: any): 'pre' | 'active' | 'post' => {
    return getEventTemporalPhase(getEventDate(item));
  };

  const filteredItems = useMemo(() => {
    const base = aggregatedNews
      .filter((item: any) => {
        const isCalamity = isCalamityCategory(item.category);
        const matchesManaged = item.isManaged;
        const matchesCountry = countryFilter === 'All' || item.country === countryFilter;
        const matchesCity = globalRegion === 'All' || item.city === globalRegion;
        const scenario = canonicalScenarioByCity.get(item.city);
        const matchesType = itemMatchesScenarioType(item, scenario);
        const p = topicPhase(item);
        const matchesPhase = phaseFilter === 'all' || p === phaseFilter;
        return isCalamity && matchesManaged && matchesCountry && matchesCity && matchesType && matchesPhase;
      })
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    /** Expanded feed: allow multiple distinct calamities per city (e.g. a past flood and a future cyclone). */
    const topics = new Map<string, any>();
    for (const item of base) {
      const p = topicPhase(item);
      const scenario = Array.from(canonicalScenarioByCity.values()).find(
        s => s.Location.City === item.city && itemMatchesScenarioType(item, s)
      );
      const type = scenario ? scenario.Disaster_Type : (item.title?.split(' ')[0] || 'General');
      const key = `${item.city}-${type}-${p}`;

      if (!topics.has(key)) {
        topics.set(key, { ...item, reports: [item], reportCount: 1 });
      } else {
        const existing = topics.get(key);
        existing.reports.push(item);
        existing.reportCount++;
        
        // Update the canonical fields (title, timestamp, etc.) if the new item has a better score
        const score = (x: any) => {
          let s = 0;
          const title = (x.title || '').toUpperCase();
          if (title.includes('ACTIVE:')) s += 20;
          if (title.includes('PREDICTION:')) s += 15;
          if (title.includes('URGENT:')) s += 12;
          if (title.includes('ALERT:')) s += 10;
          s += new Date(x.timestamp).getTime() / 1e13;
          return s;
        };
        
        if (score(item) > score(existing)) {
          // Keep the reports array but update other fields
          const reports = existing.reports;
          const count = existing.reportCount;
          Object.assign(existing, item);
          existing.reports = reports;
          existing.reportCount = count;
        }
      }
    }
    return Array.from(topics.values()).sort(
      (a: any, b: any) => {
        // Chronological sort by disaster event timeline (Upcoming -> Ongoing -> Historical)
        const dateA = new Date(getEventDate(a)).getTime();
        const dateB = new Date(getEventDate(b)).getTime();
        if (dateB !== dateA) return dateB - dateA;
        
        // Secondary sort: Impact score
        return (parseFloat(b.impactScore) || 0) - (parseFloat(a.impactScore) || 0);
      }
    );
  }, [aggregatedNews, canonicalScenarioByCity, countryFilter, globalRegion, phaseFilter, selectedDisaster, disasters]);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-3 h-auto lg:h-full">
      <div className="glass rounded-2xl p-4 border border-slate-700/30 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-rose-400 animate-pulse" />
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">IntelliFeed</h2>
          </div>
          <div className="px-2 py-0.5 bg-rose-500/10 text-rose-400 rounded-full text-[8px] font-mono font-bold">LIVE</div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <div className="relative">
            <Filter className="w-3 h-3 text-cyan-500/80 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value as 'all' | 'pre' | 'active' | 'post')}
              className="w-full bg-slate-900/50 border border-cyan-500/20 rounded-lg pl-8 pr-2 py-1.5 text-[9px] text-slate-200 outline-none focus:border-cyan-500/50 appearance-none font-bold"
            >
              <option value="all">All: timeline</option>
              <option value="pre">Upcoming (forecast)</option>
              <option value="active">Ongoing (in window)</option>
              <option value="post">Past (occurred)</option>
            </select>
          </div>
          <div className="relative">
            <Globe className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg pl-8 pr-2 py-1.5 text-[9px] text-slate-300 outline-none focus:border-cyan-500/50 appearance-none"
            >
              <option value="All">All Countries</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="relative">
            <MapPin className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <select
              value={globalRegion}
              onChange={(e) => setUnifiedDashboardRegion(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg pl-8 pr-2 py-1.5 text-[9px] text-slate-300 outline-none focus:border-cyan-500/50 appearance-none"
            >
              <option value="All">All Cities</option>
              {citiesInCountry.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {filteredItems.map((topic: any, i: number) => {
            const isSelected = selectedDisaster?.Location.City === topic.city;
            const uniqueKey = `${topic.event_chain_id || topic.city}-${topic.title}-${i}`;
            const tPhase = topicPhase(topic);
            const isPost = tPhase === 'post';
            const phaseLabel = tPhase === 'pre' ? 'Upcoming' : tPhase === 'post' ? 'Past' : 'Ongoing';

            return (
              <motion.div
                key={uniqueKey}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => onSelectCard(topic)}
                className={`p-3 rounded-xl cursor-pointer transition-all border group relative flex flex-col gap-3 ${isSelected ? 'glass-light border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.1)]' : 'glass border-slate-700/10 hover:border-slate-500/30'}`}
              >
                {(topic.reportCount > 1 || topic.event_chain_id) && (
                  <div className="absolute top-2 right-2 flex flex-col items-end gap-0.5 z-10">
                    {topic.event_chain_id && (
                      <div className="bg-violet-600/90 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full shadow-lg border border-violet-400/30">
                        LINKED TRAIL
                      </div>
                    )}
                    {topic.reportCount > 1 && (
                      <div className="bg-cyan-500 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full shadow-lg">
                        {topic.reportCount} STAGES
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${isCalamityCategory(topic.category) ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {isCalamityCategory(topic.category) ? <AlertTriangle className="w-3.5 h-3.5" /> : <Newspaper className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-200 group-hover:text-cyan-400 transition-colors uppercase tracking-tight line-clamp-1">
                        <span className={`mr-1.5 ${tPhase === 'pre' ? 'text-amber-400' : tPhase === 'active' ? 'text-rose-400' : 'text-slate-500'}`}>
                          {tPhase === 'pre' ? 'PREDICTION:' : tPhase === 'active' ? 'ACTIVE:' : 'ARCHIVE:'}
                        </span>
                        {topic.title.replace(/^(ACTIVE|PREDICTION|ARCHIVE|ALERT|URGENT):/i, '').trim()}
                      </div>
                      <div className="text-[8px] text-slate-500 flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {topic.city} • {formatDate(topic.timestamp)}</div>
                    </div>
                  </div>
                </div>

                <p className="text-[9px] text-slate-400 line-clamp-2 leading-relaxed">{topic.intelNarrative || topic.text}</p>
                {topic.chainTrail && topic.chainTrail.length > 1 && (
                  <div className="flex flex-wrap items-center gap-0.5 text-[8px] text-slate-500">
                    {topic.chainTrail.map((step: any, si: number) => (
                      <span key={step.id} className="flex items-center gap-0.5 min-w-0">
                        {si > 0 && <span className="text-slate-600">→</span>}
                        <span className="truncate max-w-[100px]" title={step.title}>{step.title}</span>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-1">
                  <span className="text-[7px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-800/80 text-cyan-400/90 border border-slate-600/50">{phaseLabel}</span>
                  {tPhase !== 'post' && !isPost && topic.predicted_time && (
                    <span className="text-[7px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {topic.isPeakSoon ? 'Peak soon' : 'Event start soon'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-1">
                  {tPhase === 'pre' ? (
                    <span className="text-[8px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded font-mono border border-rose-500/20 flex items-center gap-1">
                      <Clock className="w-2 h-2" /> ETA: {formatDate(getEventDate(topic))}
                    </span>
                  ) : tPhase === 'active' ? (
                    <span className="text-[8px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded font-mono border border-cyan-500/20 flex items-center gap-1">
                      <Activity className="w-2 h-2" /> STARTED: {formatDate(getEventDate(topic))}
                    </span>
                  ) : tPhase === 'post' ? (
                    <span className="text-[8px] bg-slate-500/20 text-slate-400 px-1.5 py-0.5 rounded font-mono border border-slate-500/20 flex items-center gap-1">
                      <HistoryIcon className="w-2 h-2" /> OCCURRED: {formatDate(getEventDate(topic))}
                    </span>
                  ) : null}
                  {topic.duration_days && (
                    <span className="text-[8px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-mono border border-amber-500/30">
                      Duration: {topic.duration_days} Days
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between mt-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenTopic(topic); }}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[8px] font-bold text-slate-300 rounded flex items-center gap-1 transition-all border border-slate-700/50"
                  >
                    <Layers className="w-2.5 h-2.5" /> Intel Report
                  </button>
                  {isCalamityCategory(topic.category) && (
                    <span className={`text-[8px] font-mono font-bold uppercase tracking-tighter ${isPost ? 'text-slate-400' : 'text-rose-400'}`}>
                      {isPost ? 'POST-EVENT' : `Impact ${topic.impactScore || 5}/10`}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="glass rounded-2xl p-4 border border-slate-700/30 flex flex-col gap-3 mt-auto">
        <p className="text-[10px] text-slate-400 text-center italic">
          Smart Analysis: {filteredItems.filter(f => isCalamityCategory(f.category)).length} Active Alerts Found
        </p>
        <Link to="/news" className="flex items-center justify-center gap-2 w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[10px] font-bold uppercase text-cyan-400 transition-colors">
          <BrainCircuit className="w-3.5 h-3.5" /> Open News Analytics Hub
        </Link>
      </div>
    </div>
  );
}

function MapToggles({ active, onChange, styles }: { active: string; onChange: (s: string) => void; styles: Record<string, { label: string }> }) {
  return (
    <div className="absolute top-3 right-3 z-[1000] glass-light rounded-lg p-1 flex gap-1 border border-slate-700/50">
      {Object.entries(styles).map(([key, val]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-all ${active === key ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-500 hover:text-slate-300 border border-transparent'
            }`}
        >
          {val.label}
        </button>
      ))}
    </div>
  );
}

function ActionDock({
  consolePhase,
  onOpenIngestion,
}: {
  consolePhase: 'pre' | 'active' | 'post';
  onOpenIngestion: () => void;
}) {
  const { selectedDisaster, addToast, setUnifiedDashboardRegion } = useData();

  if (!selectedDisaster) return (
    <div className="glass rounded-2xl p-4 border border-slate-700/30 flex flex-col sm:flex-row items-center justify-between gap-3 min-h-20 mt-auto">
      <span className="text-[10px] text-slate-500 uppercase tracking-widest animate-pulse text-center">
        Tactical console idle. Select a card for regional actions.
      </span>
      <button
        onClick={onOpenIngestion}
        className="px-4 py-2 bg-cyan-600/90 hover:bg-cyan-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-cyan-900/20"
      >
        <BrainCircuit className="w-3.5 h-3.5" /> Social Media Intake
      </button>
    </div>
  );

  const isPost = consolePhase === 'post';
  const phase = consolePhase;

  return (
    <div className={`mt-auto glass rounded-2xl p-4 border flex flex-col gap-4 ${isPost ? 'border-slate-500/30' : 'border-cyan-500/30'}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isPost ? 'bg-slate-500/10' : 'bg-cyan-500/10'}`}>
            {isPost ? <HistoryIcon className="w-5 h-5 text-slate-400" /> : <BrainCircuit className="w-5 h-5 text-cyan-400" />}
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-200 uppercase tracking-wider">{selectedDisaster.Disaster_Type} in {selectedDisaster.Location?.City}</div>
            <div className="text-[8px] text-slate-500 font-mono">ID: {selectedDisaster.Disaster_ID} • {isPost ? 'Status: Recovery' : phase === 'pre' ? 'Status: Forecast' : `MAG: ${selectedDisaster.Magnitude}`}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={() => {
              const city = selectedDisaster.Location?.City;
              if (city) {
                setUnifiedDashboardRegion(city);
                addToast(`Regional filters aligned to ${city} across Analytics, Priority, and Leakage.`, 'success', '/analytics');
              }
            }}
            className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-lg text-[9px] font-bold uppercase tracking-widest border border-slate-600/40"
          >
            Sync region filters
          </button>
          {!isPost && (
            <button
              onClick={() => addToast('Broadcasting urgent catastrophe alerts to regional policyholders...', 'warning')}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-rose-900/20"
            >
              <Send className="w-3.5 h-3.5" /> Broadcast Alert
            </button>
          )}
          {!isPost && (
            <button
              onClick={onOpenIngestion}
              className="px-4 py-2 bg-cyan-600/90 hover:bg-cyan-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-cyan-900/20"
            >
              <BrainCircuit className="w-3.5 h-3.5" /> Social Media Intake
            </button>
          )}
          {isPost && (
            <button
              onClick={() => addToast('Compiling final damage assessment and loss report...', 'info')}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2"
            >
              <FileText className="w-3.5 h-3.5" /> Damage Audit
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => {
            addToast('Scanning database for High Priority/Critical exposure cases...', 'info');
            setTimeout(() => {
              addToast('High Priority Cases Report generated.', 'success', '/priority');
            }, 1500);
          }}
          className="flex-1 py-2.5 bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-xl text-[9px] font-bold uppercase text-slate-300 flex items-center justify-center gap-2 transition-all"
        >
          <ClipboardList className="w-3.5 h-3.5 text-cyan-400" /> High Priority
        </button>
        <button
          onClick={() => {
            addToast('Initiating automated reserve review for regional claim surge...', 'info');
            setTimeout(() => {
              addToast('Reserve Review Financial Projections ready.', 'success', '/analytics');
            }, 1500);
          }}
          className="flex-1 py-2.5 bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-xl text-[9px] font-bold uppercase text-slate-300 flex items-center justify-center gap-2 transition-all"
        >
          <Wallet className="w-3.5 h-3.5 text-amber-400" /> Reserve Review
        </button>
        <button
          onClick={() => {
            if (isPost) {
              addToast('Initiating post-calamity fraud and leakage detection...', 'info');
              setTimeout(() => addToast('Leakage audit complete.', 'success', '/leakages'), 1500);
            } else {
              addToast('Activating and dispatching regional field teams...', 'success');
            }
          }}
          className="flex-1 py-2.5 bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-xl text-[9px] font-bold uppercase text-slate-300 flex items-center justify-center gap-2 transition-all"
        >
          {isPost ? <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> : <Truck className="w-3.5 h-3.5 text-emerald-400" />}
          {isPost ? 'Leakage Audit' : 'Mobilize Teams'}
        </button>
      </div>
    </div>
  );
}

export default function LiveIntelligence() {
  const {
    disasters,
    selectedDisaster,
    policyHolders,
    llmData,
    theme,
    setSelectedDisaster,
    managedCities,
    globalRegion,
  } = useData();
  const [mapStyle, setMapStyle] = useState(theme === 'light' ? 'standard' : 'dark');
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'pre' | 'active' | 'post'>('all');
  const [selectedTopic, setSelectedTopic] = useState<any>(null);
  const [selectedNews, setSelectedNews] = useState<any>(null);
  const [showIngestionModal, setShowIngestionModal] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showSatellite, setShowSatellite] = useState(false);
  /** Keeps metrics / dock aligned with the IntelliFeed card you selected (avoids demo disaster Date skew). */
  const [liveConsolePhase, setLiveConsolePhase] = useState<'pre' | 'active' | 'post' | null>(null);

  useEffect(() => {
    setMapStyle(theme === 'light' ? 'standard' : 'dark');
  }, [theme]);

  const intelPhase: 'pre' | 'active' | 'post' =
    liveConsolePhase ?? (selectedDisaster ? getEventTemporalPhase(selectedDisaster.Date) : 'active');

  const satelliteNotAllowed = intelPhase === 'pre';

  useEffect(() => {
    if (satelliteNotAllowed) setShowSatellite(false);
  }, [satelliteNotAllowed]);

  const processedNews = useMemo(() => {
    return llmData.map(item => {
      let lat = CITY_COORDS[item.city as DemoCity]?.[0];
      let lng = CITY_COORDS[item.city as DemoCity]?.[1];

      if (lat === undefined || lng === undefined) {
        const ph = policyHolders.find(p => p.city === item.city);
        if (ph) {
          lat = ph.latitude;
          lng = ph.longitude;
        }
      }

      return {
        ...item,
        isManaged: managedCities.has(item.city),
        lat,
        lng,
        impactScore: isCalamityCategory(item.category) ? stableImpactScore(item.id, item.title) : null
      };
    }).filter(item => item.lat !== undefined && item.lng !== undefined);
  }, [llmData, managedCities, policyHolders]);

  const aggregatedNews = useMemo(() => {
    type Row = (typeof processedNews)[number];
    const chainBuckets: Record<string, Row[]> = {};
    const outsideChains: Row[] = [];

    for (const item of processedNews) {
      if (item.category === 'news_alert' && item.event_chain_id) {
        if (!chainBuckets[item.event_chain_id]) chainBuckets[item.event_chain_id] = [];
        chainBuckets[item.event_chain_id].push(item);
      } else {
        outsideChains.push(item);
      }
    }

    const buildChainTopic = (reps: Row[]) => {
      const sortedDesc = [...reps].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      const sortedTrail = [...reps].sort((a, b) => {
        const oa = a.event_chain_order ?? 999;
        const ob = b.event_chain_order ?? 999;
        if (oa !== ob) return oa - ob;
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });
      const latest = sortedDesc[0];
      const label = reps[0]?.event_chain_label || `${latest.city}: linked hazard trail`;
      const isPostEvent = reps.every((r) => r.isPostEvent);
      let predicted_time: string | undefined;
      const now = Date.now();
      for (const r of reps) {
        if (r.predicted_time && new Date(r.predicted_time).getTime() > now) {
          if (!predicted_time || new Date(r.predicted_time) < new Date(predicted_time)) {
            predicted_time = r.predicted_time;
          }
        }
      }
      if (isPostEvent) predicted_time = undefined;
      return {
        ...latest,
        title: label,
        event_chain_id: reps[0].event_chain_id,
        chainTrail: sortedTrail,
        reports: sortedDesc,
        reportCount: reps.length,
        timestamp: sortedDesc[0].timestamp,
        isPostEvent,
        predicted_time,
        intelNarrative: latest.intelNarrative,
        text: sortedTrail.map((r) => r.title).join(' → '),
      };
    };

    const preReleasedFromChains: Row[] = [];
    const chainTopics: ReturnType<typeof buildChainTopic>[] = [];
    for (const reps of Object.values(chainBuckets)) {
      const candidate = buildChainTopic(reps);
      if (getAggregatedFeedPhase(candidate) === 'pre') {
        reps.forEach((r) =>
          preReleasedFromChains.push({
            ...r,
            event_chain_id: undefined,
            event_chain_label: undefined,
            event_chain_order: undefined,
          })
        );
      } else {
        chainTopics.push(candidate);
      }
    }

    /** Future (forecast) rows: never merge by title — no “similar” grouping. Current/past singletons may still dedupe by city+title. */
    const singletonGroups: Record<string, any> = {};
    for (const item of [...outsideChains, ...preReleasedFromChains]) {
      const p = getFeedItemPhase(item);
      const key = p === 'pre' ? `${item.city}-${item.title}-${item.id}` : `${item.city}-${item.title}`;
      if (!singletonGroups[key]) {
        singletonGroups[key] = {
          ...item,
          reports: [item],
          reportCount: 1,
        };
      } else {
        singletonGroups[key].reports.push(item);
        singletonGroups[key].reportCount++;
        singletonGroups[key].isPostEvent = Boolean(singletonGroups[key].isPostEvent || item.isPostEvent);
        if (singletonGroups[key].isPostEvent) {
          singletonGroups[key].predicted_time = undefined;
        }
      }
    }

    return [...Object.values(singletonGroups), ...chainTopics];
  }, [processedNews]);

  const handleCardClick = (topic: any) => {
    const feedPhase = getAggregatedFeedPhase(topic);
    setLiveConsolePhase(feedPhase);

    const pastIntel = Boolean(topic.isPostEvent) || feedPhase === 'post';
    if (pastIntel && topic.city) {
      const catalog = disasters.find((d) => d.Location?.City === topic.city);
      const pastDate =
        (topic.timestamp as string) ||
        (topic.reports?.[0]?.timestamp as string) ||
        (topic.date as string);
      const lat0 = topic.lat ?? CITY_COORDS[topic.city as DemoCity]?.[0];
      const lng0 = topic.lng ?? CITY_COORDS[topic.city as DemoCity]?.[1];
      setSelectedDisaster({
        Disaster_ID: catalog?.Disaster_ID ?? 88000 + (topic.id ?? 0),
        Disaster_Type: catalog?.Disaster_Type || 'Historical review',
        Location:
          catalog?.Location ||
          ({
            Country: topic.country || '',
            City: topic.city,
            Latitude: lat0 ?? 0,
            Longitude: lng0 ?? 0,
          } as any),
        Magnitude: catalog?.Magnitude ?? 5,
        Date: pastDate || new Date(Date.now() - 72 * 3600000).toISOString(),
        Fatalities: catalog?.Fatalities ?? 0,
        Economic_Loss_USD: catalog?.Economic_Loss_USD ?? 0,
      } as any);
      return;
    }

    const content = (topic.title + ' ' + (topic.text || '')).toLowerCase();
    const matchingDisaster = disasters.find(d => {
      if (d.Location.City !== topic.city) return false;
      const type = d.Disaster_Type.toLowerCase();
      if (type.includes('earthquake') && (content.includes('seismic') || content.includes('quake'))) return true;
      if (type.includes('hurricane') && (content.includes('wind') || content.includes('storm') || content.includes('hurricane'))) return true;
      if (type.includes('flood') && (content.includes('rain') || content.includes('water') || content.includes('flood'))) return true;
      if (type.includes('wildfire') && (content.includes('fire') || content.includes('smoke') || content.includes('wildfire'))) return true;
      return false;
    }) || disasters.find(d => d.Location.City === topic.city);

    if (matchingDisaster) {
      setSelectedDisaster(matchingDisaster);
    } else if (topic.lat && topic.lng) {
      const eventDate = topic.isPostEvent
        ? (topic.timestamp || topic.date)
        : (topic.predicted_time || topic.timestamp || topic.date);
      setSelectedDisaster({
        Disaster_ID: topic.id + 10000,
        Disaster_Type: topic.category === 'news_alert' ? 'Active Threat' : 'Area Update',
        Magnitude: parseFloat(topic.impactScore) || 5,
        Location: { Country: topic.country || '', City: topic.city, Latitude: topic.lat, Longitude: topic.lng },
        Date: eventDate
      } as any);
    }
  };

  const handleActivateFullCrisis = () => {
    setSelectedNews(null);
    setSelectedTopic(null);
  };

  const metrics = useMemo(() => {
    const activeDisasters = selectedDisaster ? [selectedDisaster] : disasters;
    const phase = liveConsolePhase ?? (selectedDisaster ? getEventTemporalPhase(selectedDisaster.Date) : 'active');
    const isPost = phase === 'post';

    const radiusKm = (d: { Magnitude: number }) => d.Magnitude * EXPOSURE_RADIUS_KM_PER_MAGNITUDE;

    /** Global = sum of per-metro affected (each holder counted under their city’s scenario only). */
    let vulnerablePopulation: number;
    if (selectedDisaster?.Location) {
      vulnerablePopulation = policyHolders.filter(
        (p) =>
          getDistance(
            selectedDisaster.Location.Latitude,
            selectedDisaster.Location.Longitude,
            p.latitude,
            p.longitude
          ) <= radiusKm(selectedDisaster)
      ).length;
    } else {
      vulnerablePopulation = disasters.reduce((acc, d) => {
        if (!d.Location) return acc;
        const inMetro = policyHolders.filter((p) => p.city === d.Location.City);
        return (
          acc +
          inMetro.filter(
            (p) =>
              getDistance(d.Location.Latitude, d.Location.Longitude, p.latitude, p.longitude) <= radiusKm(d)
          ).length
        );
      }, 0);
    }

    const intensity = activeDisasters.reduce((acc, d) => acc + d.Magnitude, 0) / (activeDisasters.length || 1);

    const surge = Math.min(100, Math.round((activeDisasters.length * (selectedDisaster ? 40 : 15)) * (intensity / 5)));
    const estClaims = Math.round(vulnerablePopulation * (selectedDisaster ? 0.75 : 0.45));
    const avgClaim = 12500 + (intensity * 2000);
    const totalLoss = estClaims * avgClaim;

    return {
      isRegional: !!selectedDisaster,
      regionName: selectedDisaster ? selectedDisaster.Location.City : 'Global',
      isPost,
      surge,
      claims: estClaims,
      vulnerable: vulnerablePopulation,
      loss: totalLoss,
      avgClaim,
      readiness: isPost ? 100 : Math.max(5, 95 - (surge / 1.5)),
      radarData: [
        { subject: 'Financial', A: Math.min(100, (totalLoss / 1000000) * 10), fullMark: 100 },
        { subject: 'Operational', A: Math.max(10, isPost ? 100 : 100 - surge), fullMark: 100 },
        { subject: 'Legal', A: Math.min(100, surge * 0.8), fullMark: 100 },
        { subject: 'Human', A: Math.min(100, vulnerablePopulation / 10), fullMark: 100 },
        { subject: 'Supply', A: 70 - (surge / 2), fullMark: 100 },
      ],
      surgeHistory: Array.from({ length: 6 }).map((_, i) => ({
        name: `T-${(5 - i) * 4}`,
        value: Math.max(10, surge * (0.4 + (i * 0.12)))
      }))
    };
  }, [policyHolders, disasters, selectedDisaster, liveConsolePhase]);

  const chartTextColor = theme === 'light' ? '#475569' : '#94a3b8';

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 overflow-visible pr-0 md:pr-2">
      <IncidentFeed
        phaseFilter={phaseFilter}
        setPhaseFilter={setPhaseFilter}
        aggregatedNews={aggregatedNews}
        onSelectCard={handleCardClick}
        onOpenTopic={setSelectedTopic}
      />

      <div className="flex-1 flex flex-col gap-3 min-h-0">
        <div className="flex-1 h-[400px] xl:h-full glass rounded-2xl overflow-hidden relative border border-slate-700/30">
          <MapContainer center={[20, 0]} zoom={2} className={`w-full h-full ${showSatellite ? 'grayscale contrast-125' : ''}`} zoomControl={false}>
            <MapUpdater
              key={selectedDisaster ? selectedDisaster.Disaster_ID : globalRegion}
              lat={selectedDisaster?.Location?.Latitude}
              lng={selectedDisaster?.Location?.Longitude}
              region={globalRegion}
            />
            <TileLayer url={showSatellite ? MAP_STYLES.satellite.url : MAP_STYLES[mapStyle as keyof typeof MAP_STYLES].url} />
            {(mapStyle === 'satellite' || showSatellite) && <TileLayer url={LABEL_LAYER} />}

            {showHeatmap && policyHolders.slice(0, 1000).map((p, i) => (
              <Circle
                key={`heat-${i}`}
                center={[p.latitude, p.longitude]}
                radius={2000}
                pathOptions={{ color: '#f43f5e', fillColor: '#f43f5e', fillOpacity: 0.1, weight: 0 }}
              />
            ))}

            {selectedDisaster && selectedDisaster.Location && !isNaN(selectedDisaster.Location.Latitude) && (
              <>
                <Circle
                  center={[selectedDisaster.Location.Latitude, selectedDisaster.Location.Longitude]}
                  radius={selectedDisaster.Magnitude * 15000}
                  pathOptions={{ color: '#eab308', fillColor: '#eab308', fillOpacity: 0.05, weight: 1, dashArray: '5 5' }}
                />
                <Circle
                  center={[selectedDisaster.Location.Latitude, selectedDisaster.Location.Longitude]}
                  radius={selectedDisaster.Magnitude * 5000}
                  pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.1, weight: 2 }}
                />
              </>
            )}

            {disasters.filter(d => d.Location?.Latitude && d.Location?.Longitude).map(d => (
              <Circle key={d.Disaster_ID} center={[d.Location.Latitude, d.Location.Longitude]} radius={50000}
                pathOptions={{
                  color: d.Disaster_ID === selectedDisaster?.Disaster_ID ? '#06b6d4' : '#475569',
                  fillColor: d.Disaster_ID === selectedDisaster?.Disaster_ID ? '#06b6d4' : '#475569',
                  fillOpacity: d.Disaster_ID === selectedDisaster?.Disaster_ID ? 0.6 : 0.2,
                  weight: d.Disaster_ID === selectedDisaster?.Disaster_ID ? 2 : 1,
                }}
              />
            ))}
            {processedNews.map((news, idx) => (
              <Marker
                key={`news-${idx}`}
                position={[news.lat, news.lng]}
                icon={L.divIcon({
                  className: 'custom-div-icon',
                  html: `<div class="p-1 rounded-full border border-white/50 shadow-lg ${news.category === 'news_alert' ? 'bg-rose-500' : 'bg-emerald-500'} animate-pulse"></div>`,
                  iconSize: [12, 12],
                  iconAnchor: [6, 6]
                })}
              >
                <Tooltip direction="top" offset={[0, -5]} opacity={1}>
                  <div className="text-[10px] p-1">
                    <div className="font-bold">{news.title}</div>
                    <div className="text-slate-500">{news.city}</div>
                  </div>
                </Tooltip>
              </Marker>
            ))}
          </MapContainer>
          <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={`p-2 rounded-lg backdrop-blur-md border transition-all flex items-center gap-2 ${showHeatmap ? 'bg-rose-500/20 border-rose-500 text-rose-400' : 'glass-light border-slate-700/30 text-slate-400'}`}
            >
              <Users className="w-4 h-4" />
              <span className="text-[9px] font-bold uppercase tracking-widest hidden xl:inline">Exposure Heatmap</span>
            </button>
            {/* <button
              type="button"
              disabled={satelliteNotAllowed}
              title={satelliteNotAllowed ? 'Satellite damage imagery is available once an event is active or has occurred (not for forecast-only scenarios).' : 'Toggle satellite base layer for damage context'}
              onClick={() => !satelliteNotAllowed && setShowSatellite(!showSatellite)}
              className={`p-2 rounded-lg backdrop-blur-md border transition-all flex items-center gap-2 ${satelliteNotAllowed
                  ? 'opacity-40 cursor-not-allowed border-slate-700/30 text-slate-500'
                  : showSatellite
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                    : 'glass-light border-slate-700/30 text-slate-400'
                }`}
            >
              <Layers className="w-4 h-4" />
              <span className="text-[9px] font-bold uppercase tracking-widest hidden xl:inline">Satellite Damage View</span>
            </button> */}
          </div>

          <MapToggles active={mapStyle} onChange={setMapStyle} styles={MAP_STYLES} />

          <div className="absolute bottom-3 left-3 z-[1000] flex flex-col gap-2 pointer-events-none">
            <div className="glass-light rounded-lg p-2 border border-cyan-500/20 backdrop-blur-md flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${metrics.isPost ? 'bg-slate-500/10' : 'bg-cyan-500/10 animate-pulse'}`}>
                {metrics.isPost ? <HistoryIcon className="w-4 h-4 text-slate-400" /> : <BrainCircuit className="w-4 h-4 text-cyan-400" />}
              </div>
              <div>
                <div className={`text-[8px] font-bold uppercase tracking-widest ${metrics.isPost ? 'text-slate-400' : 'text-cyan-400'}`}>
                  {metrics.isPost ? 'Recovery Audit' : 'Neural Link'}
                </div>
                <div className="text-[9px] text-slate-300">
                  {metrics.isPost ? 'Post-event damage analysis' : 'Cascading risk prediction active'}
                </div>
              </div>
            </div>

            {selectedDisaster && (
              <button
                onClick={() => {
                  setLiveConsolePhase(null);
                  setSelectedDisaster(null);
                }}
                className="glass-light rounded-lg p-2 border border-emerald-500/30 backdrop-blur-md flex items-center justify-between gap-3 pointer-events-auto hover:bg-emerald-500/10 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Back to Global View</span>
                </div>
              </button>
            )}

            <Link to="/analytics" className="glass-light rounded-lg p-2 border border-amber-500/30 backdrop-blur-md flex items-center justify-between gap-3 pointer-events-auto hover:bg-amber-500/10 transition-colors group">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-400" />
                <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest">View Full Analytics</span>
              </div>
              <ArrowRight className="w-3 h-3 text-amber-500 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        <div className="h-auto glass rounded-2xl p-4 flex flex-col xl:flex-row gap-4 border border-slate-700/30 overflow-visible">
          <div className="flex-1 min-w-[200px] min-h-[128px] h-32 relative group">
            <ResponsiveContainer width="100%" height="100%" minHeight={128} debounce={50}>
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={metrics.radarData}>
                <PolarGrid stroke={theme === 'light' ? '#cbd5e1' : '#334155'} />
                <PolarAngleAxis dataKey="subject" fontSize={7} tick={{ fill: chartTextColor }} />
                <Radar name="Risk Index" dataKey="A" stroke={metrics.isPost ? '#94a3b8' : "#06b6d4"} fill={metrics.isPost ? '#94a3b8' : "#06b6d4"} fillOpacity={0.3} />
                <RechartsTooltip contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#0f172a', border: '1px solid #cbd5e1', fontSize: '8px', color: chartTextColor }} />
              </RadarChart>
            </ResponsiveContainer>
            <div className="absolute top-0 left-0 flex flex-col pointer-events-none">
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Vector Analysis</span>
              <span className={`text-[8px] font-bold uppercase tracking-widest ${metrics.isRegional ? 'text-amber-400' : 'text-cyan-400'}`}>
                [{metrics.regionName} {metrics.isPost ? 'RECOVERY' : 'IMPACT'}]
              </span>
            </div>
          </div>

          <div className="flex-1 min-w-[200px] min-h-[128px] h-32 relative group">
            <ResponsiveContainer width="100%" height="100%" minHeight={128} debounce={50}>
              <BarChart data={metrics.surgeHistory}>
                <XAxis dataKey="name" hide />
                <RechartsTooltip contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#0f172a', border: '1px solid #cbd5e1', fontSize: '8px', color: chartTextColor }} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                <Bar dataKey="value" fill={metrics.isPost ? '#64748b' : "#06b6d4"} radius={[2, 2, 0, 0]}>
                  {metrics.surgeHistory.map((_, index) => (
                    <Cell key={`cell-${index}`} fillOpacity={0.3 + (index * 0.15)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="absolute top-0 left-0 text-[8px] font-bold text-slate-500 uppercase tracking-tighter pointer-events-none">
              {metrics.isPost ? 'Claim Finalization' : 'Claims Velocity'}
            </div>
          </div>

          <div className="flex-1 grid grid-cols-3 xl:grid-cols-2 gap-2 min-w-0 relative z-10 overflow-visible isolate">
            {([
              { hintKey: 'surge', label: (phaseFilter === 'post' || metrics.isPost) ? 'Actual Surge' : 'Predicted Surge', val: `${metrics.surge}%`, color: (phaseFilter === 'post' || metrics.isPost) ? 'text-slate-300' : 'text-cyan-400', icon: <TrendingUp className="w-3 h-3" /> },
              { hintKey: 'loss', label: metrics.isPost ? 'Confirmed Loss' : 'Total Est. Loss', val: `$${(metrics.loss / 1000).toFixed(0)}K`, color: 'text-rose-400', icon: <AlertCircle className="w-3 h-3" /> },
              { hintKey: 'severity', label: 'Avg Severity', val: `$${metrics.avgClaim.toFixed(0)}`, color: 'text-amber-400', icon: <FileWarning className="w-3 h-3" /> },
              { hintKey: 'pop', label: 'Affected Pop', val: metrics.vulnerable, color: theme === 'light' ? 'text-slate-700' : 'text-slate-200', icon: <Users className="w-3 h-3" /> },
              { hintKey: 'readiness', label: metrics.isPost ? 'Audit Complete' : 'Readiness', val: `${metrics.readiness.toFixed(0)}%`, color: 'text-emerald-400', icon: <ShieldAlert className="w-3 h-3" /> },
              { hintKey: 'claims', label: 'Total Claims', val: metrics.claims, color: 'text-rose-400', icon: <Layers className="w-3 h-3" /> },
            ] as const).map((k) => (
              <div key={k.label} className="glass-light rounded-lg p-2 border border-slate-700/40 flex flex-col justify-between hover:border-slate-400 transition-all min-h-[48px] relative overflow-visible">
                <div className="text-[8px] text-slate-500 uppercase font-bold tracking-tighter flex items-center gap-0.5 min-w-0">
                  {k.icon}
                  <span className="truncate">{k.label}</span>
                  <MetricHint hintKey={k.hintKey} label={k.label} />
                </div>
                <div className={`text-sm font-mono font-bold ${k.color}`}>{k.val}</div>
              </div>
            ))}
          </div>
        </div>

        <ActionDock
          consolePhase={intelPhase}
          onOpenIngestion={() => setShowIngestionModal(true)}
        />
      </div>

      <AnimatePresence>
        {selectedTopic && (
          <TopicModal
            topic={selectedTopic}
            onClose={() => setSelectedTopic(null)}
            onSelectReport={(report) => setSelectedNews(report)}
          />
        )}
        {selectedNews && (
          <NewsModal
            item={selectedNews}
            onClose={() => setSelectedNews(null)}
            onProtocolActivated={handleActivateFullCrisis}
          />
        )}
      </AnimatePresence>
      <MultiModalIngestionModal
        open={showIngestionModal}
        onClose={() => setShowIngestionModal(false)}
      />
    </div>
  );
}
