/**
 * Silnik obliczeń portfela — czyste funkcje, bez Reacta i bez sieci.
 *
 * Co tu jest:
 *  - statystyki portfela (oczekiwany zwrot, wahania) z macierzy korelacji,
 *  - projekcja wartości portfela w czasie przy stałych wpłatach miesięcznych (model log-normalny),
 *  - szansa na osiągnięcie celu, skala ryzyka 1–7, wyniki w scenariuszach kryzysowych,
 *  - sprawdzanie limitów profilu i „inteligentne” przesuwanie suwaków (redistribute).
 *
 * Ta sama logika jest odtworzona w Pythonie (api/app/services/engine.py); oba warianty mają
 * wspólne testy z tymi samymi liczbami (domain/portfolio/engine.test.ts i api/tests/test_engine.py).
 * Wyjątek: `redistribute` (pomocnik suwaków) działa tylko w przeglądarce — backend dostaje już gotowe
 * udziały i sprawdza je własną funkcją `is_valid_weights`.
 *
 * Udziały (`weights`) podajemy w PUNKTACH PROCENTOWYCH (np. 18 = 18%), wynik zawsze sumuje się do 100.
 * Zwroty, wahania i koszty to ułamki (0,05 = 5%).
 */
import type { Plan } from '../plan';
import { pct, type RiskProfile } from '../profiles';
import { SAMPLE_ASSUMPTIONS, type MarketAssumptions, type Scenario } from './assumptions';
import { EQUITY_INDEXES, GROUPS, INSTRUMENTS, INSTRUMENT_COUNT, RISK_WORDS } from './instruments';

export type Weights = readonly number[];

/** Największy udział, jaki można ustawić suwakiem. */
export const MAX_WEIGHT = 60;
/** z-score dla 10. i 90. percentyla rozkładu normalnego. */
export const Z10 = 1.2816;

const EPS = 1e-9;

export function sumWeights(weights: Weights): number {
  return weights.reduce((s, x) => s + x, 0);
}

/** Wektor jest poprawny, gdy ma 7 nieujemnych liczb o sumie 100. */
export function isValidWeights(weights: Weights): boolean {
  return (
    weights.length === INSTRUMENT_COUNT &&
    weights.every((x) => Number.isFinite(x) && x >= 0) &&
    Math.abs(sumWeights(weights) - 100) < 1e-6
  );
}

// ---------------------------------------------------------------------------------------------
// Rozkłady
// ---------------------------------------------------------------------------------------------

/** Dystrybuanta rozkładu normalnego (przybliżenie Abramowitza–Stegun, błąd < 1e-7). */
export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

/**
 * Dystrybuanta rozkładu t-Studenta o 5 stopniach swobody (wzór zamknięty).
 * „Grube ogony” t-Studenta lepiej niż rozkład normalny oddają rzadkie, duże straty na rynkach.
 */
export function studentT5Cdf(x: number): number {
  const theta = Math.atan(x / Math.sqrt(5));
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return 0.5 + (theta + s * c * (1 + (2 / 3) * c * c)) / Math.PI;
}

// ---------------------------------------------------------------------------------------------
// Statystyki i projekcja
// ---------------------------------------------------------------------------------------------

export interface PortfolioStats {
  /** oczekiwany roczny zwrot portfela */
  mu: number;
  /** roczne wahania (odchylenie standardowe) */
  sigma: number;
  variance: number;
  /** (Σw)_i — wkład instrumentu i do wariancji, przydatny do rozbicia ryzyka */
  marginal: number[];
}

export function portfolioStats(weights: Weights, a: MarketAssumptions = SAMPLE_ASSUMPTIONS): PortfolioStats {
  const w = weights.map((x) => x / 100);
  let mu = 0;
  for (let i = 0; i < INSTRUMENT_COUNT; i++) mu += w[i]! * a.mu[i]!;
  const marginal = new Array<number>(INSTRUMENT_COUNT).fill(0);
  for (let i = 0; i < INSTRUMENT_COUNT; i++) {
    for (let j = 0; j < INSTRUMENT_COUNT; j++) {
      marginal[i]! += a.corr[i]![j]! * a.sigma[i]! * a.sigma[j]! * w[j]!;
    }
  }
  let variance = 0;
  for (let i = 0; i < INSTRUMENT_COUNT; i++) variance += w[i]! * marginal[i]!;
  return { mu, sigma: Math.sqrt(variance), variance, marginal };
}

