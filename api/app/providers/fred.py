"""
FRED — baza danych makroekonomicznych Rezerwy Federalnej w St. Louis (https://fred.stlouisfed.org).
Darmowy klucz API: https://fred.stlouisfed.org/docs/api/api_key.html (zmienna FRED_API_KEY w .env).

Przydatne szeregi: VIXCLS (indeks strachu VIX — do „klimatu rynku”), CPIAUCSL (inflacja w USA),
DGS10 i T10Y2Y (rentowność 10-latek i nachylenie krzywej — cechy dla modelu ML).
Pobieranie nie było testowane na żywym API w środowisku, w którym powstał ten szkielet.
"""

from .base import Observation, ProviderError

API = "https://api.stlouisfed.org/fred/series/observations"
VIX = "VIXCLS"


def parse_observations(payload: dict) -> list[Observation]:
    """Odpowiedź: {"observations": [{"date": "2024-01-02", "value": "13.35"}, …]}; brak notowania FRED zapisuje jako kropkę."""
    try:
        return [
            Observation(date=o["date"], value=float(o["value"]))
            for o in payload["observations"]
            if o.get("value") not in (None, "", ".")
        ]
    except (KeyError, TypeError, ValueError) as error:
        raise ProviderError(f"nieoczekiwany format odpowiedzi FRED: {error}") from error


def fetch_series(series_id: str, api_key: str, start: str, end: str) -> list[Observation]:
    import httpx

    response = httpx.get(
        API,
        params={
            "series_id": series_id,
            "api_key": api_key,
            "file_type": "json",
            "observation_start": start,
            "observation_end": end,
        },
        timeout=30,
    )
    response.raise_for_status()
    return parse_observations(response.json())
