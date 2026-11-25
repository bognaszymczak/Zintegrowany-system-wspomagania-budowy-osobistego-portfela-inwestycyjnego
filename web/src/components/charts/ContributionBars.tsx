import type { RiskContribution } from '@/domain/portfolio/assessment';

/**
 * Dla każdej grupy dwa paski: ile to pieniędzy (jasny) i ile ryzyka (ciemny).
 * Różnica między nimi pokazuje, że np. akcje to 46% pieniędzy, ale 82% ryzyka.
 */
export function ContributionBars({ items }: { items: readonly RiskContribution[] }) {
  return (
    <div className="contrib">
      <div className="contrib__legend" aria-hidden="true">
        <span>
          <i className="contrib__key contrib__key--money" /> udział w pieniądzach
        </span>
        <span>
          <i className="contrib__key contrib__key--risk" /> udział w ryzyku
        </span>
      </div>
      <ul className="contrib__list">
        {items.map((item) => (
          <li key={item.group}>
            <div className="contrib__name">{item.name}</div>
            <div className="contrib__bars">
              <div className="contrib__row">
                <span className="contrib__track">
                  <span className="contrib__fill contrib__fill--money" style={{ width: `${item.weightPct}%` }} />
                </span>
                <b>
                  {Math.round(item.weightPct)}%<span className="visually-hidden"> pieniędzy</span>
                </b>
              </div>
              <div className="contrib__row">
                <span className="contrib__track">
                  <span className="contrib__fill contrib__fill--risk" style={{ width: `${item.riskPct}%` }} />
                </span>
                <b>
                  {Math.round(item.riskPct)}%<span className="visually-hidden"> ryzyka</span>
                </b>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
