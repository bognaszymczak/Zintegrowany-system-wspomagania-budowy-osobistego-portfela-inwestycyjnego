/**
 * KONTRAKT między frontendem a backendem — typy żądań i odpowiedzi.
 *
 * Backend (FastAPI) opisuje te same kształty w api/app/schemas.py i publikuje je jako OpenAPI
 * (http://localhost:8000/openapi.json). Gdy kontrakt się zmienia, można wygenerować typy
 * automatycznie:  npx openapi-typescript http://localhost:8000/openapi.json -o src/api/schema.gen.ts
 * i podmienić ręczne definicje poniżej.
 */
import type { Plan } from '@/domain/plan';
import type { Assessment } from '@/domain/portfolio/assessment';
import type { MarketAssumptions } from '@/domain/portfolio/assumptions';
import type { ProposalKind } from '@/domain/portfolio/proposals';
import type { ProfileScoring } from '@/domain/profile';
import type { RiskLevel } from '@/domain/profiles';

export type { ProfileRequest } from '@/domain/profile';
export type { Assessment, MarketAssumptions };

// ---------- konto użytkownika ----------

export interface AuthUser {
  id: string;
  /** imię lub pseudonim; pole jest opcjonalne przy rejestracji */
  name: string | null;
  email: string;
}

/** POST /api/auth/register */
export interface RegisterRequest {
  name: string;
  email: string;
  /** min. 10 znaków; backend zapisuje wyłącznie hash (scrypt), nigdy hasło */
  password: string;
  /** oświadczenie „mam ukończone 18 lat” — wymagane (serwis jest tylko dla osób pełnoletnich) */
  adultConfirmed: boolean;
  /** Regulamin i Polityka prywatności — wymagane */
  acceptTerms: boolean;
  /** świadomość, że to narzędzie edukacyjne, a nie doradztwo — wymagane */
  acceptSimulation: boolean;
  /** zgoda marketingowa — opcjonalna */
  marketingOptIn: boolean;
}

/** POST /api/auth/login */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Odpowiedź rejestracji, logowania i GET /api/auth/me (sesja w ciasteczku httpOnly). */
export interface AuthResponse {
  user: AuthUser;
}

export interface ProfileLimits {
  /** typowe roczne wahania (ułamek) */
  volatility: number;
  /** największy dopuszczalny spadek od szczytu (ujemny ułamek) */
  maxDrawdown: number;
  /** największy udział akcji (ułamek) */
  maxEquity: number;
  /** największy udział jednej pozycji (ułamek) */
  maxPosition: number;
}

/** POST /api/profile — wynik punktacji formularza. */
export interface ProfileResponse extends ProfileScoring {
  profileId: string;
  /** nazwa profilu, np. „Zrównoważony” */
  name: string;
  level: RiskLevel;
  limits: ProfileLimits;
  /** plan oszczędzania wyliczony z przedziałów z formularza */
  plan: Plan;
  createdAt: string;
}


// ---------- dane rynkowe ----------

/** GET /api/market/assumptions — parametry, na których liczy silnik (zwroty, wahania, korelacje…). */
export type AssumptionsResponse = MarketAssumptions;

export interface CrisisPeriod {
  id: string;
  label: string;
  /** pierwszy i ostatni miesiąc okresu (RRRR-MM) */
  from: string;
  to: string;
}

/** GET /api/market/backtest?weights=18,15,5,20,10,15,17 — symulacja wsteczna portfela. */
export interface BacktestResponse {
  startPLN: number;
  /** miesiące w formacie RRRR-MM; pierwszy punkt to stan początkowy */
  dates: string[];
  portfolio: number[];
  sp500: number[];
  inflation: number[];
  deposit: number[];
  crises: CrisisPeriod[];
  stats: {
    portfolioEnd: number;
    sp500End: number;
    inflationEnd: number;
    depositEnd: number;
    /** największy spadek od szczytu (ujemny ułamek) */
    portfolioMaxDrawdown: number;
    sp500MaxDrawdown: number;
  };
  /** opis źródła danych do podpisu pod wykresem */
  source: string;
}

// ---------- propozycje portfeli ----------

/** Jedna z trzech propozycji — dokładnie to, co pokazuje karta na ekranie 5. */
export interface ProposalView {
  id: string;
  level: RiskLevel;
  kind: ProposalKind;
  name: string;
  tag: string;
  idea: string;
  /** 7 udziałów w punktach procentowych, suma 100 */
  weights: number[];
  /** akcje, obligacje, złoto, gotówka */
  groupTotals: number[];
  sri: number;
  sriWord: string;
  medianPLN: number;
  p10PLN: number;
  p90PLN: number;
  /** najgorszy zwrot ze scenariuszy kryzysowych (ujemny ułamek) */
  worstYear: number;
  goalProbability: number | null;
  annualCost: number;
  withinLimits: boolean;
}

/** GET /api/proposals?profileId=…&level=… */
export interface ProposalsResponse {
  profileId: string;
  level: RiskLevel;
  plan: Plan;
  /** data danych rynkowych i data, do której propozycje są aktualne */
  asOf: string;
  validUntil: string;
  proposals: ProposalView[];
}

// ---------- ocena ryzyka ----------

/** POST /api/risk-assessment */
export interface RiskAssessmentRequest {
  profileId: string;
  /** poziom profilu po ewentualnej korekcie użytkownika (1–5) */
  level: RiskLevel;
  proposalId: string;
  /** udziały po edycji suwakami */
  weights: number[];
}

export interface RiskAssessmentResponse {
  profileId: string;
  proposalId: string;
  baseName: string;
  weights: number[];
  plan: Plan;
  asOf: string;
  validUntil: string;
  assessment: Assessment;
}

// ---------- zapisany wybór ----------

/** POST /api/choices — „Zapisz ten wybór” na ekranie oceny. */
export interface SaveChoiceRequest {
  profileId: string;
  /** poziom profilu po ewentualnej korekcie użytkownika (1–5) */
  level: RiskLevel;
  proposalId: string;
  /** udziały po edycji suwakami (7 liczb, suma 100) */
  weights: number[];
}

/** Zapisany wybór. W produkcji to wiersz w tabeli `choices` (patrz api/app/db/models.py). */
export interface SavedChoice extends SaveChoiceRequest {
  id: string;
  savedAt: string;
}
