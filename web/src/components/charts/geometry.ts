/** Czyste funkcje geometrii wykresów — bez Reacta, więc łatwe do przetestowania. */
import { GROUPS } from '@/domain/portfolio/instruments';

export const DONUT_RADIUS = 42;
export const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
/** przerwa między łukami pierścienia (w jednostkach długości okręgu) */
const DONUT_GAP = 1.4;

export interface DonutSegment {
  id: string;
  color: string;
  /** długość widocznego łuku i długość przerwy (stroke-dasharray) */
  dash: number;
  gap: number;
  /** przesunięcie początku łuku (stroke-dashoffset, ujemne = zgodnie z ruchem wskazówek) */
  offset: number;
}

/** Łuki pierścienia dla czterech grup (kolejność jak w GROUPS); grupy z udziałem 0 pomijamy. */
export function donutSegments(totals: readonly number[]): DonutSegment[] {
  let start = 0;
  const segments: DonutSegment[] = [];
  GROUPS.forEach((group, index) => {
    const pct = Math.max(0, totals[index] ?? 0);
    const length = (DONUT_CIRCUMFERENCE * pct) / 100;
    if (pct > 0) {
      const dash = pct < 100 ? Math.max(0.1, length - DONUT_GAP) : length;
      segments.push({ id: group.id, color: group.color, dash, gap: DONUT_CIRCUMFERENCE - dash, offset: -start });
    }
    start += length;
  });
  return segments;
}

/** Polskie liczebniki: „1 rok”, „2 lata”, „5 lat”, „12 lat”, „22 lata”. */
export function yearsLabel(n: number): string {
  if (n === 1) return '1 rok';
  const last = n % 10;
  const lastTwo = n % 100;
  return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? `${n} lata` : `${n} lat`;
}

/**
 * Rozsuwa podpisy ułożone pionowo (np. wartości przy końcu wykresu), żeby się nie nakładały.
 * Zachowuje ich kolejność z wejścia i trzyma wszystko w przedziale [min, max], o ile się mieści.
 */
export function spreadLabels(positions: readonly number[], minGap: number, min: number, max: number): number[] {
  const order = positions.map((position, index) => ({ position, index })).sort((a, b) => a.position - b.position);
  const result = new Array<number>(positions.length).fill(0);

  let previous = min - minGap;
  for (const { position, index } of order) {
    previous = Math.max(position, previous + minGap);
    result[index] = previous;
  }
  // jeśli ostatnie podpisy wyszły poza dół wykresu, przesuwamy je z powrotem w górę
  let next = max + minGap;
  for (let k = order.length - 1; k >= 0; k--) {
    const index = order[k]!.index;
    next = Math.min(result[index]!, next - minGap);
    result[index] = next;
  }
  return result;
}

/** Najmniejszy „ładny” krok osi czasu (w latach), przy którym podpisy są od siebie odsunięte o `minPx`. */
export function yearStep(pxPerYear: number, minPx = 56): number {
  for (const step of [1, 2, 5, 10, 20]) if (pxPerYear * step >= minPx) return step;
  return 20;
}
