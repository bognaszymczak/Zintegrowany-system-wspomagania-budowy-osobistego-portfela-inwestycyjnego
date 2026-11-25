"""
Składanie odpowiedzi API (app/services/responses.py) — to samo, co robią endpointy po wczytaniu danych z bazy,
sprawdzone bez serwera i bez bazy.
"""

from datetime import UTC, datetime

import pytest

from app.errors import ApiError
from app.schemas import ProfileRequest, RiskAssessmentRequest
from app.services.assumptions import assumptions_at
from app.services.plan import plan_from_request
from app.services.profile import compute_profile
from app.services.responses import (
    VALID_DAYS,
    profile_response,
    proposals_response,
    risk_assessment_response,
)
from app.services.risk_model import DEFAULT_MODEL

BASE = [18, 15, 5, 20, 10, 15, 17]  # „Równowaga” dla poziomu 3
START = [20, 20, 6, 18, 8, 15, 13]  # ustawienie początkowe suwaków ze szkicu
MOMENT = datetime(2026, 11, 3, 19, 12, tzinfo=UTC)
ASSUMPTIONS = assumptions_at(MOMENT)


def stored_plan(answers: dict) -> dict:
    """Plan w takiej postaci, w jakiej leży w bazie (JSON z nazwami camelCase)."""
    return plan_from_request(ProfileRequest.model_validate(answers)).model_dump(by_alias=True, mode="json")


class TestProfileResponse:
    def test_kontrakt_i_wartosci_dla_przykladowego_formularza(self, demo_answers):
        request = ProfileRequest.model_validate(demo_answers)
        response = profile_response(
            compute_profile(request), plan_from_request(request), profile_id="abc", created_at=MOMENT
        )
        body = response.model_dump(by_alias=True)
        # nazwy pól dokładnie takie, jakich oczekuje front (web/src/api/types.ts → ProfileResponse)
        assert set(body) == {
            "scores", "level", "behaviorCapApplied", "goalCapApplied", "knowledge", "quizCorrect",
            "profileId", "name", "limits", "plan", "createdAt",
        }  # fmt: skip
        assert body["profileId"] == "abc"
        assert (body["level"], body["name"]) == (3, "Zrównoważony")
        assert body["scores"] == {"capacity": 4, "tolerance": 3, "horizon": 4}
        assert body["limits"] == {
            "volatility": 0.10,
            "maxDrawdown": -0.20,
            "maxEquity": 0.50,
            "maxPosition": 0.30,
        }
        assert body["plan"] == {"startPLN": 12_500, "monthlyPLN": 650, "years": 7, "targetPLN": 100_000}
        assert body["createdAt"] == "2026-11-03T19:12:00.000Z"

    @pytest.mark.parametrize(
        ("patch", "level", "name"),
        [
            # krótki horyzont obniża profil „Zrównoważony” do „Ostrożny”
            ({"horizon": "do3"}, 2, "Ostrożny"),
            # odpowiedzi najbardziej zachowawcze i najodważniejsze (jak w test_profile.py)
            (
                {
                    "cushion": "nie",
                    "income": "niepewny",
                    "loans": "ponad40",
                    "acceptableDropPct": 10,
                    "reaction": "wszystko",
                    "riskPreference": "pewne",
                    "horizon": "do3",
                },
                1,
                "Bardzo ostrożny",
            ),
            (
                {
                    "cushion": "tak",
                    "income": "staly",
                    "loans": "brak",
                    "acceptableDropPct": 40,
                    "reaction": "dokupuje",
                    "riskPreference": "ryzyko",
                    "horizon": "ponad10",
                },
                5,
                "Odważny",
            ),
        ],
    )
    def test_poziom_i_nazwa_zawsze_do_siebie_pasuja(self, demo_answers, patch, level, name):
        request = ProfileRequest.model_validate({**demo_answers, **patch})
        scoring = compute_profile(request)
        response = profile_response(scoring, plan_from_request(request), profile_id="x", created_at=MOMENT)
        assert response.level == scoring.level == level
        assert response.name == name


