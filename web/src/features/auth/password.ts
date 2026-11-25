/**
 * Ocena siły hasła — prosta, zrozumiała i bez wysyłania hasła gdziekolwiek.
 * To podpowiedź dla użytkownika, a nie zabezpieczenie: twarde reguły (min. 10 znaków) egzekwuje schemat
 * formularza, a prawdziwą ochroną jest hashowanie hasła w backendzie (scrypt).
 */
export const MIN_PASSWORD_LENGTH = 10;

export type StrengthScore = 0 | 1 | 2 | 3;

export interface PasswordStrength {
  score: StrengthScore;
  label: 'Za krótkie' | 'Słabe' | 'Dobre' | 'Bardzo dobre';
}

const COMMON = ['haslo', 'password', 'qwerty', '123456', 'abcdef', 'zaq1', 'polska', 'admin'];

export function passwordStrength(password: string): PasswordStrength {
  if (password.length < MIN_PASSWORD_LENGTH) return { score: 0, label: 'Za krótkie' };

  let points = 1; // 10+ znaków
  if (password.length >= 14) points++;
  if (password.length >= 18) points++;

  const classes = [/[a-ząćęłńóśźż]/, /[A-ZĄĆĘŁŃÓŚŹŻ]/, /\d/, /[^\wąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/].filter((re) => re.test(password)).length;
  if (classes >= 3) points++;

  const lower = password.toLowerCase();
  if (COMMON.some((word) => lower.includes(word))) points--;
  if (new Set(password).size < 6) points -= 2; // np. „aaaaaaaaaaaa”

  // „Bardzo dobre” wymaga też choć odrobiny różnorodności (np. spacji albo cyfry), nie samej długości.
  if (points >= 3 && classes >= 2) return { score: 3, label: 'Bardzo dobre' };
  if (points >= 2) return { score: 2, label: 'Dobre' };
  return { score: 1, label: 'Słabe' };
}

export const PASSWORD_TIP =
  'Kilka słów oddzielonych spacjami jest bezpieczniejsze niż skomplikowany ciąg znaków.';
