import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteExercise } from '../db';
import { GROUPS, GROUP_DEFAULT } from '../seed';
import type { Exercise } from '../types';
import { Sheet } from './Sheet';
import { Icon } from './Icon';
import { MuscleEditor, type MuscleSplit } from './MuscleEditor';
import { PlanToggles } from './PlanToggles';

/**
 * Create an exercise (no id) or edit one (id). Edits save as you go and apply everywhere
 * the exercise is used, because plans and workouts only hold its id.
 */
export function ExerciseSheet({ id, initialName = '', initialGroup, onClose, onCreated }: { id?: number; initialName?: string; initialGroup?: string | null; onClose: () => void; onCreated?: (id: number) => void }) {
  return id != null ? <EditExercise id={id} onClose={onClose} /> : <CreateExercise initialName={initialName} initialGroup={initialGroup ?? null} onClose={onClose} onCreated={onCreated} />;
}

function GroupChips({ value, onChange }: { value: string; onChange: (g: string) => void }) {
  return (
    <div className="chips wrap">
      {GROUPS.map((g) => (
        <button key={g} className={`chip ${value === g ? 'on' : ''}`} onClick={() => onChange(g)}>
          {g}
        </button>
      ))}
    </div>
  );
}

function CreateExercise({ initialName, initialGroup, onClose, onCreated }: { initialName: string; initialGroup: string | null; onClose: () => void; onCreated?: (id: number) => void }) {
  const [name, setName] = useState(initialName);
  const [group, setGroup] = useState(initialGroup ?? '');
  const [split, setSplit] = useState<MuscleSplit>({ primary: initialGroup ? [...(GROUP_DEFAULT[initialGroup] ?? [])] : [], secondary: [] });
  const [mine, setMine] = useState(true);
  const [busy, setBusy] = useState(false);

  // Picking a group pre-fills its usual muscles, but only while you haven't chosen any yourself.
  const pickGroup = (g: string) => {
    setGroup(g);
    if (!split.primary.length && !split.secondary.length) setSplit({ primary: [...(GROUP_DEFAULT[g] ?? [])], secondary: [] });
  };

  const trimmed = name.trim();
  const problem = !trimmed ? 'Give it a name.' : !split.primary.length ? 'Pick at least one primary muscle.' : null;

  const create = async () => {
    if (problem || busy) return;
    setBusy(true);
    const dupe = await db.exercises.filter((e) => e.name.toLowerCase() === trimmed.toLowerCase()).first();
    if (dupe) {
      setBusy(false);
      alert(`"${dupe.name}" already exists. Find it in the Library.`);
      return;
    }
    const newId = await db.exercises.add({ name: trimmed, group: group || 'Arms', primary: split.primary, secondary: split.secondary, custom: true, mine });
    onCreated?.(newId);
    onClose();
  };

  return (
    <Sheet title="New exercise" onClose={onClose}>
      <label className="form-label">Name</label>
      <input value={name} placeholder="e.g. Landmine Press" onChange={(e) => setName(e.target.value)} autoFocus={!initialName} />

      <label className="form-label">
        Group <small className="muted">for filtering</small>
      </label>
      <GroupChips value={group} onChange={pickGroup} />

      <label className="form-label">Muscles worked</label>
      <MuscleEditor value={split} onChange={setSplit} />

      <button className={`toggle-row ${mine ? 'on' : ''}`} onClick={() => setMine(!mine)}>
        <Icon name="star" size={18} filled={mine} /> Add to My exercises
      </button>

      {problem && <p className="fine center">{problem}</p>}
      <button className="btn primary big" disabled={!!problem || busy} onClick={create}>
        <Icon name="check" size={18} /> Create exercise
      </button>
    </Sheet>
  );
}

function EditExercise({ id, onClose }: { id: number; onClose: () => void }) {
  const ex = useLiveQuery(() => db.exercises.get(id), [id]);
  if (!ex) return null;
  const save = (patch: Partial<Exercise>) => db.exercises.update(id, patch);

  const del = async () => {
    if (!confirm(`Delete ${ex.name}? It will be removed from every plan.`)) return;
    if (await deleteExercise(id)) onClose();
    else alert('This exercise has logged sets, so it is kept to protect your history. You can take it off My exercises instead.');
  };

  return (
    <Sheet title="Edit exercise" onClose={onClose}>
      <label className="form-label">Name</label>
      <input value={ex.name} onChange={(e) => save({ name: e.target.value })} />
      <p className="fine">Changes apply everywhere this exercise appears, including past history.</p>

      <button className={`toggle-row ${ex.mine ? 'on' : ''}`} onClick={() => save({ mine: !ex.mine })}>
        <Icon name="star" size={18} filled={!!ex.mine} /> In My exercises
      </button>

      <label className="form-label">In plans</label>
      <PlanToggles exId={id} />

      <label className="form-label">
        Group <small className="muted">for filtering</small>
      </label>
      <GroupChips value={ex.group} onChange={(g) => save({ group: g })} />

      <label className="form-label">Muscles worked</label>
      <MuscleEditor value={{ primary: ex.primary, secondary: ex.secondary }} onChange={(v) => save(v)} />

      <button className="btn link danger" onClick={del}>
        <Icon name="trash" size={16} /> Delete exercise
      </button>
    </Sheet>
  );
}
