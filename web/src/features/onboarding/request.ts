/**
 * Zamiana wartości formularza na kontrakt API (ProfileRequest).
 * To jedyne miejsce, które zna oba kształty danych — formularz i backend.
 */
import { parseMoney } from '@/domain/money';
import type { ProfileRequest } from '@/domain/profile';
import { EXCLUSION_OPTIONS, EXPERIENCE_OPTIONS } from '@/domain/questionnaire';
import type { FormValues } from './schema';

export function toProfileRequest(v: FormValues): ProfileRequest {
  return {
    goal: v.goal,
    horizon: v.horizon,
    targetAmountPLN: v.amount.trim() === '' ? null : parseMoney(v.amount),
    startBand: v.start,
    monthlyBand: v.monthly,
    cushion: v.cushion,
    income: v.income,
    loans: v.loans,
    acceptableDropPct: v.drop,
    reaction: v.reaction,
    riskPreference: v.ab,
    experience: EXPERIENCE_OPTIONS.filter((o) => v.exp[o.value]).map((o) => o.value),
    quiz: { q1: v.quiz.q1 ?? null, q2: v.quiz.q2 ?? null, q3: v.quiz.q3 ?? null },
    excludedSectors: EXCLUSION_OPTIONS.filter((o) => v.exclusions[o.value]).map((o) => o.value),
    esgPreferred: v.esg,
    instruments: v.typ,
    displayCurrency: v.ccy,
  };
}
