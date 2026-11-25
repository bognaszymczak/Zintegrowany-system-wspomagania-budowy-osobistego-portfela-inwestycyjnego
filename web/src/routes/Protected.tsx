import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { USE_MOCKS } from '@/api/client';
import { useMe } from '@/api/hooks';
import { Loading } from '@/components/ui/QueryState';
import { useSession } from '@/session/SessionProvider';

/**
 * Jak daleko w ścieżce musi być użytkownik, żeby wejść na ekran (każdy poziom zawiera poprzednie):
 *  - account: jest zalogowany,
 *  - profile: wypełnił formularz (mamy profil),
 *  - choice:  wybrał portfel (mamy propozycję i udziały).
 * Gdy czegoś brakuje, odsyłamy na właściwy, wcześniejszy ekran — adresy wpisane „z palca” nie zepsują ścieżki.
 */
export type Requirement = 'account' | 'profile' | 'choice';

export function Protected({ need, children }: { need: Requirement; children: ReactNode }) {
  const me = useMe();
  const { profile, proposalId, weights } = useSession();

  // W trybie pokazowym (atrapy) całą ścieżkę można przejść bez konta — wygodne na prezentacji.
  // W produkcji ekran wymaga zalogowania.
  if (!USE_MOCKS) {
    if (me.isPending) return <Loading label="Sprawdzamy, czy jesteś zalogowany…" />;
    if (!me.data) return <Navigate to="/konto?tryb=logowanie" replace />;
  }

  if (need !== 'account' && !profile) return <Navigate to="/formularz" replace />;
  if (need === 'choice' && (!proposalId || !weights)) return <Navigate to="/portfele" replace />;

  return <>{children}</>;
}
