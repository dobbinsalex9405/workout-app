import { useEffect, useRef, useState } from 'react';
import type { Muscle } from '../types';
import { useLocal } from '../store';

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
  { m: 'brachioradialis', d: 'M47,156 C42,164 39,178 39,194 C40,199 42,200 44,197 C45,186 48,174 53,164 C52,158 50,155 47,156 Z' },
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
  { m: 'brachioradialis', d: 'M47,156 C42,164 39,178 39,194 C40,199 42,200 44,197 C45,186 48,174 53,164 C52,158 50,155 47,156 Z' },
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

/* ---------- Side view (facing right, arm hanging at mid-depth) ---------- */

const SIDE_SIL = [
  E(102, 33, 17, 23), // head
  'M94,48 L108,48 L109,70 L93,70 Z', // neck
  // torso + leg profile: back on the left, front on the right
  'M94,62 C88,68 82,76 80,90 C78,106 80,124 82,140 C84,154 87,166 85,178 C80,190 74,204 76,220 C78,236 84,250 86,270 C88,292 90,306 90,318 C86,332 84,350 88,368 C90,384 93,396 94,408 C92,414 90,420 92,423 L126,423 C126,418 120,414 110,410 C104,406 102,400 102,392 C104,370 106,350 106,334 C108,326 110,320 110,316 C114,300 118,276 118,252 C118,232 116,218 114,208 C116,196 118,184 116,172 C116,158 118,146 120,134 C124,122 126,108 122,96 C118,84 112,74 108,66 L108,62 Z',
];
const SIDE_ARM = 'M88,80 C84,92 86,108 88,124 C89,142 90,156 91,166 C91,184 93,200 95,214 C93,228 95,244 101,250 C107,250 107,236 105,214 C105,198 105,182 104,166 C104,150 106,132 107,118 C109,100 108,86 102,78 C98,76 92,76 88,80 Z';

/** Muscles behind/beside the arm, drawn before it. */
const SIDE_BODY: Shape[] = [
  { m: 'traps', d: 'M94,62 C89,66 84,72 82,82 L90,80 C92,74 94,68 94,62 Z' },
  { m: 'upperBack', d: 'M81,86 C79,92 80,98 81,102 L89,104 L88,84 Z' },
  { m: 'lats', d: 'M81,104 C80,118 82,134 85,146 L90,146 L89,105 Z' },
  { m: 'lowerBack', d: 'M85,148 C87,158 87,168 85,180 L91,180 L90,148 Z' },
  { m: 'chest', d: 'M106,86 C114,88 124,96 125,108 C123,118 116,122 107,120 C108,108 108,96 106,86 Z' },
  { m: 'obliques', d: 'M107,122 C110,124 112,126 113,128 L112,196 C108,192 105,184 105,172 C105,156 106,138 107,122 Z' },
  { m: 'abs', d: 'M113,126 C117,130 120,136 119,148 C117,162 116,178 114,198 L112,196 Z' },
  { m: 'glutes', d: 'M85,186 C77,196 75,212 79,226 C85,232 92,230 96,222 C96,208 94,194 90,186 Z' },
  { m: 'abductors', d: 'M92,184 C99,186 107,191 111,199 C111,207 107,214 101,218 C99,206 97,194 92,184 Z' },
  { m: 'hamstrings', d: 'M81,234 C85,250 88,270 89,292 C90,302 90,310 89,314 C94,306 96,290 96,272 C96,254 94,240 91,232 Z' },
  { m: 'quads', d: 'M104,222 C112,228 118,246 117,268 C116,288 112,304 108,312 C104,306 101,290 101,270 C101,254 102,236 104,222 Z' },
  { m: 'calves', d: 'M88,334 C84,348 85,364 90,378 C94,380 98,372 99,360 C100,348 98,338 94,332 Z' },
];

/** Muscles on the arm, drawn after it. */
const SIDE_ARM_MUSCLES: Shape[] = [
  { m: 'rearDelts', d: 'M90,80 C86,86 85,96 88,106 C90,107 92,108 93,108 L93,79 Z' },
  { m: 'sideDelts', d: 'M93,78 L99,78 L100,109 C97,110 95,109 93,108 Z' },
  { m: 'frontDelts', d: 'M99,78 C104,80 107,88 106,98 C105,103 103,107 100,109 Z' },
  { m: 'triceps', d: 'M88,112 C86,126 88,142 91,158 C93,160 95,158 95,154 L94,112 C92,109 90,109 88,112 Z' },
  { m: 'biceps', d: 'M96,112 L97,154 C99,158 103,156 104,150 C106,136 106,122 104,113 C102,109 98,109 96,112 Z' },
  { m: 'forearms', d: 'M92,170 C92,186 94,200 96,212 C99,214 103,213 104,210 C104,194 104,180 103,168 C100,164 94,164 92,170 Z' },
  { m: 'brachioradialis', d: 'M99,158 C103,162 105,172 104,186 C103,194 102,198 100,198 C99,188 98,176 96,166 C96,161 97,158 99,158 Z' },
];

const SIDE_LINES = 'M104,318 C108,314 110,312 110,316';

