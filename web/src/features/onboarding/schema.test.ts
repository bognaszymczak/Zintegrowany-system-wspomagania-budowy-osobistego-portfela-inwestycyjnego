import { describe, expect, it } from 'vitest';
import { DEMO_VALUES, EMPTY_VALUES, formSchema } from './schema';

type Issue = { path: string; message: string };

function issuesOf(value: unknown): Issue[] {
  const result = formSchema.safeParse(value);
  return result.success
    ? []
    : result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}

/** Tak wygląda formularz tuż po wejściu: react-hook-form oddaje null dla pustych grup radio. */
const untouched = {
  ...EMPTY_VALUES,
  goal: null,
  horizon: null,
  start: null,
  monthly: null,
  cushion: null,
  income: null,
  loans: null,
  reaction: null,
  ab: null,
  typ: null,
  ccy: null,
};

describe('formSchema', () => {
  it('akceptuje przykładowe, kompletne odpowiedzi', () => {
    expect(issuesOf(DEMO_VALUES)).toEqual([]);
  });

  it('pusty formularz zgłasza każde wymagane pytanie z polskim komunikatem', () => {
    const issues = issuesOf(untouched);
    const byPath = Object.fromEntries(issues.map((i) => [i.path, i.message]));

    expect(Object.keys(byPath).sort()).toEqual(
      ['ab', 'ccy', 'cushion', 'exp', 'goal', 'horizon', 'income', 'loans', 'monthly', 'reaction', 'start', 'typ'].sort(),
    );
    expect(byPath.goal).toBe('Wybierz, na co chcesz odkładać.');
    expect(byPath.exp).toBe('Zaznacz, z czym masz doświadczenie, albo „Nic z tego”.');
  });

  it('pola opcjonalne nie blokują: kwota celu, quiz, wykluczenia, ESG', () => {
    const issues = issuesOf({ ...DEMO_VALUES, amount: '', quiz: { q1: null, q2: undefined, q3: 'nw' } });
    expect(issues).toEqual([]);
  });

  it('odrzuca odpowiedź spoza słownika', () => {
    const issues = issuesOf({ ...DEMO_VALUES, goal: 'kryptowaluty' });
    expect(issues.map((i) => i.path)).toEqual(['goal']);
  });

  describe('kwota celu', () => {
    const ok = ['', '100 000', '100000', '100 000', '100 000 zł', '1000', '100000000'];
    const bad = ['999', '12a', '1,5', '1.000', '-5000', '100000001', 'dużo'];

    for (const amount of ok) {
      it(`przyjmuje „${amount}”`, () => {
        expect(issuesOf({ ...DEMO_VALUES, amount })).toEqual([]);
      });
    }
    for (const amount of bad) {
      it(`odrzuca „${amount}”`, () => {
        const issues = issuesOf({ ...DEMO_VALUES, amount });
        expect(issues.map((i) => i.path)).toEqual(['amount']);
      });
    }
  });

  describe('doświadczenie', () => {
    const none = { lok: false, obl: false, akc: false, etf: false, nic: false };

    it('wymaga zaznaczenia czegokolwiek (może to być „Nic z tego”)', () => {
      expect(issuesOf({ ...DEMO_VALUES, exp: none }).map((i) => i.path)).toEqual(['exp']);
      expect(issuesOf({ ...DEMO_VALUES, exp: { ...none, nic: true } })).toEqual([]);
      expect(issuesOf({ ...DEMO_VALUES, exp: { ...none, lok: true, etf: true } })).toEqual([]);
    });

    it('„Nic z tego” wyklucza pozostałe odpowiedzi', () => {
      const issues = issuesOf({ ...DEMO_VALUES, exp: { ...none, nic: true, akc: true } });
      expect(issues).toEqual([{ path: 'exp', message: '„Nic z tego” nie łączy się z pozostałymi odpowiedziami.' }]);
    });
  });

  describe('suwak spadku', () => {
    it('przyjmuje 10, 20, 30, 40', () => {
      for (const drop of [10, 20, 30, 40]) expect(issuesOf({ ...DEMO_VALUES, drop })).toEqual([]);
    });
    it('odrzuca inne wartości i tekst', () => {
      for (const drop of [0, 15, 50, '20', null]) {
        const issues = issuesOf({ ...DEMO_VALUES, drop });
        expect(issues.map((i) => i.path)).toEqual(['drop']);
        expect(issues[0]?.message).toBe('Wybierz akceptowany spadek na suwaku.');
      }
    });
  });

  it('quiz: odrzuca nieznaną odpowiedź', () => {
    const issues = issuesOf({ ...DEMO_VALUES, quiz: { q1: 'z', q2: 'b', q3: 'b' } });
    expect(issues.map((i) => i.path)).toEqual(['quiz.q1']);
  });
});
