"""
Silnik obliczeń. Te same przypadki i liczby co w web/src/domain/portfolio/engine.test.ts —
jeśli którykolwiek test różni się wynikiem między TypeScriptem a Pythonem, to znaczy, że wersje się rozjechały.
"""

import math

import pytest

from app.services.engine import (
    check_limits,
    fan_series,
    goal_probability,
    group_totals,
    is_valid_weights,
    normal_cdf,
    portfolio_metrics,
    risk_indicator,
    risk_word,
    student_t5_cdf,
)
from app.services.jsfmt import js_round
from app.services.plan import SKETCH_PLAN
from app.services.profiles import profile_by_level

# Propozycja „Równowaga” i ustawienie początkowe suwaków ze szkicu ekranów.
BASE = [18, 15, 5, 20, 10, 15, 17]
START = [20, 20, 6, 18, 8, 15, 13]


def round100(x: float) -> int:
    return js_round(x / 100) * 100


class TestRozklady:
    def test_dystrybuanta_normalna_wartosci_tablicowe(self):
        assert normal_cdf(0) == pytest.approx(0.5, abs=1e-6)
        assert normal_cdf(1.96) == pytest.approx(0.975, abs=1e-4)
        assert normal_cdf(-1) == pytest.approx(0.158655, abs=1e-5)

    def test_t5_zgadza_sie_z_calkowaniem_numerycznym_gestosci(self):
        def pdf(t: float) -> float:
            return (8 / (3 * math.pi * math.sqrt(5))) * (1 + t * t / 5) ** -3

        def simpson(b: float, n: int = 4000) -> float:
            h = b / n
            s = pdf(0) + pdf(b)
            for i in range(1, n):
                s += pdf(i * h) * (4 if i % 2 else 2)
            return s * h / 3

        for x in (-3, -1.5, -0.3, 0, 0.7, 2.2):
            numeric = 0.5 + (simpson(x or 1e-12) if x >= 0 else -simpson(-x))
            assert student_t5_cdf(x) == pytest.approx(numeric, abs=1e-6)
        # „grube ogony”: przy −3 odchyleń t(5) daje większą szansę niż rozkład normalny
        assert student_t5_cdf(-3) > normal_cdf(-3)


class TestLiczbyZeSzkicu:
    def test_rownowaga_ekran_6(self):
        m = portfolio_metrics(BASE, SKETCH_PLAN)
        assert m.sri == 3
        assert m.sri_word == "umiarkowane"
        assert round100(m.median) == 108_400
        assert js_round((m.goal_probability or 0) * 100) == 67
        assert m.worst_year == pytest.approx(-0.132, abs=1e-3)
        assert m.annual_cost == pytest.approx(0.0012, abs=1e-4)
        assert m.sigma == pytest.approx(0.0752, abs=1e-4)
        assert m.equity_pct == 38
        assert m.max_position_pct == 20
        assert m.paid_in == 80_000

    def test_ustawienie_poczatkowe_suwakow_ekran_7_i_8(self):
        m = portfolio_metrics(START, SKETCH_PLAN)
        assert m.sri == 4
        assert round100(m.median) == 110_300
        assert round100(m.p10) == 84_200
        assert round100(m.p90) == 145_600
        assert js_round((m.goal_probability or 0) * 100) == 68
        assert m.worst_year == pytest.approx(-0.1653, abs=1e-3)
        assert m.worst_scenario.id == "y2008"
        assert m.equity_pct == 46

    def test_wyniki_w_trzech_kryzysach(self):
        y2008, y2020, y2022 = portfolio_metrics(BASE, SKETCH_PLAN).scenarios
        assert y2008.ret == pytest.approx(-0.132, abs=1e-3)
        assert y2020.ret == pytest.approx(-0.129, abs=1e-3)
        assert y2022.ret == pytest.approx(-0.112, abs=1e-3)


