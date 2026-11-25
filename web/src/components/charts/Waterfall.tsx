import type { WaterfallStep } from '@/domain/portfolio/assessment';
import { dec, signedPp } from '@/domain/portfolio/format';

/**
 * „Wodospad”: od szansy dużej straty w propozycji (góra) do szansy w wersji użytkownika (dół).
 * Każdy pośredni krok to przesunięcie pieniędzy między grupami i jego wpływ w punktach procentowych.
 * Bursztynowy pasek = ryzyko rośnie, zielonkawy = maleje.
 */
export function Waterfall({ steps }: { steps: readonly WaterfallStep[] }) {
  const top = Math.max(...steps.map((s) => s.value), 0.1) * 1.18;
  const pct = (v: number) => `${((v / top) * 100).toFixed(2)}%`;

  return (
    <ol className="waterfall">
      {steps.map((step, index) => {
        const previous = index > 0 ? steps[index - 1]!.value : step.value;
        const from = step.kind === 'step' ? Math.min(previous, step.value) : 0;
        const to = step.kind === 'step' ? Math.max(previous, step.value) : step.value;
        const up = (step.delta ?? 0) > 0;
        return (
          <li className={`waterfall__row waterfall__row--${step.kind}`} key={`${step.kind}-${index}`}>
            <span className="waterfall__label">{step.label}</span>
            <span className="waterfall__track" aria-hidden="true">
              <span
                className={`waterfall__bar${step.kind === 'step' ? (up ? ' waterfall__bar--up' : ' waterfall__bar--down') : ''}`}
                style={{ left: pct(from), width: pct(Math.max(to - from, top * 0.012)) }}
              />
            </span>
            <span className="waterfall__value">
              {step.kind === 'step' ? signedPp(step.delta ?? 0) : `${dec(step.value, 1)}%`}
              <span className="visually-hidden">
                {step.kind === 'step' ? ` punktu procentowego, razem ${dec(step.value, 1)}%` : ''}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
