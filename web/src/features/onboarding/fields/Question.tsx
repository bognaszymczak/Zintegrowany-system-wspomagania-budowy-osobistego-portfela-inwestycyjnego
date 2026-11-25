import type { ReactNode } from 'react';
import { Icon } from '@/components/Icon';

interface QuestionProps {
  /** unikalny identyfikator pytania (do powiązań aria) */
  id: string;
  title: ReactNode;
  /** dopisek przy tytule, np. „opcjonalnie” */
  note?: string;
  hint?: ReactNode;
  /** komunikat błędu — pojawia się pod pytaniem i jest odczytywany przez czytniki ekranu */
  error?: string;
  children: ReactNode;
}

/**
 * Wspólna rama pytania: tytuł (legend), odpowiedzi, błąd.
 * <fieldset> + <legend> to natywny sposób na powiązanie grupy przycisków z pytaniem.
 */
export function Question({ id, title, note, hint, error, children }: QuestionProps) {
  const errorId = `${id}-error`;
  return (
    <fieldset
      className="question"
      id={id}
      aria-describedby={error ? errorId : undefined}
      data-invalid={error ? 'true' : undefined}
    >
      <legend className="question__title">
        {title}
        {note ? <span className="question__note"> ({note})</span> : null}
      </legend>
      {hint ? <p className="question__hint">{hint}</p> : null}
      {children}
      {error ? (
        <p id={errorId} className="field-error" role="alert">
          <Icon name="alert" size={18} />
          <span>{error}</span>
        </p>
      ) : null}
    </fieldset>
  );
}
