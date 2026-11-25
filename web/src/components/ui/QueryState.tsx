import type { ReactNode } from 'react';
import { humanizeError } from '@/api/client';
import { Notice } from '@/components/Notice';

/** Minimalny kształt wyniku zapytania, jaki potrzebujemy (zgodny z useQuery z TanStack Query). */
interface QueryLike<T> {
  data: T | undefined;
  isPending: boolean;
  error: unknown;
  refetch: () => unknown;
}

interface QueryStateProps<T> {
  query: QueryLike<T>;
  /** komunikat na czas ładowania, np. „Układamy propozycje…” */
  loading: string;
  children: (data: T) => ReactNode;
}

/**
 * Jedno miejsce na trzy stany każdego zapytania: ładowanie, błąd (z przyciskiem „spróbuj ponownie”)
 * i dane. Dzięki temu ekrany piszą tylko to, co pokazać, gdy dane już są.
 */
export function QueryState<T>({ query, loading, children }: QueryStateProps<T>) {
  if (query.data !== undefined) return <>{children(query.data)}</>;

  if (query.error) {
    return (
      <Notice tone="error">
        <p>{humanizeError(query.error)}</p>
        <button type="button" className="link-button" onClick={() => void query.refetch()}>
          Spróbuj ponownie
        </button>
      </Notice>
    );
  }

  return <Loading label={loading} />;
}

/** Spinner z opisem; `role="status"` sprawia, że czytnik ekranu ogłasza, na co czekamy. */
export function Loading({ label }: { label: string }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
