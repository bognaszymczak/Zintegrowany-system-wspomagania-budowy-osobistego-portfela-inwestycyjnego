/**
 * Siedem instrumentów w czterech grupach — „słownik” całej aplikacji.
 * Kolejność w tablicach jest stała: wszystkie wektory udziałów (`weights`) mają długość 7
 * i trzymają się dokładnie tej kolejności. Backend używa tej samej (api/app/services/instruments.py).
 *
 * Instrumenty to „odpowiedniki” funduszy ETF. Konkretne produkty (ISIN, ticker) dopisujesz
 * w polu `proxy` — używa go zadanie pobierające dane giełdowe, gdy pójdziecie w stronę prawdziwych danych.
 */
export type GroupId = 'akcje' | 'obligacje' | 'zloto' | 'gotowka';

export interface Instrument {
  id: string;
  name: string;
  sub: string;
  group: GroupId;
  /** przykładowy symbol z giełdy, z którego liczymy historię (do podmiany) */
  proxy: string;
}

export const INSTRUMENTS: readonly Instrument[] = [
  { id: 'akcje-swiat', name: 'Akcje świata', sub: 'Szeroki indeks spółek z wielu krajów', group: 'akcje', proxy: 'VWCE / ACWI' },
  { id: 'akcje-usa', name: 'Akcje USA', sub: 'Duże amerykańskie spółki', group: 'akcje', proxy: 'CSPX / SPY' },
  { id: 'akcje-em', name: 'Akcje rynków wschodzących', sub: 'Chiny, Indie, Brazylia i inne', group: 'akcje', proxy: 'EIMI / EEM' },
  { id: 'obl-skarb', name: 'Obligacje skarbowe', sub: 'Pożyczki dla państw, średni termin', group: 'obligacje', proxy: 'IEF / IBTM' },
  { id: 'obl-korp', name: 'Obligacje korporacyjne', sub: 'Pożyczki dla firm o dobrej kondycji', group: 'obligacje', proxy: 'LQD / IBCX' },
  { id: 'zloto', name: 'Złoto', sub: 'Zabezpieczenie przed kryzysami i inflacją', group: 'zloto', proxy: 'SGLN / GLD' },
  { id: 'gotowka', name: 'Gotówka (krótkie obligacje)', sub: 'Najmniejsze wahania, łatwy dostęp', group: 'gotowka', proxy: 'SHV / XEON' },
];

export const INSTRUMENT_COUNT = INSTRUMENTS.length;

export interface Group {
  id: GroupId;
  name: string;
  /** dopełniacz do zdań typu „mniej gotówki, więcej akcji” */
  genitive: string;
  /** kolor na wykresach (te same wartości co --c-* w styles/tokens.css) */
  color: string;
  /** indeksy instrumentów należących do grupy */
  indexes: readonly number[];
}

export const GROUPS: readonly Group[] = [
  { id: 'akcje', name: 'Akcje', genitive: 'akcji', color: '#1D4F7C', indexes: [0, 1, 2] },
  { id: 'obligacje', name: 'Obligacje', genitive: 'obligacji', color: '#5B97CF', indexes: [3, 4] },
  { id: 'zloto', name: 'Złoto', genitive: 'złota', color: '#E8A92E', indexes: [5] },
  { id: 'gotowka', name: 'Gotówka', genitive: 'gotówki', color: '#CBD3DB', indexes: [6] },
];

export const EQUITY_INDEXES = GROUPS[0]!.indexes;

export function groupOf(instrumentIndex: number): Group {
  return GROUPS.find((g) => g.indexes.includes(instrumentIndex)) as Group;
}

export function colorOf(instrumentIndex: number): string {
  return groupOf(instrumentIndex).color;
}

/** Słowne nazwy poziomu ryzyka na skali 1–7 (indeks 0 jest pusty — skala zaczyna się od 1). */
export const RISK_WORDS = [
  '',
  'bardzo niskie',
  'niskie',
  'umiarkowane',
  'podwyższone',
  'wysokie',
  'bardzo wysokie',
  'najwyższe',
] as const;
