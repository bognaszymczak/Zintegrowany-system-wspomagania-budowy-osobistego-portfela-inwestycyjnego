"""
Źródła danych rynkowych. Każdy plik = jedno zewnętrzne API, w dwóch warstwach:
  • parse_*  — czysta funkcja zamieniająca odpowiedź API na listę obserwacji (testowana na przykładowych odpowiedziach),
  • fetch_*  — cienkie wywołanie HTTP (httpx) + parse_*.

Wywołuje je WYŁĄCZNIE zadanie app/jobs/ingest.py (nocą lub ręcznie). Endpointy użytkownika czytają dane z bazy,
dzięki czemu limity darmowych API, ich awarie i klucze nie wpływają na działanie aplikacji.
"""
