/** Deterministic pseudo-random in [0, 1) from strings (stable across re-renders). */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function scale01(regionKey: string, salt: string): number {
  return (hashString(regionKey + salt) % 10000) / 10000;
}

export function intInRange(regionKey: string, salt: string, min: number, max: number): number {
  const t = scale01(regionKey, salt);
  return Math.round(min + t * (max - min));
}
