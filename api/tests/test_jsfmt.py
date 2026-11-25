"""Zaokrąglanie i formatowanie muszą działać jak w JavaScripcie (inaczej front i backend pokażą różne liczby)."""

from app.services.jsfmt import comma, format_pln, join_polish, js_round, pct, to_fixed


def test_js_round_polowki_w_gore():
    # Python: round(2.5) == 2, round(0.5) == 0. JavaScript: Math.round(2.5) == 3, Math.round(0.5) == 1.
    assert [js_round(x) for x in (0.5, 1.5, 2.5, 3.5)] == [1, 2, 3, 4]
    assert [js_round(x) for x in (-0.5, -1.5, -2.5)] == [0, -1, -2]
    assert js_round(0.49999999999999994) == 0
    assert js_round(2.4) == 2 and js_round(2.6) == 3 and js_round(-2.6) == -3


def test_to_fixed_jak_w_js():
    assert to_fixed(0.25, 1) == "0.3"  # Python: f"{0.25:.1f}" == "0.2"
    assert to_fixed(2.5, 0) == "3"
    assert to_fixed(1.005, 2) == "1.00"  # 1.005 to w binarnie 1.00499999…, JS też daje „1.00”
    assert to_fixed(3.14159, 2) == "3.14"
    assert to_fixed(0, 1) == "0.0"
    assert to_fixed(-2.5, 0) == "-3"  # remis zaokrąglany „od zera”, ze znakiem


def test_pct_z_minusem_typograficznym():
    assert pct(-0.2) == "−20%"
    assert pct(-0.1653, 1) == "−16,5%"
    assert pct(0.0752, 1) == "7,5%"
    assert pct(0.1, 0) == "10%"


def test_format_pln_z_twarda_spacja():
    assert format_pln(20000) == "20 000"
    assert format_pln(108400.4) == "108 400"
    assert format_pln(999) == "999"
    assert format_pln(1234567) == "1 234 567"
    assert format_pln(-1234) == "-1 234"


def test_comma_i_join_polish():
    assert comma(3.5) == "3,5"
    assert comma(1.25, 1) == "1,3"
    assert join_polish([]) == ""
    assert join_polish(["akcji"]) == "akcji"
    assert join_polish(["akcji", "złota"]) == "akcji i złota"
    assert join_polish(["a", "b", "c"]) == "a, b i c"
