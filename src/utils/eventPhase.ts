/** Lifecycle phase for disasters and intel (48h active window after event time). */
export function getEventTemporalPhase(dateIso: string | undefined): 'pre' | 'active' | 'post' {
  if (!dateIso) return 'active';
  const t = new Date(dateIso).getTime();
  if (Number.isNaN(t)) return 'active';
  const now = Date.now();
  if (t > now) return 'pre';
  if (t < now - 48 * 3600000) return 'post';
  return 'active';
}

/** Hours until a future instant; null if missing or not in the future. */
export function hoursUntilFuture(iso: string | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return null;
  return ms / 3600000;
}

/** True when the event start is in the future but within the next `withinHours` (e.g. 24). */
export function isStartingSoon(dateIso: string | undefined, withinHours = 24): boolean {
  const h = hoursUntilFuture(dateIso);
  return h != null && h <= withinHours;
}
