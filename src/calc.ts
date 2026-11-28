import type { Exercise, Muscle, SetEntry, Session, Unit } from './types';
import { db } from './db';
import {
  DELOAD,
  FAILURE_EXTRA_HOURS,
  FOLLOWUP_SET,
  NEAR_FAILURE_TYPES,
  RIR_FACTOR,
  FATIGUE_SCALE_SETS,
  LOAD_INCREASE,
  MUSCLES,
  MUSCLE_IDS,
  PRIMARY_SET,
  READY_THRESHOLD,
  RECOVERY_HOURS,
  SECONDARY_SET,
  STALL_MIN_DAYS,
  STALL_SESSIONS,
  VOLUME_TARGET,
  WARMUP_REPS,
} from './science';

const LB = 2.20462262;
export const DAY = 86400000;
const HOUR = 3600000;

export const toDisplay = (kg: number, unit: Unit) => (unit === 'lb' ? kg * LB : kg);
export const fromDisplay = (v: number, unit: Unit) => (unit === 'lb' ? v / LB : v);
export const fmtW = (kg: number, unit: Unit) => String(Math.round(toDisplay(kg, unit) * 10) / 10);
export const fmtN = (n: number) => Math.round(n).toLocaleString();

/** Round a displayed weight to something you can actually load. */
export function roundLoad(display: number, unit: Unit) {
  const step = unit === 'lb' ? 5 : 2.5;
  return Math.max(step, Math.round(display / step) * step);
}

/** Epley estimated one-rep max. */
export const e1rm = (kg: number, reps: number) => (reps <= 1 ? kg * Math.max(reps, 0) : kg * (1 + reps / 30));

export const isWorking = (s: SetEntry) => s.type !== 'warmup' && s.reps >= 1;
/** A drop or myo-rep mini-set (belongs to the set before it). */
export const isFollowup = (s: SetEntry) => s.parent != null;
/** Sets that speak for strength: working sets, minus drops and mini-sets (lighter or pre-fatigued). */
export const isStrengthSet = (s: SetEntry) => isWorking(s) && !isFollowup(s);

/* ---------- PRs ---------- */

export interface Best {
  weight: number;
  e1rm: number;
  setVolume: number;
  count: number;
}

export function bestOf(sets: SetEntry[]): Best {
  const b: Best = { weight: 0, e1rm: 0, setVolume: 0, count: 0 };
  for (const s of sets) {
    if (!isStrengthSet(s)) continue;
    b.count++;
    b.weight = Math.max(b.weight, s.weight);
    b.e1rm = Math.max(b.e1rm, e1rm(s.weight, s.reps));
    b.setVolume = Math.max(b.setVolume, s.weight * s.reps);
  }
  return b;
}

/**
 * A PR is a new heaviest weight for the exercise, nothing else (more reps or volume at the
 * same weight don't count). Never fires on the first-ever set.
 */
export function detectPRs(prior: SetEntry[], weight: number, reps: number, type: SetEntry['type']): string[] {
  if (type === 'warmup' || reps < 1 || weight <= 0) return [];
  const b = bestOf(prior);
  if (b.count === 0) return [];
  return weight > b.weight + 0.01 ? ['Weight'] : [];
}

export interface PRRecord {
  ts: number;
  kind: string;
  weight: number;
  reps: number;
}

export function prTimeline(sets: SetEntry[]): PRRecord[] {
  const sorted = sets.filter(isStrengthSet).sort((a, b) => a.ts - b.ts);
  const out: PRRecord[] = [];
  let bw = 0;
  sorted.forEach((s, i) => {
    if (i > 0 && s.weight > bw + 0.01) out.push({ ts: s.ts, kind: 'PR', weight: s.weight, reps: s.reps });
    bw = Math.max(bw, s.weight);
  });
  return out.reverse();
}

/* ---------- Sessions & stalls ---------- */

/**
 * One entry per workout. Pass `starts` (workoutId -> startedAt) so a session is dated by when the
 * workout began: a late-night lift that runs past midnight counts for the day it started.
 */
export function toSessions(sets: SetEntry[], starts?: Map<number, number>): Session[] {
  const map = new Map<number, Session>();
  for (const s of sets) {
    if (!isWorking(s)) continue;
    let x = map.get(s.workoutId);
    if (!x) {
      x = { workoutId: s.workoutId, date: s.ts, topWeight: 0, topReps: 0, e1rm: 0, volume: 0, reps: 0, sets: 0 };
      map.set(s.workoutId, x);
    }
    x.date = Math.min(x.date, s.ts);
    x.volume += s.weight * s.reps;
    x.reps += s.reps;
    if (isFollowup(s)) continue; // drops and mini-sets add volume, not strength or set count
    if (s.weight > x.topWeight || (s.weight === x.topWeight && s.reps > x.topReps)) {
      x.topWeight = s.weight;
      x.topReps = s.reps;
    }
    x.e1rm = Math.max(x.e1rm, e1rm(s.weight, s.reps));
    x.sets += 1;
  }
  if (starts) for (const x of map.values()) x.date = starts.get(x.workoutId) ?? x.date;
  return [...map.values()].sort((a, b) => a.date - b.date);
}

