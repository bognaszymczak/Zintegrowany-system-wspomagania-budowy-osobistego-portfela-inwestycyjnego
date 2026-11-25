import { AppShell } from '@/components/AppShell';
import { usePageTitle } from '@/components/usePageTitle';
import { OnboardingForm } from '@/features/onboarding/OnboardingForm';

/** Ekran 3: formularz wstępny (5 kroków). */
export function OnboardingPage() {
  usePageTitle('Formularz wstępny');
  return (
    <AppShell stage={1}>
      <OnboardingForm />
    </AppShell>
  );
}
