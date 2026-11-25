"""
KONTRAKT API w Pythonie — te same kształty, co w web/src/api/types.ts.

Pola w Pythonie nazywamy snake_case, a w JSON-ie (czyli dla przeglądarki) wychodzą jako camelCase:
`profile_id` → `profileId`, `target_amount_pln` → `targetAmountPLN`. Robi to `CamelModel` poniżej.
Gdy zmieniasz kontrakt, zmień go w OBU miejscach (ten plik i types.ts) — albo wygeneruj typy TypeScript
z /openapi.json (patrz README).

Te same klasy służą jako wynik obliczeń w `services/` (silnik zwraca gotowe obiekty odpowiedzi).
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


def _alias(name: str) -> str:
    # to_camel("target_amount_pln") == "targetAmountPln"; frontend używa „PLN” wielkimi literami
    return to_camel(name).replace("Pln", "PLN")


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=_alias, populate_by_name=True)


# ---------------------------------------------------------------------------------------------
# Wartości z formularza (muszą się zgadzać z web/src/domain/questionnaire.ts)
# ---------------------------------------------------------------------------------------------

Goal = Literal["poduszka", "mieszkanie", "emerytura", "edukacja", "majatek"]
Horizon = Literal["do3", "3do5", "5do10", "ponad10"]
StartBand = Literal["do5k", "5do20k", "20do50k", "ponad50k"]
MonthlyBand = Literal["do300", "300do1000", "1000do3000", "ponad3000"]
Cushion = Literal["tak", "czesciowo", "nie"]
Income = Literal["staly", "zmienny", "niepewny"]
Loans = Literal["brak", "do20", "20do40", "ponad40"]
DropPct = Literal[10, 20, 30, 40]
Reaction = Literal["wszystko", "czesc", "czekam", "dokupuje"]
RiskPreference = Literal["pewne", "ryzyko"]
Experience = Literal["lok", "obl", "akc", "etf", "nic"]
QuizAnswer = Literal["a", "b", "c", "nw"]
Exclusion = Literal["bron", "tyton", "paliwa", "hazard"]
InstrumentsChoice = Literal["etf", "etf_akcje"]
Currency = Literal["pln", "usd"]
RiskLevel = Literal[1, 2, 3, 4, 5]
Score = Literal[1, 2, 3, 4, 5]


# ---------------------------------------------------------------------------------------------
# Konto
# ---------------------------------------------------------------------------------------------


class AuthUser(CamelModel):
    id: str
    name: str | None
    email: str


class RegisterRequest(CamelModel):
    name: str = Field(default="", max_length=60)
    email: str = Field(max_length=254)
    # min. 10 znaków — tę samą regułę ma formularz (web/src/features/auth/schema.ts)
    password: str = Field(min_length=10, max_length=200)
    # oświadczenie „mam ukończone 18 lat” — wymagane (reguła: services/consents.py); brak pola = błąd walidacji
    adult_confirmed: bool
    accept_terms: bool
    accept_simulation: bool
    marketing_opt_in: bool = False


class LoginRequest(CamelModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=200)


class AuthResponse(CamelModel):
    user: AuthUser


# ---------------------------------------------------------------------------------------------
# Profil
# ---------------------------------------------------------------------------------------------


class ProfileRequest(CamelModel):
    goal: Goal
    horizon: Horizon
    target_amount_pln: float | None = Field(gt=0, le=1_000_000_000)
    start_band: StartBand
    monthly_band: MonthlyBand
    cushion: Cushion
    income: Income
    loans: Loans
    acceptable_drop_pct: DropPct
    reaction: Reaction
    risk_preference: RiskPreference
    experience: list[Experience]
    quiz: dict[Literal["q1", "q2", "q3"], QuizAnswer | None]
    excluded_sectors: list[Exclusion]
    esg_preferred: bool
    instruments: InstrumentsChoice
    display_currency: Currency


class Plan(CamelModel):
    start_pln: float
    monthly_pln: float
    years: int
    target_pln: float | None


class ProfileScores(CamelModel):
    capacity: Score
    tolerance: Score
    horizon: Score


class ProfileScoring(CamelModel):
    scores: ProfileScores
    level: RiskLevel
    behavior_cap_applied: bool
    goal_cap_applied: bool
    knowledge: Literal["podstawowa", "srednia", "dobra"]
    quiz_correct: int


class ProfileLimits(CamelModel):
    volatility: float
    max_drawdown: float
    max_equity: float
    max_position: float


class ProfileResponse(ProfileScoring):
    profile_id: str
    name: str
    limits: ProfileLimits
    plan: Plan
    created_at: str


# ---------------------------------------------------------------------------------------------
# Założenia rynkowe i symulacja wsteczna
# ---------------------------------------------------------------------------------------------


class Scenario(CamelModel):
    id: Literal["y2008", "y2020", "y2022"]
    period: str
    name: str
    returns: list[float]


class Regime(CamelModel):
    id: Literal["spokojny", "podwyzszony", "kryzysowy"]
    label: str
    vix: float
    vol_multiplier: float


class MarketAssumptions(CamelModel):
    as_of: str
    mu: list[float]
    sigma: list[float]
    ter: list[float]
    corr: list[list[float]]
    scenarios: list[Scenario]
    risk_thresholds: list[float]
    regime: Regime


class CrisisPeriod(CamelModel):
    id: str
    label: str
    # pierwszy i ostatni miesiąc okresu (RRRR-MM)
    from_: str = Field(alias="from")
    to: str


class BacktestStats(CamelModel):
    portfolio_end: float
    sp500_end: float
    inflation_end: float
    deposit_end: float
    portfolio_max_drawdown: float
    sp500_max_drawdown: float


class BacktestResponse(CamelModel):
    start_pln: float
    dates: list[str]
    portfolio: list[float]
    sp500: list[float]
    inflation: list[float]
    deposit: list[float]
    crises: list[CrisisPeriod]
    stats: BacktestStats
    source: str


# ---------------------------------------------------------------------------------------------
# Propozycje portfeli
# ---------------------------------------------------------------------------------------------


class ProposalView(CamelModel):
    id: str
    level: RiskLevel
    kind: Literal["stabilnosc", "rownowaga", "wzrost"]
    name: str
    tag: str
    idea: str
    weights: list[int]
    group_totals: list[float]
    sri: int
    sri_word: str
    median_pln: float
    p10_pln: float
    p90_pln: float
    worst_year: float
    goal_probability: float | None
    annual_cost: float
    within_limits: bool


class ProposalsResponse(CamelModel):
    profile_id: str
    level: RiskLevel
    plan: Plan
    as_of: str
    valid_until: str
    proposals: list[ProposalView]


# ---------------------------------------------------------------------------------------------
# Ocena ryzyka
# ---------------------------------------------------------------------------------------------


class FanPoint(CamelModel):
    month: int
    years: float
    p10: float
    median: float
    p90: float
    paid_in: float


class LimitItem(CamelModel):
    kind: Literal["equity", "position", "drawdown", "volatility"]
    ok: bool
    message: str


class LimitCheck(CamelModel):
    ok: bool
    items: list[LimitItem]
    violations: list[LimitItem]


class WaterfallStep(CamelModel):
    kind: Literal["start", "step", "end"]
    label: str
    value: float
    delta: float | None


class RiskContribution(CamelModel):
    group: Literal["akcje", "obligacje", "zloto", "gotowka"]
    name: str
    weight_pct: float
    risk_pct: float


class CrisisRow(CamelModel):
    id: str
    period: str
    name: str
    mine: float
    base: float
    left_pln: float
    left_base_pln: float


class Takeaway(CamelModel):
    tone: Literal["ok", "up", "down", "warn"]
    text: str


class ModelInfo(CamelModel):
    # „demo-analytic” = model zastępczy, „ml” = prawdziwy, wytrenowany model (ekran pokazuje to użytkownikowi)
    kind: Literal["demo-analytic", "ml"]
    name: str
    version: str
    trained_on: str
    regime: Regime
    p_loss_without_regime: float
    reliability: Literal["niska", "srednia", "wysoka"]
    reliability_note: str


class AssessmentSummary(CamelModel):
    median: float
    median_base: float
    p10: float
    p90: float
    paid_in: float
    goal_pln: float | None
    goal_probability: float | None
    years: int


class Assessment(CamelModel):
    sri: int
    sri_word: str
    base_sri: int
    base_sri_word: str
    loss_chance_pct: float
    loss_chance_base_pct: float
    per100: int
    per100_base: int
    worst_year: float
    worst_year_base: float
    money_at_worst: float
    limits: LimitCheck
    changed: bool
    changed_count: int
    waterfall: list[WaterfallStep]
    contributions: list[RiskContribution]
    contribution_note: str
    crises: list[CrisisRow]
    fan: list[FanPoint]
    summary: AssessmentSummary
    takeaways: list[Takeaway]
    trade_off: str
    model: ModelInfo


class RiskAssessmentRequest(CamelModel):
    profile_id: str
    level: RiskLevel
    proposal_id: str
    weights: list[float] = Field(min_length=7, max_length=7)


class RiskAssessmentResponse(CamelModel):
    profile_id: str
    proposal_id: str
    base_name: str
    weights: list[float]
    plan: Plan
    as_of: str
    valid_until: str
    assessment: Assessment


# ---------------------------------------------------------------------------------------------
# Zapisany wybór
# ---------------------------------------------------------------------------------------------


class SaveChoiceRequest(CamelModel):
    profile_id: str
    level: RiskLevel
    proposal_id: str
    weights: list[float] = Field(min_length=7, max_length=7)


class SavedChoice(SaveChoiceRequest):
    id: str
    saved_at: str
