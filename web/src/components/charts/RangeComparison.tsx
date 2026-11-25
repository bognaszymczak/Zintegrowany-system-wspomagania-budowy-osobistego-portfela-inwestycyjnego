import { niceTicks } from './scale';
import { plain, rangeTys, zl } from '@/domain/portfolio/format';

export interface RangeRow {
  id: string;
  name: string;
  /** zły (10. percentyl), typowy (mediana) i dobry (90. percentyl) wynik w zł */
  p10: number;
  median: number;
  p90: number;
}

interface RangeComparisonProps {
  rows: readonly RangeRow[];
  /** suma wpłat użytkownika w całym okresie (zł) */
  paidIn: number;
  /** kwota celu (zł) albo null */
  goal: number | null;
}

/**
 * Porównanie zakresów wyników kilku portfeli na jednej osi.
 * Pasek = zakres 8 z 10 scenariuszy, ciemna kreska = wynik typowy; pionowe linie to suma wpłat i cel.
 * Zbudowane z HTML i procentowych pozycji (a nie z SVG), więc napisy skalują się jak zwykły tekst.
 */
export function RangeComparison({ rows, paidIn, goal }: RangeComparisonProps) {
  const lows = rows.map((r) => r.p10).concat(paidIn);
  const highs = rows.map((r) => r.p90).concat(paidIn, goal ?? 0);
  const axis = niceTicks(Math.min(...lows) * 0.9, Math.max(...highs) * 1.03, 4);
  const pos = (value: number) => `${(((value - axis.min) / (axis.max - axis.min)) * 100).toFixed(2)}%`;

  return (
    <div className="rc">
      <div className="rc__row rc__row--head">
        <span />
        <div className="rc__track rc__track--head">
          <span className="rc__flag rc__flag--paid" style={{ left: pos(paidIn) }}>
            Wpłacisz {zl(paidIn, 1000)}
          </span>
          {goal !== null ? (
            <span className="rc__flag rc__flag--goal" style={{ left: pos(goal) }}>
              Cel {zl(goal, 1000)}
            </span>
          ) : null}
        </div>
        <span />
      </div>

      {rows.map((row) => (
        <div className="rc__row" key={row.id}>
          <span className="rc__name">{row.name}</span>
          <div
            className="rc__track"
            role="img"
            aria-label={`${row.name}: zły wynik ${plain(row.p10)} zł, typowy ${plain(row.median)} zł, dobry ${plain(row.p90)} zł`}
          >
            <span className="rc__line rc__line--paid" style={{ left: pos(paidIn) }} />
            {goal !== null ? <span className="rc__line rc__line--goal" style={{ left: pos(goal) }} /> : null}
            <span
              className="rc__bar"
              style={{
                left: pos(row.p10),
                width: `${(((row.p90 - row.p10) / (axis.max - axis.min)) * 100).toFixed(2)}%`,
              }}
            />
            <span className="rc__median" style={{ left: pos(row.median) }} />
          </div>
          <span className="rc__value">{rangeTys(row.p10, row.p90)}</span>
        </div>
      ))}

      <div className="rc__row rc__row--axis">
        <span />
        <div className="rc__track rc__track--axis" aria-hidden="true">
          {axis.ticks.map((tick, index) => (
            <span key={tick} className="rc__tick" style={{ left: pos(tick) }}>
              {Math.round(tick / 1000)}
              {index === axis.ticks.length - 1 ? ' tys. zł' : ''}
            </span>
          ))}
        </div>
        <span />
      </div>
    </div>
  );
}
