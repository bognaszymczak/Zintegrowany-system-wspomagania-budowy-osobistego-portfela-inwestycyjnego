/**
 * Punktacja profilu inwestora — czysta funkcja bez zależności od Reacta i sieci.
 *
 * Ta sama logika jest odtworzona w Pythonie: api/app/services/profile.py.
 * W trybie mocków liczy ją przeglądarka (src/mocks), w trybie produkcyjnym — backend.
 * Testy obu wersji sprawdzają te same przypadki (profile.test.ts / test_profile.py).
 *
 * Zasada przewodnia: gdy odpowiedzi się rozchodzą, wybieramy ostrożniejszy wynik.
 */
import {
  QUIZ,
  type CurrencyValue,
  type CushionValue,
  type DropValue,
  type ExclusionValue,
  type ExperienceValue,
  type GoalValue,
  type HorizonValue,
  type IncomeValue,
  type InstrumentsValue,
  type LoansValue,
  type MonthlyValue,
  type QuizAnswer,
  type QuizId,
  type ReactionValue,
  type RiskPreferenceValue,
  type StartValue,
} from './questionnaire';
import { clampLevel, type RiskLevel } from './profiles';

/** Odpowiedzi z formularza w postaci, w jakiej trafiają do API (kontrakt). */
export interface ProfileRequest {
  goal: GoalValue;
  horizon: HorizonValue;
  /** cel w zł albo null, gdy użytkownik nie podał kwoty */
  targetAmountPLN: number | null;
  startBand: StartValue;
  monthlyBand: MonthlyValue;
  cushion: CushionValue;
  income: IncomeValue;
  loans: LoansValue;
  acceptableDropPct: DropValue;
  reaction: ReactionValue;
  riskPreference: RiskPreferenceValue;
  experience: ExperienceValue[];
  quiz: Record<QuizId, QuizAnswer | null>;
  excludedSectors: ExclusionValue[];
  esgPreferred: boolean;
  instruments: InstrumentsValue;
  displayCurrency: CurrencyValue;
}

export type Score = 1 | 2 | 3 | 4 | 5;
export type KnowledgeLevel = 'podstawowa' | 'srednia' | 'dobra';

export interface ProfileScores {
  /** zdolność do poniesienia straty: poduszka, dochód, raty */
  capacity: Score;
  /** tolerancja ryzyka: akceptowany spadek, reakcja na spadki, wybór A/B */
  tolerance: Score;
  /** horyzont inwestowania */
  horizon: Score;
}

export interface ProfileScoring {
  scores: ProfileScores;
  /** końcowy poziom profilu 1–5 (najniższy z wyników i ograniczeń) */
  level: RiskLevel;
  /** deklarowana tolerancja została obniżona, bo przy spadku użytkownik sprzedałby wszystko */
  behaviorCapApplied: boolean;
  /** cel „poduszka bezpieczeństwa” ogranicza profil do najniższego poziomu */
  goalCapApplied: boolean;
  knowledge: KnowledgeLevel;
  /** liczba poprawnych odpowiedzi w mini-quizie (0–3) */
  quizCorrect: number;
}

// ---------- tabele punktowe ----------

const CUSHION_POINTS: Record<CushionValue, number> = { tak: 4, czesciowo: 2, nie: 0 };
const INCOME_POINTS: Record<IncomeValue, number> = { staly: 3, zmienny: 2, niepewny: 0 };
const LOANS_POINTS: Record<LoansValue, number> = { brak: 3, do20: 2, '20do40': 1, ponad40: 0 };
const CAPACITY_MAX_POINTS = 10;

const DROP_SHARE: Record<DropValue, number> = { 10: 0, 20: 0.5, 30: 0.75, 40: 1 };
const REACTION_SHARE: Record<ReactionValue, number> = { wszystko: 0, czesc: 0.25, czekam: 0.75, dokupuje: 1 };
const PREFERENCE_SHARE: Record<RiskPreferenceValue, number> = { pewne: 0, ryzyko: 1 };
const W_DROP = 0.5;
const W_REACTION = 0.3;
const W_PREFERENCE = 0.2;

/** Kto sprzedałby wszystko przy spadku, nie ma realnej tolerancji powyżej 2 — niezależnie od deklaracji. */
export const BEHAVIOR_CAP: Score = 2;

const HORIZON_SCORE: Record<HorizonValue, Score> = { do3: 2, '3do5': 3, '5do10': 4, ponad10: 5 };

/** Udział 0–1 -> wynik 1–5. Zaokrąglamy w dół (ostrożniej); 1e-9 chroni przed błędem zmiennoprzecinkowym. */
export function toScore(share: number): Score {
  const clamped = Math.min(1, Math.max(0, share));
  return (1 + Math.floor(clamped * 4 + 1e-9)) as Score;
}

export function computeProfile(req: ProfileRequest): ProfileScoring {
  const capacityShare =
    (CUSHION_POINTS[req.cushion] + INCOME_POINTS[req.income] + LOANS_POINTS[req.loans]) /
    CAPACITY_MAX_POINTS;
  const capacity = toScore(capacityShare);

  const toleranceShare =
    W_DROP * DROP_SHARE[req.acceptableDropPct] +
    W_REACTION * REACTION_SHARE[req.reaction] +
    W_PREFERENCE * PREFERENCE_SHARE[req.riskPreference];
  let tolerance = toScore(toleranceShare);
  const behaviorCapApplied = req.reaction === 'wszystko' && tolerance > BEHAVIOR_CAP;
  if (behaviorCapApplied) tolerance = BEHAVIOR_CAP;

  const horizon = HORIZON_SCORE[req.horizon];

  const lowest = Math.min(capacity, tolerance, horizon);
  const goalCapApplied = req.goal === 'poduszka' && lowest > 1;
  const level = clampLevel(goalCapApplied ? 1 : lowest);

  const quizCorrect = QUIZ.filter((q) => req.quiz[q.id] === q.correct).length;
  const knowsMarkets = req.experience.includes('akc') || req.experience.includes('etf');
  const knowledge: KnowledgeLevel =
    quizCorrect === QUIZ.length && knowsMarkets
      ? 'dobra'
      : quizCorrect >= 2 || knowsMarkets
        ? 'srednia'
        : 'podstawowa';

  return {
    scores: { capacity, tolerance, horizon },
    level,
    behaviorCapApplied,
    goalCapApplied,
    knowledge,
    quizCorrect,
  };
}

/** Poziom po ręcznej korekcie na ekranie profilu: −1 (ostrożniej), 0, +1 (odważniej). */
export function applyLevelShift(level: RiskLevel, shift: -1 | 0 | 1): RiskLevel {
  return clampLevel(level + shift);
}
