import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteWorkout } from '../db';
import { setLocal, showPR, useLocal } from '../store';
import { detectPRs, e1rm, fmtDateLong, fmtW, fromDisplay, isWorking, stallInfo, toSessions, warmupFor } from '../calc';
import { MUSCLES, WARMUP_DEFAULT_PCT } from '../science';
import type { Plan, SetEntry, SetType, Unit, Workout } from '../types';
import { ExercisePicker } from '../components/ExercisePicker';
import { StallSheet } from '../components/StallSheet';
import { Icon } from '../components/Icon';

const TYPE_ORDER: SetType[] = ['normal', 'warmup', 'drop', 'failure'];
const TYPE_LABEL: Record<SetType, string> = { normal: 'Set', warmup: 'Warm', drop: 'Drop', failure: 'Fail' };

export async function startWorkout(from?: { plan?: Plan; repeat?: boolean }): Promise<boolean> {
  const active = await db.workouts.filter((w) => !w.endedAt).first();
  if (active) {
    alert('Finish or discard your current workout first.');
    return false;
  }
  let ids: number[] = [];
  let name = 'Workout';
  if (from?.plan) {
    ids = [...from.plan.exerciseIds];
    name = from.plan.name;
  } else if (from?.repeat) {
    const last = await db.workouts.orderBy('startedAt').reverse().filter((w) => !!w.endedAt).first();
    ids = last?.exerciseIds ?? [];
    name = last?.name ?? name;
  }
  await db.workouts.add({ name, startedAt: Date.now(), exerciseIds: ids, planId: from?.plan?.id });
  return true;
}

/**
 * Put an exercise in front of you to log: adds it to the running workout (or starts one),
 * then the Workout tab scrolls to its card.
 */
export async function logExerciseNow(exId: number) {
  const active = await db.workouts.filter((w) => !w.endedAt).first();
  if (active) {
    if (!active.exerciseIds.includes(exId)) await db.workouts.update(active.id!, { exerciseIds: [...active.exerciseIds, exId] });
  } else {
    await db.workouts.add({ name: 'Workout', startedAt: Date.now(), exerciseIds: [exId] });
  }
  localStorage.removeItem('scroll.workout'); // let the card scroll into view instead of restoring an old position
}

/** A running workout with no logged set for this long is ended automatically. */
export const AUTO_END_MINUTES = 60;

/**
 * End a forgotten workout. The end time is set to the last logged set (not "now"), so
 * duration stays honest. A workout with no sets at all is discarded instead.
 * Safe to call often: on launch, on returning to the app, and once a minute.
 */
export async function autoEndStaleWorkout(now = Date.now()) {
  const active = await db.workouts.filter((w) => !w.endedAt).first();
  if (!active) return;
  const sets = await db.sets.where('workoutId').equals(active.id!).toArray();
  const lastTs = sets.length ? Math.max(...sets.map((s) => s.ts)) : active.startedAt;
  if (now - lastTs < AUTO_END_MINUTES * 60000) return;
  if (sets.length) {
    await db.workouts.update(active.id!, { endedAt: lastTs });
    setLocal('workout.autoEnded', { name: active.name, sets: sets.length, at: lastTs });
  } else {
    await deleteWorkout(active.id!);
  }
  Object.keys(localStorage)
    .filter((k) => k.startsWith(`draft.${active.id}.`))
    .forEach((k) => localStorage.removeItem(k));
}

export function WorkoutScreen() {
  const [unit] = useLocal<Unit>('unit', 'lb');
  // undefined = still loading, null = no active workout
  const active = useLiveQuery(async () => (await db.workouts.filter((w) => !w.endedAt).first()) ?? null, []);
  if (active === undefined) return <div className="screen" />;
  return active ? <Active workout={active} unit={unit} /> : <Idle />;
}

