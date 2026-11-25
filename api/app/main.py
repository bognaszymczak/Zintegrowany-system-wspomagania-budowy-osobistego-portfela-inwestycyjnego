"""
Wejście do backendu. Uruchomienie (z katalogu api/):

    uvicorn app.main:app --reload --port 8000

Dokumentacja i próbnik endpointów otwierają się pod http://localhost:8000/docs (tylko w trybie dev).
Front w trybie dev przekazuje adresy /api/* tutaj przez proxy Vite (web/vite.config.ts).
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db.session import init_db
from .errors import register_error_handlers
from .routers import auth, choices, market, profile, proposals


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # w trybie dev tabele tworzą się same; w produkcji użyj migracji (Alembic)
    if get_settings().is_dev:
        init_db()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Horyzont API",
        version="0.1.0",
        description="Backend aplikacji wspomagającej budowę osobistego portfela inwestycyjnego. "
        "To narzędzie edukacyjne — wyniki są symulacją, a nie poradą inwestycyjną.",
        lifespan=lifespan,
        docs_url="/docs" if settings.is_dev else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.is_dev else None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=True,  # ciasteczko sesji
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Content-Type"],
    )
    register_error_handlers(app)
    for module in (auth, profile, market, proposals, choices):
        app.include_router(module.router, prefix="/api")

    @app.get("/api/health", tags=["serwis"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