/** workoutId -> start time, for dating sessions by the day the workout began. */
export async function workoutStarts(): Promise<Map<number, number>> {
  return new Map((await db.workouts.toArray()).map((w) => [w.id!, w.startedAt]));
}

export interface StallInfo {
  stalled: boolean;
  /** Sessions logged since the last new estimated-1RM best. */
  since: number;
  best: number;
  lastPrDate?: number;
}

export function stallInfo(sessions: Session[], now = Date.now()): StallInfo {
  let best = 0;
  let lastIdx = -1;
  sessions.forEach((s, i) => {
    if (s.e1rm > best + 0.01) {
      best = s.e1rm;
      lastIdx = i;
    }
  });
  const since = lastIdx < 0 ? 0 : sessions.length - 1 - lastIdx;
  const lastPrDate = lastIdx >= 0 ? sessions[lastIdx].date : undefined;
  const longEnough = lastPrDate != null && now - lastPrDate >= STALL_MIN_DAYS * DAY;
  return { stalled: since >= STALL_SESSIONS && longEnough, since, best, lastPrDate };
}

const LOWER: Muscle[] = ['quads', 'hamstrings', 'glutes', 'adductors', 'abductors', 'calves', 'lowerBack'];
export const isLowerBody = (ex?: Exercise) => !!ex && ex.primary.some((m) => LOWER.includes(m));

export interface Advice {
  title: string;
  body: string;
}

/** Concrete next steps for a stalled exercise, using the user's own numbers. */
export function stallAdvice(sessions: Session[], ex: Exercise | undefined, unit: Unit, weeklySets?: number): Advice[] {
  const last = sessions[sessions.length - 1];
  if (!last) return [];
  const lower = isLowerBody(ex);
  const [lo, hi] = lower ? LOAD_INCREASE.lower : LOAD_INCREASE.upper;
  const top = toDisplay(last.topWeight, unit);
  const step = unit === 'lb' ? 5 : 2.5;
  const cur = roundLoad(top, unit);
  // Always suggest at least one plate step up, so rounding never says "add 0".
  const nextLo = Math.max(cur + step, roundLoad(top * (1 + lo), unit));
  const nextHi = Math.max(nextLo, roundLoad(top * (1 + hi), unit));
  const out: Advice[] = [];
  out.push({
    title: 'Double progression',
    body: `Stay at ${cur} ${unit} and add reps each session. Once you can beat your target reps by 1–2 on every working set, add ${Math.round(lo * 100)}–${Math.round(hi * 100)}% (about ${
      nextLo === nextHi ? nextLo : `${nextLo}–${nextHi}`
    } ${unit}).`,
  });
  if (weeklySets != null && ex?.primary[0]) {
    const name = MUSCLES[ex.primary[0]].name;
    const note =
      weeklySets < VOLUME_TARGET.min
        ? `That's under the ~${VOLUME_TARGET.min} sets/week where growth is best supported. Try adding 2–4 sets for this muscle across the week.`
        : weeklySets > VOLUME_TARGET.max
          ? `That's above ${VOLUME_TARGET.max}/week, where extra sets rarely add much. Fatigue may be masking strength, so a deload is a good bet.`
          : `That's in the ${VOLUME_TARGET.min}–${VOLUME_TARGET.max} range, so volume probably isn't the problem.`;
    out.push({ title: 'Check weekly volume', body: `${name} is getting ~${weeklySets.toFixed(1)} sets/week (last 4 weeks, synergist sets count half). ${note}` });
  }
  out.push({
    title: 'Deload week',
    body: `For about ${DELOAD.days} days use ~${roundLoad(top * DELOAD.loadFactor, unit)} ${unit}, about half your usual sets, and stop ${DELOAD.rir} reps short of failure. Keep training on your usual days, then build back up.`,
  });
  if (last.topReps > 10) {
    out.push({ title: 'Heavier, lower reps', body: 'Your top sets are over 10 reps, where estimated 1RM gets less accurate. Some "stalls" are just noise there. A block in the 4–8 rep range gives a clearer read.' });
  }
  return out;
}

/* ---------- Warm-up ---------- */

export function warmupFor(workingKg: number, pct: number, unit: Unit) {
  return { weight: roundLoad(toDisplay(workingKg, unit) * pct, unit), reps: WARMUP_REPS };
}

