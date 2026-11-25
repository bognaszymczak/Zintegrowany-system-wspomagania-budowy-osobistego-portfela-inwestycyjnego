"""
Ocena ryzyka. Te same przypadki i liczby co w web/src/domain/portfolio/assessment.test.ts
(szczegóły: 3,78% → 5,10%, wodospad o dwóch krokach, teksty podsumowania).
"""

import pytest

from app.services.assessment import AssessmentInput, assess_portfolio, build_waterfall, risk_contributions
from app.services.plan import SKETCH_PLAN
from app.services.profiles import profile_by_level
from app.services.risk_model import DEFAULT_MODEL, get_risk_model, loss_probability

BASE = [18, 15, 5, 20, 10, 15, 17]
START = [20, 20, 6, 18, 8, 15, 13]
NBSP = " "


def make_input(weights, base_weights=BASE):
    return AssessmentInput(
        weights=weights,
        base_weights=base_weights,
        base_name="Równowaga",
        plan=SKETCH_PLAN,
        profile=profile_by_level(3),
    )


class TestSzansaNaDuzaStrate:
    def test_liczby_ze_szkicu_ekranu_8(self):
        assert loss_probability(BASE) * 100 == pytest.approx(3.78, abs=0.005)
        assert loss_probability(START) * 100 == pytest.approx(5.1, abs=0.005)
        assert loss_probability(START, vol_multiplier=1) * 100 == pytest.approx(3.49, abs=0.005)

    def test_wiecej_akcji_i_wyzszy_mnoznik_zwiekszaja_szanse(self):
        assert loss_probability(START) > loss_probability(BASE)
        assert loss_probability(START, vol_multiplier=1.3) > loss_probability(START, vol_multiplier=1)


class TestPrzykladZeSzkicu:
    a = assess_portfolio(make_input(START))

    def test_poziom_ryzyka_i_n_na_100(self):
        a = self.a
        assert (a.sri, a.sri_word, a.base_sri) == (4, "podwyższone", 3)
        assert (a.per100, a.per100_base) == (5, 4)
        assert a.changed is True
        assert a.changed_count == 6

    def test_najgorszy_rok_i_pieniadze_w_kryzysie(self):
        a = self.a
        assert a.worst_year == pytest.approx(-0.1653, abs=1e-3)
        assert a.money_at_worst == 16_700
        c2008 = next(c for c in a.crises if c.id == "y2008")
        assert c2008.mine == pytest.approx(-0.165, abs=1e-3)
        assert c2008.base == pytest.approx(-0.132, abs=1e-3)
        assert c2008.left_pln == 16_700
        assert c2008.left_base_pln == 17_400
        c2022 = next(c for c in a.crises if c.id == "y2022")
        assert c2022.mine == pytest.approx(-0.121, abs=1e-3)
        assert c2022.left_pln == 17_600

    def test_wodospad_dwa_kroki_suma_rowna_roznicy(self):
        w = self.a.waterfall
        assert [s.kind for s in w] == ["start", "step", "step", "end"]
        assert w[0].label == "Propozycja „Równowaga”"
        assert w[0].value == pytest.approx(3.78, abs=0.005)
        assert w[1].label == "4 pkt proc. mniej gotówki, więcej akcji"
        assert w[1].delta == pytest.approx(0.73, abs=0.05)
        assert w[2].label == "4 pkt proc. mniej obligacji, więcej akcji"
        assert w[2].delta == pytest.approx(0.59, abs=0.05)
        assert w[3].label == "Twoja wersja"
        assert w[3].value == pytest.approx(5.1, abs=0.005)
        delta_sum = sum(s.delta or 0 for s in w)
        assert w[0].value + delta_sum == pytest.approx(w[3].value, abs=1e-9)

    def test_udzial_w_ryzyku(self):
        akcje, obligacje, zloto, gotowka = self.a.contributions
        assert akcje.weight_pct == 46
        assert akcje.risk_pct == pytest.approx(81.7, abs=0.05)
        assert obligacje.risk_pct == pytest.approx(7.9, abs=0.05)
        assert zloto.risk_pct == pytest.approx(10.3, abs=0.05)
        assert gotowka.risk_pct == pytest.approx(0, abs=0.5)
        assert sum(c.risk_pct for c in self.a.contributions) == pytest.approx(100, abs=1e-6)
        assert self.a.contribution_note == (
            "Akcje to 46% Twoich pieniędzy, ale aż 82% ryzyka. Pozostałe grupy wygładzają wahania."
        )

    def test_podsumowanie_po_ludzku_i_kompromis(self):
        assert [t.text for t in self.a.takeaways] == [
            "Mieści się w limitach Twojego profilu „Zrównoważony”.",
            "Jest ryzykowniejszy niż propozycja „Równowaga” (4 z 7 zamiast 3 z 7).",
            f"W złym roku wartość może spaść o ok. 16,5%. Z 20{NBSP}000 zł zostałoby wtedy ok. 16{NBSP}700 zł.",
        ]
        assert self.a.trade_off == (
            "Twoje zmiany zwiększają szansę dużej straty o 1,3 pkt proc., a typowy wynik po 10 latach "
            f"rośnie z 108{NBSP}400 zł do 110{NBSP}300 zł."
        )

    def test_zakres_wynikow_i_opis_modelu(self):
        a = self.a
        assert round(a.summary.median / 100) * 100 == 110_300
        assert a.summary.paid_in == 80_000
        assert a.summary.goal_pln == 100_000
        assert a.fan[-1].median == pytest.approx(a.summary.median, abs=1e-6)
        assert a.model.kind == "demo-analytic"
        assert a.model.regime.vol_multiplier == 1.15
        assert a.model.p_loss_without_regime == pytest.approx(3.49, abs=0.005)


