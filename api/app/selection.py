"""
Sprawdzanie wyboru użytkownika (propozycja + udziały) — wspólne dla oceny ryzyka i zapisu wyboru.

Backend nie ufa temu, co przysłała przeglądarka: nawet jeśli suwaki w interfejsie pilnują zasad, ktoś może
wysłać żądanie ręcznie. Zasady te same co w atrapach (web/src/mocks/handlers/proposals.ts):
  • poziom profilu można przesunąć najwyżej o jeden względem wyniku formularza,
  • propozycja musi istnieć i należeć do wybranego poziomu,
  • udziały to 7 nieujemnych liczb o sumie 100.
"""

from collections.abc import Sequence

from .errors import ApiError
from .services.engine import is_valid_weights
from .services.proposals import Proposal, find_proposal

INVALID_MESSAGE = "Wysłane dane są niepoprawne."


def validate_selection(
    *, stored_level: int, level: int, proposal_id: str, weights: Sequence[float]
) -> Proposal:
    bad: list[str] = []
    if abs(level - stored_level) > 1:
        bad.append("level")
    proposal = find_proposal(proposal_id)
    if proposal is None or proposal.level != level:
        bad.append("proposalId")
    if not is_valid_weights(weights):
        bad.append("weights")
    if bad or proposal is None:
        raise ApiError(422, "validation_error", INVALID_MESSAGE, bad)
    return proposal
