"""Hasła, sesje i ustawienia."""

import pytest

from app.config import Settings, load_settings, parse_env_file
from app.security import DUMMY_HASH, hash_password, hash_token, new_session_token, verify_password


class TestHasla:
    def test_poprawne_haslo_przechodzi_a_zle_nie(self):
        stored = hash_password("demo-haslo-12345")
        assert verify_password("demo-haslo-12345", stored)
        assert not verify_password("demo-haslo-12346", stored)
        assert not verify_password("", stored)

    def test_haslo_nie_jest_zapisane_jawnie_i_kazdy_skrot_ma_inna_sol(self):
        a, b = hash_password("to-samo-haslo-1"), hash_password("to-samo-haslo-1")
        assert "to-samo-haslo-1" not in a
        assert a != b
        assert verify_password("to-samo-haslo-1", a) and verify_password("to-samo-haslo-1", b)
        assert a.startswith("scrypt$")

    def test_polskie_znaki_w_hasle(self):
        stored = hash_password("zażółć-gęślą-jaźń-1")
        assert verify_password("zażółć-gęślą-jaźń-1", stored)
        assert not verify_password("zazolc-gesla-jazn-1", stored)

    @pytest.mark.parametrize(
        "broken", ["", "abc", "bcrypt$1$2$3$4$5", "scrypt$x$8$1$AAAA$AAAA", "scrypt$16384$8$1$!!$!!"]
    )
    def test_uszkodzony_skrot_to_po_prostu_brak_zgodnosci(self, broken):
        assert verify_password("cokolwiek-12345", broken) is False

    def test_skrot_na_niby_nigdy_nie_pasuje(self):
        assert verify_password("cokolwiek-12345", DUMMY_HASH) is False


class TestSesje:
    def test_token_i_skrot(self):
        token, digest = new_session_token()
        assert len(token) >= 40
        assert digest == hash_token(token) and digest != token
        assert new_session_token()[0] != token


class TestUstawienia:
    def test_wartosci_domyslne(self):
        s = load_settings(env_file=None, environ={})
        assert s == Settings()
        assert s.is_dev and s.allow_demo_data and not s.cookie_secure
        assert s.database_url.startswith("sqlite")

    def test_zmienne_srodowiskowe_nadpisuja_domyslne(self):
        s = load_settings(
            env_file=None,
            environ={
                "APP_ENV": "prod",
                "DATABASE_URL": "postgresql+psycopg://u:p@db/horyzont",
                "COOKIE_SECURE": "true",
                "ALLOW_DEMO_DATA": "false",
                "CORS_ORIGINS": "https://a.pl, https://b.pl",
                "SESSION_DAYS": "7",
                "FRED_API_KEY": "abc",
            },
        )
        assert not s.is_dev and s.cookie_secure and not s.allow_demo_data
        assert s.cors_origins == ("https://a.pl", "https://b.pl")
        assert s.session_days == 7 and s.fred_api_key == "abc"
        assert s.database_url.startswith("postgresql")

    def test_plik_env_jest_czytany_a_zmienne_maja_pierwszenstwo(self, tmp_path):
        env = tmp_path / ".env"
        env.write_text(
            '# komentarz\nAPP_ENV=prod\nFRED_API_KEY="z-pliku"\n\nALPHA_VANTAGE_API_KEY=av\n',
            encoding="utf-8",
        )
        s = load_settings(env_file=env, environ={"FRED_API_KEY": "ze-srodowiska"})
        assert s.app_env == "prod"
        assert s.fred_api_key == "ze-srodowiska"
        assert s.alpha_vantage_api_key == "av"

    def test_parse_env_file(self):
        assert parse_env_file("A=1\n#B=2\n C = x y \nD='q'\nbez-znaku-rownosci\n") == {
            "A": "1",
            "C": "x y",
            "D": "q",
        }