class TestPrzypadkiBrzegowe:
    def test_bez_zmian(self):
        a = assess_portfolio(make_input(BASE))
        assert a.changed is False
        assert len(a.waterfall) == 2
        assert a.waterfall[0].value == a.waterfall[1].value
        assert a.takeaways[1].text == "To dokładnie propozycja „Równowaga” — bez Twoich zmian."
        assert a.trade_off == "Propozycja nie została zmieniona, więc ocena dotyczy dokładnie „Równowaga”."

    def test_przesuniecie_tylko_wewnatrz_grupy(self):
        moved = [15, 18, 5, 20, 10, 15, 17]  # 3 pkt z „świata” do USA
        w = build_waterfall(BASE, moved, "Równowaga")
        assert [s.kind for s in w] == ["start", "step", "end"]
        assert w[1].label.startswith("Zmiany w obrębie grup")
        assert w[0].value + (w[1].delta or 0) == pytest.approx(w[2].value, abs=1e-9)

    def test_kilku_odbiorcow_etykieta_wymienia_wszystkie_grupy(self):
        final = [24, 15, 5, 20, 10, 19, 7]  # 10 pkt z gotówki: 6 do akcji świata, 4 do złota
        w = build_waterfall(BASE, final, "Równowaga")
        donor = next(s for s in w if s.kind == "step")
        assert donor.label == "10 pkt proc. mniej gotówki, więcej akcji i złota"
        assert w[0].value + sum(s.delta or 0 for s in w) == pytest.approx(w[-1].value, abs=1e-9)

    def test_ostrzega_gdy_wychodzi_poza_limity(self):
        a = assess_portfolio(make_input([0, 55, 0, 0, 0, 0, 45]))
        assert a.limits.ok is False
        assert a.takeaways[0].tone == "warn"
        assert a.takeaways[0].text.startswith("Wychodzi poza limity Twojego profilu „Zrównoważony”: ")

    def test_spokojniejsza_wersja(self):
        a = assess_portfolio(make_input([10, 9, 3, 27, 13, 14, 24]))
        assert a.takeaways[1].tone == "down"
        assert a.takeaways[1].text == "Jest spokojniejszy niż propozycja „Równowaga” (2 z 7 zamiast 3 z 7)."

    def test_udzial_w_ryzyku_sumuje_sie_do_100(self):
        for w in (BASE, START, [0, 55, 0, 0, 0, 0, 45], [14, 12, 4, 23, 12, 12, 23]):
            assert sum(c.risk_pct for c in risk_contributions(w)) == pytest.approx(100, abs=1e-6)


class TestWyborModelu:
    def test_bez_sciezki_dziala_model_zastepczy(self):
        assert get_risk_model(None) is DEFAULT_MODEL
        assert get_risk_model("") is DEFAULT_MODEL

    def test_sciezka_bez_gotowego_modelu_daje_czytelny_blad(self):
        with pytest.raises(NotImplementedError, match="MlRiskModel"):
            get_risk_model("models/risk_v1.joblib")

    def test_wlasny_model_jest_uzywany_w_calej_ocenie(self):
        class AlwaysTenPercent:
            kind = "ml"
            name = "model testowy"
            version = "test-1"
            trained_on = "dane testowe"
            reliability = "wysoka"
            reliability_note = "test"

            def loss_probability(self, weights, a, vol_multiplier=None):
                return 0.10

        a = assess_portfolio(make_input(START), model=AlwaysTenPercent())
        assert a.loss_chance_pct == pytest.approx(10)
        assert a.loss_chance_base_pct == pytest.approx(10)
        assert a.model.kind == "ml" and a.model.name == "model testowy"
        assert a.per100 == 10
