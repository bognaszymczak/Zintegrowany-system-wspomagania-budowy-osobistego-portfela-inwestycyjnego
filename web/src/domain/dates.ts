/** Daty w formacie ISO (RRRR-MM-DD) — małe funkcje, które zastępują całą bibliotekę do dat. */

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** „2026-11-03” → „3.11.2026” (tak zapisują daty makiety). Błędny tekst wraca bez zmian. */
export function formatDatePl(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])}.${m[2]}.${m[1]}`;
}
