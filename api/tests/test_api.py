"""
Testy całego API przez HTTP, z prawdziwą (tymczasową) bazą SQLite:
rejestracja → logowanie → formularz → propozycje → ocena ryzyka → zapis wyboru → dane rynkowe.

WAŻNE: te testy wymagają bibliotek z requirements.txt (fastapi, sqlalchemy, httpx). Bez nich pytest pomija
cały plik. Szkielet powstał w środowisku bez dostępu do PyPI, więc tego pliku NIE uruchamiano — to pierwsza
rzecz do sprawdzenia po instalacji bibliotek:

    cd api
    pip install -r requirements.txt
    pytest tests/test_api.py -v

Jeśli któryś test padnie, to najpewniej wskazuje prawdziwy błąd w warstwie HTTP/bazy (albo literówkę w teście) —
komunikat pytest pokaże, w którym kroku. Logika obliczeń jest sprawdzona osobno (test_engine.py, test_responses.py).
"""

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("sqlalchemy")
pytest.importorskip("httpx")

from fastapi.testclient import TestClient
from sqlalchemy import select

from app import repository
from app.config import Settings, get_settings
from app.db.models import AssumptionsSnapshot, Choice, MonthlyReturn, Profile, User, UserSession
from app.db.session import get_engine, get_sessionmaker, init_db
from app.deps import SESSION_COOKIE
from app.jobs.ingest import DEMO_EMAIL, DEMO_PASSWORD, seed_demo
from app.main import create_app
from app.services.assumptions import SAMPLE_ASSUMPTIONS
from app.services.backtest import simulate_backtest
from app.services.dates import add_days, today_iso
from app.services.demo_history import generate_demo_history
from app.services.instruments import INSTRUMENT_IDS

BASE = [18, 15, 5, 20, 10, 15, 17]
START = [20, 20, 6, 18, 8, 15, 13]
ACCOUNT = {
    "name": "Anna",
    "email": "anna@example.pl",
    "password": "dobre-haslo-123",
    "adultConfirmed": True,
    "acceptTerms": True,
    "acceptSimulation": True,
    "marketingOptIn": False,
}


# ---------------------------------------------------------------------------------------------
# Przygotowanie: aplikacja z czystą bazą w pliku tymczasowym
# ---------------------------------------------------------------------------------------------


@pytest.fixture()
def make_app(tmp_path, monkeypatch):
    """Fabryka aplikacji: każdy test dostaje własną, pustą bazę i może podać własne ustawienia (zmienne env)."""
    built: list[bool] = []

    def reset() -> None:
        for cached in (get_settings, get_engine, get_sessionmaker):
            cached.cache_clear()

    def build(**env: str):
        settings = {
            "APP_ENV": "test",
            "DATABASE_URL": f"sqlite:///{tmp_path / 'test.db'}",
            "ALLOW_DEMO_DATA": "true",
            "COOKIE_SECURE": "false",
            "RISK_MODEL_PATH": "",
            "CORS_ORIGINS": "http://localhost:5173",
            **env,
        }
        for key, value in settings.items():
            monkeypatch.setenv(key, value)
        reset()
        init_db()
        built.append(True)
        return create_app()

    yield build
    if built:
        get_engine().dispose()
    reset()


@pytest.fixture()
def client(make_app):
    return TestClient(make_app())


def another_browser(client: TestClient) -> TestClient:
    """Ta sama aplikacja i baza, ale osobne ciasteczka — czyli inny użytkownik albo gość."""
    return TestClient(client.app)


def register(client: TestClient, **patch):
    return client.post("/api/auth/register", json={**ACCOUNT, **patch})


def sign_up_and_submit_profile(client: TestClient, answers: dict, **account) -> dict:
    assert register(client, **account).status_code == 201
    response = client.post("/api/profile", json=answers)
    assert response.status_code == 200, response.text
    return response.json()


def selection(profile_id: str, **patch) -> dict:
    return {"profileId": profile_id, "level": 3, "proposalId": "L3-rownowaga", "weights": START, **patch}


# ---------------------------------------------------------------------------------------------
# Serwis
# ---------------------------------------------------------------------------------------------


