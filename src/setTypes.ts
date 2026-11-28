import type { SetType } from './types';

/** What each set type is, how to do it, and how MyoForge counts it. Shown behind the "?" buttons. */
export const SET_TYPES: { id: SetType; label: string; short: string; how: string; counts: string }[] = [
  {
    id: 'normal',
    label: 'Set',
    short: 'A regular working set.',
    how: 'Pick a weight you can lift for your target reps with good form, usually stopping 0–3 reps short of failure.',
    counts: 'Counts as 1 hard set for volume and fatigue. Used for PRs and strength trends.',
  },
  {
    id: 'warmup',
    label: 'Warm-up',
    short: 'A lighter set to get ready.',
    how: 'One set at about 60–80% of your working weight for ~5 easy reps before your first working set.',
    counts: "Doesn't count toward volume, fatigue, PRs, or trends.",
  },
  {
    id: 'drop',
    label: 'Drop set',
    short: 'Cut the weight and keep going, no rest.',
    how: 'Do a set to (or near) failure, then immediately strip ~20–25% of the weight and do as many reps as you can. Usually 2–3 drops. Log the first set, then tap "+ Drop" for each lighter round.',
    counts: 'First set = 1 hard set, each drop = ½ set. Taken to failure, so the muscle needs about a day longer to recover. Only the first set counts for PRs and strength trends.',
  },
  {
    id: 'myo',
    label: 'Myo-reps',
    short: 'Activation set, then quick mini-sets.',
    how: "Do an activation set of ~12–20 reps to about 1 rep short of failure. Rest 3–5 deep breaths (~15 s), then do 3–5 reps with the same weight. Repeat until you can't get ~3 reps, usually 3–5 mini-sets. Log the activation set, then tap \"+ Mini-set\" for each one.",
    counts: 'Activation set = 1 hard set, each mini-set = ½ set (4 mini-sets ≈ 3 sets in a fraction of the time). Near failure, so about a day longer recovery. Only the activation set counts for PRs and strength trends.',
  },
  {
    id: 'failure',
    label: 'To failure',
    short: "Until you can't do another rep.",
    how: 'Keep going until you cannot complete another rep with good form. Best saved for the last set of an exercise.',
    counts: 'Counts as 1 hard set, and the muscle needs about a day longer to recover.',
  },
];

export const setTypeInfo = (t: SetType) => SET_TYPES.find((x) => x.id === t)!;
