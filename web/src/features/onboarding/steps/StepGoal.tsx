import type { IconName } from '@/components/Icon';
import {
  GOAL_OPTIONS,
  HORIZON_OPTIONS,
  MONTHLY_OPTIONS,
  START_OPTIONS,
  type GoalValue,
} from '@/domain/questionnaire';
import type { SoftNote } from '../consistency';
import { ChoiceGroup } from '../fields/ChoiceGroup';
import { TargetAmountField } from '../fields/TargetAmountField';
import { NoteFor } from './NoteFor';

const goalIcon = (value: string): IconName => `goal-${value as GoalValue}`;

/** Krok 1 — cel i czas. */
export function StepGoal({ notes }: { notes: readonly SoftNote[] }) {
  return (
    <>
      <ChoiceGroup
        name="goal"
        title="Na co chcesz odkładać?"
        options={GOAL_OPTIONS}
        variant="cards"
        iconFor={goalIcon}
      >
        <NoteFor notes={notes} id="goal-cushion" />
      </ChoiceGroup>

      <ChoiceGroup
        name="horizon"
        title="Za ile lat będziesz potrzebować tych pieniędzy?"
        options={HORIZON_OPTIONS}
      >
        <NoteFor notes={notes} id="goal-horizon" />
      </ChoiceGroup>

      <div className="split">
        <TargetAmountField />
        <ChoiceGroup name="start" title="Ile możesz wpłacić na start?" options={START_OPTIONS} />
      </div>

      <ChoiceGroup name="monthly" title="Ile możesz odkładać co miesiąc?" options={MONTHLY_OPTIONS} />
    </>
  );
}
