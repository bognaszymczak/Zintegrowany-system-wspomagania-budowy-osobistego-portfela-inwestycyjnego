import { describe, expect, it } from 'vitest';
import { toProfileRequest } from '@/features/onboarding/request';
import { DEMO_VALUES } from '@/features/onboarding/schema';
import { applyLevelShift, computeProfile, toScore, type ProfileRequest } from './profile';

const base: ProfileRequest = toProfileRequest(DEMO_VALUES);
const withAnswers = (patch: Partial<ProfileRequest>): ProfileRequest => ({ ...base, ...patch });

describe('toScore', () => {
  it('zamienia udział 0–1 na wynik 1–5, zaokrąglając w dół', () => {
    expect(toScore(0)).toBe(1);
    expect(toScore(0.24)).toBe(1);
    expect(toScore(0.25)).toBe(2);
    expect(toScore(0.5)).toBe(3);
    expect(toScore(0.75)).toBe(4);
    expect(toScore(0.999)).toBe(4);
    expect(toScore(1)).toBe(5);
  });

  it('nie wychodzi poza zakres 1–5', () => {
    expect(toScore(-3)).toBe(1);
    expect(toScore(7)).toBe(5);
  });
});

describe('computeProfile', () => {
  it('przykładowe odpowiedzi dają profil Zrównoważony (3)', () => {
    const p = computeProfile(base);
    expect(p.scores).toEqual({ capacity: 4, tolerance: 3, horizon: 4 });
    expect(p.level).toBe(3);
    expect(p.behaviorCapApplied).toBe(false);
    expect(p.goalCapApplied).toBe(false);
  });

  it('najodważniejsze odpowiedzi dają 5, a najbardziej zachowawcze 1', () => {
    const bold = computeProfile(
      withAnswers({
        cushion: 'tak',
        income: 'staly',
        loans: 'brak',
        acceptableDropPct: 40,
        reaction: 'dokupuje',
        riskPreference: 'ryzyko',
        horizon: 'ponad10',
      }),
    );
    expect(bold.level).toBe(5);

    const timid = computeProfile(
      withAnswers({
        cushion: 'nie',
        income: 'niepewny',
        loans: 'ponad40',
        acceptableDropPct: 10,
        reaction: 'wszystko',
        riskPreference: 'pewne',
        horizon: 'do3',
      }),
    );
    expect(timid.level).toBe(1);
  });

  it('wybiera ostrożniejszy wynik: tolerancja wysoka, zdolność niska', () => {
    const p = computeProfile(
      withAnswers({ cushion: 'nie', income: 'niepewny', loans: 'ponad40', acceptableDropPct: 40, reaction: 'dokupuje' }),
    );
    expect(p.scores.tolerance).toBe(5);
    expect(p.scores.capacity).toBe(1);
    expect(p.level).toBe(1);
  });

  it('kto sprzedałby wszystko, nie ma tolerancji powyżej 2 — nawet jeśli deklaruje duży spadek', () => {
    const p = computeProfile(withAnswers({ acceptableDropPct: 40, reaction: 'wszystko' }));
    expect(p.scores.tolerance).toBe(2);
    expect(p.behaviorCapApplied).toBe(true);
    expect(p.level).toBe(2);
  });

  it('krótki horyzont ogranicza profil', () => {
    const p = computeProfile(withAnswers({ horizon: 'do3' }));
    expect(p.scores.horizon).toBe(2);
    expect(p.level).toBe(2);
  });

  it('cel „poduszka bezpieczeństwa” ogranicza profil do najniższego poziomu', () => {
    const p = computeProfile(withAnswers({ goal: 'poduszka' }));
    expect(p.level).toBe(1);
    expect(p.goalCapApplied).toBe(true);
  });

  it('goalCapApplied jest false, gdy profil i tak jest najniższy', () => {
    const p = computeProfile(
      withAnswers({ goal: 'poduszka', cushion: 'nie', income: 'niepewny', loans: 'ponad40' }),
    );
    expect(p.level).toBe(1);
    expect(p.goalCapApplied).toBe(false);
  });

  it('poziom wiedzy zależy od quizu i doświadczenia, ale nie od ryzyka', () => {
    const none = computeProfile(withAnswers({ experience: ['lok'], quiz: { q1: null, q2: null, q3: null } }));
    expect(none.knowledge).toBe('podstawowa');
    expect(none.quizCorrect).toBe(0);

    const two = computeProfile(withAnswers({ experience: [], quiz: { q1: 'b', q2: 'b', q3: 'c' } }));
    expect(two.knowledge).toBe('srednia');
    expect(two.quizCorrect).toBe(2);

    const etfOnly = computeProfile(withAnswers({ experience: ['etf'], quiz: { q1: 'nw', q2: 'nw', q3: 'nw' } }));
    expect(etfOnly.knowledge).toBe('srednia');

    const good = computeProfile(withAnswers({ experience: ['akc'], quiz: { q1: 'b', q2: 'b', q3: 'b' } }));
    expect(good.knowledge).toBe('dobra');

    // wiedza nie zmienia poziomu ryzyka
    expect(good.level).toBe(none.level);
  });
});

describe('monotoniczność punktacji', () => {
  // Każda lista idzie od odpowiedzi „lepszej dla ryzyka” do „gorszej”.
  const ladders = {
    cushion: ['tak', 'czesciowo', 'nie'],
    income: ['staly', 'zmienny', 'niepewny'],
    loans: ['brak', 'do20', '20do40', 'ponad40'],
    acceptableDropPct: [40, 30, 20, 10],
    reaction: ['dokupuje', 'czekam', 'czesc', 'wszystko'],
    riskPreference: ['ryzyko', 'pewne'],
    horizon: ['ponad10', '5do10', '3do5', 'do3'],
    goal: ['mieszkanie', 'poduszka'],
  } as const;

  it('pogorszenie jednej odpowiedzi nigdy nie podnosi profilu ani żadnego z wyników', () => {
    const keys = Object.keys(ladders) as (keyof typeof ladders)[];
    let checked = 0;

    const walk = (index: number, current: Record<string, unknown>) => {
      if (index === keys.length) {
        const req = withAnswers(current as Partial<ProfileRequest>);
        const here = computeProfile(req);
        for (const key of keys) {
          const ladder = ladders[key] as readonly unknown[];
          const pos = ladder.indexOf(current[key]);
          const worse = ladder[pos + 1];
          if (worse === undefined) continue;
          const after = computeProfile({ ...req, [key]: worse } as ProfileRequest);
          expect(after.level).toBeLessThanOrEqual(here.level);
          expect(after.scores.capacity).toBeLessThanOrEqual(here.scores.capacity);
          expect(after.scores.tolerance).toBeLessThanOrEqual(here.scores.tolerance);
          expect(after.scores.horizon).toBeLessThanOrEqual(here.scores.horizon);
          checked += 1;
        }
        return;
      }
      const key = keys[index] as keyof typeof ladders;
      for (const value of ladders[key] as readonly unknown[]) walk(index + 1, { ...current, [key]: value });
    };
    walk(0, {});

    expect(checked).toBeGreaterThan(10_000);
  });
});

describe('applyLevelShift', () => {
  it('przesuwa poziom o jeden i nie wychodzi poza 1–5', () => {
    expect(applyLevelShift(3, -1)).toBe(2);
    expect(applyLevelShift(3, 0)).toBe(3);
    expect(applyLevelShift(3, 1)).toBe(4);
    expect(applyLevelShift(5, 1)).toBe(5);
    expect(applyLevelShift(1, -1)).toBe(1);
  });
});
