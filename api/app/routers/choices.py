"""Zapisany wybór („Zapisz ten wybór” na ekranie oceny): POST /api/choices i DELETE /api/choices/{id}."""

from fastapi import APIRouter, Response

from .. import repository
from ..db.models import Choice
from ..deps import CurrentUser, Db
from ..errors import ApiError
from ..schemas import SaveChoiceRequest, SavedChoice
from ..selection import validate_selection
from ..services.dates import iso_z

router = APIRouter(tags=["wybory"])


@router.post("/choices", response_model=SavedChoice, status_code=201)
def save_choice(body: SaveChoiceRequest, user: CurrentUser, db: Db) -> SavedChoice:
    stored = repository.get_profile_of(db, body.profile_id, user)
    proposal = validate_selection(
        stored_level=stored.level, level=body.level, proposal_id=body.proposal_id, weights=body.weights
    )
    row = Choice(
        user_id=user.id,
        profile_id=stored.id,
        level=body.level,
        proposal_id=proposal.id,
        weights=list(body.weights),
    )
    db.add(row)
    db.commit()
    return SavedChoice(
        id=row.id,
        profile_id=row.profile_id,
        level=row.level,
        proposal_id=row.proposal_id,
        weights=row.weights,
        saved_at=iso_z(row.saved_at),
    )


@router.delete("/choices/{choice_id}", status_code=204, response_class=Response)
def delete_choice(choice_id: str, user: CurrentUser, db: Db) -> Response:
    row = db.get(Choice, choice_id)
    # cudzy wybór wygląda tak samo jak nieistniejący
    if row is None or row.user_id != user.id:
        raise ApiError(404, "not_found", "Nie znaleziono zapisanego wyboru.")
    db.delete(row)
    db.commit()
    return Response(status_code=204)
