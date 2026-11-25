/**
 * Plan oszczędzania wyliczony z odpowiedzi.
 * Formularz pyta o przedziały („5–20 tys. zł”), a projekcje potrzebują jednej liczby,
 * więc przyjmujemy wartość reprezentatywną (środek przedziału, zaokrąglony).
 * Użytkownik widzi te założenia na ekranie wyceny — nic nie dzieje się „po cichu”.
 */
import type { HorizonValue, MonthlyValue, StartValue } from './questionnaire';
import type { ProfileRequest } from './profile';

export interface Plan {
  /** kwota na start, zł */
  startPLN: number;
  /** miesięczna wpłata, zł */
  monthlyPLN: number;
  /** liczba lat inwestowania */
  years: number;
  /** cel w zł albo null */
  targetPLN: number | null;
}

export const START_PLN: Record<StartValue, number> = {
  do5k: 2_500,
  '5do20k': 12_500,
  '20do50k': 35_000,
  ponad50k: 75_000,
};

export const MONTHLY_PLN: Record<MonthlyValue, number> = {
  do300: 150,
  '300do1000': 650,
  '1000do3000': 2_000,
  ponad3000: 4_000,
};

export const HORIZON_YEARS: Record<HorizonValue, number> = {
  do3: 3,
  '3do5': 4,
  '5do10': 7,
  ponad10: 12,
};

export function planFromRequest(
  r: Pick<ProfileRequest, 'startBand' | 'monthlyBand' | 'horizon' | 'targetAmountPLN'>,
): Plan {
  return {
    startPLN: START_PLN[r.startBand],
    monthlyPLN: MONTHLY_PLN[r.monthlyBand],
    years: HORIZON_YEARS[r.horizon],
    targetPLN: r.targetAmountPLN,
  };
}

/** Plan użyty w szkicu ekranów — przydatny w testach silnika, które odtwarzają liczby ze szkicu. */
export const SKETCH_PLAN: Plan = { startPLN: 20_000, monthlyPLN: 500, years: 10, targetPLN: 100_000 };
