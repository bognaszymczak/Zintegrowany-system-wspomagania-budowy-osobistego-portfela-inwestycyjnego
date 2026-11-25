import type { ReactNode } from 'react';
import { useFormContext } from 'react-hook-form';
import { Icon, type IconName } from '@/components/Icon';
import type { Choice } from '@/domain/questionnaire';
import type { FormValues } from '../schema';
import { errorMessage } from './errors';
import { Question } from './Question';

/** Pola formularza z jednokrotnym wyborem. */
export type ChoiceName =
  | 'goal'
  | 'horizon'
  | 'start'
  | 'monthly'
  | 'cushion'
  | 'income'
  | 'loans'
  | 'reaction'
  | 'ab'
  | 'typ'
  | 'ccy'
  | 'quiz.q1'
  | 'quiz.q2'
  | 'quiz.q3';

interface ChoiceGroupProps {
  name: ChoiceName;
  title: ReactNode;
  options: readonly Choice[];
  /**
   * chips – przyciski w rzędzie (domyślnie)
   * wide  – szerokie przyciski w siatce (np. wybór A/B)
   * cards – karty z ikoną (cel oszczędzania)
   * list  – zwykłe przyciski radiowe w kolumnie (mini-quiz)
   */
  variant?: 'chips' | 'wide' | 'cards' | 'list';
  /** ikona dla wariantu "cards" */
  iconFor?: (value: string) => IconName;
  note?: string;
  hint?: ReactNode;
  required?: boolean;
  children?: ReactNode;
}

/**
 * Pytanie jednokrotnego wyboru oparte o natywne <input type="radio">.
 * Dzięki temu strzałki, Tab i czytniki ekranu działają bez dodatkowego kodu,
 * a react-hook-form czyta wartość wprost z DOM (register).
 */
export function ChoiceGroup({
  name,
  title,
  options,
  variant = 'chips',
  iconFor,
  note,
  hint,
  required = true,
  children,
}: ChoiceGroupProps) {
  const {
    register,
    trigger,
    formState: { errors },
  } = useFormContext<FormValues>();
  const error = errorMessage(errors, name);
  const id = `q-${name.replace('.', '-')}`;
  const field = register(name);

  return (
    <Question id={id} title={title} note={note} hint={hint} error={error}>
      <div className={`choices choices--${variant}`}>
        {options.map((option) => (
          <label key={option.value} className={`choice choice--${variant}`}>
            <input
              type="radio"
              value={option.value}
              required={required}
              aria-invalid={error ? true : undefined}
              {...field}
              onChange={(event) => {
                void field.onChange(event);
                // Błąd znika w chwili wyboru odpowiedzi (a nie dopiero po opuszczeniu pola).
                if (error) void trigger(name);
              }}
            />
            {variant === 'cards' ? (
              <span className="choice__face">
                <span className="choice__icon">
                  <Icon name={iconFor ? iconFor(option.value) : 'check'} size={22} strokeWidth={1.8} />
                </span>
                <span className="choice__text">
                  <span className="choice__label">{option.label}</span>
                  {option.sub ? <span className="choice__sub">{option.sub}</span> : null}
                </span>
              </span>
            ) : variant === 'list' ? (
              <span className="choice__face">
                <span className="choice__radio" aria-hidden="true" />
                {option.sub ? (
                  <span className="choice__label">
                    <b>{option.label}</b> — {option.sub}
                  </span>
                ) : (
                  <span className="choice__label">{option.label}</span>
                )}
              </span>
            ) : (
              <span className="choice__face">
                <span className="choice__label">{option.label}</span>
              </span>
            )}
          </label>
        ))}
      </div>
      {children}
    </Question>
  );
}
