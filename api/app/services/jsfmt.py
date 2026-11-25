"""
Małe funkcje, które powtarzają zachowanie JavaScriptu, żeby Python i przeglądarka pokazywały TE SAME
liczby i zdania.

Po co to jest: Python zaokrągla połówki do parzystej (round(2.5) == 2), a JavaScript w górę
(Math.round(2.5) == 3). Podobnie f"{0.25:.1f}" daje „0.2”, a (0.25).toFixed(1) daje „0.3”. Bez tych funkcji
ekran „Ocena ryzyka” mógłby po przełączeniu z atrap na backend pokazać o 1 inną liczbę albo inne zdanie.
Odpowiedniki w TypeScripcie: web/src/domain/profiles.ts (pct) i web/src/domain/portfolio/assessment.ts (formatPln).
"""

import math
import re
from decimal import ROUND_HALF_UP, Decimal


def js_round(x: float) -> int:
    """Math.round: połówki idą w stronę +∞ (2,5 → 3; −2,5 → −2). Zwraca int."""
    floor = math.floor(x)
    return floor + 1 if x - floor >= 0.5 else floor


def to_fixed(x: float, digits: int = 0) -> str:
    """Number.prototype.toFixed: zaokrągla dokładną wartość dziesiętną liczby, remis „od zera”."""
    sign = "-" if x < 0 else ""
    quantum = Decimal(1).scaleb(-digits)
    return sign + f"{Decimal(abs(x)).quantize(quantum, rounding=ROUND_HALF_UP):f}"


def pct(x: float, digits: int = 0) -> str:
    """Ułamek jako procent z minusem typograficznym: −0,2 → „−20%”, 0,0752 (1 cyfra) → „7,5%”."""
    text = to_fixed(abs(x) * 100, digits).replace(".", ",")
    return ("−" if x < 0 else "") + text + "%"


_THOUSANDS = re.compile(r"\B(?=(\d{3})+(?!\d))")


def format_pln(n: float) -> str:
    """20000 → „20 000” (twarda spacja, żeby liczba nie łamała się w połowie)."""
    return _THOUSANDS.sub(" ", str(js_round(n)))


def comma(x: float, digits: int = 1) -> str:
    """Liczba z przecinkiem dziesiętnym: 3,5 → „3,5”."""
    return to_fixed(x, digits).replace(".", ",")


def join_polish(items: list[str]) -> str:
    """['akcji', 'złota'] → „akcji i złota”; trzy elementy → „a, b i c”."""
    if len(items) <= 1:
        return items[0] if items else ""
    return f"{', '.join(items[:-1])} i {items[-1]}"
