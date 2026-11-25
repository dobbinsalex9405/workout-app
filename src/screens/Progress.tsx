import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useLocal } from '../store';
import { DAY, bestOf, fmtDateLong, fmtN, fmtW, prTimeline, stallInfo, toDisplay, toSessions, workoutStarts } from '../calc';
import { E1RM_MAX_RELIABLE_REPS, STALL_MIN_DAYS, STALL_SESSIONS } from '../science';
import type { Session, SetEntry, Unit } from '../types';
import { Chart, Sparkline } from '../components/Chart';
import { StallSheet } from '../components/StallSheet';
import { Icon } from '../components/Icon';

type Range = '1M' | '3M' | '6M' | '1Y' | 'All';
const RANGES: Range[] = ['1M', '3M', '6M', '1Y', 'All'];
const RANGE_DAYS: Record<Range, number> = { '1M': 30, '3M': 91, '6M': 182, '1Y': 365, All: Infinity };

export function ProgressScreen() {
  const [selected, setSelected] = useLocal<number | null>('progress.ex', null);
  if (selected != null) return <Detail exId={selected} onBack={() => setSelected(null)} />;
  return <Overview onPick={setSelected} />;
}

function Overview({ onPick }: { onPick: (id: number) => void }) {
  const [unit] = useLocal<Unit>('unit', 'lb');
  const [q, setQ] = useLocal('progress.q', '');
  const rows =
    useLiveQuery(async () => {
      const [exs, sets] = await Promise.all([db.exercises.toArray(), db.sets.toArray()]);
      const starts = await workoutStarts();
      const by = new Map<number, SetEntry[]>();
      for (const s of sets) {
        const arr = by.get(s.exerciseId);
        if (arr) arr.push(s);
        else by.set(s.exerciseId, [s]);
      }
      return exs
        .filter((e) => by.has(e.id!))
        .map((e) => {
          const list = by.get(e.id!)!;
          const sessions = toSessions(list, starts);
          const last = sessions[sessions.length - 1];
          const cutoff = (last?.date ?? 0) - 30 * DAY;
          const before = sessions.filter((s) => s.date <= cutoff);
          const base = before.length ? Math.max(...before.map((s) => s.e1rm)) : sessions[0]?.e1rm;
          const delta = last && base ? ((last.e1rm - base) / base) * 100 : 0;
          return { ex: e, sessions, last, delta, best: bestOf(list), stall: stallInfo(sessions) };
        })
        .filter((r) => r.last)
        .sort((a, b) => b.last.date - a.last.date);
    }, []) ?? [];

  const filtered = rows.filter((r) => r.ex.name.toLowerCase().includes(q.trim().toLowerCase()));
  const stalled = rows.filter((r) => r.stall.stalled).length;

  return (
    <div className="screen">
      {rows.length > 0 && (
        <div className="tiles two">
          <div className="tile">
            <small>Exercises tracked</small>
            <b>{rows.length}</b>
          </div>
          <div className={`tile ${stalled ? 'warn' : ''}`}>
            <small title={`${STALL_SESSIONS}+ sessions and ${STALL_MIN_DAYS / 7}+ weeks without a new best`}>
              Stalled lifts
            </small>
            <b>{stalled}</b>
          </div>
        </div>
      )}
      <div className="search-box">
        <Icon name="search" size={18} />
        <input placeholder="Search exercises…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {rows.length === 0 && <div className="empty card">Log a workout and every exercise gets its own strength and volume graphs here.</div>}
      {filtered.map((r) => (
        <button key={r.ex.id} className="card list-row" onClick={() => onPick(r.ex.id!)}>
          <div className="grow">
            <b className="ellipsis">{r.ex.name}</b>
            <small className="muted ellipsis">
              e1RM {fmtW(r.last.e1rm, unit)} {unit} · {r.sessions.length} session{r.sessions.length === 1 ? '' : 's'}
            </small>
          </div>
          {r.stall.stalled ? <span className="badge warn">Stalled</span> : <Sparkline values={r.sessions.slice(-12).map((s) => s.e1rm)} />}
          <span className={`delta ${r.delta > 0.05 ? 'up' : r.delta < -0.05 ? 'down' : ''}`}>
            {r.delta > 0 ? '+' : ''}
            {r.delta.toFixed(1)}%
          </span>
        </button>
      ))}
    </div>
  );
}

