import { formatDatePl } from '@/domain/dates';

interface DataNoteProps {
  /** data danych rynkowych (ISO) */
  asOf: string;
  /** do kiedy wynik jest aktualny (ISO) */
  validUntil?: string;
  /** dodatkowe zdanie przed datami */
  children?: string;
}

/**
 * Drobny druk pod wynikami: „Przykład do analizy, nie zalecenie. Ważne do … (dane z …).”
 * Każdy ekran z liczbami pokazuje, z jakiego dnia są dane — to element uczciwego komunikowania ryzyka.
 */
export function DataNote({ asOf, validUntil, children }: DataNoteProps) {
  return (
    <p className="datanote">
      {children ?? 'Przykład do analizy, nie zalecenie.'}{' '}
      {validUntil
        ? `Ważne do ${formatDatePl(validUntil)} (dane z ${formatDatePl(asOf)}).`
        : `Dane z ${formatDatePl(asOf)}.`}
    </p>
  );
}
