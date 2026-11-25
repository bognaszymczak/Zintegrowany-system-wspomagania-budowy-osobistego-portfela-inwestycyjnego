import type { ReactNode } from 'react';
import { useFormContext } from 'react-hook-form';
import type { FormValues } from '../schema';

export type CheckboxName =
  | 'esg'
  | 'exclusions.bron'
  | 'exclusions.tyton'
  | 'exclusions.paliwa'
  | 'exclusions.hazard';

interface CheckboxFieldProps {
  name: CheckboxName;
  children: ReactNode;
}

/** Pojedyncze pole wyboru (natywny checkbox + etykieta, którą można kliknąć). */
export function CheckboxField({ name, children }: CheckboxFieldProps) {
  const { register } = useFormContext<FormValues>();
  return (
    <label className="check">
      <input type="checkbox" {...register(name)} />
      <span>{children}</span>
    </label>
  );
}
