import { ApiError } from '@/api/client';
import type { SaveChoiceRequest, SavedChoice } from '@/api/types';
import { isValidWeights } from '@/domain/portfolio/engine';
import { findProposal } from '@/domain/portfolio/proposals';
import type { MockRoute } from '../router';
import { recallProfile } from '../profileStore';
import { readJson, writeJson } from '../store';

/**
 * Mock zapisu wyboru („Zapisz ten wybór” na ekranie oceny).
 * Prawdziwy backend zapisuje to w tabeli `choices` (api/app/db/models.py) i zwraca ten sam kształt.
 */
const KEY = 'horyzont.mock.choices';

const stored = () => readJson<SavedChoice[]>('local', KEY, []);

export function saveChoice(body: unknown, now: Date = new Date()): SavedChoice {
  const b = (body ?? {}) as Partial<SaveChoiceRequest>;
  const profile = typeof b.profileId === 'string' ? recallProfile(b.profileId) : null;
  if (!profile) {
    throw new ApiError(404, 'profile_not_found', 'Nie znaleziono profilu. Wypełnij formularz jeszcze raz.');
  }
  const proposal = typeof b.proposalId === 'string' ? findProposal(b.proposalId) : null;
  const bad: string[] = [];
  if (!proposal || Math.abs(proposal.level - profile.level) > 1 || proposal.level !== b.level) bad.push('proposalId');
  if (!Array.isArray(b.weights) || !isValidWeights(b.weights)) bad.push('weights');
  if (bad.length > 0 || !proposal || !Array.isArray(b.weights)) {
    throw new ApiError(422, 'validation_error', 'Wysłane dane są niepoprawne.', bad);
  }

  const choice: SavedChoice = {
    id: `choice-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    profileId: b.profileId as string,
    level: proposal.level,
    proposalId: proposal.id,
    weights: b.weights,
    savedAt: now.toISOString(),
  };
  writeJson('local', KEY, [...stored(), choice]);
  return choice;
}

export function deleteChoice(id: unknown): void {
  const all = stored();
  if (typeof id !== 'string' || !all.some((c) => c.id === id)) {
    throw new ApiError(404, 'not_found', 'Nie znaleziono zapisanego wyboru.');
  }
  writeJson(
    'local',
    KEY,
    all.filter((c) => c.id !== id),
  );
}

export const choiceRoutes: MockRoute[] = [
  { method: 'POST', path: '/choices', latencyMs: 400, handler: ({ body }) => saveChoice(body) },
  { method: 'DELETE', path: '/choices/:id', latencyMs: 250, handler: ({ params }) => deleteChoice(params?.id) },
];
