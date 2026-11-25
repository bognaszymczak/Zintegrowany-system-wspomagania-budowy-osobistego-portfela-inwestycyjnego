"""Wspólne typy i czyste funkcje dla źródeł danych: obserwacje, zwroty miesięczne, przeliczenie na złote."""

from dataclasses import dataclass

from ..services.dates import previous_month


@dataclass(frozen=True)
class Observation:
    date: str  # RRRR-MM-DD
    value: float


class ProviderError(RuntimeError):
    """Źródło odmówiło lub zwróciło odpowiedź, której nie umiemy odczytać (np. limit darmowego planu)."""


def month_end_values(observations: list[Observation]) -> dict[str, float]:
    """Ostatnia obserwacja w każdym miesiącu: {"2024-03": 5254.35, …}. Działa dla danych dziennych i miesięcznych."""
    last: dict[str, Observation] = {}
    for observation in sorted(observations, key=lambda o: o.date):
        last[observation.date[:7]] = observation
    return {month: o.value for month, o in last.items()}


def monthly_returns(closes: dict[str, float]) -> dict[str, float]:
    """
    Zwroty proste z cen na koniec miesiąca: {"2024-03": 0.012, …}.
    Pierwszy miesiąc nie ma zwrotu (brak poprzedniego), a miesiąc po luce w danych jest pomijany —
    liczymy tylko zwroty między sąsiednimi miesiącami.
    """
    result: dict[str, float] = {}
    for month, close in closes.items():
        previous = closes.get(previous_month(month))
        if previous:
            result[month] = close / previous - 1
    return dict(sorted(result.items()))


def only_complete_months(values: dict[str, float], today: str) -> dict[str, float]:
    """
    Odrzuca bieżący miesiąc (`today` to RRRR-MM-DD): jego notowania są jeszcze niepełne, więc zwrot byłby
    cząstkowy i przy następnym pobraniu zmieniłby się. Do bazy trafiają tylko zamknięte miesiące.
    """
    current = today[:7]
    return {month: value for month, value in values.items() if month < current}


def convert_returns_to_pln(usd_returns: dict[str, float], usdpln: dict[str, float]) -> dict[str, float]:
    """
    Zwrot w złotych = (1 + zwrot w USD) × (kurs USD/PLN na koniec miesiąca / kurs na koniec poprzedniego) − 1.
    Miesiące bez kursu (swojego lub poprzedniego) są pomijane.
    """
    result: dict[str, float] = {}
    for month, usd_return in usd_returns.items():
        now, before = usdpln.get(month), usdpln.get(previous_month(month))
        if now and before:
            result[month] = (1 + usd_return) * now / before - 1
    return result
