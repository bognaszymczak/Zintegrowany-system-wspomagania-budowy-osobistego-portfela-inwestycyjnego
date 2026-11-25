import { describe, expect, it } from 'vitest';
import { SAMPLE_ASSUMPTIONS } from '@/domain/portfolio/assumptions';
import { scenarioReturn } from '@/domain/portfolio/engine';
import { BACKTEST_START_PLN, monthRange, simulateBacktest } from './backtest';

const BASE = [18, 15, 5, 20, 10, 15, 17];
const sim = simulateBacktest(BASE);
const at = (month: string) => sim.dates.indexOf(month);

describe('atrapa symulacji wstecznej', () => {
  it('monthRange: włącznie z końcami, przez granicę roku', () => {
    expect(monthRange('2007-11', '2008-02')).toEqual(['2007-11', '2007-12', '2008-01', '2008-02']);
  });

  it('217 punktów (grudzień 2007 – grudzień 2025), wszystkie serie tej samej długości i dodatnie', () => {
    expect(sim.dates[0]).toBe('2007-12');
    expect(sim.dates[sim.dates.length - 1]).toBe('2025-12');
    expect(sim.dates).toHaveLength(217);
    for (const series of [sim.portfolio, sim.sp500, sim.inflation, sim.deposit]) {
      expect(series).toHaveLength(217);
      expect(series[0]).toBe(BACKTEST_START_PLN);
      expect(series.every((v) => v > 0 && Number.isFinite(v))).toBe(true);
    }
  });

  it('jest deterministyczna (to samo wejście → ta sama odpowiedź)', () => {
    expect(simulateBacktest(BASE)).toEqual(sim);
  });

  it('kryzysy odtwarzają scenariusze: S&P 500 spada o 37% w 2008 i o 18% w 2022', () => {
    const y2008 = sim.sp500[at('2008-12')]! / sim.sp500[at('2007-12')]! - 1;
    const y2022 = sim.sp500[at('2022-12')]! / sim.sp500[at('2021-12')]! - 1;
    expect(y2008).toBeCloseTo(-0.37, 2);
    expect(y2022).toBeCloseTo(-0.18, 2);
  });

  it('portfel w każdym kryzysie traci dokładnie tyle, ile mówi scenariusz (spójność z kartami „Co by było w kryzysach”)', () => {
    for (const [id, from, to] of [
      ['y2008', '2007-12', '2008-12'],
      ['y2020', '2020-01', '2020-03'],
      ['y2022', '2021-12', '2022-12'],
    ] as const) {
      const scenario = SAMPLE_ASSUMPTIONS.scenarios.find((s) => s.id === id)!;
      const actual = sim.portfolio[at(to)]! / sim.portfolio[at(from)]! - 1;
      expect(actual).toBeCloseTo(scenarioReturn(BASE, scenario), 6);
    }
  });

  it('statystyki zgadzają się z seriami', () => {
    expect(sim.stats.portfolioEnd).toBe(sim.portfolio[216]);
    expect(sim.stats.sp500End).toBe(sim.sp500[216]);
    expect(sim.stats.sp500MaxDrawdown).toBeLessThan(-0.3);
    expect(sim.stats.portfolioMaxDrawdown).toBeGreaterThan(sim.stats.sp500MaxDrawdown);
    expect(sim.stats.portfolioMaxDrawdown).toBeLessThan(0);
    expect(sim.stats.inflationEnd).toBeGreaterThan(BACKTEST_START_PLN);
  });

  it('w długim okresie rynek rośnie zgodnie z założeniami: akcje USA 2–4 razy, portfel „Równowaga” bije inflację', () => {
    expect(sim.stats.sp500End).toBeGreaterThan(2 * BACKTEST_START_PLN);
    expect(sim.stats.sp500End).toBeLessThan(4 * BACKTEST_START_PLN);
    expect(sim.stats.portfolioEnd).toBeGreaterThan(sim.stats.inflationEnd);
    expect(sim.stats.portfolioEnd).toBeGreaterThan(sim.stats.depositEnd);
    // nawet najgłębszy spadek akcji nie przekracza tego, co znamy z historii (ok. −55%)
    expect(sim.stats.sp500MaxDrawdown).toBeGreaterThan(-0.6);
  });

  it('podaje okresy kryzysów do zacieniowania wykresu', () => {
    expect(sim.crises.map((c) => c.label)).toEqual(['2008', '2020', '2022']);
    for (const c of sim.crises) {
      expect(at(c.from)).toBeGreaterThan(0);
      expect(at(c.to)).toBeGreaterThan(at(c.from) - 1);
    }
  });

  it('bardziej akcyjny portfel ma głębszy spadek niż spokojny', () => {
    const calm = simulateBacktest([2, 1, 0, 31, 16, 10, 40]);
    const bold = simulateBacktest([30, 30, 24, 3, 2, 7, 4]);
    expect(bold.stats.portfolioMaxDrawdown).toBeLessThan(calm.stats.portfolioMaxDrawdown);
  });
});
