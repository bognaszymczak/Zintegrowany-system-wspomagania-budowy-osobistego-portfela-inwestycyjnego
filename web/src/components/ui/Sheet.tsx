import { useId, type ReactNode } from 'react';

interface SheetProps {
  title?: ReactNode;
  sub?: ReactNode;
  /** domyślnie biała karta; `soft` = szare tło, `dark` = ciemna (nagłówek oceny) */
  tone?: 'default' | 'soft' | 'dark';
  /** element po prawej od tytułu (np. przycisk „Wróć do propozycji”) */
  action?: ReactNode;
  className?: string;
  id?: string;
  children: ReactNode;
}

/** Biała karta z tytułem — podstawowy „klocek” wszystkich ekranów po zalogowaniu. */
export function Sheet({ title, sub, tone = 'default', action, className, id, children }: SheetProps) {
  const headingId = useId();
  return (
    <section
      id={id}
      className={`sheet sheet--${tone}${className ? ` ${className}` : ''}`}
      aria-labelledby={title ? headingId : undefined}
    >
      {title ? (
        <header className="sheet__head">
          <div className="sheet__titles">
            <h2 id={headingId} className="sheet__title">
              {title}
            </h2>
            {sub ? <p className="sheet__sub">{sub}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}
