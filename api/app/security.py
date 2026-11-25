"""
Bezpieczeństwo kont: hasła i sesje. Tylko biblioteka standardowa Pythona.

- Hasła: NIGDY nie zapisujemy ich jawnie. Zapisujemy wynik scrypt (funkcja celowo wolna i pamięciożerna, żeby
  łamanie wykradzionych haszy było drogie) razem z losową solą. Format: scrypt$N$r$p$sól$hasz (base64).
- Sesje: po zalogowaniu przeglądarka dostaje losowy token w ciasteczku httpOnly (JavaScript go nie widzi),
  a w bazie trzymamy tylko jego skrót SHA-256 — wyciek bazy nie ujawnia działających sesji.
"""

import base64
import hashlib
import hmac
import secrets

SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1
KEY_LENGTH = 32


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=KEY_LENGTH
    )
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    """True, gdy hasło pasuje do zapisanego skrótu. Zły format skrótu to po prostu „nie pasuje”."""
    try:
        scheme, n, r, p, salt_b64, digest_b64 = stored.split("$")
        if scheme != "scrypt":
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(digest_b64)
        actual = hashlib.scrypt(
            password.encode("utf-8"), salt=salt, n=int(n), r=int(r), p=int(p), dklen=len(expected)
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


# Skrót „na niby” — sprawdzamy go, gdy nie ma konta o podanym e-mailu, żeby odpowiedź trwała tyle samo
# (inaczej po czasie odpowiedzi dałoby się odgadnąć, które adresy mają konto).
DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def new_session_token() -> tuple[str, str]:
    """(token dla przeglądarki, skrót do zapisania w bazie)."""
    token = secrets.token_urlsafe(32)
    return token, hash_token(token)
