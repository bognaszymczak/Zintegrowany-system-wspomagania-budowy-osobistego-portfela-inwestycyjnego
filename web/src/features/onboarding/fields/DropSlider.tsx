import { useFormContext, useWatch } from 'react-hook-form';
import { formatMoney } from '@/domain/money';
import { DROP_VALUES } from '@/domain/questionnaire';
import type { FormValues } from '../schema';
import { errorMessage } from './errors';
import { Question } from './Question';

/** Kwota, na której pokazujemy skutki spadku (tylko ilustracja, nie dane użytkownika). */
const EXAMPLE_AMOUNT = 20_000;

/**
 * Suwak „jaki spadek zaakceptujesz”. Pod spodem zwykły <input type="range">,
 * więc działa z klawiatury (strzałki) i na telefonie. Obok pokazujemy skutek w złotówkach,
 * bo „−20%” mówi niewiele, a „16 000 zł zamiast 20 000 zł” — każdemu.
 */
export function DropSlider() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<FormValues>();
  const watched = useWatch({ control, name: 'drop' });
  const drop = typeof watched === 'number' ? watched : 20;
  const error = errorMessage(errors, 'drop');
  const afterDrop = formatMoney(EXAMPLE_AMOUNT * (1 - drop / 100));

  return (
    <Question
      id="q-drop"
      title="Jaki chwilowy spadek wartości portfela byłby dla Ciebie do zaakceptowania?"
      error={error}
    >
      <div className="slider-card">
        <div className="slider-card__value">
          <span className="slider-card__big">−{drop}%</span>
          <span className="slider-card__explain">
            Przy {formatMoney(EXAMPLE_AMOUNT)}&nbsp;zł wpłaconych oznacza to chwilowy spadek wartości
            do <b>{afterDrop}&nbsp;zł</b>.
          </span>
        </div>
        <div className="slider-card__bar" aria-hidden="true">
          <div className="slider-card__keep" style={{ width: `${100 - drop}%` }} />
          <div className="slider-card__lose" style={{ width: `${drop}%` }} />
        </div>
        <div>
          <input
            className="slider-card__range"
            type="range"
            min={DROP_VALUES[0]}
            max={DROP_VALUES[DROP_VALUES.length - 1]}
            step={10}
            aria-label="Akceptowany chwilowy spadek wartości portfela w procentach"
            aria-valuetext={`minus ${drop} procent`}
            {...register('drop', { valueAsNumber: true })}
          />
          <div className="slider-card__ticks" aria-hidden="true">
            {DROP_VALUES.map((v) => (
              <span key={v}>−{v}%</span>
            ))}
          </div>
        </div>
      </div>
    </Question>
  );
}
