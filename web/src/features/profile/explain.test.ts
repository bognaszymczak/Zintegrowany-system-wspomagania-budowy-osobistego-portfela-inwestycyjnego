import { describe, expect, it } from 'vitest';
import { computeProfile } from '@/domain/profile';
import { toProfileRequest } from '@/features/onboarding/request';
import { DEMO_VALUES } from '@/features/onboarding/schema';
import { lowestScoreNote, manualChangeNote, profileSummary, scoreCards } from './explain';

const request = toProfileRequest(DEMO_VALUES);
const scoring = computeProfile(request);

describe('teksty ekranu profilu', () => {
  it('zdanie podsumowujące składa się z odpowiedzi', () => {
    const text = profileSummary({ ...request, horizon: '5do10', cushion: 'tak', acceptableDropPct: 20 }, 'umiarkowanych');
    expect(text).toBe(
      'Z Twoich odpowiedzi wynika: horyzont 5–10 lat, poduszka finansowa jest, a chwilowy spadek wartości o ok. 20% byłby do zaakceptowania. ' +
        'Dlatego propozycje będą mieściły się w umiarkowanych granicach ryzyka. To punkt wyjścia, nie ocena — możesz go zmienić.',
    );
  });

  it('brak poduszki jest nazwany wprost', () => {
    expect(profileSummary({ ...request, cushion: 'nie' }, 'ostrożnych')).toContain('poduszki finansowej na razie nie ma');
    expect(profileSummary({ ...request, cushion: 'czesciowo' }, 'ostrożnych')).toContain('tylko częściowa');
  });

  it('trzy karty z wynikami i wyjaśnieniami', () => {
    const cards = scoreCards(request, scoring.scores, false);
    expect(cards.map((c) => c.key)).toEqual(['capacity', 'tolerance', 'horizon']);
    expect(cards.map((c) => c.score)).toEqual([scoring.scores.capacity, scoring.scores.tolerance, scoring.scores.horizon]);
    expect(cards[2]?.text).toBe('5–10 lat: jest czas, by przeczekać wahania, ale nie na każdy spadek.');
    expect(cards[1]?.text).toContain(`−${request.acceptableDropPct}%`);
  });

  it('informuje o obniżeniu tolerancji przez zachowanie', () => {
    const cards = scoreCards(request, scoring.scores, true);
    expect(cards[1]?.text.endsWith('bo przy dużym spadku sprzedałbyś(abyś) wszystko.')).toBe(true);
  });

  it('wyjaśnia, że profil to najniższy wynik', () => {
    const note = lowestScoreNote({ capacity: 3, tolerance: 4, horizon: 4 }, 3, false);
    expect(note.startsWith('Profil to najniższy z trzech wyników (3, 4 i 4), czyli 3.')).toBe(true);
    expect(lowestScoreNote({ capacity: 3, tolerance: 4, horizon: 4 }, 1, true)).toContain('„poduszka bezpieczeństwa” ogranicza profil do poziomu 1');
  });

  it('notatka o ręcznej zmianie', () => {
    expect(manualChangeNote('Zrównoważony', 3)).toBe('Profil zmieniony ręcznie. Wynik z formularza: Zrównoważony (3 z 5).');
  });
});
