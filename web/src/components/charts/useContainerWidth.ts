import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Mierzy szerokość kontenera i śledzi jej zmiany. Wykresy SVG rysujemy w prawdziwych pikselach
 * (a nie skalowanym viewBox-em), dzięki czemu napisy na telefonie mają tę samą wielkość co na komputerze.
 * Bez ResizeObserver (np. w testach) zostaje szerokość domyślna.
 */
export function useContainerWidth<T extends HTMLElement>(fallback = 720) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const next = Math.round(element.getBoundingClientRect().width);
      if (next > 0) setWidth(Math.max(260, next));
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}
