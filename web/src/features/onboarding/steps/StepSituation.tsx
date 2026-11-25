import { CUSHION_OPTIONS, INCOME_OPTIONS, LOANS_OPTIONS } from '@/domain/questionnaire';
import type { SoftNote } from '../consistency';
import { ChoiceGroup } from '../fields/ChoiceGroup';
import { NoteFor } from './NoteFor';

/** Krok 2 — sytuacja finansowa (zdolność do poniesienia straty). */
export function StepSituation({ notes }: { notes: readonly SoftNote[] }) {
  return (
    <>
      <ChoiceGroup
        name="cushion"
        title="Czy masz poduszkę finansową na 3–6 miesięcy wydatków?"
        options={CUSHION_OPTIONS}
      >
        <NoteFor notes={notes} id="no-cushion" />
      </ChoiceGroup>

      <ChoiceGroup name="income" title="Jak stabilny jest Twój dochód?" options={INCOME_OPTIONS} />

      <ChoiceGroup
        name="loans"
        title="Jaką część dochodu zajmują raty kredytów?"
        options={LOANS_OPTIONS}
      >
        <NoteFor notes={notes} id="high-loans" />
      </ChoiceGroup>
    </>
  );
}
