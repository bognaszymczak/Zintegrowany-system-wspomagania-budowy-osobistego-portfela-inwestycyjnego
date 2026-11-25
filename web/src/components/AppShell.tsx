import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLogout, useMe } from '@/api/hooks';
import { useSession } from '@/session/SessionProvider';
import { JourneyBar } from './JourneyBar';
import { Logo } from './Logo';

interface AppShellProps {
  /** numer etapu ścieżki (1–5); bez niego pasek ścieżki się nie pokazuje (strona startowa, konto) */
  stage?: number;
  children: ReactNode;
}

/** Wspólna rama ekranów: nagłówek z logo i użytkownikiem, pasek ścieżki, stopka z zastrzeżeniem. */
export function AppShell({ stage, children }: AppShellProps) {
  const me = useMe();
  const logout = useLogout();
  const session = useSession();
  const user = me.data ?? null;
  const firstName = user ? (user.name ?? user.email.split('@')[0] ?? '') : '';

  return (
    <div className="app">
      <a href="#glowna-tresc" className="skip-link">
        Przejdź do treści
      </a>
      <header className="app-header">
        <div className="app-header__inner">
          <Link to="/" className="brand">
            <Logo />
            <span>Horyzont</span>
          </Link>
          <div className="user-chip">
            {user ? (
              <>
                <span>Cześć, {firstName}</span>
                <span className="avatar" aria-hidden="true">
                  {firstName.slice(0, 1).toUpperCase()}
                </span>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    session.reset();
                    logout.mutate();
                  }}
                >
                  Wyloguj
                </button>
              </>
            ) : (
              <Link to="/konto">Zaloguj się</Link>
            )}
          </div>
        </div>
        {stage ? <JourneyBar current={stage} /> : null}
      </header>

      <div className="app__main" id="glowna-tresc" tabIndex={-1}>
        {children}
      </div>

      <footer className="app-footer">
        <div className="app-footer__inner">
          Horyzont to narzędzie do nauki i symulacji, a nie doradztwo inwestycyjne ani rekomendacja.
          Wyniki z przeszłości nie gwarantują wyników w przyszłości.
        </div>
      </footer>
    </div>
  );
}
