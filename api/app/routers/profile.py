"""
Formularz wstępny: POST /api/profile.

To jest endpoint, do którego trafia 5-krokowy formularz (web/src/features/onboarding → useSubmitProfile).
Backend NIE ufa przeglądarce: kształt i dozwolone wartości sprawdza Pydantic (ProfileRequest), a punktację
liczy sam — z tych samych reguł co front (services/profile.py).
"""

from fastapi import APIRouter

from ..db.models import Profile, utcnow
from ..deps import CurrentUser, Db
from ..schemas import ProfileRequest, ProfileResponse
from ..services.plan import plan_from_request
from ..services.profile import compute_profile
from ..services.responses import profile_response

router = APIRouter(tags=["profil"])

# wersja reguł punktacji zapisywana przy profilu; zmień ją, gdy zmieniasz reguły w services/profile.py
RULES_VERSION = "2026-11-v1"


@router.post("/profile", response_model=ProfileResponse)
def submit_profile(body: ProfileRequest, user: CurrentUser, db: Db) -> ProfileResponse:
    scoring = compute_profile(body)
    plan = plan_from_request(body)
    now = utcnow()

    row = Profile(
        user_id=user.id,
        answers=body.model_dump(by_alias=True, mode="json"),
        scoring=scoring.model_dump(by_alias=True, mode="json"),
        plan=plan.model_dump(by_alias=True, mode="json"),
        level=scoring.level,
        rules_version=RULES_VERSION,
        created_at=now,
    )
    db.add(row)
    db.commit()

    return profile_response(scoring, plan, profile_id=row.id, created_at=now)
