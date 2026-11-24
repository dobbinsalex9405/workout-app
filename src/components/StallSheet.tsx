import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useLocal } from '../store';
import { fmtDate, muscleStats, stallAdvice, stallInfo, toSessions } from '../calc';
import { STALL_SESSIONS } from '../science';
import type { Unit } from '../types';
import { Sheet } from './Sheet';

/** Explains why an exercise is flagged and what to try, using the lifter's own numbers. */
export function StallSheet({ exId, onClose }: { exId: number; onClose: () => void }) {
  const [unit] = useLocal<Unit>('unit', 'lb');
  const data = useLiveQuery(async () => {
    const [ex, sets, all, exs] = await Promise.all([
      db.exercises.get(exId),
      db.sets.where('exerciseId').equals(exId).toArray(),
      db.sets.where('ts').above(Date.now() - 28 * 86400000).toArray(),
      db.exercises.toArray(),
    ]);
    const stats = muscleStats(all, new Map(exs.map((e) => [e.id!, e])), Date.now(), 28);
    return { ex, sessions: toSessions(sets), weekly: ex?.primary[0] ? stats[ex.primary[0]].perWeek : undefined };
  }, [exId]);
  if (!data) return null;
  const info = stallInfo(data.sessions);
  const advice = stallAdvice(data.sessions, data.ex, unit, data.weekly);

  return (
    <Sheet title={data.ex?.name ?? 'Stall'} onClose={onClose}>
      <div className="stall-head">
        <span className="badge warn">Stalled</span>
        <p className="muted sm">
          {info.since} sessions without a new estimated-1RM best
          {info.lastPrDate ? ` (last one ${fmtDate(info.lastPrDate)})` : ''}. Flagged at {STALL_SESSIONS}.
        </p>
      </div>
      <div className="advice">
        {advice.map((a) => (
          <div key={a.title} className="advice-item">
            <b>{a.title}</b>
            <p>{a.body}</p>
          </div>
        ))}
      </div>
      <p className="fine">Based on ACSM progression guidance and deload research. See Settings → The science.</p>
    </Sheet>
  );
}
