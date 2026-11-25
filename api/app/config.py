"""
Ustawienia aplikacji — z zmiennych środowiskowych i pliku `.env` (wzór: `.env.example`).

Celowo bez zewnętrznych bibliotek: zwykły plik KEY=VALUE + os.environ. Zmienne środowiskowe mają
pierwszeństwo przed plikiem, więc na serwerze ustawiasz je w panelu hostingu, a lokalnie w `.env`.
Klucze do zewnętrznych API (FRED, Alpha Vantage) są TYLKO tutaj — przeglądarka ich nigdy nie widzi.
"""

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


def parse_env_file(text: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key.strip()] = value
    return values


def _flag(value: str | None, default: bool) -> bool:
    if value is None or value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "tak", "on"}


@dataclass(frozen=True)
class Settings:
    # "dev" włącza dokumentację /docs i automatyczne tworzenie tabel przy starcie
    app_env: str = "dev"
    # SQLite do nauki; PostgreSQL w produkcji: postgresql+psycopg://user:haslo@host/horyzont
    database_url: str = "sqlite:///./horyzont.db"
    # adresy, z których przeglądarka może wołać API (w dev Vite używa proxy, więc to zapas)
    cors_origins: tuple[str, ...] = ("http://localhost:5173",)
    # ciasteczko sesji tylko po HTTPS — włącz w produkcji
    cookie_secure: bool = False
    session_days: int = 14
    # gdy w bazie nie ma danych rynkowych: True = pokaż dane przykładowe (z opisem), False = błąd 503
    allow_demo_data: bool = True
    # ścieżka do wytrenowanego modelu ryzyka (puste = model zastępczy)
    risk_model_path: str = ""
    fred_api_key: str = ""
    alpha_vantage_api_key: str = ""

    @property
    def is_dev(self) -> bool:
        return self.app_env == "dev"


def load_settings(env_file: str | Path | None = ".env", environ: dict[str, str] | None = None) -> Settings:
    values: dict[str, str] = {}
    if env_file and Path(env_file).is_file():
        values.update(parse_env_file(Path(env_file).read_text(encoding="utf-8")))
    values.update(os.environ if environ is None else environ)

    defaults = Settings()
    origins = values.get("CORS_ORIGINS", "")
    return Settings(
        app_env=values.get("APP_ENV", defaults.app_env),
        database_url=values.get("DATABASE_URL", defaults.database_url),
        cors_origins=tuple(o.strip() for o in origins.split(",") if o.strip()) or defaults.cors_origins,
        cookie_secure=_flag(values.get("COOKIE_SECURE"), defaults.cookie_secure),
        session_days=int(values.get("SESSION_DAYS") or defaults.session_days),
        allow_demo_data=_flag(values.get("ALLOW_DEMO_DATA"), defaults.allow_demo_data),
        risk_model_path=values.get("RISK_MODEL_PATH", defaults.risk_model_path),
        fred_api_key=values.get("FRED_API_KEY", defaults.fred_api_key),
        alpha_vantage_api_key=values.get("ALPHA_VANTAGE_API_KEY", defaults.alpha_vantage_api_key),
    )


@lru_cache
def get_settings() -> Settings:
    return load_settings()
