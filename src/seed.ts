import type { Exercise, Muscle } from './types';

export const GROUPS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];

/** Sensible starting muscles for a custom exercise in each group (editable later). */
export const GROUP_DEFAULT: Record<string, Muscle[]> = {
  Chest: ['chest'],
  Back: ['lats', 'upperBack'],
  Legs: ['quads', 'glutes'],
  Shoulders: ['frontDelts', 'sideDelts'],
  Arms: ['biceps'],
  Core: ['abs'],
};

const X = (group: string, name: string, primary: Muscle[], secondary: Muscle[] = []): Exercise => ({ name, group, primary, secondary });

export const SEED: Exercise[] = [
  // Chest
  X('Chest', 'Bench Press', ['chest'], ['frontDelts', 'triceps']),
  X('Chest', 'Incline Bench Press', ['chest', 'frontDelts'], ['triceps']),
  X('Chest', 'Dumbbell Bench Press', ['chest'], ['frontDelts', 'triceps']),
  X('Chest', 'Incline Dumbbell Press', ['chest', 'frontDelts'], ['triceps']),
  X('Chest', 'Machine Chest Press', ['chest'], ['frontDelts', 'triceps']),
  X('Chest', 'Chest Fly', ['chest'], ['frontDelts']),
  X('Chest', 'Pec Deck', ['chest'], ['frontDelts']),
  X('Chest', 'Cable Crossover', ['chest'], ['frontDelts']),
  X('Chest', 'Push-Up', ['chest'], ['frontDelts', 'triceps', 'abs']),
  X('Chest', 'Dip', ['chest', 'triceps'], ['frontDelts']),
  // Back
  X('Back', 'Deadlift', ['glutes', 'hamstrings', 'lowerBack'], ['quads', 'traps', 'upperBack', 'forearms']),
  X('Back', 'Barbell Row', ['lats', 'upperBack'], ['rearDelts', 'biceps', 'lowerBack']),
  X('Back', 'Pull-Up', ['lats'], ['biceps', 'upperBack', 'forearms']),
  X('Back', 'Chin-Up', ['lats', 'biceps'], ['upperBack', 'forearms']),
  X('Back', 'Lat Pulldown', ['lats'], ['biceps', 'upperBack']),
  X('Back', 'Seated Cable Row', ['upperBack', 'lats'], ['biceps', 'rearDelts']),
  X('Back', 'Dumbbell Row', ['lats', 'upperBack'], ['biceps', 'rearDelts']),
  X('Back', 'T-Bar Row', ['upperBack', 'lats'], ['biceps', 'rearDelts', 'lowerBack']),
  X('Back', 'Back Extension', ['lowerBack'], ['glutes', 'hamstrings']),
  X('Back', 'Shrug', ['traps'], ['forearms']),
  // Legs
  X('Legs', 'Squat', ['quads', 'glutes'], ['adductors', 'lowerBack']),
  X('Legs', 'Front Squat', ['quads'], ['glutes', 'upperBack', 'abs']),
  X('Legs', 'Hack Squat', ['quads'], ['glutes']),
  X('Legs', 'Leg Press', ['quads', 'glutes'], ['adductors']),
  X('Legs', 'Romanian Deadlift', ['hamstrings', 'glutes'], ['lowerBack', 'forearms']),
  X('Legs', 'Lunge', ['quads', 'glutes'], ['adductors', 'hamstrings']),
  X('Legs', 'Bulgarian Split Squat', ['quads', 'glutes'], ['adductors']),
  X('Legs', 'Leg Extension', ['quads']),
  X('Legs', 'Leg Curl', ['hamstrings'], ['calves']),
  X('Legs', 'Hip Thrust', ['glutes'], ['hamstrings']),
  X('Legs', 'Hip Adduction', ['adductors']),
  X('Legs', 'Hip Abduction', ['glutes']),
  X('Legs', 'Standing Calf Raise', ['calves']),
  X('Legs', 'Seated Calf Raise', ['calves']),
  // Shoulders
  X('Shoulders', 'Overhead Press', ['frontDelts'], ['sideDelts', 'triceps', 'traps']),
  X('Shoulders', 'Dumbbell Shoulder Press', ['frontDelts'], ['sideDelts', 'triceps']),
  X('Shoulders', 'Lateral Raise', ['sideDelts'], ['traps']),
  X('Shoulders', 'Cable Lateral Raise', ['sideDelts']),
  X('Shoulders', 'Upright Row', ['sideDelts', 'traps'], ['biceps']),
  X('Shoulders', 'Rear Delt Fly', ['rearDelts'], ['upperBack']),
  X('Shoulders', 'Face Pull', ['rearDelts'], ['upperBack', 'traps']),
  // Arms
  X('Arms', 'Barbell Curl', ['biceps'], ['forearms']),
  X('Arms', 'Dumbbell Curl', ['biceps'], ['forearms']),
  X('Arms', 'Hammer Curl', ['biceps', 'forearms']),
  X('Arms', 'Preacher Curl', ['biceps']),
  X('Arms', 'Tricep Pushdown', ['triceps']),
  X('Arms', 'Skull Crusher', ['triceps']),
  X('Arms', 'Overhead Tricep Extension', ['triceps']),
  X('Arms', 'Close-Grip Bench Press', ['triceps', 'chest'], ['frontDelts']),
  X('Arms', 'Wrist Curl', ['forearms']),
  // Core
  X('Core', 'Plank', ['abs'], ['obliques']),
  X('Core', 'Hanging Leg Raise', ['abs'], ['obliques']),
  X('Core', 'Cable Crunch', ['abs'], ['obliques']),
  X('Core', 'Ab Wheel', ['abs'], ['obliques', 'lats']),
  X('Core', 'Russian Twist', ['obliques'], ['abs']),
];
