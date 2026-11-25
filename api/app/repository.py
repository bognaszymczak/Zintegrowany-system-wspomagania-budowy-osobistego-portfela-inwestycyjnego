"""
Dostęp do bazy w jednym miejscu: routery wołają te funkcje i nie piszą zapytań SQL samodzielnie.

Dzięki temu wymiana bazy (SQLite → PostgreSQL), dopisanie cache’u albo test na atrapie danych dotyczą jednego pliku.
Funkcje dostają gotową sesję bazy (`db`) — o jej otwieraniu i zamykaniu dba app/db/session.py.
"""

from datetime import UTC, datetime, timedelta
from functools import lru_cache

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import Settings
from .db.models import AssumptionsSnapshot, MacroMonthly, MonthlyReturn, Profile, User, UserSession, utcnow
from .errors import ApiError
from .schemas import MarketAssumptions
from .security import hash_token, new_session_token
from .services.assumptions import assumptions_at
from .services.backtest import MonthlyHistory
from .services.dates import month_range, previous_month
from .services.demo_history import (
    DEMO_SOURCE,
    annual_to_monthly,
    deposit_by_year,
    generate_demo_history,
    inflation_by_year,
)
from .services.instruments import INSTRUMENT_COUNT, INSTRUMENT_IDS


def _aware(moment: datetime) -> datetime:
    """SQLite oddaje daty bez strefy czasowej — traktujemy je jako UTC."""
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


# ---------------------------------------------------------------------------------------------
# Konta i sesje
# ---------------------------------------------------------------------------------------------


def find_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))


def create_session(db: Session, user: User, days: int) -> str:
    """Zakłada sesję i zwraca token do ciasteczka (w bazie ląduje tylko jego skrót)."""
    token, digest = new_session_token()
    db.add(UserSession(user_id=user.id, token_hash=digest, expires_at=utcnow() + timedelta(days=days)))
    db.commit()
    return token


def find_user_by_token(db: Session, token: str) -> User | None:
    row = db.scalar(select(UserSession).where(UserSession.token_hash == hash_token(token)))
    if row is None or _aware(row.expires_at) <= utcnow():
        return None
    return db.get(User, row.user_id)


def delete_session(db: Session, token: str) -> None:
    row = db.scalar(select(UserSession).where(UserSession.token_hash == hash_token(token)))
    if row is not None:
        db.delete(row)
        db.commit()


# ---------------------------------------------------------------------------------------------
# Profile i wybory
# ---------------------------------------------------------------------------------------------


def get_profile_of(db: Session, profile_id: str, user: User) -> Profile:
    """Profil należący do użytkownika; cudzy lub nieistniejący to ten sam błąd 404 (nie zdradzamy, które istnieją)."""
    row = db.get(Profile, profile_id)
    if row is None or row.user_id != user.id:
        raise ApiError(404, "profile_not_found", "Nie znaleziono profilu. Wypełnij formularz jeszcze raz.")
    return row


# ---------------------------------------------------------------------------------------------
# Dane rynkowe
# ---------------------------------------------------------------------------------------------


def market_missing() -> ApiError:
    # za każdym razem nowy obiekt: wyjątek rzucany wielokrotnie gromadziłby ślad stosu i trzymał dane starych żądań
    return ApiError(
        503, "market_data_missing", "Brak aktualnych danych rynkowych. Spróbuj ponownie za jakiś czas."
    )


def latest_assumptions(db: Session) -> MarketAssumptions | None:
    row = db.scalar(select(AssumptionsSnapshot).order_by(AssumptionsSnapshot.as_of.desc()).limit(1))
    return MarketAssumptions.model_validate(row.payload) if row else None


def get_assumptions(db: Session, settings: Settings) -> MarketAssumptions:
    """Najnowsze założenia z bazy; bez nich — dane przykładowe (jeśli dozwolone w ustawieniach) albo błąd 503."""
    snapshot = latest_assumptions(db)
    if snapshot is not None:
        return snapshot
    if settings.allow_demo_data:
        return assumptions_at()
    raise market_missing()


def load_history(db: Session) -> MonthlyHistory | None:
    """Historia z bazy jako MonthlyHistory albo None, gdy dane są niekompletne (brak instrumentu lub luki w miesiącach)."""
    rows = db.execute(
        select(MonthlyReturn.instrument_id, MonthlyReturn.month, MonthlyReturn.ret, MonthlyReturn.source)
    ).all()
    by_month: dict[str, dict[str, float]] = {}
    sources: set[str] = set()
    for instrument_id, month, ret, source in rows:
        by_month.setdefault(month, {})[instrument_id] = ret
        sources.add(source.split(":")[0])
    complete = sorted(m for m, values in by_month.items() if len(values) == INSTRUMENT_COUNT)
    if len(complete) < 2 or month_range(complete[0], complete[-1]) != complete:
        return None

    macro: dict[str, dict[str, float]] = {}
    for series, month, value in db.execute(
        select(MacroMonthly.series, MacroMonthly.month, MacroMonthly.value)
    ).all():
        macro.setdefault(series, {})[month] = value

    def monthly_rate(series: str, month: str, fallback_annual: float) -> float:
        # brak wartości w bazie → przykładowa ścieżka roczna (patrz demo_history)
        return macro.get(series, {}).get(month, annual_to_monthly(fallback_annual))

    dates = [previous_month(complete[0]), *complete]
    returns = [[0.0] * INSTRUMENT_COUNT] + [[by_month[m][i] for i in INSTRUMENT_IDS] for m in complete]
    inflation = [0.0] + [monthly_rate("inflation_pl", m, inflation_by_year(int(m[:4]))) for m in complete]
    deposit = [0.0] + [monthly_rate("deposit_pl", m, deposit_by_year(int(m[:4]))) for m in complete]

    if sources == {"demo"}:
        source = DEMO_SOURCE  # w bazie są tylko dane z generatora — mówimy o tym wprost
    else:
        has_macro = bool(macro.get("inflation_pl")) and bool(macro.get("deposit_pl"))
        source = f"Miesięczne zwroty z bazy danych aplikacji (źródło: {', '.join(sorted(sources))}). " + (
            "Inflacja i lokaty: dane z bazy." if has_macro else "Inflacja i lokaty: wartości przykładowe."
        )
    return MonthlyHistory(dates=dates, returns=returns, inflation=inflation, deposit=deposit, source=source)


@lru_cache
def _demo_history() -> MonthlyHistory:
    return generate_demo_history()


def get_history(db: Session, settings: Settings) -> MonthlyHistory:
    history = load_history(db)
    if history is not None:
        return history
    if settings.allow_demo_data:
        return _demo_history()
    raise market_missing()
