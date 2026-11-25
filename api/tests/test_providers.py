"""
Źródła danych rynkowych: odczyt odpowiedzi zewnętrznych API i rachunki na szeregach czasowych.

Odpowiedzi poniżej mają taki kształt, jaki opisują dokumentacje NBP, FRED i Alpha Vantage. Same zapytania HTTP
(funkcje fetch_*) nie są tu uruchamiane — wymagają sieci i kluczy; patrz uwaga w app/jobs/ingest.py.
"""

from datetime import date

import pytest

from app.providers.alpha_vantage import parse_monthly_adjusted
from app.providers.base import (
    Observation,
    ProviderError,
    convert_returns_to_pln,
    month_end_values,
    monthly_returns,
    only_complete_months,
)
from app.providers.fred import parse_observations
from app.providers.nbp import parse_exchange_rates, parse_gold_prices, year_chunks


class TestNbp:
    def test_kurs_usd(self):
        payload = {
            "table": "A",
            "currency": "dolar amerykański",
            "code": "USD",
            "rates": [
                {"no": "001/A/NBP/2024", "effectiveDate": "2024-01-02", "mid": 3.9432},
                {"no": "002/A/NBP/2024", "effectiveDate": "2024-01-03", "mid": 3.9876},
            ],
        }
        assert parse_exchange_rates(payload) == [
            Observation("2024-01-02", 3.9432),
            Observation("2024-01-03", 3.9876),
        ]

    def test_cena_zlota(self):
        payload = [{"data": "2024-01-02", "cena": 263.47}, {"data": "2024-01-03", "cena": 264.1}]
        assert parse_gold_prices(payload) == [
            Observation("2024-01-02", 263.47),
            Observation("2024-01-03", 264.1),
        ]

    def test_zly_format_to_czytelny_blad(self):
        with pytest.raises(ProviderError, match="NBP"):
            parse_exchange_rates({"rates": [{"effectiveDate": "2024-01-02"}]})
        with pytest.raises(ProviderError, match="NBP"):
            parse_exchange_rates({"komunikat": "brak"})
        with pytest.raises(ProviderError, match="NBP"):
            parse_gold_prices([{"data": "2024-01-02", "cena": "abc"}])

    def test_year_chunks_pokrywa_zakres_bez_luk_i_zakladek(self):
        chunks = year_chunks("2007-11-01", "2024-03-15")
        assert chunks[0][0] == "2007-11-01" and chunks[-1][1] == "2024-03-15"
        for (_start, end), (next_start, _end) in zip(chunks, chunks[1:], strict=False):
            assert (date.fromisoformat(next_start) - date.fromisoformat(end)).days == 1
        for start, end in chunks:
            assert (date.fromisoformat(end) - date.fromisoformat(start)).days + 1 <= 360

    def test_year_chunks_przypadki_brzegowe(self):
        assert year_chunks("2024-01-01", "2024-01-01") == [("2024-01-01", "2024-01-01")]
        assert year_chunks("2024-02-01", "2024-01-01") == []
        # rok przestępny ma 366 dni, więc przy limicie 360 dni potrzeba dwóch zapytań
        assert year_chunks("2024-01-01", "2024-12-31") == [
            ("2024-01-01", "2024-12-25"),
            ("2024-12-26", "2024-12-31"),
        ]


class TestFred:
    def test_brak_notowania_to_kropka_i_jest_pomijany(self):
        payload = {
            "observations": [
                {
                    "realtime_start": "2026-11-03",
                    "realtime_end": "2026-11-03",
                    "date": "2024-01-02",
                    "value": "13.35",
                },
                {"date": "2024-01-03", "value": "."},
                {"date": "2024-01-04", "value": "13.2"},
            ]
        }
        assert parse_observations(payload) == [
            Observation("2024-01-02", 13.35),
            Observation("2024-01-04", 13.2),
        ]

    def test_zly_format(self):
        with pytest.raises(ProviderError, match="FRED"):
            parse_observations({"error_message": "Bad Request. The series does not exist."})
        with pytest.raises(ProviderError, match="FRED"):
            parse_observations({"observations": [{"date": "2024-01-02", "value": "abc"}]})


