/**
 * Katalog wszystkich zapytań do backendu — jedno miejsce, jedna funkcja na endpoint.
 * Aby podłączyć nowy endpoint: dodaj typ w types.ts, funkcję tutaj i hook w hooks.ts.
 */
import { ApiError, api } from './client';
import type {
  AssumptionsResponse,
  AuthResponse,
  AuthUser,
  BacktestResponse,
  LoginRequest,
  ProfileRequest,
  ProfileResponse,
  ProposalsResponse,
  RegisterRequest,
  RiskAssessmentRequest,
  RiskAssessmentResponse,
  SaveChoiceRequest,
  SavedChoice,
} from './types';

export const endpoints = {
  // ----- konto -----
  register: (body: RegisterRequest) => api<AuthResponse>('POST', '/auth/register', { body }),
  login: (body: LoginRequest) => api<AuthResponse>('POST', '/auth/login', { body }),
  logout: () => api<void>('POST', '/auth/logout'),
  /** Zwraca zalogowanego użytkownika albo null (brak sesji to nie błąd). */
  me: async (): Promise<AuthUser | null> => {
    try {
      return (await api<AuthResponse>('GET', '/auth/me')).user;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  },

  // ----- formularz wstępny -----
  /** Wysyła odpowiedzi z formularza; backend zwraca profil i granice ryzyka. */
  submitProfile: (body: ProfileRequest) => api<ProfileResponse>('POST', '/profile', { body }),

  // ----- propozycje portfeli -----
  /** Trzy propozycje dla profilu; `level` to poziom po ewentualnej korekcie na ekranie profilu. */
  getProposals: (profileId: string, level: number) =>
    api<ProposalsResponse>('GET', '/proposals', { query: { profileId, level } }),

  // ----- dane rynkowe (z bazy danych backendu) -----
  getAssumptions: () => api<AssumptionsResponse>('GET', '/market/assumptions'),
  getBacktest: (weights: readonly number[]) =>
    api<BacktestResponse>('GET', '/market/backtest', { query: { weights: weights.join(',') } }),

  // ----- zapisany wybór (panel użytkownika) -----
  saveChoice: (body: SaveChoiceRequest) => api<SavedChoice>('POST', '/choices', { body }),
  deleteChoice: (id: string) => api<void>('DELETE', `/choices/${encodeURIComponent(id)}`),

  // ----- ocena ryzyka (model ML) -----
  assessRisk: (body: RiskAssessmentRequest) =>
    api<RiskAssessmentResponse>('POST', '/risk-assessment', { body }),
};
