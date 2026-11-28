// Validates src/fatigue.ts against simulated lifters whose true fatigue is known.
//   node scripts/test-fatigue.mjs
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'fatigue-test-'));
const out = join(dir, 'fatigue.mjs');
await build({ entryPoints: ['src/fatigue.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent' });
const F = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });

// Deterministic random numbers so results are repeatable.
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());

/**
 * One simulated lifter. trueLoss(rest) = capacity lost per set. Each session: a fresh capacity
 * (day-to-day form varies ±3%), a weight near their 10RM, 3–4 sets with random rests.
 */
function simulate({ sessions = 12, trueLoss, noise = 0.012, toFailure = true, batch = false, startId = 1, logRir = false, rirError = 0 }) {
  const sets = [];
  let id = startId;
  let t = Date.UTC(2026, 0, 1);
  for (let w = 1; w <= sessions; w++) {
    t += 3 * 86400000;
    const base = 100 * (1 + 0.004 * w) * (1 + 0.03 * gauss());
    const weight = Math.round((base / (1 + 10 / 30)) / 2.5) * 2.5;
    let cap = base;
    let ts = t;
    const n = 3 + Math.floor(rnd() * 2);
    for (let i = 0; i < n; i++) {
      const max = Math.floor(F.repsAt(cap * (1 + noise * gauss()), weight));
      let reps = max;
      if (!toFailure) reps = Math.min(reps, 8); // stops at a target of 8
      reps = Math.max(1, reps);
      ts += batch ? 5000 : 0;
      const set = { id: id++, workoutId: w + startId * 1000, exerciseId: 1, weight, reps, type: 'normal', ts };
      // Self-rated reps in reserve, with human error (people tend to be off by about a rep).
      if (logRir) set.rir = Math.min(5, Math.max(0, Math.round(max - reps + rirError * gauss())));
      sets.push(set);
      const rest = 70 + rnd() * 170; // 70–240 s
      if (!batch) ts += (rest + reps * 3) * 1000;
      cap *= 1 - trueLoss(rest);
    }
  }
  return sets;
}

function evaluate(name, sets, { trueScale, trueLoss, toFailure = true, logRir = false, rirError = 0 } = {}) {
  const p = F.fatigueProfile(sets);
  // Out-of-sample check on fresh sessions from the same lifter: how often is reality inside the range?
  let inside = 0;
  let total = 0;
  const errs = [];
  if (trueLoss && p.status === 'ready') {
    const fresh = simulate({ sessions: 30, trueLoss, startId: 9, toFailure, logRir, rirError });
    for (const t of F.extractTransitions(fresh)) {
      const pred = F.predictReps(p.scale, t.prev, t.restS, t.next.weight);
      const r = F.predictionRange(p, pred);
      total++;
      if (t.next.reps >= r.lo && t.next.reps <= r.hi) inside++;
      errs.push(Math.abs(pred - t.next.reps));
    }
  }
  const mae = errs.length ? (errs.reduce((a, x) => a + x, 0) / errs.length).toFixed(2) : '-';
  console.log(
    `${name.padEnd(34)} status=${p.status.padEnd(8)} examples=${String(p.examples).padStart(3)} ` +
      `scale=${p.scale.toFixed(2)}${trueScale ? ` (true ${trueScale})` : ''} plateau=${Math.round(p.plateauShare * 100)}%${p.targetStyle ? ' TARGET' : ''} replayP80=${p.p80?.toFixed(2) ?? '-'} ` +
      `newData: inRange=${total ? Math.round((inside / total) * 100) + '%' : '-'} MAE=${mae}`,
  );
  return { p, inside, total };
}

