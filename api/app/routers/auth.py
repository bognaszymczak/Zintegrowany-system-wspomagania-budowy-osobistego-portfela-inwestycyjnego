"""Konto użytkownika: rejestracja, logowanie, wylogowanie, kto jest zalogowany."""

import re
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response

from .. import repository
from ..config import Settings, get_settings
from ..db.models import User, utcnow
from ..deps import SESSION_COOKIE, CurrentUser, Db
from ..errors import ApiError
from ..schemas import AuthResponse, AuthUser, LoginRequest, RegisterRequest
from ..security import DUMMY_HASH, hash_password, verify_password
from ..services.consents import ensure_required_consents

router = APIRouter(prefix="/auth", tags=["konto"])

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")

SettingsDep = Annotated[Settings, Depends(get_settings)]


def _public(user: User) -> AuthUser:
    return AuthUser(id=user.id, name=user.name, email=user.email)


def _normalize(email: str) -> str:
    return email.strip().lower()


def _start_session(db, user: User, response: Response, settings: Settings) -> None:
    token = repository.create_session(db, user, settings.session_days)
    # httpOnly: skrypty na stronie nie mają dostępu do tokenu; SameSite=Lax: przeglądarka nie wyśle go z obcych stron
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=settings.session_days * 24 * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(body: RegisterRequest, response: Response, db: Db, settings: SettingsDep) -> AuthResponse:
    email = _normalize(body.email)
    if not EMAIL_RE.match(email):
        raise ApiError(422, "validation_error", "Wpisz adres e-mail w formacie imie@przyklad.pl.", ["email"])
    ensure_required_consents(body)  # 18+, Regulamin, „to nie jest doradztwo” — patrz services/consents.py
    if repository.find_user_by_email(db, email) is not None:
        raise ApiError(409, "email_taken", "Konto z tym adresem e-mail już istnieje. Spróbuj się zalogować.")

    user = User(
        email=email,
        name=body.name.strip() or None,
        password_hash=hash_password(body.password),
        marketing_opt_in=body.marketing_opt_in,
        accepted_terms_at=utcnow(),
    )
    db.add(user)
    db.commit()
    _start_session(db, user, response, settings)
    return AuthResponse(user=_public(user))


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest, response: Response, db: Db, settings: SettingsDep) -> AuthResponse:
    user = repository.find_user_by_email(db, _normalize(body.email))
    # sprawdzamy hasło także, gdy konta nie ma — odpowiedź trwa tyle samo i nie zdradza, które adresy mają konto
    password_ok = verify_password(body.password, user.password_hash if user else DUMMY_HASH)
    if user is None or not password_ok:
        raise ApiError(401, "invalid_credentials", "Nieprawidłowy adres e-mail lub hasło.")
    _start_session(db, user, response, settings)
    return AuthResponse(user=_public(user))


@router.post("/logout", status_code=204, response_class=Response)
def logout(request: Request, db: Db) -> Response:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        repository.delete_session(db, token)
    empty = Response(status_code=204)
    empty.delete_cookie(SESSION_COOKIE, path="/")
    return empty


@router.get("/me", response_model=AuthResponse)
def me(user: CurrentUser) -> AuthResponse:
    return AuthResponse(user=_public(user))
