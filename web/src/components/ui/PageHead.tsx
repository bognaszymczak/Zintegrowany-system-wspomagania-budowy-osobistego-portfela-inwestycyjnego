import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';

interface PageHeadProps {
  /** mała etykieta nad tytułem, np. „Krok 2 · Propozycje” */
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  /** link „wróć” nad tytułem */
  back?: { to: string; label: string };
  /** dodatkowy element obok tytułu (np. plakietka z nazwą portfela) */
  badge?: ReactNode;
}

/**
 * Nagłówek ekranu. Po przejściu na nowy ekran fokus trafia na tytuł,
 * dzięki czemu czytnik ekranu od razu ogłasza, gdzie jesteśmy (tak samo jak w formularzu).
 */
export function PageHead({ eyebrow, title, lead, back, badge }: PageHeadProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <header className="pagehead">
      {back ? (
        <Link to={back.to} className="backlink">
          <Icon name="arrowLeft" size={18} />
          {back.label}
        </Link>
      ) : null}
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <div className="pagehead__row">
        <h1 ref={headingRef} tabIndex={-1}>
          {title}
        </h1>
        {badge}
      </div>
      {lead ? <p className="pagehead__lead">{lead}</p> : null}
    </header>
  );
}
