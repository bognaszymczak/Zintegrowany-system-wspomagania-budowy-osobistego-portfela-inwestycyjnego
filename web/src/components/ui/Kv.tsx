import type { ReactNode } from 'react';

export interface KvItem {
  label: ReactNode;
  value: ReactNode;
  /** drobny dopisek pod wartością, np. „zakres 86–138 tys. zł” */
  sub?: ReactNode;
}

/**
 * Lista „etykieta — wartość” (np. Typowy wynik po 10 latach … 108 400 zł).
 * Używa <dl>, więc czytnik ekranu zapowiada pary jako definicje.
 */
export function KvList({ items, dense = false }: { items: readonly KvItem[]; dense?: boolean }) {
  return (
    <dl className={`kv${dense ? ' kv--dense' : ''}`}>
      {items.map((item, index) => (
        <div className="kv__row" key={index}>
          <dt>{item.label}</dt>
          <dd>
            <b>{item.value}</b>
          </dd>
          {/* drugie <dd> dla tej samej etykiety jest poprawne w HTML; CSS rozciąga je pod całym wierszem */}
          {item.sub ? <dd className="kv__sub">{item.sub}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

/** Kafelek z jedną liczbą (np. na stronie startowej i w podsumowaniach). */
export function StatTile({ label, value, sub }: KvItem) {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {sub ? <div className="stat__sub">{sub}</div> : null}
    </div>
  );
}
