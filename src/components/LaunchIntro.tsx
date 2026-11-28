import { useEffect, useRef } from 'react';

/**
 * Launch animation: a clean, flat anvil fades in, a dumbbell drops onto it from above,
 * bounces twice (each lower than the last), and settles. A light streak runs across the
 * anvil face on impact, then "MyoForge" lights up and it fades into the app.
 * ~2.3s, tap to skip, a short fade only with Reduce Motion.
 *
 * Everything is driven from one requestAnimationFrame loop that writes SVG attributes
 * directly (no React re-renders), so it stays smooth on older phones.
 */

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (t: number) => 1 - (1 - t) ** 3;
/** Progress of `now` through the window [from, to], 0..1. */
const span = (now: number, from: number, to: number) => clamp01((now - from) / (to - from));

/** The anvil's striking face (top) is at y = FACE; the dumbbell rests on it at x = REST_X. */
const FACE = 196;
const REST_X = 214;

/**
 * Drop physics, in SVG units and ms. Falls DROP units, then each bounce keeps E of the
 * speed (so E² of the height). Gravity is picked so the fall takes FALL ms.
 */
const DROP = 430;
const FALL = 400;
const E = 0.42;
const G = (2 * DROP) / (FALL * FALL);
const V0 = G * FALL; // speed at the first impact
const B1 = (2 * V0 * E) / G; // duration of the first bounce
const B2 = (2 * V0 * E * E) / G; // and the second
const T = {
  anvil: [0, 420],
  drop: 200, // dumbbell starts falling
  word: [1300, 1650],
  out: [1950, 2280],
};
/** Landings: left end first, then the right end, then the left again, then it rocks flat. */
const HITS = [T.drop + FALL, T.drop + FALL + B1, T.drop + FALL + B1 + B2];
const TILT = [-17, -13, 8, -3.5]; // degrees: as it starts falling, and at each landing
const ROCK = 440; // ms of rocking on the face before it sits still
const TOTAL = T.out[1];
/** Half the span of the big plates' feet: a tilted dumbbell rests on this corner. */
const FOOT = 68;

/** Height of the lowest point above the face (>= 0) and the tilt, at time t. */
function dropAt(t: number): { h: number; tilt: number } {
  const u = t - T.drop;
  if (u < 0) return { h: DROP, tilt: TILT[0] };
  // In the air it spins at a steady rate from one landing angle to the next.
  if (u < FALL) return { h: DROP - 0.5 * G * u * u, tilt: TILT[0] + (TILT[1] - TILT[0]) * (u / FALL) };
  const up = (v: number, s: number) => Math.max(0, v * s - 0.5 * G * s * s);
  if (t < HITS[1]) return { h: up(V0 * E, t - HITS[0]), tilt: TILT[1] + (TILT[2] - TILT[1]) * ((t - HITS[0]) / B1) };
  if (t < HITS[2]) return { h: up(V0 * E * E, t - HITS[1]), tilt: TILT[2] + (TILT[3] - TILT[2]) * ((t - HITS[1]) / B2) };
  // On the face: rocks from end to end, smaller each time, then sits flat.
  const k = (t - HITS[2]) / ROCK;
  if (k >= 1) return { h: 0, tilt: 0 };
  return { h: 0, tilt: TILT[3] * (1 - k) ** 2 * Math.cos(k * Math.PI * 2.5) };
}

/** Squash and stretch: a quick squash on each landing, scaled by how hard it hit. */
function squashAt(t: number) {
  let s = 0;
  HITS.forEach((h, i) => {
    const k = (t - h) / 150;
    if (k >= 0 && k < 1) s += [0.16, 0.07, 0.025][i] * Math.sin(Math.PI * k) * (1 - k);
  });
  return s;
}

/** A soft pulse after each landing (light streak, glow, anvil dip), 0..1. */
function impactAt(t: number, len = 520) {
  let v = 0;
  HITS.forEach((h, i) => {
    const k = (t - h) / len;
    if (k >= 0 && k < 1) v = Math.max(v, [1, 0.45, 0.18][i] * (1 - k) ** 2);
  });
  return v;
}

const ANVIL =
  'M 52 205 C 72 199 92 196 120 196 L 332 196 Q 340 196 340 204 L 340 224 Q 340 232 332 232 ' +
  'L 292 232 C 270 233 262 242 260 256 L 258 272 Q 257 279 266 281 L 296 287 Q 306 289 306 298 ' +
  'L 306 304 Q 306 311 299 311 L 103 311 Q 96 311 96 304 L 96 298 Q 96 289 106 287 L 136 281 ' +
  'Q 145 279 144 272 L 142 256 C 140 240 128 233 112 231 C 88 227 68 218 52 205 Z';

