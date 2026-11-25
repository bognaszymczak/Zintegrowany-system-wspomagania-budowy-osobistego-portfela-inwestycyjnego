import { REACTION_OPTIONS, RISK_PREFERENCE_OPTIONS } from '@/domain/questionnaire';
import type { SoftNote } from '../consistency';
import { ChoiceGroup } from '../fields/ChoiceGroup';
import { DropSlider } from '../fields/DropSlider';
import { NoteFor } from './NoteFor';

/** Krok 3 — podejście do ryzyka (tolerancja ryzyka). */
export function StepRisk({ notes }: { notes: readonly SoftNote[] }) {
  return (
    <>
      <DropSlider />

      <ChoiceGroup
        name="reaction"
        title="Po miesiącu Twój portfel jest 20% niżej. Co robisz?"
        options={REACTION_OPTIONS}
      >
        <NoteFor notes={notes} id="drop-vs-reaction" />
      </ChoiceGroup>

      <ChoiceGroup name="ab" title="Co wolisz?" options={RISK_PREFERENCE_OPTIONS} variant="wide" />
    </>
  );
}
