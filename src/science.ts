import type { Muscle } from './types';

/**
 * Every training rule in the app lives here, next to where it comes from.
 * Change a number here and the body map, stall flags, and suggestions follow.
 * Sources are listed in REFERENCES at the bottom (and shown in Settings → The science).
 */

/* ---------- Set counting ---------- */

/** Direct (primary) sets count 1, synergist sets 0.5: "fractional" counting (Pelland et al. 2024). */
export const PRIMARY_SET = 1;
export const SECONDARY_SET = 0.5;

/* ---------- Weekly volume bands (hard sets per muscle per week) ---------- */
// Schoenfeld 2017: dose-response, ≥10 sets/wk best studied. Baz-Valle 2022: 12–20 likely optimal.

export const VOLUME_BANDS = [
  { min: 0, max: 0.01, label: 'Untrained', tone: 0 },
  { min: 0.01, max: 5, label: 'Low', tone: 1 },
  { min: 5, max: 10, label: 'Moderate', tone: 2 },
  { min: 10, max: 20, label: 'Productive', tone: 3 },
  { min: 20, max: Infinity, label: 'Very high', tone: 4 },
] as const;

export const VOLUME_TARGET = { min: 10, max: 20 };

export function volumeBand(setsPerWeek: number) {
  return VOLUME_BANDS.find((b) => setsPerWeek >= b.min && setsPerWeek < b.max) ?? VOLUME_BANDS[0];
}

/** Spreading a muscle's weekly sets over ~2 sessions (Schoenfeld 2016; no penalty at 1x if volume is met, 2019). */
export const FREQUENCY_TARGET = 2;

/* ---------- Recovery ---------- */

export type SizeClass = 'small' | 'medium' | 'large';

/**
 * Hours until mostly recovered. Performance is typically back within 24–48h for single-joint work
 * and 48–72h for heavy multi-joint lifts (Korak 2015; MacDougall 1995; Phillips 1997).
 * NOTE: no study directly compares big vs small muscles; this size split is a practical heuristic.
 */
export const RECOVERY_HOURS: Record<SizeClass, number> = { small: 48, medium: 60, large: 72 };

/** Sets to failure delay recovery by roughly a day (Morán-Navarro 2017). */
export const FAILURE_EXTRA_HOURS = 24;

/** Fatigue saturates: this many fresh hard sets ≈ 63% fatigued, double ≈ 86%. (Display model, not a measured value.) */
export const FATIGUE_SCALE_SETS = 4;

/** Below this fatigue level a muscle is shown as ready to train hard again. */
export const READY_THRESHOLD = 0.25;

export const MUSCLES: Record<Muscle, { name: string; size: SizeClass }> = {
  chest: { name: 'Chest', size: 'medium' },
  frontDelts: { name: 'Front delts', size: 'small' },
  sideDelts: { name: 'Side delts', size: 'small' },
  rearDelts: { name: 'Rear delts', size: 'small' },
  traps: { name: 'Traps', size: 'medium' },
  upperBack: { name: 'Upper back', size: 'medium' },
  lats: { name: 'Lats', size: 'medium' },
  lowerBack: { name: 'Lower back', size: 'large' },
  biceps: { name: 'Biceps', size: 'small' },
  triceps: { name: 'Triceps', size: 'small' },
  forearms: { name: 'Forearms', size: 'small' },
  brachioradialis: { name: 'Brachioradialis', size: 'small' },
  abs: { name: 'Abs', size: 'small' },
  obliques: { name: 'Obliques', size: 'small' },
  glutes: { name: 'Glutes', size: 'large' },
  quads: { name: 'Quads', size: 'large' },
  hamstrings: { name: 'Hamstrings', size: 'large' },
  adductors: { name: 'Adductors', size: 'large' },
  abductors: { name: 'Abductors', size: 'medium' },
  calves: { name: 'Calves', size: 'small' },
};

export const MUSCLE_IDS = Object.keys(MUSCLES) as Muscle[];

/* ---------- Progression & stalls ---------- */

/**
 * An exercise is flagged as stalled when BOTH are true since its last new estimated-1RM best:
 *  - at least STALL_SESSIONS sessions logged (coaching convention: 2–3 sessions without progress), and
 *  - at least STALL_MIN_DAYS days passed (~2–3 weeks), so an exercise trained 2–3×/week
 *    isn't flagged after a single rough week.
 * There is no research definition of a "stall"; this is a convention, not a finding.
 */
export const STALL_SESSIONS = 3;
export const STALL_MIN_DAYS = 14;

/** Load jump once you beat your target reps by 1–2 (ACSM 2009 position stand: 2–10%). */
export const LOAD_INCREASE = { upper: [0.02, 0.05], lower: [0.05, 0.1] } as const;

/** Deload (Bell 2023; Rogerson 2024): ~1 week, cut sets, keep frequency, train further from failure. */
export const DELOAD = { days: 7, loadFactor: 0.9, setFactor: 0.5, rir: '2–3' };

/** Estimated-1RM formulas stay accurate up to ~10 reps (Reynolds 2006; Mayhew 2008). */
export const E1RM_MAX_RELIABLE_REPS = 10;