class TestProposalsResponse:
    def test_trzy_propozycje_z_planem_i_terminem_waznosci(self, demo_answers):
        response = proposals_response(
            profile_id="abc",
            stored_level=3,
            stored_plan=stored_plan(demo_answers),
            level=3,
            assumptions=ASSUMPTIONS,
        )
        assert [p.id for p in response.proposals] == ["L3-stabilnosc", "L3-rownowaga", "L3-wzrost"]
        assert response.proposals[1].weights == BASE
        assert response.plan.years == 7 and response.plan.target_pln == 100_000
        assert (response.as_of, response.valid_until) == ("2026-11-03", "2026-11-10")
        assert VALID_DAYS == 7
        assert all(p.within_limits for p in response.proposals)
        assert set(response.model_dump(by_alias=True)) == {
            "profileId", "level", "plan", "asOf", "validUntil", "proposals",
        }  # fmt: skip

    def test_poziom_mozna_przesunac_o_jeden_ale_nie_o_dwa(self, demo_answers):
        plan = stored_plan(demo_answers)

        def ask(level: int):
            return proposals_response(
                profile_id="abc", stored_level=3, stored_plan=plan, level=level, assumptions=ASSUMPTIONS
            )

        assert [ask(level).level for level in (2, 3, 4)] == [2, 3, 4]
        for level in (1, 5):
            with pytest.raises(ApiError) as error:
                ask(level)
            assert error.value.status == 422
            assert error.value.fields == ["level"]

    def test_bez_celu_nie_ma_prawdopodobienstwa_celu(self, demo_answers):
        demo_answers["targetAmountPLN"] = None
        response = proposals_response(
            profile_id="abc",
            stored_level=3,
            stored_plan=stored_plan(demo_answers),
            level=3,
            assumptions=ASSUMPTIONS,
        )
        assert response.plan.target_pln is None
        assert all(p.goal_probability is None for p in response.proposals)


class TestRiskAssessmentResponse:
    @staticmethod
    def ask(answers: dict, **patch):
        body = {"profileId": "abc", "level": 3, "proposalId": "L3-rownowaga", "weights": START, **patch}
        return risk_assessment_response(
            stored_level=3,
            stored_plan=stored_plan(answers),
            body=RiskAssessmentRequest.model_validate(body),
            assumptions=ASSUMPTIONS,
            model=DEFAULT_MODEL,
        )

    def test_przesuniecie_z_rownowagi_do_ustawienia_ze_szkicu(self, demo_answers):
        response = self.ask(demo_answers)
        assert (response.profile_id, response.proposal_id, response.base_name) == (
            "abc",
            "L3-rownowaga",
            "Równowaga",
        )
        assert response.weights == START
        assert (response.as_of, response.valid_until) == ("2026-11-03", "2026-11-10")
        a = response.assessment
        assert (a.base_sri, a.sri) == (3, 4)  # te same wskaźniki co na ekranach 6 i 8 szkicu
        assert a.changed and a.changed_count > 0
        assert a.limits.ok
        assert a.model.kind == "demo-analytic"

    def test_bez_zmian_ocena_jest_taka_jak_bazowa(self, demo_answers):
        a = self.ask(demo_answers, weights=BASE).assessment
        assert not a.changed and a.changed_count == 0
        assert a.sri == a.base_sri
        assert a.loss_chance_pct == a.loss_chance_base_pct

    def test_kontrakt_odpowiedzi(self, demo_answers):
        body = self.ask(demo_answers).model_dump(by_alias=True)
        assert set(body) == {
            "profileId",
            "proposalId",
            "baseName",
            "weights",
            "plan",
            "asOf",
            "validUntil",
            "assessment",
        }
        assert "lossChancePct" in body["assessment"] and "tradeOff" in body["assessment"]
        assert body["assessment"]["model"]["kind"] == "demo-analytic"

    @pytest.mark.parametrize(
        ("patch", "fields"),
        [
            ({"weights": [20, 20, 6, 18, 8, 15, 14]}, ["weights"]),  # suma 101
            ({"proposalId": "L3-nieistnieje"}, ["proposalId"]),
            ({"proposalId": "L4-rownowaga"}, ["proposalId"]),  # propozycja z innego poziomu
            ({"level": 5, "proposalId": "L5-rownowaga"}, ["level"]),  # o dwa poziomy od wyniku formularza
        ],
    )
    def test_bledny_wybor_to_blad_422_ze_wskazaniem_pola(self, demo_answers, patch, fields):
        with pytest.raises(ApiError) as error:
            self.ask(demo_answers, **patch)
        assert error.value.status == 422
        assert error.value.fields == fields
