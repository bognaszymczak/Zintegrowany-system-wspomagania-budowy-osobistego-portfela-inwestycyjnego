interface RiskScaleProps {
  /** poziom ryzyka na skali 1–7 */
  level: number;
  /** słowny opis poziomu, np. „umiarkowane” — trafia do opisu dla czytników ekranu */
  word: string;
  /** podpis nad skalą; domyślnie „Poziom ryzyka” */
  label?: string;
  /** ukrywa podpis i liczbę (gdy skala stoi obok własnego opisu) */
  bare?: boolean;
}

/** Siedmiostopniowa skala ryzyka: wypełnione segmenty do bieżącego poziomu. */
export function RiskScale({ level, word, label = 'Poziom ryzyka', bare = false }: RiskScaleProps) {
  return (
    <div className="riskscale">
      {bare ? null : (
        <div className="riskscale__head">
          <span>{label}</span>
          <b>{level} z 7</b>
        </div>
      )}
      <div className="riskscale__bar" role="img" aria-label={`${label}: ${level} z 7, ${word}`}>
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <span key={n} data-on={n <= level ? 'true' : 'false'} data-now={n === level ? 'true' : undefined} />
        ))}
      </div>
    </div>
  );
}
