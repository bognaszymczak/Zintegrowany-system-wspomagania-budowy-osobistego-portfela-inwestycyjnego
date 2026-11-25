"""
Horyzont — backend (FastAPI).

Gdzie czego szukać:
  app/main.py          uruchomienie serwera, podpięcie routerów i obsługa błędów
  app/routers/         endpointy HTTP (cienkie: odbierają żądanie, wołą services/, zwracają odpowiedź)
  app/services/        CAŁA logika obliczeń jako czyste funkcje (bez bazy i sieci) — tu jest „mózg” aplikacji
  app/db/              tabele i połączenie z bazą (SQLAlchemy)
  app/providers/       pobieranie danych z zewnętrznych API (NBP, FRED, Alpha Vantage…)
  app/jobs/            zadania uruchamiane z terminala lub z crona (np. nocne pobranie danych)
  app/schemas.py       kształty żądań i odpowiedzi (kontrakt z frontendem)
"""
