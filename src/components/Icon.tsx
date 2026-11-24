const PATHS: Record<string, string> = {
  workout: 'M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11',
  plans: 'M9 3.5h6v3H9zM8 5H5.5v15.5h13V5H16M8.5 11h7M8.5 14.5h7M8.5 18h4',
  progress: 'M3.5 20.5h17M5.5 16l4-5 3.5 3 5.5-7.5M15 6.5h3.5V10',
  body: 'M12 2.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4zM6 9.5l6-1 6 1M9 9l.5 6-1 6.5M15 9l-.5 6 1 6.5M10 15h4',
  history: 'M4 5.5h16v15H4zM4 10h16M8.5 3v5M15.5 3v5M8 14h2M12 14h2M16 14h0M8 17.5h2M12 17.5h2',
  settings:
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8',
  back: 'M15 5l-7 7 7 7',
  chevron: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  play: 'M8 5.5v13l10.5-6.5z',
  flame: 'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5.5.8 1.5 1.5 2 2.5 2.5C11 8 11 5.5 12 3z',
  alert: 'M12 4l9 16H3zM12 10v4.5M12 17.5v.1',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5c0 3 1.5 4.5 3.7 4.8M16 6h3.5c0 3-1.5 4.5-3.7 4.8M12 13v4M8.5 20.5h7M9.5 17h5',
  repeat: 'M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15M4 20v-5h5',
  trash: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  info: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 11v5.5M12 7.8v.1',
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5L20 20',
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z',
  book:'M4.5 5.5A2 2 0 0 1 6.5 3.5H19v14H6.5a2 2 0 0 0-2 2zM4.5 19.5a2 2 0 0 0 2 2H19',
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, className, filled }: { name: IconName; size?: number; className?: string; filled?: boolean }) {
  return (
    <svg className={`icon-svg ${className ?? ''}`} width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
