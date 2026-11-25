import Dexie, { type Table } from 'dexie';
import type { Exercise, Muscle, Plan, SetEntry, Workout } from './types';
import { SEED } from './seed';

class AppDB extends Dexie {
  exercises!: Table<Exercise, number>;
  workouts!: Table<Workout, number>;
  sets!: Table<SetEntry, number>;
  plans!: Table<Plan, number>;

  constructor() {
    super('workout-app');
    this.version(1).stores({
      exercises: '++id, name, group',
      workouts: '++id, startedAt',
      sets: '++id, workoutId, exerciseId, ts',
      plans: '++id, createdAt',
    });
  }
}

export const db = new AppDB();

export async function initDB() {
  if ((await db.exercises.count()) === 0) await db.exercises.bulkAdd(SEED);
  await migrateSeedV2();
  await migrateSeedV3();
  await migratePRsV2();
  // One-time: seed "My exercises" with everything already in a plan or with logged sets.
  if (!localStorage.getItem('mine.v1')) {
    const used = new Set<number>([...(await db.plans.toArray()).flatMap((p) => p.exerciseIds), ...((await db.sets.orderBy('exerciseId').uniqueKeys()) as number[])]);
    if (used.size) await db.exercises.where(':id').anyOf([...used]).modify({ mine: true });
    localStorage.setItem('mine.v1', '1');
  }
  // Ask the OS not to evict our storage. Only a hint, so keep exporting backups.
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* ignore */
  }
}

/**
 * One-time update for databases seeded before abductors existed. Only touches built-in
 * exercises, and only if their muscles still match the old defaults (your edits are kept).
 * Logged sets are never touched; history simply re-counts with the new muscle mapping.
 */
async function migrateSeedV2() {
  if (localStorage.getItem('seed.v2')) return;
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
  await db.transaction('rw', db.exercises, async () => {
    const all = await db.exercises.toArray();
    const byName = new Map(all.map((e) => [e.name.toLowerCase(), e]));
    for (const seed of SEED) {
      const cur = byName.get(seed.name.toLowerCase());
      if (!cur) {
        await db.exercises.add({ ...seed });
        continue;
      }
      if (cur.custom) continue;
      if (seed.name === 'Hip Abduction' && same(cur.primary, ['glutes']) && cur.secondary.length === 0) {
        await db.exercises.update(cur.id!, { primary: ['abductors'], secondary: ['glutes'] });
      }
      if ((seed.name === 'Lunge' || seed.name === 'Bulgarian Split Squat') && !cur.primary.includes('abductors') && !cur.secondary.includes('abductors')) {
        await db.exercises.update(cur.id!, { secondary: [...cur.secondary, 'abductors'] });
      }
    }
  });
  localStorage.setItem('seed.v2', '1');
}

/**
 * One-time update adding the brachioradialis. Built-in curls get it only if their muscles
 * still match the old defaults (your edits are kept); new built-ins (Incline Dumbbell Curl,
 * Reverse Curl) are added if missing.
 */
async function migrateSeedV3() {
  if (localStorage.getItem('seed.v3')) return;
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
  const OLD: Record<string, [Muscle[], Muscle[]]> = {
    'barbell curl': [['biceps'], ['forearms']],
    'dumbbell curl': [['biceps'], ['forearms']],
    'hammer curl': [['biceps', 'forearms'], []],
    'preacher curl': [['biceps'], []],
  };
  await db.transaction('rw', db.exercises, async () => {
    const all = await db.exercises.toArray();
    const byName = new Map(all.map((e) => [e.name.toLowerCase(), e]));
    for (const seed of SEED) {
      const key = seed.name.toLowerCase();
      const cur = byName.get(key);
      if (!cur) {
        await db.exercises.add({ ...seed });
        continue;
      }
      const old = OLD[key];
      if (cur.custom || !old) continue;
      if (same(cur.primary, old[0]) && same(cur.secondary, old[1])) {
        await db.exercises.update(cur.id!, { primary: [...seed.primary], secondary: [...seed.secondary] });
      }
    }
  });
  localStorage.setItem('seed.v3', '1');
}

/** One-time: re-mark past PRs so only new heaviest weights count (older builds also flagged e1RM and set volume). */
async function migratePRsV2() {
  if (localStorage.getItem('prs.v2')) return;
  await db.transaction('rw', db.sets, async () => {
    const all = (await db.sets.toArray()).sort((a, b) => a.ts - b.ts);
    const best = new Map<number, number>();
    const seen = new Set<number>();
    for (const s of all) {
      let prs: string[] = [];
      const working = s.type !== 'warmup' && s.reps >= 1;
      if (working) {
        const b = best.get(s.exerciseId) ?? 0;
        if (seen.has(s.exerciseId) && s.weight > 0 && s.weight > b + 0.01) prs = ['Weight'];
        best.set(s.exerciseId, Math.max(b, s.weight));
        seen.add(s.exerciseId);
      }
      const old = s.prs ?? [];
      if (old.length !== prs.length || old.some((k, i) => k !== prs[i])) await db.sets.update(s.id!, { prs });
    }
  });
  localStorage.setItem('prs.v2', '1');
}

export async function exportJSON(): Promise<string> {
  const [exercises, workouts, sets, plans] = await Promise.all([db.exercises.toArray(), db.workouts.toArray(), db.sets.toArray(), db.plans.toArray()]);
  return JSON.stringify({ app: 'workout-app', version: 1, exportedAt: Date.now(), exercises, workouts, sets, plans }, null, 2);
}

export async function importJSON(text: string) {
  const data = JSON.parse(text);
  if (data?.app !== 'workout-app') throw new Error('Not a Workout App backup file');
  await db.transaction('rw', [db.exercises, db.workouts, db.sets, db.plans], async () => {
    await Promise.all([db.exercises.clear(), db.workouts.clear(), db.sets.clear(), db.plans.clear()]);
    await db.exercises.bulkPut(data.exercises ?? []);
    await db.workouts.bulkPut(data.workouts ?? []);
    await db.sets.bulkPut(data.sets ?? []);
    await db.plans.bulkPut(data.plans ?? []);
  });
}

export async function deleteWorkout(id: number) {
  await db.transaction('rw', db.workouts, db.sets, async () => {
    await db.sets.where('workoutId').equals(id).delete();
    await db.workouts.delete(id);
  });
}

/** Remove an exercise everywhere it is referenced. Refuses if it has logged history. */
export async function deleteExercise(id: number): Promise<boolean> {
  if ((await db.sets.where('exerciseId').equals(id).count()) > 0) return false;
  await db.transaction('rw', db.exercises, db.plans, async () => {
    const plans = await db.plans.toArray();
    for (const p of plans) {
      if (p.exerciseIds.includes(id)) await db.plans.update(p.id!, { exerciseIds: p.exerciseIds.filter((x) => x !== id) });
    }
    await db.exercises.delete(id);
  });
  return true;
}
