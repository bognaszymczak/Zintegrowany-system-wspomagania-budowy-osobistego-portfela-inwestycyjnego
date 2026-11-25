import { describe, expect, it } from 'vitest';
import { addDays, formatDatePl, todayIso } from './dates';

describe('daty', () => {
  it('todayIso zwraca datę ISO', () => {
    expect(todayIso(new Date('2026-11-03T22:15:00Z'))).toBe('2026-11-03');
  });
  it('addDays przechodzi przez koniec miesiąca i roku', () => {
    expect(addDays('2026-11-03', 7)).toBe('2026-11-10');
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04');
    expect(addDays('2028-02-27', 2)).toBe('2028-02-29');
  });
  it('formatDatePl: dzień bez zera, miesiąc z zerem', () => {
    expect(formatDatePl('2026-11-03')).toBe('3.11.2026');
    expect(formatDatePl('2026-11-10')).toBe('10.11.2026');
    expect(formatDatePl('2026-01-05')).toBe('5.01.2026');
    expect(formatDatePl('nie-data')).toBe('nie-data');
  });
});
