export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';
export type Unit = 'lb' | 'kg';

export type Muscle =
  | 'chest'
  | 'frontDelts'
  | 'sideDelts'
  | 'rearDelts'
  | 'traps'
  | 'upperBack'
  | 'lats'
  | 'lowerBack'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'adductors'
  | 'calves';

export interface Exercise {
  id?: number;
  name: string;
  /** Broad group used for filtering in the picker. */
  group: string;
  /** Muscles that do most of the work: counted as 1 set each. */
  primary: Muscle[];
  /** Synergists: counted as 0.5 set each (fractional set counting). */
  secondary: Muscle[];
  custom?: boolean;
  /** In the user's "My exercises" list. */
  mine?: boolean;
}

/**
 * A plan holds references (ids) to exercises, never copies of exercise data.
 * The same exercise can sit in any number of plans; renaming it or editing its
 * muscles updates it everywhere, and all its history stays in one place.
 */
export interface Plan {
  id?: number;
  name: string;
  exerciseIds: number[];
  createdAt: number;
}

export interface Workout {
  id?: number;
  name: string;
  startedAt: number;
  endedAt?: number;
  planId?: number;
  /** Exercises in display order, so an exercise with no sets yet still shows. */
  exerciseIds: number[];
}

export interface SetEntry {
  id?: number;
  workoutId: number;
  exerciseId: number;
  weight: number; // always stored in kg
  reps: number;
  type: SetType;
  ts: number;
  /** PR kinds this set broke when logged, e.g. ['Est. 1RM', 'Weight'] */
  prs?: string[];
}

export interface Session {
  workoutId: number;
  date: number;
  topWeight: number; // kg
  topReps: number; // reps at the top weight
  e1rm: number; // kg
  volume: number; // kg
  reps: number;
  sets: number;
}
