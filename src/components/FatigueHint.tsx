import { useEffect, useMemo, useState } from 'react';
import type { SetEntry, Unit } from '../types';
import { fmtW, fromDisplay } from '../calc';
import { FATIGUE, effReps, fatigueProfile, predictReps, predictionRange, rirOf, todayVsUsual } from '../fatigue';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Under an exercise during a workout: how many reps to expect on the next set, given how long
 * you've rested so far, learned from your own history on this exercise. Stays quiet (or says it's
 * still learning) until replaying your past sessions shows predictions are reliable for you.
 */
export function FatigueHint({ all, today, draftW, unit }: { all: SetEntry[]; today: SetEntry[]; draftW: string; unit: Unit }) {
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
  const rir = rirOf(last);
  const toFail = predictReps(profile.scale, prev, restS, weightKg);
  const r = predictionRange(profile, toFail);
  const in60 = predictionRange(profile, predictReps(profile.scale, prev, restS + 60, weightKg));
  const vs = todayVsUsual(today, profile.scale);
  // With RIR the model thinks in "reps to failure"; show what that means at the RIR you just used.
  const atRir = rir != null && rir > 0 ? Math.max(0, r.reps - Math.min(rir, 4)) : null;
  return (
    <div className="fatigue-hint">
      <div>
        Next set at {fmtW(weightKg, unit)} {unit}: <b>~{r.reps} reps{rir != null ? ' to failure' : ''}</b> <span className="muted">({r.lo}–{r.hi})</span>
        {atRir != null && <span className="muted"> · ~{atRir} at RIR {Math.min(rir!, 4)}</span>}
      </div>
      <small className="muted">
        Rested {mmss(restS)}
        {in60.reps > r.reps ? ` · another minute → ~${in60.reps}` : ''}
        {profile.targetStyle ? ' · based on how you usually stop at a target' : ''}
      </small>
      {vs && vs.ratio >= 1.6 && <small className="warn-text">Dropping off faster than usual today. Rest longer, or call it for this exercise.</small>}
    </div>
  );
}
