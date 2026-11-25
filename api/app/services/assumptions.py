"""
Założenia rynkowe, na których liczy silnik: oczekiwane stopy zwrotu, wahania, korelacje, koszty funduszy,
scenariusze kryzysowe i „klimat rynku”.

W WERSJI DEMO są to wartości przykładowe (SAMPLE_ASSUMPTIONS) — te same co w
web/src/domain/portfolio/assumptions.ts. W WERSJI PRODUKCYJNEJ liczy je zadanie nocne
(app/jobs/ingest.py → services/estimation.py) z historii zapisanej w bazie i zapisuje jako „zdjęcie”
w tabeli assumptions_snapshots; endpoint GET /api/market/assumptions oddaje najnowsze.
Silnik nie zmienia się wcale: dostaje po prostu inny obiekt MarketAssumptions.
"""

from datetime import datetime

from ..schemas import MarketAssumptions, Regime, Scenario
from .dates import today_iso

#        świat   USA     EM      obl.sk. obl.kor. złoto   gotówka
SAMPLE_ASSUMPTIONS = MarketAssumptions(
    as_of="2026-11-03",
    mu=[0.068, 0.076, 0.082, 0.033, 0.041, 0.046, 0.026],
    sigma=[0.155, 0.17, 0.21, 0.06, 0.07, 0.15, 0.007],
    ter=[0.002, 0.0007, 0.0018, 0.001, 0.0015, 0.0015, 0.0007],
    corr=[
        [1, 0.95, 0.85, 0.05, 0.55, 0.1, 0],
        [0.95, 1, 0.78, 0, 0.55, 0.08, 0],
        [0.85, 0.78, 1, 0.1, 0.5, 0.15, 0],
        [0.05, 0, 0.1, 1, 0.7, 0.25, 0.1],
        [0.55, 0.55, 0.5, 0.7, 1, 0.2, 0.05],
        [0.1, 0.08, 0.15, 0.25, 0.2, 1, 0],
        [0, 0, 0, 0.1, 0.05, 0, 1],
    ],
    scenarios=[
        Scenario(
            id="y2008",
            period="2008 · cały rok",
            name="Kryzys finansowy",
            returns=[-0.4, -0.37, -0.53, 0.08, -0.05, 0.05, 0.02],
        ),
        Scenario(
            id="y2020",
            period="2020 · luty–marzec",
            name="Pandemia COVID-19",
            returns=[-0.34, -0.34, -0.31, 0.03, -0.06, -0.01, 0],
        ),
        Scenario(
            id="y2022",
            period="2022 · cały rok",
            name="Inflacja i podwyżki stóp",
            returns=[-0.18, -0.18, -0.2, -0.15, -0.15, 0, 0.015],
        ),
    ],
    risk_thresholds=[0.02, 0.06, 0.08, 0.11, 0.15, 0.2],
    regime=Regime(id="podwyzszony", label="podwyższona zmienność", vix=22, vol_multiplier=1.15),
)


def assumptions_at(now: datetime | None = None) -> MarketAssumptions:
    """Parametry rynkowe „z dzisiejszą datą” — tryb demo, gdy w bazie nie ma jeszcze danych."""
    return SAMPLE_ASSUMPTIONS.model_copy(update={"as_of": today_iso(now)})
