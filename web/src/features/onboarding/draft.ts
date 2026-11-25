/**
 * Zapis roboczy formularza w przeglądarce (localStorage).
 *
 *  - zapisujemy wyłącznie odpowiedzi z formularza (bez imienia, e-maila, PESEL-u),
 *  - przy odczycie każde pole jest ponownie sprawdzane schematem Zod — uszkodzony
 *    albo stary zapis nie wywróci aplikacji, tylko zostanie zignorowany,
 *  - po wysłaniu formularza zapis jest kasowany.
 *
 * W wersji produkcyjnej można ten sam interfejs oprzeć o backend
 * (np. PUT /api/profile/draft), żeby zapis działał na wielu urządzeniach.
 */
import { useEffect, useRef, useState } from 'react';
import type { z } from 'zod';
import { formSchema, type FormValues } from './schema';
import { STEP_COUNT, type StepNumber } from './steps';

export const DRAFT_KEY = 'horyzont.onboarding.draft';
const DRAFT_VERSION = 1;

export interface Draft {
  version: number;
  step: StepNumber;
  /** najdalszy krok, do którego użytkownik doszedł (dalej nie można przeskoczyć z lewego panelu) */
  maxStep: StepNumber;
  values: Partial<FormValues>;
  savedAt: string;
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // np. zablokowane ciasteczka/dane witryn — aplikacja ma działać dalej, tylko bez zapisu
    return null;
  }
}

function clampStep(n: unknown): StepNumber {
  const num = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : 1;
  return Math.min(STEP_COUNT, Math.max(1, num)) as StepNumber;
}

/** Zostawia tylko te pola, które nadal przechodzą walidację schematem. */
export function sanitizeValues(raw: unknown): Partial<FormValues> {
  if (typeof raw !== 'object' || raw === null) return {};
  const source = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(formSchema.shape)) {
    const candidate = source[key];
    if (candidate === undefined) continue;
    const fieldSchema = (formSchema.shape as Record<string, z.ZodTypeAny>)[key];
    const parsed = fieldSchema?.safeParse(candidate);
    if (parsed?.success) out[key] = parsed.data;
  }
  return out as Partial<FormValues>;
}

export function loadDraft(storage: StorageLike | null = defaultStorage()): Draft | null {
  if (!storage) return null;
  try {
    const text = storage.getItem(DRAFT_KEY);
    if (!text) return null;
    const raw = JSON.parse(text) as Partial<Draft> | null;
    if (!raw || raw.version !== DRAFT_VERSION) return null;
    const step = clampStep(raw.step);
    return {
      version: DRAFT_VERSION,
      step,
      maxStep: Math.max(step, clampStep(raw.maxStep)) as StepNumber,
      values: sanitizeValues(raw.values),
      savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : '',
    };
  } catch {
    return null;
  }
}

export function saveDraft(
  draft: Omit<Draft, 'version' | 'savedAt'>,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    const payload: Draft = { ...draft, version: DRAFT_VERSION, savedAt: new Date().toISOString() };
    storage.setItem(DRAFT_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(DRAFT_KEY);
  } catch {
    /* nic do zrobienia */
  }
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'unavailable';

/**
 * Zapisuje szkic ~0,4 s po ostatniej zmianie. Zwraca stan do pokazania w rogu karty.
 * Porównujemy zserializowany tekst, a nie obiekty — dzięki temu nie ma pętli zapisów.
 */
export function useDraftAutosave(
  values: Partial<FormValues>,
  step: StepNumber,
  maxStep: StepNumber,
  enabled: boolean,
): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const serialized = JSON.stringify({ values, step, maxStep });
  const lastSaved = useRef(serialized);

  useEffect(() => {
    if (!enabled || serialized === lastSaved.current) return;
    setStatus('saving');
    const timer = setTimeout(() => {
      const ok = saveDraft({ values, step, maxStep });
      lastSaved.current = serialized;
      setStatus(ok ? 'saved' : 'unavailable');
    }, 400);
    return () => clearTimeout(timer);
    // `values`, `step` i `maxStep` są już zawarte w `serialized`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, enabled]);

  return status;
}