type Contributions = Pick<Plan, 'startPLN' | 'monthlyPLN'>;

/**
 * Wartość portfela po `years` latach w scenariuszu o „pechu” z (z = 0 → typowy, z = −1,28 → zły,
 * z = +1,28 → dobry). Kwota startowa + wpłaty na koniec każdego miesiąca.
 */
function projectValue(st: PortfolioStats, z: number, years: number, plan: Contributions): number {
  const g = st.mu - (st.sigma * st.sigma) / 2;
  const months = Math.round(12 * years);
  let total = plan.startPLN * Math.exp(g * years + z * st.sigma * Math.sqrt(years));
  for (let k = 1; k <= months; k++) {
    const tau = (months - k) / 12;
    total += plan.monthlyPLN * Math.exp(g * tau + z * st.sigma * Math.sqrt(tau));
  }
  return total;
}

export function futureValue(
  weights: Weights,
  z: number,
  years: number,
  plan: Contributions,
  a: MarketAssumptions = SAMPLE_ASSUMPTIONS,
): number {
  return projectValue(portfolioStats(weights, a), z, years, plan);
}

/** Szansa (0–1), że po `plan.years` latach wartość portfela przekroczy cel. null, gdy cel nie został podany. */
export function goalProbability(
  weights: Weights,
  plan: Plan,
  a: MarketAssumptions = SAMPLE_ASSUMPTIONS,
): number | null {
  if (plan.targetPLN === null) return null;
  const st = portfolioStats(weights, a);
  const goal = plan.targetPLN;
  const value = (z: number) => projectValue(st, z, plan.years, plan);
  if (value(-5) >= goal) return 1;
  if (value(5) < goal) return 0;
  // szukamy z, przy którym wynik dokładnie dotyka celu; szansa = 1 − Φ(z)
  let lo = -5;
  let hi = 5;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (value(mid) >= goal) hi = mid;
    else lo = mid;
  }
  return 1 - normalCdf((lo + hi) / 2);
}

export interface FanPoint {
  /** liczba miesięcy od startu */
  month: number;
  years: number;
  /** zły (10. percentyl), typowy i dobry (90. percentyl) wynik */
  p10: number;
  median: number;
  p90: number;
  /** suma wpłat do tego miesiąca */
  paidIn: number;
}

