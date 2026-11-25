"""
Logika obliczeń aplikacji — czyste funkcje: dostają dane, zwracają wynik, nie dotykają bazy ani sieci.

Dzięki temu cały „mózg” (punktacja formularza, silnik portfela, propozycje, ocena ryzyka) da się
przetestować bez uruchamiania serwera, a po stronie przeglądarki działa identyczna wersja w TypeScripcie
(web/src/domain). Obie wersje mają wspólne przypadki testowe z tymi samymi liczbami.
"""
