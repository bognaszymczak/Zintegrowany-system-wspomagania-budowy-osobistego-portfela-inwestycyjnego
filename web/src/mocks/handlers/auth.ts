import { ApiError } from '@/api/client';
import type { AuthResponse, AuthUser, LoginRequest, RegisterRequest } from '@/api/types';
import { DEMO_ACCOUNT } from '@/features/auth/demo';
import type { MockRoute } from '../router';
import { readJson, removeKey, writeJson } from '../store';

/** Konto demonstracyjne — działa zawsze, nawet po wyczyszczeniu danych przeglądarki. */
export { DEMO_ACCOUNT };

interface StoredUser extends AuthUser {
  /** UWAGA: hasło jawnym tekstem tylko w mocku! Prawdziwy backend zapisuje wyłącznie hash. */
  password: string;
}

const USERS_KEY = 'horyzont.mock.users';
const SESSION_KEY = 'horyzont.mock.session';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MIN_PASSWORD_LENGTH = 10;

/** Ten sam komunikat zwraca prawdziwy backend (api/app/services/consents.py). */
export const ADULT_REQUIRED_MESSAGE =
  'Z Horyzontu mogą korzystać wyłącznie osoby pełnoletnie. Aby założyć konto, potwierdź, że masz ukończone 18 lat.';

function users(): StoredUser[] {
  const stored = readJson<StoredUser[]>('local', USERS_KEY, []);
  const hasDemo = stored.some((u) => u.email === DEMO_ACCOUNT.email);
  return hasDemo
    ? stored
    : [{ id: 'u-demo', name: DEMO_ACCOUNT.name, email: DEMO_ACCOUNT.email, password: DEMO_ACCOUNT.password }, ...stored];
}

const publicUser = ({ id, name, email }: StoredUser): AuthUser => ({ id, name, email });
const normalize = (email: string) => email.trim().toLowerCase();

export const authRoutes: MockRoute[] = [
  {
    method: 'POST',
    path: '/auth/register',
    handler: ({ body }): AuthResponse => {
      const b = (body ?? {}) as Partial<RegisterRequest>;
      const email = normalize(String(b.email ?? ''));
      const password = String(b.password ?? '');
      // tak samo jak backend (api/app/services/consents.py): bez oświadczenia o pełnoletności konto nie powstaje
      if (b.adultConfirmed !== true) {
        throw new ApiError(422, 'adult_required', ADULT_REQUIRED_MESSAGE);
      }
      if (!EMAIL_RE.test(email) || password.length < MIN_PASSWORD_LENGTH || !b.acceptTerms || !b.acceptSimulation) {
        throw new ApiError(422, 'validation_error', 'Wysłane dane są niepoprawne.');
      }
      const all = users();
      if (all.some((u) => u.email === email)) {
        throw new ApiError(409, 'email_taken', 'Konto z tym adresem e-mail już istnieje. Spróbuj się zalogować.');
      }
      const name = String(b.name ?? '').trim();
      const user: StoredUser = {
        id: `u-${Date.now().toString(36)}`,
        name: name === '' ? null : name,
        email,
        password,
      };
      writeJson('local', USERS_KEY, [...all.filter((u) => u.id !== 'u-demo'), user]);
      writeJson('session', SESSION_KEY, user.id);
      return { user: publicUser(user) };
    },
  },
  {
    method: 'POST',
    path: '/auth/login',
    handler: ({ body }): AuthResponse => {
      const b = (body ?? {}) as Partial<LoginRequest>;
      const email = normalize(String(b.email ?? ''));
      const user = users().find((u) => u.email === email && u.password === String(b.password ?? ''));
      if (!user) {
        throw new ApiError(401, 'invalid_credentials', 'Nieprawidłowy adres e-mail lub hasło.');
      }
      writeJson('session', SESSION_KEY, user.id);
      return { user: publicUser(user) };
    },
  },
  {
    method: 'POST',
    path: '/auth/logout',
    handler: () => {
      removeKey('session', SESSION_KEY);
      return undefined;
    },
  },
  {
    method: 'GET',
    path: '/auth/me',
    handler: (): AuthResponse => {
      const id = readJson<string | null>('session', SESSION_KEY, null);
      const user = id ? users().find((u) => u.id === id) : undefined;
      if (!user) throw new ApiError(401, 'unauthorized', 'Zaloguj się, aby kontynuować.');
      return { user: publicUser(user) };
    },
  },
];
