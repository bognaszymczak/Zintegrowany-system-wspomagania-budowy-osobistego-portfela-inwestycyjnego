"""Połączenie z bazą. Adres bazy bierzemy z ustawień (DATABASE_URL w .env)."""

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from ..config import get_settings
from .models import Base


def make_engine(url: str) -> Engine:
    if not url.startswith("sqlite"):
        return create_engine(url)

    # SQLite domyślnie pilnuje, by połączenie używał tylko jeden wątek; FastAPI obsługuje żądania w puli wątków
    engine = create_engine(url, connect_args={"check_same_thread": False})

    # SQLite domyślnie ignoruje klucze obce (a więc i ON DELETE CASCADE). Włączamy je, żeby baza na laptopie
    # zachowywała się tak samo jak PostgreSQL na serwerze (przepis z dokumentacji SQLAlchemy).
    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_connection, _record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


@lru_cache
def get_engine() -> Engine:
    return make_engine(get_settings().database_url)


@lru_cache
def get_sessionmaker() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


def init_db(engine: Engine | None = None) -> None:
    """Tworzy brakujące tabele. Na produkcji zastąp to migracjami (Alembic)."""
    Base.metadata.create_all(engine or get_engine())


def get_db() -> Iterator[Session]:
    """Zależność FastAPI: jedna sesja bazy na żądanie, zawsze zamykana."""
    db = get_sessionmaker()()
    try:
        yield db
    finally:
        db.close()
