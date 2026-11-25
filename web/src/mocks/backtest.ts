/**
 * Atrapa symulacji wstecznej: deterministyczny, „udawany” przebieg rynku 2008–2025.
 *
 * Prawdziwy backend liczy to z historycznych notowań zapisanych w bazie (api/app/services/backtest.py):
 * miesięczne zwroty indeksów/ETF-ów, miesięczne przebalansowanie do zadanych udziałów, inflacja z GUS/FRED,
 * oprocentowanie lokat z NBP. Tutaj te same kształty danych powstają z generatora pseudolosowego
 * (stałe ziarno → ten sam wykres przy każdym uruchomieniu), z kryzysami 2008, 2020 i 2022
 * odtworzonymi dokładnie według scenariuszy z założeń rynkowych.
 */
import type { BacktestResponse, CrisisPeriod } from '@/api/types';
import { SAMPLE_ASSUMPTIONS, type MarketAssumptions } from '@/domain/portfolio/assumptions';
import { INSTRUMENT_COUNT } from '@/domain/portfolio/instruments';
import { portfolioStats, scenarioReturn, type Weights } from '@/domain/portfolio/engine';

export const BACKTEST_START = '2007-12';
export const BACKTEST_END = '2025-12';
export const BACKTEST_START_PLN = 10_000;

export const CRISIS_PERIODS: readonly (CrisisPeriod & { scenario: 'y2008' | 'y2020' | 'y2022' })[] = [
  { id: 'y2008', scenario: 'y2008', label: '2008', from: '2008-01', to: '2008-12' },
  { id: 'y2020', scenario: 'y2020', label: '2020', from: '2020-02', to: '2020-03' },
  { id: 'y2022', scenario: 'y2022', label: '2022', from: '2022-01', to: '2022-12' },
];

