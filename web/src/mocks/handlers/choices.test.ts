import { describe, expect, it } from 'vitest';
import { ApiError } from '@/api/client';
import { matchPath } from '../router';
import { choiceRoutes, deleteChoice, saveChoice } from './choices';

const body = {
  profileId: 'mock-L3-test',
  level: 3,
  proposalId: 'L3-rownowaga',
  weights: [18, 15, 5, 20, 10, 15, 17],
};

const statusOf = (fn: () => unknown): number => {
  try {
    fn();
  } catch (error) {
    return (error as ApiError).status;
  }
  return 0;
};

describe('mock zapisu wyboru', () => {
  it('zapisuje wybór i zwraca go z identyfikatorem oraz datą', () => {
    const saved = saveChoice(body, new Date('2026-11-03T12:00:00Z'));
    expect(saved.id.startsWith('choice-')).toBe(true);
    expect(saved.savedAt).toBe('2026-11-03T12:00:00.000Z');
    expect(saved.weights).toEqual(body.weights);
    expect(saved.proposalId).toBe('L3-rownowaga');
  });

  it('można go cofnąć; druga próba cofnięcia tego samego wyboru → 404', () => {
    const saved = saveChoice(body);
    expect(() => deleteChoice(saved.id)).not.toThrow();
    expect(statusOf(() => deleteChoice(saved.id))).toBe(404);
  });

  it('odrzuca niepoprawne udziały (suma ≠ 100) i obcą propozycję', () => {
    expect(statusOf(() => saveChoice({ ...body, weights: [10, 10, 10, 10, 10, 10, 10] }))).toBe(422);
    expect(statusOf(() => saveChoice({ ...body, proposalId: 'L5-wzrost' }))).toBe(422);
    expect(statusOf(() => saveChoice({ ...body, proposalId: 'nie-ma-takiej' }))).toBe(422);
  });

  it('nieznany profil → 404', () => {
    expect(statusOf(() => saveChoice({ ...body, profileId: 'cos-innego' }))).toBe(404);
    expect(statusOf(() => saveChoice(null))).toBe(404);
  });

  it('trasy: POST /choices i DELETE /choices/:id', () => {
    expect(choiceRoutes.map((r) => `${r.method} ${r.path}`)).toEqual(['POST /choices', 'DELETE /choices/:id']);
  });
});

describe('dopasowanie ścieżek z parametrami', () => {
  it('wyciąga parametry i odrzuca niezgodne ścieżki', () => {
    expect(matchPath('/choices/:id', '/choices/abc-1')).toEqual({ id: 'abc-1' });
    expect(matchPath('/choices/:id', '/choices/a%20b')).toEqual({ id: 'a b' });
    expect(matchPath('/choices', '/choices')).toEqual({});
    expect(matchPath('/choices/:id', '/choices')).toBeNull();
    expect(matchPath('/choices/:id', '/choices/')).toBeNull();
    expect(matchPath('/choices/:id', '/proposals/abc')).toBeNull();
    expect(matchPath('/choices', '/choices/abc')).toBeNull();
  });
});
