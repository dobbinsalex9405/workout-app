import type { SetEntry } from './types';

/**
 * Fatigue between sets, learned per person and per exercise.
 *
 * Idea: every pair of back-to-back sets of an exercise is one example of how much strength you
 * lost, given how long you rested. We measure strength as an Epley estimate of 1RM ("capacity"),
 * so a small weight change between sets still compares fairly.
 *
 * Learning: we start from a research-based curve of how much capacity a near-failure set costs
 * at a given rest (shorter rest = bigger drop), and learn one personal multiplier on it per
 * exercise. Each usable example pulls the multiplier toward you; the default counts like
 * PRIOR_WEIGHT examples, so after ~6 of yours it's mostly you. Recent sessions weigh more.
 *
 * RIR: when you note reps in reserve, a set of 8 at RIR 2 counts as 10 reps of capacity, so sets
 * you stop short on still measure your real strength. Predictions are then "reps to failure".
 *
 * Honesty: we replay your history (predicting each set using only earlier sessions) to measure how
 * far off predictions actually are for you, and only show predictions when that error is small.
 *
 * What we deliberately ignore (it would mislead):
 *  - warm-ups, drop-set drops, myo-rep mini-sets, and sets right after a drop/myo set;
 *  - pairs logged within 30 s of each other (logged afterwards in a batch, rest unknown);
 *  - rests over 10 minutes (something else happened);
 *  - pairs where reps went UP (the first set was well short of failure).
 * Pairs with the same reps again are kept: they're real (and keep the estimate from only seeing
 * drops), but if most of yours are like that you probably stop at a target, and we say so.
 *  - big weight changes (>15%) and very high reps (>15), where 1RM estimates get unreliable.
 */

export const FATIGUE = {
  minGapS: 30,
  maxRestS: 600,
  maxReps: 15,
  maxWeightChange: 0.15,
  maxLoss: 0.35,
  /** Seconds of work per rep, to turn "time between logs" into rest. */
  secPerRep: 3,
  /** The research default counts like this many of your own examples. */
  PRIOR_WEIGHT: 3,
  /** Older sessions count less: weight × this per session back. */
  RECENCY: 0.92,
  /** Before showing predictions: */
  minExamples: 6,
  minSessions: 3,
  minBacktest: 4,
  /** Hide predictions if 80% of replayed predictions aren't within this many reps. */
  maxP80Error: 2.5,
};

/**
 * Typical capacity lost per near-failure set vs rest, at moderate loads (~6–12 reps). Built from
 * rest-interval studies (Willardson & Burkett 2005/2006; Senna 2011; de Salles 2009): reps hold
 * up far better with 3–5 min than 1 min. Expressed as estimated-1RM loss, e.g. 10 reps → 8 reps
 * at the same weight ≈ 5%. An informed default, not a law: it's what the personal fit corrects.
 */
const PRIOR: [number, number][] = [
  [30, 0.09],
  [60, 0.065],
  [90, 0.05],
  [120, 0.042],
  [180, 0.032],
  [300, 0.02],
  [600, 0.012],
];

export function priorLoss(restS: number) {
  const x = Math.log(Math.max(PRIOR[0][0], Math.min(PRIOR[PRIOR.length - 1][0], restS)));
  for (let i = 1; i < PRIOR.length; i++) {
    const [t1, v1] = PRIOR[i];
    const [t0, v0] = PRIOR[i - 1];
    if (x <= Math.log(t1)) {
      const k = (x - Math.log(t0)) / (Math.log(t1) - Math.log(t0));
      return v0 + (v1 - v0) * k;
    }
  }
  return PRIOR[PRIOR.length - 1][1];
}

/** Epley estimated 1RM. */
export const capacity = (w: number, reps: number) => w * (1 + reps / 30);
/** Reps you could do at weight w with this capacity (inverse Epley). */
export const repsAt = (cap: number, w: number) => Math.max(0, 30 * (cap / w - 1));

export interface Transition {
  workoutId: number;
  ts: number;
  restS: number;
  /** reps = reps you could have done (logged reps + RIR when you gave it). */
  prev: { weight: number; reps: number };
  next: { weight: number; reps: number };
  loss: number;
  plateau: boolean;
}

