"""
Zadanie „pobierz dane rynkowe i przelicz założenia”. Uruchamiasz je z katalogu api/:

    python -m app.jobs.ingest --demo-seed   # NA START: dane przykładowe + konto demo (bez żadnych kluczy API)
    python -m app.jobs.ingest --fetch       # prawdziwe dane z Alpha Vantage / NBP / FRED (wymaga kluczy w .env)
    python -m app.jobs.ingest --recompute   # tylko przelicz założenia z historii, która już jest w bazie

W produkcji `--fetch` uruchamia cron raz na dobę (np. `15 3 * * * cd /app/api && python -m app.jobs.ingest --fetch`).
Przepływ danych:  zewnętrzne API → tabele monthly_returns / macro_monthly → założenia (assumptions_snapshots)
→ silnik. Endpointy użytkownika czytają WYŁĄCZNIE z bazy.

SZKIELET: część `--fetch` nie była uruchamiana na żywych API (w środowisku, w którym powstał kod, nie było dostępu
do sieci). Przed pierwszym użyciem uruchom ją na jednym instrumencie i sprawdź wynik w bazie.
"""

import argparse
import time
from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..db.models import AssumptionsSnapshot, MacroMonthly, MonthlyReturn, User, utcnow
from ..db.session import get_sessionmaker, init_db
from ..providers import alpha_vantage, fred, nbp
from ..providers.base import convert_returns_to_pln, month_end_values, monthly_returns, only_complete_months
from ..repository import load_history
from ..security import hash_password
from ..services.dates import today_iso
from ..services.demo_history import generate_demo_history
from ..services.estimation import estimate_assumptions
from ..services.instruments import INSTRUMENT_IDS

# Notowane w USA ETF-y z historią sięgającą 2008 r. — odpowiedniki siedmiu instrumentów aplikacji.
# Zamień na własne symbole (np. fundusze UCITS z giełdy w Londynie), jeśli chcesz dokładniejszego odwzorowania.
ETF_SYMBOLS = {
    "akcje-swiat": "ACWI",
    "akcje-usa": "SPY",
    "akcje-em": "EEM",
    "obl-skarb": "IEF",
    "obl-korp": "LQD",
    "zloto": "GLD",
    "gotowka": "SHV",
}
HISTORY_START = "2007-11-01"

# konto z ekranu logowania w trybie demo (web/src/features/auth/demo.ts)
DEMO_EMAIL = "demo@horyzont.pl"
DEMO_PASSWORD = "demo-haslo-12345"
DEMO_NAME = "Anna"


def save_returns(db: Session, instrument_id: str, returns: dict[str, float], source: str) -> None:
    for month, value in returns.items():
        db.merge(MonthlyReturn(instrument_id=instrument_id, month=month, ret=value, source=source))


def save_macro(db: Session, series: str, values: dict[str, float], source: str) -> None:
    for month, value in values.items():
        db.merge(MacroMonthly(series=series, month=month, value=value, source=source))


def recompute_assumptions(db: Session) -> str:
    """Liczy założenia z historii w bazie i zapisuje „zdjęcie” z dzisiejszą datą. Zwraca opis do wydruku."""
    history = load_history(db)
    if history is None:
        return "Za mało danych w bazie (brak instrumentu albo luki w miesiącach) — założeń nie przeliczono."
    latest_vix = db.scalar(
        select(MacroMonthly.value)
        .where(MacroMonthly.series == "vix")
        .order_by(MacroMonthly.month.desc())
        .limit(1)
    )
    as_of = today_iso()
    assumptions = estimate_assumptions(history.dates[1:], history.returns[1:], as_of=as_of, vix=latest_vix)
    db.execute(delete(AssumptionsSnapshot).where(AssumptionsSnapshot.as_of == as_of))
    db.add(AssumptionsSnapshot(as_of=as_of, payload=assumptions.model_dump(by_alias=True, mode="json")))
    db.commit()
    return f"Zapisano założenia z dnia {as_of} (historia: {history.dates[1]} … {history.dates[-1]})."


def ensure_demo_user(db: Session) -> None:
    if db.scalar(select(User).where(User.email == DEMO_EMAIL)) is None:
        db.add(
            User(
                email=DEMO_EMAIL,
                name=DEMO_NAME,
                password_hash=hash_password(DEMO_PASSWORD),
                accepted_terms_at=utcnow(),
            )
        )
        db.commit()