/** The dumbbell, drawn with its plates resting on y = 0 and centred on x = 0. */
const PLATES: { x: number; w: number; h: number }[] = [
  { x: -78, w: 10, h: 26 }, // end cap
  { x: -68, w: 20, h: 66 }, // big plate
  { x: -48, w: 12, h: 48 }, // small plate
  { x: 36, w: 12, h: 48 },
  { x: 48, w: 20, h: 66 },
  { x: 68, w: 10, h: 26 },
];
const PLATE_Y = -33; // the plates' centre line
const SPARKS = [-1, 1].flatMap((dir) => [0, 1, 2].map((i) => ({ dir, y: -4 - i * 7, len: 26 - i * 6, dist: 74 + i * 12 })));

export function LaunchIntro({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const anvil = useRef<SVGGElement>(null);
  const bell = useRef<SVGGElement>(null);
  const shadow = useRef<SVGEllipseElement>(null);
  const streak = useRef<SVGRectElement>(null);
  const glow = useRef<SVGEllipseElement>(null);
  const sparks = useRef<SVGGElement>(null);
  const word = useRef<HTMLDivElement>(null);
  const done = useRef(false);

  useEffect(() => {
    // Testing aid: ?introAt=900 freezes the animation at 900 ms.
    const frozen = Number(new URLSearchParams(location.search).get('introAt') ?? NaN);
    const reduce = Number.isNaN(frozen) && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const finish = () => {
      if (done.current) return;
      done.current = true;
      onDone();
    };
    let raf = 0;
    const t0 = performance.now();
    const s = (el: Element | null, k: string, v: string | number) => el?.setAttribute(k, String(v));

    const frame = (now: number) => {
      const t = Number.isNaN(frozen) ? now - t0 : frozen;

      if (reduce) {
        // Final pose only: fade in, hold, fade out.
        s(anvil.current, 'opacity', 1);
        s(bell.current, 'transform', `translate(${REST_X} ${FACE})`);
        s(bell.current, 'opacity', 1);
        s(shadow.current, 'opacity', 0.6);
        if (word.current) word.current.style.opacity = '1';
        const o = t < 300 ? t / 300 : t > 1000 ? 1 - (t - 1000) / 300 : 1;
        if (root.current) root.current.style.opacity = String(clamp01(o));
        if (t < 1300) raf = requestAnimationFrame(frame);
        else finish();
        return;
      }

      // 1. the anvil rises in
      const a = easeOut(span(t, T.anvil[0], T.anvil[1]));
      const dip = 4 * impactAt(t, 220);
      s(anvil.current, 'opacity', a);
      s(anvil.current, 'transform', `translate(0 ${((1 - a) * 14 + dip).toFixed(2)})`);

      // 2. the dumbbell falls, bounces twice and settles
      const { h, tilt } = dropAt(t);
      const q = squashAt(t);
      s(
        bell.current,
        'transform',
        `translate(${REST_X} ${(FACE - h - FOOT * Math.abs(Math.sin((tilt * Math.PI) / 180)) + dip).toFixed(2)}) rotate(${tilt.toFixed(2)}) scale(${(1 + q * 0.6).toFixed(3)} ${(1 - q).toFixed(3)})`,
      );
      s(bell.current, 'opacity', t < T.drop ? 0 : 1);
      // its shadow on the anvil face tightens as it comes down
      const near = clamp01(1 - h / DROP);
      s(shadow.current, 'opacity', t < T.drop ? 0 : (0.15 + 0.55 * near * near).toFixed(3));
      s(shadow.current, 'rx', (40 + 46 * near).toFixed(1));

      // 3. impact: light streak across the face, glow under the anvil, little sparks
      const imp = impactAt(t);
      s(streak.current, 'opacity', imp.toFixed(3));
      s(streak.current, 'transform', `translate(${REST_X} 0) scale(${(0.3 + 0.7 * easeOut(1 - imp)).toFixed(3)} 1) translate(${-REST_X} 0)`);
      s(glow.current, 'opacity', (0.35 + 0.65 * imp).toFixed(3));
      const sp = t >= HITS[0] ? span(t, HITS[0], HITS[0] + 380) : 0;
      sparks.current?.querySelectorAll('line').forEach((ln, i) => {
        const k = SPARKS[i];
        const d = 8 + easeOut(sp) * k.dist * 0.8;
        const x1 = REST_X - FOOT + 10 + k.dir * d; // from where the left end lands
        s(ln, 'x1', x1);
        s(ln, 'x2', x1 + k.dir * k.len * (1 - sp));
        s(ln, 'opacity', sp > 0 && sp < 1 ? 1 - sp : 0);
      });

      // 4. name, hold, fade into the app
      if (word.current) {
        const w = easeOut(span(t, T.word[0], T.word[1]));
        word.current.style.opacity = String(w);
        word.current.style.transform = `translateY(${(1 - w) * 12}px)`;
      }
      if (root.current) root.current.style.opacity = String(1 - span(t, T.out[0], T.out[1]));

      if (!Number.isNaN(frozen)) return;
      if (t < TOTAL) raf = requestAnimationFrame(frame);
      else finish();
    };
    // Frozen test frames are drawn right away (headless screenshots may not run animation frames).
    if (!Number.isNaN(frozen)) frame(performance.now());
    else raf = requestAnimationFrame(frame);
    // Safety net: if the phone isn't painting frames (app opened in the background, webview
    // paused), never leave the intro covering the app.
    const bail = Number.isNaN(frozen) ? window.setTimeout(finish, (reduce ? 1300 : TOTAL) + 700) : 0;
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(bail);
    };
  }, [onDone]);

  const skip = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  return (
    <div ref={root} className="launch-intro" onClick={skip} role="presentation" aria-hidden="true">
      <div className="launch-stage">
        <svg viewBox="30 20 340 310" className="launch-art">
          <defs>
            <linearGradient id="li-anvil" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1a2740" />
              <stop offset="0.45" stopColor="#0f1622" />
              <stop offset="1" stopColor="#0a0f18" />
            </linearGradient>
            <linearGradient id="li-edge" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#8fd8ff" stopOpacity="0.9" />
              <stop offset="0.5" stopColor="#2f7bff" stopOpacity="0.75" />
              <stop offset="1" stopColor="#2f7bff" stopOpacity="0.35" />
            </linearGradient>
            <linearGradient id="li-bell" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#5aa2ff" />
              <stop offset="0.5" stopColor="#2f7bff" />
              <stop offset="1" stopColor="#1d5be0" />
            </linearGradient>
            <linearGradient id="li-streak" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#35c8ff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#e6f7ff" />
              <stop offset="1" stopColor="#35c8ff" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="li-pool" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#2f7bff" stopOpacity="0.55" />
              <stop offset="1" stopColor="#2f7bff" stopOpacity="0" />
            </radialGradient>
            <filter id="li-soft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </defs>

          <ellipse ref={glow} cx="200" cy="314" rx="150" ry="22" fill="url(#li-pool)" opacity="0.35" />

          <g ref={anvil} opacity="0">
            <path d={ANVIL} fill="url(#li-anvil)" stroke="url(#li-edge)" strokeWidth="2.5" strokeLinejoin="round" />
            {/* the polished striking face */}
            <path d="M 122 199.5 L 330 199.5" stroke="#d9f2ff" strokeOpacity="0.35" strokeWidth="1.5" strokeLinecap="round" />
            <ellipse ref={shadow} cx={REST_X} cy={FACE + 2} rx="40" ry="5" fill="#000" opacity="0" filter="url(#li-soft)" />
            <rect ref={streak} x="100" y={FACE - 2} width="250" height="4" rx="2" fill="url(#li-streak)" opacity="0" />
          </g>

          <g ref={sparks} stroke="#bfefff" strokeWidth="2.5" strokeLinecap="round">
            {SPARKS.map((k, i) => (
              <line key={i} x1={REST_X} y1={FACE + k.y} x2={REST_X} y2={FACE + k.y} opacity="0" />
            ))}
          </g>

          <g ref={bell} opacity="0">
            <rect x="-48" y={PLATE_Y - 6} width="96" height="12" rx="6" fill="url(#li-bell)" />
            {PLATES.map((p, i) => (
              <rect key={i} x={p.x} y={PLATE_Y - p.h / 2} width={p.w} height={p.h} rx={Math.min(6, p.w / 2)} fill="url(#li-bell)" stroke="#9fd8ff" strokeOpacity="0.55" strokeWidth="1.5" />
            ))}
          </g>
        </svg>
        <div ref={word} className="launch-word" style={{ opacity: 0 }}>
          <span className="myo">Myo</span>
          <span className="forge">Forge</span>
        </div>
      </div>
    </div>
  );
}
