import { Icon } from '@/components/Icon';
import type { LimitCheck } from '@/domain/portfolio/engine';

/**
 * Lista czterech sprawdzeń granic profilu (udział akcji, największa pozycja, najgorszy rok, wahania).
 * Zielony znacznik = mieści się, bursztynowy wykrzyknik = przekroczone (to ostrzeżenie, nie blokada).
 */
export function LimitList({ check }: { check: LimitCheck }) {
  return (
    <ul className="limits">
      {check.items.map((item) => (
        <li key={item.kind} data-ok={item.ok ? 'true' : 'false'}>
          <Icon name={item.ok ? 'check' : 'alert'} size={18} strokeWidth={item.ok ? 2.6 : 2} />
          <span>
            {item.message}
            <span className="visually-hidden">{item.ok ? ' — mieści się w limicie' : ' — przekroczony limit'}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
