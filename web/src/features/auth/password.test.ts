import { describe, expect, it } from 'vitest';
import { passwordStrength } from './password';

describe('siła hasła', () => {
  it('poniżej 10 znaków: za krótkie', () => {
    expect(passwordStrength('').label).toBe('Za krótkie');
    expect(passwordStrength('Abc123!?x').score).toBe(0);
  });
  it('słabe: powtórzenia, popularne słowa, same małe litery', () => {
    expect(passwordStrength('aaaaaaaaaaaa').label).toBe('Słabe');
    expect(passwordStrength('haslo12345678').label).toBe('Słabe');
    expect(passwordStrength('czerwonykot').label).toBe('Słabe');
  });
  it('długie hasło ze słów jest bardzo dobre', () => {
    expect(passwordStrength('kot pies lasy rzeki').label).toBe('Bardzo dobre');
    expect(passwordStrength('Zielony-Rower-2026!').label).toBe('Bardzo dobre');
  });
  it('średnie: dość długie, ale jednorodne', () => {
    expect(passwordStrength('czerwonykotbiegnie').label).toBe('Dobre');
  });
});
