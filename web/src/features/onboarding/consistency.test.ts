import { describe, expect, it } from 'vitest';
import { notesForStep, softNotes } from './consistency';
import { DEMO_VALUES } from './schema';

const ids = (v: Parameters<typeof softNotes>[0]) => softNotes(v).map((n) => n.id);

describe('miękkie uwagi do odpowiedzi', () => {
  it('przykładowe odpowiedzi nie wywołują żadnej uwagi', () => {
    expect(softNotes(DEMO_VALUES)).toEqual([]);
  });

  it('poduszka jako cel → wskazówka o najbardziej zachowawczych propozycjach', () => {
    expect(ids({ goal: 'poduszka' })).toEqual(['goal-cushion']);
  });

  it('emerytura przy krótkim horyzoncie → uwaga o niespójności', () => {
    expect(ids({ goal: 'emerytura', horizon: 'do3' })).toEqual(['goal-horizon']);
    expect(ids({ goal: 'emerytura', horizon: '3do5' })).toEqual(['goal-horizon']);
    expect(ids({ goal: 'emerytura', horizon: 'ponad10' })).toEqual([]);
  });

  it('brak pełnej poduszki i wysokie raty', () => {
    expect(ids({ cushion: 'nie' })).toEqual(['no-cushion']);
    expect(ids({ cushion: 'czesciowo' })).toEqual(['no-cushion']);
    expect(ids({ cushion: 'tak' })).toEqual([]);
    expect(ids({ loans: 'ponad40' })).toEqual(['high-loans']);
  });

  it('duży akceptowany spadek, ale sprzedaż wszystkiego → uwaga o sprzeczności', () => {
    expect(ids({ drop: 30, reaction: 'wszystko' })).toEqual(['drop-vs-reaction']);
    expect(ids({ drop: 20, reaction: 'wszystko' })).toEqual([]);
    expect(ids({ drop: 40, reaction: 'czekam' })).toEqual([]);
  });

  it('notesForStep zwraca tylko uwagi z danego kroku', () => {
    const values = { goal: 'poduszka', cushion: 'nie' } as const;
    expect(notesForStep(values, 1).map((n) => n.id)).toEqual(['goal-cushion']);
    expect(notesForStep(values, 2).map((n) => n.id)).toEqual(['no-cushion']);
    expect(notesForStep(values, 3)).toEqual([]);
  });
});
