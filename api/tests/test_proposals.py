"""Propozycje portfeli. Te same przypadki co w web/src/domain/portfolio/proposals.test.ts."""

from app.services.engine import check_limits, is_valid_weights, portfolio_metrics
from app.services.jsfmt import js_round
from app.services.plan import SKETCH_PLAN
from app.services.profiles import PROFILES, profile_by_level
from app.services.proposals import evaluate_proposals, find_proposal, proposal_views, proposals_for_level

LEVELS = [1, 2, 3, 4, 5]


def test_kazdy_poziom_ma_trzy_propozycje():
    for level in LEVELS:
        proposals = proposals_for_level(level)
        assert [p.name for p in proposals] == ["Stabilność", "Równowaga", "Wzrost"]
        assert len({p.id for p in proposals}) == 3


def test_udzialy_sa_poprawne_siedem_liczb_calkowitych_suma_100():
    for level in LEVELS:
        for p in proposals_for_level(level):
            assert is_valid_weights(p.weights)
            assert all(isinstance(x, int) for x in p.weights)


def test_kazda_propozycja_mieści_sie_w_limitach_swojego_profilu():
    for level in LEVELS:
        profile = profile_by_level(level)
        for p in proposals_for_level(level):
            check = check_limits(portfolio_metrics(p.weights, SKETCH_PLAN), profile)
            assert [f"{p.id}: {v.message}" for v in check.violations] == []


def test_wahania_i_udzial_akcji_rosna_od_stabilnosci_do_wzrostu():
    for level in LEVELS:
        a, b, c = (portfolio_metrics(p.weights, SKETCH_PLAN) for p in proposals_for_level(level))
        assert a.sigma < b.sigma < c.sigma
        assert a.equity_pct < b.equity_pct < c.equity_pct
        assert a.sri <= c.sri


def test_wzrost_uzywa_limitu_akcji_profilu():
    for level in (2, 3, 4):
        wzrost = proposals_for_level(level)[2]
        m = portfolio_metrics(wzrost.weights, SKETCH_PLAN)
        assert m.equity_pct == js_round(profile_by_level(level).max_equity * 100)


def test_poziomy_sie_nie_zlewaja():
    sigma = [portfolio_metrics(proposals_for_level(lv)[1].weights, SKETCH_PLAN).sigma for lv in LEVELS]
    assert all(later > earlier for earlier, later in zip(sigma, sigma[1:], strict=False))


def test_rownowaga_dla_zrownowazonego_to_portfel_ze_szkicu():
    assert proposals_for_level(3)[1].weights == [18, 15, 5, 20, 10, 15, 17]


def test_find_proposal_czyta_identyfikator_i_odrzuca_bledny():
    assert find_proposal("L3-rownowaga").name == "Równowaga"
    assert find_proposal("L5-wzrost").level == 5
    assert find_proposal("L6-wzrost") is None
    assert find_proposal("L3-nieistnieje") is None
    assert find_proposal("") is None
    assert find_proposal("L3-rownowaga; DROP TABLE") is None


def test_zwrocone_tablice_to_kopie():
    first = proposals_for_level(3)[0]
    first.weights[0] = 99
    assert proposals_for_level(3)[0].weights[0] == 10


def test_evaluate_proposals_dodaje_metryki_i_flage_limitow():
    with_goal = evaluate_proposals(3, SKETCH_PLAN)
    assert all(p.within_limits for p in with_goal)
    assert with_goal[1].group_totals == [38, 30, 15, 17]
    assert with_goal[1].metrics.sri == 3
    no_goal = evaluate_proposals(3, SKETCH_PLAN.model_copy(update={"target_pln": None}))
    assert all(p.metrics.goal_probability is None for p in no_goal)


def test_poziomy_profili_pokrywaja_sie_z_propozycjami():
    assert [p.level for p in PROFILES] == LEVELS


def test_proposal_views_ma_ksztalt_odpowiedzi_api():
    views = proposal_views(3, SKETCH_PLAN)
    body = views[1].model_dump(by_alias=True)
    # nazwy pól dokładnie takie, jakich oczekuje front (web/src/api/types.ts → ProposalView)
    assert set(body) == {
        "id", "level", "kind", "name", "tag", "idea", "weights", "groupTotals", "sri", "sriWord",
        "medianPLN", "p10PLN", "p90PLN", "worstYear", "goalProbability", "annualCost", "withinLimits",
    }  # fmt: skip
    assert body["id"] == "L3-rownowaga"
    assert body["sri"] == 3 and body["withinLimits"] is True
    assert round(body["medianPLN"] / 100) * 100 == 108_400
