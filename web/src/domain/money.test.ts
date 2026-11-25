import { describe, expect, it } from 'vitest';
import { formatMoney, isValidTarget, parseMoney } from './money';

describe('parseMoney', () => {
  it('czyta liczby zapisane na różne sposoby', () => {
    expect(parseMoney('100000')).toBe(100_000);
    expect(parseMoney('100 000')).toBe(100_000);
    expect(parseMoney('100 000')).toBe(100_000);
    expect(parseMoney('100 000 zł')).toBe(100_000);
    expect(parseMoney('  2 500 ZŁ ')).toBe(2_500);
  });

  it('odrzuca zapisy niejednoznaczne albo niepoprawne', () => {
    for (const text of ['', 'abc', '1,5', '1.000', '-10', '12 a']) {
      expect(parseMoney(text)).toBeNull();
    }
  });
});

describe('formatMoney', () => {
  it('grupuje tysiące twardą spacją', () => {
    expect(formatMoney(0)).toBe('0');
    expect(formatMoney(950)).toBe('950');
    expect(formatMoney(12_500)).toBe('12 500');
    expect(formatMoney(1_234_567)).toBe('1 234 567');
  });

  it('zaokrągla do pełnych złotych', () => {
    expect(formatMoney(16_000.4)).toBe('16 000');
  });
});

describe('isValidTarget', () => {
  it('puste pole jest poprawne, bo kwota celu jest opcjonalna', () => {
    expect(isValidTarget('')).toBe(true);
    expect(isValidTarget('   ')).toBe(true);
  });
  it('sprawdza zakres 1 000 – 100 000 000 zł', () => {
    expect(isValidTarget('999')).toBe(false);
    expect(isValidTarget('1000')).toBe(true);
    expect(isValidTarget('100000000')).toBe(true);
    expect(isValidTarget('100000001')).toBe(false);
  });
});
