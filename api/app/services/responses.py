"""
Składanie odpowiedzi API z wyników silnika — bez HTTP i bez bazy.

Routery (app/routers/*) robią tylko to, co wymaga bazy lub sieci: sprawdzają, kto pyta, wczytują profil i założenia
rynkowe. Samo „weź dane → policz → ułóż odpowiedź w kształcie kontraktu” siedzi tutaj, dzięki czemu cały ten
fragment sprawdzają zwykłe testy (tests/test_responses.py), także tam, gdzie FastAPI i baza nie są zainstalowane.
"""

from datetime import datetime

from ..errors import ApiError
from ..schemas import (
    MarketAssumptions,
    Plan,
    ProfileLimits,
    ProfileResponse,
    ProfileScoring,
    ProposalsResponse,
    RiskAssessmentRequest,
    RiskAssessmentResponse,
)
from ..selection import validate_selection
from .assessment import AssessmentInput, assess_portfolio
from .dates import add_days, iso_z
from .profiles import profile_by_level
from .proposals import proposal_views
from .risk_model import RiskModel

# tyle dni propozycje są uznawane za aktualne (pole validUntil)
VALID_DAYS = 7


def profile_response(
    scoring: ProfileScoring, plan: Plan, *, profile_id: str, created_at: datetime
) -> ProfileResponse:
    """Odpowiedź na wysłanie formularza: wynik punktacji + nazwa i granice profilu + plan z przedziałów."""
    profile = profile_by_level(scoring.level)
    return ProfileResponse(
        **scoring.model_dump(),
        profile_id=profile_id,
        name=profile.name,
        limits=ProfileLimits(
            volatility=profile.volatility,
            max_drawdown=profile.max_drawdown,
            max_equity=profile.max_equity,
            max_position=profile.max_position,
        ),
        plan=plan,
        created_at=iso_z(created_at),
    )


def proposals_response(
    *, profile_id: str, stored_level: int, stored_plan: dict, level: int, assumptions: MarketAssumptions
) -> ProposalsResponse:
    """Trzy propozycje dla poziomu `level`. Poziom można przesunąć najwyżej o jeden względem wyniku formularza."""
    if abs(level - stored_level) > 1:
        raise ApiError(422, "validation_error", "Niepoprawny poziom profilu.", ["level"])
    plan = Plan.model_validate(stored_plan)
    return ProposalsResponse(
        profile_id=profile_id,
        level=level,
        plan=plan,
        as_of=assumptions.as_of,
        valid_until=add_days(assumptions.as_of, VALID_DAYS),
        proposals=proposal_views(level, plan, assumptions),
    )


def risk_assessment_response(
    *,
    stored_level: int,
    stored_plan: dict,
    body: RiskAssessmentRequest,
    assumptions: MarketAssumptions,
    model: RiskModel,
) -> RiskAssessmentResponse:
    """Ocena ryzyka wyboru użytkownika (propozycja + jego korekty suwakami). Błędny wybór = ApiError 422."""
    proposal = validate_selection(
        stored_level=stored_level, level=body.level, proposal_id=body.proposal_id, weights=body.weights
    )
    plan = Plan.model_validate(stored_plan)
    assessment = assess_portfolio(
        AssessmentInput(
            weights=body.weights,
            base_weights=proposal.weights,
            base_name=proposal.name,
            plan=plan,
            profile=profile_by_level(body.level),
        ),
        assumptions,
        model,
    )
    return RiskAssessmentResponse(
        profile_id=body.profile_id,
        proposal_id=proposal.id,
        base_name=proposal.name,
        weights=body.weights,
        plan=plan,
        as_of=assumptions.as_of,
        valid_until=add_days(assumptions.as_of, VALID_DAYS),
        assessment=assessment,
    )
