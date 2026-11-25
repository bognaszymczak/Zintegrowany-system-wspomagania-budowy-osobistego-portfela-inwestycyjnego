/**
 * Definicja kroków kreatora: teksty nagłówków i lista pól sprawdzanych na każdym kroku.
 * Bez Reacta i bez react-hook-form — dzięki temu da się to testować zwykłym testem jednostkowym.
 */
import type { FormValues } from './schema';

export type StepNumber = 1 | 2 | 3 | 4 | 5;
export const STEP_COUNT = 5;

type FieldName = keyof FormValues;

export interface StepDef {
  n: StepNumber;
  /** tytuł w lewym panelu */
  title: string;
  /** podtytuł w lewym panelu */
  sub: string;
  /** nagłówek kroku */
  heading: string;
  /** zdanie wprowadzające */
  intro: string;
  /** pola walidowane przed przejściem dalej */
  fields: readonly FieldName[];
}

export const STEPS: readonly StepDef[] = [
  {
    n: 1,
    title: 'Cel i czas',
    sub: 'Po co i na jak długo',
    heading: 'Twój cel',
    intro:
      'Zacznijmy od tego, po co odkładasz. Dzięki temu propozycje będą liczone w złotówkach i na właściwy czas.',
    fields: ['goal', 'horizon', 'amount', 'start', 'monthly'],
  },
  {
    n: 2,
    title: 'Sytuacja',
    sub: 'Poduszka, dochód, raty',
    heading: 'Twoja sytuacja',
    intro:
      'Kilka pytań, które pomagają ustalić, ile ryzyka można bezpiecznie udźwignąć. Nie pytamy o dokładne kwoty.',
    fields: ['cushion', 'income', 'loans'],
  },
  {
    n: 3,
    title: 'Ryzyko',
    sub: 'Co jest dla Ciebie komfortowe',
    heading: 'Twoje podejście do ryzyka',
    intro: 'Nie ma dobrych i złych odpowiedzi. Chodzi o to, co jest dla Ciebie komfortowe.',
    fields: ['drop', 'reaction', 'ab'],
  },
  {
    n: 4,
    title: 'Wiedza',
    sub: 'Doświadczenie i mini-quiz',
    heading: 'Wiedza i doświadczenie',
    intro: 'Dzięki temu dobierzemy język wyjaśnień. Wynik nie blokuje dostępu do niczego.',
    fields: ['exp', 'quiz'],
  },
  {
    n: 5,
    title: 'Preferencje',
    sub: 'Wykluczenia i waluta',
    heading: 'Twoje preferencje',
    intro: 'Ostatni krok. Możesz wykluczyć branże i wybrać, w czym chcesz widzieć wyniki.',
    fields: ['exclusions', 'esg', 'typ', 'ccy'],
  },
];

export function stepDef(n: number): StepDef {
  return STEPS[Math.min(STEP_COUNT, Math.max(1, n)) - 1] as StepDef;
}

/** Na którym kroku leży pole o danej ścieżce (np. "quiz.q1" -> 4). */
export function stepOfField(path: string): StepNumber | null {
  const root = path.split('.')[0];
  const step = STEPS.find((s) => (s.fields as readonly string[]).includes(root ?? ''));
  return step ? step.n : null;
}

/** Pierwszy krok, na którym są błędy — do przeniesienia użytkownika po nieudanym wysłaniu. */
export function firstStepWithError(errors: Record<string, unknown>): StepNumber | null {
  const keys = Object.keys(errors);
  for (const step of STEPS) {
    if (step.fields.some((f) => keys.includes(f))) return step.n;
  }
  return null;
}
