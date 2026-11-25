import { describe, expect, it } from 'vitest';
import { DRAFT_KEY, clearDraft, loadDraft, sanitizeValues, saveDraft, type StorageLike } from './draft';
import { DEMO_VALUES } from './schema';

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = String(value);
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

describe('zapis roboczy formularza', () => {
  it('zapisuje i odczytuje odpowiedzi razem z krokiem', () => {
    const storage = fakeStorage();
    expect(saveDraft({ values: DEMO_VALUES, step: 3, maxStep: 4 }, storage)).toBe(true);

    const draft = loadDraft(storage);
    expect(draft?.step).toBe(3);
    expect(draft?.maxStep).toBe(4);
    expect(draft?.values).toEqual(DEMO_VALUES);
    expect(draft?.savedAt).not.toBe('');
  });

  it('brak zapisu → null', () => {
    expect(loadDraft(fakeStorage())).toBeNull();
  });

  it('uszkodzony JSON albo zła wersja → null (nic się nie wywraca)', () => {
    expect(loadDraft(fakeStorage({ [DRAFT_KEY]: '{nie json' }))).toBeNull();
    expect(loadDraft(fakeStorage({ [DRAFT_KEY]: JSON.stringify({ version: 99, values: {} }) }))).toBeNull();
    expect(loadDraft(fakeStorage({ [DRAFT_KEY]: 'null' }))).toBeNull();
  });

  it('pola, które przestały być poprawne, są pomijane, reszta zostaje', () => {
    const storage = fakeStorage({
      [DRAFT_KEY]: JSON.stringify({
        version: 1,
        step: 2,
        maxStep: 2,
        values: { goal: 'stara-odpowiedz', horizon: '5do10', drop: 25, amount: '50 000' },
      }),
    });
    expect(loadDraft(storage)?.values).toEqual({ horizon: '5do10', amount: '50 000' });
  });

  it('numer kroku jest ograniczany do 1–5, a maxStep nie jest mniejszy od step', () => {
    const storage = fakeStorage({
      [DRAFT_KEY]: JSON.stringify({ version: 1, step: 9, maxStep: 1, values: {} }),
    });
    const draft = loadDraft(storage);
    expect(draft?.step).toBe(5);
    expect(draft?.maxStep).toBe(5);
  });

  it('clearDraft usuwa zapis', () => {
    const storage = fakeStorage();
    saveDraft({ values: DEMO_VALUES, step: 1, maxStep: 1 }, storage);
    clearDraft(storage);
    expect(loadDraft(storage)).toBeNull();
  });

  it('bez dostępu do localStorage (np. tryb prywatny) aplikacja działa dalej', () => {
    expect(loadDraft(null)).toBeNull();
    expect(saveDraft({ values: {}, step: 1, maxStep: 1 }, null)).toBe(false);
    expect(() => clearDraft(null)).not.toThrow();

    const broken: StorageLike = {
      getItem: () => {
        throw new Error('zablokowane');
      },
      setItem: () => {
        throw new Error('pełne');
      },
      removeItem: () => {
        throw new Error('zablokowane');
      },
    };
    expect(loadDraft(broken)).toBeNull();
    expect(saveDraft({ values: {}, step: 1, maxStep: 1 }, broken)).toBe(false);
    expect(() => clearDraft(broken)).not.toThrow();
  });

  it('sanitizeValues ignoruje wszystko, co nie jest obiektem', () => {
    expect(sanitizeValues(null)).toEqual({});
    expect(sanitizeValues('tekst')).toEqual({});
    expect(sanitizeValues(42)).toEqual({});
  });
});
