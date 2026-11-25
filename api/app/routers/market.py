"""Dane rynkowe z bazy backendu: założenia (GET /api/market/assumptions) i symulacja wsteczna."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from .. import repository
from ..config import Settings, get_settings
from ..deps import Db
from ..errors import ApiError
from ..schemas import BacktestResponse, MarketAssumptions
from ..services.backtest import simulate_backtest
from ..services.engine import parse_weights

router = APIRouter(prefix="/market", tags=["dane rynkowe"])

SettingsDep = Annotated[Settings, Depends(get_settings)]


@router.get("/assumptions", response_model=MarketAssumptions)
def assumptions(db: Db, settings: SettingsDep) -> MarketAssumptions:
    return repository.get_assumptions(db, settings)


@router.get("/backtest", response_model=BacktestResponse)
def backtest(
    weights: Annotated[str, Query(min_length=1, max_length=100)], db: Db, settings: SettingsDep
) -> BacktestResponse:
    parsed = parse_weights(weights)
    if parsed is None:
        raise ApiError(422, "validation_error", "Udziały muszą być 7 liczbami o sumie 100.", ["weights"])
    return simulate_backtest(parsed, repository.get_history(db, settings))