class TestSzansaNaCelISkalaRyzyka:
    def test_bez_celu_nie_ma_prawdopodobienstwa(self):
        assert goal_probability(BASE, SKETCH_PLAN.model_copy(update={"target_pln": None})) is None

    def test_im_wyzszy_cel_tym_mniejsza_szansa(self):
        previous = 1.0
        for goal in (50_000, 80_000, 100_000, 120_000, 160_000, 400_000):
            p = goal_probability(BASE, SKETCH_PLAN.model_copy(update={"target_pln": goal}))
            assert p is not None and 0 <= p <= previous
            previous = p
        assert goal_probability(BASE, SKETCH_PLAN.model_copy(update={"target_pln": 10_000})) == 1
        assert goal_probability(BASE, SKETCH_PLAN.model_copy(update={"target_pln": 10_000_000})) == 0

    def test_skala_1_7_rosnie_z_wahaniami_progi_wlacznie(self):
        assert risk_indicator(0.001) == 1
        assert risk_indicator(0.02) == 2
        assert risk_indicator(0.0599) == 2
        assert risk_indicator(0.06) == 3
        assert risk_indicator(0.2) == 7
        assert risk_word(3) == "umiarkowane"
        assert risk_word(99) == "najwyższe"

    def test_wiecej_akcji_wieksze_wahania_i_wyzszy_typowy_wynik(self):
        calm = portfolio_metrics([5, 5, 0, 30, 15, 10, 35], SKETCH_PLAN)
        bold = portfolio_metrics([30, 25, 5, 10, 5, 10, 15], SKETCH_PLAN)
        assert bold.sigma > calm.sigma
        assert bold.median > calm.median
        assert bold.worst_year < calm.worst_year


class TestWachlarz:
    def test_zaczyna_od_kwoty_startowej_konczy_na_metrykach_mediana_rosnie(self):
        fan = fan_series(START, SKETCH_PLAN)
        first, last = fan[0], fan[-1]
        assert first.month == 0
        assert first.p10 == pytest.approx(SKETCH_PLAN.start_pln, abs=1e-6)
        assert first.p90 == pytest.approx(SKETCH_PLAN.start_pln, abs=1e-6)
        assert last.month == 120
        assert last.paid_in == 80_000
        m = portfolio_metrics(START, SKETCH_PLAN)
        assert last.median == pytest.approx(m.median, abs=1e-6)
        assert last.p10 == pytest.approx(m.p10, abs=1e-6)
        assert last.p90 == pytest.approx(m.p90, abs=1e-6)
        for previous, point in zip(fan, fan[1:], strict=False):
            assert point.median > previous.median
            assert point.p10 < point.median < point.p90

    def test_krok_nie_dzielacy_horyzontu_dodaje_punkt_koncowy(self):
        fan = fan_series(START, SKETCH_PLAN.model_copy(update={"years": 4}), step_months=5)
        assert [p.month for p in fan] == [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 48]


class TestLimityProfilu:
    zrownowazony = profile_by_level(3)

    def test_rownowaga_i_start_mieszcza_sie_w_profilu(self):
        for w in (BASE, START):
            check = check_limits(portfolio_metrics(w, SKETCH_PLAN), self.zrownowazony)
            assert check.ok
            assert check.violations == []
            assert len(check.items) == 4

    def test_teksty_zgodne_ze_szkicem(self):
        check = check_limits(portfolio_metrics(START, SKETCH_PLAN), self.zrownowazony)
        assert [i.message for i in check.items] == [
            "Akcje 46% (limit 50%)",
            "Największa pozycja 20% (limit 30%)",
            "Najgorszy rok −16,5% (limit −20%)",
            "Wahania ±8,6% (limit ±10%)",
        ]

    def test_wskazuje_wszystkie_przekroczone_limity(self):
        check = check_limits(portfolio_metrics([0, 55, 0, 0, 0, 0, 45], SKETCH_PLAN), self.zrownowazony)
        kinds = [v.kind for v in check.violations]
        assert not check.ok
        assert "equity" in kinds and "position" in kinds
        position = next(v for v in check.violations if v.kind == "position")
        assert position.message == "Największa pozycja 55%: Akcje USA (limit 30%)"

    def test_wartosc_rowna_limitowi_jest_jeszcze_dozwolona(self):
        at_limit = [20, 20, 10, 15, 5, 15, 15]  # akcje dokładnie 50%
        check = check_limits(portfolio_metrics(at_limit, SKETCH_PLAN), self.zrownowazony)
        assert check.items[0].ok


class TestPomocnicze:
    def test_group_totals(self):
        assert group_totals(START) == [46, 26, 15, 13]
        assert group_totals(BASE) == [38, 30, 15, 17]

    def test_is_valid_weights(self):
        assert is_valid_weights(START)
        assert not is_valid_weights([50, 50])
        assert not is_valid_weights([-1, 21, 20, 20, 20, 10, 10])
        assert not is_valid_weights([20, 20, 6, 18, 8, 15, 14])
        assert not is_valid_weights([20, 20, 6, 18, 8, 15, float("nan")])
