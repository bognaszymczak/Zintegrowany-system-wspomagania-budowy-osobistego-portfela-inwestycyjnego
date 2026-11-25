export type RiskLevel = 1 | 2 | 3 | 4 | 5;

/** Granice ryzyka przypisane do poziomu profilu. Portfele nie mogą ich przekraczać. */
export interface RiskProfile {
  level: RiskLevel;
  name: string;
  /** typowe roczne wahania wartości portfela (odchylenie standardowe), ułamek */
  volatility: number;
  /** największy dopuszczalny spadek od szczytu w scenariuszach kryzysowych (ujemny ułamek) */
  maxDrawdown: number;
  /** największy łączny udział akcji, ułamek */
  maxEquity: number;
  /** największy udział pojedynczej pozycji, ułamek */
  maxPosition: number;
  /** słowo do zdania „…w … granicach ryzyka” */
  rangeWord: string;
}

export const PROFILES: readonly RiskProfile[] = [
  { level: 1, name: 'Bardzo ostrożny', volatility: 0.04, maxDrawdown: -0.08, maxEquity: 0.15, maxPosition: 0.4, rangeWord: 'bardzo ostrożnych' },
  { level: 2, name: 'Ostrożny', volatility: 0.07, maxDrawdown: -0.14, maxEquity: 0.3, maxPosition: 0.35, rangeWord: 'ostrożnych' },
  { level: 3, name: 'Zrównoważony', volatility: 0.1, maxDrawdown: -0.2, maxEquity: 0.5, maxPosition: 0.3, rangeWord: 'umiarkowanych' },
  { level: 4, name: 'Dynamiczny', volatility: 0.13, maxDrawdown: -0.28, maxEquity: 0.7, maxPosition: 0.3, rangeWord: 'podwyższonych' },
  { level: 5, name: 'Odważny', volatility: 0.17, maxDrawdown: -0.38, maxEquity: 0.9, maxPosition: 0.3, rangeWord: 'wysokich' },
];

export function clampLevel(level: number): RiskLevel {
  return Math.min(5, Math.max(1, Math.round(level))) as RiskLevel;
}

export function profileByLevel(level: number): RiskProfile {
  return PROFILES[clampLevel(level) - 1] as RiskProfile;
}

/** Formatowanie ułamka jako procentu z minusem typograficznym: -0.2 -> "−20%". */
export function pct(x: number, digits = 0): string {
  const s = (Math.abs(x) * 100).toFixed(digits).replace('.', ',');
  return (x < 0 ? '−' : '') + s + '%';
}
