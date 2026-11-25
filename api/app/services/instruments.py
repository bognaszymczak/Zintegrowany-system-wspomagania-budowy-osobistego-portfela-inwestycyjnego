"""
Siedem instrumentów w czterech grupach — „słownik” całej aplikacji.

Kolejność jest stała i identyczna jak w web/src/domain/portfolio/instruments.ts: wszystkie wektory udziałów
(`weights`), zwrotów i wahań mają długość 7 i trzymają się dokładnie tej kolejności.
Konkretne produkty (ticker/ISIN) dopisujesz w polu `proxy` — z niego korzysta zadanie pobierające dane giełdowe.
"""

from dataclasses import dataclass
from typing import Literal

GroupId = Literal["akcje", "obligacje", "zloto", "gotowka"]


@dataclass(frozen=True)
class Instrument:
    id: str
    name: str
    sub: str
    group: GroupId
    # przykładowe symbole z giełdy, z których liczymy historię (do podmiany na wybrane fundusze)
    proxy: str


INSTRUMENTS: tuple[Instrument, ...] = (
    Instrument("akcje-swiat", "Akcje świata", "Szeroki indeks spółek z wielu krajów", "akcje", "VWCE / ACWI"),
    Instrument("akcje-usa", "Akcje USA", "Duże amerykańskie spółki", "akcje", "CSPX / SPY"),
    Instrument(
        "akcje-em", "Akcje rynków wschodzących", "Chiny, Indie, Brazylia i inne", "akcje", "EIMI / EEM"
    ),
    Instrument(
        "obl-skarb", "Obligacje skarbowe", "Pożyczki dla państw, średni termin", "obligacje", "IEF / IBTM"
    ),
    Instrument(
        "obl-korp", "Obligacje korporacyjne", "Pożyczki dla firm o dobrej kondycji", "obligacje", "LQD / IBCX"
    ),
    Instrument("zloto", "Złoto", "Zabezpieczenie przed kryzysami i inflacją", "zloto", "SGLN / GLD"),
    Instrument(
        "gotowka", "Gotówka (krótkie obligacje)", "Najmniejsze wahania, łatwy dostęp", "gotowka", "SHV / XEON"
    ),
)

INSTRUMENT_COUNT = len(INSTRUMENTS)
INSTRUMENT_IDS: tuple[str, ...] = tuple(i.id for i in INSTRUMENTS)

# indeks „Akcje USA” — w symulacji wstecznej służy jako odpowiednik indeksu S&P 500
USA_INDEX = 1


@dataclass(frozen=True)
class Group:
    id: GroupId
    name: str
    # dopełniacz do zdań typu „mniej gotówki, więcej akcji”
    genitive: str
    # indeksy instrumentów należących do grupy
    indexes: tuple[int, ...]


GROUPS: tuple[Group, ...] = (
    Group("akcje", "Akcje", "akcji", (0, 1, 2)),
    Group("obligacje", "Obligacje", "obligacji", (3, 4)),
    Group("zloto", "Złoto", "złota", (5,)),
    Group("gotowka", "Gotówka", "gotówki", (6,)),
)

EQUITY_INDEXES: tuple[int, ...] = GROUPS[0].indexes

# Słowne nazwy poziomu ryzyka na skali 1–7 (indeks 0 jest pusty — skala zaczyna się od 1).
RISK_WORDS: tuple[str, ...] = (
    "",
    "bardzo niskie",
    "niskie",
    "umiarkowane",
    "podwyższone",
    "wysokie",
    "bardzo wysokie",
    "najwyższe",
)
