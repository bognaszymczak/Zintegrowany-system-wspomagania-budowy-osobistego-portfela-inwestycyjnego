/**
 * Walidacja formularzy konta (Zod). Te same reguły egzekwuje backend (api/app/schemas.py) —
 * przeglądarka sprawdza je tylko po to, żeby użytkownik dostał komunikat od razu, a nie po odpowiedzi serwera.
 * Komunikaty są po polsku i mówią, co poprawić.
 */
import { z } from 'zod';
import { MIN_PASSWORD_LENGTH } from './password';

/**
 * `pipe` sprawia, że pusty adres dostaje jeden komunikat („Podaj adres e-mail.”),
 * a dopiero niepusty, ale błędny — komunikat o formacie.
 */
export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Podaj adres e-mail.')
  .pipe(z.string().email('Wpisz adres e-mail w formacie imie@przyklad.pl.'));

const mustBeChecked = (message: string) => z.boolean().refine((value) => value === true, message);

/**
 * Konto mogą założyć tylko osoby pełnoletnie (powody: regulamin to umowa, a osoby poniżej 18 lat mają
 * ograniczoną zdolność do czynności prawnych; zgody opcjonalne wymagałyby zgody rodzica — patrz README).
 * Pytamy o oświadczenie, a NIE o datę urodzenia: im mniej danych, tym lepiej (RODO — minimalizacja danych).
 */
export const MIN_AGE = 18;

export const registerSchema = z.object({
  /** imię jest opcjonalne — służy tylko do powitania w nagłówku */
  name: z.string().trim().max(60, 'Imię może mieć najwyżej 60 znaków.'),
  email: emailSchema,
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków.`)
    .max(200, 'Hasło jest zbyt długie.'),
  adultConfirmed: mustBeChecked(`Aby założyć konto, potwierdź, że masz ukończone ${MIN_AGE} lat.`),
  acceptTerms: mustBeChecked('Zaznacz tę zgodę, aby założyć konto.'),
  acceptSimulation: mustBeChecked('Zaznacz tę zgodę, aby założyć konto.'),
  marketingOptIn: z.boolean(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Podaj hasło.'),
});

export type RegisterValues = z.infer<typeof registerSchema>;
export type LoginValues = z.infer<typeof loginSchema>;

export const REGISTER_DEFAULTS: RegisterValues = {
  name: '',
  email: '',
  password: '',
  adultConfirmed: false,
  acceptTerms: false,
  acceptSimulation: false,
  marketingOptIn: false,
};

export const LOGIN_DEFAULTS: LoginValues = { email: '', password: '' };
