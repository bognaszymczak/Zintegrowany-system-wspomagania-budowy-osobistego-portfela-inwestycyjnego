import { describe, expect, it } from 'vitest';
import { LOGIN_DEFAULTS, REGISTER_DEFAULTS, loginSchema, registerSchema } from './schema';

const valid = {
  ...REGISTER_DEFAULTS,
  name: 'Anna',
  email: 'anna@przyklad.pl',
  password: 'kilka slow oddzielonych spacjami',
  adultConfirmed: true,
  acceptTerms: true,
  acceptSimulation: true,
};

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.success ? [] : (result.error?.issues.map((issue) => issue.message) ?? []);

describe('walidacja rejestracji', () => {
  it('poprawne dane przechodzą, a e-mail jest przycinany i zapisywany bez zmian wielkości liter', () => {
    const result = registerSchema.safeParse({ ...valid, email: '  Anna@Przyklad.pl ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('Anna@Przyklad.pl');
  });

  it('imię jest opcjonalne (pusty tekst jest poprawny)', () => {
    expect(registerSchema.safeParse({ ...valid, name: '' }).success).toBe(true);
  });

  it('zbyt krótkie hasło i zły e-mail dają czytelne komunikaty', () => {
    const result = registerSchema.safeParse({ ...valid, email: 'bez-malpy', password: 'krotkie' });
    expect(messages(result)).toContain('Wpisz adres e-mail w formacie imie@przyklad.pl.');
    expect(messages(result)).toContain('Hasło musi mieć co najmniej 10 znaków.');
  });

  it('obie zgody obowiązkowe muszą być zaznaczone, zgoda marketingowa nie', () => {
    expect(messages(registerSchema.safeParse({ ...valid, acceptTerms: false }))).toEqual([
      'Zaznacz tę zgodę, aby założyć konto.',
    ]);
    expect(messages(registerSchema.safeParse({ ...valid, acceptSimulation: false }))).toEqual([
      'Zaznacz tę zgodę, aby założyć konto.',
    ]);
    expect(registerSchema.safeParse({ ...valid, marketingOptIn: false }).success).toBe(true);
  });

  it('bez oświadczenia o ukończeniu 18 lat konta nie założysz — i dostajesz konkretny komunikat', () => {
    const result = registerSchema.safeParse({ ...valid, adultConfirmed: false });
    expect(result.success).toBe(false);
    expect(messages(result)).toEqual(['Aby założyć konto, potwierdź, że masz ukończone 18 lat.']);
    // błąd jest przypisany do właściwego pola, więc formularz ustawi na nim fokus i komunikat
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(['adultConfirmed']);
    expect(registerSchema.safeParse({ ...valid, adultConfirmed: true }).success).toBe(true);
  });

  it('pusty formularz zgłasza wszystkie wymagane pola naraz', () => {
    const result = registerSchema.safeParse(REGISTER_DEFAULTS);
    expect(result.success).toBe(false);
    // e-mail, hasło, pełnoletność, regulamin, charakter narzędzia
    expect(messages(result).length).toBeGreaterThanOrEqual(5);
  });
});

describe('walidacja logowania', () => {
  it('wymaga e-maila i hasła', () => {
    expect(messages(loginSchema.safeParse(LOGIN_DEFAULTS))).toEqual(['Podaj adres e-mail.', 'Podaj hasło.']);
    expect(loginSchema.safeParse({ email: 'anna@przyklad.pl', password: 'x' }).success).toBe(true);
  });
});