class TestSerwis:
    def test_health(self, client):
        assert client.get("/api/health").json() == {"status": "ok"}

    def test_dokumentacja_tylko_w_trybie_dev(self, client, make_app):
        assert client.get("/docs").status_code == 404
        assert client.get("/openapi.json").status_code == 404

        dev = TestClient(make_app(APP_ENV="dev"))
        assert dev.get("/docs").status_code == 200
        spec = dev.get("/openapi.json")
        assert (
            spec.status_code == 200
        )  # samo wygenerowanie opisu sprawdza, że wszystkie modele odpowiedzi są poprawne
        assert {"/api/profile", "/api/proposals", "/api/risk-assessment", "/api/choices"} <= set(
            spec.json()["paths"]
        )

    def test_cors_wpuszcza_tylko_adres_frontu(self, client):
        preflight = {
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        }
        allowed = client.options("/api/profile", headers={"Origin": "http://localhost:5173", **preflight})
        assert allowed.status_code == 200
        assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
        assert allowed.headers["access-control-allow-credentials"] == "true"
        denied = client.options(
            "/api/profile", headers={"Origin": "https://obca-strona.example", **preflight}
        )
        assert "access-control-allow-origin" not in denied.headers

    def test_nieoczekiwany_blad_ma_ten_sam_ksztalt_co_pozostale(self, make_app):
        app = make_app()

        @app.get("/api/boom")
        def boom():
            raise RuntimeError("test")

        response = TestClient(app, raise_server_exceptions=False).get("/api/boom")
        assert response.status_code == 500
        assert response.json()["code"] == "server_error"
        assert "RuntimeError" not in response.text  # szczegółów błędu nie pokazujemy użytkownikowi


# ---------------------------------------------------------------------------------------------
# Konto
# ---------------------------------------------------------------------------------------------


class TestKonto:
    def test_rejestracja_zaklada_konto_i_loguje(self, client):
        response = register(client, email="  Anna@Example.PL ")
        assert response.status_code == 201
        user = response.json()["user"]
        assert user["email"] == "anna@example.pl"  # adres jest normalizowany
        assert user["name"] == "Anna" and user["id"]
        assert "password" not in response.text

        cookie = response.headers["set-cookie"].lower()
        assert f"{SESSION_COOKIE}=" in cookie and "httponly" in cookie and "samesite=lax" in cookie

        me = client.get("/api/auth/me")
        assert me.status_code == 200 and me.json()["user"]["email"] == "anna@example.pl"

    def test_w_bazie_nie_ma_hasla_ani_tokenu_sesji(self, client):
        register(client)
        token = client.cookies.get(SESSION_COOKIE)
        with get_sessionmaker()() as db:
            user, session = db.scalar(select(User)), db.scalar(select(UserSession))
        assert user.password_hash.startswith("scrypt$") and ACCOUNT["password"] not in user.password_hash
        assert user.accepted_terms_at is not None
        assert session.token_hash != token and len(session.token_hash) == 64

    def test_ten_sam_adres_nie_zalozy_drugiego_konta(self, client):
        register(client)
        for email in ("anna@example.pl", "ANNA@example.pl"):
            response = register(another_browser(client), email=email)
            assert response.status_code == 409
            assert response.json()["code"] == "email_taken"

    def test_niepoprawne_dane_rejestracji(self, client):
        weak = register(client, password="krotkie")
        assert weak.status_code == 422 and weak.json()["code"] == "validation_error"
        assert "password" in weak.json()["fields"]

        bad_email = register(client, email="to-nie-jest-adres")
        assert bad_email.status_code == 422 and bad_email.json()["fields"] == ["email"]

        no_consent = register(client, acceptTerms=False)
        assert no_consent.status_code == 422 and no_consent.json()["code"] == "consent_required"
        assert no_consent.json()["fields"] == ["acceptTerms", "acceptSimulation"]

        empty = client.post("/api/auth/register", json={})
        assert empty.status_code == 422
        assert empty.json()["fields"] == [
            "acceptSimulation",
            "acceptTerms",
            "adultConfirmed",
            "email",
            "password",
        ]

        with get_sessionmaker()() as db:
            assert db.scalar(select(User)) is None  # żadna z prób nie zostawiła konta

    def test_konto_tylko_dla_pelnoletnich(self, client):
        # odznaczone oświadczenie → 422 z własnym kodem i wskazanym polem, konto nie powstaje
        minor = register(client, adultConfirmed=False)
        assert minor.status_code == 422
        assert minor.json()["code"] == "adult_required"
        assert minor.json()["fields"] == ["adultConfirmed"]
        assert "18 lat" in minor.json()["message"]

        # starszy front, który w ogóle nie zna tego pola, też nie założy konta (brak pola = błąd walidacji)
        body = {key: value for key, value in ACCOUNT.items() if key != "adultConfirmed"}
        legacy = client.post("/api/auth/register", json=body)
        assert legacy.status_code == 422 and legacy.json()["fields"] == ["adultConfirmed"]

        with get_sessionmaker()() as db:
            assert db.scalar(select(User)) is None

        # z oświadczeniem wszystko działa, a data oświadczeń zostaje przy koncie jako dowód
        ok = register(client)
        assert ok.status_code == 201
        with get_sessionmaker()() as db:
            user = db.scalar(select(User))
            assert user is not None and user.accepted_terms_at is not None

    def test_logowanie(self, client):
        register(client)
        guest = another_browser(client)

        wrong = guest.post("/api/auth/login", json={"email": ACCOUNT["email"], "password": "zle-haslo-123"})
        unknown = guest.post(
            "/api/auth/login", json={"email": "nikt@example.pl", "password": "zle-haslo-123"}
        )
        assert wrong.status_code == unknown.status_code == 401
        assert wrong.json() == unknown.json()  # nie zdradzamy, które adresy mają konto
        assert wrong.json()["code"] == "invalid_credentials"
        assert guest.get("/api/auth/me").status_code == 401

        ok = guest.post("/api/auth/login", json={"email": "ANNA@example.pl", "password": ACCOUNT["password"]})
        assert ok.status_code == 200
        assert guest.get("/api/auth/me").json()["user"]["name"] == "Anna"

    def test_wylogowanie_uniewaznia_token_po_stronie_serwera(self, client):
        register(client)
        token = client.cookies.get(SESSION_COOKIE)
        assert client.post("/api/auth/logout").status_code == 204
        assert client.get("/api/auth/me").status_code == 401

        # nawet ktoś, kto zachował stary token, już nic nim nie zrobi
        thief = another_browser(client).get("/api/auth/me", headers={"Cookie": f"{SESSION_COOKIE}={token}"})
        assert thief.status_code == 401 and thief.json()["code"] == "unauthorized"

    def test_wygasla_sesja_nie_loguje(self, client):
        register(client)
        with get_sessionmaker()() as db:
            token = repository.create_session(db, db.scalar(select(User)), days=-1)
        response = another_browser(client).get(
            "/api/auth/me", headers={"Cookie": f"{SESSION_COOKIE}={token}"}
        )
        assert response.status_code == 401

    def test_wylogowanie_bez_sesji_nie_jest_bledem(self, client):
        assert client.post("/api/auth/logout").status_code == 204


