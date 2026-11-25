"""Symulacja wsteczna, dane przykładowe i estymacja założeń z historii."""

import numpy as np
import pytest

from app.services.assessment import (  # noqa: F401  (import sprawdza brak cykli)
    AssessmentInput,
    assess_portfolio,
)
from app.services.assumptions import SAMPLE_ASSUMPTIONS
from app.services.backtest import BACKTEST_START_PLN, MonthlyHistory, max_drawdown, simulate_backtest
from app.services.dates import month_range
from app.services.demo_history import generate_demo_history
from app.services.engine import scenario_return
from app.services.estimation import estimate_assumptions, regime_from_vix

BASE = [18, 15, 5, 20, 10, 15, 17]
history = generate_demo_history()
sim = simulate_backtest(BASE, history)


def at(month: str) -> int:
    return sim.dates.index(month)


class TestMonthRange:
    def test_wlacznie_z_koncami_przez_granice_roku(self):
        assert month_range("2007-11", "2008-02") == ["2007-11", "2007-12", "2008-01", "2008-02"]


class TestDaneDemo:
    def test_217_punktow_i_deterministycznosc(self):
        assert history.dates[0] == "2007-12" and history.dates[-1] == "2025-12"
        assert len(history.dates) == 217
        assert generate_demo_history().returns == history.returns  # to samo ziarno → te same liczby
        assert all(len(row) == 7 for row in history.returns)
        assert history.returns[0] == [0.0] * 7

    def test_zwroty_sa_skonczone_i_nie_ponizej_minus_60_procent(self):
        flat = np.asarray(history.returns)
        assert np.isfinite(flat).all() and flat.min() > -0.7

    def test_kryzysy_odtwarzaja_scenariusze_dla_kazdego_instrumentu(self):
        for crisis_id, first, last in (
            ("y2008", "2008-01", "2008-12"),
            ("y2020", "2020-02", "2020-03"),
            ("y2022", "2022-01", "2022-12"),
        ):
            scenario = next(s for s in SAMPLE_ASSUMPTIONS.scenarios if s.id == crisis_id)
            rows = [k for k, d in enumerate(history.dates) if first <= d <= last]
            compounded = np.prod(1 + np.asarray(history.returns)[rows], axis=0) - 1
            assert compounded == pytest.approx(scenario.returns, abs=1e-9)

    def test_w_dlugim_okresie_rynek_rosnie_zgodnie_z_zalozeniami(self):
        # (μ − σ²/2) · lata dla instrumentu „Akcje USA”: kalibracja ustawia to dokładnie
        years = (len(history.dates) - 1) / 12
        log_growth = float(np.log1p(np.asarray(history.returns)[1:, 1]).sum())
        expected = (SAMPLE_ASSUMPTIONS.mu[1] - SAMPLE_ASSUMPTIONS.sigma[1] ** 2 / 2) * years
        assert log_growth == pytest.approx(expected, abs=1e-9)