class TestAlphaVantage:
    @staticmethod
    def row(price: str) -> dict:
        return {"1. open": "1", "2. high": "1", "3. low": "1", "4. close": "1", "5. adjusted close": price}

    def test_ceny_skorygowane_o_dywidendy_posortowane_rosnaco(self):
        payload = {
            "Meta Data": {"2. Symbol": "SPY"},
            "Monthly Adjusted Time Series": {
                "2024-02-29": self.row("507.9200"),
                "2024-01-31": self.row("482.8800"),
            },
        }
        assert parse_monthly_adjusted(payload) == [
            Observation("2024-01-31", 482.88),
            Observation("2024-02-29", 507.92),
        ]

    @pytest.mark.parametrize(
        ("payload", "fragment"),
        [
            ({"Note": "Our standard API call frequency is 5 calls per minute."}, "5 calls per minute"),
            ({"Information": "The demo API key is for demo purposes only."}, "demo API key"),
            ({"Error Message": "Invalid API call."}, "Invalid API call"),
            ({}, "pusta odpowiedź"),
        ],
    )
    def test_limit_lub_blad_zrodla_to_czytelny_wyjatek(self, payload, fragment):
        with pytest.raises(ProviderError, match="Alpha Vantage") as error:
            parse_monthly_adjusted(payload)
        assert fragment in str(error.value)

    def test_wiersz_bez_ceny_skorygowanej(self):
        with pytest.raises(ProviderError, match="format"):
            parse_monthly_adjusted({"Monthly Adjusted Time Series": {"2024-01-31": {"4. close": "1"}}})


class TestSzeregiCzasowe:
    def test_month_end_values_bierze_ostatnia_obserwacje_miesiaca(self):
        daily = [
            Observation("2024-02-01", 5.0),
            Observation("2024-01-31", 3.0),
            Observation("2024-01-02", 1.0),  # nie po kolei — funkcja sama sortuje
            Observation("2024-02-29", 6.0),
        ]
        assert month_end_values(daily) == {"2024-01": 3.0, "2024-02": 6.0}

    def test_month_end_values_dla_danych_miesiecznych_i_pustych(self):
        assert month_end_values([Observation("2024-03-28", 7.0)]) == {"2024-03": 7.0}
        assert month_end_values([]) == {}

    def test_monthly_returns(self):
        result = monthly_returns({"2024-01": 100.0, "2024-02": 110.0, "2024-03": 99.0})
        assert list(result) == ["2024-02", "2024-03"]  # pierwszy miesiąc nie ma poprzedniego
        assert result["2024-02"] == pytest.approx(0.10)
        assert result["2024-03"] == pytest.approx(-0.10)

    def test_monthly_returns_pomija_miesiac_po_luce_i_dzielenie_przez_zero(self):
        assert monthly_returns({"2024-01": 100.0, "2024-03": 110.0}) == {}  # brak lutego
        assert monthly_returns({"2024-01": 0.0, "2024-02": 5.0}) == {}
        assert list(monthly_returns({"2023-12": 100.0, "2024-01": 101.0})) == [
            "2024-01"
        ]  # przez granicę roku

    def test_przeliczenie_zwrotu_z_dolarow_na_zlote(self):
        usdpln = {"2024-01": 4.0, "2024-02": 4.2}
        result = convert_returns_to_pln({"2024-02": 0.10}, usdpln)
        assert result["2024-02"] == pytest.approx(1.10 * 4.2 / 4.0 - 1)  # 15,5% w złotych
        # kurs stoi w miejscu → zwrot bez zmian; bez kursu miesiąc jest pomijany
        assert convert_returns_to_pln({"2024-02": 0.10}, {"2024-01": 4.0, "2024-02": 4.0})[
            "2024-02"
        ] == pytest.approx(0.10)
        assert convert_returns_to_pln({"2024-03": 0.10}, usdpln) == {}
        assert convert_returns_to_pln({"2024-02": 0.10}, {"2024-02": 4.2}) == {}

    def test_only_complete_months_odrzuca_biezacy_miesiac(self):
        values = {"2026-09": 1.0, "2026-10": 2.0, "2026-11": 3.0}
        assert only_complete_months(values, "2026-11-03") == {"2026-09": 1.0, "2026-10": 2.0}
        assert only_complete_months({"2026-12": 1.0, "2027-01": 2.0}, "2027-01-05") == {"2026-12": 1.0}
        assert only_complete_months({}, "2026-11-03") == {}
