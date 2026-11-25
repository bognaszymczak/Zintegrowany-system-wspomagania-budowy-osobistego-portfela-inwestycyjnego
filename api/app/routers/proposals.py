"""Trzy propozycje portfeli (GET /api/proposals) i ocena ryzyka wyboru użytkownika (POST /api/risk-assessment)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from .. import repository
from ..config import Settings, get_settings
from ..deps import CurrentUser, Db, risk_model
from ..schemas import ProposalsResponse, RiskAssessmentRequest, RiskAssessmentResponse
from ..services.responses import proposals_response, risk_assessment_response

router = APIRouter(tags=["propozycje"])

SettingsDep = Annotated[Settings, Depends(get_settings)]


@router.get("/proposals", response_model=ProposalsResponse)
def get_proposals(
    profile_id: Annotated[str, Query(alias="profileId", min_length=1, max_length=64)],
    level: Annotated[int, Query(ge=1, le=5)],
    user: CurrentUser,
    db: Db,
    settings: SettingsDep,
) -> ProposalsResponse:
    stored = repository.get_profile_of(db, profile_id, user)
    return proposals_response(
        profile_id=profile_id,
        stored_level=stored.level,
        stored_plan=stored.plan,
        level=level,
        assumptions=repository.get_assumptions(db, settings),
    )


@router.post("/risk-assessment", response_model=RiskAssessmentResponse)
def risk_assessment(
    body: RiskAssessmentRequest, user: CurrentUser, db: Db, settings: SettingsDep
) -> RiskAssessmentResponse:
    stored = repository.get_profile_of(db, body.profile_id, user)
    return risk_assessment_response(
        stored_level=stored.level,
        stored_plan=stored.plan,
        body=body,
        assumptions=repository.get_assumptions(db, settings),
        model=risk_model(),
    )
