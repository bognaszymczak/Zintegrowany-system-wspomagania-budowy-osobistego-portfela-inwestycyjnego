"""
Ocena ryzyka wyboru użytkownika (ekran 8 ścieżki) — wierna kopia web/src/domain/portfolio/assessment.ts.

Szansę dużej straty podaje model (services/risk_model.py); tutaj z tej jednej liczby budujemy cały ekran:
wodospad zmian, udział w ryzyku, kryzysy, wachlarz wyników i zdania podsumowania.
"""

from dataclasses import dataclass

from ..schemas import (
    Assessment,
    AssessmentSummary,
    CrisisRow,
    MarketAssumptions,
    ModelInfo,
    Plan,
    RiskContribution,
    Takeaway,
    WaterfallStep,
)
from .assumptions import SAMPLE_ASSUMPTIONS
from .engine import (
    Weights,
    acc,
    check_limits,
    fan_series,
    portfolio_metrics,
    portfolio_stats,
    scenario_return,
)
from .instruments import GROUPS
from .jsfmt import comma, format_pln, join_polish, js_round
from .profiles import RiskProfile
from .risk_model import DEFAULT_MODEL, RiskModel


@dataclass(frozen=True)
class AssessmentInput:
    weights: Weights  # udziały wybrane przez użytkownika (7 liczb, suma 100)
    base_weights: Weights  # udziały propozycji, od której użytkownik zaczął
    base_name: str  # nazwa propozycji, np. „Równowaga”
    plan: Plan
    profile: RiskProfile


def _round_to_100(x: float) -> int:
    return js_round(x / 100) * 100


def _to_pct(x: float) -> float:
    return x * 100


def build_waterfall(
    base: Weights,
    final: Weights,
    base_name: str,
    a: MarketAssumptions = SAMPLE_ASSUMPTIONS,
    model: RiskModel = DEFAULT_MODEL,
) -> list[WaterfallStep]:
    """
    „Wodospad”: jak kolejne przesunięcia pieniędzy między grupami zmieniały szansę dużej straty.
    Każdy krok to przesunięcie z jednej grupy-dawcy do grup-odbiorców; ostatnia wartość jest równa
    ocenie wersji użytkownika (suma kroków = różnica całkowita).
    """

    def p(w: Weights) -> float:
        return _to_pct(model.loss_probability(w, a))

    start_value = p(base)
    end_value = p(final)
    start = WaterfallStep(kind="start", label=f"Propozycja „{base_name}”", value=start_value, delta=None)
    end = WaterfallStep(kind="end", label="Twoja wersja", value=end_value, delta=None)

    if all(abs(x - base[i]) < 1e-9 for i, x in enumerate(final)):
        return [start, end]

    base_totals = [acc(base[i] for i in g.indexes) for g in GROUPS]
    final_totals = [acc(final[i] for i in g.indexes) for g in GROUPS]
    group_diff = [t - base_totals[gi] for gi, t in enumerate(final_totals)]

    # Wagi wewnątrz grup bierzemy z wersji końcowej (a gdy grupa znika — z propozycji),
    # dzięki czemu stan po ostatnim kroku jest dokładnie wersją użytkownika.
    share = [0.0] * len(base)
    for gi, g in enumerate(GROUPS):
        for i in g.indexes:
            if final_totals[gi] > 0:
                share[i] = final[i] / final_totals[gi]
            elif base_totals[gi] > 0:
                share[i] = base[i] / base_totals[gi]
            else:
                share[i] = 1 / len(g.indexes)

    def mix_at(totals: list[float]) -> list[float]:
        w = [0.0] * len(base)
        for gi, g in enumerate(GROUPS):
            for i in g.indexes:
                w[i] = totals[gi] * share[i]
        return w

    # najpierw największe obniżki; przy remisie — grupa „bezpieczniejsza” (dalej w kolejności)
    donors = sorted(
        (gi for gi in range(len(GROUPS)) if group_diff[gi] < -1e-9),
        key=lambda gi: (group_diff[gi], -gi),
    )
    receivers = [gi for gi in range(len(GROUPS)) if group_diff[gi] > 1e-9]
    total_gain = acc(group_diff[gi] for gi in receivers)

    steps: list[WaterfallStep] = []
    previous = start_value
    carry = 0.0  # zmiany wewnątrz grup, które doliczamy do pierwszego kroku

    within_group = p(mix_at(base_totals))
    inner = within_group - previous
    if not donors or abs(inner) >= 0.05:
        steps.append(
            WaterfallStep(
                kind="step",
                label="Zmiany w obrębie grup (np. inne akcje, te same pieniądze w akcjach)",
                value=within_group,
                delta=inner,
            )
        )
    else:
        carry = inner
    previous = within_group

    totals = list(base_totals)
    for donor in donors:
        moved = -group_diff[donor]
        totals[donor] = totals[donor] - moved
        for r in receivers:
            totals[r] = totals[r] + (moved * group_diff[r]) / total_gain
        value = p(mix_at(totals))
        label = (
            f"{js_round(moved)} pkt proc. mniej {GROUPS[donor].genitive}, "
            f"więcej {join_polish([GROUPS[r].genitive for r in receivers])}"
        )
        steps.append(WaterfallStep(kind="step", label=label, value=value, delta=value - previous + carry))
        carry = 0.0
        previous = value
    return [start, *steps, end]


