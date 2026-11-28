import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useLocal } from '../store';
import { GROUPS } from '../seed';
import { MUSCLES } from '../science';
import { fmtAgo, fmtW, isStrengthSet } from '../calc';
import type { Plan, SetEntry, Unit } from '../types';
import { ExercisePicker } from '../components/ExercisePicker';
import { ExerciseSheet } from '../components/ExerciseSheet';
import { PlanToggles } from '../components/PlanToggles';
import { Sheet } from '../components/Sheet';
import { Icon } from '../components/Icon';
import { logExerciseNow, startWorkout } from './Workout';

type View = 'plans' | 'mine' | 'library';

export function PlansScreen() {
  const [view, setView] = useLocal<View>('plans.view', 'plans');
  const [openId, setOpenId] = useLocal<number | null>('plans.open', null);

  if (view === 'plans' && openId != null) return <PlanEditor id={openId} onBack={() => setOpenId(null)} />;

  const tabs: [View, string][] = [
    ['plans', 'Plans'],
    ['mine', 'My exercises'],
    ['library', 'Library'],
  ];
  return (
    <div className="screen">
      <div className="seg">
        {tabs.map(([v, label]) => (
          <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
            {label}
          </button>
        ))}
      </div>
      {view === 'plans' ? <PlanList onOpen={setOpenId} /> : view === 'mine' ? <MyExercises /> : <Library />}
    </div>
  );
}

/** Your shortlist of exercises: log any of them right now, or drop them into plans. */
function MyExercises() {
  const [, setTab] = useLocal('ui.tab', 'workout');
  const [, setFocus] = useLocal<number | null>('workout.focus', null);
  const [unit] = useLocal<Unit>('unit', 'lb');
  const [editing, setEditing] = useState<number | null>(null);
  const [planFor, setPlanFor] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);

  const mine = useLiveQuery(async () => (await db.exercises.orderBy('name').toArray()).filter((e) => e.mine), []) ?? [];
  const plans = useLiveQuery(() => db.plans.toArray(), []) ?? [];
  const active = useLiveQuery(async () => (await db.workouts.filter((w) => !w.endedAt).first()) ?? null, []);
  const ids = mine.map((e) => e.id!);
  // Most recent working session per exercise, for the "last" line.
  const last = useLiveQuery(
    async () => {
      const sets = (await db.sets.where('exerciseId').anyOf(ids).toArray()).filter(isStrengthSet);
      const out = new Map<number, { ts: number; top: SetEntry }>();
      for (const s of sets) {
        const cur = out.get(s.exerciseId);
        if (!cur || s.workoutId > cur.top.workoutId || (s.workoutId === cur.top.workoutId && s.weight > cur.top.weight)) out.set(s.exerciseId, { ts: s.ts, top: s });
      }
      return out;
    },
    [ids.join()],
  );

  const log = async (exId: number) => {
    await logExerciseNow(exId);
    setFocus(exId);
    setTab('workout');
  };

  return (
    <>
      {mine.length === 0 && (
        <div className="empty card">
          Star the exercises you actually do. From here you can log one straight away or add it to plans. Custom exercises you create land here too.
        </div>
      )}
      {mine.length > 0 && (
        <section className="card list">
          {mine.map((e) => {
            const l = last?.get(e.id!);
            const inPlans = plans.filter((p) => p.exerciseIds.includes(e.id!)).length;
            const inWorkout = !!active?.exerciseIds.includes(e.id!);
            return (
              <div key={e.id} className="mine-row">
                <button className="grow mine-main" onClick={() => setEditing(e.id!)}>
                  <span className="ellipsis">{e.name}</span>
                  <small className="muted ellipsis">
                    {l ? `${fmtW(l.top.weight, unit)} ${unit} × ${l.top.reps} · ${fmtAgo(l.ts)}` : e.primary.map((m) => MUSCLES[m].name).join(' · ')}
                  </small>
                </button>
                <button className="icon-btn sm plan-btn" aria-label={`Add ${e.name} to a plan`} onClick={() => setPlanFor(e.id!)}>
                  <Icon name="plans" size={17} />
                  {inPlans > 0 && <i className="dot-count">{inPlans}</i>}
                </button>
                <button className={`btn primary log-now ${inWorkout ? 'in' : ''}`} onClick={() => log(e.id!)}>
                  {inWorkout ? 'Open' : 'Log'}
                </button>
              </div>
            );
          })}
        </section>
      )}
      {active && mine.length > 0 && <p className="fine center">A workout is running. Log adds the exercise to it.</p>}

      <button className="btn secondary big" onClick={() => setAdding(true)}>
        <Icon name="star" size={18} /> Add from library
      </button>
      <button className="btn ghost center-btn" onClick={() => setCreating(true)}>
        <Icon name="plus" size={18} /> Create a custom exercise
      </button>

      {adding && (
        <ExercisePicker
          title="Add to My exercises"
          exclude={ids}
          onClose={() => setAdding(false)}
          onPick={async (id) => {
            await db.exercises.update(id, { mine: true });
          }}
        />
      )}
      {creating && <ExerciseSheet onClose={() => setCreating(false)} />}
      {editing != null && <ExerciseSheet id={editing} onClose={() => setEditing(null)} />}
      {planFor != null && (
        <Sheet title={mine.find((e) => e.id === planFor)?.name ?? 'Add to plan'} onClose={() => setPlanFor(null)}>
          <p className="fine">Tap a plan to add or remove this exercise. It stays one exercise with one history, whatever plans it's in.</p>
          <PlanToggles exId={planFor} />
        </Sheet>
      )}
    </>
  );
}

