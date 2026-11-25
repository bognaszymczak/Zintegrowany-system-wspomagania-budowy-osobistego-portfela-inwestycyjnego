import type { ReactNode } from 'react';

interface PillProps {
  /** neutral = szara, teal = zielonkawa, amber = bursztynowa (uwaga / dane przykładowe), dark = ciemna */
  tone?: 'neutral' | 'teal' | 'amber' | 'dark';
  children: ReactNode;
}

/** Mała zaokrąglona plakietka: „Dane przykładowe”, „Środek skali”, „Suma: 100%”. */
export function Pill({ tone = 'neutral', children }: PillProps) {
  return <span className={`pill pill--${tone}`}>{children}</span>;
}
