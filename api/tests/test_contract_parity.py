"""
KONTRAKT front ↔ backend sprawdzany automatycznie.

Test czyta pliki TypeScript z web/src i porównuje je z kodem Pythona:
  1. nazwy pól każdej odpowiedzi/żądania API (types.ts i pliki domeny) z modelami w app/schemas.py,
  2. dozwolone wartości odpowiedzi formularza (questionnaire.ts) z typami Literal w schemas.py,
  3. stałe liczbowe: założenia rynkowe, profile, plan z przedziałów, szablony propozycji, instrumenty.

Po co: gdy ktoś zmieni nazwę pola albo wartość tylko po jednej stronie, aplikacja przestałaby działać po
przełączeniu z atrap na backend — a ten test wskaże to od razu, z nazwą pola. Jeśli katalogu web/ nie ma
obok api/ (np. wdrożenie samego backendu), testy są pomijane.
"""

import re
from pathlib import Path
from typing import get_args

import pytest

from app import schemas
from app.services import instruments as py_instruments
from app.services import plan as py_plan
from app.services import profile as py_profile
from app.services import proposals as py_proposals
from app.services.assumptions import SAMPLE_ASSUMPTIONS
from app.services.profiles import PROFILES

WEB_SRC = Path(__file__).resolve().parents[2] / "web" / "src"
pytestmark = pytest.mark.skipif(not WEB_SRC.exists(), reason="brak katalogu web/ obok api/")


def read(relative: str) -> str:
    return (WEB_SRC / relative).read_text(encoding="utf-8")


def strip_comments(text: str) -> str:
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return re.sub(r"(?<!:)//[^\n]*", "", text)


# ---------------------------------------------------------------------------------------------
# Mały parser interfejsów TypeScript (wystarczy do prostych `interface X { pole: typ; }`)
# ---------------------------------------------------------------------------------------------

OPENERS, CLOSERS = "{[(<", "}])>"