function PlanList({ onOpen }: { onOpen: (id: number) => void }) {
  const plans = useLiveQuery(() => db.plans.orderBy('createdAt').toArray(), []) ?? [];
  const exs = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id!, e])), []);

  const create = async () => {
    const id = await db.plans.add({ name: `Plan ${plans.length + 1}`, exerciseIds: [], createdAt: Date.now() });
    onOpen(id);
  };

  return (
    <>
      {plans.length === 0 && (
        <div className="empty card">
          Plans are saved workouts like Push, Pull, Legs. An exercise can live in as many plans as you like and stays one exercise with one history.
        </div>
      )}
      {plans.map((p) => {
        const muscles = [...new Set(p.exerciseIds.flatMap((id) => exs?.get(id)?.primary ?? []))].slice(0, 5);
        return (
          <button key={p.id} className="card plan-card" onClick={() => onOpen(p.id!)}>
            <div className="row-between">
              <b className="ellipsis">{p.name}</b>
              <span className="muted sm nowrap">
                {p.exerciseIds.length} exercise{p.exerciseIds.length === 1 ? '' : 's'} <Icon name="chevron" size={14} />
              </span>
            </div>
            <div className="mini-chips">
              {muscles.map((m) => (
                <span key={m}>{MUSCLES[m].name}</span>
              ))}
            </div>
          </button>
        );
      })}
      <button className="btn secondary big" onClick={create}>
        <Icon name="plus" size={20} /> New plan
      </button>
    </>
  );
}

