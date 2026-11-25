import { describe, expect, it } from 'vitest';
import { ApiError } from '@/api/client';
import { toProfileRequest } from '@/features/onboarding/request';
import { DEMO_VALUES } from '@/features/onboarding/schema';
import { authRoutes, DEMO_ACCOUNT } from './auth';
import { buildProfileResponse, invalidProfileFields, profileRoutes } from './profile';

const request = toProfileRequest(DEMO_VALUES);
const call = (routes: typeof authRoutes, path: string, body?: unknown) => {
  const route = routes.find((r) => r.path === path);
  if (!route) throw new Error(`brak trasy ${path}`);
  return route.handler({ body });
};

describe('mock POST /profile', () => {
  it('poprawne żądanie nie ma błędów walidacji', () => {
    expect(invalidProfileFields(request)).toEqual([]);
  });

  it('wskazuje wszystkie niepoprawne pola', () => {
    const bad = invalidProfileFields({ ...request, goal: 'x', acceptableDropPct: 33, quiz: { q1: 'q', q2: null, q3: null } });
    expect(bad.sort()).toEqual(['acceptableDropPct', 'goal', 'quiz.q1']);
    expect(invalidProfileFields(null).length).toBeGreaterThan(10);
  });

  it('odpowiedź zawiera profil, granice ryzyka i plan', () => {
    const response = buildProfileResponse(request, new Date('2026-11-03T12:00:00Z'));
    expect(response.level).toBe(3);
    expect(response.name).toBe('Zrównoważony');
    expect(response.limits).toEqual({ volatility: 0.1, maxDrawdown: -0.2, maxEquity: 0.5, maxPosition: 0.3 });
    expect(response.plan).toEqual({ startPLN: 12_500, monthlyPLN: 650, years: 7, targetPLN: 100_000 });
    expect(response.profileId.startsWith('mock-L3-')).toBe(true);
    expect(response.createdAt).toBe('2026-11-03T12:00:00.000Z');
  });

  it('trasa zwraca błąd 422 dla niepoprawnych danych', () => {
    const route = profileRoutes[0];
    expect(() => route?.handler({ body: { goal: 'x' } })).toThrow(ApiError);
    try {
      route?.handler({ body: { goal: 'x' } });
    } catch (error) {
      expect((error as ApiError).status).toBe(422);
    }
  });
});

describe('mock konta', () => {
  const email = `test-${Date.now()}@przyklad.pl`;
  const registerBody = {
    name: 'Ola',
    email,
    password: 'bardzo-dlugie-haslo',
    adultConfirmed: true,
    acceptTerms: true,
    acceptSimulation: true,
    marketingOptIn: false,
  };

  it('rejestracja, odczyt sesji, wylogowanie i ponowne logowanie', () => {
    const created = call(authRoutes, '/auth/register', registerBody) as { user: { email: string; name: string | null } };
    expect(created.user.email).toBe(email);
    expect(created.user.name).toBe('Ola');
    expect(JSON.stringify(created)).not.toContain('bardzo-dlugie-haslo');

    expect((call(authRoutes, '/auth/me') as { user: { email: string } }).user.email).toBe(email);

    call(authRoutes, '/auth/logout');
    expect(() => call(authRoutes, '/auth/me')).toThrow(ApiError);

    const again = call(authRoutes, '/auth/login', { email: email.toUpperCase(), password: 'bardzo-dlugie-haslo' }) as { user: { email: string } };
    expect(again.user.email).toBe(email);
  });

  it('powtórna rejestracja tego samego adresu → 409', () => {
    try {
      call(authRoutes, '/auth/register', registerBody);
      throw new Error('powinno rzucić');
    } catch (error) {
      expect((error as ApiError).status).toBe(409);
    }
  });

  it('za krótkie hasło, brak zgód albo brak oświadczenia o pełnoletności → 422', () => {
    const patches = [
      { password: 'krotkie' },
      { adultConfirmed: false },
      { acceptTerms: false },
      { acceptSimulation: false },
      { email: 'bez-malpy' },
    ];
    for (const patch of patches) {
      try {
        call(authRoutes, '/auth/register', { ...registerBody, email: `x${Math.random()}@przyklad.pl`, ...patch });
        throw new Error('powinno rzucić');
      } catch (error) {
        expect((error as ApiError).status).toBe(422);
      }
    }
  });

  it('złe hasło → 401, konto demo działa zawsze', () => {
    try {
      call(authRoutes, '/auth/login', { email: DEMO_ACCOUNT.email, password: 'zle' });
      throw new Error('powinno rzucić');
    } catch (error) {
      expect((error as ApiError).status).toBe(401);
    }
    const ok = call(authRoutes, '/auth/login', { email: DEMO_ACCOUNT.email, password: DEMO_ACCOUNT.password }) as { user: { name: string | null } };
    expect(ok.user.name).toBe('Anna');
  });
});
