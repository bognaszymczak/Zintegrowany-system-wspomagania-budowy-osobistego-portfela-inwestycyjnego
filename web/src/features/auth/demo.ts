/**
 * Konto demonstracyjne — istnieje tylko w trybie z atrapami (domyślnym; wyłącza je VITE_USE_MOCKS=false).
 * Ekran konta pokazuje te dane jako podpowiedź, a mock logowania (src/mocks/handlers/auth.ts) je akceptuje.
 * W produkcji (VITE_USE_MOCKS=false) nic z tego nie jest używane — prawdziwe konta tworzy backend.
 */
export const DEMO_ACCOUNT = {
  email: 'demo@horyzont.pl',
  password: 'demo-haslo-12345',
  name: 'Anna',
} as const;
