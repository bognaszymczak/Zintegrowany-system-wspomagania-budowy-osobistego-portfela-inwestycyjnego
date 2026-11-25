import { GROUPS } from '@/domain/portfolio/instruments';
import { DONUT_RADIUS, donutSegments } from './geometry';

interface DonutProps {
  /** udziały czterech grup (akcje, obligacje, złoto, gotówka) w procentach */
  totals: readonly number[];
  size?: number;
  /** napis w środku: duży i mały (np. „3/7” i „ryzyko”) */
  center?: { big: string; small?: string };
}

/** Pierścień pokazujący skład portfela. Opis dla czytników ekranu jest zawsze zapisany słowami. */
export function Donut({ totals, size = 148, center }: DonutProps) {
  const label =
    'Skład portfela: ' +
    GROUPS.map((group, index) => `${group.name.toLowerCase()} ${Math.round(totals[index] ?? 0)}%`).join(', ');

  return (
    <svg className="donut" width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={label}>
      <circle cx="60" cy="60" r={DONUT_RADIUS} fill="none" stroke="#E9EEF2" strokeWidth="18" />
      {donutSegments(totals).map((segment) => (
        <circle
          key={segment.id}
          cx="60"
          cy="60"
          r={DONUT_RADIUS}
          fill="none"
          stroke={segment.color}
          strokeWidth="18"
          strokeDasharray={`${segment.dash.toFixed(2)} ${segment.gap.toFixed(2)}`}
          strokeDashoffset={segment.offset.toFixed(2)}
          transform="rotate(-90 60 60)"
        />
      ))}
      {center ? (
        <>
          <text x="60" y={center.small ? 61 : 67} textAnchor="middle" className="donut__big">
            {center.big}
          </text>
          {center.small ? (
            <text x="60" y="77" textAnchor="middle" className="donut__small">
              {center.small}
            </text>
          ) : null}
        </>
      ) : null}
    </svg>
  );
}
