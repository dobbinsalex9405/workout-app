import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { GROUPS } from '../seed';
import { MUSCLES } from '../science';
import type { Exercise } from '../types';
import { Sheet } from './Sheet';
import { Icon } from './Icon';
import { ExerciseSheet } from './ExerciseSheet';

export function ExercisePicker({ onPick, onClose, exclude = [], title = 'Add exercise' }: { onPick: (id: number) => void; onClose: () => void; exclude?: number[]; title?: string }) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const all = useLiveQuery(() => db.exercises.orderBy('name').toArray(), []) ?? [];
  const query = q.trim().toLowerCase();
  const list = all.filter((e) => !exclude.includes(e.id!) && (!group || e.group === group) && e.name.toLowerCase().includes(query));
  const mine = list.filter((e) => e.mine);
  const rest = list.filter((e) => !e.mine);
  const exact = all.some((e) => e.name.toLowerCase() === query);

  const row = (e: Exercise) => (
    <button key={e.id} className="pick-row" onClick={() => onPick(e.id!)}>
      {e.mine && <Icon name="star" size={14} filled className="star" />}
      <span className="grow">
        <span className="ellipsis">{e.name}</span>
        <small className="muted ellipsis">{e.primary.map((m) => MUSCLES[m]?.name).join(', ') || e.group}</small>
      </span>
      <Icon name="plus" size={18} className="dim" />
    </button>
  );

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="search-box">
        <Icon name="search" size={18} />
        <input placeholder="Search or create…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="chips">
        {GROUPS.map((g) => (
          <button key={g} className={`chip ${group === g ? 'on' : ''}`} onClick={() => setGroup(group === g ? null : g)}>
            {g}
          </button>
        ))}
      </div>
      <div className="pick-list">
        {!exact && (
          <button className="pick-row create" onClick={() => setCreating(true)}>
            <Icon name="plus" size={18} />
            <span className="ellipsis">{query ? `Create “${q.trim()}”` : 'Create a new exercise'}</span>
            <small className="muted nowrap">set muscles</small>
          </button>
        )}
        {mine.length > 0 && <div className="pick-head label">My exercises</div>}
        {mine.map(row)}
        {mine.length > 0 && rest.length > 0 && <div className="pick-head label">All exercises</div>}
        {rest.map(row)}
        {list.length === 0 && !query && <div className="empty">Everything here is already added.</div>}
      </div>
      {creating && <ExerciseSheet initialName={q.trim()} initialGroup={group} onClose={() => setCreating(false)} onCreated={onPick} />}
    </Sheet>
  );
}