/** mulberry32 — małe, szybkie, deterministyczne źródło liczb pseudolosowych. */
function prng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rand: () => number): number {
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/** Lista miesięcy RRRR-MM od `from` do `to` włącznie. */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split('-').map(Number) as [number, number];
  const [ty, tm] = to.split('-').map(Number) as [number, number];
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/** Roczna inflacja w danym roku (przykładowa ścieżka: spokojne lata, skok w 2021–2023). */
const INFLATION_BY_YEAR = (year: number) =>
  year === 2021 ? 0.045 : year === 2022 ? 0.12 : year === 2023 ? 0.06 : year >= 2024 ? 0.03 : 0.022;
const DEPOSIT_BY_YEAR = (year: number) => (year <= 2013 ? 0.035 : year <= 2020 ? 0.015 : year <= 2022 ? 0.03 : 0.05);

// ładunki czynników: [akcje, obligacje, złoto, własny szum]
const LOADINGS: readonly (readonly [number, number, number, number])[] = [
  [0.93, 0, 0, 0.37],
  [0.93, 0, 0, 0.37],
  [0.88, 0, 0, 0.47],
  [0, 0.95, 0, 0.31],
  [0.45, 0.75, 0, 0.48],
  [0.1, 0, 0.5, 0.86],
  [0, 0.05, 0, 0.99],
];

function maxDrawdown(series: readonly number[]): number {
  let peak = series[0] ?? 0;
  let worst = 0;
  for (const v of series) {
    peak = Math.max(peak, v);
    worst = Math.min(worst, v / peak - 1);
  }
  return worst;
}

export function simulateBacktest(
  weights: Weights,
  a: MarketAssumptions = SAMPLE_ASSUMPTIONS,
  startPLN = BACKTEST_START_PLN,
): BacktestResponse {
  const dates = monthRange(BACKTEST_START, BACKTEST_END);
  const rand = prng(20080915);
  const w = weights.map((x) => x / 100);

  // zwroty miesięczne każdego instrumentu: [instrument][miesiąc]
  const returns: number[][] = Array.from({ length: INSTRUMENT_COUNT }, () => new Array<number>(dates.length).fill(0));

  for (let k = 1; k < dates.length; k++) {
    const factors: [number, number, number] = [normal(rand), normal(rand), normal(rand)];
    for (let i = 0; i < INSTRUMENT_COUNT; i++) {
      const [fe, fb, fg, idio] = LOADINGS[i]!;
      const z = fe * factors[0] + fb * factors[1] + fg * factors[2] + idio * normal(rand);
      const drift = (a.mu[i]! - (a.sigma[i]! * a.sigma[i]!) / 2) / 12;
      returns[i]![k] = Math.max(-0.6, drift + (a.sigma[i]! / Math.sqrt(12)) * z);
    }
  }

  // kryzysy: w oknie czasowym zwroty są równe zwrotowi ze scenariusza (z lekkim, zerowym w sumie szumem)
  for (const crisis of CRISIS_PERIODS) {
    const scenario = a.scenarios.find((s) => s.id === crisis.scenario);
    if (!scenario) continue;
    const idx = dates.map((d, k) => (d >= crisis.from && d <= crisis.to ? k : -1)).filter((k) => k >= 0);
    if (idx.length === 0) continue;
    for (let i = 0; i < INSTRUMENT_COUNT; i++) {
      const logTotal = Math.log(1 + scenario.returns[i]!);
      const noise = idx.map(() => normal(rand));
      const mean = noise.reduce((s, x) => s + x, 0) / noise.length;
      idx.forEach((k, j) => {
        const wiggle = (noise[j]! - mean) * (a.sigma[i]! / Math.sqrt(12)) * 0.5;
        returns[i]![k] = Math.exp(logTotal / idx.length + wiggle) - 1;
      });
    }
  }

  // Kalibracja długoterminowa. Kryzysy są „wstawione” na sztywno, a po nich nie ma odbić, więc bez tej korekty
  // cała symulacja dryfowałaby w dół (akcje kończyłyby poniżej kwoty startowej, co jest nieprawdopodobne).
  // Poza oknami kryzysów przesuwamy więc zwroty o stałą tak, by cały przebieg każdego instrumentu
  // rósł średnio tak, jak mówią założenia (μ − σ²/2 rocznie). Na kryzysy to nie wpływa.
  const inCrisis = new Set<number>();
  for (const crisis of CRISIS_PERIODS) {
    dates.forEach((d, k) => {
      if (d >= crisis.from && d <= crisis.to) inCrisis.add(k);
    });
  }
  const freeMonths = dates.map((_, k) => k).filter((k) => k >= 1 && !inCrisis.has(k));
  const years = (dates.length - 1) / 12;
  for (let i = 0; i < INSTRUMENT_COUNT; i++) {
    const series = returns[i]!;
    let logSum = 0;
    for (let k = 1; k < dates.length; k++) logSum += Math.log(1 + series[k]!);
    const target = (a.mu[i]! - (a.sigma[i]! * a.sigma[i]!) / 2) * years;
    const shift = (target - logSum) / Math.max(1, freeMonths.length);
    for (const k of freeMonths) series[k] = Math.exp(Math.log(1 + series[k]!) + shift) - 1;
  }

  // Zwroty portfela: poza kryzysami to średnia ważona zwrotów instrumentów. W oknie kryzysu
  // wymuszamy dokładnie zwrot ze scenariusza (jak na kartach „Co by było w kryzysach”), żeby
  // wykres i liczby na ekranie się zgadzały — przy miesięcznym przebalansowaniu wynik bywa inny.
  const portfolioReturns = dates.map((_, k) => w.reduce((s, x, i) => s + x * returns[i]![k]!, 0));
  const sigmaP = portfolioStats(weights, a).sigma;
  for (const crisis of CRISIS_PERIODS) {
    const scenario = a.scenarios.find((s) => s.id === crisis.scenario);
    if (!scenario) continue;
    const idx = dates.map((d, k) => (d >= crisis.from && d <= crisis.to ? k : -1)).filter((k) => k >= 0);
    if (idx.length === 0) continue;
    const logTotal = Math.log(1 + scenarioReturn(weights, scenario));
    const noise = idx.map(() => normal(rand));
    const mean = noise.reduce((s, x) => s + x, 0) / noise.length;
    idx.forEach((k, j) => {
      portfolioReturns[k] = Math.exp(logTotal / idx.length + (noise[j]! - mean) * (sigmaP / Math.sqrt(12)) * 0.5) - 1;
    });
  }

  const portfolio = [startPLN];
  const sp500 = [startPLN];
  const inflation = [startPLN];
  const deposit = [startPLN];
  for (let k = 1; k < dates.length; k++) {
    const year = Number(dates[k]!.slice(0, 4));
    portfolio.push(portfolio[k - 1]! * (1 + portfolioReturns[k]!));
    sp500.push(sp500[k - 1]! * (1 + returns[1]![k]!));
    inflation.push(inflation[k - 1]! * Math.pow(1 + INFLATION_BY_YEAR(year), 1 / 12));
    deposit.push(deposit[k - 1]! * Math.pow(1 + DEPOSIT_BY_YEAR(year), 1 / 12));
  }

  const last = dates.length - 1;
  return {
    startPLN,
    dates,
    portfolio,
    sp500,
    inflation,
    deposit,
    crises: CRISIS_PERIODS.map(({ id, label, from, to }) => ({ id, label, from, to })),
    stats: {
      portfolioEnd: portfolio[last]!,
      sp500End: sp500[last]!,
      inflationEnd: inflation[last]!,
      depositEnd: deposit[last]!,
      portfolioMaxDrawdown: maxDrawdown(portfolio),
      sp500MaxDrawdown: maxDrawdown(sp500),
    },
    source:
      'Dane przykładowe (symulacja wsteczna 2008–2025, miesięczne przebalansowanie). W wersji produkcyjnej: Alpha Vantage, FMP, NBP.',
  };
}
