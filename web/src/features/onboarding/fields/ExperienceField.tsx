import { useFormContext } from 'react-hook-form';
import { EXPERIENCE_OPTIONS } from '@/domain/questionnaire';
import type { FormValues } from '../schema';
import { errorMessage } from './errors';
import { Question } from './Question';

/**
 * Wielokrotny wybór z jedną regułą: „Nic z tego” wyklucza pozostałe odpowiedzi
 * (i odwrotnie). Reguła jest też w schemacie Zod — tu tylko pomagamy użytkownikowi,
 * żeby nie musiał sam odznaczać.
 */
export function ExperienceField() {
  const {
    register,
    setValue,
    trigger,
    formState: { errors },
  } = useFormContext<FormValues>();
  const error = errorMessage(errors, 'exp');

  return (
    <Question
      id="q-exp"
      title="Z czym masz już doświadczenie?"
      note="zaznacz wszystko, co pasuje"
      error={error}
    >
      <div className="choices choices--chips">
        {EXPERIENCE_OPTIONS.map((option) => {
          const field = register(`exp.${option.value}`);
          return (
            <label key={option.value} className="choice choice--chips">
              <input
                type="checkbox"
                aria-invalid={error ? true : undefined}
                {...field}
                onChange={(event) => {
                  void field.onChange(event);
                  if (event.target.checked) {
                    for (const other of EXPERIENCE_OPTIONS) {
                      const conflict = option.value === 'nic' ? other.value !== 'nic' : other.value === 'nic';
                      if (conflict) setValue(`exp.${other.value}`, false);
                    }
                  }
                  if (error) void trigger('exp');
                }}
              />
              <span className="choice__face">
                <span className="choice__label">{option.label}</span>
              </span>
            </label>
          );
        })}
      </div>
    </Question>
  );
}
