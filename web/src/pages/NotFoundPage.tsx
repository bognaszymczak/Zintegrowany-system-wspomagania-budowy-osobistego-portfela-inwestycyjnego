import { Link } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { PageHead } from '@/components/ui/PageHead';
import { usePageTitle } from '@/components/usePageTitle';

/** Strona wyświetlana pod nieistniejącym adresem. */
export function NotFoundPage() {
  usePageTitle('Nie znaleziono strony');
  return (
    <AppShell>
      <main className="page page--narrow">
        <PageHead
          title="Nie ma takiej strony"
          lead="Adres mógł się zmienić albo został wpisany z błędem. Wróć na początek — Twoje odpowiedzi z formularza są nadal zapisane w tej przeglądarce."
        />
        <div className="page__actions">
          <Link to="/" className="btn btn--primary">
            Wróć na stronę główną
          </Link>
        </div>
      </main>
    </AppShell>
  );
}