const P = F.priorLoss;
const results = [];
for (const s of [0.6, 1.0, 1.6]) {
  const trueLoss = (r) => s * P(r);
  results.push(['scale ' + s, evaluate(`typical curve, tires ×${s}`, simulate({ trueLoss }), { trueScale: s, trueLoss })]);
}
// Different curve shape than our default: rest matters less for this person.
const flat = (r) => 0.045 * Math.pow(120 / r, 0.3);
results.push(['flat', evaluate('different curve shape', simulate({ trueLoss: flat }), { trueLoss: flat })]);
// Very inconsistent lifter.
const noisy = (r) => P(r);
results.push(['noisy', evaluate('very inconsistent day to day', simulate({ trueLoss: noisy, noise: 0.05 }), { trueLoss: noisy })]);
// Stops at 8 but logs RIR (with realistic ±1 rep guessing error): should read true fatigue.
const t13 = (r) => 1.3 * P(r);
results.push(['rir', evaluate('stops at 8, logs RIR (±1 guess)', simulate({ trueLoss: t13, toFailure: false, logRir: true, rirError: 1 }), { trueScale: 1.3, trueLoss: t13, toFailure: false, logRir: true, rirError: 1 })]);
results.push(['norir', evaluate('stops at 8, no RIR', simulate({ trueLoss: t13, toFailure: false }), { trueScale: 1.3, trueLoss: t13, toFailure: false })]);
// Wildly inconsistent: must be hidden rather than confidently wrong.
results.push(['chaos', evaluate('chaotic (±10% set to set)', simulate({ trueLoss: noisy, noise: 0.1 }), { trueLoss: noisy })]);
// Always stops at 8 reps: no evidence of fatigue, must not claim to know.
results.push(['target', evaluate('stops at target reps (8,8,8)', simulate({ trueLoss: (r) => P(r), toFailure: false }), { trueLoss: (r) => P(r), toFailure: false })]);
// Logs everything after the workout: rest unknown, must not learn from it.
results.push(['batch', evaluate('logs all sets afterwards', simulate({ trueLoss: (r) => P(r), batch: true }))]);
// Brand new: two sessions only.
results.push(['new', evaluate('only 2 sessions so far', simulate({ trueLoss: (r) => P(r), sessions: 2 }))]);

let fail = 0;
const check = (ok, msg) => {
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
};
const get = (k) => results.find((r) => r[0] === k)[1];
for (const s of [0.6, 1.0, 1.6]) {
  const r = get('scale ' + s);
  check(r.p.status === 'ready', `tires ×${s}: becomes ready`);
  check(Math.abs(r.p.scale - s) / s < 0.25, `tires ×${s}: learned rate within 25% (got ${r.p.scale.toFixed(2)})`);
  check(r.total > 0 && r.inside / r.total >= 0.75, `tires ×${s}: ≥75% of new sets land in the shown range`);
}
check(get('target').p.targetStyle, 'target-rep lifter: flagged as stopping at a target');
for (const s of [0.6, 1.0, 1.6]) check(!get('scale ' + s).p.targetStyle, `all-out lifter ×${s}: not mistaken for target-rep style`);
check(get('target').p.status !== 'ready' || get('target').inside / Math.max(1, get('target').total) >= 0.75, 'target-rep lifter: predictions still match what they log');
check(get('batch').p.status === 'learning', 'batch logger: never claims a fatigue rate');
check(get('new').p.status === 'learning', 'new lifter: waits for more data');
check(get('noisy').p.status !== 'ready' || get('noisy').inside / Math.max(1, get('noisy').total) >= 0.7, 'inconsistent lifter: either hidden, or honest range');
check(get('flat').p.status !== 'ready' || get('flat').inside / Math.max(1, get('flat').total) >= 0.7, 'different curve shape: either hidden, or honest range');
check(get('chaos').p.status === 'noisy', 'chaotic lifter: predictions hidden (status noisy)');
check(Math.abs(get('rir').p.scale - 1.3) / 1.3 < 0.25, `RIR logger: true fatigue recovered even when stopping short (got ${get('rir').p.scale.toFixed(2)}, true 1.3)`);
check(!get('rir').p.targetStyle, 'RIR logger: not flagged as target-rep style');
check(Math.abs(get('rir').p.scale - 1.3) < Math.abs(get('norir').p.scale - 1.3), 'RIR makes the estimate more accurate than no RIR');
console.log(fail ? `\n${fail} check(s) failed` : '\nAll checks passed');
process.exit(fail ? 1 : 0);
