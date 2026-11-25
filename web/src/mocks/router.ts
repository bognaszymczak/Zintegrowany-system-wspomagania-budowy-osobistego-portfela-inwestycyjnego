/**
 * Mock backendu. Działa w przeglądarce, dopóki nie ustawisz VITE_USE_MOCKS=false (domyślnie jest włączony).
 *
 * Każdy handler odpowiada jednemu endpointowi z api/endpoints.ts i zwraca DOKŁADNIE ten
 * kształt danych, który zwróci prawdziwy backend (typy z api/types.ts). Handlery korzystają
 * z tej samej logiki domenowej co aplikacja (src/domain), więc liczby na ekranach są spójne.
 *
 * Przejście na prawdziwe API: ustaw VITE_USE_MOCKS=false — ten plik przestaje być ładowany.
 */
import { ApiError, type HttpMethod, type RequestOptions } from '@/api/client';
import { authRoutes } from './handlers/auth';
import { choiceRoutes } from './handlers/choices';
import { marketRoutes } from './handlers/market';
import { profileRoutes } from './handlers/profile';
import { proposalRoutes } from './handlers/proposals';

/** Zapytanie widziane przez handler: to, co wysłał klient, plus parametry ze ścieżki (np. :id). */
export type MockRequest = RequestOptions & { params?: Record<string, string> };

export type MockHandler = (request: MockRequest) => unknown;

export interface MockRoute {
  method: HttpMethod;
  /** ścieżka bez prefiksu /api; segment z dwukropkiem (np. /choices/:id) to parametr */
  path: string;
  handler: MockHandler;
  /** własne opóźnienie tej trasy (ms); domyślnie DEFAULT_LATENCY_MS */
  latencyMs?: number;
}

const ROUTES: MockRoute[] = [...authRoutes, ...profileRoutes, ...proposalRoutes, ...choiceRoutes, ...marketRoutes];

/** Opóźnienie udające sieć — dzięki niemu widać stany „ładowanie” podczas prezentacji. */
const DEFAULT_LATENCY_MS = 450;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Dopasowuje ścieżkę do wzorca (/choices/:id) i zwraca parametry albo null, gdy się nie zgadza. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const expected = pattern.split('/');
  const actual = path.split('/');
  if (expected.length !== actual.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < expected.length; i++) {
    const want = expected[i]!;
    const got = actual[i]!;
    if (want.startsWith(':')) {
      if (got === '') return null;
      params[want.slice(1)] = decodeURIComponent(got);
    } else if (want !== got) {
      return null;
    }
  }
  return params;
}

export async function handleMockRequest<T>(
  method: HttpMethod,
  path: string,
  options: RequestOptions,
): Promise<T> {
  let params: Record<string, string> | null = null;
  const route = ROUTES.find((r) => {
    if (r.method !== method) return false;
    params = matchPath(r.path, path);
    return params !== null;
  });
  await sleep(route?.latencyMs ?? DEFAULT_LATENCY_MS);
  if (!route) {
    throw new ApiError(404, 'not_found', `Mock nie obsługuje zapytania ${method} ${path}.`);
  }
  return route.handler({ ...options, params: params ?? {} }) as T;
}

