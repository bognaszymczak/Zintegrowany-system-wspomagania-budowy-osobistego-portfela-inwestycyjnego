import { useState, type ReactNode } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Icon } from '@/components/Icon';
import { passwordStrength } from './password';

/** Komunikat błędu pod polem; `role="alert"` sprawia, że czytnik ekranu ogłasza go od razu. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error" role="alert">
      <Icon name="alert" size={18} />
      <span>{message}</span>
    </p>
  );
}

interface TextFieldProps {
  id: string;
  label: ReactNode;
  /** dopisek przy etykiecie, np. „opcjonalnie” */
  note?: string;
  type?: 'text' | 'email';
  placeholder?: string;
  autoComplete?: string;
  registration: UseFormRegisterReturn;
  error?: string;
}

/** Pole tekstowe z etykietą powiązaną z polem i komunikatem błędu. */
export function TextField({ id, label, note, type = 'text', placeholder, autoComplete, registration, error }: TextFieldProps) {
  return (
    <div className="field" data-invalid={error ? 'true' : undefined}>
      <label htmlFor={id} className="field__label">
        {label}
        {note ? <span className="field__note"> ({note})</span> : null}
      </label>
      <input
        id={id}
        className="input"
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...registration}
      />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

interface PasswordFieldProps {
  id: string;
  label?: string;
  placeholder?: string;
  autoComplete: 'new-password' | 'current-password';
  registration: UseFormRegisterReturn;
  error?: string;
  /** wartość pola — gdy podana, pod polem pojawia się miernik siły hasła (tylko przy zakładaniu konta) */
  strengthOf?: string;
  /** odnośnik obok etykiety, np. „Nie pamiętasz hasła?” */
  aside?: ReactNode;
}

/** Pole hasła z przyciskiem „Pokaż” i (opcjonalnie) miernikiem siły. Hasło nigdzie nie jest wysyłane poza formularz. */
export function PasswordField({
  id,
  label = 'Hasło',
  placeholder,
  autoComplete,
  registration,
  error,
  strengthOf,
  aside,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const strength = strengthOf !== undefined && strengthOf !== '' ? passwordStrength(strengthOf) : null;

  return (
    <div className="field" data-invalid={error ? 'true' : undefined}>
      <div className="field__row">
        <label htmlFor={id} className="field__label">
          {label}
        </label>
        {aside}
      </div>
      <div className="input-wrap">
        <input
          id={id}
          className="input input--with-button"
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={[error ? `${id}-error` : '', strength ? `${id}-strength` : ''].filter(Boolean).join(' ') || undefined}
          {...registration}
        />
        <button
          type="button"
          className="input-wrap__button"
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? 'Ukryj' : 'Pokaż'}
          <span className="visually-hidden"> hasło</span>
        </button>
      </div>
      {strength ? (
        <div id={`${id}-strength`} className="strength" data-score={strength.score}>
          <span className="strength__bar" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="strength__label">Siła hasła: {strength.label}</span>
        </div>
      ) : null}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

interface CheckFieldProps {
  id: string;
  registration: UseFormRegisterReturn;
  error?: string;
  children: ReactNode;
}

/** Pole wyboru (zgoda) z dużym obszarem klikania i własnym komunikatem błędu. */
export function CheckField({ id, registration, error, children }: CheckFieldProps) {
  return (
    <div className="field field--check" data-invalid={error ? 'true' : undefined}>
      <label className="check check--top" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          {...registration}
        />
        <span>{children}</span>
      </label>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}
