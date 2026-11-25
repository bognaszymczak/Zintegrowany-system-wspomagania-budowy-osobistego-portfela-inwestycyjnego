/**
 * Założenia rynkowe, na których liczy silnik: oczekiwane stopy zwrotu, wahania, korelacje,
 * koszty funduszy, scenariusze kryzysowe i „klimat rynku”.
 *
 * W WERSJI DEMO są to wartości przykładowe (SAMPLE_ASSUMPTIONS) — dobrane tak, by wyniki były
 * realistyczne i spójne z makietami. W WERSJI PRODUKCYJNEJ liczy je backend z danych historycznych
 * zapisanych w bazie (zadanie nocne api/app/jobs/ingest.py + api/app/services/assumptions.py)
 * i wystawia jako GET /api/market/assumptions. Silnik nie zmienia się wcale: dostaje inny obiekt.
 */
export interface Scenario {
  id: 'y2008' | 'y2020' | 'y2022';
  /** np. „2008 · cały rok” */
  period: string;
  /** np. „Kryzys finansowy” */
  name: string;
  /** zwrot każdego z 7 instrumentów w tym okresie (ułamek, ujemny = strata) */
  returns: readonly number[];
}

export interface Regime {
  id: 'spokojny' | 'podwyzszony' | 'kryzysowy';
  /** opis po polsku: „podwyższona zmienność” */
  label: string;
  /** wskaźnik VIX użyty w przykładzie */
  vix: number;
  /** mnożnik wahań w ocenie ryzyka rocznego (1 = bez korekty) */
  volMultiplier: number;
}

export interface MarketAssumptions {
  /** data, z której pochodzą dane (ISO, np. 2026-11-03) */
  asOf: string;
  /** oczekiwana roczna stopa zwrotu każdego instrumentu (ułamek) */
  mu: readonly number[];
  /** roczne wahania (odchylenie standardowe) każdego instrumentu */
  sigma: readonly number[];
  /** roczny koszt funduszu (TER) każdego instrumentu */
  ter: readonly number[];
  /** macierz korelacji 7×7 */
  corr: readonly (readonly number[])[];
  scenarios: readonly Scenario[];
  /** progi odchylenia standardowego dla skali ryzyka 1–7 (6 progów) */
  riskThresholds: readonly number[];
  regime: Regime;
}

export const SAMPLE_ASSUMPTIONS: MarketAssumptions = {
  asOf: '2026-11-03',
  //        świat   USA     EM      obl.sk. obl.kor. złoto   gotówka
  mu: [0.068, 0.076, 0.082, 0.033, 0.041, 0.046, 0.026],
  sigma: [0.155, 0.17, 0.21, 0.06, 0.07, 0.15, 0.007],
  ter: [0.002, 0.0007, 0.0018, 0.001, 0.0015, 0.0015, 0.0007],
  corr: [
    [1, 0.95, 0.85, 0.05, 0.55, 0.1, 0],
    [0.95, 1, 0.78, 0, 0.55, 0.08, 0],
    [0.85, 0.78, 1, 0.1, 0.5, 0.15, 0],
    [0.05, 0, 0.1, 1, 0.7, 0.25, 0.1],
    [0.55, 0.55, 0.5, 0.7, 1, 0.2, 0.05],
    [0.1, 0.08, 0.15, 0.25, 0.2, 1, 0],
    [0, 0, 0, 0.1, 0.05, 0, 1],
  ],
  scenarios: [
    { id: 'y2008', period: '2008 · cały rok', name: 'Kryzys finansowy', returns: [-0.4, -0.37, -0.53, 0.08, -0.05, 0.05, 0.02] },
    { id: 'y2020', period: '2020 · luty–marzec', name: 'Pandemia COVID-19', returns: [-0.34, -0.34, -0.31, 0.03, -0.06, -0.01, 0] },
    { id: 'y2022', period: '2022 · cały rok', name: 'Inflacja i podwyżki stóp', returns: [-0.18, -0.18, -0.2, -0.15, -0.15, 0, 0.015] },
  ],
  riskThresholds: [0.02, 0.06, 0.08, 0.11, 0.15, 0.2],
  regime: { id: 'podwyzszony', label: 'podwyższona zmienność', vix: 22, volMultiplier: 1.15 },
};