# ---------------------------------------------------------------------------------------------
# Formularz wstępny
# ---------------------------------------------------------------------------------------------


class TestFormularz:
    def test_wymaga_logowania(self, client, demo_answers):
        response = client.post("/api/profile", json=demo_answers)
        assert response.status_code == 401 and response.json()["code"] == "unauthorized"

    def test_zapisuje_odpowiedzi_i_zwraca_profil(self, client, demo_answers):
        body = sign_up_and_submit_profile(client, demo_answers)
        assert (body["level"], body["name"]) == (3, "Zrównoważony")
        assert body["scores"] == {"capacity": 4, "tolerance": 3, "horizon": 4}
        assert body["plan"] == {"startPLN": 12_500, "monthlyPLN": 650, "years": 7, "targetPLN": 100_000}
        assert body["limits"]["maxEquity"] == 0.5
        assert body["profileId"] and body["createdAt"].endswith("Z")

        with get_sessionmaker()() as db:
            row = db.get(Profile, body["profileId"])
            owner = db.scalar(select(User))
        assert row.user_id == owner.id and row.level == 3 and row.rules_version
        assert row.answers == demo_answers  # dokładnie to, co wysłał formularz
        assert row.plan["startPLN"] == 12_500

    def test_kolejne_wypelnienie_to_nowy_profil(self, client, demo_answers):
        first = sign_up_and_submit_profile(client, demo_answers)
        second = client.post("/api/profile", json={**demo_answers, "horizon": "do3"}).json()
        assert second["profileId"] != first["profileId"] and second["level"] == 2

    @pytest.mark.parametrize(
        ("patch", "field"),
        [
            ({"goal": "kasyno"}, "goal"),
            ({"acceptableDropPct": 15}, "acceptableDropPct"),
            ({"experience": ["kryptowaluty"]}, "experience"),
            ({"targetAmountPLN": -5}, "targetAmountPLN"),
            ({"displayCurrency": "eur"}, "displayCurrency"),
        ],
    )
    def test_odrzuca_niepoprawne_odpowiedzi(self, client, demo_answers, patch, field):
        register(client)
        response = client.post("/api/profile", json={**demo_answers, **patch})
        assert response.status_code == 422 and response.json()["code"] == "validation_error"
        assert any(name.startswith(field) for name in response.json()["fields"])

    def test_odrzuca_brakujace_pole_i_niepoprawny_quiz(self, client, demo_answers):
        register(client)
        missing = {k: v for k, v in demo_answers.items() if k != "cushion"}
        assert client.post("/api/profile", json=missing).json()["fields"] == ["cushion"]
        bad_quiz = {**demo_answers, "quiz": {"q1": "z", "q2": None, "q3": None}}
        response = client.post("/api/profile", json=bad_quiz)
        assert response.status_code == 422 and any(f.startswith("quiz") for f in response.json()["fields"])
        with get_sessionmaker()() as db:
            assert db.scalar(select(Profile)) is None

    def test_cel_moze_byc_pusty(self, client, demo_answers):
        body = sign_up_and_submit_profile(client, {**demo_answers, "targetAmountPLN": None})
        assert body["plan"]["targetPLN"] is None


