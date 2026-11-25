"""Daty w formacie ISO (RRRR-MM-DD) — odpowiednik web/src/domain/dates.ts."""

from datetime import UTC, date, datetime, timedelta


def today_iso(now: datetime | None = None) -> str:
    now = now or datetime.now(UTC)
    now = now.replace(tzinfo=UTC) if now.tzinfo is None else now.astimezone(UTC)
    return now.date().isoformat()


def add_days(iso: str, days: int) -> str:
    return (date.fromisoformat(iso) + timedelta(days=days)).isoformat()


def month_range(start: str, end: str) -> list[str]:
    """Lista miesięcy RRRR-MM od `start` do `end` włącznie (przez granicę roku)."""
    year, month = (int(part) for part in start.split("-"))
    end_year, end_month = (int(part) for part in end.split("-"))
    months: list[str] = []
    while (year, month) <= (end_year, end_month):
        months.append(f"{year}-{month:02d}")
        month += 1
        if month > 12:
            month, year = 1, year + 1
    return months


def previous_month(month: str) -> str:
    """„2008-01” → „2007-12”."""
    year, mon = (int(part) for part in month.split("-"))
    return f"{year - 1}-12" if mon == 1 else f"{year}-{mon - 1:02d}"


def iso_z(moment: datetime) -> str:
    """Znacznik czasu w formie, jaką daje JavaScript (toISOString): 2026-11-03T19:12:00.000Z."""
    moment = moment.replace(tzinfo=UTC) if moment.tzinfo is None else moment.astimezone(UTC)
    return moment.isoformat(timespec="milliseconds").replace("+00:00", "Z")
