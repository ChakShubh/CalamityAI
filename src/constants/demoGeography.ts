/** Monitored metropolitan risk hubs for continuous disaster telemetry. */
export const DEMO_CITY_LIST = ['Miami', 'Mumbai', 'Jakarta', 'Sydney'] as const;
export type DemoCity = (typeof DEMO_CITY_LIST)[number];
export const DEMO_CITIES = new Set<string>(DEMO_CITY_LIST);

export const CITY_COORDS: Record<DemoCity, [number, number]> = {
  Miami: [25.7617, -80.1918],
  Mumbai: [19.076, 72.8777],
  Jakarta: [-6.2088, 106.8456],
  Sydney: [-33.8688, 151.2093],
};

export const CITY_COUNTRY: Record<DemoCity, string> = {
  Miami: 'USA',
  Mumbai: 'India',
  Jakarta: 'Indonesia',
  Sydney: 'Australia',
};