class TestSymulacjaWsteczna:
    def test_wszystkie_serie_tej_samej_dlugosci_dodatnie_i_zaczynaja_od_kwoty_startowej(self):
        for series in (sim.portfolio, sim.sp500, sim.inflation, sim.deposit):
            assert len(series) == 217
            assert series[0] == BACKTEST_START_PLN
            assert all(v > 0 and np.isfinite(v) for v in series)

    def test_kryzys_2008_sp500_spada_o_37_procent(self):
        assert sim.sp500[at("2008-12")] / sim.sp500[at("2007-12")] - 1 == pytest.approx(-0.37, abs=0.01)

    def test_portfel_w_kryzysach_traci_tyle_co_mowi_scenariusz(self):
        # kryzysy na pełny rok kalendarzowy (2008, 2022): dokładnie; 2020 (luty–marzec) po styczniowym dryfie: w przybliżeniu
        for crisis_id, first, last, tolerance in (
            ("y2008", "2007-12", "2008-12", 1e-6),
            ("y2022", "2021-12", "2022-12", 1e-6),
            ("y2020", "2020-01", "2020-03", 0.01),
        ):
            scenario = next(s for s in SAMPLE_ASSUMPTIONS.scenarios if s.id == crisis_id)
            actual = sim.portfolio[at(last)] / sim.portfolio[at(first)] - 1
            assert actual == pytest.approx(scenario_return(BASE, scenario), abs=tolerance), crisis_id

    def test_miesieczne_przebalansowanie_daje_inny_wynik_niz_coroczne(self):
        # przy trendzie spadkowym przebalansowanie co miesiąc dokupuje spadające akcje, więc strata jest większa
        monthly = simulate_backtest(BASE, history, rebalance="monthly")
        assert monthly.portfolio[at("2008-12")] < sim.portfolio[at("2008-12")]

    def test_dlugi_okres_akcje_usa_2_do_4_razy_i_portfel_bije_inflacje_i_lokate(self):
        assert 2 * BACKTEST_START_PLN < sim.stats.sp500_end < 4 * BACKTEST_START_PLN
        assert sim.stats.portfolio_end > sim.stats.inflation_end
        assert sim.stats.portfolio_end > sim.stats.deposit_end
        assert -0.6 < sim.stats.sp500_max_drawdown < -0.3
        assert sim.stats.portfolio_max_drawdown > sim.stats.sp500_max_drawdown

    def test_bardziej_akcyjny_portfel_ma_glebszy_spadek(self):
        calm = simulate_backtest([2, 1, 0, 31, 16, 10, 40], history)
        bold = simulate_backtest([30, 30, 24, 3, 2, 7, 4], history)
        assert bold.stats.portfolio_max_drawdown < calm.stats.portfolio_max_drawdown < 0

    def test_ksztalt_odpowiedzi_api(self):
        body = sim.model_dump(by_alias=True)
        assert set(body) == {
            "startPLN",
            "dates",
            "portfolio",
            "sp500",
            "inflation",
            "deposit",
            "crises",
            "stats",
            "source",
        }
        assert [c["label"] for c in body["crises"]] == ["2008", "2020", "2022"]
        assert set(body["crises"][0]) == {"id", "label", "from", "to"}

    def test_mechanika_na_prostym_przykladzie(self):
        # każdy instrument +1% miesięcznie, inflacja 0,5%, lokata 0,25% → po 2 miesiącach znane wartości
        simple = MonthlyHistory(
            dates=["2020-01", "2020-02", "2020-03"],
            returns=[[0.0] * 7, [0.01] * 7, [0.01] * 7],
            inflation=[0.0, 0.005, 0.005],
            deposit=[0.0, 0.0025, 0.0025],
            source="test",
        )
        result = simulate_backtest(BASE, simple, start_pln=1000)
        assert result.portfolio[-1] == pytest.approx(1000 * 1.01**2)
        assert result.inflation[-1] == pytest.approx(1000 * 1.005**2)
        assert result.deposit[-1] == pytest.approx(1000 * 1.0025**2)
        assert result.stats.portfolio_max_drawdown == 0

    def test_zla_historia_jest_odrzucana(self):
        with pytest.raises(ValueError):
            simulate_backtest(
                BASE,
                MonthlyHistory(dates=["2020-01"], returns=[[0] * 7], inflation=[0], deposit=[0], source=""),
            )
        with pytest.raises(ValueError):
            simulate_backtest(
                BASE,
                MonthlyHistory(
                    dates=["2020-01", "2020-02"],
                    returns=[[0] * 7, [0] * 6],
                    inflation=[0, 0],
                    deposit=[0, 0],
                    source="",
                ),
            )

    def test_max_drawdown(self):
        assert max_drawdown([100, 120, 90, 130]) == pytest.approx(-0.25)
        assert max_drawdown([100, 110, 120]) == 0