# ---------------------------------------------------------------------------------------------
# Propozycje portfeli
# ---------------------------------------------------------------------------------------------


class TestPropozycje:
    def test_trzy_propozycje_dla_zapisanego_profilu(self, client, demo_answers):
        profile = sign_up_and_submit_profile(client, demo_answers)
        response = client.get("/api/proposals", params={"profileId": profile["profileId"], "level": 3})
        assert response.status_code == 200, response.text
        body = response.json()
        assert [p["id"] for p in body["proposals"]] == ["L3-stabilnosc", "L3-rownowaga", "L3-wzrost"]
        assert body["proposals"][1]["weights"] == BASE
        assert all(p["withinLimits"] for p in body["proposals"])
        assert body["plan"]["years"] == 7
        assert body["asOf"] == today_iso() and body["validUntil"] == add_days(body["asOf"], 7)

    def test_poziom_mozna_przesunac_o_jeden(self, client, demo_answers):
        pid = sign_up_and_submit_profile(client, demo_answers)["profileId"]
        for level in (2, 4):
            assert client.get("/api/proposals", params={"profileId": pid, "level": level}).status_code == 200
        for level in (1, 5):
            response = client.get("/api/proposals", params={"profileId": pid, "level": level})
            assert response.status_code == 422 and response.json()["fields"] == ["level"]

    def test_niepoprawne_parametry(self, client, demo_answers):
        pid = sign_up_and_submit_profile(client, demo_answers)["profileId"]
        assert client.get("/api/proposals", params={"profileId": pid, "level": 9}).json()["fields"] == [
            "level"
        ]
        assert client.get("/api/proposals").json()["fields"] == ["level", "profileId"]

    def test_wymaga_logowania(self, client):
        assert client.get("/api/proposals", params={"profileId": "x", "level": 3}).status_code == 401

    def test_cudzy_i_nieistniejacy_profil_wygladaja_tak_samo(self, client, demo_answers):
        pid = sign_up_and_submit_profile(client, demo_answers)["profileId"]
        intruder = another_browser(client)
        register(intruder, email="ktos@example.pl")
        foreign = intruder.get("/api/proposals", params={"profileId": pid, "level": 3})
        missing = intruder.get("/api/proposals", params={"profileId": "nie-ma-takiego", "level": 3})
        assert foreign.status_code == missing.status_code == 404
        assert foreign.json() == missing.json()
        assert foreign.json()["code"] == "profile_not_found"

    def test_bez_danych_rynkowych_i_bez_trybu_demo_jest_blad_503(self, make_app, demo_answers):
        client = TestClient(make_app(ALLOW_DEMO_DATA="false"))
        pid = sign_up_and_submit_profile(client, demo_answers)["profileId"]
        response = client.get("/api/proposals", params={"profileId": pid, "level": 3})
        assert response.status_code == 503 and response.json()["code"] == "market_data_missing"


# ---------------------------------------------------------------------------------------------
# Ocena ryzyka
# ---------------------------------------------------------------------------------------------


