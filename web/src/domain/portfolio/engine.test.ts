import { describe, expect, it } from 'vitest';
import { SKETCH_PLAN } from '../plan';
import { profileByLevel } from '../profiles';
import {
  MAX_WEIGHT,
  checkLimits,
  fanSeries,
  goalProbability,
  groupTotals,
  isValidWeights,
  normalCdf,
  portfolioMetrics,
  redistribute,
  riskIndicator,
  riskWord,
  studentT5Cdf,
  sumWeights,
} from './engine';

/** Propozycja „Równowaga” i ustawienie początkowe suwaków ze szkicu ekranów. */
const BASE = [18, 15, 5, 20, 10, 15, 17];
const START = [20, 20, 6, 18, 8, 15, 13];
const round100 = (x: number) => Math.round(x / 100) * 100;

describe('rozkłady', () => {
  it('dystrybuanta normalna: wartości tablicowe', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 4);
    expect(normalCdf(-1)).toBeCloseTo(0.158655, 5);
  });

  it('dystrybuanta t(5) zgadza się z całkowaniem numerycznym gęstości (reguła Simpsona)', () => {
    const pdf = (t: number) => (8 / (3 * Math.PI * Math.sqrt(5))) * Math.pow(1 + (t * t) / 5, -3);
    const simpson = (b: number, n = 4000) => {
      const h = b / n;
      let s = pdf(0) + pdf(b);
      for (let i = 1; i < n; i++) s += pdf(i * h) * (i % 2 ? 4 : 2);
      return (s * h) / 3;
    };
    for (const x of [-3, -1.5, -0.3, 0, 0.7, 2.2]) {
      const numeric = 0.5 + (x >= 0 ? simpson(x || 1e-12) : -simpson(-x));
      expect(studentT5Cdf(x)).toBeCloseTo(numeric, 6);
    }
    // „grube ogony”: przy −3 odchyleń t(5) daje większą szansę niż rozkład normalny
    expect(studentT5Cdf(-3)).toBeGreaterThan(normalCdf(-3));
  });
});

describe('liczby ze szkicu ekranów', () => {
  it('propozycja „Równowaga” (ekran 6)', () => {
    const m = portfolioMetrics(BASE, SKETCH_PLAN);
    expect(m.sri).toBe(3);
    expect(m.sriWord).toBe('umiarkowane');
    expect(round100(m.median)).toBe(108_400);
    expect(Math.round((m.goalProbability ?? 0) * 100)).toBe(67);
    expect(m.worstYear).toBeCloseTo(-0.132, 3);
    expect(m.annualCost).toBeCloseTo(0.0012, 4);
    expect(m.sigma).toBeCloseTo(0.0752, 4);
    expect(m.equityPct).toBe(38);
    expect(m.maxPositionPct).toBe(20);
    expect(m.paidIn).toBe(80_000);
  });

  it('ustawienie początkowe suwaków (ekran 7 i 8)', () => {
    const m = portfolioMetrics(START, SKETCH_PLAN);
    expect(m.sri).toBe(4);
    expect(round100(m.median)).toBe(110_300);
    expect(round100(m.p10)).toBe(84_200);
    expect(round100(m.p90)).toBe(145_600);
    expect(Math.round((m.goalProbability ?? 0) * 100)).toBe(68);
    expect(m.worstYear).toBeCloseTo(-0.1653, 3);
    expect(m.worstScenario.id).toBe('y2008');
    expect(m.equityPct).toBe(46);
  });

  it('wyniki w trzech kryzysach (ekran 6)', () => {
    const [y2008, y2020, y2022] = portfolioMetrics(BASE, SKETCH_PLAN).scenarios;
    expect(y2008?.ret).toBeCloseTo(-0.132, 3);
    expect(y2020?.ret).toBeCloseTo(-0.129, 3);
    expect(y2022?.ret).toBeCloseTo(-0.112, 3);
  });
});

