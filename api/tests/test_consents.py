"""Obowiązkowe oświadczenia przy zakładaniu konta — w tym ukończone 18 lat (czysta logika, bez serwera)."""

import pytest
from pydantic import ValidationError

from app.errors import ApiError
from app.schemas import RegisterRequest
from app.services.consents import ADULT_REQUIRED_MESSAGE, ensure_required_consents

VALID = {
    "name": "Anna",
    "email": "anna@example.pl",
    "password": "dobre-haslo-123",
    "adultConfirmed": True,
    "acceptTerms": True,
    "acceptSimulation": True,
    "marketingOptIn": False,
}


def request(**patch) -> RegisterRequest:
    return RegisterRequest.model_validate({**VALID, **patch})


def error_of(body: RegisterRequest) -> ApiError:
    with pytest.raises(ApiError) as caught:
        ensure_required_consents(body)
    return caught.value


class TestPelnoletnosc:
    def test_z_oswiadczeniami_nic_sie_nie_dzieje(self):
        ensure_required_consents(request())

    def test_odznaczone_oswiadczenie_o_18_latach_to_422_z_kodem_i_polem(self):
        error = error_of(request(adultConfirmed=False))
        assert error.status == 422
        assert error.code == "adult_required"
        assert error.fields == ["adultConfirmed"]
        assert error.message == ADULT_REQUIRED_MESSAGE
        assert "18 lat" in error.message

    def test_pelnoletnosc_jest_sprawdzana_pierwsza(self):
        error = error_of(request(adultConfirmed=False, acceptTerms=False, acceptSimulation=False))
        assert error.code == "adult_required"

    def test_pozostale_zgody_dalej_sa_wymagane(self):
        for patch in ({"acceptTerms": False}, {"acceptSimulation": False}):
            error = error_of(request(**patch))
            assert error.code == "consent_required"
            assert error.fields == ["acceptTerms", "acceptSimulation"]

    def test_zgoda_marketingowa_jest_dobrowolna(self):
        ensure_required_consents(request(marketingOptIn=False))
        ensure_required_consents(request(marketingOptIn=True))


class TestKsztaltZadania:
    def test_pole_jest_wymagane_a_w_json_nazywa_sie_adultConfirmed(self):
        without = {key: value for key, value in VALID.items() if key != "adultConfirmed"}
        with pytest.raises(ValidationError) as caught:
            RegisterRequest.model_validate(without)
        assert [error["loc"] for error in caught.value.errors()] == [("adultConfirmed",)]

    def test_pole_widac_w_kontrakcie_openapi(self):
        assert "adultConfirmed" in RegisterRequest.model_json_schema(by_alias=True)["properties"]
        assert "adultConfirmed" in RegisterRequest.model_json_schema(by_alias=True)["required"]
