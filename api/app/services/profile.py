"""
Punktacja profilu inwestora z odpowiedzi formularza — czysta funkcja, bez bazy i sieci.

To jest wierna kopia web/src/domain/profile.ts; oba pliki mają wspólne przypadki testowe
(web/src/domain/profile.test.ts i api/tests/test_profile.py). Gdy zmieniasz regułę w jednym miejscu,
zmień ją w drugim, bo inaczej tryb z atrapami i tryb z backendem dadzą różne profile.

Zasada przewodnia: gdy odpowiedzi się rozchodzą, wybieramy ostrożniejszy wynik.
"""

import math

from ..schemas import ProfileRequest, ProfileScores, ProfileScoring
from .profiles import clamp_level

# ---------- tabele punktowe ----------

CUSHION_POINTS = {"tak": 4, "czesciowo": 2, "nie": 0}
INCOME_POINTS = {"staly": 3, "zmienny": 2, "niepewny": 0}
LOANS_POINTS = {"brak": 3, "do20": 2, "20do40": 1, "ponad40": 0}
CAPACITY_MAX_POINTS = 10

DROP_SHARE = {10: 0.0, 20: 0.5, 30: 0.75, 40: 1.0}
REACTION_SHARE = {"wszystko": 0.0, "czesc": 0.25, "czekam": 0.75, "dokupuje": 1.0}
PREFERENCE_SHARE = {"pewne": 0.0, "ryzyko": 1.0}
W_DROP = 0.5
W_REACTION = 0.3
W_PREFERENCE = 0.2

# Kto sprzedałby wszystko przy spadku, nie ma realnej tolerancji powyżej 2 — niezależnie od deklaracji.
BEHAVIOR_CAP = 2

HORIZON_SCORE = {"do3": 2, "3do5": 3, "5do10": 4, "ponad10": 5}

# poprawne odpowiedzi mini-quizu (klucz = id pytania)
QUIZ_CORRECT = {"q1": "b", "q2": "b", "q3": "b"}


def to_score(share: float) -> int:
    """Udział 0–1 → wynik 1–5. Zaokrąglamy w dół (ostrożniej); 1e-9 chroni przed błędem zmiennoprzecinkowym."""
    clamped = min(1.0, max(0.0, share))
    return 1 + math.floor(clamped * 4 + 1e-9)


def compute_profile(request: ProfileRequest) -> ProfileScoring:
    capacity_share = (
        CUSHION_POINTS[request.cushion] + INCOME_POINTS[request.income] + LOANS_POINTS[request.loans]
    ) / CAPACITY_MAX_POINTS
    capacity = to_score(capacity_share)

    tolerance_share = (
        W_DROP * DROP_SHARE[request.acceptable_drop_pct]
        + W_REACTION * REACTION_SHARE[request.reaction]
        + W_PREFERENCE * PREFERENCE_SHARE[request.risk_preference]
    )
    tolerance = to_score(tolerance_share)
    behavior_cap_applied = request.reaction == "wszystko" and tolerance > BEHAVIOR_CAP
    if behavior_cap_applied:
        tolerance = BEHAVIOR_CAP

    horizon = HORIZON_SCORE[request.horizon]

    lowest = min(capacity, tolerance, horizon)
    goal_cap_applied = request.goal == "poduszka" and lowest > 1
    level = clamp_level(1 if goal_cap_applied else lowest)

    quiz_correct = sum(1 for qid, correct in QUIZ_CORRECT.items() if request.quiz.get(qid) == correct)
    knows_markets = "akc" in request.experience or "etf" in request.experience
    if quiz_correct == len(QUIZ_CORRECT) and knows_markets:
        knowledge = "dobra"
    elif quiz_correct >= 2 or knows_markets:
        knowledge = "srednia"
    else:
        knowledge = "podstawowa"

    return ProfileScoring(
        scores=ProfileScores(capacity=capacity, tolerance=tolerance, horizon=horizon),
        level=level,
        behavior_cap_applied=behavior_cap_applied,
        goal_cap_applied=goal_cap_applied,
        knowledge=knowledge,
        quiz_correct=quiz_correct,
    )


def apply_level_shift(level: int, shift: int) -> int:
    """Poziom po ręcznej korekcie na ekranie profilu: −1 (ostrożniej), 0, +1 (odważniej)."""
    return clamp_level(level + shift)
