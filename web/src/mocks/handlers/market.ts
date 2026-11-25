import { ApiError } from '@/api/client';
import { todayIso } from '@/domain/dates';
import { isValidWeights } from '@/domain/portfolio/engine';
import { SAMPLE_ASSUMPTIONS, type MarketAssumptions } from '@/domain/portfolio/assumptions';
import { simulateBacktest } from '../backtest';
import type { MockRoute } from '../router';

/** Parametry rynkowe „z dzisiejszą datą” — w produkcji liczy je zadanie nocne i zapisuje w bazie. */
export function assumptionsAt(now: Date = new Date()): MarketAssumptions {
  return { ...SAMPLE_ASSUMPTIONS, asOf: todayIso(now) };
}

/** „18,15,5,20,10,15,17” → [18,15,5,20,10,15,17]; null, gdy tekst nie jest poprawnym wektorem udziałów. */
export function parseWeights(text: unknown): number[] | null {
  if (typeof text !== 'string' || text.trim() === '') return null;
  const parts = text.split(',').map((x) => Number(x.trim()));
  return isValidWeights(parts) ? parts : null;
}

export const marketRoutes: MockRoute[] = [
  { method: 'GET', path: '/market/assumptions', latencyMs: 120, handler: () => assumptionsAt() },
  {
    method: 'GET',
    path: '/market/backtest',
    latencyMs: 300,
    handler: ({ query }) => {
      const weights = parseWeights(query?.weights);
      if (!weights) {
        throw new ApiError(422, 'validation_error', 'Udziały muszą być 7 liczbami o sumie 100.', ['weights']);
      }
      return simulateBacktest(weights);
    },
  },
];
