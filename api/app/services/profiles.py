"""Pięć poziomów profilu inwestora i ich granice ryzyka — odpowiednik web/src/domain/profiles.ts."""

from dataclasses import dataclass

from .jsfmt import js_round


@dataclass(frozen=True)
class RiskProfile:
    level: int
    name: str
    # typowe roczne wahania wartości portfela (odchylenie standardowe), ułamek
    volatility: float
    # największy dopuszczalny spadek w scenariuszach kryzysowych (ujemny ułamek)
    max_drawdown: float
    # największy łączny udział akcji, ułamek
    max_equity: float
    # największy udział pojedynczej pozycji, ułamek
    max_position: float
    # słowo do zdania „…w … granicach ryzyka”
    range_word: str


PROFILES: tuple[RiskProfile, ...] = (
    RiskProfile(1, "Bardzo ostrożny", 0.04, -0.08, 0.15, 0.40, "bardzo ostrożnych"),
    RiskProfile(2, "Ostrożny", 0.07, -0.14, 0.30, 0.35, "ostrożnych"),
    RiskProfile(3, "Zrównoważony", 0.10, -0.20, 0.50, 0.30, "umiarkowanych"),
    RiskProfile(4, "Dynamiczny", 0.13, -0.28, 0.70, 0.30, "podwyższonych"),
    RiskProfile(5, "Odważny", 0.17, -0.38, 0.90, 0.30, "wysokich"),
)


def clamp_level(level: float) -> int:
    return min(5, max(1, js_round(level)))


def profile_by_level(level: float) -> RiskProfile:
    return PROFILES[clamp_level(level) - 1]
