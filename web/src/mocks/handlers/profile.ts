import { ApiError } from '@/api/client';
import type { ProfileRequest, ProfileResponse } from '@/api/types';
import { planFromRequest } from '@/domain/plan';
import { computeProfile } from '@/domain/profile';
import { profileByLevel } from '@/domain/profiles';
import {
  CURRENCY_OPTIONS,
  CUSHION_OPTIONS,
  DROP_VALUES,
  EXCLUSION_OPTIONS,
  EXPERIENCE_OPTIONS,
  GOAL_OPTIONS,
  HORIZON_OPTIONS,
  INCOME_OPTIONS,
  INSTRUMENTS_OPTIONS,
  LOANS_OPTIONS,
  MONTHLY_OPTIONS,
  QUIZ,
  QUIZ_ANSWER_VALUES,
  REACTION_OPTIONS,
  RISK_PREFERENCE_OPTIONS,
  START_OPTIONS,
} from '@/domain/questionnaire';
import type { MockRoute } from '../router';
import { rememberProfile } from '../profileStore';

const inList = (list: readonly { readonly value: string }[], value: unknown) =>
  list.some((o) => o.value === value);

/**
 * Sprawdza kształt żądania tak, jak zrobi to backend (pydantic zwraca wtedy HTTP 422).
 * Zwraca listę pól z błędami; pusta lista = żądanie poprawne.
 */
export function invalidProfileFields(body: unknown): string[] {
  const b = (body ?? {}) as Record<string, unknown>;
  const bad: string[] = [];
  const check = (field: string, ok: boolean) => {
    if (!ok) bad.push(field);
  };

  check('goal', inList(GOAL_OPTIONS, b.goal));
  check('horizon', inList(HORIZON_OPTIONS, b.horizon));
  check(
    'targetAmountPLN',
    b.targetAmountPLN === null || (typeof b.targetAmountPLN === 'number' && b.targetAmountPLN > 0),
  );
  check('startBand', inList(START_OPTIONS, b.startBand));
  check('monthlyBand', inList(MONTHLY_OPTIONS, b.monthlyBand));
  check('cushion', inList(CUSHION_OPTIONS, b.cushion));
  check('income', inList(INCOME_OPTIONS, b.income));
  check('loans', inList(LOANS_OPTIONS, b.loans));
  check('acceptableDropPct', (DROP_VALUES as readonly unknown[]).includes(b.acceptableDropPct));
  check('reaction', inList(REACTION_OPTIONS, b.reaction));
  check('riskPreference', inList(RISK_PREFERENCE_OPTIONS, b.riskPreference));
  check(
    'experience',
    Array.isArray(b.experience) && b.experience.every((v) => inList(EXPERIENCE_OPTIONS, v)),
  );
  const quiz = (b.quiz ?? {}) as Record<string, unknown>;
  for (const q of QUIZ) {
    const answer = quiz[q.id];
    check(`quiz.${q.id}`, answer === null || (QUIZ_ANSWER_VALUES as readonly unknown[]).includes(answer));
  }
  check(
    'excludedSectors',
    Array.isArray(b.excludedSectors) && b.excludedSectors.every((v) => inList(EXCLUSION_OPTIONS, v)),
  );
  check('esgPreferred', typeof b.esgPreferred === 'boolean');
  check('instruments', inList(INSTRUMENTS_OPTIONS, b.instruments));
  check('displayCurrency', inList(CURRENCY_OPTIONS, b.displayCurrency));
  return bad;
}

let counter = 0;

export function buildProfileResponse(request: ProfileRequest, now = new Date()): ProfileResponse {
  const scoring = computeProfile(request);
  const profile = profileByLevel(scoring.level);
  counter += 1;
  return {
    ...scoring,
    // „mock-L3-…”: poziom zaszyty w identyfikatorze pozwala innym mockom odtworzyć profil po odświeżeniu strony
    profileId: `mock-L${scoring.level}-${now.getTime().toString(36)}${counter}`,
    name: profile.name,
    limits: {
      volatility: profile.volatility,
      maxDrawdown: profile.maxDrawdown,
      maxEquity: profile.maxEquity,
      maxPosition: profile.maxPosition,
    },
    plan: planFromRequest(request),
    createdAt: now.toISOString(),
  };
}

export const profileRoutes: MockRoute[] = [
  {
    method: 'POST',
    path: '/profile',
    handler: ({ body }) => {
      const bad = invalidProfileFields(body);
      if (bad.length > 0) {
        throw new ApiError(422, 'validation_error', 'Wysłane dane są niepoprawne.', bad);
      }
      const response = buildProfileResponse(body as ProfileRequest);
      rememberProfile(response);
      return response;
    },
  },
];
