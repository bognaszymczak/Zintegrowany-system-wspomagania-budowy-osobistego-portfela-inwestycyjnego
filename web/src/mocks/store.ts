/**
 * Maleńki magazyn dla mocków. Dane lądują w przeglądarce (localStorage/sessionStorage),
 * a gdy ich nie ma (testy w Node, tryb prywatny) — w pamięci. To NIE jest baza danych:
 * służy wyłącznie do tego, żeby demo „pamiętało” konto po odświeżeniu strony.
 */
type Kind = 'local' | 'session';

const memory = new Map<string, string>();

function backend(kind: Kind): Storage | null {
  try {
    const s = kind === 'local' ? globalThis.localStorage : globalThis.sessionStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

export function readJson<T>(kind: Kind, key: string, fallback: T): T {
  let text: string | null = null;
  try {
    text = backend(kind)?.getItem(key) ?? memory.get(`${kind}:${key}`) ?? null;
  } catch {
    text = memory.get(`${kind}:${key}`) ?? null;
  }
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(kind: Kind, key: string, value: unknown): void {
  const text = JSON.stringify(value);
  memory.set(`${kind}:${key}`, text);
  try {
    backend(kind)?.setItem(key, text);
  } catch {
    /* zostaje kopia w pamięci */
  }
}

export function removeKey(kind: Kind, key: string): void {
  memory.delete(`${kind}:${key}`);
  try {
    backend(kind)?.removeItem(key);
  } catch {
    /* nic do zrobienia */
  }
}
