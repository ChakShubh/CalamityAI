import { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';
import disasters from '../data/data.json';
import llmData from '../data/LLM_DATA.json';
import policyHolders from '../data/policy_holders.json';
import pastClaims from '../data/past_claims.json';
import infraHealth from '../data/infrastructure_health.json';
import { hashString } from '../utils/regionScale';
import { DEMO_CITIES, CITY_COUNTRY, type DemoCity } from '../constants/demoGeography';
import { processSocialMediaSignal } from '../utils/agenticIngestion';
import type { RagCorpusItem } from '../utils/ragNewsChat';

const DEMO_HUBS: DemoCity[] = ['Miami', 'Mumbai', 'Jakarta', 'Sydney'];
const COUNTRY_TO_HUB: Record<string, DemoCity> = {
  usa: 'Miami',
  'united states': 'Miami',
  india: 'Mumbai',
  indonesia: 'Jakarta',
  australia: 'Sydney',
};
const CITY_KEYWORD_TO_HUB: Record<string, DemoCity> = {
  miami: 'Miami',
  florida: 'Miami',
  mumbai: 'Mumbai',
  bombay: 'Mumbai',
  jakarta: 'Jakarta',
  sydney: 'Sydney',
};

function bridgeToDashboardCity(event: RagCorpusItem): { mappedCity: DemoCity; originalCity: string | null; bridgeReason: string } {
  const original = String(event.city || '').trim();
  if (DEMO_CITIES.has(original)) {
    return { mappedCity: original as DemoCity, originalCity: null, bridgeReason: 'direct' };
  }

  const country = String(event.country || '').trim().toLowerCase();
  const countryHub = COUNTRY_TO_HUB[country];
  if (countryHub) {
    return { mappedCity: countryHub, originalCity: original || null, bridgeReason: `country:${country}` };
  }

  const narrative = `${event.title} ${event.summary} ${event.text}`.toLowerCase();
  for (const [keyword, hub] of Object.entries(CITY_KEYWORD_TO_HUB)) {
    if (narrative.includes(keyword)) {
      return { mappedCity: hub, originalCity: original || null, bridgeReason: `keyword:${keyword}` };
    }
  }

  // Deterministic fallback hub for ambiguous global mentions.
  const idx = Math.abs(hashString(`${event.id}-${event.title}`)) % DEMO_HUBS.length;
  return { mappedCity: DEMO_HUBS[idx], originalCity: original || null, bridgeReason: 'deterministic_fallback' };
}

export interface DisasterEvent {
  Disaster_ID: number;
  Disaster_Type: string;
  Location: { Country: string; City: string; Latitude: number; Longitude: number };
  Magnitude: number;
  Date: string;
  Fatalities: number;
  Economic_Loss_USD: number;
  /** When set, `Date` is derived at runtime as now + offset so the scenario stays “imminent” in demos. */
  Demo_Start_Offset_Hours?: number;
}

export interface LLMItem {
  id: number;
  city: string;
  title: string;
  text: string;
  summary: string;
  category: string;
  severity: string;
  source: string;
  timestamp: string;
  date: string;
  predicted_time?: string;
  duration_days?: number;
  country?: string;
  isPostEvent?: boolean;
  intelNarrative?: string;
  /** Same id on linked rows (e.g. heavy rain → flood) so IntelliFeed treats one logical event trail. */
  event_chain_id?: string;
  /** Short label for the merged feed card / topic. */
  event_chain_label?: string;
  /** Sort order within a chain for timeline display (1 = earliest stage). */
  event_chain_order?: number;
}

export interface PolicyHolder {
  policy_id?: string;
  name: string;
  address?: string;
  city: string;
  country?: string;
  longitude: number;
  latitude: number;
  policy_type: string;
  max_cover_amount: number;
  claimed_amount?: number;
  status?: string;
}

export interface PastClaim {
  calamity_type: string;
  severity: string;
  total_policies: number;
  affected_individuals: number;
  fatalities: number;
  total_claims: number;
  amount_applied: number;
  amount_disbursed: number;
  year?: number;
  city?: string;
}

export interface InfraHealth {
  scenario_id: string;
  region: string;
  server_load: number;
  bandwidth_utilization: number;
  adjusters_available: number;
  api_latency_ms: number;
  status: string;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
  visible: boolean;
  isRead: boolean;
  link?: string;
}

interface DataContextType {
  disasters: DisasterEvent[];
  llmData: LLMItem[];
  /** Full merged corpus for AI News Analytics only (managed + global). Live Intelligence uses `llmData` only. */
  newsAnalyticsCorpus: LLMItem[];
  /** Ingested early-warning items produced by the Aegis Multi-Modal engine. */
  agenticEvents: LLMItem[];
  policyHolders: PolicyHolder[];
  pastClaims: PastClaim[];
  infraHealth: InfraHealth[];
  selectedDisaster: DisasterEvent | null;
  setSelectedDisaster: (d: DisasterEvent | null) => void;
  infraScenario: InfraHealth;
  setInfraScenarioById: (id: string) => void;
  toasts: ToastMessage[];
  addToast: (msg: string, type: 'success' | 'warning' | 'error' | 'info', link?: string) => void;
  removeToast: (id: string) => void;
  dismissToast: (id: string) => void;
  markAllAsRead: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  managedCities: Set<string>;
  globalRegion: string;
  setGlobalRegion: (region: string) => void;
  /** Managed metro in focus: selected disaster city wins, else region filter (null = all). */
  dashboardFocusCity: string | null;
  /** Sets region + canonical disaster for that city, or clears both for portfolio-wide view. */
  setUnifiedDashboardRegion: (city: string) => void;
  /** Append a synthetic multi-modal event into active corpus stream. */
  addSyntheticEvent: (event: RagCorpusItem) => LLMItem;
  /** Run multi-modal social signal verification and append a normalized early-warning event. */
  ingestSocialSignal: (postText: string, base64Image: string) => Promise<LLMItem | null>;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [selectedDisaster, setSelectedDisaster] = useState<DisasterEvent | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [agenticEvents, setAgenticEvents] = useState<LLMItem[]>([]);
  const defaultInfra = infraHealth.find(s => s.scenario_id === 'DEFAULT_NOMINAL')!;
  const [infraScenario, setInfraScenario] = useState<InfraHealth>(defaultInfra);
  const [globalRegion, setGlobalRegion] = useState<string>('All');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  const setInfraScenarioById = useCallback((id: string) => {
    const found = infraHealth.find(s => s.scenario_id === id);
    if (found) setInfraScenario(found);
  }, []);

  const addToast = useCallback((message: string, type: 'success' | 'warning' | 'error' | 'info', link?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type, visible: true, isRead: false, link }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t));
  }, []);

  const markAllAsRead = useCallback(() => {
    setToasts(prev => prev.map(t => ({ ...t, isRead: true })));
  }, []);

  const policyHoldersDemo = useMemo(
    () => (policyHolders as PolicyHolder[]).filter(p => DEMO_CITIES.has(p.city)),
    [policyHolders]
  );

  const managedCitiesSet = useMemo(
    () => new Set(policyHoldersDemo.map(p => p.city)),
    [policyHoldersDemo]
  );

  const addSyntheticEvent = useCallback((event: RagCorpusItem): LLMItem => {
    const nowIso = new Date().toISOString();
    const bridge = bridgeToDashboardCity(event);
    const mappedCountry = CITY_COUNTRY[bridge.mappedCity];
    const mappedTitle =
      bridge.originalCity && bridge.originalCity !== bridge.mappedCity
        ? `${event.title} [Mapped to ${bridge.mappedCity}]`
        : event.title;
    const mappedSummary =
      bridge.originalCity && bridge.originalCity !== bridge.mappedCity
        ? `${event.summary} Original detected city: ${bridge.originalCity}; routed to ${bridge.mappedCity} for dashboard sync.`
        : event.summary;
    const mappedText =
      bridge.originalCity && bridge.originalCity !== bridge.mappedCity
        ? `${event.text}\nRouting note: "${bridge.originalCity}" mapped to "${bridge.mappedCity}" (${bridge.bridgeReason}) for shared dashboard visibility.`
        : event.text;
    const normalized: LLMItem = {
      id: event.id,
      city: bridge.mappedCity,
      country: mappedCountry,
      title: mappedTitle,
      text: mappedText,
      summary: mappedSummary,
      category: event.category,
      severity: event.severity,
      source: event.source,
      timestamp: nowIso,
      date: nowIso.slice(0, 10),
      predicted_time: new Date(Date.now() + 3 * 3600000).toISOString(),
      duration_days: 1,
    };
    setAgenticEvents((prev) => [normalized, ...prev].slice(0, 200));
    return normalized;
  }, []);

  const ingestSocialSignal = useCallback(
    async (postText: string, base64Image: string): Promise<LLMItem | null> => {
      try {
        const event = await processSocialMediaSignal(postText, base64Image);
        return addSyntheticEvent(event);
      } catch {
        return null;
      }
    },
    [addSyntheticEvent]
  );

  const newsAnalyticsCorpus = useMemo(() => {
    const enrich = (item: LLMItem): LLMItem => ({
      ...item,
      country: item.country || CITY_COUNTRY[item.city as DemoCity] || 'Global',
    });
    const base = [...(llmData as LLMItem[]), ...agenticEvents].map(enrich);
    const byId = new Map<number, LLMItem>();
    for (const row of base) {
      if (!byId.has(row.id)) byId.set(row.id, row);
    }
    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [agenticEvents]);

  const processedLlmData = useMemo(() => {
    const cityToCountry: Record<string, string> = {
      ...CITY_COUNTRY,
      Miami: 'USA', Mumbai: 'India', Sydney: 'Australia', Jakarta: 'Indonesia',
    } as Record<string, string>;

    const buildIntelNarrative = (item: LLMItem, h: number): string => {
      const city = item.city;
      const t = item.text || '';
      const take = t.length > 180 ? t.slice(0, 177) + '…' : t;
      const variants = [
        `Field fusion cell (ref ${item.id}): ${take} — Underwriting requests exposure refresh for ${city} within 6h SLAs.`,
        `Cross-check with municipal sensors in ${city}: ${take} Adjusters on reserve; reserve factor +${(h % 5) + 1} for this corridor.`,
        `Telematics + weather merge for ${city}: ${take} Claims triage is prioritising verifiable property damage over travel delay.`,
        `Satellite + policy footprint overlay (${city}): ${take} Legal hold not triggered; document evidence standard applies.`,
        `Bureau hotline pattern for ${city}: ${take} Regional CAT lead notified; no duplicate event ID opened for same synoptic system.`,
        `Neural paraphrase [${item.id}]: ${take} Finance desk sees IBNR tick up only if loss ratio exceeds pre-season band for this metro.`,
      ];
      return variants[h % variants.length];
    };

    return [...(llmData as LLMItem[]), ...agenticEvents]
      .filter(item => DEMO_CITIES.has(item.city as DemoCity))
      .map(item => {
        const text = (item.title + ' ' + (item.text || '')).toLowerCase();
        
        // 1. Determine if it's a Post-Event (Damage Report)
        const isPostEvent = item.category === 'news_alert' && (
          text.includes('damage') || text.includes('casualty') || text.includes('cleanup') || 
          text.includes('destruction') || text.includes('recovery') || text.includes('bodies recovered')
        );

        // 2. Extract / Simulate Predicted Time
        let extractedPredictedTime = item.predicted_time;
        
        // Logical Fix: No "Starting Soon" for Past events
        if (isPostEvent) {
          extractedPredictedTime = undefined;
        } else if (!extractedPredictedTime) {
          const hoursMatch = text.match(/in (?:exactly )?(\d+) hours?/i);
          const soonMatch = text.match(/imminent|starting soon|next few hours/i);
          const peakMatch = text.match(/peak expected|maximum intensity soon/i);
          
          if (hoursMatch) {
            extractedPredictedTime = new Date(Date.now() + parseInt(hoursMatch[1], 10) * 3600000).toISOString();
          } else if (peakMatch) {
            extractedPredictedTime = new Date(Date.now() + 4 * 3600000).toISOString(); // Peak in 4h
          } else if (soonMatch) {
            extractedPredictedTime = new Date(Date.now() + 2 * 3600000).toISOString(); // 2h from now
          }
        }

        // 3. Determine Timestamp (Human Readable / Simulation)
        let finalTimestamp = item.timestamp || item.date;
        if (isPostEvent) {
          finalTimestamp = new Date(Date.now() - 36 * 3600000).toISOString();
        } else if (text.includes('expected in next 5 days') || text.includes('upcoming forecast') || item.id >= 3000) {
          // Future / Upcoming event (e.g. Jakarta/Sydney/Miami new ones)
          finalTimestamp = new Date(Date.now() + 120 * 3600000).toISOString();
          extractedPredictedTime = new Date(Date.now() + 144 * 3600000).toISOString();
        }

        // 4. Event Trail Logic (Connected Events) - Limited to single monsoon case
        let trailId = null;
        if (item.id === 2002 || text.includes('linked to the same monsoon cell')) {
           trailId = `${item.city}-monsoon-trail`;
        }

        const h = hashString(`intel-${item.id}-${item.city}`);
        
        return {
          ...item,
          country: item.country || cityToCountry[item.city] || 'Global',
          predicted_time: extractedPredictedTime,
          isPostEvent,
          isPeakSoon: !isPostEvent && text.includes('peak expected'),
          timestamp: finalTimestamp,
          trailId,
          intelNarrative: buildIntelNarrative(item, h),
        };
      });
  }, [agenticEvents]);

  const expandedDisasters = useMemo(() => {
    const baseDisasters = (disasters as DisasterEvent[])
      .filter(d => d.Disaster_Type !== 'Cyberattack' && d.Disaster_Type !== 'Software Outage')
      .filter(d => DEMO_CITIES.has(d.Location.City))
      .map(d => {
        const off = d.Demo_Start_Offset_Hours;
        if (typeof off === 'number' && Number.isFinite(off)) {
          return {
            ...d,
            Date: new Date(Date.now() + off * 3600000).toISOString(),
          };
        }
        return d;
      });
    const citiesWithDisaster = new Set(baseDisasters.map(d => d.Location.City));
    const newDisasters: DisasterEvent[] = [];
    let dId = 1000;

    // Map each managed city to its coordinates
    const cityCoords: Record<string, { lat: number, lng: number }> = {};
    policyHoldersDemo.forEach(p => {
      if (!cityCoords[p.city]) {
        cityCoords[p.city] = { lat: p.latitude, lng: p.longitude };
      }
    });

    // First, try to create disasters from active feed hazards (news alert + early warning)
    processedLlmData.forEach(item => {
      if ((item.category === 'news_alert' || item.category === 'early_warning') && !citiesWithDisaster.has(item.city)) {
        let type = '';
        const t = `${item.title} ${item.summary} ${item.text}`.toUpperCase();
        if (t.includes('EARTHQUAKE')) type = 'Earthquake';
        else if (t.includes('HURRICANE')) type = 'Hurricane';
        else if (t.includes('CYCLONE') || t.includes('TYPHOON')) type = 'Hurricane';
        else if (t.includes('WILDFIRE')) type = 'Wildfire';
        else if (t.includes('TSUNAMI')) type = 'Tsunami';
        else if (t.includes('FLOOD')) type = 'Flood';
        else if (t.includes('STORM') || t.includes('THUNDERSTORM')) type = 'Flood';
        else if (t.includes('LANDSLIDE')) type = 'Landslide';
        else if (t.includes('BLIZZARD')) type = 'Blizzard';
        else if (t.includes('HEATWAVE')) type = 'Heatwave';

        if (!type) return;

        const eventDate = item.isPostEvent
          ? (item.timestamp || item.date)
          : (item.predicted_time || item.timestamp || item.date);
        newDisasters.push({
          Disaster_ID: dId++,
          Disaster_Type: type,
          Location: {
            Country: 'Global',
            City: item.city,
            Latitude: cityCoords[item.city]?.lat || 0,
            Longitude: cityCoords[item.city]?.lng || 0
          },
          Magnitude: 4 + (hashString(`${item.id}-${item.city}`) % 4),
          Date: eventDate,
          Fatalities: 0,
          Economic_Loss_USD: 5000000
        });
        citiesWithDisaster.add(item.city);
      }
    });

    // Second, ensure ALL managed cities have at least one scenario
    Object.keys(cityCoords).forEach(city => {
      if (!citiesWithDisaster.has(city)) {
        newDisasters.push({
          Disaster_ID: dId++,
          Disaster_Type: 'Atmospheric Disturbance',
          Location: {
            Country: 'Global',
            City: city,
            Latitude: cityCoords[city].lat,
            Longitude: cityCoords[city].lng
          },
          Magnitude: 5.0,
          Date: new Date().toISOString(),
          Fatalities: 0,
          Economic_Loss_USD: 1000000
        });
        citiesWithDisaster.add(city);
      }
    });

    const combined = [...baseDisasters, ...newDisasters];
    const byCity = new Map<string, DisasterEvent[]>();
    for (const d of combined) {
      const city = d.Location.City;
      if (!byCity.has(city)) byCity.set(city, []);
      byCity.get(city)!.push(d);
    }
    const score = (x: DisasterEvent) => {
      let s = new Date(x.Date).getTime() / 1000;
      if (x.Disaster_Type === 'Atmospheric Disturbance') s -= 86400 * 365;
      s += x.Magnitude * 3600;
      return s;
    };
    return Array.from(byCity.values())
      .map((arr) =>
        arr.length === 0 ? null : arr.reduce((a, b) => (score(b) > score(a) ? b : a), arr[0])
      )
      .filter((d): d is DisasterEvent => d !== null);
  }, [processedLlmData, policyHoldersDemo]);

  const dashboardFocusCity = useMemo((): string | null => {
    const c = selectedDisaster?.Location?.City;
    if (c && managedCitiesSet.has(c)) return c;
    if (globalRegion !== 'All' && managedCitiesSet.has(globalRegion)) return globalRegion;
    return null;
  }, [selectedDisaster, globalRegion, managedCitiesSet]);

  const setUnifiedDashboardRegion = useCallback(
    (city: string) => {
      if (city === 'All') {
        setGlobalRegion('All');
        setSelectedDisaster(null);
        return;
      }
      setGlobalRegion(city);
      const d = expandedDisasters.find((x) => x.Location.City === city);
      if (d) setSelectedDisaster(d);
    },
    [expandedDisasters]
  );

  return (
    <DataContext.Provider value={{
      disasters: expandedDisasters,
      llmData: processedLlmData,
      newsAnalyticsCorpus,
      agenticEvents,
      policyHolders: policyHoldersDemo,
      pastClaims: pastClaims as PastClaim[],
      infraHealth: infraHealth as InfraHealth[],
      selectedDisaster,
      setSelectedDisaster,
      infraScenario,
      setInfraScenarioById,
      toasts,
      addToast,
      removeToast,
      dismissToast,
      markAllAsRead,
      theme,
      toggleTheme,
      managedCities: managedCitiesSet,
      globalRegion,
      setGlobalRegion,
      dashboardFocusCity,
      setUnifiedDashboardRegion,
      addSyntheticEvent,
      ingestSocialSignal,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