function PlanEditor({ id, onBack }: { id: number; onBack: () => void }) {
  const [, setTab] = useLocal('ui.tab', 'workout');
  const [picking, setPicking] = useState(false);
  // undefined = loading, null = deleted
  const plan = useLiveQuery(async () => (await db.plans.get(id)) ?? null, [id]);
  const allPlans = useLiveQuery(() => db.plans.toArray(), []) ?? [];
  const exs = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id!, e])), []);

  useEffect(() => {
    if (plan === null) onBack();
  }, [plan, onBack]);

  if (!plan) return <div className="screen" />;

  const save = (patch: Partial<Plan>) => db.plans.update(id, patch);
  const move = (i: number, d: number) => {
    const ids = [...plan.exerciseIds];
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    save({ exerciseIds: ids });
  };
  const alsoIn = (exId: number) => allPlans.filter((p) => p.id !== id && p.exerciseIds.includes(exId)).map((p) => p.name);

  const start = async () => {
    if (await startWorkout({ plan })) setTab('workout');
  };
  const remove = async () => {
    if (!confirm(`Delete the "${plan.name}" plan? Exercises and history are kept.`)) return;
    await db.plans.delete(id); // the effect above navigates back
  };

  return (
    <div className="screen">
      <div className="sub-head">
        <button className="btn ghost" onClick={onBack}>
          <Icon name="back" size={18} /> Plans
        </button>
      </div>
      <input className="title-input" value={plan.name} aria-label="Plan name" onChange={(e) => save({ name: e.target.value })} />

      <section className="card list">
        {plan.exerciseIds.length === 0 && <div className="empty">No exercises yet.</div>}
        {plan.exerciseIds.map((exId, i) => {
          const ex = exs?.get(exId);
          const others = alsoIn(exId);
          return (
            <div key={exId} className="plan-row">
              <span className="idx">{i + 1}</span>
              <div className="grow">
                <span className="ellipsis">{ex?.name ?? 'Deleted exercise'}</span>
                <small className="muted ellipsis">{others.length ? `Also in ${others.join(', ')}` : ex?.primary.map((m) => MUSCLES[m].name).join(' · ')}</small>
              </div>
              <button className="icon-btn sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                <Icon name="up" size={16} />
              </button>
              <button className="icon-btn sm" aria-label="Move down" disabled={i === plan.exerciseIds.length - 1} onClick={() => move(i, 1)}>
                <Icon name="down" size={16} />
              </button>
              <button className="icon-btn sm" aria-label="Remove from plan" onClick={() => save({ exerciseIds: plan.exerciseIds.filter((x) => x !== exId) })}>
                <Icon name="close" size={16} />
              </button>
            </div>
          );
        })}
      </section>

      <button className="btn secondary big" onClick={() => setPicking(true)}>
        <Icon name="plus" size={20} /> Add exercise
      </button>
      <button className="btn primary big" disabled={plan.exerciseIds.length === 0} onClick={start}>
        <Icon name="play" size={18} /> Start this plan
      </button>
      <button className="btn link danger" onClick={remove}>
        Delete plan
      </button>

      {picking && (
        <ExercisePicker
          title={`Add to ${plan.name}`}
          exclude={plan.exerciseIds}
          onClose={() => setPicking(false)}
          onPick={(exId) => {
            save({ exerciseIds: [...plan.exerciseIds, exId] });
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

function Library() {
  const [q, setQ] = useLocal('library.q', '');
  const [group, setGroup] = useLocal<string | null>('library.group', null);
  const [editing, setEditing] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const exs = useLiveQuery(() => db.exercises.orderBy('name').toArray(), []) ?? [];
  const plans = useLiveQuery(() => db.plans.toArray(), []) ?? [];
  const list = exs.filter((e) => (!group || e.group === group) && e.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <>
      <div className="search-box">
        <Icon name="search" size={18} />
        <input placeholder="Search exercises…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="chips">
        {GROUPS.map((g) => (
          <button key={g} className={`chip ${group === g ? 'on' : ''}`} onClick={() => setGroup(group === g ? null : g)}>
            {g}
          </button>
        ))}
      </div>
      <section className="card list">
        {list.map((e) => {
          const inPlans = plans.filter((p) => p.exerciseIds.includes(e.id!)).length;
          return (
            <div key={e.id} className="lib-row">
              <button className={`star-btn ${e.mine ? 'on' : ''}`} aria-label={e.mine ? `Remove ${e.name} from My exercises` : `Add ${e.name} to My exercises`} aria-pressed={!!e.mine} onClick={() => db.exercises.update(e.id!, { mine: !e.mine })}>
                <Icon name="star" size={19} filled={!!e.mine} />
              </button>
              <button className="grow lib-main" onClick={() => setEditing(e.id!)}>
                <span className="ellipsis">{e.name}</span>
                <small className="muted ellipsis">
                  {e.primary.map((m) => MUSCLES[m].name).join(' · ')}
                  {e.secondary.length ? <span className="dim"> + {e.secondary.map((m) => MUSCLES[m].name).join(', ')}</span> : null}
                </small>
              </button>
              {inPlans > 0 && <span className="count-pill">{inPlans} plan{inPlans === 1 ? '' : 's'}</span>}
              <Icon name="chevron" size={16} className="dim" />
            </div>
          );
        })}
        {list.length === 0 && <div className="empty">No matches.</div>}
      </section>
      <button className="btn secondary big" onClick={() => setCreating(true)}>
        <Icon name="plus" size={20} /> Create a custom exercise
      </button>
      {creating && <ExerciseSheet initialName={q.trim()} initialGroup={group} onClose={() => setCreating(false)} />}
      {editing != null && <ExerciseSheet id={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
