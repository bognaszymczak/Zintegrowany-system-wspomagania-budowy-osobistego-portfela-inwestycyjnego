"""
NBP — Narodowy Bank Polski (https://api.nbp.pl). Darmowe, bez klucza.
Używamy kursu USD/PLN (do przeliczenia zwrotów ETF-ów z dolarów na złote) i ceny złota.

Format odpowiedzi zgodny z dokumentacją NBP (api.nbp.pl). Pobieranie nie było testowane na żywym API
w środowisku, w którym powstał ten szkielet — funkcje parse_* są sprawdzone na przykładowych odpowiedziach.
"""

from datetime import date, timedelta

from .base import Observation, ProviderError

API = "https://api.nbp.pl/api"


def parse_exchange_rates(payload: dict) -> list[Observation]:
    """Odpowiedź /exchangerates/rates/a/usd/…: {"rates": [{"effectiveDate": "2024-01-02", "mid": 3.9432}, …]}."""
    try:
        return [Observation(date=r["effectiveDate"], value=float(r["mid"])) for r in payload["rates"]]
    except (KeyError, TypeError, ValueError) as error:
        raise ProviderError(f"nieoczekiwany format odpowiedzi NBP: {error}") from error


def parse_gold_prices(payload: list[dict]) -> list[Observation]:
    """Odpowiedź /cenyzlota/…: [{"data": "2024-01-02", "cena": 263.47}, …] (cena 1 g złota w zł)."""
    try:
        return [Observation(date=r["data"], value=float(r["cena"])) for r in payload]
    except (KeyError, TypeError, ValueError) as error:
        raise ProviderError(f"nieoczekiwany format odpowiedzi NBP: {error}") from error


def year_chunks(start: str, end: str, max_days: int = 360) -> list[tuple[str, str]]:
    """NBP ogranicza jedno zapytanie do 367 dni, więc dłuższy zakres dzielimy na kawałki."""
    chunks: list[tuple[str, str]] = []
    cursor, last = date.fromisoformat(start), date.fromisoformat(end)
    while cursor <= last:
        stop = min(cursor + timedelta(days=max_days - 1), last)
        chunks.append((cursor.isoformat(), stop.isoformat()))
        cursor = stop + timedelta(days=1)
    return chunks


def fetch_usdpln(start: str, end: str) -> list[Observation]:
    import httpx  # import tutaj, żeby sama obecność tego pliku nie wymagała httpx

    observations: list[Observation] = []
    for chunk_start, chunk_end in year_chunks(start, end):
        response = httpx.get(
            f"{API}/exchangerates/rates/a/usd/{chunk_start}/{chunk_end}/",
            params={"format": "json"},
            timeout=30,
        )
        if response.status_code == 404:  # NBP odpowiada 404, gdy w zakresie nie ma notowań (np. same święta)
            continue
        response.raise_for_status()
        observations.extend(parse_exchange_rates(response.json()))
    return observations