/** One-time note after a forgotten workout was closed for you. */
function AutoEndedNote() {
  const [note, setNote] = useLocal<{ name: string; sets: number; at: number } | null>('workout.autoEnded', null);
  if (!note) return null;
  return (
    <section className="card auto-ended">
      <Icon name="info" size={18} />
      <p className="grow sm">
        <b>{note.name}</b> was ended automatically after {AUTO_END_MINUTES} minutes without a logged set. {note.sets} set{note.sets === 1 ? '' : 's'} saved; it's timed to your last set.
      </p>
      <button className="icon-btn sm" aria-label="Dismiss" onClick={() => setNote(null)}>
        <Icon name="close" size={15} />
      </button>
    </section>
  );
}

function Idle() {
  const plans = useLiveQuery(() => db.plans.orderBy('createdAt').toArray(), []) ?? [];
  const names = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id!, e.name])), []);
  const hasHistory = useLiveQuery(async () => (await db.workouts.count()) > 0, []);

  return (
    <div className="screen">
      <AutoEndedNote />
      <section className="card hero">
        <div className="hero-glow" />
        <span className="label">Ready</span>
        <h2 className="hero-title">Start a session</h2>
        <button className="btn primary big" onClick={() => startWorkout()}>
          <Icon name="plus" size={20} /> Empty workout
        </button>
        {hasHistory && (
          <button className="btn secondary big" onClick={() => startWorkout({ repeat: true })}>
            <Icon name="repeat" size={19} /> Repeat last workout
          </button>
        )}
      </section>

      <div className="section-head">
        <span className="label">From a plan</span>
      </div>
      {plans.length === 0 && <div className="empty card">Make plans in the Plans tab to start them in one tap.</div>}
      {plans.map((p) => (
        <button key={p.id} className="card plan-quick" onClick={() => startWorkout({ plan: p })}>
          <div className="grow">
            <b className="ellipsis">{p.name}</b>
            <small className="muted ellipsis">{p.exerciseIds.map((id) => names?.get(id)).filter(Boolean).join(' · ') || 'No exercises yet'}</small>
          </div>
          <span className="play">
            <Icon name="play" size={18} />
          </span>
        </button>
      ))}
    </div>
  );
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  const m = Math.max(0, Math.floor((now - since) / 60000));
  return <span className="elapsed">{m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`}</span>;
}

function Active({ workout, unit }: { workout: Workout; unit: Unit }) {
  const [picking, setPicking] = useState(false);
  const setCount = useLiveQuery(() => db.sets.where('workoutId').equals(workout.id!).count(), [workout.id]) ?? 0;

  const addExercise = async (id: number) => {
    await db.workouts.update(workout.id!, { exerciseIds: [...workout.exerciseIds, id] });
    setPicking(false);
  };

  const finish = async () => {
    if (setCount === 0) {
      if (confirm('No sets logged. Discard this workout?')) await deleteWorkout(workout.id!);
      return;
    }
    if (workout.planId) {
      const plan = await db.plans.get(workout.planId);
      if (plan && plan.exerciseIds.join() !== workout.exerciseIds.join() && confirm(`Update the "${plan.name}" plan with this workout's exercise list?`)) {
        await db.plans.update(plan.id!, { exerciseIds: [...workout.exerciseIds] });
      }
    }
    await db.workouts.update(workout.id!, { endedAt: Date.now() });
  };

  const discard = async () => {
    if (confirm('Discard this workout and all its sets?')) await deleteWorkout(workout.id!);
  };

  return (
    <div className="screen">
      <div className="workout-head">
        <div className="grow">
          <input className="title-input" value={workout.name} aria-label="Workout name" onChange={(e) => db.workouts.update(workout.id!, { name: e.target.value })} />
          <small className="muted">
            <span className="live-dot" /> <Elapsed since={workout.startedAt} /> · {fmtDateLong(workout.startedAt)}
          </small>
        </div>
        <button className="btn primary" onClick={finish}>
          <Icon name="check" size={18} /> Finish
        </button>
      </div>

      {workout.exerciseIds.length === 0 && <div className="empty card">Add your first exercise to get going.</div>}
      {workout.exerciseIds.map((id) => (
        <ExerciseCard key={id} workout={workout} exId={id} unit={unit} />
      ))}

      <button className="btn secondary big" onClick={() => setPicking(true)}>
        <Icon name="plus" size={20} /> Add exercise
      </button>
      <button className="btn link danger" onClick={discard}>
        Discard workout
      </button>

      {picking && <ExercisePicker exclude={workout.exerciseIds} onPick={addExercise} onClose={() => setPicking(false)} />}
    </div>
  );
}

