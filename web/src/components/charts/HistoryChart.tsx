import type { CrisisPeriod } from '@/api/types';
import { yearStep } from './geometry';
import { axisMoney, linePath, niceTicks } from './scale';
import { useContainerWidth } from './useContainerWidth';

export interface HistorySeries {
  id: string;
  label: string;
  color: string;
  values: readonly number[];
  /** wzór kreskowania (np. „2 4” = kropki), puste = linia ciągła */
  dash?: string;
  width?: number;
}

interface HistoryChartProps {
  /** miesiące „RRRR-MM”, wspólne dla wszystkich serii */
  dates: readonly string[];
  series: readonly HistorySeries[];
  /** okresy kryzysów rysowane jako jasne pasy */
  crises: readonly CrisisPeriod[];
  /** opis słowny wykresu (dla czytników ekranu) */
  label: string;
}

/** Wykres liniowy „co by było, gdyby…”: kilka serii w złotówkach i pasy kryzysów. */
export function HistoryChart({ dates, series, crises, label }: HistoryChartProps) {
  const [ref, width] = useContainerWidth<HTMLDivElement>();
  const compact = width < 520;
  const height = compact ? 240 : 300;
  const m = compact ? { top: 24, right: 10, bottom: 26, left: 44 } : { top: 26, right: 14, bottom: 28, left: 54 };

  const n = dates.length;
  if (n < 2 || series.length === 0) return <div ref={ref} className="chart" />;

  const innerW = width - m.left - m.right;
  const innerH = height - m.top - m.bottom;
  const maxValue = Math.max(...series.flatMap((s) => s.values));
  const ticks = niceTicks(0, maxValue * 1.04, 4);
  const x = (i: number) => m.left + (i / (n - 1)) * innerW;
  const y = (v: number) => m.top + innerH - ((v - ticks.min) / (ticks.max - ticks.min)) * innerH;

  // podpisy lat na osi X: co 1, 2, 5… lat — tak, by nie zachodziły na siebie
  const step = yearStep(innerW / ((n - 1) / 12));
  const yearMarks = dates
    .map((date, i) => ({ i, year: Number(date.slice(0, 4)), month: date.slice(5, 7) }))
    .filter((d) => d.month === '01' && d.year % step === 0);

  return (
    <div ref={ref} className="chart">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        {ticks.ticks.map((tick) => (
          <g key={tick}>
            <line x1={m.left} x2={width - m.right} y1={y(tick)} y2={y(tick)} className="chart__grid" />
            <text x={m.left - 8} y={y(tick) + 4} textAnchor="end" className="chart__tick">
              {axisMoney(tick)}
            </text>
          </g>
        ))}

        {crises.map((crisis) => {
          const from = dates.indexOf(crisis.from);
          const to = dates.indexOf(crisis.to);
          if (from < 0 || to < 0) return null;
          const x0 = x(from);
          const x1 = x(Math.min(n - 1, to + 1));
          return (
            <g key={crisis.id}>
              <rect x={x0} y={m.top} width={Math.max(3, x1 - x0)} height={innerH} className="chart__crisis" />
              <text x={(x0 + x1) / 2} y={m.top - 8} textAnchor="middle" className="chart__crisis-label">
                {crisis.id.replace('y', '')}
              </text>
            </g>
          );
        })}

        {yearMarks.map((mark) => (
          <text key={mark.i} x={x(mark.i)} y={height - 8} textAnchor="middle" className="chart__tick">
            {mark.year}
          </text>
        ))}

        {series.map((s) => (
          <path
            key={s.id}
            d={linePath(s.values.map((value, i) => ({ x: x(i), y: y(value) })))}
            fill="none"
            stroke={s.color}
            strokeWidth={s.width ?? 2.2}
            strokeDasharray={s.dash}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </svg>
    </div>
  );
}
