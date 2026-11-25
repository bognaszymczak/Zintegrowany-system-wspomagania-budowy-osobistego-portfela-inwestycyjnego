Horyzont — system wspomagania budowy osobistego portfela inwestycyjnego

Prototyp aplikacji z pracy inżynierskiej (Uniwersytet WSB Merito Poznań, Informatyka). Prowadzi użytkownika przez ścieżkę:

strona startowa → konto → formularz wstępny (5 kroków) → profil → 3 propozycje portfeli → szczegóły → suwaki → ocena ryzyka → zapis wyboru

To narzędzie edukacyjne. Pokazuje przykładowe portfele i symulacje, nie jest doradztwem inwestycyjnym. Wyniki z przeszłości nie gwarantują wyników w przyszłości. Konto mogą założyć tylko osoby pełnoletnie.

Co jest w repozytorium
web/ front: React 19 + TypeScript + Vite (działa samodzielnie, na danych przykładowych)
api/ backend: Python + FastAPI + SQLAlchemy (baza SQLite lub PostgreSQL)
docs/ szczegółowy opis projektu: formularz, architektura, gdzie podłączyć API i bazę
.vscode/ polecane rozszerzenia dla VS Code
Czego potrzebujesz
Program Po co Wersja
Git pobranie repozytorium dowolna
Node.js front 20 lub 22 (LTS)
Python backend (opcjonalnie) 3.11 lub nowszy
VS Code edytor polecany; po otwarciu folderu zainstaluj „zalecane rozszerzenia”
Szybki start — tylko front (bez backendu i bazy)
bash
git clone https://github.com/bognaszymczak/Zintegrowany-system-wspomagania-budowy-osobistego-portfela-inwestycyjnego.git horyzont
cd horyzont/web
npm install
npm run dev

Otwórz http://localhost:5173. Domyślnie aplikacja działa na danych przykładowych (atrapach), więc nie potrzebuje serwera ani bazy i nie trzeba nic konfigurować.

Konto demonstracyjne: demo@horyzont.pl / demo-haslo-12345 (na ekranie logowania jest przycisk wpisujący te dane).
W formularzu wstępnym jest link „Uzupełnij przykładowe odpowiedzi (demo)”, który przeskakuje całą ankietę.
Polecenie (w web/) Do czego
npm run dev serwer developerski z odświeżaniem na żywo
npm run typecheck sprawdzenie typów TypeScript
npm test testy jednostkowe (Vitest)
npm run build wersja produkcyjna do katalogu dist/
Backend (opcjonalnie)

Wszystkie polecenia z folderu api/:

bash
cd api
python -m venv .venv
source .venv/Scripts/activate # Git Bash na Windows | cmd: .venv\Scripts\activate | macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env # cmd: copy .env.example .env
pytest # testy backendu
python -m app.jobs.ingest --demo-seed # dane przykładowe i konto demo
uvicorn app.main:app --reload --port 8000

Sprawdzenie: http://localhost:8000/api/health → {"status":"ok"}. Próbnik wszystkich endpointów: http://localhost:8000/docs (tylko przy APP_ENV=dev). Baza SQLite to plik api/horyzont.db, powstaje w folderze, z którego uruchamiasz polecenia. Klucze do zewnętrznych API (Alpha Vantage, FRED) wpisuje się wyłącznie w api/.env — nigdy w kodzie frontu.

Połączenie frontu z backendem

W folderze web/ skopiuj .env.example jako .env i ustaw:

VITE_USE_MOCKS=false
VITE_DEV_API_TARGET=http://localhost:8000

Następnie zatrzymaj npm run dev (Ctrl+C) i uruchom ponownie — Vite czyta .env tylko przy starcie. VITE_API_BASE_URL zostaw jako /api. Powrót do danych przykładowych: usuń linię VITE_USE_MOCKS=false i zrestartuj. Front i backend muszą pochodzić z tej samej wersji repozytorium (git pull w obu miejscach).

Backend na innym komputerze w sieci (wspólna praca lub pokaz)

Na komputerze-serwerze uruchom backend tak, żeby był widoczny w sieci:

bash
uvicorn app.main:app --host 0.0.0.0 --port 8000

Zezwól Pythonowi w zaporze Windows (sieć prywatna) i sprawdź adres komputera poleceniem ipconfig („Adres IPv4”, np. 192.168.0.23). Z innego komputera http://192.168.0.23:8000/api/health ma pokazać {"status":"ok"}. Wtedy w web/.env ustaw VITE_USE_MOCKS=false i VITE_DEV_API_TARGET=http://192.168.0.23:8000.

Wariant „na pokaz”: ten sam komputer uruchamia też front (cd web, npm install, npm run dev -- --host, w web/.env tylko VITE_USE_MOCKS=false), a inne osoby w tej samej sieci otwierają http://192.168.0.23:5173 w przeglądarce.

Uwaga: dopóki działa tryb dev (publiczne hasło konta demo, otwarty /docs), nie otwieraj portu na routerze do internetu. Komputery w różnych sieciach połącz prywatną siecią (np. Tailscale) albo tunelem. Na prawdziwym serwerze ustaw APP_ENV=prod, COOKIE_SECURE=true, ALLOW_DEMO_DATA=false, zbuduj front z VITE_USE_MOCKS=false i podawaj go pod tym samym adresem co /api (HTTPS).

Testy i kontrola kodu
bash
cd web && npm run typecheck && npm test # front
cd api && pytest && ruff check . # backend

Test api/tests/test_api.py uruchomi się dopiero po pip install -r requirements.txt (bez FastAPI jest pomijany).

Gdy coś nie działa
Objaw Co zrobić
npm / node „nie jest rozpoznawane” zainstaluj Node.js LTS, zamknij i otwórz VS Code ponownie, sprawdź node -v
PowerShell: „wykonywanie skryptów jest wyłączone” użyj terminala Git Bash albo Command Prompt, albo raz wpisz Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
port 5173 zajęty Vite wybierze następny i wypisze adres w terminalu
biała strona F12 → zakładka Console, skopiuj czerwone komunikaty
„Nie udało się połączyć z serwerem” w web/.env jest VITE_USE_MOCKS=false, a backend nie działa — uruchom backend albo usuń tę linię
w terminalu nie ma git / python zainstaluj program i uruchom VS Code ponownie
Praca z repozytorium
Przed pracą: git pull. Po pracy: git add ., git commit -m "krótki opis", git push.
Pliki .env zawierają klucze i nigdy nie trafiają do repozytorium (.gitignore je blokuje; wchodzą tylko pliki .env.example).
Nie używaj git push --force.
Ograniczenia prototypu
Dane rynkowe w trybie demo są przykładowe (ekrany to oznaczają). Pobieranie prawdziwych danych (python -m app.jobs.ingest --fetch, klucze w api/.env) nie było jeszcze testowane na żywych API, a serie inflacji i lokat są do dodania.
Ocena ryzyka używa prostego modelu statystycznego (rozkład t-Studenta), a nie wytrenowanego modelu uczenia maszynowego. Miejsce na prawdziwy model: RISK_MODEL_PATH.
Regulamin, Polityka prywatności i Polityka cookies to wersje robocze, które przed publikacją musi sprawdzić prawnik.
Brak ekranu ustawień konta (samodzielne pobieranie i usuwanie danych), a zapis do PDF to drukowanie z przeglądarki.

Szczegółowy opis (punktacja profilu, architektura, tabela „gdzie podłączyć API i bazę”): docs/OPIS-PROJEKTU.md.