/** Punkty do wykresu wachlarzowego: co `stepMonths` miesięcy, zawsze z punktem końcowym. */
export function fanSeries(
  weights: Weights,
  plan: Plan,
  a: MarketAssumptions = SAMPLE_ASSUMPTIONS,
  stepMonths = 3,
): FanPoint[] {
  const st = portfolioStats(weights, a);
  const total = Math.round(12 * plan.years);
  const months: number[] = [];
  for (let m = 0; m < total; m += stepMonths) months.push(m);
  months.push(total);
  return months.map((m) => {
    const years = m / 12;
    return {
      month: m,
      years,
      p10: projectValue(st, -Z10, years, plan),
      median: projectValue(st, 0, years, plan),
      p90: projectValue(st, Z10, years, plan),
      paidIn: plan.startPLN + plan.monthlyPLN * m,
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Skala ryzyka, scenariusze, koszty
// ---------------------------------------------------------------------------------------------

/** Skala 1–7 oparta o roczne wahania portfela (progi w MarketAssumptions.riskThresholds). */
export function riskIndicator(sigma: number, a: MarketAssumptions = SAMPLE_ASSUMPTIONS): number {
  let level = 1;
  for (const threshold of a.riskThresholds) if (sigma >= threshold) level++;
  return level;
}

export function riskWord(level: number): string {
  return RISK_WORDS[Math.min(7, Math.max(1, Math.round(level)))] ?? '';
}

export function scenarioReturn(weights: Weights, scenario: Scenario): number {
  return weights.reduce((s, x, i) => s + (x / 100) * scenario.returns[i]!, 0);
}

export interface ScenarioResult {
  id: Scenario['id'];
  period: string;
  name: string;
  /** zwrot portfela w tym okresie (ujemny = strata) */
  ret: number;
}

export function scenarioResults(weights: Weights, a: MarketAssumptions = SAMPLE_ASSUMPTIONS): ScenarioResult[] {
  return a.scenarios.map((s) => ({ id: s.id, period: s.period, name: s.name, ret: scenarioReturn(weights, s) }));
}

export function annualCost(weights: Weights, a: MarketAssumptions = SAMPLE_ASSUMPTIONS): number {
  return weights.reduce((s, x, i) => s + (x / 100) * a.ter[i]!, 0);
}

// ---------------------------------------------------------------------------------------------
// Zbiorcze metryki portfela (to pokazują ekrany)
// ---------------------------------------------------------------------------------------------

export interface PortfolioMetrics {
  sri: number;
  sriWord: string;
  mu: number;
  sigma: number;
  /** zły / typowy / dobry wynik po `plan.years` latach (zł) */
  p10: number;
  median: number;
  p90: number;
  /** 0–1 albo null, gdy użytkownik nie podał celu */
  goalProbability: number | null;
  annualCost: number;
  scenarios: ScenarioResult[];
  worstScenario: ScenarioResult;
  /** najgorszy zwrot ze scenariuszy kryzysowych (ujemny ułamek) */
  worstYear: number;
  /** łączny udział akcji, w punktach procentowych */
  equityPct: number;
  maxPositionPct: number;
  maxPositionIndex: number;
  /** suma wpłat użytkownika w całym okresie (zł) */
  paidIn: number;
}

export function portfolioMetrics(
  weights: Weights,
  plan: Plan,
  a: MarketAssumptions = SAMPLE_ASSUMPTIONS,
): PortfolioMetrics {
  const st = portfolioStats(weights, a);
  const scenarios = scenarioResults(weights, a);
  const worstScenario = scenarios.reduce((worst, s) => (s.ret < worst.ret ? s : worst));
  const maxPositionPct = Math.max(...weights);
  const sri = riskIndicator(st.sigma, a);
  return {
    sri,
    sriWord: riskWord(sri),
    mu: st.mu,
    sigma: st.sigma,
    p10: projectValue(st, -Z10, plan.years, plan),
    median: projectValue(st, 0, plan.years, plan),
    p90: projectValue(st, Z10, plan.years, plan),
    goalProbability: goalProbability(weights, plan, a),
    annualCost: annualCost(weights, a),
    scenarios,
    worstScenario,
    worstYear: worstScenario.ret,
    equityPct: EQUITY_INDEXES.reduce((s, i) => s + weights[i]!, 0),
    maxPositionPct,
    maxPositionIndex: weights.indexOf(maxPositionPct),
    paidIn: plan.startPLN + plan.monthlyPLN * Math.round(12 * plan.years),
  };
}

// ---------------------------------------------------------------------------------------------
// Limity profilu
// ---------------------------------------------------------------------------------------------

export type LimitKind = 'equity' | 'position' | 'drawdown' | 'volatility';

export interface LimitItem {
  kind: LimitKind;
  ok: boolean;
  /** gotowe zdanie, np. „Akcje 38% (limit 50%)” */
  message: string;
}

export interface LimitCheck {
  ok: boolean;
  items: LimitItem[];
  violations: LimitItem[];
}

const round = (x: number) => Math.round(x);

/**
 * Porównuje portfel z granicami profilu. Przekroczenie NIE blokuje użytkownika (to tylko ostrzeżenie):
 * ostateczna decyzja należy do niego, a ekran oceny ryzyka pokazuje, co to oznacza.
 */
export function checkLimits(metrics: PortfolioMetrics, profile: RiskProfile): LimitCheck {
  const maxEquityPct = profile.maxEquity * 100;
  const maxPositionPct = profile.maxPosition * 100;
  const positionName = INSTRUMENTS[metrics.maxPositionIndex]?.name ?? '';

  const equityOk = metrics.equityPct <= maxEquityPct + EPS;
  const positionOk = metrics.maxPositionPct <= maxPositionPct + EPS;
  const drawdownOk = metrics.worstYear >= profile.maxDrawdown - EPS;
  const volatilityOk = metrics.sigma <= profile.volatility + EPS;

  const items: LimitItem[] = [
    { kind: 'equity', ok: equityOk, message: `Akcje ${round(metrics.equityPct)}% (limit ${round(maxEquityPct)}%)` },
    {
      kind: 'position',
      ok: positionOk,
      message: positionOk
        ? `Największa pozycja ${round(metrics.maxPositionPct)}% (limit ${round(maxPositionPct)}%)`
        : `Największa pozycja ${round(metrics.maxPositionPct)}%: ${positionName} (limit ${round(maxPositionPct)}%)`,
    },
    {
      kind: 'drawdown',
      ok: drawdownOk,
      message: `Najgorszy rok ${pct(metrics.worstYear, 1)} (limit ${pct(profile.maxDrawdown, 0)})`,
    },
    {
      kind: 'volatility',
      ok: volatilityOk,
      message: `Wahania ±${pct(metrics.sigma, 1)} (limit ±${pct(profile.volatility, 0)})`,
    },
  ];
  const violations = items.filter((item) => !item.ok);
  return { ok: violations.length === 0, items, violations };
}

// ---------------------------------------------------------------------------------------------
// Grupy i suwaki
// ---------------------------------------------------------------------------------------------

/** Suma udziałów w każdej z czterech grup (kolejność jak w GROUPS). */
export function groupTotals(weights: Weights): number[] {
  return GROUPS.map((g) => g.indexes.reduce((s, i) => s + weights[i]!, 0));
}

/**
 * Zmiana jednego suwaka: ustawiamy udział `index` na `value`, a pozostałe udziały skalują się
 * proporcjonalnie tak, by suma nadal wynosiła 100. Każdy udział mieści się w 0–MAX_WEIGHT,
 * wyniki są liczbami całkowitymi (metoda największych reszt).
 */
export function redistribute(weights: Weights, index: number, value: number, maxWeight = MAX_WEIGHT): number[] {
  const v = Math.max(0, Math.min(maxWeight, Math.round(value)));
  const others: number[] = [];
  weights.forEach((_, j) => {
    if (j !== index) others.push(j);
  });

  // Krok 1: skalujemy pozostałe udziały; kto przekroczy limit, zostaje „przypięty” do limitu,
  // a resztę rozdzielamy od nowa. Pętla kończy się najwyżej po tylu obrotach, ile jest innych pozycji.
  const fixed = new Map<number, number>();
  let raw = new Map<number, number>();
  for (let iteration = 0; iteration < others.length; iteration++) {
    const free = others.filter((j) => !fixed.has(j));
    const fixedSum = [...fixed.values()].reduce((s, x) => s + x, 0);
    const target = 100 - v - fixedSum;
    const oldSum = free.reduce((s, j) => s + weights[j]!, 0);
    raw = new Map();
    let exceeded = false;
    for (const j of free) {
      const next = oldSum > 0 ? (weights[j]! * target) / oldSum : target / free.length;
      raw.set(j, next);
      if (next > maxWeight) {
        fixed.set(j, maxWeight);
        exceeded = true;
      }
    }
    if (!exceeded) break;
  }

  // Krok 2: zaokrąglamy do liczb całkowitych tak, by suma wyszła dokładnie 100.
  const out = weights.slice();
  out[index] = v;
  const keys = [...raw.keys()];
  const floors = new Map<number, number>();
  let floorSum = 0;
  for (const j of keys) {
    const f = Math.floor(raw.get(j)! + EPS);
    floors.set(j, f);
    floorSum += f;
  }
  const fixedSum = [...fixed.values()].reduce((s, x) => s + x, 0);
  let missing = 100 - v - fixedSum - floorSum;
  const byRemainder = keys
    .slice()
    .sort((x, y) => raw.get(y)! - floors.get(y)! - (raw.get(x)! - floors.get(x)!));
  for (let t = 0; missing > 0 && byRemainder.length > 0; t = (t + 1) % byRemainder.length) {
    const j = byRemainder[t]!;
    floors.set(j, floors.get(j)! + 1);
    missing--;
  }
  for (const j of keys) out[j] = floors.get(j)!;
  for (const [j, x] of fixed) out[j] = x;
  return out;
}
