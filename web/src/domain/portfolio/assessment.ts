/**
 * Ocena ryzyka wyboru użytkownika (ekran 5 ścieżki).
 *
 * W WERSJI DEMO oceną zajmuje się model ZASTĘPCZY: rozkład t-Studenta (grube ogony) + korekta
 * „klimatu rynku” (mnożnik wahań w okresach podwyższonej zmienności). Daje sensowne, powtarzalne liczby
 * i pozwala przejść całą ścieżkę bez trenowania modelu.
 *
 * W WERSJI PRODUKCYJNEJ ten sam kontrakt (POST /api/risk-assessment → Assessment) obsługuje prawdziwy
 * model uczenia maszynowego w backendzie (api/app/services/risk_model.py): wczytuje wytrenowany plik
 * modelu, liczy cechy z bazy (zmienność, VIX, krzywa rentowności) i zwraca prawdopodobieństwo dużej straty.
 * Pole `model.kind` mówi ekranowi, z czym ma do czynienia ('demo-analytic' albo 'ml').
 */
import type { Plan } from '../plan';
import type { RiskProfile } from '../profiles';
import { SAMPLE_ASSUMPTIONS, type MarketAssumptions, type Regime } from './assumptions';
import {
  checkLimits,
  fanSeries,
  portfolioMetrics,
  portfolioStats,
  scenarioReturn,
  studentT5Cdf,
  type FanPoint,
  type LimitCheck,
  type Weights,
} from './engine';
import { GROUPS, type GroupId } from './instruments';

/** „Duża strata” = spadek wartości o ponad 10% w ciągu roku. */
export const LOSS_THRESHOLD = -0.1;

export interface AssessmentInput {
  /** udziały wybrane przez użytkownika (7 liczb, suma 100) */
  weights: Weights;
  /** udziały propozycji, od której użytkownik zaczął */
  baseWeights: Weights;
  /** nazwa propozycji, np. „Równowaga” */
  baseName: string;
  plan: Plan;
  profile: RiskProfile;
}

export interface WaterfallStep {
  kind: 'start' | 'step' | 'end';
  label: string;
  /** szansa na dużą stratę po tym kroku (w %) */
  value: number;
  /** zmiana w punktach procentowych (tylko dla kroków pośrednich) */
  delta: number | null;
}

export interface RiskContribution {
  group: GroupId;
  name: string;
  /** udział w pieniądzach (%) */
  weightPct: number;
  /** udział w ryzyku (%) */
  riskPct: number;
}

export interface CrisisRow {
  id: string;
  period: string;
  name: string;
  /** zwrot Twojej wersji i propozycji (ujemny = strata) */
  mine: number;
  base: number;
  /** ile zostałoby z kwoty startowej (zł, zaokrąglone do 100) */
  leftPLN: number;
  leftBasePLN: number;
}

export interface Takeaway {
  tone: 'ok' | 'up' | 'down' | 'warn';
  text: string;
}

export interface ModelInfo {
  kind: 'demo-analytic' | 'ml';
  name: string;
  version: string;
  /** okres danych, na których model się uczył */
  trainedOn: string;
  regime: Regime;
  /** szansa na dużą stratę PRZED korektą klimatu rynku (%) */
  pLossWithoutRegime: number;
  reliability: 'niska' | 'srednia' | 'wysoka';
  reliabilityNote: string;
}

export interface Assessment {
  sri: number;
  sriWord: string;
  baseSri: number;
  baseSriWord: string;
  /** szansa na stratę >10% w ciągu roku, w % (np. 5,1) */
  lossChancePct: number;
  lossChanceBasePct: number;
  /** to samo jako „N na 100 lat” */
  per100: number;
  per100Base: number;
  worstYear: number;
  worstYearBase: number;
  /** ile zostałoby z kwoty startowej w najgorszym z trzech kryzysów */
  moneyAtWorst: number;
  limits: LimitCheck;
  changed: boolean;
  changedCount: number;
  waterfall: WaterfallStep[];
  contributions: RiskContribution[];
  /** zdanie podsumowujące, skąd bierze się ryzyko */
  contributionNote: string;
  crises: CrisisRow[];
  fan: FanPoint[];
  summary: {
    median: number;
    medianBase: number;
    p10: number;
    p90: number;
    paidIn: number;
    goalPLN: number | null;
    goalProbability: number | null;
    years: number;
  };
  takeaways: Takeaway[];
  tradeOff: string;
  model: ModelInfo;
}