class TestOcenaRyzyka:
    def test_ocena_przesuniecia_z_propozycji(self, client, demo_answers):
        pid = sign_up_and_submit_profile(client, demo_answers)["profileId"]
        response = client.post("/api/risk-assessment", json=selection(pid))
        assert response.status_code == 200, response.text
        body = response.json()
        assert (body["proposalId"], body["baseName"], body["weights"]) == ("L3-rownowaga", "Równowaga", START)
        assessment = body["assessment"]
        assert (assessment["baseSri"], assessment["sri"]) == (3, 4)
        assert assessment["changed"] is True and assessment["limits"]["ok"] is True
        assert assessment["model"]["kind"] == "demo-analytic"  # ekran uczciwie mówi, że to model zastępczy
        assert body["validUntil"] == add_days(body["asOf"], 7)

    @pytest.mark.parametrize(
        ("patch", "fields"),
        [
            ({"weights": [20, 20, 6, 18, 8, 15, 14]}, ["weights"]),  # suma 101
            ({"weights": [50, 50]}, ["weights"]),  # nie 7 liczb
            ({"proposalId": "L3-nieistnieje"}, ["proposalId"]),
            ({"level": 5, "proposalId": "L5-wzrost"}, ["level"]),
        ],
    )
    def test_niepoprawny_wybor(self, client, demo_answers, patch, fields):
        pid = sign_up_and_submit_profile(client, demo_answers)["profileId"]
        response = client.post("/api/risk-assessment", json=selection(pid, **patch))
        assert response.status_code == 422 and response.json()["fields"] == fields

    def test_wymaga_logowania_i_nie_dziala_na_cudzym_profilu(self, client, demo_answers):
        pid = sign_up_and_submit_profile(client, demo_answers)["profileId"]
        assert another_browser(client).post("/api/risk-assessment", json=selection(pid)).status_code == 401
        intruder = another_browser(client)
        register(intruder, email="ktos@example.pl")
        assert intruder.post("/api/risk-assessment", json=selection(pid)).status_code == 404


# ---------------------------------------------------------------------------------------------
# Zapisany wybór
# ---------------------------------------------------------------------------------------------


class TestWybory:
    def test_zapis_i_usuniecie(self, client, demo_answers):
        pid = sign_up_and_submit_profile(client, demo_answers)["profileId"]
        saved = client.post("/api/choices", json=selection(pid))
        assert saved.status_code == 201, saved.text
        body = saved.json()
        assert (body["profileId"], body["level"], body["proposalId"], body["weights"]) == (
            pid,
            3,
            "L3-rownowaga",
            START,
        )
        assert body["id"] and body["savedAt"].endswith("Z")
        with get_sessionmaker()() as db:
            assert db.get(Choice, body["id"]).weights == START

        assert client.delete(f"/api/choices/{body['id']}").status_code == 204
        again = client.delete(f"/api/choices/{body['id']}")
        assert again.status_code == 404 and again.json()["code"] == "not_found"

    def test_cudzego_wyboru_nie_da_sie_usunac(self, client, demo_answers):
        pid = sign_up_and_submit_profile(client, demo_answers)["profileId"]
        choice_id = client.post("/api/choices", json=selection(pid)).json()["id"]
        intruder = another_browser(client)
        register(intruder, email="ktos@example.pl")
        assert intruder.delete(f"/api/choices/{choice_id}").status_code == 404
        with get_sessionmaker()() as db:
            assert db.get(Choice, choice_id) is not None

    def test_niepoprawny_wybor_nie_jest_zapisywany(self, client, demo_answers):
        pid = sign_up_and_submit_profile(client, demo_answers)["profileId"]
        response = client.post("/api/choices", json=selection(pid, weights=[20, 20, 6, 18, 8, 15, 14]))
        assert response.status_code == 422 and response.json()["fields"] == ["weights"]
        with get_sessionmaker()() as db:
            assert db.scalar(select(Choice)) is None

    def test_wymaga_logowania(self, client):
        assert client.post("/api/choices", json=selection("x")).status_code == 401
        assert client.delete("/api/choices/x").status_code == 401

    def test_usuniecie_konta_usuwa_jego_dane(self, client, demo_answers):
        # sprawdza, że klucze obce w bazie działają (CASCADE) — przyda się przy „usuń moje dane”
        pid = sign_up_and_submit_profile(client, demo_answers)["profileId"]
        client.post("/api/choices", json=selection(pid))
        with get_sessionmaker()() as db:
            db.delete(db.scalar(select(User)))
            db.commit()
            assert db.scalar(select(Profile)) is None
            assert db.scalar(select(Choice)) is None
            assert db.scalar(select(UserSession)) is None


