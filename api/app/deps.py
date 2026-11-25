"""Zależności wspólne dla endpointów: zalogowany użytkownik i model oceny ryzyka."""

from functools import lru_cache
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from . import repository
from .config import get_settings
from .db.models import User
from .db.session import get_db
from .errors import ApiError
from .services.risk_model import RiskModel, get_risk_model

SESSION_COOKIE = "horyzont_session"


def current_user(request: Request, db: Annotated[Session, Depends(get_db)]) -> User:
    """Użytkownik z ciasteczka sesji; brak lub wygasła sesja = 401."""
    token = request.cookies.get(SESSION_COOKIE)
    user = repository.find_user_by_token(db, token) if token else None
    if user is None:
        raise ApiError(401, "unauthorized", "Zaloguj się, aby kontynuować.")
    return user


@lru_cache
def risk_model() -> RiskModel:
    """Model oceny ryzyka wybrany w ustawieniach (RISK_MODEL_PATH); wczytywany raz."""
    return get_risk_model(get_settings().risk_model_path)


CurrentUser = Annotated[User, Depends(current_user)]
Db = Annotated[Session, Depends(get_db)]
