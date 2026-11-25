import { get, type FieldErrors } from 'react-hook-form';
import type { FormValues } from '../schema';

/** Komunikat błędu dla pola o danej ścieżce, np. "amount" albo "quiz.q1". */
export function errorMessage(errors: FieldErrors<FormValues>, path: string): string | undefined {
  const entry = get(errors, path) as { message?: unknown } | undefined;
  return typeof entry?.message === 'string' ? entry.message : undefined;
}
