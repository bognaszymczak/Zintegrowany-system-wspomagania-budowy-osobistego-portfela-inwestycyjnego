"""
Silnik obliczeń portfela — czyste funkcje, bez bazy i bez sieci.

To wierna kopia web/src/domain/portfolio/engine.ts. Oba warianty mają wspólne testy z tymi samymi liczbami
(web/src/domain/portfolio/engine.test.ts i api/tests/test_engine.py). Nie ma tu NumPy celowo: pętle są
dokładnie takie jak w TypeScripcie, więc wyniki zgadzają się co do ostatnich cyfr.

Poza zakresem portu: `redistribute` (pomocnik suwaków) — działa tylko w przeglądarce, backend dostaje już
gotowe udziały i sprawdza je funkcją `is_valid_weights`.

Udziały (`weights`) podajemy w PUNKTACH PROCENTOWYCH (np. 18 = 18%), wynik zawsze sumuje się do 100.
Zwroty, wahania i koszty to ułamki (0,05 = 5%).
"""

import math
from collections.abc import Iterable, Sequence
from dataclasses import dataclass

from ..schemas import FanPoint, LimitCheck, LimitItem, MarketAssumptions, Plan, Scenario
from .assumptions import SAMPLE_ASSUMPTIONS
from .instruments import EQUITY_INDEXES, GROUPS, INSTRUMENT_COUNT, INSTRUMENTS, RISK_WORDS
from .jsfmt import js_round, pct
from .profiles import RiskProfile

Weights = Sequence[float]

# Największy udział, jaki można ustawić suwakiem (ograniczenie interfejsu, nie serwera).
MAX_WEIGHT = 60
# z-score dla 10. i 90. percentyla rozkładu normalnego.
Z10 = 1.2816

EPS = 1e-9


def acc(values: Iterable[float]) -> float:
    """Suma dodawana po kolei od zera, jak `reduce` w JavaScripcie.

    Wbudowane sum() w nowych Pythonach liczy float-y z korekcją błędu, więc w ostatnich cyfrach potrafi
    różnić się od JavaScriptu; tu zależy nam na identycznych wynikach.
    """
    total = 0.0
    for value in values:
        total += value
    return total


def sum_weights(weights: Weights) -> float:
    return acc(weights)


def is_valid_weights(weights: Weights) -> bool:
    """Wektor jest poprawny, gdy ma 7 nieujemnych, skończonych liczb o sumie 100."""
    return (
        len(weights) == INSTRUMENT_COUNT
        and all(math.isfinite(x) and x >= 0 for x in weights)
        and abs(sum_weights(weights) - 100) < 1e-6
    )


def parse_weights(text: str) -> list[float] | None:
    """„18,15,5,20,10,15,17” → [18, 15, 5, 20, 10, 15, 17]; None, gdy tekst nie jest poprawnym wektorem udziałów."""
    try:
        parts = [float(x.strip()) for x in text.split(",")]
    except ValueError:
        return None
    return parts if is_valid_weights(parts) else None


# ---------------------------------------------------------------------------------------------
# Rozkłady
# ---------------------------------------------------------------------------------------------


def normal_cdf(x: float) -> float:
    """Dystrybuanta rozkładu normalnego (przybliżenie Abramowitza–Stegun, błąd < 1e-7)."""
    t = 1 / (1 + 0.2316419 * abs(x))
    d = 0.3989423 * math.exp((-x * x) / 2)
    p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
    return 1 - p if x > 0 else p


def student_t5_cdf(x: float) -> float:
    """
    Dystrybuanta rozkładu t-Studenta o 5 stopniach swobody (wzór zamknięty).
    „Grube ogony” t-Studenta lepiej niż rozkład normalny oddają rzadkie, duże straty na rynkach.
    """
    theta = math.atan(x / math.sqrt(5))
    c = math.cos(theta)
    s = math.sin(theta)
    return 0.5 + (theta + s * c * (1 + (2 / 3) * c * c)) / math.pi


# ---------------------------------------------------------------------------------------------
# Statystyki i projekcja
# ---------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class PortfolioStats:
    mu: float  # oczekiwany roczny zwrot portfela
    sigma: float  # roczne wahania (odchylenie standardowe)
    variance: float
    marginal: list[float]  # (Σw)_i — wkład instrumentu i do wariancji, przydatny do rozbicia ryzyka


