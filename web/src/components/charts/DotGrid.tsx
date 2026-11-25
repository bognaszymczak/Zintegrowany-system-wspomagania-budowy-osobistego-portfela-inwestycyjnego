interface DotGridProps {
  /** ile ze 100 kropek jest zaznaczonych */
  count: number;
  total?: number;
  /** opis słowny dla czytników ekranu */
  label: string;
}

/**
 * „N na 100”: sto kropek, z których `count` jest zaznaczonych. Ludzie lepiej rozumieją
 * „5 na 100” niż „5%”, bo widzą, że to realna, policzalna liczba przypadków.
 */
export function DotGrid({ count, total = 100, label }: DotGridProps) {
  const filled = Math.max(0, Math.min(total, Math.round(count)));
  return (
    <div className="dotgrid" role="img" aria-label={label}>
      {Array.from({ length: total }, (_, index) => (
        <span key={index} data-on={index < filled ? 'true' : 'false'} />
      ))}
    </div>
  );
}
