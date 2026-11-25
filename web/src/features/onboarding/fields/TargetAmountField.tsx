import { useFormContext } from 'react-hook-form';
import { formatMoney, parseMoney } from '@/domain/money';
import { Icon } from '@/components/Icon';
import type { FormValues } from '../schema';
import { errorMessage } from './errors';

/**
 * Pole kwoty celu (opcjonalne). Użytkownik może wpisać „100000”, „100 000” albo „100 000 zł” —
 * po wyjściu z pola ładnie formatujemy liczbę. Do API leci liczba całkowita (patrz request.ts).
 */
export function TargetAmountField() {
  const {
    register,
    setValue,
    trigger,
    formState: { errors },
  } = useFormContext<FormValues>();
  const error = errorMessage(errors, 'amount');
  const field = register('amount');

  return (
    <div className="question question--field" data-invalid={error ? 'true' : undefined}>
      <label htmlFor="amount" className="question__title">
        Ile chcesz uzbierać? <span className="question__note">(opcjonalnie)</span>
      </label>
      <div className="money-input">
        <input
          id="amount"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="np. 100 000"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'amount-error' : undefined}
          {...field}
          onChange={(event) => {
            void field.onChange(event);
            // gdy błąd jest widoczny, znika natychmiast po poprawieniu wpisu
            if (error) void trigger('amount');
          }}
          onBlur={(event) => {
            void field.onBlur(event);
            const n = parseMoney(event.target.value);
            if (n !== null) setValue('amount', formatMoney(n));
            // dopiero przy opuszczeniu pola pokazujemy ewentualny błąd (nie w trakcie pisania)
            void trigger('amount');
          }}
        />
        <span className="money-input__unit">zł</span>
      </div>
      {error ? (
        <p id="amount-error" className="field-error" role="alert">
          <Icon name="alert" size={18} />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
