import { useEffect, useRef } from 'react';

/**
 * Launch animation: a plain anvil draws in, the dumbbell hammer swings down and strikes,
 * and the anvil's top flexes up into an arm, then "MyoForge" lights up and it all fades
 * into the app. ~2.4s, tap to skip, a short fade only with Reduce Motion.
 *
 * Everything is driven from one requestAnimationFrame loop that writes SVG attributes
 * directly (no React re-renders), so it stays smooth on older phones.
 */

type Seg = [number, number, number, number, number, number]; // c1x c1y c2x c2y x y
type Shape = { start: [number, number]; top: Seg[] };

/** The waist and base never change; only the top (5 segments) morphs. */
const BASE: Seg[] = [
  [640, 548, 636, 590, 662, 622],
  [662, 622, 770, 652, 770, 652],
  [770, 652, 770, 722, 770, 722],
  [770, 722, 290, 722, 290, 722],
  [290, 722, 290, 652, 290, 652],
  [290, 652, 398, 622, 398, 622],
  [424, 590, 420, 548, 392, 512],
];

const ANVIL: Shape = {
  start: [168, 452],
  top: [
    [212, 436, 256, 422, 300, 414], // horn
    [325, 410, 350, 407, 372, 406],
    [400, 405, 430, 403, 460, 402], // face
    [490, 401, 520, 400, 550, 399],
    [570, 399, 590, 398, 610, 398],
    [630, 397, 650, 397, 670, 396],
    [690, 396, 710, 395, 730, 395],
    [760, 394, 790, 393, 820, 393],
    [833, 392, 846, 392, 860, 392],
    [860, 420, 860, 450, 860, 476], // heel front
    [790, 478, 712, 486, 668, 512], // heel underside
  ],
};

/** Same segment count, so every point has a partner to travel to. */
const ARM: Shape = {
  start: [200, 500],
  top: [
    [176, 466, 184, 410, 240, 392], // deltoid
    [290, 330, 360, 262, 450, 262], // bicep rising to the peak
    [540, 262, 584, 290, 590, 336], // peak into the elbow crease
    [598, 300, 610, 250, 619, 214], // inner forearm, longer, up to the wrist
    [626, 209, 634, 203, 643, 199], // wrist, angled back toward the shoulder (fist sits here)
    [656, 193, 669, 188, 682, 183],
    [695, 177, 706, 174, 718, 170],
    [722, 170, 727, 170, 732, 172],
    [744, 210, 754, 250, 760, 290], // outer forearm
    [766, 330, 782, 366, 784, 402],
    [788, 470, 742, 506, 668, 512], // elbow
  ],
};
const CLOSE_ANVIL: Seg = [330, 480, 252, 470, 168, 452];
const CLOSE_ARM: Seg = [330, 520, 250, 520, 200, 500];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpSeg = (a: Seg, b: Seg, t: number) => a.map((v, i) => lerp(v, b[i], t)) as Seg;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeIn = (t: number) => t * t * t;
const easeOut = (t: number) => 1 - (1 - t) ** 3;
/** Overshoots a little, then settles: the "flex". */
const easeOutBack = (t: number) => {
  const c = 1.6;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};
/** Progress of `now` through the window [from, to], 0..1. */
const span = (now: number, from: number, to: number) => clamp01((now - from) / (to - from));

const FLEX = 1;

function pathAt(p: number) {
  const t = p * FLEX;
  const sx = lerp(ANVIL.start[0], ARM.start[0], t);
  const sy = lerp(ANVIL.start[1], ARM.start[1], t);
  const segs = [...ANVIL.top.map((s, i) => lerpSeg(s, ARM.top[i], t)), ...BASE, lerpSeg(CLOSE_ANVIL, CLOSE_ARM, t)];
  return `M${sx.toFixed(1)},${sy.toFixed(1)} ` + segs.map((s) => 'C' + s.map((v) => v.toFixed(1)).join(',')).join(' ') + ' Z';
}

