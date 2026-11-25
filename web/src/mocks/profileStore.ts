/**
 * Mock „bazy profili”: zapamiętuje profile utworzone przez POST /profile, żeby kolejne zapytania
 * (propozycje, ocena ryzyka) znały plan użytkownika. Prawdziwy backend robi to w bazie danych.
 */
import type { ProfileResponse } from '@/api/types';
import type { Plan } from '@/domain/plan';
import type { RiskLevel } from '@/domain/profiles';
import { readJson, writeJson } from './store';

const KEY = 'horyzont.mock.profiles';

/** Plan awaryjny, gdy pamięć przeglądarki została wyczyszczona, a identyfikator jeszcze „żyje”. */
export const FALLBACK_PLAN: Plan = { startPLN: 12_500, monthlyPLN: 650, years: 7, targetPLN: 100_000 };

export interface StoredProfile {
  level: RiskLevel;
  plan: Plan;
}

export function rememberProfile(profile: ProfileResponse): void {
  const all = readJson<Record<string, StoredProfile>>('session', KEY, {});
  all[profile.profileId] = { level: profile.level, plan: profile.plan };
  writeJson('session', KEY, all);
}

export function recallProfile(profileId: string): StoredProfile | null {
  const stored = readJson<Record<string, StoredProfile>>('session', KEY, {})[profileId];
  if (stored) return stored;
  // „mock-L3-…”: poziom jest zaszyty w identyfikatorze
  const match = /^mock-L([1-5])-/.exec(profileId);
  return match ? { level: Number(match[1]) as RiskLevel, plan: FALLBACK_PLAN } : null;
}