function Detail({ exId, onBack }: { exId: number; onBack: () => void }) {
  const [unit] = useLocal<Unit>('unit', 'lb');
  const [range, setRange] = useLocal<Range>('progress.range', '3M');
  const [stallOpen, setStallOpen] = useState(false);
  const ex = useLiveQuery(() => db.exercises.get(exId), [exId]);
  const sets = useLiveQuery(() => db.sets.where('exerciseId').equals(exId).toArray(), [exId]) ?? [];
  const starts = useLiveQuery(workoutStarts, []);

  const all = toSessions(sets, starts);
  const cutoff = RANGE_DAYS[range] === Infinity ? 0 : Date.now() - RANGE_DAYS[range] * DAY;
  const s: Session[] = all.filter((x) => x.date >= cutoff);
  const best = bestOf(sets);
  const totalVolume = all.reduce((a, x) => a + x.volume, 0);
  const prs = prTimeline(sets);
  const stall = stallInfo(all);
  const highReps = s.some((x) => x.topReps > E1RM_MAX_RELIABLE_REPS);
  const w = (kg: number) => Math.round(toDisplay(kg, unit) * 10) / 10;

  return (
    <div className="screen">
      <div className="sub-head">
        <button className="btn ghost" onClick={onBack}>
          <Icon name="back" size={18} /> All
        </button>
        <h2 className="ellipsis">{ex?.name}</h2>
      </div>

      {stall.stalled && (
        <button className="card stall-banner" onClick={() => setStallOpen(true)}>
          <Icon name="alert" size={20} />
          <div className="grow">
            <b>Stalled for {stall.since} sessions</b>
            <small>Tap for what to try next</small>
          </div>
          <Icon name="chevron" size={16} />
        </button>
      )}

      <div className="tiles">
        <div className="tile">
          <small>Best e1RM</small>
          <b>
            {fmtW(best.e1rm, unit)} <i>{unit}</i>
          </b>
        </div>
        <div className="tile">
          <small>Heaviest</small>
          <b>
            {fmtW(best.weight, unit)} <i>{unit}</i>
          </b>
        </div>
        <div className="tile">
          <small>Sessions</small>
          <b>{all.length}</b>
        </div>
        <div className="tile">
          <small>Total volume</small>
          <b>
            {fmtN(toDisplay(totalVolume, unit))} <i>{unit}</i>
          </b>
        </div>
      </div>

      <div className="chips center">
        {RANGES.map((r) => (
          <button key={r} className={`chip ${range === r ? 'on' : ''}`} onClick={() => setRange(r)}>
            {r}
          </button>
        ))}
      </div>

      <div className="section-head">
        <span className="label">Strength</span>
      </div>
      <Chart title="Estimated 1RM" unitLabel={unit} points={s.map((x) => ({ x: x.date, y: w(x.e1rm) }))} format={(y) => String(y)} />
      {highReps && <p className="fine">Some sets here are over {E1RM_MAX_RELIABLE_REPS} reps, where 1RM estimates get less accurate.</p>}
      <Chart title="Top set weight" unitLabel={unit} color="var(--cyan)" points={s.map((x) => ({ x: x.date, y: w(x.topWeight) }))} format={(y) => String(y)} />

      <div className="section-head">
        <span className="label">Volume</span>
      </div>
      <Chart title="Session volume" unitLabel={unit} kind="bar" points={s.map((x) => ({ x: x.date, y: w(x.volume) }))} format={(y) => fmtN(y)} />
      <Chart title="Total reps" kind="bar" color="var(--cyan)" points={s.map((x) => ({ x: x.date, y: x.reps }))} format={(y) => String(y)} />

      <div className="section-head">
        <span className="label">Personal records</span>
      </div>
      <section className="card list">
        {prs.length === 0 && <div className="empty">No records broken yet. Keep pushing.</div>}
        {prs.slice(0, 15).map((p, i) => (
          <div key={i} className="pr-row">
            <span className="pr-kind">
              <Icon name="trophy" size={14} /> {p.kind}
            </span>
            <b>
              {fmtW(p.weight, unit)} {unit} × {p.reps}
            </b>
            <small className="muted">{fmtDateLong(p.ts)}</small>
          </div>
        ))}
      </section>

      {stallOpen && <StallSheet exId={exId} onClose={() => setStallOpen(false)} />}
    </div>
  );
}
