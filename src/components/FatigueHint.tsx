import { useEffect, useMemo, useState } from 'react';
import type { SetEntry, Unit } from '../types';
import { fmtW, fromDisplay, roundLoad, toDisplay } from '../calc';
import { FATIGUE, capacity, effReps, fatigueProfile, predictReps, predictionRange, priorLoss, rirOf, todayVsUsual } from '../fatigue';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Rest planner under an exercise during a workout. Type the weight you're about to lift (and,
 * optionally, the reps you're going for) and it estimates reps, a sensible rest, and how long
 * to rest to hit your target. Learned from your own history on this exercise; stays quiet (or
 * says it's still learning) until replaying your past sessions shows it's reliable for you.
 */
export function FatigueHint({ all, today, draftW, draftR, unit }: { all: SetEntry[]; today: SetEntry[]; draftW: string; draftR: string; unit: Unit }) {
  const profile = useMemo(() => fatigueProfile(all), [all]);
  const main = today.filter((s) => s.type !== 'warmup' && s.parent == null && s.reps >= 1);
  const last = main[main.length - 1];
  const [now, setNow] = useState(Date.now());
  const fresh = last && now - last.ts < FATIGUE.maxRestS * 1000;
  useEffect(() => {
    if (!last) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [last]);

  if (!last || last.type === 'drop' || last.type === 'myo' || last.weight <= 0) return null;

  if (profile.status === 'learning') {
    const need = Math.max(0, FATIGUE.minExamples - profile.examples);
    return (
      <p className="fatigue-hint muted">
        Learning how you tire on this exercise{need > 0 ? ` · ${need} more set${need === 1 ? '' : 's'} with normal rest` : ` · ${Math.max(0, FATIGUE.minSessions - profile.sessions)} more session(s)`}
      </p>
    );
  }
  if (profile.status === 'noisy') {
    return <p className="fatigue-hint muted">Your reps on this exercise vary too much set to set to predict reliably yet.</p>;
  }
  if (!fresh) return null;

  const restS = Math.max(30, (now - last.ts) / 1000);
  const typed = Number(draftW);
  const weightKg = typed > 0 ? fromDisplay(typed, unit) : last.weight;
  const prev = { weight: last.weight, reps: effReps(last) };
  // Plan at the same effort as the last set: if you left 2 in the tank, assume you will again.
  const rir = Math.min(4, rirOf(last) ?? 0);
  const repsAtRest = (s: number) => predictReps(profile.scale, prev, s, weightKg) - rir;

  const r = predictionRange(profile, repsAtRest(restS));
  // Suggested rest: where another minute adds less than ~a third of a rep (bounded 1–5 min).
  let suggest = 60;
  while (suggest < 300 && repsAtRest(suggest + 60) - repsAtRest(suggest) >= 0.3) suggest += 15;
  // Weight that gives `reps` after the suggested rest (at the same effort as last set).
  const weightFor = (reps: number) => {
    const cap = capacity(prev.weight, prev.reps) * (1 - profile.scale * priorLoss(Math.max(suggest, restS)));
    return roundLoad(toDisplay(cap / (1 + (reps + rir) / 30), unit), unit);
  };
  const atSuggest = Math.round(repsAtRest(Math.max(suggest, restS)));

  // Target reps typed in: how long until you can hit them?
  const target = Math.floor(Number(draftR));
  let plan: string | null = null;
  if (target > 0) {
    let need = -1;
    for (let s = 30; s <= FATIGUE.maxRestS; s += 5) {
      if (Math.round(repsAtRest(s)) >= target) {
        need = s;
        break;
      }
    }
    if (need < 0) plan = `${target} reps is unlikely at this weight today. ~${weightFor(target)} ${unit} should get you there.`;
    else if (need <= restS) plan = `Ready for ${target} reps now.`;
    else if (need > 300) plan = `${target} reps needs a long rest (~${mmss(need)}). Or use ~${weightFor(target)} ${unit} after ~${mmss(Math.max(suggest, restS))}.`;
    else plan = `For ${target} reps: rest until ~${mmss(need)} (${mmss(need - restS)} more).`;
  }

  const vs = todayVsUsual(today, profile.scale);
  return (
    <div className="fatigue-hint">
      <div>
        {typed > 0 ? 'At' : 'Next set at'} {fmtW(weightKg, unit)} {unit}: <b>~{r.reps} reps now</b> <span className="muted">({r.lo}–{r.hi}{rir > 0 ? `, at RIR ${rir}` : rirOf(last) === 0 ? ', to failure' : ''})</span>
      </div>
      <small className="muted">
        Rested {mmss(restS)}
        {restS < suggest - 10 ? ` · suggested rest ~${mmss(suggest)} → ~${atSuggest} reps` : ' · more rest adds little now'}
        {profile.targetStyle ? ' · based on how you usually stop at a target' : ''}
      </small>
      {plan && <small className="plan-text">{plan}</small>}
      {!typed && !target && <small className="muted">Type your next weight (and target reps) to plan the set.</small>}
      {vs && vs.ratio >= 1.6 && <small className="warn-text">Dropping off faster than usual today. Rest longer, or call it for this exercise.</small>}
    </div>
  );
}