type Paint = {
  values: Partial<Record<Muscle, number>>;
  selected: Muscle | null;
  onSelect: (m: Muscle) => void;
  color: (m: Muscle, v: number) => string;
};

function MusclePath({ s, p }: { s: Shape; p: Paint }) {
  const m = s.m!;
  return (
    <path d={s.d} className={`mz ${m === p.selected ? 'sel' : ''}`} fill={p.color(m, p.values[m] ?? 0)} onClick={() => p.onSelect(m)}>
      <title>{m}</title>
    </path>
  );
}

const MIRROR = 'translate(200 0) scale(-1 1)';

/** Front or back: left half drawn, right half mirrored. */
function SymFigure({ shapes, lines, p }: { shapes: Shape[]; lines: string; p: Paint }) {
  return (
    <g>
      {SIL_CENTER.map((d, i) => (
        <path key={`c${i}`} d={d} className="mz-body" />
      ))}
      {SIL_HALF.map((d, i) => (
        <path key={`l${i}`} d={d} className="mz-body" />
      ))}
      <g transform={MIRROR}>
        {SIL_HALF.map((d, i) => (
          <path key={`r${i}`} d={d} className="mz-body" />
        ))}
      </g>
      {shapes.map((s, i) => (
        <MusclePath key={i} s={s} p={p} />
      ))}
      <g transform={MIRROR}>
        {shapes
          .filter((s) => !s.center)
          .map((s, i) => (
            <MusclePath key={i} s={s} p={p} />
          ))}
      </g>
      <path d={lines} className="ab-lines" />
    </g>
  );
}

function SideFigure({ p }: { p: Paint }) {
  // Profile is drawn narrow; widen it to real chest/hip depth (~1/7 of height).
  return (
    <g transform="translate(100 0) scale(1.4 1) translate(-100 0)" className="side-fig">
      {SIDE_SIL.map((d, i) => (
        <path key={i} d={d} className="mz-body" />
      ))}
      {SIDE_BODY.map((s, i) => (
        <MusclePath key={i} s={s} p={p} />
      ))}
      <path d={SIDE_ARM} className="mz-body" />
      {SIDE_ARM_MUSCLES.map((s, i) => (
        <MusclePath key={i} s={s} p={p} />
      ))}
      <path d={SIDE_LINES} className="ab-lines" />
    </g>
  );
}

export type BodyView = 'front' | 'side' | 'back';
const VIEWS: BodyView[] = ['front', 'side', 'back'];
const FLIP_MS = 170;

/**
 * Muscle map showing one figure at a time: front, side, or back. Switching turns the figure
 * around its vertical axis (CSS only, no 3D library). Swipe sideways or tap the pills.
 * `values` are 0..1 heat by default; pass `color` to paint muscles some other way
 * (the exercise editor uses it for primary/secondary).
 */
export function BodyMap({
  values,
  selected,
  onSelect,
  color = (_m, v) => heat(v),
  storeKey = 'body.view',
}: {
  values: Partial<Record<Muscle, number>>;
  selected: Muscle | null;
  onSelect: (m: Muscle) => void;
  color?: (m: Muscle, v: number) => string;
  /** Where the chosen view is remembered, so it survives reloads. */
  storeKey?: string;
}) {
  const [view, setView] = useLocal<BodyView>(storeKey, 'front');
  const [shown, setShown] = useState<BodyView>(view);
  const [phase, setPhase] = useState<'' | 'out-l' | 'out-r' | 'in-l' | 'in-r'>('');
  const timers = useRef<number[]>([]);
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const go = (next: BodyView) => {
    if (next === view) return;
    timers.current.forEach(clearTimeout);
    const fwd = VIEWS.indexOf(next) > VIEWS.indexOf(view);
    setView(next);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(next);
      setPhase('');
      return;
    }
    setPhase(fwd ? 'out-l' : 'out-r');
    timers.current = [
      window.setTimeout(() => {
        setShown(next);
        setPhase(fwd ? 'in-l' : 'in-r');
      }, FLIP_MS),
      window.setTimeout(() => setPhase(''), FLIP_MS * 2 + 60),
    ];
  };
  const step = (d: number) => go(VIEWS[Math.min(VIEWS.length - 1, Math.max(0, VIEWS.indexOf(view) + d))]);

  const p: Paint = { values, selected, onSelect, color };
  return (
    <div className="body-viewer">
      <div
        className="flip-stage"
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const t = touch.current;
          touch.current = null;
          if (!t) return;
          const dx = e.changedTouches[0].clientX - t.x;
          const dy = e.changedTouches[0].clientY - t.y;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
        }}
      >
        <svg className={`body-map single ${phase}`} viewBox="0 0 200 432" role="img" aria-label={`Muscle map, ${shown} view`}>
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {shown === 'front' && <SymFigure shapes={FRONT} lines={FRONT_LINES} p={p} />}
          {shown === 'back' && <SymFigure shapes={BACK} lines={BACK_LINES} p={p} />}
          {shown === 'side' && <SideFigure p={p} />}
        </svg>
        <div className="flip-floor" />
      </div>
      <div className="view-pills" role="tablist" aria-label="Body view">
        {VIEWS.map((v) => (
          <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => go(v)}>
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
