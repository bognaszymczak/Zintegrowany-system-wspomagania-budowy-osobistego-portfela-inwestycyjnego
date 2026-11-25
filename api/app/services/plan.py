"""
Plan oszczędzania wyliczony z odpowiedzi — odpowiednik web/src/domain/plan.ts.

Formularz pyta o przedziały („5–20 tys. zł”), a projekcje potrzebują jednej liczby, więc przyjmujemy wartość
reprezentatywną (środek przedziału, zaokrąglony). Użytkownik widzi te założenia na ekranie wyceny.
"""

from ..schemas import Plan, ProfileRequest

START_PLN: dict[str, float] = {"do5k": 2_500, "5do20k": 12_500, "20do50k": 35_000, "ponad50k": 75_000}
MONTHLY_PLN: dict[str, float] = {"do300": 150, "300do1000": 650, "1000do3000": 2_000, "ponad3000": 4_000}
HORIZON_YEARS: dict[str, int] = {"do3": 3, "3do5": 4, "5do10": 7, "ponad10": 12}


def plan_from_request(request: ProfileRequest) -> Plan:
    return Plan(
        start_pln=START_PLN[request.start_band],
        monthly_pln=MONTHLY_PLN[request.monthly_band],
        years=HORIZON_YEARS[request.horizon],
        target_pln=request.target_amount_pln,
    )


# Plan użyty w szkicu ekranów — przydatny w testach, które odtwarzają liczby ze szkicu.
SKETCH_PLAN = Plan(start_pln=20_000, monthly_pln=500, years=10, target_pln=100_000)
