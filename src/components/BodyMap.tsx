import type { Muscle } from '../types';

/**
 * Stylized front/back anatomy on an 8-head grid (head = 52 units):
 * chin 58, nipples ~110, navel ~162, crotch ~218, knee ~318, sole ~422.
 * A solid silhouette sits underneath so muscles read as one body rather than floating pieces.
 * Shapes are drawn for the figure's left half (x <= 100) and mirrored, so both sides match.
 */
type Shape = { m?: Muscle; d: string; center?: boolean };

const E = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0 Z`;

/** Silhouette: left half of torso + leg, and left arm. Head and neck are centered. */
const SIL_CENTER = [E(100, 33, 16, 22), 'M93,48 L107,48 C107,56 109,62 112,68 L88,68 C91,62 93,56 93,48 Z'];
const SIL_HALF = [
  // torso + leg
  'M100,62 L90,62 C87,69 78,72 66,75 C64,86 65,98 67,108 C68,126 70,144 72,160 C72,172 68,182 66,192 C62,210 60,236 61,262 C62,286 68,304 72,318 C67,334 66,352 69,366 C72,382 77,396 79,410 C76,414 72,418 74,422 L96,422 C97,416 95,410 93,404 C95,388 97,370 96,352 C95,338 93,328 94,320 C96,296 98,262 99,232 L100,220 Z',
  // arm: deltoid cap, upper arm, forearm, hand
  'M68,74 C55,73 46,80 44,94 C42,108 42,128 42,146 C41,156 40,164 39,172 C37,186 36,200 38,214 C35,224 34,238 38,248 C42,254 48,252 50,244 C51,236 50,224 49,214 C52,200 55,186 56,172 C57,164 58,156 59,148 C61,132 63,116 65,104 Z',
];

const FRONT: Shape[] = [
  { m: 'traps', d: 'M90,63 C87,68 80,71 70,74 L84,77 C88,74 90,69 90,63 Z' },
  { m: 'chest', d: 'M99,80 C92,77 84,76 76,78 C70,81 67,88 67,96 C67,106 72,114 82,117 C90,119 96,117 99,112 Z' },
  { m: 'frontDelts', d: 'M68,77 C61,78 57,84 56,93 C57,100 60,106 64,108 C66,100 67,90 68,77 Z' },
  { m: 'sideDelts', d: 'M65,75 C54,75 47,83 46,96 C46,103 49,108 53,110 C53,98 57,85 65,75 Z' },
  { m: 'biceps', d: 'M48,114 C45,124 44,138 46,152 C49,159 55,159 58,152 C60,140 62,126 62,114 C58,108 52,108 48,114 Z' },
  { m: 'forearms', d: 'M44,166 C40,178 38,194 39,210 C42,214 47,213 49,209 C51,196 54,182 56,170 C53,163 47,162 44,166 Z' },
  { m: 'abs', d: 'M89,121 C95,119 105,119 111,121 L112,170 C112,184 107,198 100,204 C93,198 88,184 88,170 Z', center: true },
  { m: 'obliques', d: 'M84,121 C78,124 73,132 72,146 C72,162 74,176 80,188 C83,192 86,193 87,190 L86,122 Z' },
  { m: 'abductors', d: 'M67,192 C63,200 62,212 63,224 C66,219 69,210 71,200 C71,196 69,192 67,192 Z' }, // TFL
  { m: 'quads', d: 'M70,214 C64,232 63,258 66,282 C68,296 74,306 82,308 C89,308 93,300 94,288 C96,266 95,244 92,226 C86,218 78,212 70,214 Z' },
  { m: 'adductors', d: 'M93,224 C96,240 97,256 96,272 C98,262 99,246 99,226 C97,222 95,222 93,224 Z' },
  { m: 'calves', d: 'M72,328 C68,342 68,360 71,374 C74,382 80,382 83,374 C86,360 86,344 84,332 C80,324 75,324 72,328 Z' },
  { m: 'calves', d: 'M90,330 C94,340 95,356 93,370 C91,376 88,374 87,368 C86,354 87,340 90,330 Z' },
];

/** Decorative lines (not tappable): six-pack and kneecaps on the front. */
const FRONT_LINES = 'M100,122 L100,198 M90,138 L110,138 M89,155 L111,155 M89,172 L111,172 M76,322 C80,316 88,316 92,322 M108,322 C112,316 120,316 124,322';

const BACK: Shape[] = [
  { m: 'traps', d: 'M100,54 L92,62 C86,69 78,73 70,76 L82,82 C88,90 94,104 100,122 C106,104 112,90 118,82 L130,76 C122,73 114,69 108,62 Z', center: true },
  { m: 'rearDelts', d: 'M67,77 C60,78 57,85 56,94 C57,101 60,106 64,108 C66,100 67,90 67,77 Z' },
  { m: 'sideDelts', d: 'M65,75 C54,75 47,83 46,96 C46,103 49,108 53,110 C53,98 57,85 65,75 Z' },
  { m: 'upperBack', d: 'M81,84 L70,79 C67,88 67,97 68,104 C76,108 84,112 93,116 L97,111 C93,101 88,92 81,84 Z' },
  { m: 'lats', d: 'M68,108 C68,126 70,146 76,162 C80,170 86,170 92,162 L95,146 L95,120 C86,116 77,112 68,108 Z' },
  { m: 'triceps', d: 'M48,114 C45,124 44,138 46,152 C49,159 55,159 58,152 C60,140 62,126 62,114 C58,108 52,108 48,114 Z' },
  { m: 'forearms', d: 'M44,166 C40,178 38,194 39,210 C42,214 47,213 49,209 C51,196 54,182 56,170 C53,163 47,162 44,166 Z' },
  { m: 'lowerBack', d: 'M96,128 L104,128 C107,148 110,168 112,186 C106,190 94,190 88,186 C90,168 93,148 96,128 Z', center: true },
  { m: 'abductors', d: 'M71,180 C67,185 65,194 66,205 C70,198 78,193 87,190 C84,184 77,179 71,180 Z' }, // glute medius
  { m: 'glutes', d: 'M99,192 C92,190 82,190 74,194 C68,204 67,218 72,228 C78,236 90,236 99,230 Z' },
  { m: 'hamstrings', d: 'M70,238 C66,256 66,278 70,296 C74,306 82,310 88,306 C94,298 95,280 95,260 C95,250 94,242 92,236 C84,234 76,234 70,238 Z' },
  { m: 'calves', d: 'M72,328 C67,340 68,358 74,372 C78,380 86,380 90,372 C94,360 94,342 90,332 C86,324 76,322 72,328 Z' },
];

const BACK_LINES = 'M100,122 L100,130 M76,320 C82,324 88,324 92,320 M108,320 C112,324 118,324 124,320';

export type MapMode = 'fatigue' | 'volume';

/** Electric-blue ramp from near-black to cyan-white. t in 0..1. */
export function heat(t: number) {
  if (t <= 0.001) return '#121c2e';
  const stops = [
    [0, [22, 40, 78]],
    [0.35, [31, 94, 230]],
    [0.7, [53, 200, 255]],
    [1, [225, 246, 255]],
  ] as const;
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < stops.length; i++) {
    const [p1, c1] = stops[i];
    const [p0, c0] = stops[i - 1];
    if (x <= p1) {
      const k = (x - p0) / (p1 - p0);
      const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  return 'rgb(225,246,255)';
}

type FigureProps = {
  shapes: Shape[];
  lines: string;
  values: Partial<Record<Muscle, number>>;
  selected: Muscle | null;
  onSelect: (m: Muscle) => void;
  x: number;
  label: string;
  color: (m: Muscle, v: number) => string;
};

function Figure({ shapes, lines, values, selected, onSelect, x, label, color }: FigureProps) {
  const render = (s: Shape, i: number, mirrored: boolean) => {
    const m = s.m!;
    const v = values[m] ?? 0;
    return (
      <path key={`${i}${mirrored ? 'm' : ''}`} d={s.d} className={`mz ${m === selected ? 'sel' : ''}`} fill={color(m, v)} onClick={() => onSelect(m)}>
        <title>{m}</title>
      </path>
    );
  };
  const mirror = 'translate(200 0) scale(-1 1)';
  return (
    <g transform={`translate(${x} 0)`}>
      {SIL_CENTER.map((d, i) => (
        <path key={`c${i}`} d={d} className="mz-body" />
      ))}
      {SIL_HALF.map((d, i) => (
        <path key={`l${i}`} d={d} className="mz-body" />
      ))}
      <g transform={mirror}>
        {SIL_HALF.map((d, i) => (
          <path key={`r${i}`} d={d} className="mz-body" />
        ))}
      </g>
      {shapes.map((s, i) => render(s, i, false))}
      <g transform={mirror}>{shapes.filter((s) => !s.center).map((s, i) => render(s, i, true))}</g>
      <path d={lines} className="ab-lines" />
      <text x="100" y="442" textAnchor="middle" className="map-label">
        {label}
      </text>
    </g>
  );
}

/**
 * Front/back muscle map. `values` are 0..1 heat by default.
 * Pass `color` to paint muscles some other way (the exercise editor uses it for primary/secondary).
 */
export function BodyMap({
  values,
  selected,
  onSelect,
  color = (_m, v) => heat(v),
}: {
  values: Partial<Record<Muscle, number>>;
  selected: Muscle | null;
  onSelect: (m: Muscle) => void;
  color?: (m: Muscle, v: number) => string;
}) {
  return (
    <svg className="body-map" viewBox="0 0 420 448" role="img" aria-label="Muscle map, front and back">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <Figure shapes={FRONT} lines={FRONT_LINES} values={values} selected={selected} onSelect={onSelect} x={0} label="FRONT" color={color} />
      <Figure shapes={BACK} lines={BACK_LINES} values={values} selected={selected} onSelect={onSelect} x={220} label="BACK" color={color} />
    </svg>
  );
}
