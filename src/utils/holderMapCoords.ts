import cityLandmarks from '../data/city_landmarks.json';

export type HolderCoords = {
  city: string;
  latitude: number;
  longitude: number;
  policy_id?: string;
  name: string;
};

/** Metro sectors on land — shared with policy generation for consistent bearings. */
const CITY_LANDMARKS = cityLandmarks as unknown as Record<string, [number, number][]>;

const DISPLAY_LAND_BOX: Record<string, { minLat: number; maxLat: number; minLon: number; maxLon: number }> = {
  Miami: { minLat: 25.23, maxLat: 26.34, minLon: -80.62, maxLon: -80.12 },
  Mumbai: { minLat: 18.86, maxLat: 19.58, minLon: 72.82, maxLon: 73.10 },
  Jakarta: { minLat: -6.70, maxLat: -6.09, minLon: 106.64, maxLon: 107.22 },
  Sydney: { minLat: -34.55, maxLat: -33.54, minLon: 150.60, maxLon: 151.10 },
};

function clampDisplayToLand(city: string, lat: number, lng: number): [number, number] {
  const b = DISPLAY_LAND_BOX[city];
  if (!b) return [lat, lng];
  return [
    Math.min(b.maxLat, Math.max(b.minLat, lat)),
    Math.min(b.maxLon, Math.max(b.minLon, lng)),
  ];
}

/** Approximate downtown / on-land anchors (pulls noisy geocodes away from coast). */
const CITY_ANCHORS: Record<string, [number, number]> = {
  Tokyo: [35.6762, 139.6503],
  Miami: [25.7617, -80.1918],
  Mumbai: [19.076, 72.8777],
  Sydney: [-33.8688, 151.2093],
  Jakarta: [-6.2088, 106.8456],
  London: [51.5074, -0.1278],
  Berlin: [52.52, 13.405],
  'New York': [40.7128, -74.006],
  'Sao Paulo': [-23.5505, -46.6333],
  Harare: [-17.8252, 31.0335],
  Dubai: [25.2048, 55.2708],
  Paris: [48.8566, 2.3522],
  Singapore: [1.3521, 103.8198],
  'San Francisco': [37.7749, -122.4194],
};

/**
 * Blend raw policy coords toward known urban anchors so geo-coordinates sit on land
 * and adhere strictly to verified municipal perimeters.
 */
export function holderDisplayLatLng(p: HolderCoords): [number, number] {
  const anchor = CITY_ANCHORS[p.city];
  if (!anchor) return clampDisplayToLand(p.city, p.latitude, p.longitude);
  /** Increased anchor pull (t=0.92) to ensure points stay well within landmass boundaries. */
  const t = 0.92;
  const lat = anchor[0] + (p.latitude - anchor[0]) * t;
  const lng = anchor[1] + (p.longitude - anchor[1]) * t;
  return clampDisplayToLand(p.city, lat, lng);
}

function cosLatEpic(lat: number) {
  return Math.max(0.32, Math.abs(Math.cos((lat * Math.PI) / 180)));
}

/**
 * Field teams: **multiple** green dots on **separate landward rays** (epicenter → each metro landmark),
 * with along-track + lateral offsets so units do not stack on one line.
 */
export function fieldTeamLandPositions(
  city: string,
  epicLat: number,
  epicLng: number,
  count: number,
  intensity: number,
  reach: number
): { lat: number; lng: number; id: number }[] {
  const marks = CITY_LANDMARKS[city];
  const anchor = CITY_ANCHORS[city];

  if (!marks?.length) {
    if (!anchor) {
      return Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2;
        const s = 0.035;
        return { id: i, lat: epicLat + Math.cos(a) * s, lng: epicLng + Math.sin(a) * s };
      });
    }
    return fieldTeamsAlongLandmarks(city, [anchor], epicLat, epicLng, count, intensity, reach);
  }

  return fieldTeamsAlongLandmarks(city, marks, epicLat, epicLng, count, intensity, reach);
}

function fieldTeamsAlongLandmarks(
  city: string,
  marks: [number, number][],
  epicLat: number,
  epicLng: number,
  count: number,
  intensity: number,
  reach: number
): { lat: number; lng: number; id: number }[] {
  const clEp = cosLatEpic(epicLat);
  const cc = CITY_ANCHORS[city];

  return Array.from({ length: count }, (_, i) => {
    const L = marks[i % marks.length];
    let dN_km = (L[0] - epicLat) * 111;
    let dE_km = (L[1] - epicLng) * 111 * clEp;
    if (Math.hypot(dN_km, dE_km) < 10 && cc) {
      dN_km = (L[0] - cc[0]) * 111;
      dE_km = (L[1] - cc[1]) * 111 * clEp;
    }
    const distKm = Math.hypot(dN_km, dE_km) || 1;
    const un = dN_km / distKm;
    const ue = dE_km / distKm;
    const pn = -ue;
    const pe = un;

    const maxAlong = Math.min(52, Math.max(14, distKm * 0.85));
    const slot = i % marks.length;
    const depthBand = Math.floor(i / marks.length);
    const alongBase = 7 + slot * (maxAlong / Math.max(marks.length, 4)) * 0.75;
    const alongKm = Math.min(
      maxAlong,
      alongBase + depthBand * 8 + (intensity - 1) * 4.5 + (reach - 1) * 3.5
    );
    const sideKm = ((i * 19) % 11) - 5;
    const sideScale = 2.8 + (reach - 1) * 1.2;
    const northKm = un * alongKm + pn * sideKm * sideScale;
    const eastKm = ue * alongKm + pe * sideKm * sideScale;

    return {
      id: i,
      lat: epicLat + northKm / 111,
      lng: epicLng + eastKm / (111 * clEp),
    };
  });
}

/** Pull arbitrary map points (e.g. field-team staging) toward the same city anchor so markers stay on land. */
export function nudgeCoordTowardCityAnchor(
  city: string,
  lat: number,
  lng: number,
  anchorPull = 0.9
): [number, number] {
  const anchor = CITY_ANCHORS[city];
  if (!anchor) return [lat, lng];
  return [
    anchor[0] + (lat - anchor[0]) * anchorPull,
    anchor[1] + (lng - anchor[1]) * anchorPull,
  ];
}