# ---------------------------------------------------------------------------------------------
# Dane rynkowe
# ---------------------------------------------------------------------------------------------


class TestDaneRynkowe:
    def test_zalozenia_w_trybie_demo(self, client):
        response = client.get("/api/market/assumptions")  # publiczne — nie wymaga logowania
        assert response.status_code == 200
        body = response.json()
        assert body["asOf"] == today_iso()
        assert body["mu"] == list(SAMPLE_ASSUMPTIONS.mu) and len(body["corr"]) == 7
        assert {s["id"] for s in body["scenarios"]} == {"y2008", "y2020", "y2022"}

    def test_symulacja_wsteczna_w_trybie_demo_jest_taka_jak_z_generatora(self, client):
        response = client.get("/api/market/backtest", params={"weights": "18,15,5,20,10,15,17"})
        assert response.status_code == 200
        expected = simulate_backtest(BASE, generate_demo_history()).model_dump(by_alias=True)
        assert response.json() == expected
        assert len(expected["dates"]) == 217 and expected["crises"][0]["from"] == "2008-01"

    @pytest.mark.parametrize("weights", ["50,50", "a,b,c,d,e,f,g", "18,15,5,20,10,15,18"])
    def test_symulacja_wsteczna_odrzuca_zle_udzialy(self, client, weights):
        response = client.get("/api/market/backtest", params={"weights": weights})
        assert response.status_code == 422 and response.json()["fields"] == ["weights"]

    def test_bez_danych_i_bez_trybu_demo_jest_blad_503(self, make_app):
        client = TestClient(make_app(ALLOW_DEMO_DATA="false"))
        for url in ("/api/market/assumptions", "/api/market/backtest?weights=18,15,5,20,10,15,17"):
            response = client.get(url)
            assert response.status_code == 503 and response.json()["code"] == "market_data_missing"

    def test_dane_z_bazy_po_wypelnieniu_jej_przykladowa_historia(self, client, demo_answers):
        with get_sessionmaker()() as db:
            seed_demo(db, Settings(app_env="dev"))

        # założenia: dokładnie to „zdjęcie”, które zapisało zadanie ingest
        with get_sessionmaker()() as db:
            snapshot = db.scalar(select(AssumptionsSnapshot))
        assert snapshot.as_of == today_iso()
        assert client.get("/api/market/assumptions").json() == snapshot.payload

        # symulacja: te same liczby co z generatora (baza dostała jego kopię)…
        url, params = "/api/market/backtest", {"weights": "18,15,5,20,10,15,17"}
        from_db = client.get(url, params=params).json()
        assert from_db == simulate_backtest(BASE, generate_demo_history()).model_dump(by_alias=True)

        # …a po zmianie jednego wiersza w bazie wynik się zmienia — czyli naprawdę czytamy z bazy
        last_month = from_db["dates"][-1]
        with get_sessionmaker()() as db:
            row = db.get(MonthlyReturn, (INSTRUMENT_IDS[1], last_month))
            row.ret += 0.10
            db.commit()
        changed = client.get(url, params=params).json()
        assert changed["portfolio"][:-1] == from_db["portfolio"][:-1]
        assert changed["portfolio"][-1] != from_db["portfolio"][-1]

        # propozycje liczą się na założeniach z bazy
        pid = sign_up_and_submit_profile(client, demo_answers)["profileId"]
        proposals = client.get("/api/proposals", params={"profileId": pid, "level": 3})
        assert proposals.status_code == 200 and len(proposals.json()["proposals"]) == 3

    def test_konto_demo_dziala_po_wypelnieniu_bazy(self, client):
        with get_sessionmaker()() as db:
            seed_demo(db, Settings(app_env="dev"))
            seed_demo(db, Settings(app_env="dev"))  # drugi raz nie psuje ani nie dubluje
            assert len(db.scalars(select(User)).all()) == 1
            assert len(db.scalars(select(AssumptionsSnapshot)).all()) == 1
        login = client.post("/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
        assert login.status_code == 200 and login.json()["user"]["email"] == DEMO_EMAIL

    def test_przykladowych_danych_nie_zapisujemy_do_bazy_produkcyjnej(self, client):
        with get_sessionmaker()() as db, pytest.raises(SystemExit):
            seed_demo(db, Settings(app_env="prod"))
