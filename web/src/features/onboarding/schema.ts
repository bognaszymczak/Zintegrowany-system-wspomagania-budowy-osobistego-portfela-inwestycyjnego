/**
 * Walidacja formularza wstępnego (Zod).
 *
 * Ten plik jest źródłem prawdy o tym, jakie odpowiedzi są poprawne.
 * Typ FormValues wynika ze schematu — nie piszemy go ręcznie, więc kod i walidacja
 * nie mogą się rozjechać. Komunikaty błędów są po polsku i mówią, CO zrobić.
 */
import { z } from 'zod';
import { isValidTarget, TARGET_ERROR } from '@/domain/money';
import {
  CURRENCY_OPTIONS,
  CUSHION_OPTIONS,
  GOAL_OPTIONS,
  HORIZON_OPTIONS,
  INCOME_OPTIONS,
  INSTRUMENTS_OPTIONS,
  LOANS_OPTIONS,
  MONTHLY_OPTIONS,
  QUIZ_ANSWER_VALUES,
  REACTION_OPTIONS,
  RISK_PREFERENCE_OPTIONS,
  START_OPTIONS,
  type DropValue,
} from '@/domain/questionnaire';

type Options = readonly { readonly value: string }[];

function valuesOf<T extends Options>(options: T): [T[number]['value'], ...T[number]['value'][]] {
  return options.map((o) => o.value) as [T[number]['value'], ...T[number]['value'][]];
}

/** Pytanie jednokrotnego wyboru: dopuszcza tylko wartości ze słownika, inaczej pokazuje `message`. */
function choice<T extends Options>(options: T, message: string) {
  return z.enum(valuesOf(options), { errorMap: () => ({ message }) });
}

const drop: z.ZodType<DropValue> = z.union(
  [z.literal(10), z.literal(20), z.literal(30), z.literal(40)],
  { errorMap: () => ({ message: 'Wybierz akceptowany spadek na suwaku.' }) },
);

const experience = z
  .object({
    lok: z.boolean(),
    obl: z.boolean(),
    akc: z.boolean(),
    etf: z.boolean(),
    nic: z.boolean(),
  })
  .refine((e) => e.lok || e.obl || e.akc || e.etf || e.nic, {
    message: 'Zaznacz, z czym masz doświadczenie, albo „Nic z tego”.',
  })
  .refine((e) => !e.nic || !(e.lok || e.obl || e.akc || e.etf), {
    message: '„Nic z tego” nie łączy się z pozostałymi odpowiedziami.',
  });

// Mini-quiz jest opcjonalny: brak odpowiedzi = pominięte (liczy się jak „Nie wiem”).
const quizAnswer = z.enum(QUIZ_ANSWER_VALUES).nullable().optional();

export const formSchema = z.object({
  // Krok 1 — cel i czas
  goal: choice(GOAL_OPTIONS, 'Wybierz, na co chcesz odkładać.'),
  horizon: choice(HORIZON_OPTIONS, 'Wybierz, za ile lat będziesz potrzebować tych pieniędzy.'),
  amount: z.string().refine(isValidTarget, { message: TARGET_ERROR }),
  start: choice(START_OPTIONS, 'Wybierz, ile możesz wpłacić na start.'),
  monthly: choice(MONTHLY_OPTIONS, 'Wybierz, ile możesz odkładać co miesiąc.'),

  // Krok 2 — sytuacja
  cushion: choice(CUSHION_OPTIONS, 'Wybierz odpowiedź o poduszce finansowej.'),
  income: choice(INCOME_OPTIONS, 'Wybierz, jak stabilny jest Twój dochód.'),
  loans: choice(LOANS_OPTIONS, 'Wybierz, jaką część dochodu zajmują raty.'),

  // Krok 3 — podejście do ryzyka
  drop,
  reaction: choice(REACTION_OPTIONS, 'Wybierz, co byś zrobił(a) przy spadku.'),
  ab: choice(RISK_PREFERENCE_OPTIONS, 'Wybierz jedną z dwóch opcji.'),

  // Krok 4 — wiedza i doświadczenie
  exp: experience,
  quiz: z.object({ q1: quizAnswer, q2: quizAnswer, q3: quizAnswer }),

  // Krok 5 — preferencje (wykluczenia i ESG są opcjonalne, więc zawsze poprawne)
  exclusions: z.object({
    bron: z.boolean(),
    tyton: z.boolean(),
    paliwa: z.boolean(),
    hazard: z.boolean(),
  }),
  esg: z.boolean(),
  typ: choice(INSTRUMENTS_OPTIONS, 'Wybierz, z czego mają składać się portfele.'),
  ccy: choice(CURRENCY_OPTIONS, 'Wybierz walutę, w której pokażemy wyniki.'),
});

export type FormValues = z.infer<typeof formSchema>;

/**
 * Stan początkowy. Pytania z wyborem celowo NIE mają odpowiedzi domyślnych:
 * wstępnie zaznaczona odpowiedź podpowiada wynik i zniekształca profil.
 * Wyjątek: suwak spadku musi gdzieś stać — startuje na −20%.
 */
export const EMPTY_VALUES: Partial<FormValues> = {
  amount: '',
  drop: 20,
  exp: { lok: false, obl: false, akc: false, etf: false, nic: false },
  quiz: { q1: null, q2: null, q3: null },
  exclusions: { bron: false, tyton: false, paliwa: false, hazard: false },
  esg: false,
};

/** Kompletne, poprawne odpowiedzi do prezentacji („Uzupełnij przykładowe odpowiedzi”). */
export const DEMO_VALUES: FormValues = {
  goal: 'mieszkanie',
  horizon: '5do10',
  amount: '100 000',
  start: '5do20k',
  monthly: '300do1000',
  cushion: 'tak',
  income: 'staly',
  loans: 'do20',
  drop: 20,
  reaction: 'czekam',
  ab: 'ryzyko',
  exp: { lok: true, obl: false, akc: false, etf: true, nic: false },
  quiz: { q1: 'b', q2: 'b', q3: 'b' },
  exclusions: { bron: false, tyton: false, paliwa: false, hazard: false },
  esg: false,
  typ: 'etf',
  ccy: 'pln',
};