class TestEstymacja:
    est = estimate_assumptions(history.dates[1:], history.returns[1:], as_of="2026-11-04", shrink=0.0)

    def test_ksztalty_i_macierz_korelacji(self):
        e = self.est
        assert len(e.mu) == len(e.sigma) == len(e.ter) == 7
        corr = np.asarray(e.corr)
        assert corr.shape == (7, 7)
        assert np.allclose(corr, corr.T) and np.allclose(np.diag(corr), 1)
        assert corr.min() >= -1 and corr.max() <= 1
        assert np.linalg.eigvalsh(corr).min() > -1e-9  # macierz korelacji musi być dodatnio półokreślona

    def test_wahania_i_zwroty_blisko_zalozen_z_ktorych_powstaly_dane(self):
        for estimated, original in zip(self.est.sigma, SAMPLE_ASSUMPTIONS.sigma, strict=True):
            assert estimated == pytest.approx(original, rel=0.35)
        # akcje: oczekiwany zwrot z danych w granicach ±2 p.p. od założeń
        for i in (0, 1, 2):
            assert self.est.mu[i] == pytest.approx(SAMPLE_ASSUMPTIONS.mu[i], abs=0.02)

    def test_scenariusze_kryzysowe_sa_mierzone_z_danych(self):
        for measured, original in zip(self.est.scenarios, SAMPLE_ASSUMPTIONS.scenarios, strict=True):
            assert measured.id == original.id
            assert measured.returns == pytest.approx(original.returns, abs=1e-9)

    def test_shrink_sciaga_zwroty_do_wartosci_bazowych(self):
        full = estimate_assumptions(history.dates[1:], history.returns[1:], as_of="x", shrink=1.0)
        assert full.mu == pytest.approx(SAMPLE_ASSUMPTIONS.mu)

    def test_koszty_i_progi_zostaja_z_bazy(self):
        assert self.est.ter == SAMPLE_ASSUMPTIONS.ter
        assert self.est.risk_thresholds == SAMPLE_ASSUMPTIONS.risk_thresholds

    def test_krotka_historia_i_braki_danych_sa_bledem(self):
        with pytest.raises(ValueError, match="za krótka"):
            estimate_assumptions(history.dates[1:30], history.returns[1:30], as_of="x")
        broken = [list(row) for row in history.returns[1:]]
        broken[10][2] = float("nan")
        with pytest.raises(ValueError, match="braki danych"):
            estimate_assumptions(history.dates[1:], broken, as_of="x")
        with pytest.raises(ValueError):
            estimate_assumptions(
                history.dates[1:], history.returns[2:], as_of="x"
            )  # inna liczba wierszy niż dat

    def test_stala_seria_nie_psuje_korelacji(self):
        flat = [list(row) for row in history.returns[1:]]
        for row in flat:
            row[6] = 0.002  # gotówka bez żadnych wahań
        e = estimate_assumptions(history.dates[1:], flat, as_of="x")
        corr = np.asarray(e.corr)
        assert np.isfinite(corr).all() and corr[6, 6] == 1

    def test_okno_kryzysu_poza_historia_zostawia_wartosci_bazowe(self):
        short = estimate_assumptions(
            history.dates[100:], history.returns[100:], as_of="x"
        )  # od 2016 — bez 2008
        y2008 = next(s for s in short.scenarios if s.id == "y2008")
        assert y2008.returns == SAMPLE_ASSUMPTIONS.scenarios[0].returns


class TestKlimatRynku:
    def test_progi_vix(self):
        assert regime_from_vix(12).id == "spokojny" and regime_from_vix(12).vol_multiplier == 1.0
        assert regime_from_vix(22).id == "podwyzszony" and regime_from_vix(22).vol_multiplier == 1.15
        assert regime_from_vix(40).id == "kryzysowy"

    def test_vix_trafia_do_zalozen(self):
        e = estimate_assumptions(history.dates[1:], history.returns[1:], as_of="x", vix=35)
        assert e.regime.id == "kryzysowy" and e.regime.vix == 35
