"""
Generator PRZYKŁADOWEJ historii rynku (2008–2025), używany, gdy w bazie nie ma jeszcze prawdziwych danych.

To NIE są notowania. Zwroty są losowane z rozkładu o parametrach z założeń rynkowych (te same wahania i
korelacje, które widzi silnik), z ustalonym ziarnem — więc wykres jest powtarzalny. Kryzysy 2008, 2020 i 2022
odtwarzają scenariusze dokładnie, a poza nimi zwroty są dopasowane tak, by w długim okresie rynek rósł
zgodnie z założeniami (inaczej symulacja dryfowałaby w dół, bo po wstawionych kryzysach nie ma odbić).

Ekran pokazuje użytkownikowi opis źródła (`source`) — w trybie demo mówi on wprost, że to symulacja.
"""

import math

import numpy as np

from ..schemas import MarketAssumptions
from .assumptions import SAMPLE_ASSUMPTIONS
from .backtest import CRISIS_PERIODS, MonthlyHistory
from .dates import month_range
from .instruments import INSTRUMENT_COUNT

DEMO_START = "2007-12"
DEMO_END = "2025-12"
DEMO_SEED = 20080915
DEMO_SOURCE = (
    "Dane przykładowe (symulacja wsteczna 2008–2025, coroczne przebalansowanie w styczniu). "
    "W wersji produkcyjnej: Alpha Vantage, FRED, NBP."
)


def inflation_by_year(year: int) -> float:
    """Roczna inflacja (przykładowa ścieżka: spokojne lata, skok w 2021–2023)."""
    if year == 2021:
        return 0.045
    if year == 2022:
        return 0.12
    if year == 2023:
        return 0.06
    return 0.03 if year >= 2024 else 0.022


def deposit_by_year(year: int) -> float:
    """Roczne oprocentowanie lokaty (przykładowe)."""
    if year <= 2013:
        return 0.035
    if year <= 2020:
        return 0.015
    return 0.03 if year <= 2022 else 0.05


def annual_to_monthly(rate: float) -> float:
    return (1 + rate) ** (1 / 12) - 1


def generate_demo_history(
    a: MarketAssumptions = SAMPLE_ASSUMPTIONS,
    start: str = DEMO_START,
    end: str = DEMO_END,
    seed: int = DEMO_SEED,
) -> MonthlyHistory:
    rng = np.random.default_rng(seed)
    dates = month_range(start, end)
    n = len(dates)
    mu = np.asarray(a.mu, dtype=float)
    sigma = np.asarray(a.sigma, dtype=float)
    monthly_sigma = sigma / math.sqrt(12)

    # skorelowane szoki: z ~ N(0, korelacje)
    chol = np.linalg.cholesky(np.asarray(a.corr, dtype=float))
    shocks = rng.standard_normal((n, INSTRUMENT_COUNT)) @ chol.T
    drift = (mu - sigma**2 / 2) / 12
    returns = np.maximum(-0.6, drift + shocks * monthly_sigma)
    returns[0] = 0.0

    # kryzysy: w oknie czasowym zwroty dają dokładnie zwrot ze scenariusza (z zerowym w sumie szumem)
    in_crisis = np.zeros(n, dtype=bool)
    for crisis in CRISIS_PERIODS:
        scenario = next((s for s in a.scenarios if s.id == crisis.id), None)
        idx = [k for k, d in enumerate(dates) if crisis.from_ <= d <= crisis.to]
        if scenario is None or not idx:
            continue
        in_crisis[idx] = True
        for i in range(INSTRUMENT_COUNT):
            noise = rng.standard_normal(len(idx))
            noise -= noise.mean()
            wiggle = noise * monthly_sigma[i] * 0.5
            returns[idx, i] = np.exp(math.log(1 + scenario.returns[i]) / len(idx) + wiggle) - 1

    # kalibracja długoterminowa: poza kryzysami przesuwamy zwroty o stałą tak, by cały przebieg rósł
    # średnio tak, jak mówią założenia (μ − σ²/2 rocznie)
    free = [k for k in range(1, n) if not in_crisis[k]]
    years = (n - 1) / 12
    for i in range(INSTRUMENT_COUNT):
        log_sum = float(np.log1p(returns[1:, i]).sum())
        target = (mu[i] - sigma[i] ** 2 / 2) * years
        shift = (target - log_sum) / max(1, len(free))
        returns[free, i] = np.expm1(np.log1p(returns[free, i]) + shift)

    years_of = [int(d[:4]) for d in dates]
    inflation = [0.0] + [annual_to_monthly(inflation_by_year(y)) for y in years_of[1:]]
    deposit = [0.0] + [annual_to_monthly(deposit_by_year(y)) for y in years_of[1:]]
    return MonthlyHistory(
        dates=dates,
        returns=returns.tolist(),
        inflation=inflation,
        deposit=deposit,
        source=DEMO_SOURCE,
    )