function ExerciseCard({ workout, exId, unit }: { workout: Workout; exId: number; unit: Unit }) {
  const [warmPct] = useLocal('warmupPct', WARMUP_DEFAULT_PCT);
  const [stallOpen, setStallOpen] = useState(false);
  const [focus, setFocus] = useLocal<number | null>('workout.focus', null);
  const [flash, setFlash] = useState(false);
  const card = useRef<HTMLElement>(null);
  const ex = useLiveQuery(() => db.exercises.get(exId), [exId]);

  // Arrived here from "Log" in My exercises: bring this card into view and pulse it once.
  const focused = useRef(false);
  useEffect(() => {
    if (focus !== exId || !ex || focused.current) return;
    focused.current = true;
    window.setTimeout(() => {
      setFocus(null);
      card.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setFlash(true);
      window.setTimeout(() => setFlash(false), 1400);
    }, 320);
  }, [focus, exId, ex, setFocus]);
  const all = useLiveQuery(() => db.sets.where('exerciseId').equals(exId).toArray(), [exId]) ?? [];

  const sets = all.filter((s) => s.workoutId === workout.id).sort((a, b) => a.ts - b.ts);
  const others = all.filter((s) => s.workoutId !== workout.id && isWorking(s));
  const lastWid = others.length ? Math.max(...others.map((s) => s.workoutId)) : -1;
  const prev = others.filter((s) => s.workoutId === lastWid).sort((a, b) => a.ts - b.ts);
  const stall = stallInfo(toSessions(all.filter((s) => s.workoutId !== workout.id)));

  // Half-typed values survive reloads, app switches, and screen lock.
  const [draft, setDraft] = useLocal(`draft.${workout.id}.${exId}`, { w: '', r: '', t: 'normal' as SetType });

  const working = sets.filter(isWorking);
  const hint: SetEntry | undefined = working[working.length - 1] ?? prev[working.length] ?? prev[prev.length - 1];
  const hintW = hint ? fmtW(hint.weight, unit) : '';
  const hintR = hint ? String(hint.reps) : '';

  // Warm-up: one lighter set before the first working set.
  const baseKg = draft.w && draft.t !== 'warmup' ? fromDisplay(Number(draft.w), unit) : hint?.weight;
  const warm = working.length === 0 && !sets.some((s) => s.type === 'warmup') && baseKg && baseKg > 0 ? warmupFor(baseKg, warmPct, unit) : null;

  const log = async () => {
    const wStr = draft.w || hintW;
    const rStr = draft.r || hintR;
    const w = Number(wStr || 0);
    const reps = Math.floor(Number(rStr));
    if (!rStr || Number.isNaN(w) || Number.isNaN(reps) || reps < 1 || w < 0) return;
    const kg = fromDisplay(w, unit);
    const prs = detectPRs(all, kg, reps, draft.t);
    await db.sets.add({ workoutId: workout.id!, exerciseId: exId, weight: kg, reps, type: draft.t, ts: Date.now(), prs });
    // After a warm-up, clear so the working-weight hint comes back; otherwise keep values for the next set.
    setDraft(draft.t === 'warmup' ? { w: '', r: '', t: 'normal' } : { w: wStr, r: rStr, t: draft.t });
    if (prs.length) showPR({ exercise: ex?.name ?? '', kinds: prs, detail: `${fmtW(kg, unit)} ${unit} × ${reps}` });
  };

  const removeExercise = async () => {
    if (sets.length && !confirm(`Remove ${ex?.name} and its ${sets.length} logged sets from this workout?`)) return;
    await db.sets.where('workoutId').equals(workout.id!).and((s) => s.exerciseId === exId).delete();
    await db.workouts.update(workout.id!, { exerciseIds: workout.exerciseIds.filter((i) => i !== exId) });
  };

  const cycleType = () => setDraft({ ...draft, t: TYPE_ORDER[(TYPE_ORDER.indexOf(draft.t) + 1) % TYPE_ORDER.length] });
  let n = 0;

  return (
    <section ref={card} className={`card ex ${flash ? 'focus-flash' : ''}`}>
      <div className="ex-head">
        <div className="grow">
          <h3 className="ellipsis">{ex?.name ?? '…'}</h3>
          <small className="muted ellipsis">{ex?.primary.map((m) => MUSCLES[m].name).join(' · ')}</small>
        </div>
        {stall.stalled && (
          <button className="badge warn tap" onClick={() => setStallOpen(true)}>
            <Icon name="alert" size={13} /> Stalled
          </button>
        )}
        <button className="icon-btn" aria-label="Remove exercise" onClick={removeExercise}>
          <Icon name="close" size={18} />
        </button>
      </div>

      {prev.length > 0 && (
        <div className="prev ellipsis">
          <span className="label">Last</span> {prev.map((s) => `${fmtW(s.weight, unit)}×${s.reps}`).join('  ·  ')}
        </div>
      )}

      {sets.length > 0 && (
        <div className="sets">
          {sets.map((s) => {
            const w = isWorking(s);
            if (w) n++;
            return (
              <div key={s.id} className={`set ${s.type}`}>
                <span className="n">{w ? n : 'W'}</span>
                <span className="v">
                  {fmtW(s.weight, unit)}
                  <small> {unit}</small> × {s.reps}
                </span>
                {s.type === 'drop' || s.type === 'failure' ? <span className="tag">{TYPE_LABEL[s.type]}</span> : null}
                {w && !s.prs?.length && <span className="muted xs e1">e1RM {fmtW(e1rm(s.weight, s.reps), unit)}</span>}
                {s.prs?.length ? (
                  <span className="pr-chip">
                    <Icon name="trophy" size={12} /> PR
                  </span>
                ) : null}
                <button className="icon-btn sm" aria-label="Delete set" onClick={() => db.sets.delete(s.id!)}>
                  <Icon name="close" size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {warm && draft.t !== 'warmup' && (
        <button className="warm-btn" onClick={() => setDraft({ w: String(warm.weight), r: String(warm.reps), t: 'warmup' })}>
          <Icon name="flame" size={15} /> Warm-up set · {warm.weight} {unit} × {warm.reps}
          <small>{Math.round(warmPct * 100)}%</small>
        </button>
      )}

      <div className="entry">
        <button className={`type-btn ${draft.t}`} onClick={cycleType} aria-label={`Set type: ${draft.t}`}>
          {TYPE_LABEL[draft.t]}
        </button>
        <label className="field">
          <input inputMode="decimal" enterKeyHint="next" placeholder={hintW || '0'} value={draft.w} onChange={(e) => setDraft({ ...draft, w: e.target.value })} />
          <small>{unit}</small>
        </label>
        <span className="x">×</span>
        <label className="field">
          <input inputMode="numeric" enterKeyHint="done" placeholder={hintR || '0'} value={draft.r} onChange={(e) => setDraft({ ...draft, r: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && log()} />
          <small>reps</small>
        </label>
        <button className="btn primary log" onClick={log}>
          Log
        </button>
      </div>

      {stallOpen && <StallSheet exId={exId} onClose={() => setStallOpen(false)} />}
    </section>
  );
}
