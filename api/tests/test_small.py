"""Małe funkcje pomocnicze: błędy API, sprawdzanie wyboru, odczyt udziałów z adresu URL, daty."""

from datetime import UTC, datetime, timedelta, timezone

import pytest

from app.errors import ApiError, field_names
from app.selection import validate_selection
from app.services.dates import add_days, iso_z, month_range, previous_month, today_iso
from app.services.engine import parse_weights

BASE = [18, 15, 5, 20, 10, 15, 17]


class TestApiError:
    def test_body_bez_pol_nie_ma_klucza_fields(self):
        assert ApiError(404, "not_found", "Brak.").body() == {"code": "not_found", "message": "Brak."}

    def test_body_z_polami(self):
        body = ApiError(422, "validation_error", "Źle.", ["email", "password"]).body()
        assert body == {"code": "validation_error", "message": "Źle.", "fields": ["email", "password"]}

    def test_field_names_pomija_czesci_sciezki_bez_nazwy_pola_i_porzadkuje(self):
        errors = [
            {"loc": ("body", "quiz", "q1")},
            {"loc": ("body", "goal")},
            {"loc": ("query", "level")},
            {"loc": ("body",)},  # błąd całego ciała żądania — nie ma nazwy pola
            {"loc": ("body", "goal")},  # powtórzenie
        ]
        assert field_names(errors) == ["goal", "level", "quiz.q1"]


class TestValidateSelection:
    GOOD = {"stored_level": 3, "level": 3, "proposal_id": "L3-rownowaga", "weights": BASE}

    def test_dobry_wybor_zwraca_propozycje(self):
        proposal = validate_selection(**self.GOOD)
        assert (proposal.id, proposal.level, proposal.name) == ("L3-rownowaga", 3, "Równowaga")

    def test_przesuniecie_o_jeden_poziom_jest_dozwolone(self):
        patch = {"level": 4, "proposal_id": "L4-wzrost"}
        assert validate_selection(**{**self.GOOD, **patch}).id == "L4-wzrost"

    @pytest.mark.parametrize(
        ("patch", "fields"),
        [
            ({"level": 5, "proposal_id": "L5-rownowaga"}, ["level"]),
            ({"proposal_id": "L4-rownowaga"}, ["proposalId"]),
            ({"proposal_id": "cokolwiek"}, ["proposalId"]),
            ({"weights": [50, 50]}, ["weights"]),
            ({"weights": [18, 15, 5, 20, 10, 15, 18]}, ["weights"]),
            ({"weights": [-5, 38, 5, 20, 10, 15, 17]}, ["weights"]),
            ({"level": 1, "proposal_id": "zle", "weights": []}, ["level", "proposalId", "weights"]),
        ],
    )
    def test_bledy_wskazuja_pola(self, patch, fields):
        with pytest.raises(ApiError) as error:
            validate_selection(**{**self.GOOD, **patch})
        assert (error.value.status, error.value.code) == (422, "validation_error")
        assert error.value.fields == fields


class TestParseWeights:
    def test_poprawny_wektor(self):
        assert parse_weights("18,15,5,20,10,15,17") == BASE
        assert parse_weights(" 18, 15 ,5,20,10,15,17.0 ") == BASE

    @pytest.mark.parametrize(
        "text",
        [
            "",
            "50,50",
            "a,b,c,d,e,f,g",
            "18,15,5,20,10,15,17.5",
            "nan,15,5,20,10,15,17",
            "-5,38,5,20,10,15,17",
        ],
    )
    def test_niepoprawny_wektor_to_none(self, text):
        assert parse_weights(text) is None


class TestDaty:
    def test_previous_month_i_month_range_przez_granice_roku(self):
        assert previous_month("2008-01") == "2007-12"
        assert previous_month("2008-03") == "2008-02"
        assert month_range("2007-12", "2008-01") == ["2007-12", "2008-01"]
        assert month_range("2008-01", "2007-12") == []

    def test_add_days(self):
        assert add_days("2026-11-03", 7) == "2026-11-10"
        assert add_days("2026-12-28", 7) == "2027-01-04"
        assert add_days("2024-02-28", 2) == "2024-03-01"  # rok przestępny

    def test_iso_z_jak_w_javascripcie(self):
        assert iso_z(datetime(2026, 11, 3, 19, 12, tzinfo=UTC)) == "2026-11-03T19:12:00.000Z"
        assert (
            iso_z(datetime(2026, 11, 3, 19, 12)) == "2026-11-03T19:12:00.000Z"
        )  # bez strefy = UTC (tak oddaje SQLite)
        plus_one = timezone(timedelta(hours=1))
        assert iso_z(datetime(2026, 11, 3, 20, 12, 5, 123000, tzinfo=plus_one)) == "2026-11-03T19:12:05.123Z"

    def test_today_iso_liczy_w_utc(self):
        late_in_new_york = datetime(2026, 11, 3, 23, 30, tzinfo=timezone(timedelta(hours=-5)))
        assert today_iso(late_in_new_york) == "2026-11-04"
        assert today_iso(datetime(2026, 11, 3, 0, 0)) == "2026-11-03"
