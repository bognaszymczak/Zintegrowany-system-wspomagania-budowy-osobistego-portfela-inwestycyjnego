/**
 * Ikony rysowane jako pojedyncze ścieżki SVG (styl: obrys 1.8–2.2 px, zaokrąglone końce).
 * Nowa ikona = jeden wpis w tabeli PATHS. Bez zewnętrznej biblioteki ikon.
 */
const PATHS = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  info: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM12 11v5.2M12 7.8v.4',
  alert: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM12 7.5v5.2M12 16.2v.4',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  pulse: 'M3.5 12h3l2.5-6 4 12 2.5-6h5',
  trendDown: 'M3.5 6l6 6 4-4 7 7M20.5 9.5V15.5h-6',
  pie: 'M12 3.5a8.5 8.5 0 108.5 8.5H12zM14.5 3.7a8.5 8.5 0 015.8 5.8h-5.8z',
  bars: 'M5 20V10M12 20V4M19 20v-6',
  trendUp: 'M3.5 17l6-6 4 4 7-7M20.5 14.5V8.5h-6',
  shieldCheck: 'M12 3l7.5 3v5.5c0 4.6-3.1 8.2-7.5 9.5-4.4-1.3-7.5-4.9-7.5-9.5V6L12 3zM8.7 12.2l2.3 2.3 4.4-4.6',
  target: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9zM12 11.2a.8.8 0 100 1.6.8.8 0 000-1.6z',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5',
  lock: 'M6.5 10.5h11V20h-11zM8.5 10.5V8a3.5 3.5 0 017 0v2.5',
  print: 'M7 9V4h10v5M7 17H5a1.5 1.5 0 01-1.5-1.5v-4A1.5 1.5 0 015 10h14a1.5 1.5 0 011.5 1.5v4A1.5 1.5 0 0119 17h-2M7 14h10v6H7z',
  undo: 'M9 7L4.5 11.5 9 16M5 11.5h9.5a5 5 0 010 10H12',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20a7.5 7.5 0 0115 0',
  plus: 'M12 5v14M5 12h14',
  x: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  minus: 'M5 12h14',
  book: 'M4.5 5.5A1.5 1.5 0 016 4h12.5v14.5H6a1.5 1.5 0 00-1.5 1.5V5.5zM4.5 20A1.5 1.5 0 006 21.5h12.5',
  // ikony celów z formularza
  'goal-poduszka': 'M12 3l7.5 3v5.5c0 4.6-3.1 8.2-7.5 9.5-4.4-1.3-7.5-4.9-7.5-9.5V6L12 3z',
  'goal-mieszkanie': 'M3.5 11.2L12 4l8.5 7.2M6 9.8V20h12V9.8M10 20v-5.5h4V20',
  'goal-emerytura': 'M3 18.5h18M6.5 18.5a5.5 5.5 0 0111 0M12 6v3M4.9 10.9l1.8 1.5M19.1 10.9l-1.8 1.5',
  'goal-edukacja':
    'M2.5 9.5L12 5l9.5 4.5L12 14 2.5 9.5zM6.5 11.8v4.2c0 1.2 2.5 2.5 5.5 2.5s5.5-1.3 5.5-2.5v-4.2M21.5 9.5v5',
  'goal-majatek': 'M12 20v-8M12 12c0-3 2-5 5.5-5 0 3.2-2 5-5.5 5zM12 14c0-2.5-1.8-4.2-5-4.2 0 2.7 1.8 4.2 5 4.2z',
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function Icon({ name, size = 20, strokeWidth = 2, className }: IconProps) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
