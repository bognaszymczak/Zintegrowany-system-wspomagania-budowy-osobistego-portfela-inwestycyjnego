import { describe, expect, it } from 'vitest';
import { SKETCH_PLAN } from '../plan';
import { PROFILES, profileByLevel, type RiskLevel } from '../profiles';
import { checkLimits, isValidWeights, portfolioMetrics } from './engine';
import { evaluateProposals, findProposal, proposalsForLevel } from './proposals';

const LEVELS: RiskLevel[] = [1, 2, 3, 4, 5];

describe('propozycje portfeli', () => {
  it('każdy poziom ma trzy propozycje: stabilność, równowaga, wzrost', () => {
    for (const level of LEVELS) {
      const proposals = proposalsForLevel(level);
      expect(proposals.map((p) => p.name)).toEqual(['Stabilność', 'Równowaga', 'Wzrost']);
      expect(new Set(proposals.map((p) => p.id)).size).toBe(3);
    }
  });

  it('udziały są poprawne: 7 liczb całkowitych, suma 100', () => {
    for (const level of LEVELS) {
      for (const p of proposalsForLevel(level)) {
        expect(isValidWeights(p.weights)).toBe(true);
        expect(p.weights.every((x) => Number.isInteger(x))).toBe(true);
      }
    }
  });

  it('KAŻDA propozycja mieści się we wszystkich limitach swojego profilu', () => {
    for (const level of LEVELS) {
      const profile = profileByLevel(level);
      for (const p of proposalsForLevel(level)) {
        const check = checkLimits(portfolioMetrics(p.weights, SKETCH_PLAN), profile);
        expect(check.violations.map((v) => `${p.id}: ${v.message}`)).toEqual([]);
      }
    }
  });

  it('wahania i udział akcji rosną od „Stabilności” do „Wzrostu”', () => {
    for (const level of LEVELS) {
      const [a, b, c] = proposalsForLevel(level).map((p) => portfolioMetrics(p.weights, SKETCH_PLAN));
      expect(a!.sigma).toBeLessThan(b!.sigma);
      expect(b!.sigma).toBeLessThan(c!.sigma);
      expect(a!.equityPct).toBeLessThan(b!.equityPct);
      expect(b!.equityPct).toBeLessThan(c!.equityPct);
      expect(a!.sri).toBeLessThanOrEqual(c!.sri);
    }
  });

  it('„Wzrost” używa limitu akcji profilu (poza najostrożniejszym, gdzie ogranicza go zmienność)', () => {
    for (const level of [2, 3, 4] as RiskLevel[]) {
      const wzrost = proposalsForLevel(level)[2]!;
      const m = portfolioMetrics(wzrost.weights, SKETCH_PLAN);
      expect(m.equityPct).toBe(Math.round(profileByLevel(level).maxEquity * 100));
    }
  });

  it('poziomy się nie zlewają: typowe wahania „Równowagi” rosną z poziomem profilu', () => {
    const sigma = LEVELS.map((l) => portfolioMetrics(proposalsForLevel(l)[1]!.weights, SKETCH_PLAN).sigma);
    for (let i = 1; i < sigma.length; i++) expect(sigma[i]!).toBeGreaterThan(sigma[i - 1]!);
  });

  it('„Równowaga” dla profilu Zrównoważony to portfel ze szkicu ekranów', () => {
    expect(proposalsForLevel(3)[1]?.weights).toEqual([18, 15, 5, 20, 10, 15, 17]);
  });

  it('findProposal czyta identyfikator z adresu i odrzuca błędny', () => {
    expect(findProposal('L3-rownowaga')?.name).toBe('Równowaga');
    expect(findProposal('L5-wzrost')?.level).toBe(5);
    expect(findProposal('L6-wzrost')).toBeNull();
    expect(findProposal('L3-nieistnieje')).toBeNull();
    expect(findProposal('')).toBeNull();
  });

  it('zwrócone tablice to kopie — zmiana nie psuje szablonów', () => {
    const first = proposalsForLevel(3)[0]!;
    first.weights[0] = 99;
    expect(proposalsForLevel(3)[0]?.weights[0]).toBe(10);
  });

  it('evaluateProposals dodaje metryki i flagę zgodności z limitami (także bez celu)', () => {
    const withGoal = evaluateProposals(3, SKETCH_PLAN);
    expect(withGoal.every((p) => p.withinLimits)).toBe(true);
    expect(withGoal[1]?.groupTotals).toEqual([38, 30, 15, 17]);
    expect(withGoal[1]?.metrics.sri).toBe(3);
    const noGoal = evaluateProposals(3, { ...SKETCH_PLAN, targetPLN: null });
    expect(noGoal.every((p) => p.metrics.goalProbability === null)).toBe(true);
  });

  it('poziomy profili w PROFILES pokrywają się z propozycjami', () => {
    expect(PROFILES.map((p) => p.level)).toEqual(LEVELS);
  });
});