def seed_demo(db: Session, settings: Settings) -> None:
    """Zapisuje do bazy przykładową historię (generator) i konto demo — aplikacja działa od razu, bez kluczy API."""
    if not settings.is_dev:
        # konto demo ma jawne hasło (jest w README), więc nie może powstać w bazie produkcyjnej
        raise SystemExit(
            "--demo-seed działa tylko przy APP_ENV=dev (zakłada publiczne konto demo z jawnym hasłem)."
        )
    history = generate_demo_history()
    for k in range(1, len(history.dates)):
        month = history.dates[k]
        for i, instrument_id in enumerate(INSTRUMENT_IDS):
            db.merge(
                MonthlyReturn(
                    instrument_id=instrument_id, month=month, ret=history.returns[k][i], source="demo"
                )
            )
        db.merge(MacroMonthly(series="inflation_pl", month=month, value=history.inflation[k], source="demo"))
        db.merge(MacroMonthly(series="deposit_pl", month=month, value=history.deposit[k], source="demo"))
    db.commit()
    ensure_demo_user(db)
    print(recompute_assumptions(db))
    print(f"Konto demo: {DEMO_EMAIL} / {DEMO_PASSWORD}")


def fetch_real(db: Session, settings: Settings) -> None:
    """Pobiera prawdziwe notowania i zastępuje nimi dane przykładowe."""
    if not settings.alpha_vantage_api_key:
        raise SystemExit(
            "Brak ALPHA_VANTAGE_API_KEY w .env — darmowy klucz: https://www.alphavantage.co/support/#api-key"
        )
    today = datetime.now(UTC).date().isoformat()

    print("NBP: kurs USD/PLN…")
    usdpln = month_end_values(nbp.fetch_usdpln(HISTORY_START, today))
    save_macro(db, "usdpln", usdpln, "nbp")

    # dane przykładowe zastępujemy dopiero, gdy kurs jest pobrany (żeby nie zostawić bazy w połowie pusto)
    db.execute(delete(MonthlyReturn).where(MonthlyReturn.source == "demo"))
    db.execute(delete(MacroMonthly).where(MacroMonthly.source == "demo"))

    for instrument_id, symbol in ETF_SYMBOLS.items():
        print(f"Alpha Vantage: {symbol} ({instrument_id})…")
        closes = month_end_values(
            alpha_vantage.fetch_monthly_adjusted(symbol, settings.alpha_vantage_api_key)
        )
        in_pln = only_complete_months(convert_returns_to_pln(monthly_returns(closes), usdpln), today)
        save_returns(db, instrument_id, in_pln, f"alphavantage:{symbol}")
        db.commit()
        time.sleep(15)  # darmowy plan: 5 zapytań na minutę

    if settings.fred_api_key:
        print("FRED: VIX…")
        vix = month_end_values(fred.fetch_series(fred.VIX, settings.fred_api_key, HISTORY_START, today))
        save_macro(db, "vix", vix, f"fred:{fred.VIX}")
    else:
        print("Pominięto VIX (brak FRED_API_KEY) — „klimat rynku” zostanie wzięty z wartości bazowych.")

    # TODO (do zrobienia w pracy): inflation_pl i deposit_pl — miesięczne stopy z GUS (BDL) i NBP.
    # Dopóki ich nie ma, symulacja używa przykładowej ścieżki inflacji i lokat (opisane w polu `source` wykresu).
    db.commit()
    print(recompute_assumptions(db))


def main() -> None:
    parser = argparse.ArgumentParser(description="Dane rynkowe i założenia dla aplikacji Horyzont")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--demo-seed", action="store_true", help="dane przykładowe + konto demo (bez kluczy API)"
    )
    group.add_argument("--fetch", action="store_true", help="pobierz prawdziwe dane (klucze w .env)")
    group.add_argument("--recompute", action="store_true", help="przelicz założenia z historii w bazie")
    args = parser.parse_args()

    init_db()
    with get_sessionmaker()() as db:
        if args.demo_seed:
            seed_demo(db, get_settings())
        elif args.fetch:
            fetch_real(db, get_settings())
        else:
            print(recompute_assumptions(db))


if __name__ == "__main__":
    main()
