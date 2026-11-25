/** Pomocnicze funkcje do osi wykresów (bez zewnętrznej biblioteki wykresów). */

/** Ładny krok osi: 1, 2 lub 5 razy potęga dziesięciu. */
export function niceStep(range: number, targetTicks = 4): number {
  if (!(range > 0)) return 1;
  const rough = range / targetTicks;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const unit = rough / pow;
  const nice = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10;
  return nice * pow;
}

export interface Ticks {
  min: number;
  max: number;
  step: number;
  ticks: number[];
}

/** Osie zaczynają się od `min` zaokrąglonego w dół i kończą na `max` zaokrąglonym w górę do kroku. */
export function niceTicks(min: number, max: number, targetTicks = 4): Ticks {
  const step = niceStep(max - min, targetTicks);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 1000; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { min: lo, max: hi, step, ticks };
}

/** 0 -> „0”, 40000 -> „40 tys.”, 1200000 -> „1,2 mln”. */
export function axisMoney(value: number): string {
  if (value === 0) return '0';
  if (Math.abs(value) >= 1_000_000) return `${String(Math.round(value / 100_000) / 10).replace('.', ',')} mln`;
  return `${Math.round(value / 1000)} tys.`;
}

/** Zamienia punkty na ścieżkę SVG „M x y L x y …” z jedną cyfrą po przecinku. */
export function linePath(points: readonly { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
}