def matching_brace(text: str, open_index: int) -> int:
    depth = 0
    for i in range(open_index, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return i
    raise ValueError("niedomknięty nawias klamrowy")


def split_statements(body: str) -> list[str]:
    parts: list[str] = []
    depth = 0
    buffer: list[str] = []
    previous = ""
    for char in body:
        if char in OPENERS:
            depth += 1
        elif char in CLOSERS and not (char == ">" and previous == "="):
            depth -= 1
        if char == ";" and depth == 0:
            parts.append("".join(buffer))
            buffer = []
        else:
            buffer.append(char)
        previous = char
    if "".join(buffer).strip():
        parts.append("".join(buffer))
    return parts


FIELD = re.compile(r"^\s*(?:readonly\s+)?([A-Za-z_]\w*)\s*\??\s*:\s*(.*)$", re.S)


def parse_fields(body: str) -> dict[str, dict | None]:
    fields: dict[str, dict | None] = {}
    for statement in split_statements(body):
        match = FIELD.match(statement)
        if not match:
            continue
        name, type_text = match.group(1), match.group(2).strip()
        nested = None
        if type_text.startswith("{"):
            nested = parse_fields(type_text[1 : matching_brace(type_text, 0)])
        fields[name] = nested
    return fields


INTERFACE = re.compile(r"export\s+interface\s+(\w+)(?:<[^>]*>)?(?:\s+extends\s+([\w\s,]+?))?\s*\{")


def parse_interfaces(text: str) -> dict[str, tuple[list[str], dict[str, dict | None]]]:
    text = strip_comments(text)
    found = {}
    for match in INTERFACE.finditer(text):
        open_index = match.end() - 1
        close = matching_brace(text, open_index)
        parents = [p.strip() for p in (match.group(2) or "").split(",") if p.strip()]
        found[match.group(1)] = (parents, parse_fields(text[open_index + 1 : close]))
    return found


TS_FILES = [
    "api/types.ts",
    "domain/profile.ts",
    "domain/plan.ts",
    "domain/portfolio/assumptions.ts",
    "domain/portfolio/assessment.ts",
    "domain/portfolio/engine.ts",
]


def all_ts_interfaces() -> dict[str, tuple[list[str], dict[str, dict | None]]]:
    merged: dict = {}
    for path in TS_FILES:
        merged.update(parse_interfaces(read(path)))
    return merged


def ts_field_names(name: str, interfaces: dict) -> set[str]:
    parents, fields = interfaces[name]
    names = set(fields)
    for parent in parents:
        names |= ts_field_names(parent, interfaces)
    return names


def py_field_names(model: type[schemas.CamelModel]) -> set[str]:
    return set(model.model_json_schema(by_alias=True)["properties"])


# interfejs TypeScript → model Pydantic o tej samej nazwie (zagnieżdżone obiekty podane osobno)
CONTRACT = [
    "AuthUser", "RegisterRequest", "LoginRequest", "AuthResponse",
    "ProfileRequest", "ProfileScores", "ProfileScoring", "ProfileLimits", "ProfileResponse", "Plan",
    "Scenario", "Regime", "MarketAssumptions", "CrisisPeriod", "BacktestResponse",
    "ProposalView", "ProposalsResponse",
    "FanPoint", "LimitItem", "LimitCheck", "WaterfallStep", "RiskContribution", "CrisisRow", "Takeaway",
    "ModelInfo", "Assessment", "RiskAssessmentRequest", "RiskAssessmentResponse",
    "SaveChoiceRequest", "SavedChoice",
]  # fmt: skip
NESTED = {("BacktestResponse", "stats"): "BacktestStats", ("Assessment", "summary"): "AssessmentSummary"}


@pytest.mark.parametrize("name", CONTRACT)
def test_pola_odpowiedzi_i_zadan_zgadzaja_sie(name: str):
    interfaces = all_ts_interfaces()
    assert name in interfaces, f"nie znaleziono interfejsu {name} w plikach TypeScript"
    model = getattr(schemas, name)
    ts, py = ts_field_names(name, interfaces), py_field_names(model)
    assert ts == py, f"{name}: tylko w TypeScript: {sorted(ts - py)}; tylko w Pythonie: {sorted(py - ts)}"


@pytest.mark.parametrize(("owner", "field"), list(NESTED))
def test_pola_zagniezdzonych_obiektow_zgadzaja_sie(owner: str, field: str):
    interfaces = all_ts_interfaces()
    nested_ts = interfaces[owner][1][field]
    assert nested_ts is not None, f"{owner}.{field} nie jest obiektem w TypeScript"
    model = getattr(schemas, NESTED[(owner, field)])
    assert set(nested_ts) == py_field_names(model)


def test_wszystkie_modele_odpowiedzi_sa_objete_testem():
    """Nowy model w schemas.py bez odpowiednika w TypeScript trzeba świadomie dopisać do listy."""
    covered = set(CONTRACT) | set(NESTED.values()) | {"CamelModel"}
    models = {
        name
        for name, obj in vars(schemas).items()
        if isinstance(obj, type) and issubclass(obj, schemas.BaseModel) and obj.__module__ == schemas.__name__
    }
    assert models - covered == set()


# ---------------------------------------------------------------------------------------------
# Dozwolone wartości odpowiedzi formularza
# ---------------------------------------------------------------------------------------------


def ts_array_block(text: str, const_name: str) -> str:
    match = re.search(rf"export const {const_name}\s*=\s*\[", strip_comments(text))
    assert match, f"brak stałej {const_name}"
    stripped = strip_comments(text)
    depth, start = 0, match.end() - 1
    for i in range(start, len(stripped)):
        depth += stripped[i] == "["
        depth -= stripped[i] == "]"
        if depth == 0:
            return stripped[start : i + 1]
    raise ValueError(const_name)


ENUMS = {
    "GOAL_OPTIONS": schemas.Goal,
    "HORIZON_OPTIONS": schemas.Horizon,
    "START_OPTIONS": schemas.StartBand,
    "MONTHLY_OPTIONS": schemas.MonthlyBand,
    "CUSHION_OPTIONS": schemas.Cushion,
    "INCOME_OPTIONS": schemas.Income,
    "LOANS_OPTIONS": schemas.Loans,
    "REACTION_OPTIONS": schemas.Reaction,
    "RISK_PREFERENCE_OPTIONS": schemas.RiskPreference,
    "EXPERIENCE_OPTIONS": schemas.Experience,
    "EXCLUSION_OPTIONS": schemas.Exclusion,
    "INSTRUMENTS_OPTIONS": schemas.InstrumentsChoice,
    "CURRENCY_OPTIONS": schemas.Currency,
}


@pytest.mark.parametrize(("const_name", "literal"), list(ENUMS.items()))
def test_wartosci_odpowiedzi_formularza(const_name: str, literal):
    block = ts_array_block(read("domain/questionnaire.ts"), const_name)
    ts_values = re.findall(r"value:\s*'([^']+)'", block)
    assert ts_values, const_name
    assert set(ts_values) == set(get_args(literal))


def test_wartosci_spadku_i_odpowiedzi_quizu():
    text = read("domain/questionnaire.ts")
    drops = [int(x) for x in re.findall(r"\d+", ts_array_block(text, "DROP_VALUES"))]
    assert set(drops) == set(get_args(schemas.DropPct))
    answers = re.findall(r"'([^']+)'", ts_array_block(text, "QUIZ_ANSWER_VALUES"))
    assert set(answers) == set(get_args(schemas.QuizAnswer))


def test_poprawne_odpowiedzi_quizu():
    text = strip_comments(read("domain/questionnaire.ts"))
    ts_correct = dict(re.findall(r"id:\s*'(q\d)',\s*prompt:[^\n]*\n\s*correct:\s*'(\w+)'", text))
    assert ts_correct == py_profile.QUIZ_CORRECT


# ---------------------------------------------------------------------------------------------
# Stałe liczbowe
# ---------------------------------------------------------------------------------------------


def numbers(text: str) -> list[float]:
    return [float(x.replace("_", "")) for x in re.findall(r"-?\d[\d_]*(?:\.\d+)?", text)]


def ts_bracket(text: str, key: str) -> str:
    """Zawartość tablicy `key: [ ... ]` (z zagnieżdżeniami) w kodzie TypeScript."""
    text = strip_comments(text)
    match = re.search(rf"\b{key}:\s*\[", text)
    assert match, f"brak pola {key}"
    depth = 0
    for i in range(match.end() - 1, len(text)):
        depth += text[i] == "["
        depth -= text[i] == "]"
        if depth == 0:
            return text[match.end() : i]
    raise ValueError(key)


def test_zalozenia_rynkowe_sa_takie_same():
    text = read("domain/portfolio/assumptions.ts")
    sample = text[text.index("export const SAMPLE_ASSUMPTIONS") :]
    for key, python in (
        ("mu", SAMPLE_ASSUMPTIONS.mu),
        ("sigma", SAMPLE_ASSUMPTIONS.sigma),
        ("ter", SAMPLE_ASSUMPTIONS.ter),
        ("riskThresholds", SAMPLE_ASSUMPTIONS.risk_thresholds),
    ):
        assert numbers(ts_bracket(sample, key)) == pytest.approx(python), key
    flat_corr = [x for row in SAMPLE_ASSUMPTIONS.corr for x in row]
    assert numbers(ts_bracket(sample, "corr")) == pytest.approx(flat_corr)

    ts_scenarios = re.findall(
        r"id:\s*'(y\d{4})',\s*period:\s*'([^']+)',\s*name:\s*'([^']+)',\s*returns:\s*\[([^\]]+)\]", sample
    )
    assert [s[:3] for s in ts_scenarios] == [(s.id, s.period, s.name) for s in SAMPLE_ASSUMPTIONS.scenarios]
    for ts, py in zip(ts_scenarios, SAMPLE_ASSUMPTIONS.scenarios, strict=True):
        assert numbers(ts[3]) == pytest.approx(py.returns)

    regime = re.search(
        r"regime:\s*\{\s*id:\s*'(\w+)',\s*label:\s*'([^']+)',\s*vix:\s*([\d.]+),\s*volMultiplier:\s*([\d.]+)",
        sample,
    )
    assert regime
    r = SAMPLE_ASSUMPTIONS.regime
    assert (regime.group(1), regime.group(2), float(regime.group(3)), float(regime.group(4))) == (
        r.id, r.label, r.vix, r.vol_multiplier,
    )  # fmt: skip
    assert re.search(r"asOf:\s*'([\d-]+)'", sample).group(1) == SAMPLE_ASSUMPTIONS.as_of


def test_profile_ryzyka_sa_takie_same():
    text = strip_comments(read("domain/profiles.ts"))
    rows = re.findall(
        r"level:\s*(\d),\s*name:\s*'([^']+)',\s*volatility:\s*([\d.]+),\s*maxDrawdown:\s*(-[\d.]+),\s*"
        r"maxEquity:\s*([\d.]+),\s*maxPosition:\s*([\d.]+),\s*rangeWord:\s*'([^']+)'",
        text,
    )
    assert len(rows) == 5
    ts = [(int(r[0]), r[1], float(r[2]), float(r[3]), float(r[4]), float(r[5]), r[6]) for r in rows]
    py = [
        (p.level, p.name, p.volatility, p.max_drawdown, p.max_equity, p.max_position, p.range_word)
        for p in PROFILES
    ]
    assert ts == py


def ts_record(text: str, const_name: str) -> dict[str, float]:
    match = re.search(rf"export const {const_name}[^=]*=\s*\{{([^}}]*)\}}", strip_comments(text))
    assert match, const_name
    return {
        k.strip("'"): float(v.replace("_", ""))
        for k, v in re.findall(r"('?\w+'?):\s*([\d_]+)", match.group(1))
    }


def test_plan_z_przedzialow_jest_taki_sam():
    text = read("domain/plan.ts")
    assert ts_record(text, "START_PLN") == py_plan.START_PLN
    assert ts_record(text, "MONTHLY_PLN") == py_plan.MONTHLY_PLN
    assert ts_record(text, "HORIZON_YEARS") == py_plan.HORIZON_YEARS
    sketch = re.search(r"SKETCH_PLAN[^=]*=\s*\{([^}]*)\}", text).group(1)
    assert numbers(sketch) == [20_000, 500, 10, 100_000]
    plan = py_plan.SKETCH_PLAN
    assert (plan.start_pln, plan.monthly_pln, plan.years, plan.target_pln) == (20_000, 500, 10, 100_000)


def test_punktacja_profilu_ma_te_same_tabele():
    text = strip_comments(read("domain/profile.ts"))
    for const_name, python in (
        ("CUSHION_POINTS", py_profile.CUSHION_POINTS),
        ("INCOME_POINTS", py_profile.INCOME_POINTS),
        ("LOANS_POINTS", py_profile.LOANS_POINTS),
        ("REACTION_SHARE", py_profile.REACTION_SHARE),
        ("PREFERENCE_SHARE", py_profile.PREFERENCE_SHARE),
        ("HORIZON_SCORE", py_profile.HORIZON_SCORE),
    ):
        match = re.search(rf"const {const_name}[^=]*=\s*\{{([^}}]*)\}}", text)
        assert match, const_name
        ts = {k.strip("'"): float(v) for k, v in re.findall(r"('?\w+'?):\s*([\d.]+)", match.group(1))}
        assert ts == {str(k): float(v) for k, v in python.items()}, const_name
    drop = re.search(r"const DROP_SHARE[^=]*=\s*\{([^}]*)\}", text).group(1)
    assert {int(k): float(v) for k, v in re.findall(r"(\d+):\s*([\d.]+)", drop)} == py_profile.DROP_SHARE
    for ts_name, py_value in (
        ("CAPACITY_MAX_POINTS", py_profile.CAPACITY_MAX_POINTS),
        ("W_DROP", py_profile.W_DROP),
        ("W_REACTION", py_profile.W_REACTION),
        ("W_PREFERENCE", py_profile.W_PREFERENCE),
    ):
        assert float(re.search(rf"const {ts_name}\s*=\s*([\d.]+)", text).group(1)) == py_value, ts_name
    assert int(re.search(r"BEHAVIOR_CAP:\s*Score\s*=\s*(\d)", text).group(1)) == py_profile.BEHAVIOR_CAP


def test_szablony_propozycji_sa_takie_same():
    text = strip_comments(read("domain/portfolio/proposals.ts"))
    block = text[text.index("const WEIGHTS") :]
    ts_levels = re.findall(r"(\d):\s*\[\s*((?:\[[^\]]+\],?\s*){3})\]", block)
    assert [int(level) for level, _ in ts_levels] == [1, 2, 3, 4, 5]
    for level, rows in ts_levels:
        ts_rows = [[int(x) for x in row.split(",")] for row in re.findall(r"\[([^\]]+)\]", rows)]
        assert ts_rows == [list(r) for r in py_proposals.WEIGHTS[int(level)]], f"poziom {level}"
    for kind, (name, tag, idea) in py_proposals.COPY.items():
        assert f"name: '{name}'" in text and f"tag: '{tag}'" in text, kind
        assert idea in text, kind


def test_instrumenty_i_grupy_sa_takie_same():
    text = strip_comments(read("domain/portfolio/instruments.ts"))
    ts = re.findall(
        r"id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*sub:\s*'([^']+)',\s*group:\s*'(\w+)',\s*proxy:\s*'([^']+)'",
        text,
    )
    assert ts == [(i.id, i.name, i.sub, i.group, i.proxy) for i in py_instruments.INSTRUMENTS]
    groups = re.findall(
        r"id:\s*'(\w+)',\s*name:\s*'([^']+)',\s*genitive:\s*'([^']+)',\s*color:\s*'[^']+',\s*indexes:\s*\[([^\]]+)\]",
        text,
    )
    assert [(g[0], g[1], g[2], tuple(int(x) for x in g[3].split(","))) for g in groups] == [
        (g.id, g.name, g.genitive, g.indexes) for g in py_instruments.GROUPS
    ]
    words = re.search(r"RISK_WORDS\s*=\s*\[([^\]]+)\]", text).group(1)
    assert tuple(re.findall(r"'([^']*)'", words)) == py_instruments.RISK_WORDS
