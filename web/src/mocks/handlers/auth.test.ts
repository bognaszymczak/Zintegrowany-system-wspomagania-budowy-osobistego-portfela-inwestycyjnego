import { describe, expect, it } from 'vitest';
import type { ApiError } from '@/api/client';
import { ADULT_REQUIRED_MESSAGE, authRoutes } from './auth';

const register = authRoutes.find((route) => route.method === 'POST' && route.path === '/auth/register')!.handler;

const valid = {
  name: 'Anna',
  email: 'anna.mock@przyklad.pl',
  password: 'kilka slow oddzielonych spacjami',
  adultConfirmed: true,
  acceptTerms: true,
  acceptSimulation: true,
  marketingOptIn: false,
};

/** Zwraca błąd rzucony przez handler albo null, gdy rejestracja się udała. */
const failure = (body: unknown): ApiError | null => {
  try {
    register({ body });
  } catch (error) {
    return error as ApiError;
  }
  return null;
};

describe('mock rejestracji — oświadczenie o pełnoletności', () => {
  it('bez oświadczenia (false, brak pola, inna wartość) konto nie powstaje: 422 i kod adult_required', () => {
    const cases = [
      { ...valid, email: 'a1@przyklad.pl', adultConfirmed: false },
      { ...valid, email: 'a2@przyklad.pl', adultConfirmed: undefined },
      { ...valid, email: 'a3@przyklad.pl', adultConfirmed: 'true' },
    ];
    for (const body of cases) {
      const error = failure(body);
      expect(error?.status).toBe(422);
      expect(error?.code).toBe('adult_required');
      expect(error?.message).toBe(ADULT_REQUIRED_MESSAGE);
    }
  });

  it('pełnoletność jest sprawdzana przed resztą (czytelny komunikat nawet przy innych brakach)', () => {
    const error = failure({ ...valid, email: 'zly-adres', adultConfirmed: false });
    expect(error?.code).toBe('adult_required');
  });

  it('z oświadczeniem rejestracja się udaje', () => {
    expect(failure({ ...valid, email: 'poprawne@przyklad.pl' })).toBeNull();
  });

  it('pozostałe zgody nadal są wymagane', () => {
    expect(failure({ ...valid, email: 'b1@przyklad.pl', acceptTerms: false })?.code).toBe('validation_error');
    expect(failure({ ...valid, email: 'b2@przyklad.pl', acceptSimulation: false })?.code).toBe('validation_error');
  });
});
