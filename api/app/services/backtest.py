"""
Symulacja wsteczna: „jak zachowywałby się ten portfel w latach 2008–2025?”.

W WERSJI PRODUKCYJNEJ dane wejściowe (`MonthlyHistory`) pochodzą z bazy: miesięczne zwroty siedmiu
instrumentów (tabela monthly_returns, wypełniana przez app/jobs/ingest.py z Alpha Vantage/NBP), inflacja
i oprocentowanie lokat (tabela macro_monthly). W WERSJI DEMO ta sama struktura powstaje z generatora
(services/demo_history.py), więc wykres wygląda tak samo, a źródło jest uczciwie opisane w polu `source`.

Zasady symulacji: portfel startuje w zadanych udziałach i jest przebalansowywany do nich co roku w styczniu
(domyślnie; można wybrać `rebalance="monthly"`). Dzięki temu w kryzysach przypadających na pełny rok kalendarzowy
(2008, 2022) strata portfela na wykresie jest dokładnie taka, jak na kartach „Co by było w kryzysach” — te karty
liczą zwrot z całego okna bez przebalansowania. „S&P 500” to instrument „Akcje USA”; inflacja i lokata to gotowe
miesięczne stopy.
"""

from dataclasses import dataclass
from typing import Literal

from ..schemas import BacktestResponse, BacktestStats, CrisisPeriod
from .engine import Weights, acc
from .instruments import INSTRUMENT_COUNT, USA_INDEX

BACKTEST_START_PLN = 10_000

# okresy kryzysów do zacieniowania wykresu (te same co w web/src/mocks/backtest.ts)
CRISIS_PERIODS: tuple[CrisisPeriod, ...] = (
    CrisisPeriod(id="y2008", label="2008", from_="2008-01", to="2008-12"),
    CrisisPeriod(id="y2020", label="2020", from_="2020-02", to="2020-03"),
    CrisisPeriod(id="y2022", label="2022", from_="2022-01", to="2022-12"),
)


@dataclass(frozen=True)
class MonthlyHistory:
    dates: list[str]  # miesiące RRRR-MM; pierwszy wiersz to stan początkowy (zwroty = 0)
    returns: list[list[float]]  # [miesiąc][instrument 0..6], zwroty proste (0,01 = +1%)
    inflation: list[float]  # miesięczna inflacja (0,002 = 0,2%)
    deposit: list[float]  # miesięczne oprocentowanie lokaty
    source: str  # opis źródła do podpisu pod wykresem

    def validate(self) -> None:
        n = len(self.dates)
        if n < 2:
            raise ValueError("historia musi mieć co najmniej dwa miesiące")
        if not (len(self.returns) == len(self.inflation) == len(self.deposit) == n):
            raise ValueError("daty, zwroty, inflacja i lokata muszą mieć tyle samo wierszy")
        if any(len(row) != INSTRUMENT_COUNT for row in self.returns):
            raise ValueError(f"każdy wiersz zwrotów musi mieć {INSTRUMENT_COUNT} liczb")


def max_drawdown(series: list[float]) -> float:
    """Największy spadek od szczytu (ujemny ułamek; 0, gdy wartość nigdy nie spadła)."""
    peak = series[0]
    worst = 0.0
    for value in series:
        peak = max(peak, value)
        worst = min(worst, value / peak - 1)
    return worst


def simulate_backtest(
    weights: Weights,
    history: MonthlyHistory,
    start_pln: float = BACKTEST_START_PLN,
    rebalance: Literal["annual", "monthly"] = "annual",
) -> BacktestResponse:
    history.validate()
    w = [x / 100 for x in weights]
    portfolio = [start_pln]
    sp500 = [start_pln]
    inflation = [start_pln]
    deposit = [start_pln]
    holdings = [start_pln * share for share in w]  # wartość każdego instrumentu w portfelu
    for k in range(1, len(history.dates)):
        if rebalance == "monthly" or history.dates[k].endswith("-01"):
            total = acc(holdings)
            holdings = [total * share for share in w]
        row = history.returns[k]
        holdings = [value * (1 + row[i]) for i, value in enumerate(holdings)]
        portfolio.append(acc(holdings))
        sp500.append(sp500[-1] * (1 + row[USA_INDEX]))
        inflation.append(inflation[-1] * (1 + history.inflation[k]))
        deposit.append(deposit[-1] * (1 + history.deposit[k]))
    return BacktestResponse(
        start_pln=start_pln,
        dates=list(history.dates),
        portfolio=portfolio,
        sp500=sp500,
        inflation=inflation,
        deposit=deposit,
        crises=list(CRISIS_PERIODS),
        stats=BacktestStats(
            portfolio_end=portfolio[-1],
            sp500_end=sp500[-1],
            inflation_end=inflation[-1],
            deposit_end=deposit[-1],
            portfolio_max_drawdown=max_drawdown(portfolio),
            sp500_max_drawdown=max_drawdown(sp500),
        ),
        source=history.source,
    )
