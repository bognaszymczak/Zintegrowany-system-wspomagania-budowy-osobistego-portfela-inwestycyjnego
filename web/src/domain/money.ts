/** Najniższa i najwyższa kwota celu, jaką przyjmujemy w formularzu (w zł). */
export const MIN_TARGET_PLN = 1_000;
export const MAX_TARGET_PLN = 100_000_000;

/**
 * Zamienia tekst wpisany przez użytkownika ("100 000", "100000 zł") na liczbę.
 * Zwraca null, jeśli tekst nie jest liczbą całkowitą (kropka i przecinek są odrzucane,
 * bo w polskich zapisach bywają separatorem tysięcy albo dziesiętnym).
 */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[\s  ]/g, '').replace(/zł$/i, '');
  if (!/^\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isSafeInteger(n) ? n : null;
}

/** 1234567 -> "1 234 567" (twarde spacje, żeby liczba nie łamała się w połowie). */
export function formatMoney(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Pole "Ile chcesz uzbierać?" jest opcjonalne: pusty tekst jest poprawny. */
export function isValidTarget(input: string): boolean {
  if (input.trim() === '') return true;
  const n = parseMoney(input);
  return n !== null && n >= MIN_TARGET_PLN && n <= MAX_TARGET_PLN;
}

export const TARGET_ERROR =
  'Podaj kwotę w złotych, np. 100 000 (od 1 000 do 100 000 000 zł) albo zostaw pole puste.';
