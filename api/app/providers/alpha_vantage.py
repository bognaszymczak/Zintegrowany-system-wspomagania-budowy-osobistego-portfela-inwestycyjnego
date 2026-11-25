"""
Alpha Vantage (https://www.alphavantage.co) — notowania ETF-ów. Darmowy klucz, limit: ok. 25 zapytań dziennie
i 5 na minutę (zmienna ALPHA_VANTAGE_API_KEY w .env). Zapytanie TIME_SERIES_MONTHLY_ADJUSTED zwraca miesięczne
ceny z uwzględnieniem dywidend ("adjusted close") — to właściwa cena do liczenia zwrotów.

Uwaga: przy przekroczeniu limitu API odpowiada kodem 200 i polem "Note"/"Information" zamiast danych —
parse_monthly_adjusted zamienia to na czytelny wyjątek. Pobieranie nie było testowane na żywym API
w środowisku, w którym powstał ten szkielet.
"""

from .base import Observation, ProviderError

API = "https://www.alphavantage.co/query"


def parse_monthly_adjusted(payload: dict) -> list[Observation]:
    series = payload.get("Monthly Adjusted Time Series")
    if not series:
        reason = payload.get("Note") or payload.get("Information") or payload.get("Error Message")
        raise ProviderError(f"Alpha Vantage nie zwrócił danych: {reason or 'pusta odpowiedź'}")
    try:
        return sorted(
            (Observation(date=day, value=float(row["5. adjusted close"])) for day, row in series.items()),
            key=lambda o: o.date,
        )
    except (KeyError, TypeError, ValueError) as error:
        raise ProviderError(f"nieoczekiwany format odpowiedzi Alpha Vantage: {error}") from error


def fetch_monthly_adjusted(symbol: str, api_key: str) -> list[Observation]:
    import httpx

    response = httpx.get(
        API,
        params={"function": "TIME_SERIES_MONTHLY_ADJUSTED", "symbol": symbol, "apikey": api_key},
        timeout=30,
    )
    response.raise_for_status()
    return parse_monthly_adjusted(response.json())
