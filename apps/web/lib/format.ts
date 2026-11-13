/** `90` → `1h 30min`; `45` → `45 min`. */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${String(rest)} min`;
  return rest === 0 ? `${String(hours)}h` : `${String(hours)}h ${String(rest)}min`;
}