describe('szansa na cel i skala ryzyka', () => {
  it('bez celu nie ma prawdopodobieństwa', () => {
    expect(goalProbability(BASE, { ...SKETCH_PLAN, targetPLN: null })).toBeNull();
  });

  it('im wyższy cel, tym mniejsza szansa; wartości mieszczą się w 0–1', () => {
    let previous = 1;
    for (const goal of [50_000, 80_000, 100_000, 120_000, 160_000, 400_000]) {
      const p = goalProbability(BASE, { ...SKETCH_PLAN, targetPLN: goal }) as number;
      expect(p).toBeLessThanOrEqual(previous);
      expect(p).toBeGreaterThanOrEqual(0);
      previous = p;
    }
    expect(goalProbability(BASE, { ...SKETCH_PLAN, targetPLN: 10_000 })).toBe(1);
    expect(goalProbability(BASE, { ...SKETCH_PLAN, targetPLN: 10_000_000 })).toBe(0);
  });

  it('skala 1–7 rośnie wraz z wahaniami (progi włącznie)', () => {
    expect(riskIndicator(0.001)).toBe(1);
    expect(riskIndicator(0.02)).toBe(2);
    expect(riskIndicator(0.0599)).toBe(2);
    expect(riskIndicator(0.06)).toBe(3);
    expect(riskIndicator(0.2)).toBe(7);
    expect(riskWord(3)).toBe('umiarkowane');
    expect(riskWord(99)).toBe('najwyższe');
  });

  it('więcej akcji → większe wahania i wyższy typowy wynik', () => {
    const calm = portfolioMetrics([5, 5, 0, 30, 15, 10, 35], SKETCH_PLAN);
    const bold = portfolioMetrics([30, 25, 5, 10, 5, 10, 15], SKETCH_PLAN);
    expect(bold.sigma).toBeGreaterThan(calm.sigma);
    expect(bold.median).toBeGreaterThan(calm.median);
    expect(bold.worstYear).toBeLessThan(calm.worstYear);
  });
});

describe('wykres wachlarzowy', () => {
  it('zaczyna od kwoty startowej, kończy na wynikach z metryk, mediana rośnie', () => {
    const fan = fanSeries(START, SKETCH_PLAN);
    const first = fan[0]!;
    const last = fan[fan.length - 1]!;
    expect(first.month).toBe(0);
    expect(first.p10).toBeCloseTo(SKETCH_PLAN.startPLN, 6);
    expect(first.p90).toBeCloseTo(SKETCH_PLAN.startPLN, 6);
    expect(last.month).toBe(120);
    expect(last.paidIn).toBe(80_000);
    const m = portfolioMetrics(START, SKETCH_PLAN);
    expect(last.median).toBeCloseTo(m.median, 6);
    expect(last.p10).toBeCloseTo(m.p10, 6);
    expect(last.p90).toBeCloseTo(m.p90, 6);
    for (let i = 1; i < fan.length; i++) {
      expect(fan[i]!.median).toBeGreaterThan(fan[i - 1]!.median);
      expect(fan[i]!.p10).toBeLessThan(fan[i]!.median);
      expect(fan[i]!.p90).toBeGreaterThan(fan[i]!.median);
    }
  });

  it('krok nie dzielący horyzontu dodaje punkt końcowy', () => {
    const fan = fanSeries(START, { ...SKETCH_PLAN, years: 4 }, undefined, 5);
    expect(fan.map((p) => p.month)).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 48]);
  });
});

