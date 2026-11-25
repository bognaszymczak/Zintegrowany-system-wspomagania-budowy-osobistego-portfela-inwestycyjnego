import { describe, expect, it } from 'vitest';
import { axisMoney, linePath, niceStep, niceTicks } from './scale';

describe('osie wykresów', () => {
  it('niceStep wybiera 1/2/5 × 10^k', () => {
    expect(niceStep(160_000, 4)).toBe(50_000);
    expect(niceStep(100, 4)).toBe(50);
    expect(niceStep(7, 4)).toBe(2);
    expect(niceStep(0)).toBe(1);
  });
  it('niceTicks obejmuje cały zakres', () => {
    const t = niceTicks(12_345, 148_900, 4);
    expect(t.min).toBeLessThanOrEqual(12_345);
    expect(t.max).toBeGreaterThanOrEqual(148_900);
    expect(t.ticks[0]).toBe(t.min);
    expect(t.ticks[t.ticks.length - 1]).toBe(t.max);
    expect(t.ticks.length).toBeGreaterThanOrEqual(3);
  });
  it('axisMoney', () => {
    expect(axisMoney(0)).toBe('0');
    expect(axisMoney(40_000)).toBe('40 tys.');
    expect(axisMoney(1_200_000)).toBe('1,2 mln');
  });
  it('linePath', () => {
    expect(linePath([{ x: 0, y: 1 }, { x: 2.25, y: 3 }])).toBe('M0.0 1.0L2.3 3.0');
    expect(linePath([])).toBe('');
  });
});
