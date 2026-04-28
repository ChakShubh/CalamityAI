import type { DisasterEvent, PolicyHolder } from '../context/DataContext';
import { getEventTemporalPhase } from './eventPhase';
import { hashString } from './regionScale';

export type EventPhase = 'pre' | 'active' | 'post';

export type CityWorkforce = {
  city: string;
  policyCount: number;
  phase: EventPhase;
  baseCapacity: number;
  maxAllocatable: number;
};

export type SafeZonePlan = {
  city: string;
  baseCapacity: number;
  maxAllocatable: number;
  allocated: number;
  phase: EventPhase;
};

export type ReroutePlan = {
  impactCity: string;
  eventLabel: string;
  eventPhase: EventPhase;
  requiredAgents: number;
  safeZones: SafeZonePlan[];
  plannedRerouted: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function availabilityFactor(phase: EventPhase, city: string): number {
  const cityNoise = ((hashString(`avail-${city}`) % 17) - 8) / 100;
  const phaseBase = phase === 'active' ? 0.22 : phase === 'pre' ? 0.56 : 0.42;
  return clamp(phaseBase + cityNoise, 0.15, 0.72);
}

export function computeCityWorkforce(
  managedCities: string[],
  policyHolders: PolicyHolder[],
  disasters: DisasterEvent[]
): CityWorkforce[] {
  return managedCities
    .map((city) => {
      const localDisaster = disasters.find((d) => d.Location.City === city);
      const phase: EventPhase = localDisaster ? getEventTemporalPhase(localDisaster.Date) : 'pre';
      const policyCount = policyHolders.filter((p) => p.city === city).length;
      const baseCapacity = Math.round(clamp(policyCount * 0.05 + 18, 20, 190));
      const maxAllocatable = Math.round(baseCapacity * availabilityFactor(phase, city));
      return { city, phase, policyCount, baseCapacity, maxAllocatable };
    })
    .sort((a, b) => b.baseCapacity - a.baseCapacity);
}

export function estimateRequiredAgents(impactDisaster: DisasterEvent, policyHolders: PolicyHolder[]): number {
  const impactCity = impactDisaster.Location.City;
  const phase = getEventTemporalPhase(impactDisaster.Date);
  const impactPopulation = policyHolders.filter((p) => p.city === impactCity).length;
  const phaseNeedFactor = phase === 'active' ? 1.18 : phase === 'pre' ? 0.9 : 0.72;
  return Math.round(clamp(impactPopulation * 0.065 * phaseNeedFactor + impactDisaster.Magnitude * 7, 45, 320));
}

export function buildReroutePlan(
  impactDisaster: DisasterEvent,
  managedCities: string[],
  policyHolders: PolicyHolder[],
  disasters: DisasterEvent[]
): ReroutePlan {
  const impactCity = impactDisaster.Location.City;
  const eventPhase = getEventTemporalPhase(impactDisaster.Date);
  const requiredAgents = estimateRequiredAgents(impactDisaster, policyHolders);
  const workforce = computeCityWorkforce(managedCities, policyHolders, disasters)
    .filter((w) => w.city !== impactCity)
    .sort((a, b) => b.maxAllocatable - a.maxAllocatable)
    .slice(0, 3);

  let remaining = requiredAgents;
  const safeZones: SafeZonePlan[] = workforce.map((zone) => {
    const allocated = Math.min(zone.maxAllocatable, remaining);
    remaining -= allocated;
    return {
      city: zone.city,
      baseCapacity: zone.baseCapacity,
      maxAllocatable: zone.maxAllocatable,
      allocated,
      phase: zone.phase,
    };
  });

  return {
    impactCity,
    eventLabel: impactDisaster.Disaster_Type,
    eventPhase,
    requiredAgents,
    safeZones,
    plannedRerouted: safeZones.reduce((acc, z) => acc + z.allocated, 0),
  };
}
