import type { FanPoint } from '@/domain/portfolio/engine';
import { CHART_COLORS } from './colors';
import { spreadLabels, yearStep, yearsLabel } from './geometry';
import { axisMoney, linePath, niceTicks } from './scale';
import { useContainerWidth } from './useContainerWidth';
import { zl } from '@/domain/portfolio/format';

interface FanChartProps {
  fan: readonly FanPoint[];
  /** kwota celu (zł) albo null */
  goal: number | null;
  label: string;
}

/**
 * Wachlarz wyników: pas pomiędzy złym a dobrym scenariuszem (10.–90. percentyl),
 * linia wyniku typowego, suma wpłat i (opcjonalnie) cel. Pokazuje, że przyszłość to „pas możliwości”,
 * a nie jedna liczba.
 */
export function FanChart({ fan, goal, label }: FanChartProps) {
  const [ref, width] = useContainerWidth<HTMLDivElement>();
  const compact = width < 520;
  const height = compact ? 250 : 310;
  const m = compact
    ? { top: 16, right: 50, bottom: 28, left: 44 }
    : { top: 18, right: 64, bottom: 30, left: 56 };

  const last = fan[fan.length - 1];
  if (!last || fan.length < 2) return <div ref={ref} className="chart" />;

  const innerW = width - m.left - m.right;
  const innerH = height - m.top - m.bottom;
  const totalYears = last.years;
  const maxValue = Math.max(last.p90, last.paidIn, goal ?? 0);
  const ticks = niceTicks(0, maxValue * 1.05, 4);
  const x = (years: number) => m.left + (years / totalYears) * innerW;
  const y = (v: number) => m.top + innerH - ((v - ticks.min) / (ticks.max - ticks.min)) * innerH;

  const upper = fan.map((p) => ({ x: x(p.years), y: y(p.p90) }));
  const lower = fan.map((p) => ({ x: x(p.years), y: y(p.p10) }));
  const bandPath = `${linePath(upper)}${lower
    .slice()
    .reverse()
    .map((p) => `L${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join('')}Z`;

  const step = yearStep(innerW / totalYears);
  const yearMarks: number[] = [];
  for (let year = 0; year <= totalYears + 1e-9; year += step) yearMarks.push(year);

  // podpisy wartości na końcu wykresu (dobry, typowy, zły) — rozsuwane, gdy leżą zbyt blisko
  const endLabels = [
    { text: axisMoney(last.p90), y: y(last.p90) },
    { text: axisMoney(last.median), y: y(last.median) },
    { text: axisMoney(last.p10), y: y(last.p10) },
  ];
  const labelY = spreadLabels(
    endLabels.map((l) => l.y),
    15,
    m.top + 6,
    m.top + innerH,
  );

  return (
    <div ref={ref} className="chart">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        {ticks.ticks.map((tick) => (
          <g key={tick}>
            <line x1={m.left} x2={m.left + innerW} y1={y(tick)} y2={y(tick)} className="chart__grid" />
            <text x={m.left - 8} y={y(tick) + 4} textAnchor="end" className="chart__tick">
              {axisMoney(tick)}
            </text>
          </g>
        ))}

        {yearMarks.map((year) => (
          <text key={year} x={x(year)} y={height - 8} textAnchor="middle" className="chart__tick">
            {year === 0 ? 'dziś' : yearsLabel(Math.round(year))}
          </text>
        ))}

        <path d={bandPath} fill={CHART_COLORS.band} fillOpacity="0.14" stroke="none" />
        <path d={linePath(upper)} fill="none" stroke={CHART_COLORS.band} strokeOpacity="0.45" strokeWidth="1.2" />
        <path d={linePath(lower)} fill="none" stroke={CHART_COLORS.band} strokeOpacity="0.45" strokeWidth="1.2" />

        <path
          d={linePath(fan.map((p) => ({ x: x(p.years), y: y(p.paidIn) })))}
          fill="none"
          stroke={CHART_COLORS.paidIn}
          strokeWidth="1.8"
          strokeDasharray="5 4"
        />

        {goal !== null ? (
          <g>
            <line
              x1={m.left}
              x2={m.left + innerW}
              y1={y(goal)}
              y2={y(goal)}
              stroke={CHART_COLORS.goal}
              strokeWidth="1.8"
              strokeDasharray="2 4"
              strokeLinecap="round"
            />
            <text x={m.left + 6} y={y(goal) - 6} className="chart__goal-label">
              Cel: {zl(goal, 1000)}
            </text>
          </g>
        ) : null}

        <path
          d={linePath(fan.map((p) => ({ x: x(p.years), y: y(p.median) })))}
          fill="none"
          stroke={CHART_COLORS.median}
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {endLabels.map((item, index) => (
          <text
            key={item.text + index}
            x={m.left + innerW + 8}
            y={(labelY[index] ?? item.y) + 4}
            className={index === 1 ? 'chart__end chart__end--strong' : 'chart__end'}
          >
            {item.text}
          </text>
        ))}
      </svg>
    </div>
  );
}