def portfolio_stats(weights: Weights, a: MarketAssumptions = SAMPLE_ASSUMPTIONS) -> PortfolioStats:
    n = INSTRUMENT_COUNT
    w = [x / 100 for x in weights]
    mu = 0.0
    for i in range(n):
        mu += w[i] * a.mu[i]
    marginal = [0.0] * n
    for i in range(n):
        for j in range(n):
            marginal[i] += a.corr[i][j] * a.sigma[i] * a.sigma[j] * w[j]
    variance = 0.0
    for i in range(n):
        variance += w[i] * marginal[i]
    return PortfolioStats(mu=mu, sigma=math.sqrt(variance), variance=variance, marginal=marginal)


def project_value(st: PortfolioStats, z: float, years: float, start_pln: float, monthly_pln: float) -> float:
    """
    Wartość portfela po `years` latach w scenariuszu o „pechu” z (z = 0 → typowy, z = −1,28 → zły,
    z = +1,28 → dobry). Kwota startowa + wpłaty na koniec każdego miesiąca.
    """
    g = st.mu - (st.sigma * st.sigma) / 2
    months = js_round(12 * years)
    total = start_pln * math.exp(g * years + z * st.sigma * math.sqrt(years))
    for k in range(1, months + 1):
        tau = (months - k) / 12
        total += monthly_pln * math.exp(g * tau + z * st.sigma * math.sqrt(tau))
    return total


def future_value(
    weights: Weights, z: float, years: float, plan: Plan, a: MarketAssumptions = SAMPLE_ASSUMPTIONS
) -> float:
    return project_value(portfolio_stats(weights, a), z, years, plan.start_pln, plan.monthly_pln)


def goal_probability(weights: Weights, plan: Plan, a: MarketAssumptions = SAMPLE_ASSUMPTIONS) -> float | None:
    """Szansa (0–1), że po `plan.years` latach wartość portfela przekroczy cel. None, gdy cel nie został podany."""
    if plan.target_pln is None:
        return None
    st = portfolio_stats(weights, a)
    goal = plan.target_pln

    def value(z: float) -> float:
        return project_value(st, z, plan.years, plan.start_pln, plan.monthly_pln)

    if value(-5) >= goal:
        return 1.0
    if value(5) < goal:
        return 0.0
    # szukamy z, przy którym wynik dokładnie dotyka celu; szansa = 1 − Φ(z)
    lo, hi = -5.0, 5.0
    for _ in range(50):
        mid = (lo + hi) / 2
        if value(mid) >= goal:
            hi = mid
        else:
            lo = mid
    return 1 - normal_cdf((lo + hi) / 2)


def fan_series(
    weights: Weights, plan: Plan, a: MarketAssumptions = SAMPLE_ASSUMPTIONS, step_months: int = 3
) -> list[FanPoint]:
    """Punkty do wykresu wachlarzowego: co `step_months` miesięcy, zawsze z punktem końcowym."""
    st = portfolio_stats(weights, a)
    total = js_round(12 * plan.years)
    months = list(range(0, total, step_months)) + [total]
    points: list[FanPoint] = []
    for m in months:
        years = m / 12
        points.append(
            FanPoint(
                month=m,
                years=years,
                p10=project_value(st, -Z10, years, plan.start_pln, plan.monthly_pln),
                median=project_value(st, 0, years, plan.start_pln, plan.monthly_pln),
                p90=project_value(st, Z10, years, plan.start_pln, plan.monthly_pln),
                paid_in=plan.start_pln + plan.monthly_pln * m,
            )
        )
    return points


# ---------------------------------------------------------------------------------------------
# Skala ryzyka, scenariusze, koszty
# ---------------------------------------------------------------------------------------------


def risk_indicator(sigma: float, a: MarketAssumptions = SAMPLE_ASSUMPTIONS) -> int:
    """Skala 1–7 oparta o roczne wahania portfela (progi w MarketAssumptions.risk_thresholds)."""
    level = 1
    for threshold in a.risk_thresholds:
        if sigma >= threshold:
            level += 1
    return level


def risk_word(level: float) -> str:
    return RISK_WORDS[min(7, max(1, js_round(level)))]


def scenario_return(weights: Weights, scenario: Scenario) -> float:
    total = 0.0
    for i, x in enumerate(weights):
        total += (x / 100) * scenario.returns[i]
    return total


@dataclass(frozen=True)
class ScenarioResult:
    id: str
    period: str
    name: str
    ret: float  # zwrot portfela w tym okresie (ujemny = strata)


def scenario_results(weights: Weights, a: MarketAssumptions = SAMPLE_ASSUMPTIONS) -> list[ScenarioResult]:
    return [
        ScenarioResult(id=s.id, period=s.period, name=s.name, ret=scenario_return(weights, s))
        for s in a.scenarios
    ]


def annual_cost(weights: Weights, a: MarketAssumptions = SAMPLE_ASSUMPTIONS) -> float:
    total = 0.0
    for i, x in enumerate(weights):
        total += (x / 100) * a.ter[i]
    return total


