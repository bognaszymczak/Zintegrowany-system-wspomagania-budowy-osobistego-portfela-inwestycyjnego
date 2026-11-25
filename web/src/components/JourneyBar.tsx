import { Icon } from './Icon';

/** Pięć etapów ścieżki użytkownika — widoczne na górze każdego ekranu po założeniu konta. */
export const JOURNEY_STAGES = ['Profil', 'Propozycje', 'Wybór', 'Dopasowanie', 'Ocena ryzyka'] as const;

export function JourneyBar({ current }: { current: number }) {
  return (
    <div className="journey-wrap">
      <nav aria-label="Etapy ścieżki">
        <ol className="journey">
          {JOURNEY_STAGES.map((label, index) => {
            const n = index + 1;
            const state = n < current ? 'done' : n === current ? 'now' : 'todo';
            return (
              <li
                key={label}
                className={`journey__step journey__step--${state}`}
                aria-current={state === 'now' ? 'step' : undefined}
              >
                <span className="journey__dot">
                  {state === 'done' ? <Icon name="check" size={14} strokeWidth={3} /> : n}
                </span>
                <span className="journey__label">{label}</span>
                <span className="journey__line" aria-hidden="true" />
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
