/**
 * Teksty ekranu „Twój profil”, składane z odpowiedzi użytkownika.
 * Osobno od komponentu, żeby dało się je przetestować i łatwo poprawić (np. po uwagach promotora).
 */
import type { ProfileRequest, ProfileScores } from '@/domain/profile';
import type { HorizonValue } from '@/domain/questionnaire';
import type { RiskLevel } from '@/domain/profiles';

const HORIZON_PHRASE: Record<HorizonValue, string> = {
  do3: 'do 3 lat',
  '3do5': '3–5 lat',
  '5do10': '5–10 lat',
  ponad10: 'ponad 10 lat',
};

const HORIZON_EXPLANATION: Record<HorizonValue, string> = {
  do3: 'Do 3 lat: krótki czas, więc ostrożnie z wahaniami.',
  '3do5': '3–5 lat: umiarkowany czas na odrobienie ewentualnych strat.',
  '5do10': '5–10 lat: jest czas, by przeczekać wahania, ale nie na każdy spadek.',
  ponad10: 'Ponad 10 lat: dużo czasu, by przeczekać nawet głębsze spadki.',
};

const CUSHION_PHRASE = {
  tak: 'poduszka finansowa jest',
  czesciowo: 'poduszka finansowa jest tylko częściowa',
  nie: 'poduszki finansowej na razie nie ma',
} as const;

export function profileSummary(request: ProfileRequest, rangeWord: string): string {
  return (
    `Z Twoich odpowiedzi wynika: horyzont ${HORIZON_PHRASE[request.horizon]}, ${CUSHION_PHRASE[request.cushion]}, ` +
    `a chwilowy spadek wartości o ok. ${request.acceptableDropPct}% byłby do zaakceptowania. ` +
    `Dlatego propozycje będą mieściły się w ${rangeWord} granicach ryzyka. To punkt wyjścia, nie ocena — możesz go zmienić.`
  );
}

export interface ScoreCard {
  key: 'capacity' | 'tolerance' | 'horizon';
  title: string;
  score: number;
  text: string;
}

export function scoreCards(
  request: ProfileRequest,
  scores: ProfileScores,
  behaviorCapApplied: boolean,
): ScoreCard[] {
  return [
    {
      key: 'capacity',
      title: 'Zdolność do poniesienia straty',
      score: scores.capacity,
      text: 'Wynika z poduszki finansowej, stabilności dochodu i rat kredytów.',
    },
    {
      key: 'tolerance',
      title: 'Tolerancja ryzyka',
      score: scores.tolerance,
      text:
        `Wynika z akceptowanego spadku (−${request.acceptableDropPct}%), reakcji na spadki i wyborów A/B.` +
        (behaviorCapApplied ? ' Obniżyliśmy ją, bo przy dużym spadku sprzedałbyś(abyś) wszystko.' : ''),
    },
    {
      key: 'horizon',
      title: 'Horyzont inwestowania',
      score: scores.horizon,
      text: HORIZON_EXPLANATION[request.horizon],
    },
  ];
}

/** Zdanie pod wynikami: skąd wziął się ostateczny poziom. */
export function lowestScoreNote(scores: ProfileScores, formLevel: RiskLevel, goalCapApplied: boolean): string {
  const base =
    `Profil to najniższy z trzech wyników (${scores.capacity}, ${scores.tolerance} i ${scores.horizon}), czyli ` +
    `${Math.min(scores.capacity, scores.tolerance, scores.horizon)}. Gdy odpowiedzi się rozchodzą, wybieramy ostrożniejszy wynik — ` +
    'wolimy, żeby propozycje były raczej za spokojne niż za odważne.';
  return goalCapApplied
    ? `${base} Cel „poduszka bezpieczeństwa” ogranicza profil do poziomu ${formLevel}, bo te pieniądze mają być dostępne od razu.`
    : base;
}

export function manualChangeNote(formProfileName: string, formLevel: RiskLevel): string {
  return `Profil zmieniony ręcznie. Wynik z formularza: ${formProfileName} (${formLevel} z 5).`;
}
