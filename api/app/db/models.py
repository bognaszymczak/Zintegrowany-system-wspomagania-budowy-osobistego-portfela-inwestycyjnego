"""
Tabele bazy danych (SQLAlchemy 2.0).

Dwie grupy:
  • dane użytkowników — users, user_sessions, profiles, choices
  • dane rynkowe — monthly_returns, macro_monthly, assumptions_snapshots
    (wypełnia je zadanie app/jobs/ingest.py; backend NIGDY nie woła giełdowych API w trakcie żądania użytkownika)

Domyślnie baza to plik SQLite (zero instalacji). Zmiana na PostgreSQL to zmiana jednej zmiennej DATABASE_URL w .env.
Tabele tworzą się same przy starcie w trybie dev; w produkcji dodaj migracje (Alembic).
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(UTC)


def new_id() -> str:
    return uuid.uuid4().hex


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------------------------
# Dane użytkowników
# ---------------------------------------------------------------------------------------------


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(60), nullable=True)
    # tylko skrót scrypt (patrz security.py) — nigdy hasło
    password_hash: Mapped[str] = mapped_column(String(200))
    marketing_opt_in: Mapped[bool] = mapped_column(Boolean, default=False)
    # kiedy użytkownik złożył obowiązkowe oświadczenia (ma ukończone 18 lat, akceptuje Regulamin, rozumie, że
    # „to nie jest doradztwo”) — dowód ich złożenia; wszystkie padają w jednym kroku zakładania konta
    accepted_terms_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # skrót SHA-256 tokenu z ciasteczka; sam token trzyma tylko przeglądarka
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Profile(Base):
    """Wynik formularza wstępnego: odpowiedzi + obliczony profil. Jedno wypełnienie = jeden wiersz."""

    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    answers: Mapped[dict] = mapped_column(JSON)  # dokładnie to, co wysłał formularz (ProfileRequest)
    scoring: Mapped[dict] = mapped_column(JSON)  # wynik punktacji (wyniki cząstkowe, poziom, ograniczenia)
    plan: Mapped[dict] = mapped_column(JSON)  # plan wyliczony z przedziałów (kwota, wpłata, lata, cel)
    level: Mapped[int] = mapped_column(Integer)
    # wersja reguł punktacji — gdy zmienicie reguły, stare profile da się odróżnić i policzyć na nowo
    rules_version: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Choice(Base):
    """Portfel zapisany przez użytkownika po ocenie ryzyka („Zapisz ten wybór”)."""

    __tablename__ = "choices"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    profile_id: Mapped[str] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    level: Mapped[int] = mapped_column(Integer)
    proposal_id: Mapped[str] = mapped_column(String(40))
    weights: Mapped[list] = mapped_column(JSON)  # 7 udziałów w punktach procentowych
    saved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# ---------------------------------------------------------------------------------------------
# Dane rynkowe (wypełnia app/jobs/ingest.py)
# ---------------------------------------------------------------------------------------------


class MonthlyReturn(Base):
    """Miesięczny zwrot instrumentu (ułamek: 0,012 = +1,2%). Klucz: instrument + miesiąc."""

    __tablename__ = "monthly_returns"

    instrument_id: Mapped[str] = mapped_column(String(32), primary_key=True)  # np. „akcje-usa”
    month: Mapped[str] = mapped_column(String(7), primary_key=True)  # „2024-03”
    ret: Mapped[float] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(40))  # np. „alphavantage:SPY” albo „demo”


class MacroMonthly(Base):
    """Szeregi pomocnicze: inflacja i lokaty (miesięczne stopy), VIX (poziom), kurs USD/PLN."""

    __tablename__ = "macro_monthly"

    series: Mapped[str] = mapped_column(
        String(32), primary_key=True
    )  # „inflation_pl”, „deposit_pl”, „vix”, „usdpln”
    month: Mapped[str] = mapped_column(String(7), primary_key=True)
    value: Mapped[float] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(40))


class AssumptionsSnapshot(Base):
    """„Zdjęcie” założeń rynkowych z danego dnia (MarketAssumptions jako JSON). Silnik czyta najnowsze."""

    __tablename__ = "assumptions_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    as_of: Mapped[str] = mapped_column(String(10), unique=True, index=True)  # „2026-11-03”
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
