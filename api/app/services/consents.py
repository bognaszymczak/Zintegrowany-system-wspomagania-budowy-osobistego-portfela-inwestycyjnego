"""
Oświadczenia i zgody wymagane przy zakładaniu konta.

Osobno od routera, żeby dało się je sprawdzić testem bez uruchamiania serwera (tak jak reszta logiki w services/).

Dlaczego tylko osoby pełnoletnie (18+):
  * Regulamin to umowa, a osoby poniżej 18 lat mają ograniczoną zdolność do czynności prawnych
    (Kodeks cywilny, art. 15 i 17) — bez zgody rodzica umowa może być nieskuteczna;
  * zgody opcjonalne (e-maile, statystyki) wymagałyby od osób poniżej 16 lat zgody rodzica (RODO, art. 8; w Polsce
    próg to 16 lat), a jej weryfikowanie to dodatkowe dane i obowiązki;
  * pytania o dochody, raty i inwestowanie są zbudowane z myślą o dorosłych.
To oświadczenie, a nie weryfikacja wieku — pytamy o nie, zamiast zbierać datę urodzenia lub PESEL (minimalizacja danych).
Dowód złożenia oświadczeń to data w `users.accepted_terms_at` (patrz db/models.py).
"""

from ..errors import ApiError
from ..schemas import RegisterRequest

ADULT_REQUIRED_MESSAGE = "Z Horyzontu mogą korzystać wyłącznie osoby pełnoletnie. Aby założyć konto, potwierdź, że masz ukończone 18 lat."
CONSENT_REQUIRED_MESSAGE = (
    "Aby założyć konto, zaakceptuj Regulamin i potwierdź, że rozumiesz, czym jest to narzędzie."
)


def ensure_required_consents(body: RegisterRequest) -> None:
    """Rzuca ApiError (422), gdy brakuje któregoś z obowiązkowych oświadczeń. Pełnoletność sprawdzamy pierwsza."""
    if not body.adult_confirmed:
        raise ApiError(422, "adult_required", ADULT_REQUIRED_MESSAGE, ["adultConfirmed"])
    if not (body.accept_terms and body.accept_simulation):
        raise ApiError(422, "consent_required", CONSENT_REQUIRED_MESSAGE, ["acceptTerms", "acceptSimulation"])