# ---------------------------------------------------------------------------------------------
# Zbiorcze metryki portfela (to pokazują ekrany)
# ---------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class PortfolioMetrics:
    sri: int
    sri_word: str
    mu: float
    sigma: float
    # zły / typowy / dobry wynik po `plan.years` latach (zł)
    p10: float
    median: float
    p90: float
    goal_probability: float | None  # 0–1 albo None, gdy użytkownik nie podał celu
    annual_cost: float
    scenarios: list[ScenarioResult]
    worst_scenario: ScenarioResult
    worst_year: float  # najgorszy zwrot ze scenariuszy kryzysowych (ujemny ułamek)
    equity_pct: float  # łączny udział akcji, w punktach procentowych
    max_position_pct: float
    max_position_index: int
    paid_in: float  # suma wpłat użytkownika w całym okresie (zł)


def portfolio_metrics(
    weights: Weights, plan: Plan, a: MarketAssumptions = SAMPLE_ASSUMPTIONS
) -> PortfolioMetrics:
    st = portfolio_stats(weights, a)
    scenarios = scenario_results(weights, a)
    worst = scenarios[0]
    for s in scenarios[1:]:
        if s.ret < worst.ret:
            worst = s
    max_position_pct = max(weights)
    sri = risk_indicator(st.sigma, a)
    return PortfolioMetrics(
        sri=sri,
        sri_word=risk_word(sri),
        mu=st.mu,
        sigma=st.sigma,
        p10=project_value(st, -Z10, plan.years, plan.start_pln, plan.monthly_pln),
        median=project_value(st, 0, plan.years, plan.start_pln, plan.monthly_pln),
        p90=project_value(st, Z10, plan.years, plan.start_pln, plan.monthly_pln),
        goal_probability=goal_probability(weights, plan, a),
        annual_cost=annual_cost(weights, a),
        scenarios=scenarios,
        worst_scenario=worst,
        worst_year=worst.ret,
        equity_pct=acc(weights[i] for i in EQUITY_INDEXES),
        max_position_pct=max_position_pct,
        max_position_index=list(weights).index(max_position_pct),
        paid_in=plan.start_pln + plan.monthly_pln * js_round(12 * plan.years),
    )


# ---------------------------------------------------------------------------------------------
# Limity profilu
# ---------------------------------------------------------------------------------------------


def check_limits(metrics: PortfolioMetrics, profile: RiskProfile) -> LimitCheck:
    """
    Porównuje portfel z granicami profilu. Przekroczenie NIE blokuje użytkownika (to tylko ostrzeżenie):
    ostateczna decyzja należy do niego, a ekran oceny ryzyka pokazuje, co to oznacza.
    """
    max_equity_pct = profile.max_equity * 100
    max_position_pct = profile.max_position * 100
    position_name = INSTRUMENTS[metrics.max_position_index].name

    equity_ok = metrics.equity_pct <= max_equity_pct + EPS
    position_ok = metrics.max_position_pct <= max_position_pct + EPS
    drawdown_ok = metrics.worst_year >= profile.max_drawdown - EPS
    volatility_ok = metrics.sigma <= profile.volatility + EPS

    if position_ok:
        position_message = (
            f"Największa pozycja {js_round(metrics.max_position_pct)}% (limit {js_round(max_position_pct)}%)"
        )
    else:
        position_message = (
            f"Największa pozycja {js_round(metrics.max_position_pct)}%: {position_name} "
            f"(limit {js_round(max_position_pct)}%)"
        )

    items = [
        LimitItem(
            kind="equity",
            ok=equity_ok,
            message=f"Akcje {js_round(metrics.equity_pct)}% (limit {js_round(max_equity_pct)}%)",
        ),
        LimitItem(kind="position", ok=position_ok, message=position_message),
        LimitItem(
            kind="drawdown",
            ok=drawdown_ok,
            message=f"Najgorszy rok {pct(metrics.worst_year, 1)} (limit {pct(profile.max_drawdown, 0)})",
        ),
        LimitItem(
            kind="volatility",
            ok=volatility_ok,
            message=f"Wahania ±{pct(metrics.sigma, 1)} (limit ±{pct(profile.volatility, 0)})",
        ),
    ]
    violations = [item for item in items if not item.ok]
    return LimitCheck(ok=len(violations) == 0, items=items, violations=violations)


# ---------------------------------------------------------------------------------------------
# Grupy
# ---------------------------------------------------------------------------------------------


def group_totals(weights: Weights) -> list[float]:
    """Suma udziałów w każdej z czterech grup (kolejność jak w GROUPS)."""
    return [acc(weights[i] for i in g.indexes) for g in GROUPS]
