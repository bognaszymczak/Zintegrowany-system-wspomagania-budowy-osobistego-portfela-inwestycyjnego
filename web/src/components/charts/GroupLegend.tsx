import { GROUPS } from '@/domain/portfolio/instruments';

/** Legenda pierścienia: kolorowy kwadracik, nazwa grupy i udział w procentach. */
export function GroupLegend({ totals }: { totals: readonly number[] }) {
  return (
    <ul className="legend">
      {GROUPS.map((group, index) => (
        <li key={group.id}>
          <span className="legend__dot" style={{ background: group.color }} aria-hidden="true" />
          <span className="legend__name">{group.name}</span>
          <b>{Math.round(totals[index] ?? 0)}%</b>
        </li>
      ))}
    </ul>
  );
}
