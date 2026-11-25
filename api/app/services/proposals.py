"""
Trzy propozycje portfeli dla każdego z pięciu poziomów profilu.

W WERSJI DEMO to gotowe szablony — te same co w web/src/domain/portfolio/proposals.ts (ręcznie dobrane i
sprawdzone testami: każdy mieści się w granicach swojego profilu). W WERSJI PRODUKCYJNEJ podmień
`proposals_for_level` na generator: np. optymalizacja średnia–wariancja z ograniczeniami z profilu
(maks. udział akcji i pojedynczej pozycji z `RiskProfile`), a model ML lekko koryguje oczekiwane zwroty.
Reszta (karty, szczegóły, ocena) nie zmienia się, bo czyta tylko `ProposalView`.

Kolejność udziałów: patrz services/instruments.py (świat, USA, EM, obl. skarbowe, obl. korpor., złoto, gotówka).
"""

import re
from dataclasses import dataclass

from ..schemas import MarketAssumptions, Plan, ProposalView
from .assumptions import SAMPLE_ASSUMPTIONS
from .engine import PortfolioMetrics, check_limits, group_totals, portfolio_metrics
from .profiles import profile_by_level

KINDS = ("stabilnosc", "rownowaga", "wzrost")

COPY = {
    "stabilnosc": (
        "Stabilność",
        "Mniej wahań",
        "Najspokojniejszy z trzech: więcej obligacji, złota i gotówki, najmniejsze wahania w danych historycznych.",
    ),
    "rownowaga": (
        "Równowaga",
        "Środek skali",
        "Pieniądze rozłożone tak, by żadna grupa instrumentów nie decydowała o wszystkim.",
    ),
    "wzrost": (
        "Wzrost",
        "Więcej akcji",
        "Najwięcej akcji, na jakie pozwala Twój profil. Model lekko podbija klasy, które ocenia jako mocniejsze.",
    ),
}

# Udziały [stabilność, równowaga, wzrost] dla każdego poziomu profilu.
WEIGHTS: dict[int, tuple[list[int], list[int], list[int]]] = {
    1: (
        [2, 1, 0, 31, 16, 10, 40],
        [3, 2, 1, 30, 15, 11, 38],
        [4, 3, 1, 29, 14, 12, 37],
    ),
    2: (
        [6, 5, 1, 29, 14, 10, 35],
        [9, 8, 3, 27, 13, 12, 28],
        [14, 12, 4, 23, 12, 12, 23],
    ),
    3: (
        [10, 9, 3, 27, 13, 14, 24],
        [18, 15, 5, 20, 10, 15, 17],
        [24, 20, 6, 13, 7, 15, 15],
    ),
    4: (
        [21, 18, 6, 17, 8, 15, 15],
        [27, 23, 8, 11, 6, 15, 10],
        [28, 28, 14, 7, 3, 12, 8],
    ),
    5: (
        [28, 24, 8, 13, 7, 10, 10],
        [29, 29, 14, 8, 4, 10, 6],
        [30, 30, 24, 3, 2, 7, 4],
    ),
}


@dataclass(frozen=True)
class Proposal:
    id: str  # np. „L3-rownowaga” — stały identyfikator, trafia do adresu strony szczegółów
    level: int
    kind: str
    name: str
    tag: str  # krótka etykieta na karcie
    idea: str  # jedno zdanie o pomyśle portfela
    weights: list[int]


def proposal_id(level: int, kind: str) -> str:
    return f"L{level}-{kind}"


def proposals_for_level(level: int) -> list[Proposal]:
    """Trzy propozycje dla danego poziomu, od najspokojniejszej do najbardziej wzrostowej."""
    result = []
    for index, kind in enumerate(KINDS):
        name, tag, idea = COPY[kind]
        result.append(
            Proposal(
                id=proposal_id(level, kind),
                level=level,
                kind=kind,
                name=name,
                tag=tag,
                idea=idea,
                weights=list(WEIGHTS[level][index]),
            )
        )
    return result


_ID_PATTERN = re.compile(r"^L([1-5])-(stabilnosc|rownowaga|wzrost)$")


def find_proposal(proposal: str) -> Proposal | None:
    """Odczytuje propozycję po identyfikatorze (np. z adresu strony); None, gdy identyfikator jest błędny."""
    match = _ID_PATTERN.match(proposal)
    if not match:
        return None
    level = int(match.group(1))
    return next((p for p in proposals_for_level(level) if p.id == proposal), None)


@dataclass(frozen=True)
class EvaluatedProposal:
    """Propozycja razem z liczbami do pokazania na karcie."""

    proposal: Proposal
    group_totals: list[float]
    metrics: PortfolioMetrics
    within_limits: bool


def evaluate_proposals(
    level: int, plan: Plan, a: MarketAssumptions = SAMPLE_ASSUMPTIONS
) -> list[EvaluatedProposal]:
    profile = profile_by_level(level)
    evaluated = []
    for p in proposals_for_level(level):
        metrics = portfolio_metrics(p.weights, plan, a)
        evaluated.append(
            EvaluatedProposal(
                proposal=p,
                group_totals=group_totals(p.weights),
                metrics=metrics,
                within_limits=check_limits(metrics, profile).ok,
            )
        )
    return evaluated


def proposal_views(level: int, plan: Plan, a: MarketAssumptions = SAMPLE_ASSUMPTIONS) -> list[ProposalView]:
    """Dokładnie to, co pokazuje karta na ekranie propozycji (kontrakt: ProposalView)."""
    return [
        ProposalView(
            id=e.proposal.id,
            level=e.proposal.level,
            kind=e.proposal.kind,
            name=e.proposal.name,
            tag=e.proposal.tag,
            idea=e.proposal.idea,
            weights=e.proposal.weights,
            group_totals=e.group_totals,
            sri=e.metrics.sri,
            sri_word=e.metrics.sri_word,
            median_pln=e.metrics.median,
            p10_pln=e.metrics.p10,
            p90_pln=e.metrics.p90,
            worst_year=e.metrics.worst_year,
            goal_probability=e.metrics.goal_probability,
            annual_cost=e.metrics.annual_cost,
            within_limits=e.within_limits,
        )
        for e in evaluate_proposals(level, plan, a)
    ]
