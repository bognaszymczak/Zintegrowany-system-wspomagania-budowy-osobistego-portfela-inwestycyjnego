import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AdjustPage } from '@/pages/AdjustPage';
import { AssessmentPage } from '@/pages/AssessmentPage';
import { AuthPage } from '@/pages/AuthPage';
import { DetailPage } from '@/pages/DetailPage';
import { InfoPage } from '@/pages/InfoPage';
import { LandingPage } from '@/pages/LandingPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { ProposalsPage } from '@/pages/ProposalsPage';
import { Protected } from '@/routes/Protected';

/** Po przejściu na inny ekran wracamy na górę strony (przeglądarka robi to sama tylko przy zwykłych linkach). */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/**
 * Mapa ekranów. Kolejność ścieżki użytkownika:
 *   /  →  /konto  →  /formularz  →  /profil  →  /portfele  →  /portfele/:id  →  /dopasowanie  →  /ocena
 * `need` mówi, co użytkownik musi mieć za sobą, by wejść na dany ekran (patrz routes/Protected.tsx).
 */
export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/konto" element={<AuthPage />} />
        <Route
          path="/formularz"
          element={
            <Protected need="account">
              <OnboardingPage />
            </Protected>
          }
        />
        <Route
          path="/profil"
          element={
            <Protected need="profile">
              <ProfilePage />
            </Protected>
          }
        />
        <Route
          path="/portfele"
          element={
            <Protected need="profile">
              <ProposalsPage />
            </Protected>
          }
        />
        <Route
          path="/portfele/:proposalId"
          element={
            <Protected need="profile">
              <DetailPage />
            </Protected>
          }
        />
        <Route
          path="/dopasowanie"
          element={
            <Protected need="choice">
              <AdjustPage />
            </Protected>
          }
        />
        <Route
          path="/ocena"
          element={
            <Protected need="choice">
              <AssessmentPage />
            </Protected>
          }
        />
        <Route path="/info/:slug" element={<InfoPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