/* ---------- Warm-up ---------- */

/**
 * One specific set after a general warm-up (Abad 2011). A single heavier set (~80%) beat a
 * single light one (40%) in Ribeiro 2020, so the default is 70% for ~5 reps (adjustable 50–80%).
 */
export const WARMUP_DEFAULT_PCT = 0.7;
export const WARMUP_REPS = 5;

/* ---------- Sources ---------- */

export interface Ref {
  topic: string;
  claim: string;
  cite: string;
  url: string;
  confidence: 'High' | 'Moderate' | 'Low' | 'Convention';
}

export const REFERENCES: Ref[] = [
  {
    topic: 'Weekly volume',
    claim: 'More weekly sets per muscle → more growth, with ≥10 sets/week the best-supported range.',
    cite: 'Schoenfeld, Ogborn & Krieger (2017). J Sports Sci 35(11).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Schoenfeld+Ogborn+Krieger+2017+dose-response+weekly+resistance+training+volume',
    confidence: 'High',
  },
  {
    topic: 'Weekly volume',
    claim: 'In trained lifters, 12–20 sets/week is likely optimal; more rarely adds much (triceps the exception).',
    cite: 'Baz-Valle et al. (2022). J Hum Kinet.',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8884877/',
    confidence: 'Moderate',
  },
  {
    topic: 'Set counting',
    claim: 'Counting synergist (indirect) sets as half a set fits the data best; direct and indirect sets should be counted separately.',
    cite: 'Pelland, Remmert, Robinson, Hinson & Zourdos (2024). SportRxiv preprint, meta-regression of 67 studies.',
    url: 'https://bibbase.org/network/publication/joshuapelland-jacobremmert-zacrobinson-sethhinson-michaelzourdos-theresistancetrainingdoseresponsemetaregressionsexploringtheeectsofweeklyvolumeandfrequencyonmusclehypertrophyandstrengthgain-2024',
    confidence: 'High',
  },
  {
    topic: 'Frequency',
    claim: 'Training a muscle 2×/week beat 1×/week, but with equal volume frequency matters little for growth.',
    cite: 'Schoenfeld et al. (2016) Sports Med 46(11); Schoenfeld, Grgic & Krieger (2019) J Sports Sci.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/27102172/',
    confidence: 'High',
  },
  {
    topic: 'Recovery',
    claim: 'Muscle protein synthesis stays raised ~24–48h after a session.',
    cite: 'MacDougall et al. (1995) Can J Appl Physiol; Phillips et al. (1997) Am J Physiol.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/8563679/',
    confidence: 'Moderate',
  },
  {
    topic: 'Recovery',
    claim: 'Most lifters are back to baseline reps by 48h; heavy multi-joint lifts can need ~72h. Big-vs-small muscle split is a heuristic.',
    cite: 'Korak, Green & O’Neal (2015). Int J Exerc Sci 8(1).',
    url: 'https://digitalcommons.wku.edu/ijes/vol8/iss1/10',
    confidence: 'Moderate',
  },
  {
    topic: 'Recovery',
    claim: 'Sets to failure lengthen recovery by about 24–48h versus the same work stopped short of failure.',
    cite: 'Morán-Navarro et al. (2017). Eur J Appl Physiol.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/28965198/',
    confidence: 'Moderate',
  },
  {
    topic: 'Progression',
    claim: 'Once you can do 1–2 reps over your target, raise the load 2–10% (double progression).',
    cite: 'ACSM Position Stand (2009). Med Sci Sports Exerc 41(3).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/19204579/',
    confidence: 'Moderate',
  },
  {
    topic: 'Deloads',
    claim: 'Typical deload ≈ 1 week, every ~5–6 weeks: fewer sets, keep frequency, train further from failure.',
    cite: 'Bell et al. (2023) Sports Med Open 9:87; Rogerson et al. (2024) Sports Med Open 10:26.',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10511399/',
    confidence: 'High',
  },
  {
    topic: 'Stalls',
    claim: 'No research definition exists. Coaches commonly flag 2–3 sessions without progress; this app flags 3 sessions and at least 2 weeks without a new best.',
    cite: 'Coaching convention; deload consensus does not define plateaus.',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10511399/',
    confidence: 'Convention',
  },
  {
    topic: 'Warm-up',
    claim: 'A general warm-up plus a specific warm-up set improved max strength; one heavier set (~80%) beat one light set (40%).',
    cite: 'Abad et al. (2011) J Strength Cond Res 25(8); Ribeiro et al. (2020) IJERPH 17(18).',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7558980/',
    confidence: 'Low',
  },
  {
    topic: 'Estimated 1RM',
    claim: 'Epley/Brzycki estimates are accurate up to ~10 reps, best near 5; above that they drift.',
    cite: 'Reynolds, Gordon & Robergs (2006) J Strength Cond Res 20(3); Mayhew et al. (2008) J Strength Cond Res 22(5).',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Reynolds+Gordon+Robergs+2006+prediction+one+repetition+maximum',
    confidence: 'High',
  },
];
