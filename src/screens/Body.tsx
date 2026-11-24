import { useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useLocal } from '../store';
import { DAY, fmtAgo, fmtHours, muscleStats, type MuscleStat } from '../calc';
import { FREQUENCY_TARGET, MUSCLES, MUSCLE_IDS, VOLUME_TARGET, volumeBand } from '../science';
import type { Muscle } from '../types';
import { BodyMap, heat, type MapMode } from '../components/BodyMap';

const RANGES = [7, 28, 90] as const;

export function BodyScreen() {
  const [mode, setMode] = useLocal<MapMode>('body.mode', 'fatigue');
  const [range, setRange] = useLocal<number>('body.range', 7);
  const [sel, setSel] = useLocal<Muscle | null>('body.sel', null);

  const data = useLiveQuery(async () => {
    const since = Date.now() - Math.max(range, 14) * DAY;
    const [sets, exs] = await Promise.all([db.sets.where('ts').above(since).toArray(), db.exercises.toArray()]);
    const exMap = new Map(exs.map((e) => [e.id!, e]));
    return { stats: muscleStats(sets, exMap, Date.now(), range), exMap };
  }, [range]);

  if (!data) return <div className="screen" />;
  const { stats, exMap } = data;

  // Volume colour: 0 → 20+ sets/week maps onto the full ramp.
  const value = (s: MuscleStat) => (mode === 'fatigue' ? s.fatigue : Math.min(1, s.perWeek / VOLUME_TARGET.max));
  const values = Object.fromEntries(MUSCLE_IDS.map((m) => [m, value(stats[m])])) as Record<Muscle, number>;
  const sorted = [...MUSCLE_IDS].sort((a, b) => value(stats[b]) - value(stats[a]));
  const s = sel ? stats[sel] : null;

  return (
    <div className="screen">
      <div className="seg">
        <button className={mode === 'fatigue' ? 'on' : ''} onClick={() => setMode('fatigue')}>
          Fatigue
        </button>
        <button className={mode === 'volume' ? 'on' : ''} onClick={() => setMode('volume')}>
          Volume
        </button>
      </div>

      {mode === 'volume' && (
        <div className="chips center">
          {RANGES.map((r) => (
            <button key={r} className={`chip ${range === r ? 'on' : ''}`} onClick={() => setRange(r)}>
              {r} days
            </button>
          ))}
        </div>
      )}

      <section className="card map-card">
        <BodyMap values={values} selected={sel} onSelect={(m) => setSel(sel === m ? null : m)} />
        <div className="ramp">
          <div className="ramp-bar" style={{ background: `linear-gradient(90deg, ${[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => heat(t)).join(',')})` }} />
          {mode === 'fatigue' ? (
            <div className="ramp-labels">
              <span>Fresh</span>
              <span>Worked</span>
              <span>Fatigued</span>
            </div>
          ) : (
            <div className="ramp-labels">
              <span>0</span>
              <span>5</span>
              <span>10</span>
              <span>15</span>
              <span>20+ sets/wk</span>
            </div>
          )}
        </div>
      </section>

      {s && sel && <MuscleDetail key={sel} m={sel} s={s} mode={mode} range={range} exName={(id) => exMap.get(id)?.name ?? '?'} onClose={() => setSel(null)} />}

      <div className="section-head">
        <span className="label">{mode === 'fatigue' ? 'Recovery status' : `Sets per week · ${range === 7 ? 'last 7 days' : `avg over ${range} days`}`}</span>
      </div>
      <section className="card list">
        {sorted.map((m) => {
          const st = stats[m];
          const v = value(st);
          return (
            <button key={m} className={`muscle-row ${sel === m ? 'on' : ''}`} onClick={() => setSel(sel === m ? null : m)}>
              <span className="mr-name">{MUSCLES[m].name}</span>
              <span className="mr-bar">
                <i style={{ width: `${Math.max(v > 0 ? 3 : 0, v * 100)}%`, background: heat(Math.max(0.25, v)) }} />
              </span>
              <span className="mr-val">{mode === 'fatigue' ? (st.fatigue < 0.01 ? '—' : `${Math.round(st.fatigue * 100)}%`) : st.perWeek.toFixed(1)}</span>
            </button>
          );
        })}
      </section>
      <p className="fine">
        {mode === 'fatigue'
          ? 'Fatigue rises with each hard set and fades over ~2–3 days (longer after sets to failure). It is a guide built from recovery research, not a measurement.'
          : 'Synergist sets count as half. 10–20 hard sets per muscle per week is the best-supported range for growth.'}
      </p>
    </div>
  );
}

function MuscleDetail({ m, s, mode, range, exName, onClose }: { m: Muscle; s: MuscleStat; mode: MapMode; range: number; exName: (id: number) => string; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);
  const band = volumeBand(s.perWeek);
  const tips: string[] = [];
  if (s.readyInHours > 0) tips.push(`Still recovering. Hard work for ${MUSCLES[m].name.toLowerCase()} should feel normal again in about ${fmtHours(s.readyInHours)}.`);
  else if (s.lastTs) tips.push('Recovered. Good to train hard again.');
  if (s.perWeek < VOLUME_TARGET.min && s.lastTs) tips.push(`Below ~${VOLUME_TARGET.min} sets/week. Adding a few sets here is the clearest lever for growth.`);
  if (s.perWeek > VOLUME_TARGET.max) tips.push(`Above ${VOLUME_TARGET.max} sets/week. Extra sets rarely add much here; watch recovery.`);
  if (s.lastTs && s.sessions7 < FREQUENCY_TARGET && s.perWeek >= 6) tips.push(`Trained ${s.sessions7}× this week. Splitting the same sets over ${FREQUENCY_TARGET} sessions makes each one easier to recover from.`);
  if (!s.lastTs) tips.push(`No sets logged for this muscle in the last ${Math.max(range, 14)} days.`);

  return (
    <section ref={ref} className="card muscle-detail">
      <div className="row-between">
        <h3>{MUSCLES[m].name}</h3>
        <button className="btn ghost sm" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="tiles three">
        <div className={`tile ${mode === 'fatigue' ? 'hl' : ''}`}>
          <small>Fatigue</small>
          <b>{Math.round(s.fatigue * 100)}%</b>
        </div>
        <div className="tile">
          <small>Ready in</small>
          <b>{fmtHours(s.readyInHours)}</b>
        </div>
        <div className={`tile ${mode === 'volume' ? 'hl' : ''}`}>
          <small>Sets / wk</small>
          <b>{s.perWeek.toFixed(1)}</b>
        </div>
      </div>
      <div className="kv">
        <span>Volume band</span>
        <b className={`band b${band.tone}`}>{band.label}</b>
      </div>
      <div className="kv">
        <span>Last trained</span>
        <b>{fmtAgo(s.lastTs)}</b>
      </div>
      <div className="kv">
        <span>Sessions, last 7 days</span>
        <b>{s.sessions7}</b>
      </div>
      {s.top.length > 0 && (
        <div className="kv col">
          <span>Main exercises (last {range} days)</span>
          <div className="mini-chips">
            {s.top.map((t) => (
              <span key={t.exerciseId}>
                {exName(t.exerciseId)} · {t.sets % 1 ? t.sets.toFixed(1) : t.sets}
              </span>
            ))}
          </div>
        </div>
      )}
      <ul className="tips">
        {tips.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </section>
  );
}
