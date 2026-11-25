/**
 * Trzy propozycje portfeli dla każdego z pięciu poziomów profilu.
 *
 * W WERSJI DEMO to gotowe szablony (ręcznie dobrane i sprawdzone testami: każdy mieści się w granicach
 * swojego profilu). W WERSJI PRODUKCYJNEJ propozycje generuje backend (api/app/services/proposals.py):
 * np. optymalizacja średnia–wariancja z ograniczeniami z profilu, a model ML lekko koryguje oczekiwane
 * zwroty. Ten plik wtedy znika z frontendu — ekrany czytają odpowiedź GET /api/proposals.
 *
 * Kolejność udziałów: patrz INSTRUMENTS (świat, USA, EM, obl. skarbowe, obl. korpor., złoto, gotówka).
 */
import type { Plan } from '../plan';
import { profileByLevel, type RiskLevel } from '../profiles';
import { SAMPLE_ASSUMPTIONS, type MarketAssumptions } from './assumptions';
import { checkLimits, groupTotals, portfolioMetrics, type PortfolioMetrics, type Weights } from './engine';

export type ProposalKind = 'stabilnosc' | 'rownowaga' | 'wzrost';

export interface Proposal {
  /** np. „L3-rownowaga” — stały identyfikator, trafia do adresu strony szczegółów */
  id: string;
  level: RiskLevel;
  kind: ProposalKind;
  name: string;
  /** krótka etykieta na karcie */
  tag: string;
  /** jedno zdanie o pomyśle portfela */
  idea: string;
  weights: number[];
}

const COPY: Record<ProposalKind, Pick<Proposal, 'name' | 'tag' | 'idea'>> = {
  stabilnosc: {
    name: 'Stabilność',
    tag: 'Mniej wahań',
    idea: 'Najspokojniejszy z trzech: więcej obligacji, złota i gotówki, najmniejsze wahania w danych historycznych.',
  },
  rownowaga: {
    name: 'Równowaga',
    tag: 'Środek skali',
    idea: 'Pieniądze rozłożone tak, by żadna grupa instrumentów nie decydowała o wszystkim.',
  },
  wzrost: {
    name: 'Wzrost',
    tag: 'Więcej akcji',
    idea: 'Najwięcej akcji, na jakie pozwala Twój profil. Model lekko podbija klasy, które ocenia jako mocniejsze.',
  },
};

const KINDS: readonly ProposalKind[] = ['stabilnosc', 'rownowaga', 'wzrost'];

/** Udziały [stabilność, równowaga, wzrost] dla każdego poziomu profilu. */
const WEIGHTS: Record<RiskLevel, readonly [number[], number[], number[]]> = {
  1: [
    [2, 1, 0, 31, 16, 10, 40],
    [3, 2, 1, 30, 15, 11, 38],
    [4, 3, 1, 29, 14, 12, 37],
  ],
  2: [
    [6, 5, 1, 29, 14, 10, 35],
    [9, 8, 3, 27, 13, 12, 28],
    [14, 12, 4, 23, 12, 12, 23],
  ],
  3: [
    [10, 9, 3, 27, 13, 14, 24],
    [18, 15, 5, 20, 10, 15, 17],
    [24, 20, 6, 13, 7, 15, 15],
  ],
  4: [
    [21, 18, 6, 17, 8, 15, 15],
    [27, 23, 8, 11, 6, 15, 10],
    [28, 28, 14, 7, 3, 12, 8],
  ],
  5: [
    [28, 24, 8, 13, 7, 10, 10],
    [29, 29, 14, 8, 4, 10, 6],
    [30, 30, 24, 3, 2, 7, 4],
  ],
};

export function proposalId(level: RiskLevel, kind: ProposalKind): string {
  return `L${level}-${kind}`;
}

/** Trzy propozycje dla danego poziomu, od najspokojniejszej do najbardziej wzrostowej. */
export function proposalsForLevel(level: RiskLevel): Proposal[] {
  return KINDS.map((kind, index) => ({
    id: proposalId(level, kind),
    level,
    kind,
    ...COPY[kind],
    weights: [...WEIGHTS[level][index]!],
  }));
}

/** Odczytuje propozycję po identyfikatorze (np. z adresu strony); null, gdy identyfikator jest błędny. */
export function findProposal(id: string): Proposal | null {
  const match = /^L([1-5])-(stabilnosc|rownowaga|wzrost)$/.exec(id);
  if (!match) return null;
  const level = Number(match[1]) as RiskLevel;
  return proposalsForLevel(level).find((p) => p.id === id) ?? null;
}

/** Propozycja razem z liczbami do pokazania na karcie. */
export interface EvaluatedProposal extends Proposal {
  groupTotals: number[];
  metrics: PortfolioMetrics;
  withinLimits: boolean;
}

export function evaluateProposals(
  level: RiskLevel,
  plan: Plan,
  a: MarketAssumptions = SAMPLE_ASSUMPTIONS,
): EvaluatedProposal[] {
  const profile = profileByLevel(level);
  return proposalsForLevel(level).map((p) => {
    const metrics = portfolioMetrics(p.weights as Weights, plan, a);
    return {
      ...p,
      groupTotals: groupTotals(p.weights),
      metrics,
      withinLimits: checkLimits(metrics, profile).ok,
    };
  });
}
