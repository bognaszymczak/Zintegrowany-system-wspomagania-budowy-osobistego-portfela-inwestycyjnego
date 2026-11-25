/**
 * Słownik pytań formularza wstępnego: wartości (to trafia do API i bazy)
 * oraz etykiety (to widzi użytkownik).
 *
 * To JEDYNE miejsce, w którym definiujemy dostępne odpowiedzi.
 * Z tych tablic wynikają: typy TypeScript, walidacja Zod i przyciski w formularzu.
 * Dodanie odpowiedzi = dopisanie jednego wiersza tutaj (plus punktacja w profile.ts).
 */

/** Jedna odpowiedź do wyboru. */
export interface Choice<V extends string | number = string> {
  readonly value: V;
  readonly label: string;
  /** krótki opis pod etykietą (opcjonalny) */
  readonly sub?: string;
}

// ---------- Krok 1: cel i czas ----------

export const GOAL_OPTIONS = [
  { value: 'poduszka', label: 'Poduszka bezpieczeństwa', sub: 'Rezerwa na nieprzewidziane wydatki' },
  { value: 'mieszkanie', label: 'Mieszkanie', sub: 'Wkład własny lub remont' },
  { value: 'emerytura', label: 'Emerytura', sub: 'Dodatkowe pieniądze na później' },
  { value: 'edukacja', label: 'Edukacja dziecka', sub: 'Studia, kursy, wyprawka' },
  { value: 'majatek', label: 'Powiększenie majątku', sub: 'Bez konkretnego celu' },
] as const satisfies readonly Choice[];

export const HORIZON_OPTIONS = [
  { value: 'do3', label: 'Do 3 lat' },
  { value: '3do5', label: '3–5 lat' },
  { value: '5do10', label: '5–10 lat' },
  { value: 'ponad10', label: 'Ponad 10 lat' },
] as const satisfies readonly Choice[];

export const START_OPTIONS = [
  { value: 'do5k', label: 'Do 5 tys. zł' },
  { value: '5do20k', label: '5–20 tys. zł' },
  { value: '20do50k', label: '20–50 tys. zł' },
  { value: 'ponad50k', label: 'Ponad 50 tys. zł' },
] as const satisfies readonly Choice[];

export const MONTHLY_OPTIONS = [
  { value: 'do300', label: 'Do 300 zł' },
  { value: '300do1000', label: '300–1 000 zł' },
  { value: '1000do3000', label: '1 000–3 000 zł' },
  { value: 'ponad3000', label: 'Ponad 3 000 zł' },
] as const satisfies readonly Choice[];

// ---------- Krok 2: sytuacja ----------

export const CUSHION_OPTIONS = [
  { value: 'tak', label: 'Tak' },
  { value: 'czesciowo', label: 'Częściowo' },
  { value: 'nie', label: 'Nie' },
] as const satisfies readonly Choice[];

export const INCOME_OPTIONS = [
  { value: 'staly', label: 'Stały (np. etat)' },
  { value: 'zmienny', label: 'Zmienny (np. własna firma)' },
  { value: 'niepewny', label: 'Niepewny' },
] as const satisfies readonly Choice[];

export const LOANS_OPTIONS = [
  { value: 'brak', label: 'Brak rat' },
  { value: 'do20', label: 'Do 20%' },
  { value: '20do40', label: '20–40%' },
  { value: 'ponad40', label: 'Ponad 40%' },
] as const satisfies readonly Choice[];

// ---------- Krok 3: podejście do ryzyka ----------

export const DROP_VALUES = [10, 20, 30, 40] as const;

export const REACTION_OPTIONS = [
  { value: 'wszystko', label: 'Sprzedaję wszystko' },
  { value: 'czesc', label: 'Sprzedaję część' },
  { value: 'czekam', label: 'Czekam' },
  { value: 'dokupuje', label: 'Dokupuję' },
] as const satisfies readonly Choice[];

export const RISK_PREFERENCE_OPTIONS = [
  { value: 'pewne', label: 'Pewne +3% rocznie' },
  { value: 'ryzyko', label: 'Od −10% do +20% rocznie, średnio więcej' },
] as const satisfies readonly Choice[];

// ---------- Krok 4: wiedza i doświadczenie ----------

