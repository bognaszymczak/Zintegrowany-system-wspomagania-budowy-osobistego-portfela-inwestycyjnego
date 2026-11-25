/** Formatowanie liczb na ekranach: twarde spacje, przecinek dziesiętny, minus typograficzny. */
const NBSP = ' ';

/** 108400 -> „108 400” (twarda spacja jako separator tysięcy). */
export function plain(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** Kwota w złotych zaokrąglona do `step` (domyślnie 100 zł): 108412 -> „108 400 zł”. */
export function zl(n: number, step = 100): string {
  return `${plain(Math.round(n / step) * step)}${NBSP}zł`;
}

/** Zakres w tysiącach: (86200, 138100) -> „86–138 tys. zł”. */
export function rangeTys(lo: number, hi: number): string {
  return `${Math.round(lo / 1000)}–${Math.round(hi / 1000)}${NBSP}tys.${NBSP}zł`;
}

/** Liczba z przecinkiem: (0.0345, 1) -> „3,5”. */
export function dec(n: number, digits = 1): string {
  return n.toFixed(digits).replace('.', ',');
}

/** Zmiana w punktach procentowych ze znakiem: 0.73 -> „+0,7”, −0.4 -> „−0,4”. */
export function signedPp(n: number, digits = 1): string {
  const text = dec(Math.abs(n), digits);
  return n < 0 ? `−${text}` : `+${text}`;
}

/** Udział (0–1) jako procent bez miejsc po przecinku: 0.677 -> „68%”. */
export function percentRound(x: number): string {
  return `${Math.round(x * 100)}%`;
}
