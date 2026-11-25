/**
 * Hooki TanStack Query — to ich używają komponenty. Komponenty nie wiedzą, czy dane
 * pochodzą z mocka, czy z prawdziwego API; dostają `data`, `isPending` i `error`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endpoints } from './endpoints';
import type { LoginRequest, ProfileRequest, RegisterRequest, RiskAssessmentRequest, SaveChoiceRequest } from './types';

export const ME_KEY = ['me'] as const;

/** Zalogowany użytkownik (data = null, gdy nikt nie jest zalogowany). */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: () => endpoints.me(),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RegisterRequest) => endpoints.register(body),
    onSuccess: ({ user }) => queryClient.setQueryData(ME_KEY, user),
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginRequest) => endpoints.login(body),
    onSuccess: ({ user }) => queryClient.setQueryData(ME_KEY, user),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => endpoints.logout(),
    onSuccess: () => queryClient.setQueryData(ME_KEY, null),
  });
}

/** Wysłanie formularza wstępnego. */
export function useSubmitProfile() {
  return useMutation({
    mutationFn: (request: ProfileRequest) => endpoints.submitProfile(request),
  });
}

const MINUTE = 60_000;

/** Parametry rynkowe dla silnika (w produkcji: z bazy danych). */
export function useAssumptions() {
  return useQuery({
    queryKey: ['assumptions'],
    queryFn: () => endpoints.getAssumptions(),
    staleTime: 60 * MINUTE,
  });
}

/** Trzy propozycje dla profilu. Wyłączone, dopóki nie znamy profilu. */
export function useProposals(profileId: string | null, level: number | null) {
  return useQuery({
    queryKey: ['proposals', profileId, level],
    queryFn: () => endpoints.getProposals(profileId as string, level as number),
    enabled: Boolean(profileId) && level !== null,
    staleTime: 10 * MINUTE,
  });
}

/** Symulacja wsteczna portfela o podanych udziałach. */
export function useBacktest(weights: readonly number[] | null) {
  return useQuery({
    queryKey: ['backtest', weights],
    queryFn: () => endpoints.getBacktest(weights as readonly number[]),
    enabled: weights !== null,
    staleTime: 60 * MINUTE,
  });
}

/** Ocena ryzyka wyboru użytkownika (model ML po stronie backendu). */
export function useRiskAssessment(request: RiskAssessmentRequest | null) {
  return useQuery({
    queryKey: ['risk-assessment', request],
    queryFn: () => endpoints.assessRisk(request as RiskAssessmentRequest),
    enabled: request !== null,
    staleTime: 5 * MINUTE,
  });
}

/** Zapisanie wyboru użytkownika w jego panelu (POST /api/choices). */
export function useSaveChoice() {
  return useMutation({
    mutationFn: (body: SaveChoiceRequest) => endpoints.saveChoice(body),
  });
}

/** „Cofnij zapis” (DELETE /api/choices/{id}). */
export function useDeleteChoice() {
  return useMutation({
    mutationFn: (id: string) => endpoints.deleteChoice(id),
  });
}
