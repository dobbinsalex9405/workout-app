import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteWorkout } from '../db';
import { useLocal } from '../store';
import { addDays, fmtDateLong, fmtN, fmtW, isStrengthSet, isWorking, startOfDay, startOfWeek, toDisplay } from '../calc';
import type { Unit } from '../types';
import { Chart } from '../components/Chart';
import { Heatmap } from '../components/Heatmap';
import { Icon } from '../components/Icon';
import { ExerciseSheet } from '../components/ExerciseSheet';

export function HistoryScreen() {
  const [unit] = useLocal<Unit>('unit', 'lb');
  const [open, setOpen] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const data = useLiveQuery(async () => {
    const [workouts, sets, exs] = await Promise.all([
      db.workouts.orderBy('startedAt').reverse().filter((w) => !!w.endedAt).toArray(),
      db.sets.toArray(),
      db.exercises.toArray(),
    ]);
    return { workouts, sets, names: new Map(exs.map((e) => [e.id!, e.name])) };
  }, []);

  if (!data) return <div className="screen" />;
  const { workouts, sets, names } = data;

  const volBy = new Map<number, number>();
  for (const s of sets) if (isWorking(s)) volBy.set(s.workoutId, (volBy.get(s.workoutId) ?? 0) + s.weight * s.reps);

  const days = new Map<number, { volume: number; workouts: number }>();
  for (const w of workouts) {
    const d = startOfDay(w.startedAt);
    const cur = days.get(d) ?? { volume: 0, workouts: 0 };
    cur.volume += toDisplay(volBy.get(w.id!) ?? 0, unit);
    cur.workouts += 1;
    days.set(d, cur);
  }

  const thisWeek = startOfWeek(Date.now());
  const weekly = Array.from({ length: 12 }, (_, i) => {
    const start = addDays(thisWeek, -(11 - i) * 7);
    const end = addDays(start, 7);
    const ws = workouts.filter((w) => w.startedAt >= start && w.startedAt < end);
    return { x: start, y: Math.round(toDisplay(ws.reduce((a, w) => a + (volBy.get(w.id!) ?? 0), 0), unit)), n: ws.length };
  });
  const now = weekly[weekly.length - 1];

  // Streak: consecutive weeks (ending this or last week) with at least one workout.
  let streak = 0;
  for (let i = weekly.length - 1; i >= 0; i--) {
    if (weekly[i].n > 0) streak++;
    else if (i === weekly.length - 1) continue;
    else break;
  }

  return (
    <div className="screen">
      <div className="tiles three">
        <div className="tile">
          <small>This week</small>
          <b>{now.n}</b>
        </div>
        <div className="tile">
          <small>Volume</small>
          <b>
            {fmtN(now.y)} <i>{unit}</i>
          </b>
        </div>
        <div className="tile">
          <small>Week streak</small>
          <b>{streak}</b>
        </div>
      </div>

      <section className="card">
        <Heatmap days={days} unit={unit} />
      </section>

      <Chart title="Weekly volume" kind="bar" unitLabel={unit} points={weekly.map((w) => ({ x: w.x, y: w.y }))} format={(y) => fmtN(y)} />

      <div className="section-head">
        <span className="label">Workouts</span>
      </div>
      {workouts.length === 0 && <div className="empty card">Finished workouts show up here.</div>}
      {workouts.map((w) => {
        const ws = sets.filter((s) => s.workoutId === w.id).sort((a, b) => a.ts - b.ts);
        const prCount = ws.filter((s) => s.prs?.length).length;
        const mins = Math.max(1, Math.round(((w.endedAt ?? w.startedAt) - w.startedAt) / 60000));
        const isOpen = open === w.id;
        return (
          <section key={w.id} className={`card hist ${isOpen ? 'open' : ''}`}>
            <button className="plain" onClick={() => setOpen(isOpen ? null : w.id!)}>
              <div className="row-between">
                <b className="ellipsis">{w.name}</b>
                <span className="row-gap">
                  {prCount > 0 && (
                    <span className="pr-chip">
                      <Icon name="trophy" size={12} /> {prCount}
                    </span>
                  )}
                  <Icon name="down" size={16} className="chev dim" />
                </span>
              </div>
              <small className="muted">
                {fmtDateLong(w.startedAt)} · {mins} min · {ws.filter(isStrengthSet).length} sets · {fmtN(toDisplay(volBy.get(w.id!) ?? 0, unit))} {unit}
              </small>
            </button>
            {isOpen && (
              <div className="hist-detail">
                {w.exerciseIds.map((id) => {
                  const xs = ws.filter((s) => s.exerciseId === id);
                  if (!xs.length) return null;
                  return (
                    <div key={id} className="hx">
                      <button className="hx-name" onClick={() => setEditId(id)}>
                        <b>{names.get(id)}</b>
                        <Icon name="edit" size={13} className="dim" />
                      </button>
                      <div className="hx-sets">
                        {xs.map((s) => (
                          <span key={s.id} className={`hx-set ${s.type} ${s.prs?.length ? 'pr' : ''} ${s.parent != null ? 'follow' : ''}`}>
                            {s.type === 'warmup' ? 'W ' : ''}
                            {s.parent != null ? (s.type === 'drop' ? `↘ ${fmtW(s.weight, unit)}×${s.reps}` : `+${s.reps}`) : `${fmtW(s.weight, unit)}×${s.reps}`}
                            {s.parent == null && (s.type === 'drop' || s.type === 'myo') ? <small> {s.type === 'drop' ? 'drop' : 'myo'}</small> : null}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <button
                  className="btn link danger"
                  onClick={() => {
                    if (confirm('Delete this workout permanently?')) deleteWorkout(w.id!);
                  }}
                >
                  Delete workout
                </button>
              </div>
            )}
          </section>
        );
      })}
      {editId != null && <ExerciseSheet id={editId} onClose={() => setEditId(null)} />}
    </div>
  );
}