const strengthType = (s: SetEntry) => s.type !== 'warmup' && s.parent == null && s.reps >= 1 && s.weight > 0;

/** Reps in reserve if known: what you entered, or 0 for a set marked "to failure". */
export const rirOf = (s: SetEntry): number | undefined => (s.rir != null ? s.rir : s.type === 'failure' ? 0 : undefined);
/** Reps you could have done: logged reps + reps in reserve (when known). */
export const effReps = (s: SetEntry) => s.reps + (rirOf(s) ?? 0);

/** Turn one exercise's sets into usable "set → next set" examples. */
export function extractTransitions(sets: SetEntry[]): Transition[] {
  const byWorkout = new Map<number, SetEntry[]>();
  for (const s of sets) {
    const list = byWorkout.get(s.workoutId) ?? [];
    list.push(s);
    byWorkout.set(s.workoutId, list);
  }
  const out: Transition[] = [];
  for (const [workoutId, list] of byWorkout) {
    list.sort((a, b) => a.ts - b.ts);
    const hasKids = new Set(list.filter((s) => s.parent != null).map((s) => s.parent));
    const main = list.filter(strengthType);
    for (let i = 1; i < main.length; i++) {
      const a = main[i - 1];
      const b = main[i];
      if (a.type === 'drop' || a.type === 'myo' || hasKids.has(a.id)) continue;
      // Anything logged in between (warm-up, other sets) breaks the pair.
      const between = list.some((s) => s.ts > a.ts && s.ts < b.ts && s.parent == null && s.type === 'warmup');
      if (between) continue;
      const gapS = (b.ts - a.ts) / 1000;
      if (gapS < FATIGUE.minGapS) continue;
      const restS = gapS - b.reps * FATIGUE.secPerRep;
      if (restS > FATIGUE.maxRestS || restS < 15) continue;
      const ra = effReps(a);
      const rb = effReps(b);
      if (ra > FATIGUE.maxReps + 3 || rb > FATIGUE.maxReps + 3 || a.reps > FATIGUE.maxReps || b.reps > FATIGUE.maxReps) continue;
      if (Math.abs(b.weight / a.weight - 1) > FATIGUE.maxWeightChange) continue;
      const loss = 1 - capacity(b.weight, rb) / capacity(a.weight, ra);
      const sameWeight = Math.abs(b.weight / a.weight - 1) < 0.01;
      // More reps on the later set means the first one was well short of failure: no signal.
      if (loss < -0.02 || loss > FATIGUE.maxLoss) continue;
      out.push({
        workoutId,
        ts: b.ts,
        restS,
        prev: { weight: a.weight, reps: ra },
        next: { weight: b.weight, reps: rb },
        loss: Math.max(0, loss),
        // Same reps again: either barely tired, or stopping at a target. Kept (it's real), but tracked.
        // Only ambiguous when you didn't say how close to failure the first set was.
        plateau: sameWeight && b.reps === a.reps && rirOf(a) == null,
      });
    }
  }
  return out.sort((a, b) => a.ts - b.ts);
}

function weightedMedian(xs: { v: number; w: number }[]) {
  const s = [...xs].sort((a, b) => a.v - b.v);
  const half = s.reduce((a, x) => a + x.w, 0) / 2;
  let acc = 0;
  for (const x of s) {
    acc += x.w;
    if (acc >= half) return x.v;
  }
  return s[s.length - 1]?.v ?? 1;
}

/** Personal multiplier on the default curve (1 = typical, 1.5 = tire 50% faster). */
export function fitScale(ts: Transition[]): { scale: number; weight: number } {
  if (!ts.length) return { scale: 1, weight: 0 };
  const sessions = [...new Set(ts.map((t) => t.workoutId))];
  const age = new Map(sessions.map((id, i) => [id, sessions.length - 1 - i]));
  const xs = ts.map((t) => ({ v: t.loss / priorLoss(t.restS), w: FATIGUE.RECENCY ** (age.get(t.workoutId) ?? 0) }));
  const W = xs.reduce((a, x) => a + x.w, 0);
  const med = weightedMedian(xs);
  // Shrink toward the default while there's little data; clamp to a sane range.
  const scale = (W * med + FATIGUE.PRIOR_WEIGHT * 1) / (W + FATIGUE.PRIOR_WEIGHT);
  return { scale: Math.min(3, Math.max(0.3, scale)), weight: W };
}