export const EXPERIENCE_OPTIONS = [
  { value: 'lok', label: 'Lokaty' },
  { value: 'obl', label: 'Obligacje' },
  { value: 'akc', label: 'Akcje' },
  { value: 'etf', label: 'Fundusze ETF' },
  { value: 'nic', label: 'Nic z tego' },
] as const satisfies readonly Choice[];

export const QUIZ_ANSWER_VALUES = ['a', 'b', 'c', 'nw'] as const;
const DONT_KNOW = { value: 'nw', label: 'Nie wiem' } as const;

export const QUIZ = [
  {
    id: 'q1',
    prompt: '1. Co oznacza dywersyfikacja?',
    correct: 'b',
    options: [
      { value: 'a', label: 'Trzymanie wszystkiego w jednym instrumencie' },
      { value: 'b', label: 'Rozłożenie pieniędzy na różne instrumenty' },
      { value: 'c', label: 'Szybkie kupowanie i sprzedawanie' },
      DONT_KNOW,
    ],
  },
  {
    id: 'q2',
    prompt: '2. Czym jest fundusz ETF?',
    correct: 'b',
    options: [
      { value: 'a', label: 'Pojedynczą akcją jednej spółki' },
      { value: 'b', label: 'Koszykiem wielu instrumentów notowanym na giełdzie' },
      { value: 'c', label: 'Rodzajem lokaty bankowej' },
      DONT_KNOW,
    ],
  },
  {
    id: 'q3',
    prompt: '3. Portfel spadł o 20%. O ile musi wzrosnąć, by wrócić do poprzedniej wartości?',
    correct: 'b',
    options: [
      { value: 'a', label: 'O 20%' },
      { value: 'b', label: 'O 25%' },
      { value: 'c', label: 'O 40%' },
      DONT_KNOW,
    ],
  },
] as const;

// ---------- Krok 5: preferencje ----------

export const EXCLUSION_OPTIONS = [
  { value: 'bron', label: 'Broń' },
  { value: 'tyton', label: 'Tytoń' },
  { value: 'paliwa', label: 'Paliwa kopalne' },
  { value: 'hazard', label: 'Hazard' },
] as const satisfies readonly Choice[];

export const INSTRUMENTS_OPTIONS = [
  { value: 'etf', label: 'Tylko fundusze ETF', sub: 'prostsze i bardziej przejrzyste' },
  { value: 'etf_akcje', label: 'ETF-y i pojedyncze akcje', sub: 'więcej wyborów, więcej do ogarnięcia' },
] as const satisfies readonly Choice[];

export const CURRENCY_OPTIONS = [
  { value: 'pln', label: 'Złoty (PLN)' },
  { value: 'usd', label: 'Dolar (USD)' },
] as const satisfies readonly Choice[];

// ---------- Typy wynikające ze słownika ----------

type ValueOf<T extends readonly { readonly value: string | number }[]> = T[number]['value'];

export type GoalValue = ValueOf<typeof GOAL_OPTIONS>;
export type HorizonValue = ValueOf<typeof HORIZON_OPTIONS>;
export type StartValue = ValueOf<typeof START_OPTIONS>;
export type MonthlyValue = ValueOf<typeof MONTHLY_OPTIONS>;
export type CushionValue = ValueOf<typeof CUSHION_OPTIONS>;
export type IncomeValue = ValueOf<typeof INCOME_OPTIONS>;
export type LoansValue = ValueOf<typeof LOANS_OPTIONS>;
export type DropValue = (typeof DROP_VALUES)[number];
export type ReactionValue = ValueOf<typeof REACTION_OPTIONS>;
export type RiskPreferenceValue = ValueOf<typeof RISK_PREFERENCE_OPTIONS>;
export type ExperienceValue = ValueOf<typeof EXPERIENCE_OPTIONS>;
export type QuizAnswer = (typeof QUIZ_ANSWER_VALUES)[number];
export type QuizId = (typeof QUIZ)[number]['id'];
export type ExclusionValue = ValueOf<typeof EXCLUSION_OPTIONS>;
export type InstrumentsValue = ValueOf<typeof INSTRUMENTS_OPTIONS>;
export type CurrencyValue = ValueOf<typeof CURRENCY_OPTIONS>;

/** Zwraca etykietę odpowiedzi (do podsumowań i wyjaśnień). */
export function labelOf(options: readonly Choice[], value: string | number | null | undefined) {
  return options.find((o) => o.value === value)?.label ?? '';
}
