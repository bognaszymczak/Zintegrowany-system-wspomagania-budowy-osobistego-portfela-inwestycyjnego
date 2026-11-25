import { describe, expect, it } from 'vitest';
import { dec, percentRound, plain, rangeTys, signedPp, zl } from './format';

const NBSP = ' ';

describe('formatowanie', () => {
  it('plain i zl używają twardych spacji', () => {
    expect(plain(108_400)).toBe(`108${NBSP}400`);
    expect(plain(950)).toBe('950');
    expect(zl(108_412)).toBe(`108${NBSP}400${NBSP}zł`);
    expect(zl(108_450)).toBe(`108${NBSP}500${NBSP}zł`);
    expect(zl(2_499, 1000)).toBe(`2${NBSP}000${NBSP}zł`);
  });
  it('rangeTys', () => {
    expect(rangeTys(85_600, 138_000)).toBe(`86–138${NBSP}tys.${NBSP}zł`);
  });
  it('dec, signedPp, percentRound', () => {
    expect(dec(0.0345 * 100)).toBe('3,5');
    expect(dec(5.1, 2)).toBe('5,10');
    expect(signedPp(0.73)).toBe('+0,7');
    expect(signedPp(-0.44)).toBe('−0,4');
    expect(percentRound(0.677)).toBe('68%');
  });
});