/** Szansa (0–1) na stratę większą niż `LOSS_THRESHOLD` w ciągu roku, z korektą klimatu rynku. */
export function lossProbability(
  weights: Weights,
  a: MarketAssumptions = SAMPLE_ASSUMPTIONS,
  volMultiplier: number = a.regime.volMultiplier,
): number {
  const { mu, sigma } = portfolioStats(weights, a);
  // standaryzowany t(5) ma wariancję 5/3, więc skalujemy, by wahania portfela były zachowane
  const x = ((LOSS_THRESHOLD - mu) / (sigma * volMultiplier)) * Math.sqrt(5 / 3);
  return studentT5Cdf(x);
}

const roundTo100 = (x: number) => Math.round(x / 100) * 100;
const toPct = (x: number) => x * 100;

function joinPolish(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} i ${items[items.length - 1]}`;
}

/**
 * „Wodospad”: jak kolejne przesunięcia pieniędzy między grupami zmieniały szansę dużej straty.
 * Każdy krok to przesunięcie z jednej grupy-dawcy do grup-odbiorców; ostatnia wartość jest równa
 * ocenie wersji użytkownika (suma kroków = różnica całkowita).
 */
export function buildWaterfall(
  base: Weights,
  final: Weights,
  baseName: string,
  a: MarketAssumptions = SAMPLE_ASSUMPTIONS,
): WaterfallStep[] {
  const p = (w: Weights) => toPct(lossProbability(w, a));
  const startValue = p(base);
  const endValue = p(final);
  const start: WaterfallStep = { kind: 'start', label: `Propozycja „${baseName}”`, value: startValue, delta: null };
  const end: WaterfallStep = { kind: 'end', label: 'Twoja wersja', value: endValue, delta: null };

  const diff = final.map((x, i) => x - base[i]!);
  if (diff.every((d) => Math.abs(d) < 1e-9)) return [start, end];

  const baseTotals = GROUPS.map((g) => g.indexes.reduce((s, i) => s + base[i]!, 0));
  const finalTotals = GROUPS.map((g) => g.indexes.reduce((s, i) => s + final[i]!, 0));
  const groupDiff = finalTotals.map((t, g) => t - baseTotals[g]!);

  // Wagi wewnątrz grup bierzemy z wersji końcowej (a gdy grupa znika — z propozycji),
  // dzięki czemu stan po ostatnim kroku jest dokładnie wersją użytkownika.
  const share = new Array<number>(base.length).fill(0);
  GROUPS.forEach((g, gi) => {
    for (const i of g.indexes) {
      if (finalTotals[gi]! > 0) share[i] = final[i]! / finalTotals[gi]!;
      else if (baseTotals[gi]! > 0) share[i] = base[i]! / baseTotals[gi]!;
      else share[i] = 1 / g.indexes.length;
    }
  });
  const mixAt = (totals: number[]): number[] => {
    const w = new Array<number>(base.length).fill(0);
    GROUPS.forEach((g, gi) => {
      for (const i of g.indexes) w[i] = totals[gi]! * share[i]!;
    });
    return w;
  };

  const donors = GROUPS.map((_, gi) => gi)
    .filter((gi) => groupDiff[gi]! < -1e-9)
    // najpierw największe obniżki; przy remisie — grupa „bezpieczniejsza” (dalej w kolejności)
    .sort((x, y) => groupDiff[x]! - groupDiff[y]! || y - x);
  const receivers = GROUPS.map((_, gi) => gi).filter((gi) => groupDiff[gi]! > 1e-9);
  const totalGain = receivers.reduce((s, gi) => s + groupDiff[gi]!, 0);

  const steps: WaterfallStep[] = [];
  let previous = startValue;
  let carry = 0; // zmiany wewnątrz grup, które doliczamy do pierwszego kroku

  const withinGroup = p(mixAt(baseTotals));
  const inner = withinGroup - previous;
  if (donors.length === 0 || Math.abs(inner) >= 0.05) {
    steps.push({ kind: 'step', label: 'Zmiany w obrębie grup (np. inne akcje, te same pieniądze w akcjach)', value: withinGroup, delta: inner });
    previous = withinGroup;
  } else {
    carry = inner;
    previous = withinGroup;
  }

  const totals = baseTotals.slice();
  for (const donor of donors) {
    const moved = -groupDiff[donor]!;
    totals[donor] = totals[donor]! - moved;
    for (const r of receivers) totals[r] = totals[r]! + (moved * groupDiff[r]!) / totalGain;
    const value = p(mixAt(totals));
    const label = `${Math.round(moved)} pkt proc. mniej ${GROUPS[donor]!.genitive}, więcej ${joinPolish(
      receivers.map((r) => GROUPS[r]!.genitive),
    )}`;
    steps.push({ kind: 'step', label, value, delta: value - previous + carry });
    carry = 0;
    previous = value;
  }
  return [start, ...steps, end];
}

export function riskContributions(weights: Weights, a: MarketAssumptions = SAMPLE_ASSUMPTIONS): RiskContribution[] {
  const st = portfolioStats(weights, a);
  return GROUPS.map((g) => ({
    group: g.id,
    name: g.name,
    weightPct: g.indexes.reduce((s, i) => s + weights[i]!, 0),
    riskPct: toPct(g.indexes.reduce((s, i) => s + ((weights[i]! / 100) * st.marginal[i]!) / st.variance, 0)),
  }));
}

export function assessPortfolio(input: AssessmentInput, a: MarketAssumptions = SAMPLE_ASSUMPTIONS): Assessment {
  const { weights, baseWeights, baseName, plan, profile } = input;
  const mine = portfolioMetrics(weights, plan, a);
  const base = portfolioMetrics(baseWeights, plan, a);
  const limits = checkLimits(mine, profile);

  const lossChancePct = toPct(lossProbability(weights, a));
  const lossChanceBasePct = toPct(lossProbability(baseWeights, a));
  const changedCount = weights.filter((x, i) => x !== baseWeights[i]).length;
  const changed = changedCount > 0;

  const contributions = riskContributions(weights, a);
  const top = contributions.reduce((best, c) => (c.riskPct > best.riskPct ? c : best));
  const contributionNote =
    top.riskPct - top.weightPct >= 10
      ? `${top.name} to ${Math.round(top.weightPct)}% Twoich pieniędzy, ale aż ${Math.round(top.riskPct)}% ryzyka. Pozostałe grupy wygładzają wahania.`
      : `Ryzyko jest rozłożone dość równomiernie: najwięcej, ${Math.round(top.riskPct)}%, pochodzi z grupy „${top.name}”.`;

  const crises: CrisisRow[] = a.scenarios.map((s) => {
    const m = scenarioReturn(weights, s);
    const b = scenarioReturn(baseWeights, s);
    return {
      id: s.id,
      period: s.period,
      name: s.name,
      mine: m,
      base: b,
      leftPLN: roundTo100(plan.startPLN * (1 + m)),
      leftBasePLN: roundTo100(plan.startPLN * (1 + b)),
    };
  });

  const takeaways: Takeaway[] = [];
  takeaways.push(
    limits.ok
      ? { tone: 'ok', text: `Mieści się w limitach Twojego profilu „${profile.name}”.` }
      : {
          tone: 'warn',
          text: `Wychodzi poza limity Twojego profilu „${profile.name}”: ${limits.violations.map((v) => v.message).join('; ')}.`,
        },
  );
  if (!changed) {
    takeaways.push({ tone: 'ok', text: `To dokładnie propozycja „${baseName}” — bez Twoich zmian.` });
  } else if (mine.sri > base.sri) {
    takeaways.push({
      tone: 'up',
      text: `Jest ryzykowniejszy niż propozycja „${baseName}” (${mine.sri} z 7 zamiast ${base.sri} z 7).`,
    });
  } else if (mine.sri < base.sri) {
    takeaways.push({
      tone: 'down',
      text: `Jest spokojniejszy niż propozycja „${baseName}” (${mine.sri} z 7 zamiast ${base.sri} z 7).`,
    });
  } else {
    takeaways.push({
      tone: lossChancePct > lossChanceBasePct ? 'up' : 'down',
      text: `Poziom ryzyka jak w propozycji „${baseName}” (${mine.sri} z 7), ale szansa na dużą stratę jest ${
        lossChancePct > lossChanceBasePct ? 'nieco wyższa' : 'nieco niższa'
      }.`,
    });
  }
  takeaways.push({
    tone: 'warn',
    text: `W złym roku wartość może spaść o ok. ${(Math.abs(mine.worstYear) * 100).toFixed(1).replace('.', ',')}%. Z ${formatPln(plan.startPLN)} zł zostałoby wtedy ok. ${formatPln(
      roundTo100(plan.startPLN * (1 + mine.worstYear)),
    )} zł.`,
  });

  const dLoss = lossChancePct - lossChanceBasePct;
  const tradeOff = changed
    ? `Twoje zmiany ${dLoss >= 0 ? 'zwiększają' : 'zmniejszają'} szansę dużej straty o ${Math.abs(dLoss)
        .toFixed(1)
        .replace('.', ',')} pkt proc., a typowy wynik po ${plan.years} latach ${
        mine.median >= base.median ? 'rośnie' : 'maleje'
      } z ${formatPln(roundTo100(base.median))} zł do ${formatPln(roundTo100(mine.median))} zł.`
    : `Propozycja nie została zmieniona, więc ocena dotyczy dokładnie „${baseName}”.`;

  return {
    sri: mine.sri,
    sriWord: mine.sriWord,
    baseSri: base.sri,
    baseSriWord: base.sriWord,
    lossChancePct,
    lossChanceBasePct,
    per100: Math.round(lossChancePct),
    per100Base: Math.round(lossChanceBasePct),
    worstYear: mine.worstYear,
    worstYearBase: base.worstYear,
    moneyAtWorst: roundTo100(plan.startPLN * (1 + mine.worstYear)),
    limits,
    changed,
    changedCount,
    waterfall: buildWaterfall(baseWeights, weights, baseName, a),
    contributions,
    contributionNote,
    crises,
    fan: fanSeries(weights, plan, a),
    summary: {
      median: mine.median,
      medianBase: base.median,
      p10: mine.p10,
      p90: mine.p90,
      paidIn: mine.paidIn,
      goalPLN: plan.targetPLN,
      goalProbability: mine.goalProbability,
      years: plan.years,
    },
    takeaways,
    tradeOff,
    model: {
      kind: 'demo-analytic',
      name: 'rozkład t-Studenta z korektą klimatu rynku',
      version: 'demo-1',
      trainedOn: 'dane przykładowe',
      regime: a.regime,
      pLossWithoutRegime: toPct(lossProbability(weights, a, 1)),
      reliability: 'srednia',
      reliabilityNote:
        'W danych jest niewiele prawdziwych kryzysów, więc ocena skrajnych strat jest mniej pewna niż ocena zwykłych wahań.',
    },
  };
}

/** 20000 -> „20 000” (twarda spacja). Osobna kopia, żeby moduł nie zależał od niczego poza domeną. */
function formatPln(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
}
