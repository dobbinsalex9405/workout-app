import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Icon } from './Icon';

/** Tap a plan to add this exercise to it (appended at the end) or take it out. */
export function PlanToggles({ exId }: { exId: number }) {
  const plans = useLiveQuery(() => db.plans.orderBy('createdAt').toArray(), []) ?? [];

  const toggle = async (planId: number) => {
    const p = await db.plans.get(planId);
    if (!p) return;
    const has = p.exerciseIds.includes(exId);
    await db.plans.update(planId, { exerciseIds: has ? p.exerciseIds.filter((x) => x !== exId) : [...p.exerciseIds, exId] });
  };

  const newPlan = async () => {
    const name = prompt('Name the new plan', `Plan ${plans.length + 1}`)?.trim();
    if (name) await db.plans.add({ name, exerciseIds: [exId], createdAt: Date.now() });
  };

  return (
    <div className="chips wrap">
      {plans.map((p) => {
        const on = p.exerciseIds.includes(exId);
        return (
          <button key={p.id} className={`chip ${on ? 'on' : ''}`} onClick={() => toggle(p.id!)} aria-pressed={on}>
            {on && <Icon name="check" size={13} />} {p.name}
          </button>
        );
      })}
      <button className="chip dashed" onClick={newPlan}>
        <Icon name="plus" size={13} /> New plan
      </button>
    </div>
  );
}
