"""
Z historii miesięcznych zwrotów do założeń rynkowych (μ, σ, korelacje, scenariusze kryzysowe).

To jest krok „dane → założenia”, który w wersji produkcyjnej wykonuje zadanie nocne (app/jobs/ingest.py),
a wynik zapisuje jako „zdjęcie” w tabeli assumptions_snapshots. Silnik portfela dostaje potem zwykły obiekt
MarketAssumptions — nie wie, czy pochodzi z próbki, czy z estymacji.

Uwaga metodologiczna (do omówienia w pracy): średnia z kilkunastu lat jest bardzo niepewna (przy σ = 15%
błąd standardowy średniej rocznej to ok. 3,5 p.p.), dlatego oczekiwane zwroty „ściągamy” w stronę wartości
bazowych (`shrink`). Wahania i korelacje estymujemy z danych wprost.
"""

import numpy as np

from ..schemas import MarketAssumptions, Regime, Scenario
from .assumptions import SAMPLE_ASSUMPTIONS
from .backtest import CRISIS_PERIODS
from .instruments import INSTRUMENT_COUNT

MIN_MONTHS = 60


def regime_from_vix(vix: float) -> Regime:
    """„Klimat rynku” z poziomu indeksu strachu VIX. Progi i mnożniki są PRZYKŁADOWE — ustalcie i uzasadnijcie."""
    if vix < 16:
        return Regime(id="spokojny", label="spokojny rynek", vix=vix, vol_multiplier=1.0)
    if vix < 28:
        return Regime(id="podwyzszony", label="podwyższona zmienność", vix=vix, vol_multiplier=1.15)
    return Regime(id="kryzysowy", label="kryzysowa zmienność", vix=vix, vol_multiplier=1.35)


def estimate_assumptions(
    dates: list[str],
    returns: list[list[float]],
    *,
    as_of: str,
    base: MarketAssumptions = SAMPLE_ASSUMPTIONS,
    shrink: float = 0.5,
    vix: float | None = None,
) -> MarketAssumptions:
    """
    `dates` i `returns` to prawdziwe miesiące (bez wiersza „stanu początkowego”): returns[miesiąc][instrument].
    `shrink` 0 = same dane, 1 = same wartości bazowe (dla oczekiwanych zwrotów).
    Koszty funduszy (TER) i progi skali ryzyka zostają z `base` — to decyzje, nie wynik estymacji.
    """
    data = np.asarray(returns, dtype=float)
    if data.ndim != 2 or data.shape[1] != INSTRUMENT_COUNT or data.shape[0] != len(dates):
        raise ValueError(f"oczekiwano macierzy [miesiące × {INSTRUMENT_COUNT}] pasującej do listy dat")
    if data.shape[0] < MIN_MONTHS:
        raise ValueError(f"za krótka historia: {data.shape[0]} miesięcy (minimum {MIN_MONTHS})")
    if not np.isfinite(data).all():
        raise ValueError("w zwrotach są braki danych (NaN/inf) — uzupełnij je przed estymacją")

    sigma = data.std(axis=0, ddof=1) * np.sqrt(12)
    mu = shrink * np.asarray(base.mu) + (1 - shrink) * data.mean(axis=0) * 12

    with np.errstate(invalid="ignore", divide="ignore"):
        corr = np.corrcoef(data, rowvar=False)
    corr = np.where(
        np.isfinite(corr), corr, np.asarray(base.corr)
    )  # stała seria (np. gotówka) → wartości bazowe
    corr = np.clip((corr + corr.T) / 2, -1.0, 1.0)
    np.fill_diagonal(corr, 1.0)

    present = {d: k for k, d in enumerate(dates)}
    scenarios: list[Scenario] = []
    for scenario in base.scenarios:
        window = next((c for c in CRISIS_PERIODS if c.id == scenario.id), None)
        months = [m for m in present if window and window.from_ <= m <= window.to]
        expected = _months_between(window.from_, window.to) if window else 0
        if window and len(months) == expected:
            rows = data[[present[m] for m in months]]
            measured = (np.prod(1 + rows, axis=0) - 1).tolist()
            scenarios.append(scenario.model_copy(update={"returns": measured}))
        else:  # okno kryzysu nie mieści się w dostępnej historii — zostaje wartość bazowa
            scenarios.append(scenario)

    return MarketAssumptions(
        as_of=as_of,
        mu=mu.tolist(),
        sigma=sigma.tolist(),
        ter=list(base.ter),
        corr=corr.tolist(),
        scenarios=scenarios,
        risk_thresholds=list(base.risk_thresholds),
        regime=regime_from_vix(vix) if vix is not None else base.regime,
    )


def _months_between(start: str, end: str) -> int:
    (y1, m1), (y2, m2) = (tuple(int(x) for x in s.split("-")) for s in (start, end))
    return (y2 - y1) * 12 + (m2 - m1) + 1