def risk_contributions(weights: Weights, a: MarketAssumptions = SAMPLE_ASSUMPTIONS) -> list[RiskContribution]:
    """Ile pieniędzy (%) i ile ryzyka (%) przypada na każdą z czterech grup."""
    st = portfolio_stats(weights, a)
    return [
        RiskContribution(
            group=g.id,
            name=g.name,
            weight_pct=acc(weights[i] for i in g.indexes),
            risk_pct=_to_pct(acc(((weights[i] / 100) * st.marginal[i]) / st.variance for i in g.indexes)),
        )
        for g in GROUPS
    ]


def assess_portfolio(
    data: AssessmentInput,
    a: MarketAssumptions = SAMPLE_ASSUMPTIONS,
    model: RiskModel = DEFAULT_MODEL,
) -> Assessment:
    weights, base_weights, base_name, plan, profile = (
        data.weights,
        data.base_weights,
        data.base_name,
        data.plan,
        data.profile,
    )
    mine = portfolio_metrics(weights, plan, a)
    base = portfolio_metrics(base_weights, plan, a)
    limits = check_limits(mine, profile)

    loss_chance_pct = _to_pct(model.loss_probability(weights, a))
    loss_chance_base_pct = _to_pct(model.loss_probability(base_weights, a))
    changed_count = sum(1 for i, x in enumerate(weights) if x != base_weights[i])
    changed = changed_count > 0

    contributions = risk_contributions(weights, a)
    top = contributions[0]
    for c in contributions[1:]:
        if c.risk_pct > top.risk_pct:
            top = c
    if top.risk_pct - top.weight_pct >= 10:
        contribution_note = (
            f"{top.name} to {js_round(top.weight_pct)}% Twoich pieniędzy, "
            f"ale aż {js_round(top.risk_pct)}% ryzyka. Pozostałe grupy wygładzają wahania."
        )
    else:
        contribution_note = (
            f"Ryzyko jest rozłożone dość równomiernie: najwięcej, {js_round(top.risk_pct)}%, "
            f"pochodzi z grupy „{top.name}”."
        )

    crises = []
    for s in a.scenarios:
        m = scenario_return(weights, s)
        b = scenario_return(base_weights, s)
        crises.append(
            CrisisRow(
                id=s.id,
                period=s.period,
                name=s.name,
                mine=m,
                base=b,
                left_pln=_round_to_100(plan.start_pln * (1 + m)),
                left_base_pln=_round_to_100(plan.start_pln * (1 + b)),
            )
        )

    takeaways: list[Takeaway] = []
    if limits.ok:
        takeaways.append(Takeaway(tone="ok", text=f"Mieści się w limitach Twojego profilu „{profile.name}”."))
    else:
        problems = "; ".join(v.message for v in limits.violations)
        takeaways.append(
            Takeaway(tone="warn", text=f"Wychodzi poza limity Twojego profilu „{profile.name}”: {problems}.")
        )
    if not changed:
        takeaways.append(
            Takeaway(tone="ok", text=f"To dokładnie propozycja „{base_name}” — bez Twoich zmian.")
        )
    elif mine.sri > base.sri:
        takeaways.append(
            Takeaway(
                tone="up",
                text=f"Jest ryzykowniejszy niż propozycja „{base_name}” ({mine.sri} z 7 zamiast {base.sri} z 7).",
            )
        )
    elif mine.sri < base.sri:
        takeaways.append(
            Takeaway(
                tone="down",
                text=f"Jest spokojniejszy niż propozycja „{base_name}” ({mine.sri} z 7 zamiast {base.sri} z 7).",
            )
        )
    else:
        higher = loss_chance_pct > loss_chance_base_pct
        takeaways.append(
            Takeaway(
                tone="up" if higher else "down",
                text=(
                    f"Poziom ryzyka jak w propozycji „{base_name}” ({mine.sri} z 7), ale szansa na dużą stratę "
                    f"jest {'nieco wyższa' if higher else 'nieco niższa'}."
                ),
            )
        )
    money_at_worst = _round_to_100(plan.start_pln * (1 + mine.worst_year))
    takeaways.append(
        Takeaway(
            tone="warn",
            text=(
                f"W złym roku wartość może spaść o ok. {comma(abs(mine.worst_year) * 100)}%. "
                f"Z {format_pln(plan.start_pln)} zł zostałoby wtedy ok. {format_pln(money_at_worst)} zł."
            ),
        )
    )

    d_loss = loss_chance_pct - loss_chance_base_pct
    if changed:
        trade_off = (
            f"Twoje zmiany {'zwiększają' if d_loss >= 0 else 'zmniejszają'} szansę dużej straty "
            f"o {comma(abs(d_loss))} pkt proc., a typowy wynik po {plan.years} latach "
            f"{'rośnie' if mine.median >= base.median else 'maleje'} "
            f"z {format_pln(_round_to_100(base.median))} zł do {format_pln(_round_to_100(mine.median))} zł."
        )
    else:
        trade_off = f"Propozycja nie została zmieniona, więc ocena dotyczy dokładnie „{base_name}”."

    return Assessment(
        sri=mine.sri,
        sri_word=mine.sri_word,
        base_sri=base.sri,
        base_sri_word=base.sri_word,
        loss_chance_pct=loss_chance_pct,
        loss_chance_base_pct=loss_chance_base_pct,
        per100=js_round(loss_chance_pct),
        per100_base=js_round(loss_chance_base_pct),
        worst_year=mine.worst_year,
        worst_year_base=base.worst_year,
        money_at_worst=money_at_worst,
        limits=limits,
        changed=changed,
        changed_count=changed_count,
        waterfall=build_waterfall(base_weights, weights, base_name, a, model),
        contributions=contributions,
        contribution_note=contribution_note,
        crises=crises,
        fan=fan_series(weights, plan, a),
        summary=AssessmentSummary(
            median=mine.median,
            median_base=base.median,
            p10=mine.p10,
            p90=mine.p90,
            paid_in=mine.paid_in,
            goal_pln=plan.target_pln,
            goal_probability=mine.goal_probability,
            years=plan.years,
        ),
        takeaways=takeaways,
        trade_off=trade_off,
        model=ModelInfo(
            kind=model.kind,
            name=model.name,
            version=model.version,
            trained_on=model.trained_on,
            regime=a.regime,
            p_loss_without_regime=_to_pct(model.loss_probability(weights, a, 1.0)),
            reliability=model.reliability,
            reliability_note=model.reliability_note,
        ),
    )