const HIT: [number, number] = [520, 400];
/** Hammer pose: translate, rotate, scale, then swing about the grip. */
type Pose = { x: number; y: number; r: number; k: number; a: number };
const STRIKE: Pose = { x: HIT[0], y: HIT[1], r: -24, k: 1.15, a: 0 };
/** Held upright in the fist: handle straight down, dumbbell head on top. */
const HELD: Pose = { x: 563, y: 0, r: 90, k: 1, a: 0 };
const poseStr = (p: Pose) => `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.r.toFixed(2)}) scale(${p.k.toFixed(3)}) rotate(${p.a.toFixed(2)} 208 -105)`;
/** The fist: palm, four fingers wrapped around the handle, thumb over the top. */
const FIST: { x: number; y: number; w: number; h: number; r: number }[] = [
  { x: 640, y: 106, w: 116, h: 150, r: 30 }, // back of the hand
  { x: 578, y: 110, w: 120, h: 36, r: 18 },
  { x: 574, y: 145, w: 122, h: 36, r: 18 },
  { x: 576, y: 180, w: 118, h: 36, r: 18 },
  { x: 584, y: 215, w: 108, h: 36, r: 18 },
];
/** The fist sits on the raised wrist, tilted back toward the shoulder like the top of a curl. */
const GRIP = { angle: -22, cx: 672, cy: 190, lift: -60 };
const gripStr = (e: number) => `rotate(${(GRIP.angle * e).toFixed(2)} ${GRIP.cx} ${GRIP.cy}) translate(0 ${(GRIP.lift * e).toFixed(1)})`;
const THUMB = 'M 608 112 C 624 90 670 86 716 98 L 716 124 C 678 116 640 118 608 130 Z';
const SPARKS = Array.from({ length: 9 }, (_, i) => {
  const a = (-170 + i * (160 / 8)) * (Math.PI / 180); // fan above the strike
  return { dx: Math.cos(a), dy: Math.sin(a), dist: 190 + (i % 3) * 70, len: 44 + (i % 2) * 26 };
});

// Timeline (ms)
const T = { draw: [0, 520], hammerIn: [260, 500], swing: [520, 700], hit: 700, fly: [820, 1260], morph: [780, 1300], grip: [1180, 1400], fibers: [1250, 1550], word: [1300, 1650], out: [2150, 2480] };
const TOTAL = T.out[1];

