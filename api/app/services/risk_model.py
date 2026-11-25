"""
MODEL OCENY RYZYKA — tu podłączasz uczenie maszynowe.

Cała „ocena ryzyka własnego wyboru” (ekran 8) opiera się na jednym pytaniu do modelu:

    „Jaka jest szansa, że ten portfel straci w ciągu roku więcej niż 10%?”

Resztę (wodospad zmian, udział w ryzyku, kryzysy, zdania podsumowania) liczy services/assessment.py
na podstawie odpowiedzi modelu. Dlatego żeby wpiąć prawdziwy model, wystarczy napisać klasę z metodą
`loss_probability` i polami opisującymi model (kind, name, version…) — i zwrócić ją z `get_risk_model()`.
Front pokazuje użytkownikowi, z czym ma do czynienia (pole `model.kind`: „demo-analytic” albo „ml”).

W WERSJI DEMO działa `DemoAnalyticModel`: rozkład t-Studenta (grube ogony) + korekta „klimatu rynku”
(mnożnik wahań, gdy rynek jest niespokojny). To model analityczny, NIE uczenie maszynowe — ekran mówi to wprost.

SZKIC MODELU PRODUKCYJNEGO (do zrobienia w pracy):
  1. Dane: miesięczne zwroty 7 instrumentów + VIX + nachylenie krzywej rentowności (tabele w db/models.py).
  2. Cecha → etykieta: dla każdego miesiąca historycznego i losowych portfeli liczymy cechy
     (σ portfela, μ, udział akcji, VIX, zmiana VIX, średnia zmienność z 3 miesięcy…) oraz etykietę
     „czy w następnych 12 miesiącach portfel stracił >10%”.
  3. Uczenie: np. sklearn.ensemble.HistGradientBoostingClassifier + kalibracja prawdopodobieństw
     (CalibratedClassifierCV). Walidacja czasowa (TimeSeriesSplit), nie losowa — inaczej wyniki są zawyżone.
  4. Zapis: joblib.dump(model, "models/risk_v1.joblib"); ścieżkę podajesz w .env jako RISK_MODEL_PATH.
  5. `MlRiskModel.loss_probability` wczytuje plik raz, składa wektor cech i zwraca predict_proba(...)[0, 1].
"""

import math
from dataclasses import dataclass
from typing import Literal, Protocol

from ..schemas import MarketAssumptions
from .assumptions import SAMPLE_ASSUMPTIONS
from .engine import Weights, portfolio_stats, student_t5_cdf

# „Duża strata” = spadek wartości o ponad 10% w ciągu roku.
LOSS_THRESHOLD = -0.1


class RiskModel(Protocol):
    """Wszystko, czego ocena ryzyka wymaga od modelu."""

    kind: Literal["demo-analytic", "ml"]
    name: str
    version: str
    # okres danych, na których model się uczył (pokazywany użytkownikowi)
    trained_on: str
    reliability: Literal["niska", "srednia", "wysoka"]
    reliability_note: str

    def loss_probability(
        self, weights: Weights, a: MarketAssumptions, vol_multiplier: float | None = None
    ) -> float:
        """Szansa (0–1) na stratę większą niż LOSS_THRESHOLD w ciągu roku.

        `vol_multiplier=None` → użyj bieżącego klimatu rynku z `a.regime`;
        `vol_multiplier=1` → ocena „bez korekty klimatu” (do porównania na ekranie).
        """
        ...


@dataclass(frozen=True)
class DemoAnalyticModel:
    kind: Literal["demo-analytic", "ml"] = "demo-analytic"
    name: str = "rozkład t-Studenta z korektą klimatu rynku"
    version: str = "demo-1"
    trained_on: str = "dane przykładowe"
    reliability: Literal["niska", "srednia", "wysoka"] = "srednia"
    reliability_note: str = (
        "W danych jest niewiele prawdziwych kryzysów, więc ocena skrajnych strat jest mniej pewna "
        "niż ocena zwykłych wahań."
    )

    def loss_probability(
        self, weights: Weights, a: MarketAssumptions, vol_multiplier: float | None = None
    ) -> float:
        multiplier = a.regime.vol_multiplier if vol_multiplier is None else vol_multiplier
        st = portfolio_stats(weights, a)
        # standaryzowany t(5) ma wariancję 5/3, więc skalujemy, by wahania portfela były zachowane
        x = ((LOSS_THRESHOLD - st.mu) / (st.sigma * multiplier)) * math.sqrt(5 / 3)
        return student_t5_cdf(x)


DEFAULT_MODEL = DemoAnalyticModel()


def get_risk_model(model_path: str | None = None) -> RiskModel:
    """Zwraca model do użycia przez API. Bez ścieżki w konfiguracji — model zastępczy (demo)."""
    if not model_path:
        return DEFAULT_MODEL
    raise NotImplementedError(
        f"RISK_MODEL_PATH={model_path!r}: nie ma jeszcze wczytywania prawdziwego modelu. "
        "Napisz klasę MlRiskModel (patrz opis na górze tego pliku) i zwróć ją tutaj."
    )


def loss_probability(
    weights: Weights,
    a: MarketAssumptions = SAMPLE_ASSUMPTIONS,
    vol_multiplier: float | None = None,
    model: RiskModel = DEFAULT_MODEL,
) -> float:
    """Skrót: szansa (0–1) na dużą stratę według wskazanego modelu."""
    return model.loss_probability(weights, a, vol_multiplier)
