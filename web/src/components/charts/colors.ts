/**
 * Kolory serii na wykresach. To te same wartości, co tokeny w styles/tokens.css
 * (SVG potrzebuje ich jako zwykłych tekstów, więc powtarzamy je tutaj).
 * Linie różnią się też kształtem (ciągła / kropkowana / kreskowana), żeby dało się je odróżnić bez koloru.
 */
export const CHART_COLORS = {
  portfolio: '#0D5C63',
  sp500: '#5B97CF',
  inflation: '#E8A92E',
  deposit: '#7D8FA0',
  median: '#0D5C63',
  band: '#0D5C63',
  paidIn: '#5B6B7B',
  goal: '#C77A0A',
} as const;