export function LaunchIntro({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const shape = useRef<SVGPathElement>(null);
  const fill = useRef<SVGPathElement>(null);
  const halo = useRef<SVGPathElement>(null);
  const hammer = useRef<SVGGElement>(null);
  const flash = useRef<SVGCircleElement>(null);
  const sparks = useRef<SVGGElement>(null);
  const fibers = useRef<SVGGElement>(null);
  const fist = useRef<SVGGElement>(null);
  const grip = useRef<SVGGElement>(null);
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

    const frame = (now: number) => {
      const t = Number.isNaN(frozen) ? now - t0 : frozen;
      const s = (el: Element | null, k: string, v: string | number) => el?.setAttribute(k, String(v));

      if (reduce) {
        // Final pose only: fade in, hold, fade out.
        s(shape.current, 'd', pathAt(1));
        s(fill.current, 'd', pathAt(1));
        s(halo.current, 'd', pathAt(1));
        s(shape.current, 'stroke-dashoffset', 0);
        s(fill.current, 'opacity', 1);
        s(fibers.current, 'opacity', 1);
        s(hammer.current, 'opacity', 1);
        s(hammer.current, 'transform', poseStr(HELD));
        s(grip.current, 'transform', gripStr(1));
        fist.current?.querySelectorAll('g').forEach((g) => s(g, 'opacity', 1));
        if (word.current) word.current.style.opacity = '1';
        const o = t < 300 ? t / 300 : t > 1000 ? 1 - (t - 1000) / 300 : 1;
        if (root.current) root.current.style.opacity = String(clamp01(o));
        if (t < 1300) raf = requestAnimationFrame(frame);
        else finish();
        return;
      }

      // 1. anvil draws itself in, then fills
      s(shape.current, 'stroke-dashoffset', 1 - easeOut(span(t, T.draw[0], T.draw[1])));
      s(fill.current, 'opacity', span(t, 300, 620));
      s(halo.current, 'opacity', 0.55 * span(t, 300, 620));

      // 2. hammer appears raised, swings down, bounces off, and flies up into the new hand
      const swing = easeIn(span(t, T.swing[0], T.swing[1]));
      const recoil = easeOut(span(t, T.hit, T.fly[0]));
      const angle = t < T.hit ? lerp(62, 0, swing) : lerp(0, 18, recoil);
      let pose: Pose = { ...STRIKE, a: angle };
      let e = 0;
      if (t >= T.fly[0]) {
        const f = span(t, T.fly[0], T.fly[1]);
        e = f < 0.5 ? 4 * f * f * f : 1 - (-2 * f + 2) ** 3 / 2; // ease in-out
        pose = {
          x: lerp(STRIKE.x, HELD.x, e),
          y: lerp(STRIKE.y, HELD.y, e) - 90 * Math.sin(Math.PI * e), // a little lob
          r: lerp(STRIKE.r, HELD.r, e),
          k: lerp(STRIKE.k, HELD.k, e),
          a: lerp(18, 0, e),
        };
      }
      s(hammer.current, 'transform', poseStr(pose));
      s(grip.current, 'transform', gripStr(e)); // tilt blends in as it flies to the hand
      s(hammer.current, 'opacity', span(t, T.hammerIn[0], T.hammerIn[1]));

      // the fingers close around the handle one after another
      fist.current?.querySelectorAll('g').forEach((g, i) => {
        const g0 = T.grip[0] + i * 40;
        const v = easeOut(span(t, g0, g0 + 140));
        s(g, 'opacity', v);
        s(g, 'transform', `translate(${((1 - v) * 26).toFixed(1)} 0)`);
      });

      // 3. impact: flash, sparks, shake
      const h = span(t, T.hit, T.hit + 420);
      s(flash.current, 'r', t >= T.hit ? 40 + 210 * easeOut(h) : 0);
      s(flash.current, 'opacity', t >= T.hit ? 1 - h : 0);
      const sp = span(t, T.hit, T.hit + 520);
      sparks.current?.querySelectorAll('line').forEach((ln, i) => {
        const k = SPARKS[i];
        const d = easeOut(sp) * k.dist;
        s(ln, 'x1', HIT[0] + k.dx * d);
        s(ln, 'y1', HIT[1] + k.dy * d);
        s(ln, 'x2', HIT[0] + k.dx * (d + k.len * (1 - sp)));
        s(ln, 'y2', HIT[1] + k.dy * (d + k.len * (1 - sp)));
        s(ln, 'opacity', t >= T.hit ? 1 - sp : 0);
      });
      if (stage.current) {
        const sh = span(t, T.hit, T.hit + 220);
        const amp = t >= T.hit && sh < 1 ? 9 * (1 - sh) : 0;
        stage.current.style.transform = `translate(${(Math.sin(t * 0.09) * amp).toFixed(1)}px, ${(Math.cos(t * 0.11) * amp).toFixed(1)}px)`;
      }

      // 4. the anvil flexes up into an arm
      const m = easeOutBack(span(t, T.morph[0], T.morph[1]));
      const d = pathAt(m);
      s(shape.current, 'd', d);
      s(fill.current, 'd', d);
      s(halo.current, 'd', d);
      s(fibers.current, 'opacity', span(t, T.fibers[0], T.fibers[1]));

      // 5. name, hold, fade into the app
      if (word.current) {
        const w = easeOut(span(t, T.word[0], T.word[1]));
        word.current.style.opacity = String(w);
        word.current.style.transform = `translateY(${(1 - w) * 14}px)`;
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
      <div ref={stage} className="launch-stage">
        <svg viewBox="80 -70 860 850" className="launch-art">
          <defs>
            <linearGradient id="li-edge" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#e6f7ff" />
              <stop offset="0.35" stopColor="#4fd2ff" />
              <stop offset="1" stopColor="#2f6bff" />
            </linearGradient>
            <linearGradient id="li-body" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1c4290" />
              <stop offset="0.5" stopColor="#0b1a3c" />
              <stop offset="1" stopColor="#060c1c" />
            </linearGradient>
            <radialGradient id="li-hot" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.35" stopColor="#bfefff" />
              <stop offset="1" stopColor="#35c8ff" stopOpacity="0" />
            </radialGradient>
            <filter id="li-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="16" />
            </filter>
            <g id="li-hammer">
              <rect x="0" y="-117" width="200" height="24" rx="12" />
              <rect x="136" y="-122" width="72" height="34" rx="15" />
              <rect x="-10" y="-150" width="20" height="90" rx="5" />
              <rect x="-22" y="-62" width="44" height="14" rx="5" />
              <rect x="-22" y="-162" width="44" height="14" rx="5" />
              <rect x="-46" y="-50" width="92" height="24" rx="7" />
              <rect x="-46" y="-184" width="92" height="24" rx="7" />
              <rect x="-62" y="-27" width="124" height="27" rx="8" />
              <rect x="-62" y="-211" width="124" height="27" rx="8" />
            </g>
          </defs>

          <ellipse cx="530" cy="736" rx="320" ry="30" fill="#2f7bff" opacity="0.3" filter="url(#li-glow)" />
          <path ref={halo} d={pathAt(0)} fill="none" stroke="#2f8bff" strokeWidth="30" opacity="0" filter="url(#li-glow)" />
          <path ref={fill} d={pathAt(0)} fill="url(#li-body)" opacity="0" />
          <g ref={fibers} opacity="0" fill="none" stroke="#4fd2ff" strokeLinecap="round">
            <path d="M 262 424 C 330 306 460 252 580 352" strokeWidth="9" opacity="0.85" />
            <path d="M 274 448 C 350 344 460 304 576 370" strokeWidth="7" opacity="0.6" />
            <path d="M 290 470 C 370 386 460 354 570 388" strokeWidth="6" opacity="0.4" />
          </g>
          <path ref={shape} d={pathAt(0)} fill="none" stroke="url(#li-edge)" strokeWidth="14" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset="1" />

          <circle ref={flash} cx={HIT[0]} cy={HIT[1]} r="0" fill="url(#li-hot)" opacity="0" />
          <g ref={sparks} stroke="#bfefff" strokeWidth="10" strokeLinecap="round">
            {SPARKS.map((_, i) => (
              <line key={i} x1={HIT[0]} y1={HIT[1]} x2={HIT[0]} y2={HIT[1]} opacity="0" stroke={i % 3 === 0 ? '#e6f7ff' : i % 3 === 1 ? '#4fd2ff' : '#bfefff'} />
            ))}
          </g>

          <g ref={grip}>
            <g ref={hammer} opacity="0">
              <use href="#li-hammer" fill="url(#li-body)" />
              <use href="#li-hammer" fill="none" stroke="url(#li-edge)" strokeWidth="9" strokeLinejoin="round" />
            </g>
          </g>

          <g ref={fist} transform={gripStr(1)}>
            {FIST.map((f, i) => (
              <g key={i} opacity="0">
                <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={f.r} fill="url(#li-body)" stroke="url(#li-edge)" strokeWidth="9" />
              </g>
            ))}
            <g opacity="0">
              <path d={THUMB} fill="url(#li-body)" stroke="url(#li-edge)" strokeWidth="9" strokeLinejoin="round" />
            </g>
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
