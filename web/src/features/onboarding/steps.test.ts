import { describe, expect, it } from 'vitest';
import { formSchema } from './schema';
import { STEPS, STEP_COUNT, firstStepWithError, stepDef, stepOfField } from './steps';

describe('kroki kreatora', () => {
  it('jest ich pięć, ponumerowanych po kolei', () => {
    expect(STEPS).toHaveLength(STEP_COUNT);
    expect(STEPS.map((s) => s.n)).toEqual([1, 2, 3, 4, 5]);
  });

  it('każde pole schematu należy do dokładnie jednego kroku (nic nie ginie przy „Dalej”)', () => {
    const schemaKeys = Object.keys(formSchema.shape).sort();
    const stepKeys = STEPS.flatMap((s) => [...s.fields]).sort();
    expect(stepKeys).toEqual(schemaKeys);
  });

  it('stepOfField rozpoznaje pola zagnieżdżone', () => {
    expect(stepOfField('amount')).toBe(1);
    expect(stepOfField('exp.lok')).toBe(4);
    expect(stepOfField('quiz.q2')).toBe(4);
    expect(stepOfField('exclusions.bron')).toBe(5);
    expect(stepOfField('nieznane')).toBeNull();
  });

  it('firstStepWithError wskazuje najwcześniejszy krok z błędem', () => {
    expect(firstStepWithError({})).toBeNull();
    expect(firstStepWithError({ typ: {}, cushion: {} })).toBe(2);
    expect(firstStepWithError({ ccy: {} })).toBe(5);
  });

  it('stepDef ogranicza numer do zakresu 1–5', () => {
    expect(stepDef(0).n).toBe(1);
    expect(stepDef(9).n).toBe(5);
  });
});
