/** User-facing timestamps in modals and feed (not raw ISO). */
export function formatIntelTime(iso: string | undefined, locale?: string): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return String(iso);
  return new Date(t).toLocaleString(locale ?? undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