describe('limity profilu', () => {
  const zrownowazony = profileByLevel(3);

  it('„Równowaga” i ustawienie początkowe mieszczą się w profilu Zrównoważony', () => {
    for (const w of [BASE, START]) {
      const check = checkLimits(portfolioMetrics(w, SKETCH_PLAN), zrownowazony);
      expect(check.ok).toBe(true);
      expect(check.violations).toHaveLength(0);
      expect(check.items).toHaveLength(4);
    }
  });

  it('teksty zgodne ze szkicem', () => {
    const check = checkLimits(portfolioMetrics(START, SKETCH_PLAN), zrownowazony);
    expect(check.items[0]?.message).toBe('Akcje 46% (limit 50%)');
    expect(check.items[1]?.message).toBe('Największa pozycja 20% (limit 30%)');
    expect(check.items[2]?.message).toBe('Najgorszy rok −16,5% (limit −20%)');
    expect(check.items[3]?.message).toBe('Wahania ±8,6% (limit ±10%)');
  });

  it('wskazuje wszystkie przekroczone limity', () => {
    const aggressive = [0, 55, 0, 0, 0, 0, 45];
    const check = checkLimits(portfolioMetrics(aggressive, SKETCH_PLAN), zrownowazony);
    expect(check.ok).toBe(false);
    expect(check.violations.map((v) => v.kind)).toContain('equity');
    expect(check.violations.map((v) => v.kind)).toContain('position');
    expect(check.violations.find((v) => v.kind === 'position')?.message).toBe(
      'Największa pozycja 55%: Akcje USA (limit 30%)',
    );
  });

  it('wartość równa limitowi jest jeszcze dozwolona', () => {
    const atLimit = [20, 20, 10, 15, 5, 15, 15]; // akcje dokładnie 50%
    const check = checkLimits(portfolioMetrics(atLimit, SKETCH_PLAN), zrownowazony);
    expect(check.items[0]?.ok).toBe(true);
  });
});

describe('suwaki: redistribute', () => {
  it('przykład ze szkicu: USA na 45% — reszta skaluje się proporcjonalnie', () => {
    expect(redistribute(START, 1, 45)).toEqual([14, 45, 4, 12, 6, 10, 9]);
  });

  it('zmiana nie rusza wejściowej tablicy', () => {
    const input = START.slice();
    redistribute(input, 0, 40);
    expect(input).toEqual(START);
  });

  it('wartość poza zakresem jest przycinana do 0–60', () => {
    expect(redistribute(START, 1, 200)[1]).toBe(MAX_WEIGHT);
    expect(redistribute(START, 1, -5)[1]).toBe(0);
    expect(redistribute(START, 1, 12.6)[1]).toBe(13);
  });

  it('pozostałe pozycje nie przekraczają limitu 60%', () => {
    expect(redistribute([60, 40, 0, 0, 0, 0, 0], 0, 0)).toEqual([0, 60, 8, 8, 8, 8, 8]);
  });

  it('gdy reszta jest zerowa, dzieli po równo', () => {
    const out = redistribute([60, 0, 0, 0, 0, 0, 40], 6, 0);
    expect(out[6]).toBe(0);
    expect(sumWeights(out)).toBe(100);
    expect(Math.max(...out)).toBeLessThanOrEqual(MAX_WEIGHT);
  });

  it('niezmienione przesunięcie jest idempotentne', () => {
    expect(redistribute(START, 2, START[2]!)).toEqual(START);
  });

  it('inwarianty na 3000 losowych ruchów: suma 100, liczby całkowite, 0–60, ruszony suwak ma zadaną wartość', () => {
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    let w: number[] = START.slice();
    for (let step = 0; step < 3000; step++) {
      const i = Math.floor(rnd() * 7);
      const v = Math.floor(rnd() * 70) - 5;
      const next = redistribute(w, i, v);
      expect(sumWeights(next)).toBe(100);
      expect(next.every((x) => Number.isInteger(x) && x >= 0 && x <= MAX_WEIGHT)).toBe(true);
      expect(next[i]).toBe(Math.max(0, Math.min(MAX_WEIGHT, Math.round(v))));
      w = next;
    }
  });
});

describe('pomocnicze', () => {
  it('groupTotals sumuje grupy: akcje, obligacje, złoto, gotówka', () => {
    expect(groupTotals(START)).toEqual([46, 26, 15, 13]);
    expect(groupTotals(BASE)).toEqual([38, 30, 15, 17]);
  });

  it('isValidWeights', () => {
    expect(isValidWeights(START)).toBe(true);
    expect(isValidWeights([50, 50])).toBe(false);
    expect(isValidWeights([-1, 21, 20, 20, 20, 10, 10])).toBe(false);
    expect(isValidWeights([20, 20, 6, 18, 8, 15, 14])).toBe(false);
  });
});
