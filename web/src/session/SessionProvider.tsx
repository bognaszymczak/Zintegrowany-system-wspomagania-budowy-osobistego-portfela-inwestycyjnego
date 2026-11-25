/**
 * Stan „podróży” użytkownika przez kolejne ekrany: odpowiedzi z formularza, profil,
 * wybrany portfel i udziały po edycji suwakami.
 *
 * Trzymamy go w sessionStorage, więc odświeżenie strony nie kasuje wyników,
 * a zamknięcie karty — tak (dane nie zostają w przeglądarce na zawsze).
 * Gdy dojdzie logowanie z zapisem w bazie, wystarczy podmienić `readStored`/`writeStored`
 * na zapytania do API — reszta aplikacji korzysta wyłącznie z hooka useSession().
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ProfileRequest, ProfileResponse } from '@/api/types';
import { applyLevelShift } from '@/domain/profile';
import { profileByLevel, type RiskLevel, type RiskProfile } from '@/domain/profiles';
import type { FormValues } from '@/features/onboarding/schema';

export type LevelShift = -1 | 0 | 1;

export interface SessionState {
  /** surowe odpowiedzi z formularza (do ponownej edycji) */
  answers: FormValues | null;
  /** odpowiedzi w kształcie kontraktu API */
  request: ProfileRequest | null;
  profile: ProfileResponse | null;
  /** ręczna korekta profilu na ekranie 4 */
  levelShift: LevelShift;
  /** id wybranej propozycji portfela */
  proposalId: string | null;
  /** udziały po edycji (w %, 7 instrumentów, suma 100) */
  weights: number[] | null;
}

const EMPTY: SessionState = {
  answers: null,
  request: null,
  profile: null,
  levelShift: 0,
  proposalId: null,
  weights: null,
};

const STORAGE_KEY = 'horyzont.session.v1';

function readStored(): SessionState {
  try {
    const text = sessionStorage.getItem(STORAGE_KEY);
    if (!text) return EMPTY;
    const parsed = JSON.parse(text) as Partial<SessionState> | null;
    // minimalna kontrola kształtu — uszkodzony zapis ignorujemy
    if (!parsed || typeof parsed !== 'object' || !parsed.profile?.profileId) return EMPTY;
    return { ...EMPTY, ...parsed };
  } catch {
    return EMPTY;
  }
}

function writeStored(state: SessionState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* tryb prywatny / brak miejsca — aplikacja działa dalej, tylko bez zapisu */
  }
}

export interface SessionContextValue extends SessionState {
  /** poziom profilu po uwzględnieniu ręcznej korekty */
  level: RiskLevel | null;
  /** granice ryzyka dla `level` */
  riskProfile: RiskProfile | null;
  saveOnboarding: (input: { answers: FormValues; request: ProfileRequest; profile: ProfileResponse }) => void;
  setLevelShift: (shift: LevelShift) => void;
  chooseProposal: (proposalId: string, weights: number[]) => void;
  setWeights: (weights: number[]) => void;
  reset: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(readStored);

  useEffect(() => {
    writeStored(state);
  }, [state]);

  const saveOnboarding = useCallback<SessionContextValue['saveOnboarding']>(
    ({ answers, request, profile }) =>
      // nowy profil unieważnia wszystko, co użytkownik wybrał wcześniej
      setState({ ...EMPTY, answers, request, profile }),
    [],
  );
  const setLevelShift = useCallback((levelShift: LevelShift) => {
    setState((s) => ({ ...s, levelShift, proposalId: null, weights: null }));
  }, []);
  const chooseProposal = useCallback((proposalId: string, weights: number[]) => {
    setState((s) => ({ ...s, proposalId, weights }));
  }, []);
  const setWeights = useCallback((weights: number[]) => {
    setState((s) => ({ ...s, weights }));
  }, []);
  const reset = useCallback(() => setState(EMPTY), []);

  const value = useMemo<SessionContextValue>(() => {
    const level = state.profile ? applyLevelShift(state.profile.level, state.levelShift) : null;
    return {
      ...state,
      level,
      riskProfile: level ? profileByLevel(level) : null,
      saveOnboarding,
      setLevelShift,
      chooseProposal,
      setWeights,
      reset,
    };
  }, [state, saveOnboarding, setLevelShift, chooseProposal, setWeights, reset]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession musi być użyty wewnątrz <SessionProvider>.');
  return ctx;
}
