"""
Jednolity format błędów API — dokładnie taki, jakiego oczekuje przeglądarka (web/src/api/client.ts):

    { "code": "email_taken", "message": "Konto z tym adresem e-mail już istnieje…", "fields": ["email"] }

`message` jest gotowym zdaniem po polsku do pokazania użytkownikowi; `code` służy kodowi (np. do rozróżnienia
błędów); `fields` wskazuje pola z błędem (tylko przy walidacji).
"""

import logging

logger = logging.getLogger("horyzont")


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, fields: list[str] | None = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.fields = fields or []

    def body(self) -> dict:
        body: dict = {"code": self.code, "message": self.message}
        if self.fields:
            body["fields"] = self.fields
        return body


VALIDATION_MESSAGE = "Wysłane dane są niepoprawne. Sprawdź formularz i spróbuj ponownie."


def field_names(errors: list[dict]) -> list[str]:
    """Z listy błędów Pydantic/FastAPI robi krótką listę nazw pól: [„goal”, „quiz.q1”]."""
    names: set[str] = set()
    for error in errors:
        path = [str(part) for part in error.get("loc", ()) if part not in ("body", "query", "path")]
        if path:
            names.add(".".join(path))
    return sorted(names)


def register_error_handlers(app) -> None:  # noqa: ANN001 — FastAPI importujemy dopiero tutaj
    from fastapi import Request
    from fastapi.exceptions import RequestValidationError
    from fastapi.responses import JSONResponse

    @app.exception_handler(ApiError)
    async def handle_api_error(_request: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(status_code=exc.status, content=exc.body())

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
        error = ApiError(422, "validation_error", VALIDATION_MESSAGE, field_names(exc.errors()))
        return JSONResponse(status_code=error.status, content=error.body())

    @app.exception_handler(Exception)
    async def handle_unexpected_error(_request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Nieobsłużony błąd", exc_info=exc)
        error = ApiError(500, "server_error", "Serwer ma chwilowy problem. Spróbuj ponownie za moment.")
        return JSONResponse(status_code=error.status, content=error.body())
