import { describe, expect, it } from 'vitest';
import { DONUT_CIRCUMFERENCE, donutSegments, spreadLabels, yearStep, yearsLabel } from './geometry';

describe('pierścień składu portfela', () => {
  it('łuki mają długość proporcjonalną do udziałów i kolejno się po sobie zaczynają', () => {
    const segments = donutSegments([38, 30, 15, 17]);
    expect(segments).toHaveLength(4);
    // długość + przerwa każdego łuku to cały okrąg
    for (const s of segments) expect(s.dash + s.gap).toBeCloseTo(DONUT_CIRCUMFERENCE, 6);
    // pierwszy zaczyna się na 0, drugi dokładnie tam, gdzie kończy się udział pierwszego (38%)
    expect(segments[0]!.offset).toBeCloseTo(0, 6);
    expect(-segments[1]!.offset).toBeCloseTo(DONUT_CIRCUMFERENCE * 0.38, 6);
    expect(-segments[3]!.offset).toBeCloseTo(DONUT_CIRCUMFERENCE * 0.83, 6);
  });

  it('grupy z zerowym udziałem nie dostają łuku', () => {
    const segments = donutSegments([60, 40, 0, 0]);
    expect(segments.map((s) => s.id)).toEqual(['akcje', 'obligacje']);
  });

  it('jeden udział równy 100% rysuje pełny okrąg bez przerwy', () => {
    const [only] = donutSegments([0, 0, 0, 100]);
    expect(only?.id).toBe('gotowka');
    expect(only?.dash).toBeCloseTo(DONUT_CIRCUMFERENCE, 6);
  });
});

describe('liczebniki po polsku', () => {
  it('poprawnie odmienia lata', () => {
    expect(yearsLabel(1)).toBe('1 rok');
    expect(yearsLabel(2)).toBe('2 lata');
    expect(yearsLabel(4)).toBe('4 lata');
    expect(yearsLabel(5)).toBe('5 lat');
    expect(yearsLabel(10)).toBe('10 lat');
    expect(yearsLabel(12)).toBe('12 lat');
    expect(yearsLabel(22)).toBe('22 lata');
  });
});

describe('rozsuwanie podpisów', () => {
  it('nie zmienia podpisów, które się nie nakładają', () => {
    expect(spreadLabels([20, 100, 200], 14, 0, 300)).toEqual([20, 100, 200]);
  });

  it('rozsuwa podpisy leżące zbyt blisko siebie i zachowuje ich kolejność', () => {
    const result = spreadLabels([100, 104, 108], 14, 0, 300);
    expect(result[1]! - result[0]!).toBeGreaterThanOrEqual(14);
    expect(result[2]! - result[1]!).toBeGreaterThanOrEqual(14);
    expect(result[0]!).toBeLessThanOrEqual(result[1]!);
  });

  it('zachowuje kolejność z wejścia także wtedy, gdy podpisy podano nierosnąco', () => {
    const result = spreadLabels([108, 100, 104], 14, 0, 300);
    // najniższa wartość wejściowa (100) zostaje wyżej niż 104, a ta wyżej niż 108
    expect(result[1]!).toBeLessThan(result[2]!);
    expect(result[2]!).toBeLessThan(result[0]!);
  });

  it('podpisy przy dolnej krawędzi są cofane w górę, by się zmieściły', () => {
    const result = spreadLabels([290, 295, 300], 14, 0, 300);
    expect(Math.max(...result)).toBeLessThanOrEqual(300);
    expect(result[1]! - result[0]!).toBeGreaterThanOrEqual(14);
    expect(result[2]! - result[1]!).toBeGreaterThanOrEqual(14);
  });
});

describe('krok osi czasu', () => {
  it('im mniej miejsca na rok, tym rzadziej podpisujemy lata', () => {
    expect(yearStep(80)).toBe(1);
    expect(yearStep(40)).toBe(2);
    expect(yearStep(20)).toBe(5);
    expect(yearStep(8)).toBe(10);
  });
});
