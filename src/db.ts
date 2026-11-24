import Dexie, { type Table } from 'dexie';
import type { Exercise, Plan, SetEntry, Workout } from './types';
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
