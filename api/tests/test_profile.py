"""
Punktacja profilu. Te same przypadki co w web/src/domain/profile.test.ts, łącznie z testem monotoniczności
(pogorszenie jednej odpowiedzi nigdy nie może podnieść profilu).
"""

import itertools

import pytest
from pydantic import ValidationError

from app.schemas import ProfileRequest
from app.services.plan import HORIZON_YEARS, MONTHLY_PLN, START_PLN, plan_from_request
from app.services.profile import apply_level_shift, compute_profile, to_score

# Odpowiedzi „przykładowe” z formularza (web/src/features/onboarding/schema.ts → DEMO_VALUES).
DEMO = {
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


def req(**patch) -> ProfileRequest:
    """Żądanie w takiej postaci, w jakiej wysyła je front (camelCase), z nadpisanymi polami."""
    return ProfileRequest.model_validate({**DEMO, **patch})


class TestToScore:
    def test_zamienia_udzial_na_wynik_zaokraglajac_w_dol(self):
        assert [to_score(x) for x in (0, 0.24, 0.25, 0.5, 0.75, 0.999, 1)] == [1, 1, 2, 3, 4, 4, 5]

    def test_nie_wychodzi_poza_zakres(self):
        assert to_score(-3) == 1
        assert to_score(7) == 5


class TestComputeProfile:
    def test_przykladowe_odpowiedzi_daja_zrownowazony(self):
        p = compute_profile(req())
        assert p.scores.model_dump() == {"capacity": 4, "tolerance": 3, "horizon": 4}
        assert p.level == 3
        assert p.behavior_cap_applied is False
        assert p.goal_cap_applied is False

    def test_najodwazniejsze_daja_5_a_najbardziej_zachowawcze_1(self):
        bold = compute_profile(
            req(
                cushion="tak",
                income="staly",
                loans="brak",
                acceptableDropPct=40,
                reaction="dokupuje",
                riskPreference="ryzyko",
                horizon="ponad10",
            )
        )
        assert bold.level == 5
        timid = compute_profile(
            req(
                cushion="nie",
                income="niepewny",
                loans="ponad40",
                acceptableDropPct=10,
                reaction="wszystko",
                riskPreference="pewne",
                horizon="do3",
            )
        )
        assert timid.level == 1

    def test_wybiera_ostrozniejszy_wynik(self):
        p = compute_profile(
            req(cushion="nie", income="niepewny", loans="ponad40", acceptableDropPct=40, reaction="dokupuje")
        )
        assert (p.scores.tolerance, p.scores.capacity, p.level) == (5, 1, 1)

    def test_kto_sprzedalby_wszystko_nie_ma_tolerancji_powyzej_2(self):
        p = compute_profile(req(acceptableDropPct=40, reaction="wszystko"))
        assert p.scores.tolerance == 2
        assert p.behavior_cap_applied is True
        assert p.level == 2

    def test_krotki_horyzont_ogranicza_profil(self):
        p = compute_profile(req(horizon="do3"))
        assert (p.scores.horizon, p.level) == (2, 2)

    def test_cel_poduszka_ogranicza_do_najnizszego(self):
        p = compute_profile(req(goal="poduszka"))
        assert (p.level, p.goal_cap_applied) == (1, True)

    def test_goal_cap_false_gdy_profil_i_tak_najnizszy(self):
        p = compute_profile(req(goal="poduszka", cushion="nie", income="niepewny", loans="ponad40"))
        assert (p.level, p.goal_cap_applied) == (1, False)

    def test_poziom_wiedzy_zalezy_od_quizu_i_doswiadczenia_ale_nie_od_ryzyka(self):
        none = compute_profile(req(experience=["lok"], quiz={"q1": None, "q2": None, "q3": None}))
        assert (none.knowledge, none.quiz_correct) == ("podstawowa", 0)
        two = compute_profile(req(experience=[], quiz={"q1": "b", "q2": "b", "q3": "c"}))
        assert (two.knowledge, two.quiz_correct) == ("srednia", 2)
        etf_only = compute_profile(req(experience=["etf"], quiz={"q1": "nw", "q2": "nw", "q3": "nw"}))
        assert etf_only.knowledge == "srednia"
        good = compute_profile(req(experience=["akc"], quiz={"q1": "b", "q2": "b", "q3": "b"}))
        assert good.knowledge == "dobra"
        assert good.level == none.level


class TestMonotonicznosc:
    # Każda lista idzie od odpowiedzi „lepszej dla ryzyka” do „gorszej”.
    LADDERS = {
        "cushion": ["tak", "czesciowo", "nie"],
        "income": ["staly", "zmienny", "niepewny"],
        "loans": ["brak", "do20", "20do40", "ponad40"],
        "acceptableDropPct": [40, 30, 20, 10],
        "reaction": ["dokupuje", "czekam", "czesc", "wszystko"],
        "riskPreference": ["ryzyko", "pewne"],
        "horizon": ["ponad10", "5do10", "3do5", "do3"],
        "goal": ["mieszkanie", "poduszka"],
    }

    def test_pogorszenie_jednej_odpowiedzi_nigdy_nie_podnosi_profilu(self):
        keys = list(self.LADDERS)
        checked = 0
        for combo in itertools.product(*(self.LADDERS[k] for k in keys)):
            current = dict(zip(keys, combo, strict=True))
            here = compute_profile(req(**current))
            for key in keys:
                ladder = self.LADDERS[key]
                position = ladder.index(current[key])
                if position + 1 >= len(ladder):
                    continue
                after = compute_profile(req(**{**current, key: ladder[position + 1]}))
                assert after.level <= here.level
                assert after.scores.capacity <= here.scores.capacity
                assert after.scores.tolerance <= here.scores.tolerance
                assert after.scores.horizon <= here.scores.horizon
                checked += 1
        assert checked > 10_000


class TestPoziomIPlan:
    def test_apply_level_shift(self):
        assert [apply_level_shift(3, s) for s in (-1, 0, 1)] == [2, 3, 4]
        assert apply_level_shift(5, 1) == 5
        assert apply_level_shift(1, -1) == 1

    def test_plan_z_przedzialow(self):
        plan = plan_from_request(req())
        assert (plan.start_pln, plan.monthly_pln, plan.years, plan.target_pln) == (12_500, 650, 7, 100_000)
        assert plan_from_request(req(targetAmountPLN=None)).target_pln is None
        assert set(START_PLN) == {"do5k", "5do20k", "20do50k", "ponad50k"}
        assert set(MONTHLY_PLN) == {"do300", "300do1000", "1000do3000", "ponad3000"}
        assert set(HORIZON_YEARS) == {"do3", "3do5", "5do10", "ponad10"}


class TestWalidacjaZadania:
    """Backend sprawdza kształt żądania sam — nie ufa temu, co przysłała przeglądarka."""

    @pytest.mark.parametrize(
        "patch",
        [
            {"goal": "kasyno"},
            {"horizon": "100lat"},
            {"acceptableDropPct": 15},
            {"experience": ["kryptowaluty"]},
            {"quiz": {"q1": "z", "q2": None, "q3": None}},
            {"targetAmountPLN": -5},
            {"targetAmountPLN": 0},
            {"displayCurrency": "eur"},
        ],
    )
    def test_odrzuca_niepoprawne_wartosci(self, patch):
        with pytest.raises(ValidationError):
            req(**patch)

    def test_brakujace_pole_jest_bledem(self):
        broken = dict(DEMO)
        del broken["cushion"]
        with pytest.raises(ValidationError):
            ProfileRequest.model_validate(broken)

    def test_cel_moze_byc_null(self):
        assert req(targetAmountPLN=None).target_amount_pln is None
