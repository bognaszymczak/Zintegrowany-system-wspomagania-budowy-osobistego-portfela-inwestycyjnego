"""Wspólne dane do testów."""

import copy

import pytest

# Odpowiedzi „przykładowe” z formularza (web/src/features/onboarding/schema.ts → DEMO_VALUES),
# w takiej postaci, w jakiej wysyła je przeglądarka (camelCase).
DEMO_ANSWERS = {
    "goal": "mieszkanie",
    "horizon": "5do10",
    "targetAmountPLN": 100_000,
    "startBand": "5do20k",
    "monthlyBand": "300do1000",
    "cushion": "tak",
    "income": "staly",
    "loans": "do20",
    "acceptableDropPct": 20,
    "reaction": "czekam",
    "riskPreference": "ryzyko",
    "experience": ["lok", "etf"],
    "quiz": {"q1": "b", "q2": "b", "q3": "b"},
    "excludedSectors": [],
    "esgPreferred": False,
    "instruments": "etf",
    "displayCurrency": "pln",
}


@pytest.fixture()
def demo_answers() -> dict:
    """Świeża kopia odpowiedzi z formularza — test może ją dowolnie zmieniać."""
    return copy.deepcopy(DEMO_ANSWERS)
