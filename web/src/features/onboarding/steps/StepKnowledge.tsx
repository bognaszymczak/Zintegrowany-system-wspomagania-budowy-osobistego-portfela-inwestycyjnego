import { QUIZ } from '@/domain/questionnaire';
import { ChoiceGroup } from '../fields/ChoiceGroup';
import { ExperienceField } from '../fields/ExperienceField';

/** Krok 4 — doświadczenie i mini-quiz (wpływa tylko na język wyjaśnień, nie na dostęp). */
export function StepKnowledge() {
  return (
    <>
      <ExperienceField />

      <div className="panel">
        <div className="panel__head">
          <div className="panel__title">Mini-quiz: trzy pytania</div>
          <div className="panel__sub">
            Nie ma punktów ani ocen — odpowiedzi tylko pomagają dobrać poziom wyjaśnień.
          </div>
        </div>
        {QUIZ.map((q) => (
          <ChoiceGroup
            key={q.id}
            name={`quiz.${q.id}`}
            title={q.prompt}
            options={q.options}
            variant="list"
            required={false}
          />
        ))}
      </div>
    </>
  );
}
