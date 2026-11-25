/**
 * JEDYNE miejsce w aplikacji, które wysyła zapytania sieciowe.
 *
 * Reszta kodu woła funkcje z endpoints.ts i hooki z hooks.ts — nigdy fetch bezpośrednio.
 * Dzięki temu:
 *  - przełączenie z mocków na prawdziwy backend to zmiana jednej zmiennej (VITE_USE_MOCKS),
 *  - adres, nagłówki, ciasteczka i obsługę błędów ustawiamy raz,
 *  - klucze do zewnętrznych API (giełda, kursy walut) zostają na serwerze, nie w przeglądarce.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
}

/** Błąd zwrócony przez API (albo brak połączenia: status 0). Komunikat jest gotowy do pokazania. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Prefiks adresów API. W trybie dev Vite przekazuje "/api" do backendu (patrz vite.config.ts). */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '');

/**
 * true = zamiast sieci używamy mocków z src/mocks (aplikacja działa bez backendu).
 * Atrapy są włączone DOMYŚLNIE (po `npm install` + `npm run dev` wszystko działa bez żadnej konfiguracji);
 * prawdziwe API włączasz jawnie: VITE_USE_MOCKS=false w pliku web/.env.
 */
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false';

export function buildUrl(path: string, query?: RequestOptions['query']): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  return `${API_BASE_URL}${path}${qs ? `?${qs}` : ''}`;
}

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Wysłane dane są niepoprawne. Sprawdź formularz i spróbuj ponownie.',
  401: 'Zaloguj się, aby kontynuować.',
  403: 'Brak dostępu do tych danych.',
  404: 'Nie znaleziono żądanych danych.',
  409: 'Takie konto już istnieje. Spróbuj się zalogować.',
  422: 'Wysłane dane są niepoprawne. Sprawdź formularz i spróbuj ponownie.',
  429: 'Zbyt wiele zapytań. Poczekaj chwilę i spróbuj ponownie.',
};

async function toApiError(response: Response): Promise<ApiError> {
  let code = 'http_error';
  let message =
    STATUS_MESSAGES[response.status] ??
    (response.status >= 500
      ? 'Serwer ma chwilowy problem. Spróbuj ponownie za moment.'
      : 'Nie udało się wykonać operacji.');
  let details: unknown;
  try {
    // Nasz backend zwraca {code, message}; FastAPI przy błędach walidacji — {detail: [...]}.
    const body = (await response.json()) as { code?: string; message?: string; detail?: unknown };
    if (typeof body.code === 'string') code = body.code;
    if (typeof body.message === 'string') message = body.message;
    details = body.detail ?? body;
  } catch {
    /* odpowiedź bez JSON-a — zostaje komunikat domyślny */
  }
  return new ApiError(response.status, code, message, details);
}

export async function api<T>(
  method: HttpMethod,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  if (USE_MOCKS) {
    // Import dynamiczny: w buildzie z VITE_USE_MOCKS=false mocki nie trafiają do paczki.
    const { handleMockRequest } = await import('@/mocks/router');
    return handleMockRequest<T>(method, path, options);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      // ciasteczka sesyjne (httpOnly) ustawia backend; JavaScript nie ma do nich dostępu
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError(
      0,
      'network_error',
      'Nie udało się połączyć z serwerem. Sprawdź połączenie z internetem i spróbuj ponownie.',
      cause,
    );
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Zamienia dowolny błąd na zdanie, które można pokazać użytkownikowi. */
export function humanizeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Coś poszło nie tak. Spróbuj ponownie za chwilę.';
}