/* ---------- Body map: fatigue & volume per muscle ---------- */

export interface MuscleStat {
  muscle: Muscle;
  fatigue: number; // 0..1
  readyInHours: number; // 0 if ready
  setsInRange: number; // fractional sets
  perWeek: number;
  lastTs?: number;
  /** Distinct workouts in the last 7 days that trained this muscle directly. */
  sessions7: number;
  top: { exerciseId: number; sets: number }[];
}

export function muscleStats(sets: SetEntry[], exMap: Map<number, Exercise>, now: number, rangeDays: number): Record<Muscle, MuscleStat> {
  const out = {} as Record<Muscle, MuscleStat>;
  const contrib = {} as Record<Muscle, Map<number, number>>;
  const load = {} as Record<Muscle, number>;
  const parts = {} as Record<Muscle, { remaining: number; tauH: number }[]>;
  const week = {} as Record<Muscle, Set<number>>;
  for (const m of MUSCLE_IDS) {
    out[m] = { muscle: m, fatigue: 0, readyInHours: 0, setsInRange: 0, perWeek: 0, sessions7: 0, top: [] };
    contrib[m] = new Map();
    load[m] = 0;
    parts[m] = [];
    week[m] = new Set();
  }
  const rangeMs = rangeDays * DAY;
  for (const s of sets) {
    if (!isWorking(s)) continue;
    const ex = exMap.get(s.exerciseId);
    if (!ex) continue;
    const age = now - s.ts;
    if (age < 0) continue;
    const toFailure = (NEAR_FAILURE_TYPES as readonly string[]).includes(s.type) || s.rir === 0;
    const extra = toFailure ? FAILURE_EXTRA_HOURS : 0;
    const k = (isFollowup(s) ? FOLLOWUP_SET : 1) * (s.rir != null ? RIR_FACTOR(s.rir) : 1);
    const apply = (m: Muscle, w0: number) => {
      const w = w0 * k;
      const o = out[m];
      if (!o) return;
      // Exponential decay that falls to ~10% of the original by the end of the recovery window.
      const tauH = (RECOVERY_HOURS[MUSCLES[m].size] + extra) / Math.LN10;
      const remaining = w * Math.exp(-age / HOUR / tauH);
      load[m] += remaining;
      if (remaining > 0.01) parts[m].push({ remaining, tauH });
      if (age <= rangeMs) {
        o.setsInRange += w;
        contrib[m].set(s.exerciseId, (contrib[m].get(s.exerciseId) ?? 0) + w);
      }
      o.lastTs = Math.max(o.lastTs ?? 0, s.ts);
    };
    ex.primary.forEach((m) => {
      apply(m, PRIMARY_SET);
      if (age <= 7 * DAY) week[m]?.add(s.workoutId);
    });
    ex.secondary.forEach((m) => apply(m, SECONDARY_SET));
  }
  const readyLoad = -FATIGUE_SCALE_SETS * Math.log(1 - READY_THRESHOLD);
  for (const m of MUSCLE_IDS) {
    const o = out[m];
    o.fatigue = 1 - Math.exp(-load[m] / FATIGUE_SCALE_SETS);
    // Step forward hour by hour until the decayed load drops under the "ready" line.
    if (load[m] > readyLoad) {
      let h = 0;
      const at = (t: number) => parts[m].reduce((a, p) => a + p.remaining * Math.exp(-t / p.tauH), 0);
      while (h < 240 && at(h) > readyLoad) h++;
      o.readyInHours = h;
    }
    o.perWeek = o.setsInRange / (rangeDays / 7);
    o.sessions7 = week[m].size;
    o.top = [...contrib[m].entries()].map(([exerciseId, sets]) => ({ exerciseId, sets })).sort((a, b) => b.sets - a.sets).slice(0, 4);
  }
  return out;
}

/* ---------- Dates ---------- */

export function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Calendar-safe day math (adding 24h blocks drifts across daylight-saving changes). */
export function addDays(ts: number, n: number) {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export function startOfWeek(ts: number) {
  const d = new Date(startOfDay(ts));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d.getTime();
}

export const fmtDate = (ts: number) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
export const fmtDateLong = (ts: number) => new Date(ts).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

export function fmtAgo(ts?: number, now = Date.now()) {
  if (!ts) return 'never';
  const h = (now - ts) / HOUR;
  if (h < 1) return 'just now';
  if (h < 24) return `${Math.round(h)}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d}d ago`;
}

export function fmtHours(h: number) {
  if (h <= 0) return 'Ready';
  if (h < 1) return '<1h';
  if (h < 24) return `${Math.round(h)}h`;
  const d = h / 24;
  return `${d < 2 ? d.toFixed(1) : Math.round(d)}d`;
}