export function predictReps(scale: number, prev: { weight: number; reps: number }, restS: number, weight: number) {
  const cap = capacity(prev.weight, prev.reps) * (1 - scale * priorLoss(restS));
  return repsAt(cap, weight);
}

export interface FatigueProfile {
  scale: number;
  examples: number;
  sessions: number;
  /** Replay of your history: errors (predicted − actual reps) using only earlier sessions. */
  backtest: number[];
  /** 80% of replayed predictions were within this many reps. */
  p80: number | null;
  mae: number | null;
  /** Share of examples with the same reps again. */
  plateauShare: number;
  /**
   * You usually stop at a set rep target (first set nearly always the same reps, and repeats are
   * common), so drops reflect how you train, not how tired you could get going all-out.
   */
  targetStyle: boolean;
  status: 'learning' | 'noisy' | 'ready';
}

export function fatigueProfile(sets: SetEntry[]): FatigueProfile {
  const ts = extractTransitions(sets);
  const sessions = [...new Set(ts.map((t) => t.workoutId))];
  const backtest: number[] = [];
  for (const t of ts) {
    const earlier = ts.filter((x) => x.workoutId !== t.workoutId && x.ts < t.ts);
    if (earlier.length < 4) continue;
    const { scale } = fitScale(earlier);
    backtest.push(predictReps(scale, t.prev, t.restS, t.next.weight) - t.next.reps);
  }
  const abs = backtest.map(Math.abs).sort((a, b) => a - b);
  const p80 = abs.length ? abs[Math.min(abs.length - 1, Math.ceil(abs.length * 0.8) - 1)] : null;
  const mae = abs.length ? abs.reduce((a, x) => a + x, 0) / abs.length : null;
  const { scale } = fitScale(ts);
  let status: FatigueProfile['status'] = 'learning';
  if (ts.length >= FATIGUE.minExamples && sessions.length >= FATIGUE.minSessions && backtest.length >= FATIGUE.minBacktest) {
    status = p80 != null && p80 <= FATIGUE.maxP80Error ? 'ready' : 'noisy';
  }
  const plateauShare = ts.length ? ts.filter((t) => t.plateau).length / ts.length : 0;
  // First working set of each session: going all-out varies with daily form; a target doesn't.
  const firsts = new Map<number, number>();
  for (const st of [...sets].filter((x) => strengthType(x) && rirOf(x) == null).sort((a, b) => a.ts - b.ts)) if (!firsts.has(st.workoutId)) firsts.set(st.workoutId, st.reps);
  const counts = new Map<number, number>();
  for (const r of firsts.values()) counts.set(r, (counts.get(r) ?? 0) + 1);
  const modeShare = firsts.size ? Math.max(...counts.values()) / firsts.size : 0;
  const targetStyle = firsts.size >= 4 && modeShare >= 0.7 && plateauShare >= 0.25;
  return { scale, examples: ts.length, sessions: sessions.length, backtest, p80, mae, plateauShare, targetStyle, status };
}

/** Range shown to the user: the prediction ± the 80% replay error, never tighter than ±1 rep. */
export function predictionRange(p: FatigueProfile, reps: number) {
  const pad = Math.max(1, Math.round(p.p80 ?? 1));
  const mid = Math.round(reps);
  return { reps: mid, lo: Math.max(0, mid - pad), hi: mid + pad };
}

/** Today's sets vs your usual: >1 means dropping faster than usual. Null until there's a usable pair. */
export function todayVsUsual(todaySets: SetEntry[], scale: number): { ratio: number; n: number } | null {
  const ts = extractTransitions(todaySets);
  if (!ts.length) return null;
  const q = ts.reduce((a, t) => a + t.loss / priorLoss(t.restS), 0) / ts.length;
  return { ratio: q / scale, n: ts.length };
}
