/**
 * „Miękkie” uwagi do odpowiedzi: nie blokują przejścia dalej, tylko uprzedzają,
 * jak odpowiedź wpłynie na propozycje albo że dwie odpowiedzi do siebie nie pasują.
 * Czysta funkcja — łatwa do przetestowania i do rozbudowy.
 */
import type { FormValues } from './schema';
import type { StepNumber } from './steps';

export interface SoftNote {
  id: string;
  step: StepNumber;
  /** info = niebieskozielona wskazówka, warn = bursztynowa uwaga */
  tone: 'info' | 'warn';
  text: string;
}

export function softNotes(v: Partial<FormValues>): SoftNote[] {
  const notes: SoftNote[] = [];

  if (v.goal === 'poduszka') {
    notes.push({
      id: 'goal-cushion',
      step: 1,
      tone: 'info',
      text: 'Poduszka powinna być bezpieczna i łatwo dostępna, więc pokażemy najbardziej zachowawcze propozycje.',
    });
  }

  if (v.goal === 'emerytura' && (v.horizon === 'do3' || v.horizon === '3do5')) {
    notes.push({
      id: 'goal-horizon',
      step: 1,
      tone: 'warn',
      text: 'Emerytura zwykle oznacza dłuższy horyzont. Jeśli odpowiedź jest prawidłowa, pokażemy ostrożniejsze propozycje.',
    });
  }

  if (v.cushion === 'czesciowo' || v.cushion === 'nie') {
    notes.push({
      id: 'no-cushion',
      step: 2,
      tone: 'warn',
      text: 'Bez pełnej poduszki pokażemy ostrożniejsze propozycje i przypomnimy, że najpierw warto ją zbudować. Nadal możesz przejść dalej.',
    });
  }

  if (v.loans === 'ponad40') {
    notes.push({
      id: 'high-loans',
      step: 2,
      tone: 'warn',
      text: 'Wysokie raty zmniejszają zdolność do znoszenia strat. Uwzględnimy to w profilu.',
    });
  }

  if (typeof v.drop === 'number' && v.drop >= 30 && v.reaction === 'wszystko') {
    notes.push({
      id: 'drop-vs-reaction',
      step: 3,
      tone: 'warn',
      text: 'Akceptujesz duży spadek, ale przy spadku o 20% sprzedałbyś(abyś) wszystko. Weźmiemy pod uwagę ostrożniejszą z tych odpowiedzi.',
    });
  }

  return notes;
}

export function notesForStep(v: Partial<FormValues>, step: StepNumber): SoftNote[] {
  return softNotes(v).filter((n) => n.step === step);
}
