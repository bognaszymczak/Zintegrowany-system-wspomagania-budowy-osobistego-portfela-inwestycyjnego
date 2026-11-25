import { describe, expect, it } from 'vitest';
import { planFromRequest } from '@/domain/plan';
import { toProfileRequest } from './request';
import { DEMO_VALUES } from './schema';

describe('toProfileRequest', () => {
  it('zamienia przykładowe odpowiedzi na kontrakt API', () => {
    expect(toProfileRequest(DEMO_VALUES)).toEqual({
      goal: 'mieszkanie',
      horizon: '5do10',
      targetAmountPLN: 100_000,
      startBand: '5do20k',
      monthlyBand: '300do1000',
      cushion: 'tak',
      income: 'staly',
      loans: 'do20',
      acceptableDropPct: 20,
      reaction: 'czekam',
      riskPreference: 'ryzyko',
      experience: ['lok', 'etf'],
      quiz: { q1: 'b', q2: 'b', q3: 'b' },
      excludedSectors: [],
      esgPreferred: false,
      instruments: 'etf',
      displayCurrency: 'pln',
    });
  });

  it('puste pole kwoty daje null, a nie zero', () => {
    expect(toProfileRequest({ ...DEMO_VALUES, amount: '' }).targetAmountPLN).toBeNull();
    expect(toProfileRequest({ ...DEMO_VALUES, amount: '   ' }).targetAmountPLN).toBeNull();
  });

  it('wykluczenia i brak odpowiedzi w quizie', () => {
    const request = toProfileRequest({
      ...DEMO_VALUES,
      exclusions: { bron: true, tyton: false, paliwa: false, hazard: true },
      esg: true,
      quiz: { q1: undefined, q2: null, q3: 'nw' },
    });
    expect(request.excludedSectors).toEqual(['bron', 'hazard']);
    expect(request.esgPreferred).toBe(true);
    expect(request.quiz).toEqual({ q1: null, q2: null, q3: 'nw' });
  });
});

describe('plan oszczędzania', () => {
  it('przedziały z formularza zamieniają się na wartości reprezentatywne', () => {
    expect(planFromRequest(toProfileRequest(DEMO_VALUES))).toEqual({
      startPLN: 12_500,
      monthlyPLN: 650,
      years: 7,
      targetPLN: 100_000,
    });
  });
});
